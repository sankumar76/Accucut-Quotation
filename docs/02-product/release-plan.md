# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.6 (Draft; G3 answers applied to SPEC v1.4, 2026-11-01. **Scope A is adopted**, in their own words (AQP-12 10488); scope B and its dates are withdrawn. The quantity rule is reversed (every level's quantity applies). The G3 answers add 4.75 to 9.75 h of build effort, steps completed on 2026-11-01 leave the model, a G3 rework pass enters it, and the dates are re-issued: **central Wed 2026-11-25, range Wed 2026-11-18 to Fri 2026-12-04**. All of this is an estimate and none of it is adopted by the delivery lead) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | **Estimates. Not adopted.** The scope is decided (scope A). Their reply says "prefer" and does not mention dates, so no date in this plan is theirs. These dates supersede the v0.4 dates posted on [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) (comment 10478) |
| Companion | `docs/02-product/prd.md` v0.6 (FR, NFR, assumption register, epics, release moves in section 6.3) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed | AQP-2 |
| Start date 2026-11-02 (Monday); 10 working days at 8 hours a day | Confirmed | AQP-2 |
| End date 2026-11-13 (Friday) | Confirmed **as a target, not a fixed constraint**. The delivery lead asks for a realistic date and says the date is not a blocker | AQP-1 10441 (h); AQP-12 10446 |
| What the date is for | Answered (Q-29): to complete development and hand that version to their customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live | AQP-12 10446 |
| Scope behind the date | **Decided: scope A**, in their own words: "I prefer the scope A for the intial release." (spelling as written). Scope A = R1 core + R1+ stretch + R2 (EPIC-01 to EPIC-10), built as one hand-over; offline use, dark mode and the UI-sample extras are outside it. They did not mention dates | AQP-12 10488 (D-14) |
| Work already done | G2 attempt 2 returned CONDITIONAL GO, the UX spec and screens v0.2 and the architecture v0.2 were written, and the delivery lead approved G3, all on 2026-11-01. The master's G3 decision follows this pass | Gate log; project state; AQP-1 10491 |
| Offline use | Decided: the next release, not Release 1. What it means and the remaining hosting details are open (Q-18). **Not estimated** | AQP-11 10444; AQP-1 10441 (e) |
| Cost rule | **Reversed on 2026-11-01: every level's quantity applies.** Their definition of QTY per Assy (AQP-13 10487) and their count of 24 lids for 2 frames x 3 pipes x 4 lids (AQP-1 10490, relayed) replace the v0.5 reading (the quantity multiplies once, at the top item). "A parent's own cost counts" is in their words, relayed (AQP-13 10464). Details on list wording: the consequence of (b2), (d), (e1), (e2) (AQP-13 10462). **Open, Q-35:** how the item's own row counts and what a part below the top shows (working ASSUMPTION-51 and 52). Whether DL-006 is met is the master's decision. Stated in PRD FR-029 and FR-030 | AQP-13 10487, 10462, 10464; AQP-1 10490 |
| "Not applicable" in the Material and Treatment lists | In their words, relayed: values 0, system-created, not editable or deletable, shown nowhere else (Admin pages included), material cost only skipped. What Lead and Admin are offered and see: Q-36 | AQP-1 10490 (D-17) |
| Export totals | One total only; the total Tool Cost is shown (the export differs from the sample on purpose) | AQP-1 10490 (D-16) |
| Hosting | Answered in part: Microsoft Outlook for e-mail; **weekly** backup kept 2 years, looked after by the Admin (v0.5 assumed daily); updates installed by their IT person. Open: web address, sender address, which Outlook account (Q-18) | AQP-1 10490 (D-15) |
| Sample workbook | Tracked on `origin/master` since c7576f0 in a repository that stays public by the delivery lead's decision (D-13). They state the workbook has no real data; that is their statement, not verified. Rule unchanged: no sample cell value in documents, Jira or GitHub (NFR-006). A cleaned copy (Q-30) is open and not blocking | AQP-1 10465 |
| Holidays and their availability between 2026-11-02 and 2026-12-04 | Not known, not verified (OQ-PM-02) | none |

