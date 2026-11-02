# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.7 (Draft; G3 condition 11 applied, 2026-11-01. The architect's added 7.5 to 13 h enters the effort (scope A is now **83.75 to 125.75 h**, central 104.75 h). The final G8 wait leaves the model (DL-010) and the date definition changes with it. The dates are re-issued: **central Wed 2026-11-25, range Thu 2026-11-19 to Fri 2026-12-04**. The central date sits 0.06 working day under a day boundary, so Thu 2026-11-26 is the same estimate (3.4). All of this is an estimate and none of it is adopted by the delivery lead) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | **Estimates. Not adopted.** The scope is decided (scope A). Their reply says "prefer" and does not mention dates, so no date in this plan is theirs. These dates supersede the v0.6 dates and, before them, the v0.4 dates posted on [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) (comment 10478) |
| Companion | `docs/02-product/prd.md` v0.7 (FR, NFR, assumption register, epics, release moves in section 6.3, G4 product decisions in section 12.2) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed | AQP-2 |
| Start date 2026-11-02 (Monday); 10 working days at 8 hours a day | Confirmed | AQP-2 |
| End date 2026-11-13 (Friday) | Confirmed **as a target, not a fixed constraint**. The delivery lead asks for a realistic date and says the date is not a blocker | AQP-1 10441 (h); AQP-12 10446 |
| What the date is for | Answered (Q-29): to complete development and hand that version to their customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live | AQP-12 10446 |
| Scope behind the date | **Decided: scope A**, in their own words: "I prefer the scope A for the intial release." (spelling as written). Scope A = R1 core + R1+ stretch + R2 (EPIC-01 to EPIC-10), built as one hand-over; offline use, dark mode and the UI-sample extras are outside it. They did not mention dates | AQP-12 10488 (D-14) |
| Work already done | G2 attempt 2 returned CONDITIONAL GO, the UX spec and screens and the architecture were written, the delivery lead approved G3 (AQP-1 10491) and the master decided G3: CONDITIONAL GO, attempt 1, 16 conditions (gate log), all on 2026-11-01 | Gate log; project state; AQP-1 10491 |
| Human approval stops | Lifted by the delivery lead's instruction "dont ask me for any approvals except for git merge. But I need to view the result after each iteration (and gate reviews if required)" (AQP-1 10495; DL-010). **G8 no longer waits for a separate sign-off**: the master still evaluates the whole checklist, a NO-GO still stops the run, code pull request merges and deployment stay human. The master data stop (HOLD-01) stands: it is a data input, not an approval | DL-010 |
| Offline use | Decided: the next release, not Release 1. What it means and the remaining hosting details are open (Q-18). **Not estimated** | AQP-11 10444; AQP-1 10441 (e) |
| Cost rule | **Reversed on 2026-11-01: every level's quantity applies.** Their definition of QTY per Assy (AQP-13 10487) and their count of 24 lids for 2 frames x 3 pipes x 4 lids (AQP-1 10490, relayed) replace the v0.5 reading (the quantity multiplies once, at the top item); closed as DL-011. "A parent's own cost counts" is in their words, relayed (AQP-13 10464). Details on list wording: the consequence of (b2), (d), (e1), (e2) (AQP-13 10462). **Open, Q-35:** how the item's own row counts and what a part below the top shows (working ASSUMPTION-51 and 52); this is not a narrow case, because any single-piece product is such a row (DL-012). **The portal differs from the worksheet** wherever a quantity above 1 sits above a row (PRD GOAL-03). Stated in PRD FR-029 and FR-030 | AQP-13 10487, 10462, 10464; AQP-1 10490; DL-011, DL-012 |
| "Not applicable" in the Material and Treatment lists | In their words, relayed: values 0, system-created, not editable or deletable, shown nowhere else (Admin pages included), material cost only skipped. What Lead and Admin are offered and see: Q-36 | AQP-1 10490 (D-17) |
| Export totals | One total only; the total Tool Cost is shown (the export differs from the sample on purpose) | AQP-1 10490 (D-16) |
| Hosting | Answered in part: Microsoft Outlook for e-mail; **weekly** backup kept 2 years, looked after by the Admin (v0.5 assumed daily); updates installed by their IT person. Open: web address, sender address, which Outlook account (Q-18) | AQP-1 10490 (D-15) |
| Sample workbook | Tracked on `origin/master` since c7576f0 in a repository that stays public by the delivery lead's decision (D-13). They state the workbook has no real data; that is their statement, not verified. Rule unchanged: no sample cell value in documents, Jira or GitHub (NFR-006). A cleaned copy (Q-30) is open and not blocking | AQP-1 10465 |
| Holidays and their availability between 2026-11-02 and 2026-12-04 | Not known, not verified (OQ-PM-02) | none |

