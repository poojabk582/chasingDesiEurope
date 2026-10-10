# IMPLEMENTATION-PLAN — Case Follow-up Board

**Companion to:** PRD.md (DRAFT) and TECH-STACK.md.
**Scale:** 100 users. **Budget:** one working week. **Estimate total:** 10 half-days (~5 days), leaving slip room inside the week.

## The ordering rule

Every step ends in **something opened on a phone and looked at**. Not "the schema is migrated" — a screen. If a step cannot end that way, it is two steps or it is in the wrong place.

The order exists to catch a mistake in one building step before it has other steps standing on it. A data-model mistake is cheap at Step 1 (re-seed) and expensive at Step 9 (unwind everything above it).

---

## Decisions to lock, in the order they bite

These are the doors. Each one sits **before** the step it gates. A late change in any of them unwinds the steps above it, so they are collected here, in the order they fire.

1. **Real-time scope — "updates the totals straight away" (PRD Contradiction 5).** The most expensive-to-reverse decision in the whole build (TECH-STACK names it). **Gates Step 3.** Get the client's answer *before* Step 3 starts. If the answer is "per-device, reconcile on open," the plan below holds. If the answer is "must appear live on every phone," Steps 3–6 change shape (subscription layer, presence, conflict handling) and the plan must be re-estimated before any of it is built. Cheap to decide now; brutal to reverse at Step 9. **Ask the client this before Phase 1 sizing.**
2. **Fee visibility (PRD Contradiction 1).** If group members may see every row's fee, the shared access code survives. If fees must be private per member, per-user accounts move from Phase 2 into Phase 1 and Step 5 grows from a shared code into real accounts — re-estimate at that point. **Gates Step 5.**
3. **Where the fee and chase date come from (PRD Open Dependency 3).** Manual entry, the intake webhook, or both? The MVP builds both (Steps 4 and 6) with a config switch for which one wins; what must be decided is which is the *source of truth* for the launch, because that sets Step 4's form defaults and Step 6's mapping. **Gates Step 6.**
4. **Outcome list: fixed at called / sent / done, or editable (PRD Contradiction 4).** Low cost either way today, but the enum is in every row from Step 1, so an "editable" answer before Step 3 saves a migration later. Decide by then; do not let it leak past Step 3.

---

## Steps — Phase 1

### Step 1 — The thin slice: real rows on a real screen
- **Builds:** repo bootstrap; Vite + React app; one Worker route `GET /board`; D1 schema (rows: person, track, next chase date, fee, outcome) behind Drizzle; three seed rows covering flat search / job application / form to send, one of them overdue.
- **You see at the end (phone):** the seeded board — person, track, chase date, fee, outcome — in one column at 375 px, sourced from the real database.
- **Catches early:** the whole dev loop (Vite ↔ Worker ↔ D1), the data model, the track list, the fee display, the phone-layout skeleton. All of it cheap to fix here, none of it cheap at the end.
- **Estimate:** 1 day.
- **Verify — build is not done until this is ticked:** open on a real phone at 375 px; all four tracks present; reload shows the rows again; edit a seed row in the DB and the phone reflects it after reload.

### Step 2 — "One look": overdue and the totals strip
- **Builds:** overdue computed in the Worker (calendar dates vs today, `Europe/Berlin`); overdue rows highlighted and ordered to the top; a totals strip at the top of the board (e.g. open cases, at risk, done).
- **You see at the end (phone):** a glance that names what is slipping without reading rows — overdue rows stand out, the strip counts them.
- **Catches early:** date parsing, timezone bugs, the midnight boundary, whether "slipping" means what the client means before anything is wired on top of it.
- **Estimate:** 0.5 day.
- **Verify:** seed dates for past / today / tomorrow; flags and strip match a manual count; nudge a seed to 00:01 and 23:59 local and confirm the flag flips on the right day; reload keeps it stable.

### Step 3 — The pitch: tick an outcome, totals move — **GATED on Decision 1**
- **Builds:** tapping called / sent / done on a row; optimistic client update; `PATCH /rows/:id`; totals recompute on the same screen with no refresh; authoritative totals reconciled on every open.
- **You see at the end (phone):** tap a row, the row changes and the strip above it changes on the same screen immediately; reload shows the same state; a second phone opened later sees the update.
- **Catches here:** the interaction model, the totals math, the PATCH path, and — most importantly — the real-time scoping decision that shapes everything downstream.
- **Estimate:** 1 day.
- **Verify:** tick on phone A; open phone B and confirm the reconciled state; reload persistence; totals math against a known 3-row case; two rapid taps on one row do not double-count.