Every hour, day and date below is an **estimate** by the product manager. **There is no team velocity behind it**: no story has been built by this team on this stack, and the method (relative size converted to hours, then to working days at 8 hours a day) is judgement, not measurement. Dates are re-issued after the first completed epic (section 6).

## 2. The realistic development completion date (estimate, not adopted)

### 2.1 What the date means

"Development completion date" = the working day on which the delivery lead gives the G8 release-readiness sign-off, so the version, its release notes and its install steps can be handed to their customer. Not included in the date: the customer's testing and acceptance, change requests, go-live, master data entry beyond the defaults they provide at the TR-009 stop, training, the parallel run (TR-003 to TR-005), and the offline release.

### 2.2 The date for scope A (estimates)

| | **Scope A (adopted)**: whole SPEC except offline, dark mode and the UI-sample extras |
|---|---|
| Contents | R1 core + R1+ stretch + R2: EPIC-01 to EPIC-10, 96 FRs (73 + 6 + 17). Excludes dark mode (FR-090), the UI-sample extras (FR-097) and offline use (FR-092), which are not estimated; if the delivery lead wants any of them inside the date they say so and the product manager estimates them |
| Development effort (estimate) | 76.25 to 112.75 h, central 94.5 h (v0.5: 71.5 to 103 h, central 87.25 h) |
| **Central date** | **Wednesday 2026-11-25** (v0.5: Thursday 2026-11-26) |
| **Range** | **Wednesday 2026-11-18 to Friday 2026-12-04** (v0.5: Thursday 2026-11-19 to Monday 2026-12-07) |
| Working days from 2026-11-02 | central 18 (range 13 to 25) |
| Misses the 2026-11-13 target? | Yes in every case modelled (3.6) |
| SPEC §14 criteria met at hand-over | all except any that touch offline |

The range is "everything goes well" to "everything goes slowly" taken together: low = low effort estimate, shortest waits; high = high effort estimate, longest waits. A date near the central value is the most likely single outcome of this model, and the model is itself uncertain (no velocity). The R1 core is complete on about **Tuesday 2026-11-17** (central), an interim point at which they can still choose to hand over the core (section 6).

### 2.3 How the central date moved since v0.5

| Step | Working days (central) |
|------|------------------------|
| v0.5 central, scope A | 18.91, Thu 2026-11-26 |
| Remove the steps completed on 2026-11-01, before the 2026-11-02 start: G2 close (0.5), UX and architecture (0.9), the G3 review wait (1.0) and the G3 fixes (0.5) | -2.90 |
| Add the G3 rework pass and the master's G3 decision (3.2) | +0.75 |
| Add the build effort from the G3 answers: 94.5 h less 87.25 h = 7.25 h at 8 h a day | +0.91 |
| **v0.6 central** | **17.66, rounded up to 18: Wed 2026-11-25** |

The credit for completed steps is the largest term, and it is a judgement. It follows the same logic as v0.4, which removed the wait for the Q-32 reply because the answer arrived before the start date. If the delivery lead would rather not count that credit, the central date is Mon 2026-11-30 (3.4).

### 2.4 Risks of scope A

The estimate has no velocity behind it; EPIC-08 (12 to 16 h) is the largest and least certain block; the G3 answers add rules (stale totals, the password rule, hidden "Not applicable" entries) whose size is also judgement; alerts can only be tested against a capturing mail server until the Outlook account is named (Q-18).

## 3. How the dates were built

### 3.1 Demand (effort, estimate)

Effort per epic includes development, the three reviews and QA for each story, and excludes waits for a human. Nothing had been built on the old quantity rule, so its reversal costs no build effort; the added hours come from the rules the delivery lead decided on 2026-11-01.