Every hour, day and date below is an **estimate** by the product manager. **There is no team velocity behind it**: no story has been built by this team on this stack, and the method (relative size converted to hours, then to working days at 8 hours a day) is judgement, not measurement. Dates are re-issued after the first completed epic (section 6).

## 2. The realistic development completion date (estimate, not adopted)

### 2.1 What the date means

"Development completion date" = the working day on which the master records the G8 release-readiness decision (GO or CONDITIONAL GO) with the last code pull request merged, so the version, its release notes and its install steps are ready to hand to their customer. **The delivery lead's sign-off is not part of the definition and no wait for it is modelled** (DL-010): the orchestrator reports the G8 result and says that no separate sign-off was requested, so they can still stop it. A NO-GO stops the run and the date then does not hold. The merge of each code pull request is a human act and stays inside the dates (M, 3.2). Deployment is a human act by their IT person and is not in the date. Not included in the date: the customer's testing and acceptance, change requests, go-live, master data entry beyond the defaults they provide at the HOLD-01 stop, training, the parallel run (TR-003 to TR-005), and the offline release.

The v0.6 definition ("the day on which the delivery lead gives the G8 sign-off") is withdrawn. Removing it takes one wait W out of the elapsed time (2.3).

### 2.2 The date for scope A (estimates)

| | **Scope A (adopted)**: whole SPEC except offline, dark mode and the UI-sample extras |
|---|---|
| Contents | R1 core + R1+ stretch + R2: EPIC-01 to EPIC-10, 96 FRs (73 + 6 + 17). Excludes dark mode (FR-090), the UI-sample extras (FR-097) and offline use (FR-092), which are not estimated; if the delivery lead wants any of them inside the date they say so and the product manager estimates them |
| Development effort (estimate) | 83.75 to 125.75 h, central 104.75 h (v0.6: 76.25 to 112.75 h, central 94.5 h). The architect's 7.5 to 13 h is in; **not in**: the rule for a QTY per Assy of 0 (about 1 h), the G4 product decisions of PRD section 12.2 (under 0.75 h together) and a refused SMTP sign-in (about 4 h). See the sensitivity rows in 3.4 |
| **Central date** | **Wednesday 2026-11-25** (v0.6: Wednesday 2026-11-25, unchanged; the two changes cancel) |
| **Range** | **Thursday 2026-11-19 to Friday 2026-12-04** (v0.6: Wednesday 2026-11-18 to Friday 2026-12-04) |
| Working days from 2026-11-02 | central 18 (range 14 to 25); unrounded 13.22 / 17.94 / 24.22 |
| Misses the 2026-11-13 target? | Yes in every case modelled (3.6) |
| SPEC §14 criteria met at hand-over | all except any that touch offline |

The range is "everything goes well" to "everything goes slowly" taken together: low = low effort estimate, shortest waits; high = high effort estimate, longest waits. A date near the central value is the most likely single outcome of this model, and the model is itself uncertain (no velocity). **The central value 17.94 working days sits 0.06 day, about half an hour of work, under the boundary to 19.** Any addition of more than about 0.5 h moves the central date to Thu 2026-11-26; Wed 2026-11-25 and Thu 2026-11-26 are one estimate, not two. The R1 core is complete on about **Tuesday 2026-11-17** (central, merged Wed 2026-11-18), an interim point at which they can still choose to hand over the core (section 6).

### 2.3 How the central date moved since v0.6

| Step | Working days (central) |
|------|------------------------|
| v0.6 central, scope A | 17.66, Wed 2026-11-25 |
| Remove the G8 sign-off wait W (DL-010): the one final wait of 1 day | -1.00 |
| Add the architect's 7.5 to 13 h (architecture section 16.8): midpoint 10.25 h at 8 h a day | +1.28 |
| **v0.7 central** | **17.94, rounded up to 18: Wed 2026-11-25** |

