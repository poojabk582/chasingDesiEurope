# TECH-STACK — Case Follow-up Board

**Companion to:** PRD.md (DRAFT)
**Scale this design serves:** 100 users. Not a million, not "web scale." That number.

## The two inputs, restated

- **Requirements:** one board; a row per person (name, one of four stuck-types, next chase date, fee at stake, outcome); ticking an outcome updates the top totals straight away; at-a-glance overdue surfacing; fully usable at 375 px on a phone; the "for the group" story is unresolved (PRD §2) and per-user accounts are Phase 2 (§6). Not building: client-facing views, automated sending, payments, history, native apps (§5).
- **Scale:** 100 users. The whole board fits in one fetch (~200 rows); writes are human-speed (tens of ticks a day).

## What you will not find here, deliberately

No Kubernetes, no Kafka/message queue, no multi-region, no Terraform, no microservices, no observability stack, no second "analytics" database, no Redis. Constraint: 100 users. Each of those earns its keep only when the pain it removes exceeds its own operations cost, and at this scale none does. Revisit this list at ~10,000 users; not before.

---

## Database

**Choice: Cloudflare D1 (managed SQLite) behind Drizzle ORM.**

Constraints that force it: ~10k rows with a rigid schema (person + enum track + date + money + enum outcome), almost zero write concurrency, the board must load in one fetch, zero-ops on a free tier.

Schema sketch (informs the choice, not a spec):

```
rows      (id, person_name, track, next_chase_date TEXT ISO, fee_amount NUMERIC,
           fee_currency TEXT, outcome, created_at, updated_at, ...)
users     (id, email, password_hash)            -- only when per-user auth lands
board_meta(id, timezone, fee_currency_default)  -- one board, per PRD §4.1
```

**Rejected:**
- **Postgres (including managed Neon/Supabase free tiers).** Its power — heavy concurrency, JSONB, extensions — is called for by nothing here, and it adds a service to babysit and a connection story at a scale that is one small table. The only real Postgres argument, row-level security for the fee-privacy contradiction, is a "postal order from the client," not today's reason.
- **MongoDB / document stores.** The schema is fixed and relational; document stores push joins and invariants into client code.
- **Airtable / "spreadsheet-as-a-database".** Per-tick HTTP latency and per-row rate limits kill the one interaction that is the pitch ("ticking updates the totals straight away"), and overdue logic lands in client JS on someone else's throttled API.
- **SQLite on a $5 VPS.** The fallback, not the choice. A free tier genuinely serves this scale (headroom below), and a VPS costs patching, TLS renewal and backups — the operations tax that eats small apps. Revisit only if D1 vendor-lock-in becomes the fear; the ORM softens it.

**Free tier, and the exact limit that forces you off it:**
- Caps (free): 5M rows read/day, 100k rows written/day, 5 GB.
- Load model at **100 users**: 100 users × ~10 board opens/day × ~200 rows loaded ≈ 0.2M reads/day (≈25× headroom); ~2k writes/day (≈50× headroom). The write cap effectively never binds.
- **The first limit you would genuinely hit: D1's 5M rows-read/day, at roughly 25× today's load — about 2,500 users at the same habits.** Cheap escapes before paying anything: fetch only `updatedSince` rows on repeat opens, or take the $5/month D1 bump. Your original 1,000-user estimate fits the free tier too (~2M reads/day), so this is not a decision you have to make soon.

**Config switch or rewrite:** data access sits behind Drizzle, so SQLite→Postgres later is a config + migration, **not an app rewrite — provided nobody writes raw D1 bindings inline.** The one thing that would make it a rewrite is realtime subscriptions welded into the schema (last section).

---

## Authentication

**MVP: one shared access code.** An opaque passcode the operator sets once; the Worker checks it before every request and issues an httpOnly, same-site session cookie.

Constraints that force it: ~100 trusted users, one board, and per-account identity is explicitly Phase 2 scope — the "one operator vs the whole group" contradiction (PRD §2.3) has not even been answered.

**Production (when the group story lands): per-user accounts** — email + password, Argon2id, a `users` table in D1, DB-backed sessions. Constraint that forces it: they only become necessary when "for the group" is true and the fee-privacy contradiction demands per-member identity.