| Epic | Stage | Effort (h) | Midpoint | Change from v0.5 |
|------|-------|-----------|----------|------------------|
| EPIC-01 Foundation, access, confidentiality | R1 core | 5.75 to 9.5 | 7.625 | +0.75 to 1.5 password rule and 12-hour session (FR-098, 099); +1 to 2 audit screen SCR-16 in Release 1 (FR-011, PROPOSED) |
| EPIC-02 Masters, incl. FR-018 "Not applicable" (1 to 2) | R1 core | 5 to 8 | 6.5 | +0.5 to 1: system-created, locked, hidden from every list and Admin page, material cost only skipped (D-17) |
| EPIC-03 Registry and calculation engine, incl. FR-030 quantity roll-up (2.5 to 4) and the BN divisor | R1 core | 9.5 to 14 | 11.75 | 0: the every-level rule is a recursion of the same size as the rule it replaces; ROLLUP in FR-022 is a text alignment |
| EPIC-04 Tasks and queues | R1 core | 3.25 to 5.75 | 4.5 | +0.25 to 0.75 Engineers see status (FR-102) |
| EPIC-05 Estimate workspace | R1 core | 10.5 to 15 | 12.75 | +0.5 to 1 any input change marks the estimate out of date (FR-100) |
| EPIC-06 Cost review and approval | R1 core | 6.25 to 9 | 7.625 | +1.25 to 2: cleared total (0.5 to 0.75), approval blocked while stale (0.5 to 0.75), optional reason (0.25 to 0.5) |
| EPIC-07 Excel export | R1 core | 5.5 to 8 | 6.75 | +0.5 to 1: total Tool Cost, and the cleared-total case |
| EPIC-10 Experience, brand, delivery (E2E, accessibility, Docker, README, tags) | R1 core | 5 to 7.5 | 6.25 | +0 to 0.5 WCAG 2.2 AA checks; the weekly-backup README costs the same as the daily one |
| **R1 core** | | **50.75 to 76.75** | **63.75** | v0.5: 46 to 67 (56.5) |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 | 0 |
| EPIC-08 Admin configuration | R2 | 12 to 16 | 14 | 0 (the audit screen may lower it by up to 1 h; not taken) |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 7.5 to 10.5 | 9 | 0 (Outlook named, sender undecided: not estimated) |
| **Scope A total** | | **76.25 to 112.75** | **94.5** | v0.5: 71.5 to 103 (87.25); +4.75 low, +9.75 high |

Not in the hours: dark mode and the UI-sample extras (outside scope A), offline use, ROLLUP naming and the other text alignments (no effort), and the architect's change from a nightly to a weekly backup (a documentation change, not a build item).

### 3.2 Elapsed-time model

Effort is converted to working days at 8 hours a day (the unit the delivery lead used). Each human point is a number of working days during which agents on that thread wait. Weekends are not worked; no holidays are assumed (3.5).

| Input (estimate) | Low | Central | High | Why |
|------------------|-----|---------|------|-----|
| G3 rework pass and the master's G3 decision, in working days | 0.5 | 0.75 | 1.25 | The business-analyst's pass is done; the product manager, ux-expert and solution-architect rework in parallel and the longest sets the time; then the master decides G3. Replaces v0.5's G2 close (0.5), UX and architecture (0.9) and G3 fixes (0.5), which were done on 2026-11-01 |
| Human wait W at each of two points: master data defaults (TR-009 stop), G8 sign-off, in working days | 0.5 | 1 | 1.5 | The delivery lead is the only human; their replies on 2026-10-31 and 2026-11-01 came within hours (Jira comment times), which is thin evidence, so the central value is one working day. The G3 review wait is over: they approved G3 on 2026-11-01 (AQP-1 10491) |
| Backlog, G4 and docs PR (runs while the master data defaults are awaited), days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1); the TR-009 stop costs max(W, this) |
| Merge wait M per dependency stage, days | 0.25 | 0.5 | 1.0 | See 3.3 |
| Close-out before the G8 wait: release notes, G8 pack, README check, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| Dependency stages that gate on a merge | 5 | 5 | 5 | EPIC-01; then EPIC-02, 03, 04; then EPIC-05; then EPIC-06, 07 (EPIC-10 alongside); then R1+ and R2 as one more stage |