Low: 12.78 - 0.50 + 0.94 = 13.22, day 14 (Thu 2026-11-19). High: 24.09 - 1.50 + 1.63 = 24.22, day 25 (Fri 2026-12-04). Nothing else moved: the G3 rework term, the master data wait, the merge waits and the close-out keep their v0.6 values, so that only the two changes named in DL-014 move the dates. The v0.6 credit for steps completed on 2026-11-01 (2.90 days) is unchanged; if the delivery lead would rather not count it, the central date is Mon 2026-11-30 (3.4).

### 2.4 Risks of scope A

The estimate has no velocity behind it; EPIC-08 (12 to 16 h) is the largest and least certain block; the G3 answers add rules (stale totals, the password rule, hidden "Not applicable" entries) whose size is also judgement; the architect's added hours are the architect's estimate, not a measurement; alerts can only be tested against a capturing mail server until the Outlook account is named (Q-18), and the OAuth sign-in to Outlook is designed and unproven (RISK-014).

## 3. How the dates were built

### 3.1 Demand (effort, estimate)

Effort per epic includes development, the three reviews and QA for each story, and excludes waits for a human. Nothing had been built on the old quantity rule, so its reversal costs no build effort. The added hours in this version are the architect's list (architecture section 16.8, development with tests, no velocity behind them). Where the architect gave one range for two epics (the figure state, 1 to 2 h for EPIC-05 and 06) the product manager splits it equally; that split is an estimate and does not change the total.

| Epic | Stage | Effort (h) | Midpoint | Change from v0.6 |
|------|-------|-----------|----------|------------------|
| EPIC-01 Foundation, access, confidentiality | R1 core | 5.75 to 9.5 | 7.625 | 0 |
| EPIC-02 Masters, incl. FR-018 "Not applicable" (1.5 to 3 with the hidden entries) | R1 core | 5.5 to 9 | 7.25 | +0.5 to 1: the hidden system-created entries (hidden flag, database triggers, reserved name, migration, projection) |
| EPIC-03 Registry and calculation engine, incl. FR-030 quantity roll-up (2.5 to 4) and the BN divisor | R1 core | 10 to 15 | 12.5 | +0.5 to 1: the guard in the seeded formula for column O and comparisons inside IF |
| EPIC-04 Tasks and queues | R1 core | 3.25 to 5.75 | 4.5 | 0 |
| EPIC-05 Estimate workspace | R1 core | 11 to 16 | 13.5 | +0.5 to 1: share of the figure state (withholding parent figures, comparing a save with the stored value) |
| EPIC-06 Cost review and approval | R1 core | 6.75 to 10 | 8.375 | +0.5 to 1: the other share of the same item |
| EPIC-07 Excel export | R1 core | 6.5 to 9.5 | 8 | +1 to 1.5: the markers on an out-of-date file and the stated choice before it is downloaded |
| EPIC-10 Experience, brand, delivery (E2E, accessibility, Docker, README, tags) | R1 core | 6.5 to 10 | 8.25 | +1.5 to 2.5: the backup-watch check, the manifest beside each copy and the 2-year pruning |
| **R1 core** | | **55.25 to 84.75** | **70** | v0.6: 50.75 to 76.75 (63.75); +4.5 low, +8 high |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 | 0 |
| EPIC-08 Admin configuration | R2 | 12 to 16 | 14 | 0 (the audit screen may lower it by up to 1 h; not taken) |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 10.5 to 15.5 | 13 | +3 to 5: the sign-in to Outlook without a stored password, the token function, tests against a stand-in server and one real send (v0.6 said "not estimated") |
| **Scope A total** | | **83.75 to 125.75** | **104.75** | v0.6: 76.25 to 112.75 (94.5); +7.5 low, +13 high |

Not in the hours: dark mode and the UI-sample extras (outside scope A), offline use, ROLLUP naming and the other text alignments (no effort), and the change from a nightly to a weekly backup (a documentation change, not a build item). Also not in the hours, and each shown as a sensitivity row in 3.4: the rule for a QTY per Assy of 0 on a part with parts below it, about 1 h whichever rule is chosen and the fallback block too (architecture section 16.8); the G4 product decisions of PRD section 12.2, namely the forced password change after an Admin-set password and the password step on an Admin hand-over, each under 0.5 h (estimate), and a notice of changed rates before approval, 0.5 to 1 h (estimate), only if the delivery lead asks for it; and a refused SMTP sign-in, about 4 h for another transport (architect).

