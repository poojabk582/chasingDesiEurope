# PRD — Case Follow-up Board

**Status: DRAFT**
Version: 0.1
Date of call recorded: October 2026
Source material: the client's short written description of the idea. No longer meeting notes have been provided [ASSUMPTION 1].

---

## READ THESE FIRST

Three unresolved contradictions decide the shape and price of this build. **Read Section 2 before anything else, and get the client to answer the three questions there before any scope is locked.** Everything downstream depends on them.

1. **"For the group" vs the fee at stake** — who can see other people's money?
2. **Flat monthly fee vs a per-row "fee at stake"** — which one is the number on the row?
3. **One operator vs the whole group** — who enters cases and who ticks outcomes?

---

## 1. What was said, and what it means for the build

Every quote below is the client's own phrasing. Next to it is what that phrase forces us to build, and what it costs.

| The client said | What it really means | What it costs the build |
|---|---|---|
| "Case follow-up board **for the group**" | A group is implied: more than one person will look at or rely on this board. That pulls in shared access, and a decision about who may see and edit what. | [ASSUMPTION 2] A shared-data model with some access control. If it turns out to be one operator only, these are the two biggest features we can cut. |
| "One board listing **every person you are helping** and what is stuck: **flat search, job applications, a form to send, a letter to answer**" | A row per person. A fixed, short taxonomy of four "stuck" types — no free-form mush. The four types are the axis everything else sorts on. | Data model: person → one of four tracks. The list must be editable later, which costs a small settings screen [ASSUMPTION 3]. |
| "Each row carries the **next chase date** and the **fee at stake**" | Every row needs a date that drives urgency, and a money figure that justifies the effort. | Two designed fields. "Next chase date" must be comparable against today (overdue logic). "Fee at stake" is a number; whether it is typed in or inherited from the intake is undecided [ASSUMPTION 4]. Currency unconfirmed [ASSUMPTION 5]. |
| "so **one look** tells you what is slipping" | Reading every row is not allowed. Overdue or at-risk rows must announce themselves visually. | Overdue detection and at-a-glance highlighting or ordering. Without this, the whole pitch ("one look") fails. |
| "**Ticking** an outcome such as called, sent or done **updates the totals at the top straight away**" | One tap changes state. The headline totals must recompute on the same screen, immediately, with no refresh. | A simple tick interaction per row; live recomputation of the top totals; consistent counts across devices. The outcome list is open-ended ("such as"), so we must fix it or make it editable [ASSUMPTION 6]. |
| "You can **open it on your phone before a call**" | The phone is a first-class screen, not an afterthought. Read-at-a-glance and one-thumb ticking must work at phone size. | Responsive layout, mobile-size tap targets, no features that silently break at phone width. Cost is real but contained if we design phone-first from day one. |

---

## 2. What does not add up

Every real call has contradictions. These are the ones in this one. They are listed plainly, and each says which way **I** (the builder) have to be told to decide. They are not resolved here, and none of them is quietly picked.

1. **"For the group" vs the fee at stake.** A shared board means group members can see each other's rows. Rows carry *fee at stake*. Group members seeing one another's money figures is a real possibility, and it cannot be both "fully shared" and "fees are private." **Decision I need:** can any member see any row's fee, or is the fee visible only to the operator?

2. **Flat monthly fee vs a per-row fee at stake.** The service this board belongs to is sold as one monthly price. But each row carries its own *fee at stake* — a number that presumably varies by case. A flat-price service does not obviously have per-case amounts. Either the row's fee is the client's subscription share, or individual clients owe per-case fees, and those are two different products. **Decision I need:** what exactly is the number on the row, and where does it come from?

3. **One operator vs the whole group.** The pitch says "every person *you* are helping" (one operator, entering their clients) but the first phrase says the board is "for the group." If the whole group enters and ticks, we have a collaboration tool with per-person permissions and conflict handling. If it is one operator, we have a personal tracker with a nicer skin. These are different builds. **Decision I need:** is it one operator entering all cases, or does every helper manage their own slice?

4. **"Such as" — the outcome list is unspecified.** "Call, sent, done" is given as an example. A fixed list of three is a different simplification than an editable list, and an editable list pulls in management UI that the "one look, one tap" pitch does not fit. **Decision I need:** is the outcome list frozen at called / sent / done, or editable?

5. **"Straight away" across the group vs the phone.** Ticking updates "straight away," and the board is used from a phone. If two members tick at the same time, the totals have to agree. That is a real-time-sync expectation, which is the most expensive single word in the whole brief. It may be perfectly fine that "straight away" means "on your own screen," but that must be said, because it changes the cost. **Decision I need:** must changes made on one phone appear instantly on another phone, or is "straight away" per-device only?

---

## 3. Who this is for

The humans who will actually open this, and what each is trying to get done:

- **The operator (the person selling the chasing service).** Primary user. Opens the board before every call and while fielding messages, to see exactly who is slipping, what the next chase date is, and how much is at stake. Wants zero friction between *open* and *know*.
- **Co-helpers in the group (if the group is shared).** Same goal as the operator for their own slice: know what is stuck and what to chase next. Only exists if Contradiction 3 lands on "group."
- **The client (the buyer reading this document).** Not an end user. Their only job when reading this is to answer the contradictions and sign off. The document's purpose is to make that easy and cheap.