Elapsed working days = G3 rework + max(W, backlog) + effort / 8 + stages x M + close-out + W. The result is rounded up to a whole working day, counting 2026-11-02 as day 1. (The v0.5 formula, which this one replaces, reproduces its 18.91 days: 0.5 + 0.9 + 1.5 + 1 + 10.91 + 2.5 + 0.6 + 1.)

| Case | Effort | Elapsed working days | Completion |
|------|--------|----------------------|------------|
| Low | 76.25 h | 12.78 | Wed 2026-11-18 |
| **Central** | 94.5 h | 17.66 | **Wed 2026-11-25** |
| High | 112.75 h | 24.09 | Fri 2026-12-04 |
| v0.5 for comparison | 71.5 / 87.25 / 103 h | 13.49 / 18.91 / 25.62 | Thu 2026-11-19 / Thu 2026-11-26 / Mon 2026-12-07 |

Central-case milestones: the G3 rework pass runs from Mon 2 Nov; the master data defaults and G4 (backlog, docs PR) follow; pre-development ends Tue 2026-11-03; EPIC-01 complete Wed 2026-11-04 (merged Thu 2026-11-05); EPIC-05 complete about Thu 2026-11-12; **R1 core complete Tue 2026-11-17**; stretch complete Wed 2026-11-18; R2 complete Tue 2026-11-24; **G8 sign-off Wed 2026-11-25**.

### 3.3 What the human waits are assumed to be

- **G3 (human):** over for the dates. The delivery lead approved G3 on 2026-11-01 (AQP-1 10491). The master decides G3 after this pass; if the master or the delivery lead asks them to look again at the changed screens, that is one more wait W (3.4).
- **TR-009 master data stop (human):** asked after G3 approval, before development, together with Q-35 to Q-37 and OQ-PM-07. The backlog, G4 and docs PR work runs during that wait, so the stop costs W or the backlog time, whichever is longer. They said development waits for their defaults (AQP-10).
- **Docs PR:** draft PR #1 (`docs/AQP-1-inception`) exists. The orchestrator merges it after G4 GO (`MERGE_POLICY` docs-auto), so story branches start when it is merged.
- **Code PR merges (`MERGE_POLICY` = docs-auto, code-human; one human merge per story):** the story count is not known yet. The model does not count PRs. It assumes the delivery lead merges ready PRs at least once a working day, that agents work on independent stories while a merge waits, and that only a dependent stage waits: M per stage (0.25, 0.5, 1.0 working days) for 5 stages, which adds 1.25 to 5 days. A wait longer than a working day on a stage boundary is the main way the high case arises.
- **G8 (human):** W working days after the close-out work.
- **Clock:** the clock does not stop at any human point; every wait above is inside the dates (this answers OQ-PM-01 for the dates).

### 3.4 Sensitivity (central effort, other inputs central)

| Change | Scope A date |
|--------|--------------|
| Central case | Wed 2026-11-25 |
| Both human waits 0.5 day | Tue 2026-11-24 |
| Both human waits 1.5 days | Thu 2026-11-26 |
| Both human waits 2 days | Fri 2026-11-27 |
| Merges do not wait (M = 0) | Mon 2026-11-23 |
| Each merge stage waits 1 day | Mon 2026-11-30 |
| Effort at the low end, waits central | Mon 2026-11-23 |
| Effort at the high end, waits central | Fri 2026-11-27 |
| G3 rework pass at its high value (1.25 days) | Thu 2026-11-26 |
| The delivery lead is asked to review the changed screens again (one more wait W of 1 day) | Thu 2026-11-26 |
| No credit for the work done on 2026-11-01 (v0.5 treatment: G2 close, UX and architecture, the G3 wait and fixes counted, plus the additions) | Mon 2026-11-30 |

### 3.5 Holidays (OQ-PM-02)

Holidays are unknown and are **not assumed**: every date above counts Monday to Friday with no day lost. Treatment: each weekday on which the team cannot work, or on which the delivery lead cannot answer, moves every later date by one weekday. For three lost weekdays the central date becomes **Mon 2026-11-30**. As general knowledge, not verified, early to mid November 2026 may include Diwali-related closures in India; the delivery lead says which days apply and the dates are re-issued.

### 3.6 Can 2026-11-13 be reached?