### 3.2 Elapsed-time model

Effort is converted to working days at 8 hours a day (the unit the delivery lead used). Each human point is a number of working days during which agents on that thread wait. Weekends are not worked; no holidays are assumed (3.5).

| Input (estimate) | Low | Central | High | Why |
|------------------|-----|---------|------|-----|
| G3 conditions rework pass, in working days | 0.5 | 0.75 | 1.25 | The business-analyst, product-manager, ux-expert and solution-architect rework in parallel after the master's G3 decision and the longest sets the time. The master's G3 decision itself is done, which could justify a credit of up to 0.25 day; **the values stay as in v0.6** so that only the two changes DL-014 names move the dates |
| Human wait W at one point: master data defaults (HOLD-01), in working days | 0.5 | 1 | 1.5 | The delivery lead is the only human; their replies on 2026-10-31 and 2026-11-01 came within hours (Jira comment times), which is thin evidence, so the central value is one working day. The questions for them are asked in the same request and add no wait. **The G8 sign-off wait is removed** (DL-010) |
| Backlog, G4 and docs PR (runs while the master data defaults are awaited), days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1); the HOLD-01 stop costs max(W, this) |
| Merge wait M per dependency stage, days | 0.25 | 0.5 | 1.0 | See 3.3 |
| Close-out before the G8 decision: release notes, G8 pack, README check, the master's evaluation, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| Dependency stages that gate on a merge | 5 | 5 | 5 | EPIC-01; then EPIC-02, 03, 04; then EPIC-05; then EPIC-06, 07 (EPIC-10 alongside); then R1+ and R2 as one more stage |

Elapsed working days = G3 rework + max(W, backlog) + effort / 8 + stages x M + close-out. The result is rounded up to a whole working day, counting 2026-11-02 as day 1. (The v0.6 formula had one more term, + W for the G8 sign-off; with it, the v0.6 inputs reproduce 17.66: 0.75 + 1 + 11.8125 + 2.5 + 0.6 + 1.)

| Case | Effort | Elapsed working days | Completion |
|------|--------|----------------------|------------|
| Low | 83.75 h | 13.22 | Thu 2026-11-19 |
| **Central** | 104.75 h | 17.94 | **Wed 2026-11-25** |
| High | 125.75 h | 24.22 | Fri 2026-12-04 |
| v0.6 for comparison | 76.25 / 94.5 / 112.75 h | 12.78 / 17.66 / 24.09 | Wed 2026-11-18 / Wed 2026-11-25 / Fri 2026-12-04 |

Central-case milestones: the G3 conditions rework pass runs from Mon 2 Nov; the master data defaults and G4 (backlog, docs PR) follow; pre-development ends Tue 2026-11-03; EPIC-01 complete Wed 2026-11-04 (merged Thu 2026-11-05); EPIC-05 complete about Thu 2026-11-12; **R1 core complete Tue 2026-11-17** (merged Wed 2026-11-18); stretch complete Thu 2026-11-19; R2 complete Tue 2026-11-24 (merged Wed 2026-11-25); **the master's G8 decision Wed 2026-11-25**. The working-day numbers behind them: 1.75, 2.7 / 3.2, 8.4, 12.0 / 12.5, 13.5, 16.8 / 17.3 and 17.9.

### 3.3 What the human waits are assumed to be

- **G3 (human):** over. The delivery lead approved G3 on 2026-11-01 (AQP-1 10491; DL-009) and the master decided it, CONDITIONAL GO. The approval stops were lifted afterwards (DL-010). If the delivery lead or the master asks them to look again at the changed screens, that is one more wait W (3.4).
- **HOLD-01 master data stop (human, a data input and not an approval):** asked after G3, before development, in one request together with the open price and business questions (Q-35, Q-36, Q-37, OQ-ARCH-10 / OQ-PM-07, OQ-ARCH-12, the rest of Q-18, OQ-PM-02). The backlog, G4 and docs PR work runs during that wait, so the stop costs W or the backlog time, whichever is longer. They said development waits for their defaults (AQP-10).
- **Docs PR:** draft PR #1 (`docs/AQP-1-inception`) exists. The orchestrator merges it after G4 GO (`MERGE_POLICY` docs-auto), so story branches start when it is merged.
- **Code PR merges (`MERGE_POLICY` = docs-auto, code-human; one human merge per story):** the story count is not known yet. The model does not count PRs. It assumes the delivery lead merges ready PRs at least once a working day, that agents work on independent stories while a merge waits, and that only a dependent stage waits: M per stage (0.25, 0.5, 1.0 working days) for 5 stages, which adds 1.25 to 5 days. A wait longer than a working day on a stage boundary is the main way the high case arises.
- **G8:** no wait (DL-010). The master evaluates the whole checklist inside the close-out time; a NO-GO stops the run. Their own check, if they want one, happens when the orchestrator reports the result; the plan does not wait for it.
- **Clock:** the clock does not stop at any human point; every wait above is inside the dates (this answers OQ-PM-01 for the dates).