**Rejected:**
- **Hosted identity platforms (Clerk, Auth0, Firebase Auth, Supabase Auth).** Monthly-active-user tiers, a second dashboard and a second vendor for a ≤100-user private board. Per-user identity may not even be needed once PRD §2.3 resolves.
- **OAuth (Google/Apple sign-in).** Public-facing onboarding machinery; a private board with one operator neither needs a consent screen nor an external dependency.
- **JWT in localStorage.** XSS-exposed; a cookie session is simpler and safer.

**Config switch or rewrite:** shared code → per-user accounts is a **REWRITE**, but a sealed one: it all sits behind one auth module, so the swap never touches rows, totals or overdue logic. And note plainly: the shared code does **not** resolve the fee-privacy contradiction — if "fees private" is the answer, per-user auth moves into Phase 1 and *is* the price of that answer.

---

## Frontend framework

**Choice: React + Vite, built as a static SPA.**

Constraints that force it: one dynamic screen (the board) with high-interaction ticking; phone-first at 375 px; a static build deploys anywhere for $0; the ecosystem covers the date/workheadroom work. Phone-first is a CSS discipline (one column, ≥44 px tap targets, one breakpoint) — not an app category, and the PRD already rules out native apps (§5.5).

Totals are computed **client-side** from the loaded rows after each tick — instant, no round trip — while the Worker recomputes authoritative totals on every read, so a phone that stayed closed all morning reconciles on open. Constraint that forces this: "updates the totals at the top straight away" without a server call per tick.

**Rejected:**
- **Next.js / Remix / SvelteKit full-stack.** Server rendering earns its keep on many dynamic pages and SEO; this is one password-gated screen. Adopting one couples the frontend to a server runtime and drags the hosting choice along — the infrastructure tax this document exists to avoid.
- **Svelte/SvelteKit.** ~20–30 KB lighter bundle; genuinely nice tooling. But the saving is immaterial to first paint on a single page, and React's ecosystem and hiring surface are larger. Runner-up, not the pick.
- **Vanilla JS + HTMX / server-rendered.** "Tick → totals recompute instantly, nothing postponed" is dramatically easier in a reactive UI, and with one screen the SPA cost is a rounding error.
- **Component libraries / UI kits.** The entire UI is a table, buttons and a totals strip. A kit buys skin-fighting; plain scoped CSS.
- **Angular.** Heaviest option; its ceremony buys nothing here.

**Config switch or rewrite:** static forever. A PWA pass (install prompt + cached read) is a manifest + service worker — config. Offline *writes* would be a rewrite (they belong to the sync family in the last section) and are rejected at this stage.

---

## Server functions

**Choice: one Cloudflare Worker — a single small script with a handful of routes.**

Constraints: 100 users ≈ a few thousand requests a day; the whole backend is board rows, authoritative totals, overdue computation and one webhook. One script on the same platform as the database is the cheapest thing that can hold it.

Routes: `GET /board` (rows + overdue flags + authoritative totals), `POST /rows`, `PATCH /rows/:id` (tick outcome / chase date / fee), `POST /intake` (import), auth middleware in front of everything.

**Rejected:**
- **A Node VM (Express/Fastify on a VPS).** Pushes us back onto VPS operations for no benefit at this load.
- **Cloud Run / Fly containers.** Orchestration overhead; you pay for idle.
- **Next.js API routes.** The framework coupling already rejected.
- **Cron jobs.** Nothing to schedule. Overdue is derived state computed on read; a scheduler would be a machine that exists to run a 3-line `SELECT`. The Monday note (PRD §8) is a document the operator writes, not an app feature.

**Config switch or rewrite:** none on the horizon. The "one script" rule carries one condition — split it into per-route modules so rebundle stays cheap — and revisit only when the team (not the users) outgrows Cloudflare, which is a long way past this scale.

---

## Hosting

**Choice: Cloudflare Pages (static build) + the Worker + D1, behind a custom domain (~$10/yr).**