Not with scope A in any case modelled. Even the low-effort case (76.25 h) with no human wait and no merge wait takes 11.03 working days and ends Tue 2026-11-17; the model's own low case ends Wed 2026-11-18. For information only, because scope B was not chosen: the R1 core alone, handed over at checkpoint C, would end about Thu 2026-11-19 at the centre and reaches Fri 2026-11-13 only if every input is at its low value (9.34 working days: 50.75 h, a 0.5-day rework, waits of 0.5 day, merges of 0.25 day). I do not consider that combination realistic.

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The date is a target and not a blocker, so the analysis states how far scope A is from it and what the fit rule says.

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| A (adopted): R1 core + R1+ + R2 | 76.25 to 112.75 h | 12.78 / 17.66 / 24.09 | Misses by 3 to 15 working days; central 8 days over |
| v0.5 for comparison (same scope) | 71.5 to 103 h | 13.49 / 18.91 / 25.62 | Misses by 4 to 16 working days; central 9 days over |

What changed from v0.5: (1) the G3 answers add 4.75 to 9.75 h of build effort; (2) G2 close, UX and architecture, the G3 wait and the G3 fixes are complete and leave the model, and a G3 rework pass enters it; (3) the human waits are now two (master data defaults and G8) instead of three.

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope A: Musts are about 89 to 90 % of the effort (about 7.75 to 12.5 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088, 103). The R1 core alone is about 97 % Must. The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items or decisions of the delivery lead; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a recorded deviation (DL-002) for the master and the delivery lead to weigh.

## 5. Releases and build stages

| Stage | Name | Epics | What a user can do at the end | Brief goals |
|-------|------|-------|-------------------------------|-------------|
| **R1 core** | Assign, enter, calculate, approve, export | EPIC-01, 02, 03, 04, 05, 06, 07, 10 | Admin creates users and masters and reads the audit record; Lead assigns a task; Engineer enters a part tree, presses Calculate, sees the status and no cost; Lead views costs and formulas, approves and locks a price only from a current calculation, unlocks if needed; Lead downloads the Excel file in the worksheet layout with one total and the total Tool Cost; the bell and Overdue tab show late work | GOAL-01, 02, 03, 04, 07 in full; GOAL-05 in part (no e-mail); GOAL-06 in part |
| R1+ stretch | Built after the core | FR-014, 035, 039, 054, 057, 088 | Propagation prompt for process defaults, Lead default filter, task filters, autosave, completeness count, loading and empty states | Same |
| **R2** | Admin control and alerts | EPIC-08, EPIC-09 (FR-003, 006, 019, 040, 072 to 084) | Admin changes fields and formulas with re-lettering, versions, checkpoints and change history; e-mail alerts and the 11:00 IST digest; password reset by e-mail; task reassign | GOAL-05, GOAL-06 in full |
| R3 | Later; **outside scope A** | EPIC-11 (FR-090, 097) | Dark mode; UI-sample extras. Drawing input only if scheduled | GOAL-07 |
| **R-OFF** | The next release (confirmed) | EPIC-12 (FR-092), outline only | Use without internet; meaning and design open | GOAL-01 |

The first three rows are one hand-over (scope A). Release moves since v0.1 are in PRD section 6.3. SPEC §14 acceptance criteria are all met at the hand-over except any that touch offline; by build stage, the **R1 core** meets 1, 2, 3, 4, 5, 12, 13, 14 and 10 if FR-014 is reached, and **R2** meets 6, 7, 8, 9, 11. Criterion 12 is read with the exception of D-16 (one total only, total Tool Cost shown).