### 3.4 Sensitivity (central effort, other inputs central)

| Change | Scope A date |
|--------|--------------|
| Central case (17.94 working days) | Wed 2026-11-25 |
| Master data wait 0.5 day (the backlog work, 0.6, then sets the time) | Wed 2026-11-25 |
| Master data wait 1.5 days | Thu 2026-11-26 |
| Master data wait 2 days | Thu 2026-11-26 |
| Merges do not wait (M = 0) | Mon 2026-11-23 |
| Each merge stage waits 1 day | Mon 2026-11-30 |
| Effort at the low end, waits central | Mon 2026-11-23 |
| Effort at the high end, waits central | Mon 2026-11-30 |
| G3 rework pass at its high value (1.25 days) | Thu 2026-11-26 |
| The delivery lead is asked to review the changed screens again (one more wait W of 1 day) | Thu 2026-11-26 |
| **A G8 sign-off wait is asked for after all (the v0.6 final wait W of 1 day)** | Thu 2026-11-26 |
| **The rule for a QTY per Assy of 0 is built (+1 h, OQ-ARCH-10 / OQ-PM-07; any of the options, and the fallback block)** | Thu 2026-11-26 |
| A refused SMTP sign-in needs another transport (+4 h, architect) | Thu 2026-11-26 |
| No credit for the work done on 2026-11-01 (v0.5 treatment: 2.90 days added back) | Mon 2026-11-30 |

The 1 h row is the likeliest of these to happen: a block, a warning and the fallback all cost about 1 h, so only the answer "leave it as the rules stand today" avoids it. It is not in the headline because the working total is the architect's 83.75 to 125.75 h (DL-014); it moves the central date by one working day only because the central value sits so close to the boundary, and the high date does not move (24.34 days, still day 25).

### 3.5 Holidays (OQ-PM-02)

Holidays are unknown and are **not assumed**: every date above counts Monday to Friday with no day lost. Treatment: each weekday on which the team cannot work, or on which the delivery lead cannot answer, moves every later date by one weekday. For three lost weekdays the central date becomes **Mon 2026-11-30**, and the high date becomes Wed 2026-12-09 (the end of the range in the risk register, RISK-009). As general knowledge, not verified, early to mid November 2026 may include Diwali-related closures in India; the delivery lead says which days apply and the dates are re-issued.

### 3.6 Can 2026-11-13 be reached?

Not with scope A in any case modelled. Even the low-effort case (83.75 h) with no human wait and no merge wait takes 11.97 working days and ends Tue 2026-11-17; the model's own low case ends Thu 2026-11-19. For information only, because scope B was not chosen: the R1 core alone, handed over at checkpoint C, would end about Thu 2026-11-19 at the centre (13.10 working days: 70 h) and reaches Fri 2026-11-13 only if every input is at its low value (9.41 working days: 55.25 h, a 0.5-day rework, a wait of 0.5 day, merges of 0.25 day over 4 stages, a close-out of 0.5 day). I do not consider that combination realistic.

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The date is a target and not a blocker, so the analysis states how far scope A is from it and what the fit rule says. **The low end of the effort, 83.75 h, is now above the 80 h itself** (v0.6: 76.25 h, below it).

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| A (adopted): R1 core + R1+ + R2 | 83.75 to 125.75 h | 13.22 / 17.94 / 24.22 | Misses by 4 to 15 working days; central 8 days over |
| v0.6 for comparison (same scope) | 76.25 to 112.75 h | 12.78 / 17.66 / 24.09 | Misses by 3 to 15 working days; central 8 days over |