Not on the list: the end clients whose cases are on the board. Nothing in the brief gives them a view or a way in, and none is assumed. (See Not building.)

---

## 4. Scope, locked

This is in. Anything the client wants beyond this list is a change request.

1. One board.
2. One row per person being helped.
3. Per row: the person's name [ASSUMPTION 7], what is stuck (one of: flat search, job application, form to send, letter to answer), the next chase date, the fee at stake, and the current outcome.
4. Ticking an outcome (called, sent, done — as specified, see Contradiction 4) updates the totals at the top immediately.
5. At-a-glance surfacing of what is slipping: rows whose chase date has passed or is close stand out without reading every row.
6. Fully usable on a phone at 375 px wide, and on a normal laptop screen.

---

## 5. Not building, and why

This is the section to read back to the client. Each item is out on purpose.

1. **A self-service view for the end clients.** The board is the operator's tool; nothing in the brief gives clients a login or a view. Building it would double the access-control work for a feature nobody asked for.
2. **Automated sending of chases (email, SMS, WhatsApp).** The described loop is a human ticking "called/sent/done" on a phone. Adding outbound sending is a delivery system on top of a tracker, and it was not requested.
3. **Payments or billing.** The fee appears on the row as a number. Collecting that money is a different product.
4. **Case history and audit trails beyond current status.** "What is slipping now" is the entire ask. A full history log is storage and UI nobody asked for.
5. **Native phone apps.** "Open it on your phone" is satisfied by a board that works in a phone browser. Two app stores, release process and updates are out of proportion to the brief.
6. **Anything beyond one board** — multiple projects, portfolio views, reporting dashboards. The brief is literally "one board."

---

## 6. Phasing

**Phase 1 — ships first (the entire pitch in its simplest true form):**
- Rows: person, stuck-type (4 fixed types), next chase date, fee at stake, outcome.
- Ticking outcomes; totals at top update immediately.
- At-a-glance overdue surfacing.
- Phone-first layout, works on laptop too.
- Single operator enters and ticks (if Contradictions 1–3 land on "one operator," Phase 1 is the whole product).

**Phase 2 — waits for confirmation of the group story:**
- If "for the group" is real: multiple helpers, each with their own slice, and the visibility decision about fees (Contradiction 1).
- Editable outcome list (Contradiction 4) and editable stuck-type list (Assumption 3).

**Phase 3 — waits, likely never (see Section 5):**
- History, notes, export, reporting.

---

## 7. Success metrics

How we know it worked, in numbers. Targets marked UNCONFIRMED are placeholders until the client approves them [ASSUMPTION 8].

1. **Zero missed chase dates:** share of rows that got a ticked outcome *on or before* their next chase date. Target: 100% in the first two weeks of live use. (UNCONFIRMED)
2. **Recovery speed:** hours between a row's chase date passing and an outcome being ticked. Target: under 2 hours when a row is found slipping. (UNCONFIRMED)
3. **Phone primacy:** share of board opens on a phone. Target: at least 70%, since the pitch is "open it on your phone." (UNCONFIRMED)
4. **One look, honestly:** from the board opening to correctly naming the most urgent row. Goal: 2 seconds or less on a 5-row board; measured in an acceptance walkthrough, not by analytics. (UNCONFIRMED)
5. **Adoption:** rows entered and outcomes ticked per operator per week growing over the first month, and the board opened on 5+ distinct days per week.
6. **Business outcome:** the client renews after the first month, citing the board keeping cases visible.

---

## 8. Open dependencies

Things this build is waiting on from someone else:

1. The client's answers to the three questions at the top (and 4 and 5 in Section 2), because Phasing and Scope lock around them.
2. A set of ~10–15 real, anonymised example cases, so the four stuck-types and the fee column are validated against reality rather than the brief's words. (Needs the client.)
3. Confirmation of how rows enter: is the fee and chase date typed in directly on the board, or carried over from the intake form that already exists in the client's process? (Needs the client.)
4. Who edits the outcome list and the stuck-type list, if editability is chosen. (Needs the client.)
5. Currency for the fee column. (Needs the client.)

---

## Assumptions made (a real client would have told us these)

Every assumption below was made because the source material did not say it. Each is marked [ASSUMPTION n] in the body where it bites.

1. **The written description is the whole ask.** Only a short paragraph of interview material was provided; no longer meeting notes, no target dates, no budget figure, no company name.
2. **The group's size and composition.** Unknown whether the board is used by one operator or several helpers; the word "group" is read literally as "shared," which is exactly the doubt in Contradiction 3.
3. **The four stuck-types need to be editable later.** Real life adds tracks the client has not imagined yet; the cost of that was built in.
4. **"Next chase date" is typed in or carried over, not computed.** Where the number comes from (manual entry vs intake form) is unresolved; the build assumption is that it rests on the row directly.
5. **The fee is a plain number in an unspecified currency.** $ was not stated in this interview; it appears elsewhere in the client's business material.
6. **The outcome list is the literal three: called, sent, done.** "Such as" is read as an example; the risk of that reading is flagged as Contradiction 4.
7. **The row is identified by the person's name.** "Every person you are helping" is read as names of people. Duplicate names and how to tell them apart are not handled in the brief.
8. **The success targets are plausible-sounding placeholders.** All "Target" values in Section 7 are invented for the draft and must be replaced with the client's own expectations.