| SPEC §13 step | Stage | Note |
|---------------|-------|------|
| 1 Scaffold, auth, users, roles, shell, About | R1 core (EPIC-01) | Includes the password rule, the 12-hour session and the audit screen |
| 2 Masters, Settings | R1 core masters (EPIC-02); Settings and alerts switch in R2 | "Not applicable" entries are system-created and hidden |
| 3 Registry, seed, formula engine | R1 core (EPIC-03) | Engine and seeded registry; the roll-up applies every level's quantity; the quantity step stays in one place |
| 4 Tasks, queues, overdue, bell | R1 core (EPIC-04) | Engineers see the status |
| 5 Estimate workspace | R1 core (EPIC-05) | Any input change marks the estimate out of date |
| 6 Cost view, approval, lock, unlock | R1 core (EPIC-06) | Cleared total; approval blocked while stale; optional reason |
| 7 Excel export | R1 core (EPIC-07) | One total, total Tool Cost shown |
| 8 Admin configuration UI | R2 (EPIC-08) | |
| 9 E-mail alerts and scheduled jobs | R2 (EPIC-09) | Outlook named; sender address does not exist yet (Q-18) |
| 10 Polish, accessibility (WCAG 2.2 AA), E2E, Docker, README | R1 core for delivered screens (EPIC-10); repeated for R2 screens | Responsive and accessible are built in from step 1 |

## 6. Checkpoints and cut ladder

Checkpoints re-issue the date from actuals. Method: actual hours for the finished epics divided by their estimate gives a ratio; remaining effort x ratio / 8 + remaining stages x M + remaining human waits gives the new date. This is the first time any velocity exists.

| Checkpoint | When (central) | Question | Decision |
|------------|----------------|----------|----------|
| A | First epic complete (EPIC-01, about Thu 2026-11-05 after its merge) | Ratio of actual to estimated hours | Re-issue the date |
| B | EPIC-05 complete (about Thu 2026-11-12) | Is the core on track; does the roll-up match the constructed examples (PRD FR-030: 30, 5, and a parent with its own cost)? | Re-issue; decide whether to build the stretch |
| C | R1 core complete (about Tue 2026-11-17) | Hand over the core now, or continue to R2 (scope A)? Handing over the core would end about Thu 2026-11-19 at the centre (3.6) | Their decision, logged by `master` |

### 6.1 Cut ladder (only if they want an earlier hand-over; each is a scope decision for them)

| Step | Cut | Hours saved (estimate) | Outcome lost |
|------|-----|------------------------|--------------|
| 0 | Do not start any stretch item | 6 to 9.5 | R1+ items |
| 1 | Move FR-063 Unlock and the Closed-to-Open reopen (FR-038 part) to a later stage | 1 to 2 | An approved estimate cannot be reopened |
| 2 | Move FR-058's six-stage accordion and formula display (and FR-060) to a later stage | 1 to 2 | Lead cannot see the arithmetic behind a price |
| 3 | Move FR-047 part pictures and export column C images to a later stage | 2 to 3 | Parts not identified visually; SPEC §14.12 image check fails |

Steps 1 to 3 save 4 to 7 h (about 0.5 to 0.9 working day). Not cut candidates: cost confidentiality (FR-007, 008), the calculation and its tests (FR-020 to 031), approve and lock with its stale-total rules (FR-062, 100, 101), the export itself (FR-066 to 070), responsive and accessibility tests (FR-085, NFR-016, NFR-018).

### 6.2 Process effects the estimate does not capture

- Parallel work is not assumed. After EPIC-01, EPIC-02, 03 and 04 are independent, and EPIC-06 and 07 are independent after EPIC-05; parallel developers would shorten elapsed time, not effort, and human merges would still serialise.
- Story count and size are not known until the backlog exists (G4); the merge model should be recalibrated then.
- The docs PR exists as draft PR #1; story branches start after it is merged at G4.

## 7. Human gates, stops and who waits for whom

| Point | Type | Effect on the plan |
|-------|------|--------------------|
| G3 | `master` decides after the delivery lead's approval (AQP-1 10491), which is given | The approval wait is over and is not in the dates. If they are asked to look again at the changed screens: one more wait W (3.4) |
| Q-35, Q-36, Q-37 and OQ-PM-07 | Delivery lead, asked with the master data request | No wait added: asked inside the TR-009 stop. Needed by G4, before the roll-up story is written |
| Master data stop (TR-009, HOLD-01) | **Human**, process stop outside `CLAUDE.md` | One wait W, overlapped with backlog and G4 |
| G4 | `master` | Draft PR #1 exists; the orchestrator merges it after G4 GO (docs-auto) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | Modelled as M per dependency stage |
| G8 | **Human** | One wait W; its sign-off day is the completion date |