What changed from v0.6: (1) the architect's 7.5 to 13 h is added to the effort; (2) the final G8 sign-off wait leaves the model, so the human waits are now one (the master data defaults) instead of two.

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope A: Musts are about 90 to 91 % of the effort (about 7.75 to 12.5 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088, 103; the architect's added hours are all Must work, so the share rose from about 89 to 90 %). The R1 core alone is about 97 % Must or a little more. The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items or decisions of the delivery lead; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a recorded deviation (DL-002) for the master and the delivery lead to weigh.

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

Checkpoints re-issue the date from actuals. Method: actual hours for the finished epics divided by their estimate gives a ratio; remaining effort x ratio / 8 + remaining stages x M + remaining human waits gives the new date. This is the first time any velocity exists. After DL-010 the only remaining human wait in the model is the master data stop, which is over by checkpoint A.

| Checkpoint | When (central) | Question | Decision |
|------------|----------------|----------|----------|
| A | First epic complete (EPIC-01, about Thu 2026-11-05 after its merge) | Ratio of actual to estimated hours | Re-issue the date |
| B | EPIC-05 complete (about Thu 2026-11-12) | Is the core on track; does the roll-up match the constructed examples (PRD FR-030: 30, 5, and a parent with its own cost)? | Re-issue; decide whether to build the stretch |
| C | R1 core complete (about Tue 2026-11-17, merged Wed 2026-11-18) | Hand over the core now, or continue to R2 (scope A)? Handing over the core would end about Thu 2026-11-19 at the centre (3.6) | Their decision, logged by `master` |

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
| G3 | Done: the delivery lead approved (AQP-1 10491) and the master decided CONDITIONAL GO. Approval stops lifted afterwards (DL-010) | No wait in the dates. If they are asked to look again at the changed screens: one more wait W (3.4) |
| Q-35, Q-36, Q-37 and OQ-ARCH-10 / OQ-PM-07 | Delivery lead, asked with the master data request. Business inputs, not approvals | No wait added: asked inside the HOLD-01 stop. Needed by G4, before the roll-up story reaches Ready. Silence does not close Q-35 (a); for OQ-ARCH-10 a block at Calculate is the labelled fallback (DL-013) |
| Master data stop (HOLD-01, TR-009) | **Human**, a data input and not an approval, outside `CLAUDE.md` | One wait W, overlapped with backlog and G4 |
| G4 | `master` | Draft PR #1 exists; the orchestrator merges it after G4 GO (docs-auto) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | Modelled as M per dependency stage |
| G8 | `master` decides; **no separate sign-off wait** (DL-010); a NO-GO stops the run; deployment stays human | No wait. The master's G8 decision day is the completion date |

## 8. Dependencies by stage

| Stage | Dependency | Owner | Status |
|-------|-----------|-------|--------|
| R1 core | Answers to Q-35 (item's own row; what a part shows), Q-36, Q-37 and OQ-ARCH-10 / OQ-PM-07 (QTY per Assy of 0) | Santhosh | Open; due G4 before the roll-up story reaches Ready; working assumptions apply, and a block is the fallback for OQ-ARCH-10 |
| R1 core | Master data defaults (TR-009, HOLD-01) | Santhosh | Stop before development |
| R1 core | Hosting details: web address, IT person's name, which Outlook account (Q-18) | Santhosh, their IT person | Open; before the first deployment |
| R1 core | Cleaned sample worksheet (Q-30, not blocking) | Santhosh | Open. The repository stays public by their decision (D-13); the original is tracked since c7576f0; structure only is read from it |
| R1 core | Docs PR | orchestrator | Draft PR #1 exists; merged after G4 GO (docs-auto) |
| R1 core | Backup design change from nightly to weekly | solution-architect | Done in architecture v0.3 (D-15) |
| R1 core | A picture on every part (OQ-UX-13 / OQ-ARCH-04) and a notice of changed rates before approval (OQ-UX-16 / OQ-ARCH-06) | Santhosh | Open, not blocking; working assumptions apply (PRD section 12.2) |
| R2 | Sender address and Outlook account; whether it allows SMTP; one real send on the real mailbox before alerts go live | Santhosh, their IT person; solution-architect; developer | Open; alerts tested against a capturing mail server until then |
| After the date | Customer testing, acceptance, change requests; go-live, training, parallel run (TR-003 to TR-005) | Santhosh, Accucut | Not in the dates |
| R-OFF | Meaning of offline, hosting design | Santhosh | Open; settled when the release is planned |

## 9. Effect of each open item on this plan

| Item | If answered as assumed | If answered differently |
|------|------------------------|-------------------------|
| Q-35 item's own row and display of a part (due G4) | The working assumptions stand. Effort and dates are as in sections 2 to 6 | Before the roll-up story is written: the story text changes, no build effort. After it is built: rework of that story, **0 to about 1 h** (estimate), not in the effort figures and not in either date. **Price effect, separate from effort:** where the item's own row holds values and the item quantity is above 1, which includes every single-piece product (DL-012); none at quantity 1 or with 0 on that row |
| OQ-ARCH-10 / OQ-PM-07 QTY per Assy of 0 on a part with parts below it | The delivery lead chooses a block or a warning, or the fallback block applies: about 1 h (estimate, architect), **not in the headline figures**, shown in 3.4 (Thu 2026-11-26 at the centre) | Another rule, or leaving the written rules as they are: 0 h; a minimum other than 0 for QTY per Assy: under 0.5 h more |
| Q-36, Q-37 (display only) | Working ASSUMPTION-54 and 55 stand | Display and export changes, under 1 h each (estimate); no price effect through approval |
| OQ-UX-13 (a picture on every part) | Required, as the SPEC's rule for visible inputs says; no extra hours | A picture optional for some parts: one setting in the field list, under 0.5 h (estimate) |
| OQ-UX-16 (a notice of changed rates before approval) | Not told, as built; no extra hours | A non-blocking notice: 0.5 to 1 h (estimate), not in the figures; a block until recalculated: not estimated |
| Q-18 hosting details | Docker Compose; Outlook; weekly backup | Deployment and mail settings change; effect on hours not estimated. If they choose a nightly backup, the architect's earlier nightly design returns and no effort changes |
| ASSUMPTION-56 (symbols, session start) | Any non-alphanumeric character; 12 hours from sign-in | Under 1 h (estimate) |
| OQ-PM-01, OQ-PM-02 (their availability, holidays) | A wait of 0.5 to 1.5 days at the master data stop; no holidays | Each lost weekday moves every later date by one weekday |

## 10. Change Log

| Version | Date | Change | Reason |
|---------|------|--------|--------|
| 0.1 | 2026-11-01 | First proposal | G2 input; Q-29 |
| 0.2 | 2026-11-01 | UNC items resolved and labels removed; realistic completion date added for two scopes with a proposed answer to Q-34; elapsed-time model with human and merge waits; fit analysis and Must share restated; FR-030 and FR-018 into the core (PROPOSED); offline set to the next release | AQP-1 10441, 10443; AQP-9 10442; AQP-13 10445; AQP-11 10444; AQP-12 10446 |
| 0.3 | 2026-11-01 | Q-32 shown as open with (a), (b) due G2 and (c), (d), (e) due G3, no answer applied; the "0 to 2 h" stated as build effort, not price, with the price ratios; Q-34 shown as their choice due G3 approval, both dates unadopted (DL-004, ASSUMPTION-50); the G2 human wait relabelled from the Q-34 reply to the Q-32 (a), (b) reply (same wait, **no date changed**); sample-file statement added (tracked on `origin/master` since c7576f0, RISK-006); "not applicable" labelled "confirmed on list wording" (DL-001) | G2 attempt 1 NO-GO, remediation 4 and 5; DL-001, DL-004, DL-005 |
| 0.4 | 2026-11-01 | Q-32 closed and ASSUMPTION-48 retired (AQP-13 10462, 10464; D-12): cost-rule row, section 7 and 8 rows and the section 9 row restated; the sensitivity row "Open Q-32 details answered differently" and the build-effort contingency (0 to about 2 h) removed, effort figures unchanged because they were sized on the same rule. **Dates re-issued:** the leading human wait for the Q-32 reply is removed from the elapsed-time model (the answer arrived on 2026-11-01, before the 2026-11-02 start); central dates move one working day earlier (scope B Mon 2026-11-23 to Fri 2026-11-20, scope A Fri 2026-11-27 to Thu 2026-11-26), ranges, sensitivity, milestones, checkpoints and the fit table recomputed with the same model (the v0.3 values reproduce exactly). Repository decision D-13 reflected in section 1 and 8. BLK-01 cleared (draft PR #1 exists): the assumption that it is fixed during the master data stop is removed. "he/his" replaced by "the delivery lead" or "they". No FR, priority, release or scope changed; both dates remain unadopted estimates (DL-004) | AQP-13 10462, 10464; AQP-1 10465; PRD v0.4 |
| 0.5 | 2026-11-01 | G2 attempt 2 condition 3. Section 9: the effect of a change to Q-32 (a) restored as a build-effort contingency of 0 to about 2 h (estimate) that is **not in the effort figures or either date**, with the price effect (sub-part 24 times instead of 8, BL 30 instead of 14) stated separately. Sections 1, 7 and 8: Q-32 (a) own-words confirmation shown as open, due G3 approval, no wait added; G2 attempt 2 shown as CONDITIONAL GO. **No effort figure, scope or date changed**: every v0.4 date stands (scope B central Fri 2026-11-20, range Mon 11-16 to Mon 11-30; scope A central Thu 2026-11-26, range Thu 11-19 to Mon 12-07), both still unadopted (DL-004). The v0.4 dates supersede AQP-12 comment 10450 (v0.2), posted on AQP-12 under condition 4 | `docs/00-governance/gate-log.md` G2 attempt 2, conditions 3 and 4; DL-004, DL-006 |
| 0.6 | 2026-11-01 | G3 answers applied to SPEC v1.4. **Scope A adopted** (AQP-12 10488): scope B, its dates and the two-scope tables removed. **Quantity rule reversed** (every level's quantity applies; AQP-13 10487, AQP-1 10490): the cost-rule row and sections 5, 7, 8 and 9 restated; the 0 to about 2 h contingency for Q-32 (a) retired, because nothing was built on the old rule; Q-35 and OQ-PM-07 added. **Effort re-based:** +4.75 to +9.75 h (password rule and session, audit screen SCR-16 (PROPOSED), "Not applicable" handling, status for Engineers, cleared total and blocked approval, optional reason, total Tool Cost, WCAG 2.2 AA checks); scope A is now 76.25 to 112.75 h, central 94.5 h. **Model changed:** the steps completed on 2026-11-01 (G2 close, UX and architecture, the G3 wait and fixes) leave it; a G3 rework pass (0.5 / 0.75 / 1.25 days) enters it; two human waits remain (was three). **Dates re-issued, not adopted:** central Wed 2026-11-25 (was Thu 2026-11-26), range Wed 2026-11-18 to Fri 2026-12-04 (was Thu 2026-11-19 to Mon 2026-12-07); sensitivity, milestones, checkpoints and the fit table recomputed, with a bridge from v0.5 in 2.3. Hosting facts added (Outlook, weekly backup kept 2 years, updates by their IT person). Supersedes the v0.4 dates in AQP-12 comment 10478 | AQP-1 10490, 10491, 10494; AQP-12 10488; AQP-13 10487; SPEC v1.4; PRD v0.6 |
| 0.7 | 2026-11-01 | G3 condition 11. **Effort:** the architect's 7.5 to 13 h added by epic (R1 core 55.25 to 84.75 h, R2 22.5 to 31.5 h); scope A is 83.75 to 125.75 h, central 104.75 h. **Model:** the final G8 sign-off wait W is removed (DL-010); every other input keeps its v0.6 value. **Date definition changed:** the master's G8 decision day with the last code PR merged, no sign-off wait (2.1). **Dates re-issued, not adopted:** central Wed 2026-11-25 (unchanged; 17.94 days), range Thu 2026-11-19 to Fri 2026-12-04 (the low end moved one day); sensitivity recomputed, with new rows for the 1 h of OQ-ARCH-10, a refused SMTP sign-in and a G8 wait asked for after all; the central date is 0.06 day from a boundary and the plan says so. Milestones, checkpoints, 3.5, 3.6 and the fit table recomputed. Sections 1, 3.3, 7 and 8 aligned with DL-010 to DL-014 (G3 decided; HOLD-01 a data input; backup design done). Section 9: OQ-ARCH-10 / OQ-PM-07, OQ-UX-13, OQ-UX-16 added; "narrow case" wording for Q-35 removed (DL-012). Supersedes the v0.6 dates | `docs/00-governance/gate-log.md` G3, condition 11; DL-010, DL-012, DL-013, DL-014; architecture v0.3 section 16.8; PRD v0.7 |