### Step 4 — Add and correct a case (manual entry)
- **Builds:** a small add-case form on the board (person, track, chase date, fee, default outcome); edit fields on an existing row; validation mirrors the PRD's date rule (must be today or later).
- **You see at the end (phone):** a case you typed appears on the board and the totals include it; reload keeps it.
- **Catches here:** the form at 375 px, validation behaviour, CRUD completeness, how "fee" is entered before Decision 3's source of truth is wired.
- **Estimate:** 0.5 day.
- **Verify:** add → reload → present; chase date in the past is blocked with a real message; empty required fields blocked; edit a fee and reload.

### Step 5 — The door: shared access code — **GATED on Decision 2**
- **Builds:** a code screen ahead of the board; httpOnly, same-site session cookie; the Worker rejects requests without or with a wrong code; a log-out action. (If Decision 2 said "fees private," this step is per-user accounts instead — bigger, re-estimate before starting.)
- **You see at the end (phone):** a fresh phone shows the code gate; the right code opens the board; a wrong code shows nothing.
- **Catches here:** that the board is never visible pre-auth, cookie flags, and the shape of the auth module all other steps now trust.
- **Estimate:** 0.5 day.
- **Verify:** incognito/private window → gate; wrong code rejected; right code in; reload keeps the session; log out and the board is gated again; API without a cookie returns 401, not data.

### Step 6 — The intake connection — **GATED on Decision 3** — first on the cut list
- **Builds:** `POST /intake` creating a row from the intake payload; a live test firing it from the existing intake form; manual entry still present (config switch for which wins).
- **You see at the end (phone):** submit the existing intake form → a new row appears on the board with the totals updated.
- **Catches here:** field mapping, duplicate submissions, and the source-of-truth boundary (the board keeps its own data; intake is input).
- **Estimate:** 1 day.
- **Verify:** one intake submit → exactly one row; the track/chase date/fee mapped correctly; a second submit of the same person is flagged, not silently doubled; board totals include the new row.

### Step 7 — Live: the URL a client opens
- **Builds:** production deploy to Pages behind a custom domain; Worker on the same domain; deploy from the repo; the operator's first real login; a 375 px and laptop pass on the live URL over mobile data.
- **You see at the end (phone):** the live URL opens the gated board from a phone on mobile data, over HTTPS.
- **Catches here:** production config drift, env-owned values, the deploy loop — and the Pages 500-builds/month limit, which is throttled in the deploy setup, not hit later.
- **Estimate:** 0.5 day.
- **Verify:** live URL over 4G; HTTPS; the code gate works on the live domain; seed rows present; a login-and-tick round trip on the live board.

---

## Exit criteria — Phase 1

Tick every one before calling the phase done. "Built" without its step's verify box ticked does not count.

- [ ] Board loads on a phone at 375 px and shows rows for all four tracks from the real database.
- [ ] A glance names what is slipping: overdue rows highlighted, totals strip correct, Europe/Berlin calendar-date comparison.
- [ ] Tapping called/sent/done updates the strip on the same screen, persists through reload, and a second device sees it per the Decision-1 scope.
- [ ] Adding and editing a case works and survives reload; past-date and empty-field inputs are rejected with a real message.
- [ ] Nothing is visible without the access code; wrong codes and cookieless requests show nothing.
- [ ] If kept: the intake webhook creates one row per legitimate submit, mapped correctly, no silent duplicates.
- [ ] Live URL is HTTPS on the custom domain, gated, and passes the phone + laptop pass.
- [ ] Verify rows on every step are ticked, with the device and the boundary cases (reload, two devices, midnight, incognito) named.

---

## What gets cut if the week slips

Decided now, in this order, so it is a calm list and not a 2am decision:

1. **Cut Step 6 (intake webhook) — first to go, restores ~1 day.** The pitch works entirely on manual entry; the intake link is convenience that can wait a week.
2. **Cut Step 4's edit-in-place — keep add + tick only.** A wrong fee is corrected on the next open; that is no worse than the paper/chat process the client already endures.
3. **Cut the PWA install nicety.** Phone browser works today; the config switch lands whenever.
4. **Cut laptop "polish" to the rule of not-broken.** The board is phone-first by order; the laptop view only has to be legible.

**Never cut:** Steps 1–3 (they are the pitch) and Step 5 (a live board without a door is a leak). If only four days exist, the deliverable is: board + overdue + tick/totals + access code + manual add.

---

## Verification discipline

- Every step's checkbox includes its verify list; a step is marked complete only when its verify is ticked. Built ≠ done.
- Two standing rules every step votes on: **the reload rule** (state survives a reload) and **the two-device rule** (a second phone sees what the first phone did, per the Decision-1 scope).
- The three boundary spots where bugs quietly live are tested explicitly at least once: the 23:59 / 00:01 date boundary (Step 2), rapid double-taps (Step 3), and the incognito gate (Step 5).
- Misorder test: if anything at a later step forces a change in a Step 1–3 decision (data model, overdue semantics, tick behaviour), stop — that late change is the exact unwinding this order exists to prevent, and it gets report + re-estimate before it gets code.