Constraints that force it: a free tier that permits **commercial** use, a global CDN for a phone "opened before a call" on mobile data, and frontend + API + data on one control plane with one set of limits to reason about.

**Rejected:**
- **Vercel.** Its Hobby ("free") plan is for non-commercial use — the operator sells this service, so that free tier is off the table by its own terms, and it pushes database and auth onto partners. A free tier that isn't.
- **Netlify.** Workable, but smaller function free tier and it splits frontend, API and data across vendors.
- **AWS / Azure / GCP / Render / Railway / Heroku.** The enterprise reflex. All cost more; none serves 100 users better.
- **Splitting frontend and API across hosts to save pennies.** Splits the auth and limits story too.

**Free tier limits, and the one that forces you off:** Workers free is 100k requests/day (≈30× our load); D1 caps above; Pages free allows 500 builds/month — **the only cap a live CI pipeline can genuinely trip is the 500-builds/month deploy limit. Throttle deploys, or accept the $5/mo paid tier the day it bites.** Every data limit has ≥25× headroom at 100 users; none forces a move.

---

## What the PRD's features specifically demand

- **Intake import (PRD Open Dependency 3).** Post accepted cases from the intake system to `POST /intake` as a webhook. MVP also keeps manual row entry, because the client has not said where the fee and chase date come from. **Config switch, not a rewrite.** Rejected as primary: scheduled pulls from, or live reads of, the intake system's internal storage — a beta-API dependency on someone else's store, plus broken-sync tax. If the intake cannot reach a webhook, copy-paste CSV import is the fallback.
- **Timezone.** The board lives in Germany (the client's own service is Germany-time). Store the calendar date plus a per-board timezone (default `Europe/Berlin`) and compute overdue in that zone. Rejected: UTC instants, which move "slipping" by a day around midnight for date-only deadlines.
- **Currency.** Fee is a number plus an ISO-4217 code column, defaulting to the client's currency until dependency 5 resolves. One column, not a payments subsystem (PRD §5.3).
- **Overdue "one look".** Computed `overdue` flag + ordering on read. No background job (see cron rejection).
- **Phone.** Strict 375 px layout, tap targets ≥44 px. PWA install for offline *reading* — config. Offline *writes*: rejected (same expensive family as realtime).

---

## MVP → production

**MVP:** shared code auth · D1 behind Drizzle · React+Vite SPA on Pages · one Worker · manual entry + intake webhook · client-side totals with reconcile-on-read.

**Production:** the same skeleton. The changes, classified:

| Change | Type |
|---|---|
| Shared code → per-user accounts | **REWRITE** (sealed: one auth module) |
| On-device totals → cross-device live sync | **REWRITE** (the expensive one, below) |
| D1 → Postgres, if it ever happens | Near-config (Drizzle) |
| PWA install / offline-read | Config (manifest + service worker) |
| Intake source: manual → webhook → scheduled pull | Config switches, backwards-compatible |
| D1/Workers paid bumps | Config, same code |

The rewrites are the first two rows. Everything else is a knob.

---

## the decision most expensive to reverse

**Scoping "updates the totals at the top straight away" to the operator's own device — versus committing to cross-device real-time sync today.**

It is the most expensive to reverse because it is the one choice that threads through every layer: the moment rows stream over a live subscribed channel, the data model, the auth/session model, offline behaviour and the UI's whole interaction shape move together to serve it — and PRD Contradiction 5 flags that exact word as the priciest in the brief.

Building the per-device version now (optimistic ticks + reconcile on every open/focus) upgrades cheaply later: adding a durable subscription on top of a plain fetch-or-write API is additive. Building real-time first commits you to presence, conflict handling and an always-on channel for a board that might see two dozen human updates a day — and there is no cheap way to un-build it. Six months in, deleting it means ripping the plumbing out from underneath the board, not just removing a dependency.

Runner-up for the same prize, rejected here: making the intake system's internal store the live source of truth. Cheap-looking now, welded to someone else's storage later. The board keeps its own data; intake is input.

**Action:** before Phase 1 sizing, get the client's answer to Contradiction 5. The per-device reading ships the whole pitch; the live-sync reading should be quoted as a separate, much larger number.