## 8. Dependencies by stage

| Stage | Dependency | Owner | Status |
|-------|-----------|-------|--------|
| R1 core | Master's G3 decision, including whether DL-006 is met by AQP-13 10487 and AQP-1 10490 | master | Open; follows this pass |
| R1 core | Answers to Q-35 (item's own row; what a part shows), Q-36, Q-37 and OQ-PM-07 (QTY per Assy of 0) | Santhosh | Open; due G4; working assumptions apply |
| R1 core | Master data defaults (TR-009) | Santhosh | Stop after G3 |
| R1 core | Hosting details: web address, IT person's name, which Outlook account (Q-18) | Santhosh, their IT person | Open; before the first deployment |
| R1 core | Cleaned sample worksheet (Q-30, not blocking) | Santhosh | Open. The repository stays public by their decision (D-13); the original is tracked since c7576f0; structure only is read from it |
| R1 core | Docs PR | orchestrator | Draft PR #1 exists; merged after G4 GO (docs-auto) |
| R1 core | Backup design change from nightly to weekly | solution-architect | Open (D-15) |
| R2 | Sender address and Outlook account; whether it allows SMTP | Santhosh, their IT person; solution-architect | Open; alerts tested against a capturing mail server until then |
| After the date | Customer testing, acceptance, change requests; go-live, training, parallel run (TR-003 to TR-005) | Santhosh, Accucut | Not in the dates |
| R-OFF | Meaning of offline, hosting design | Santhosh | Open; settled when the release is planned |

## 9. Effect of each open item on this plan

| Item | If answered as assumed | If answered differently |
|------|------------------------|-------------------------|
| Q-35 item's own row and display of a part (due G4) | The working assumptions stand. Effort and dates are as in sections 2 to 6 | Before the roll-up story is written: the story text changes, no build effort. After it is built: rework of that story, **0 to about 1 h** (estimate), not in the effort figures and not in either date. **Price effect, separate from effort:** only where the item's own row holds values and the item quantity is above 1; none at quantity 1 or with 0 on that row |
| OQ-PM-07 QTY per Assy of 0 on a part with parts below it | No special handling beyond the SPEC (PROPOSED: a warning) | A warning or a minimum of 1: under 0.5 h (estimate) |
| Q-36, Q-37 (display only) | Working ASSUMPTION-54 and 55 stand | Display and export changes, under 1 h each (estimate); no price effect through approval |
| Q-18 hosting details | Docker Compose; Outlook; weekly backup | Deployment and mail settings change; effect on hours not estimated. If they choose a nightly backup, the architect's nightly design stands and no effort changes |
| ASSUMPTION-56 (symbols, session start) | Any non-alphanumeric character; 12 hours from sign-in | Under 1 h (estimate) |
| OQ-PM-01, OQ-PM-02 (their availability, holidays) | Waits of 0.5 to 1.5 days; no holidays | Each lost weekday moves every later date by one weekday |

## 10. Change Log

| Version | Date | Change | Reason |
|---------|------|--------|--------|
| 0.1 | 2026-11-01 | First proposal | G2 input; Q-29 |
| 0.2 | 2026-11-01 | UNC items resolved and labels removed; realistic completion date added for two scopes with a proposed answer to Q-34; elapsed-time model with human and merge waits; fit analysis and Must share restated; FR-030 and FR-018 into the core (PROPOSED); offline set to the next release | AQP-1 10441, 10443; AQP-9 10442; AQP-13 10445; AQP-11 10444; AQP-12 10446 |
| 0.3 | 2026-11-01 | Q-32 shown as open with (a), (b) due G2 and (c), (d), (e) due G3, no answer applied; the "0 to 2 h" stated as build effort, not price, with the price ratios; Q-34 shown as their choice due G3 approval, both dates unadopted (DL-004, ASSUMPTION-50); the G2 human wait relabelled from the Q-34 reply to the Q-32 (a), (b) reply (same wait, **no date changed**); sample-file statement added (tracked on `origin/master` since c7576f0, RISK-006); "not applicable" labelled "confirmed on list wording" (DL-001) | G2 attempt 1 NO-GO, remediation 4 and 5; DL-001, DL-004, DL-005 |
| 0.4 | 2026-11-01 | Q-32 closed and ASSUMPTION-48 retired (AQP-13 10462, 10464; D-12): cost-rule row, section 7 and 8 rows and the section 9 row restated; the sensitivity row "Open Q-32 details answered differently" and the build-effort contingency (0 to about 2 h) removed, effort figures unchanged because they were sized on the same rule. **Dates re-issued:** the leading human wait for the Q-32 reply is removed from the elapsed-time model (the answer arrived on 2026-11-01, before the 2026-11-02 start); central dates move one working day earlier (scope B Mon 2026-11-23 to Fri 2026-11-20, scope A Fri 2026-11-27 to Thu 2026-11-26), ranges, sensitivity, milestones, checkpoints and the fit table recomputed with the same model (the v0.3 values reproduce exactly). Repository decision D-13 reflected in section 1 and 8. BLK-01 cleared (draft PR #1 exists): the assumption that it is fixed during the master data stop is removed. "he/his" replaced by "the delivery lead" or "they". No FR, priority, release or scope changed; both dates remain unadopted estimates (DL-004) | AQP-13 10462, 10464; AQP-1 10465; PRD v0.4 |
| 0.5 | 2026-11-01 | G2 attempt 2 condition 3. Section 9: the effect of a change to Q-32 (a) restored as a build-effort contingency of 0 to about 2 h (estimate) that is **not in the effort figures or either date**, with the price effect (sub-part 24 times instead of 8, BL 30 instead of 14) stated separately. Sections 1, 7 and 8: Q-32 (a) own-words confirmation shown as open, due G3 approval, no wait added; G2 attempt 2 shown as CONDITIONAL GO. **No effort figure, scope or date changed**: every v0.4 date stands (scope B central Fri 2026-11-20, range Mon 11-16 to Mon 11-30; scope A central Thu 2026-11-26, range Thu 11-19 to Mon 12-07), both still unadopted (DL-004). The v0.4 dates supersede AQP-12 comment 10450 (v0.2), posted on AQP-12 under condition 4 | `docs/00-governance/gate-log.md` G2 attempt 2, conditions 3 and 4; DL-004, DL-006 |
| 0.6 | 2026-11-01 | G3 answers applied to SPEC v1.4. **Scope A adopted** (AQP-12 10488): scope B, its dates and the two-scope tables removed. **Quantity rule reversed** (every level's quantity applies; AQP-13 10487, AQP-1 10490): the cost-rule row and sections 5, 7, 8 and 9 restated; the 0 to about 2 h contingency for Q-32 (a) retired, because nothing was built on the old rule; Q-35 and OQ-PM-07 added. **Effort re-based:** +4.75 to +9.75 h (password rule and session, audit screen SCR-16 (PROPOSED), "Not applicable" handling, status for Engineers, cleared total and blocked approval, optional reason, total Tool Cost, WCAG 2.2 AA checks); scope A is now 76.25 to 112.75 h, central 94.5 h. **Model changed:** the steps completed on 2026-11-01 (G2 close, UX and architecture, the G3 wait and fixes) leave it; a G3 rework pass (0.5 / 0.75 / 1.25 days) enters it; two human waits remain (was three). **Dates re-issued, not adopted:** central Wed 2026-11-25 (was Thu 2026-11-26), range Wed 2026-11-18 to Fri 2026-12-04 (was Thu 2026-11-19 to Mon 2026-12-07); sensitivity, milestones, checkpoints and the fit table recomputed, with a bridge from v0.5 in 2.3. Hosting facts added (Outlook, weekly backup kept 2 years, updates by their IT person). Supersedes the v0.4 dates in AQP-12 comment 10478 | AQP-1 10490, 10491, 10494; AQP-12 10488; AQP-13 10487; SPEC v1.4; PRD v0.6 |
