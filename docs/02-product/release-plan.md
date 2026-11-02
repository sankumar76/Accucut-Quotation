# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.8 (Draft; the delivery lead's answers on AQP-14 and AQP-15 applied, 2026-11-01. **Warn** on a QTY per Assy of 0 (FR-104, their word) replaces the 1 h block: **3.75 to 5.75 h, central 4.75 h**, on top of the 83.75 to 125.75 h of v0.7. Scope A is now **87.5 to 131.5 h**, central 109.5 h. Dates re-issued: **central Thu 2026-11-26, range Thu 2026-11-19 to Fri 2026-12-04**. The high date is 0.06 working day under a day boundary: an addition above about half an hour moves it to Mon 2026-12-07. Q-35 (a) is settled for a single-piece item, HOLD-01 is met, and the placement of scaffold, CI, tokens and shell effort (CR-11) and the usability test (CR-20) are decided. All of this is an estimate and none of it is adopted by the delivery lead) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | **Estimates. Not adopted.** The scope is decided (scope A). Their reply says "prefer" and does not mention dates, so no date in this plan is theirs. These dates supersede the v0.7 and v0.6 dates and, before them, the v0.4 dates posted on [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) (comment 10478) |
| Companion | `docs/02-product/prd.md` v0.8 (FR, NFR, assumption register, epics, release moves in section 6.3, G4 product decisions in section 12.2) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed | AQP-2 |
| Start date 2026-11-02 (Monday); 10 working days at 8 hours a day | Confirmed | AQP-2 |
| End date 2026-11-13 (Friday) | Confirmed **as a target, not a fixed constraint**. The delivery lead asks for a realistic date and says the date is not a blocker | AQP-1 10441 (h); AQP-12 10446 |
| What the date is for | Answered (Q-29): to complete development and hand that version to their customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live | AQP-12 10446 |
| Scope behind the date | **Decided: scope A**, in their own words: "I prefer the scope A for the intial release." (spelling as written). Scope A = R1 core + R1+ stretch + R2 (EPIC-01 to EPIC-10), built as one hand-over; offline use, dark mode and the UI-sample extras are outside it. They did not mention dates | AQP-12 10488 (D-14) |
| Work already done | G2 attempt 2 returned CONDITIONAL GO, the UX spec and screens and the architecture were written, the delivery lead approved G3 (AQP-1 10491) and the master decided G3: CONDITIONAL GO, attempt 1, 16 conditions (gate log), all on 2026-11-01. The inception backlog (epics and the consistency report) also exists | Gate log; project state; AQP-1 10491; `docs/05-backlog/` |
| Human approval stops | Lifted by the delivery lead's instruction "dont ask me for any approvals except for git merge. But I need to view the result after each iteration (and gate reviews if required)" (AQP-1 10495; DL-010). **G8 no longer waits for a separate sign-off**: the master still evaluates the whole checklist, a NO-GO still stops the run, code pull request merges and deployment stay human | DL-010 |
| Master data (HOLD-01) | **Met 2026-11-01.** The Admin holds and loads the values and types them in at first use, from storage Accucut controls; no values were given; development uses invented placeholders | AQP-10 10512 (D-23) |
| Offline use | Decided: the next release, not Release 1. What it means and the remaining hosting details are open (Q-18). **Not estimated** | AQP-11 10444; AQP-1 10441 (e) |
| Cost rule | **Reversed on 2026-11-01: every level's quantity applies** (AQP-13 10487, AQP-1 10490; DL-011). **Q-35 (a) is answered for a single-piece item:** 1000 on the invented example, so the item's own row counts its quantity once (AQP-14 10510, D-21); their working "500 x 2" does not match the example's figures and the number is taken as the answer. For an item that also has parts below it the same rule is the working ASSUMPTION-57. Still open, display only: what a part below the top shows (Q-35 (b), working ASSUMPTION-52). **The portal differs from the worksheet** wherever a quantity other than 1 sits above a row (PRD GOAL-03) | AQP-13 10487, 10464; AQP-1 10490; AQP-14 10510; D-21 |
| Warn on a QTY per Assy of 0 | **Decided: "Warn"** for a part that has parts below it (AQP-15 10511, D-22), in the delivery lead's one word, with no reason. It is FR-104 and its 3.75 to 5.75 h is in the figures below. A 0 on a part with nothing below it is open as Q-38 (about 0.5 h, not in the figures) | AQP-15 10511 |
| "Not applicable" in the Material and Treatment lists | In their words, relayed: values 0, system-created, not editable or deletable, shown nowhere else (Admin pages included), material cost only skipped. What Lead and Admin are offered and see: Q-36 | AQP-1 10490 (D-17) |
| Export totals | One total only; the total Tool Cost is shown (the export differs from the sample on purpose) | AQP-1 10490 (D-16) |
| Hosting | Answered in part: Microsoft Outlook for e-mail; **weekly** backup kept 2 years, looked after by the Admin; updates installed by their IT person. Open: web address, sender address, which Outlook account (Q-18); whether Settings may show a Last backup line (OQ-ARCH-12, FR-105) | AQP-1 10490 (D-15) |
| Sample workbook | Tracked on `origin/master` since c7576f0 in a repository that stays public by the delivery lead's decision (D-13). They state the workbook has no real data; that is their statement, not verified. Rule unchanged: no sample cell value in documents, Jira or GitHub (NFR-006). A cleaned copy (Q-30) is open and not blocking | AQP-1 10465 |
| Holidays and their availability between 2026-11-02 and 2026-12-04 | Not known, not verified (OQ-PM-02) | none |

Every hour, day and date below is an **estimate** by the product manager. **There is no team velocity behind it**: no story has been built by this team on this stack, and the method (relative size converted to hours, then to working days at 8 hours a day) is judgement, not measurement. Dates are re-issued after the first completed epic (section 6).

## 2. The realistic development completion date (estimate, not adopted)

### 2.1 What the date means

"Development completion date" = the working day on which the master records the G8 release-readiness decision (GO or CONDITIONAL GO) with the last code pull request merged, so the version, its release notes and its install steps are ready to hand to their customer. **The delivery lead's sign-off is not part of the definition and no wait for it is modelled** (DL-010): the orchestrator reports the G8 result and says that no separate sign-off was requested, so they can still stop it. A NO-GO stops the run and the date then does not hold. The merge of each code pull request is a human act and stays inside the dates (M, 3.2). Deployment is a human act by their IT person and is not in the date. Not included in the date: the customer's testing and acceptance (which includes the usability test, CR-20), change requests, go-live, training, the parallel run (TR-003 to TR-005), and the offline release.

### 2.2 The date for scope A (estimates)

| | **Scope A (adopted)**: whole SPEC except offline, dark mode and the UI-sample extras |
|---|---|
| Contents | R1 core + R1+ stretch + R2: EPIC-01 to EPIC-10, 98 FRs (74 + 6 + 18; v0.7: 96, with FR-104 and FR-105 added). Excludes dark mode (FR-090), the UI-sample extras (FR-097) and offline use (FR-092), which are not estimated; if the delivery lead wants any of them inside the date they say so and the product manager estimates them |
| Development effort (estimate) | 87.5 to 131.5 h, central 109.5 h (v0.7: 83.75 to 125.75 h, central 104.75 h; v0.6: 76.25 to 112.75 h). Warn's 3.75 to 5.75 h is in. **Not in:** Q-38, the warning for a part with nothing below it (about 0.5 h, about 0.75 h after the story is built); FR-105, the Last backup line (under 0.5 h); the G4 product decisions of PRD section 12.2 (under 0.75 h together); a refused SMTP sign-in (about 4 h). See the sensitivity rows in 3.4 |
| **Central date** | **Thursday 2026-11-26** (v0.7: Wednesday 2026-11-25) |
| **Range** | **Thursday 2026-11-19 to Friday 2026-12-04** (v0.7: the same) |
| Working days from 2026-11-02 | central 19 (range 14 to 25); unrounded 13.69 / 18.54 / 24.94 |
| Misses the 2026-11-13 target? | Yes in every case modelled (3.6) |
| SPEC §14 criteria met at hand-over | all except any that touch offline |

The range is "everything goes well" to "everything goes slowly" taken together: low = low effort estimate, shortest waits; high = high effort estimate, longest waits. A date near the central value is the most likely single outcome of this model, and the model is itself uncertain (no velocity). **The central value 18.54 working days sits 0.46 day (about 3.7 h) under the next boundary, so Thu 2026-11-26 is steadier than the v0.7 date was. The high value 24.94 sits 0.06 day, about half an hour of work, under the boundary to day 26:** any addition above about 0.5 h (Q-38 is 0.75 h if decided after the story is built) moves the high date to Mon 2026-12-07. The R1 core is complete on about **Wednesday 2026-11-18** (central, merged Thu 2026-11-19), an interim point at which they can still choose to hand over the core (section 6).

### 2.3 How the central date moved since v0.7

| Step | Working days (central) |
|------|------------------------|
| v0.7 central, scope A | 17.94, Wed 2026-11-25 |
| Add Warn (FR-104): 4.75 h at 8 h a day | +0.59 |
| **v0.8 central** | **18.54, rounded up to 19: Thu 2026-11-26** |

Low: 13.22 + 3.75 / 8 = 13.69, day 14 (Thu 2026-11-19). High: 24.22 + 5.75 / 8 = 24.94, day 25 (Fri 2026-12-04). The 1 h block that v0.7 listed as a sensitivity row (+1 h, Thu 2026-11-26) is gone: it was never in the headline, and Warn, which is, replaces it. Nothing else moved: the G3 rework term, the master data wait, the merge waits and the close-out keep their v0.7 values, so that the only change is the one the delivery lead's answer causes. The v0.6 credit for steps completed on 2026-11-01 (2.90 days) is unchanged; if the delivery lead would rather not count it, the central date is Tue 2026-12-01 (3.4).

### 2.4 Risks of scope A

The estimate has no velocity behind it; EPIC-08 (12 to 16 h) is the largest and least certain block; the G3 answers add rules (stale totals, the password rule, hidden "Not applicable" entries, Warn) whose size is also judgement; the architect's added hours are the architect's estimate, not a measurement; the scaffold, CI gates, secret scan and design tokens were never itemised (3.1); alerts can only be tested against a capturing mail server until the Outlook account is named (Q-18), and the OAuth sign-in to Outlook is designed and unproven (RISK-014).

## 3. How the dates were built

### 3.1 Demand (effort, estimate)

Effort per epic includes development, the three reviews and QA for each story, and excludes waits for a human. Nothing had been built on the old quantity rule, so its reversal costs no build effort. The added hours since v0.6 are the architect's lists (architecture sections 16.8 and 16.10, development with tests, no velocity behind them). Where the architect gave one range for several epics (the figure state, 1 to 2 h for EPIC-05 and 06; Warn, in six rows over EPIC-03, 05, 06 and 07) the product manager splits it, rounded to quarter hours; that split is an estimate and does not change the total.

| Epic | Stage | Effort (h) | Midpoint | Change from v0.7 |
|------|-------|-----------|----------|------------------|
| EPIC-01 Foundation, access, confidentiality (includes the scaffold and application shell as sized for SPEC step 1) | R1 core | 5.75 to 9.5 | 7.625 | 0 |
| EPIC-02 Masters, incl. FR-018 "Not applicable" (1.5 to 3 with the hidden entries) | R1 core | 5.5 to 9 | 7.25 | 0 |
| EPIC-03 Registry and calculation engine, incl. FR-030 quantity roll-up (2.5 to 4) and the BN divisor | R1 core | 11.25 to 16.75 | 14 | +1.25 to 1.75: the Warn rule, its routes and its tests |
| EPIC-04 Tasks and queues | R1 core | 3.25 to 5.75 | 4.5 | 0 |
| EPIC-05 Estimate workspace | R1 core | 12 to 17.75 | 14.875 | +1 to 1.75: the Warn dialog at Calculate, its route share and tests |
| EPIC-06 Cost review and approval | R1 core | 7.75 to 11.5 | 9.625 | +1 to 1.5: the notice on the Lead's screens, the record on the calculation and the audit entry |
| EPIC-07 Excel export | R1 core | 7 to 10.25 | 8.625 | +0.5 to 0.75: the notice on the export preview and the stored list |
| EPIC-10 Experience, brand, delivery (E2E, accessibility, Docker, README, tags; includes the CI gates, secret and repository scan and design tokens, which no estimate itemised) | R1 core | 6.5 to 10 | 8.25 | 0 |
| **R1 core** | | **59 to 90.5** | **74.75** | v0.7: 55.25 to 84.75 (70); +3.75 low, +5.75 high |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 | 0 |
| EPIC-08 Admin configuration | R2 | 12 to 16 | 14 | 0 (the audit screen may lower it by up to 1 h; not taken) |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 10.5 to 15.5 | 13 | 0 |
| **Scope A total** | | **87.5 to 131.5** | **109.5** | v0.7: 83.75 to 125.75 (104.75); +3.75 low, +5.75 high |

**Where the scaffold, CI, tokens and shell effort sits (CR-11).** No hours moved between epics. The scaffold and the application shell were sized in EPIC-01 as SPEC step 1 (4 to 6 h in v0.1, 5.75 to 9.5 h now); the CI gates, the secret and repository scan and the design tokens sit in EPIC-10, where the epic outline and the test strategy put them. Neither was ever itemised, so no separate figure exists and no part of either range is a measured amount for them. The backlog schedules stories 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) before every EPIC-01 story. That changes the order inside the first stage and not the totals, so the dates do not move. Checkpoint A now reads EPIC-01 together with 10.01 and 10.02; if those two prove larger than the share assumed, the ratio at A shows it first. The solution-architect is asked to confirm the placement.

Not in the hours, and each shown as a sensitivity row in 3.4 where it moves a date: dark mode and the UI-sample extras (outside scope A), offline use, ROLLUP naming and the other text alignments (no effort), and the change from a nightly to a weekly backup (a documentation change, not a build item). Also not in the hours: Q-38, about 0.5 h before the roll-up story is built and about 0.75 h after (architect); FR-105, the Last backup line, under 0.5 h (estimate, only if OQ-ARCH-12 allows it); the G4 product decisions of PRD section 12.2, namely the forced password change after an Admin-set password and the password step on an Admin hand-over, each under 0.5 h (estimate), and a notice of changed rates before approval, 0.5 to 1 h (estimate), only if the delivery lead asks for it; and a refused SMTP sign-in, about 4 h for another transport (architect).

### 3.2 Elapsed-time model

Effort is converted to working days at 8 hours a day (the unit the delivery lead used). Each human point is a number of working days during which agents on that thread wait. Weekends are not worked; no holidays are assumed (3.5).

| Input (estimate) | Low | Central | High | Why |
|------------------|-----|---------|------|-----|
| G3 conditions rework pass, in working days | 0.5 | 0.75 | 1.25 | The business-analyst, product-manager, ux-expert and solution-architect rework in parallel after the master's G3 decision and the longest sets the time. The values stay as in v0.6 |
| Human wait W at one point: the master data defaults (HOLD-01), in working days | 0.5 | 1 | 1.5 | **HOLD-01 is met (AQP-10 10512, 2026-11-01), before the 2026-11-02 start, so this is no longer a wait for a known pending input.** The value stays in this re-issue because the master fixed the changes to the model (DL-014) and this version adds only Warn. Dropping it moves no date: the three dates are the same without it (3.4). The master says whether to drop it now; the product manager would drop it at checkpoint A, as the Q-32 wait was dropped in v0.4 |
| Backlog, G4 and docs PR (runs while the first inputs are settled), days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1); the stop costs max(W, this) |
| Merge wait M per dependency stage, days | 0.25 | 0.5 | 1.0 | See 3.3 |
| Close-out before the G8 decision: release notes, G8 pack, README check, the master's evaluation, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| Dependency stages that gate on a merge | 5 | 5 | 5 | EPIC-01 (with enablers 10.01 and 10.02); then EPIC-02, 03, 04; then EPIC-05; then EPIC-06, 07 (EPIC-10 alongside); then R1+ and R2 as one more stage |

Elapsed working days = G3 rework + max(W, backlog) + effort / 8 + stages x M + close-out. The result is rounded up to a whole working day, counting 2026-11-02 as day 1.

| Case | Effort | Elapsed working days | Completion |
|------|--------|----------------------|------------|
| Low | 87.5 h | 13.69 | Thu 2026-11-19 |
| **Central** | 109.5 h | 18.54 | **Thu 2026-11-26** |
| High | 131.5 h | 24.94 | Fri 2026-12-04 |
| v0.7 for comparison | 83.75 / 104.75 / 125.75 h | 13.22 / 17.94 / 24.22 | Thu 2026-11-19 / Wed 2026-11-25 / Fri 2026-12-04 |

Central-case milestones: the G3 conditions rework pass runs from Mon 2 Nov; pre-development ends Tue 2026-11-03; EPIC-01 with enablers 10.01 and 10.02 complete Wed 2026-11-04 (merged Thu 2026-11-05); EPIC-05 complete about Thu 2026-11-12; **R1 core complete Wed 2026-11-18** (merged Thu 2026-11-19); stretch complete Fri 2026-11-20; R2 complete Wed 2026-11-25 (merged the same day); **the master's G8 decision Thu 2026-11-26**. The working-day numbers behind them: 1.75, 2.7 / 3.2, 8.8, 12.6 / 13.1, 14.1, 17.4 / 17.9 and 18.5.

### 3.3 What the human waits are assumed to be

- **G3 (human):** over. The delivery lead approved G3 on 2026-11-01 (AQP-1 10491; DL-009) and the master decided it, CONDITIONAL GO. The approval stops were lifted afterwards (DL-010). If the delivery lead or the master asks them to look again at the changed screens, that is one more wait W (3.4).
- **HOLD-01 master data stop:** met (AQP-10 10512, D-23). The W term in 3.2 is kept for this re-issue only; see the table. The open business questions asked with it (Q-35 (b), Q-36, Q-37, Q-38, OQ-ARCH-12, the rest of Q-18, OQ-PM-02) carry labelled working assumptions and hold no story, except as the master decides for the roll-up story.
- **Docs PR:** draft PR #1 (`docs/AQP-1-inception`) exists. The orchestrator merges it after G4 GO (`MERGE_POLICY` docs-auto), so story branches start when it is merged.
- **Code PR merges (`MERGE_POLICY` = docs-auto, code-human; one human merge per story):** the story count is not known yet. The model does not count PRs. It assumes the delivery lead merges ready PRs at least once a working day, that agents work on independent stories while a merge waits, and that only a dependent stage waits: M per stage (0.25, 0.5, 1.0 working days) for 5 stages, which adds 1.25 to 5 days. A wait longer than a working day on a stage boundary is the main way the high case arises.
- **G8:** no wait (DL-010). The master evaluates the whole checklist inside the close-out time; a NO-GO stops the run. Their own check, if they want one, happens when the orchestrator reports the result; the plan does not wait for it.
- **Customer testing, acceptance and the usability test (CR-20):** after the date, not in it. They need Accucut staff, whose time this plan cannot assume.
- **Clock:** the clock does not stop at any human point; every wait above is inside the dates (this answers OQ-PM-01 for the dates).

### 3.4 Sensitivity (central effort, other inputs central)

| Change | Scope A date |
|--------|--------------|
| Central case (18.54 working days) | Thu 2026-11-26 |
| **The master data wait is dropped (HOLD-01 met): central 18.14, low 13.69, high 24.19** | Thu 2026-11-26 (low Thu 2026-11-19, high Fri 2026-12-04: none moves) |
| Master data wait 1.5 days | Fri 2026-11-27 |
| Master data wait 2 days | Fri 2026-11-27 |
| Merges do not wait (M = 0) | Tue 2026-11-24 |
| Each merge stage waits 1 day | Tue 2026-12-01 |
| Effort at the low end, waits central | Mon 2026-11-23 |
| Effort at the high end, waits central | Tue 2026-12-01 |
| G3 rework pass at its high value (1.25 days) | Fri 2026-11-27 |
| The delivery lead is asked to review the changed screens again (one more wait W of 1 day) | Fri 2026-11-27 |
| A G8 sign-off wait is asked for after all (a final wait W of 1 day) | Fri 2026-11-27 |
| **Q-38: Warn also covers a part with nothing below it (+0.5 h, or +0.75 h after the story is built)** | Thu 2026-11-26 (central); **the high date moves to Mon 2026-12-07 at +0.75 h** (25.03 days) |
| A refused SMTP sign-in needs another transport (+4 h, architect) | Fri 2026-11-27 |
| No credit for the work done on 2026-11-01 (v0.5 treatment: 2.90 days added back) | Tue 2026-12-01 |

Warn is in the headline. The Q-38 row is the one open item with a known cost; it does not move the central date, and it is the only addition that can push the high date over a boundary.

### 3.5 Holidays (OQ-PM-02)

Holidays are unknown and are **not assumed**: every date above counts Monday to Friday with no day lost. Treatment: each weekday on which the team cannot work, or on which the delivery lead cannot answer, moves every later date by one weekday. For three lost weekdays the central date becomes **Tue 2026-12-01**, and the high date becomes Wed 2026-12-09 (the end of the range in the risk register, RISK-009). As general knowledge, not verified, early to mid November 2026 may include Diwali-related closures in India; the delivery lead says which days apply and the dates are re-issued.

### 3.6 Can 2026-11-13 be reached?

Not with scope A in any case modelled. Even the low-effort case (87.5 h) with no human wait and no merge wait takes 12.44 working days and ends Wed 2026-11-18; the model's own low case ends Thu 2026-11-19. For information only, because scope B was not chosen: the R1 core alone, handed over at checkpoint C, would end about Thu 2026-11-19 at the centre (13.69 working days: 74.75 h) and reaches Fri 2026-11-13 only if every input is at its low value (9.88 working days: 59 h, a 0.5-day rework, a wait of 0.5 day, merges of 0.25 day over 4 stages, a close-out of 0.5 day), which leaves an hour of margin. I do not consider that combination realistic.

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The date is a target and not a blocker, so the analysis states how far scope A is from it and what the fit rule says. **The low end of the effort, 87.5 h, is above the 80 h itself** (v0.7: 83.75 h; v0.6: 76.25 h, below it).

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| A (adopted): R1 core + R1+ + R2 | 87.5 to 131.5 h | 13.69 / 18.54 / 24.94 | Misses by 4 to 15 working days; central 9 days over |
| v0.7 for comparison (same scope, without Warn) | 83.75 to 125.75 h | 13.22 / 17.94 / 24.22 | Misses by 4 to 15 working days; central 8 days over |

What changed from v0.7: the effort of Warn, 3.75 to 5.75 h, is added. Nothing else.

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope A: Musts are about 90 to 91 % of the effort (about 7.75 to 12.5 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088, 103; FR-105 is a Should of under 0.5 h, not counted; the architect's added hours and Warn are all Must work). The R1 core alone is about 97 % Must or a little more. The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items or decisions of the delivery lead; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a recorded deviation (DL-002) for the master and the delivery lead to weigh.

## 5. Releases and build stages

| Stage | Name | Epics | What a user can do at the end | Brief goals |
|-------|------|-------|-------------------------------|-------------|
| **R1 core** | Assign, enter, calculate, approve, export | EPIC-01, 02, 03, 04, 05, 06, 07, 10 | Admin creates users and masters and reads the audit record; Lead assigns a task; Engineer enters a part tree, presses Calculate (and is warned about a 0 quantity on a part with parts below it), sees the status and no cost; Lead views costs and formulas, approves and locks a price only from a current calculation, unlocks if needed; Lead downloads the Excel file in the worksheet layout with one total and the total Tool Cost; the bell and Overdue tab show late work | GOAL-01, 02, 03, 04, 07 in full; GOAL-05 in part (no e-mail); GOAL-06 in part |
| R1+ stretch | Built after the core | FR-014, 035, 039, 054, 057, 088 | Propagation prompt for process defaults, Lead default filter, task filters, autosave, completeness count, loading and empty states | Same |
| **R2** | Admin control and alerts | EPIC-08, EPIC-09 (FR-003, 006, 019, 040, 072 to 084, 105) | Admin changes fields and formulas with re-lettering, versions, checkpoints and change history; e-mail alerts and the 11:00 IST digest; password reset by e-mail; task reassign; a Last backup line on Settings, if agreed | GOAL-05, GOAL-06 in full |
| R3 | Later; **outside scope A** | EPIC-11 (FR-090, 097) | Dark mode; UI-sample extras. Drawing input only if scheduled | GOAL-07 |
| **R-OFF** | The next release (confirmed) | EPIC-12 (FR-092), outline only | Use without internet; meaning and design open | GOAL-01 |

The first three rows are one hand-over (scope A). Release moves since v0.1 are in PRD section 6.3. SPEC §14 acceptance criteria are all met at the hand-over except any that touch offline; by build stage, the **R1 core** meets 1, 2, 3, 4, 5, 12, 13, 14 and 10 if FR-014 is reached, and **R2** meets 6, 7, 8, 9, 11. Criterion 12 is read with the exception of D-16 (one total only, total Tool Cost shown).

| SPEC §13 step | Stage | Note |
|---------------|-------|------|
| 1 Scaffold, auth, users, roles, shell, About | R1 core (EPIC-01), with enablers 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) scheduled first | Includes the password rule, the 12-hour session and the audit screen. The scaffold and shell hours are in EPIC-01 and the CI, scan and token hours in EPIC-10 (3.1) |
| 2 Masters, Settings | R1 core masters (EPIC-02); Settings and alerts switch in R2 | "Not applicable" entries are system-created and hidden |
| 3 Registry, seed, formula engine | R1 core (EPIC-03) | Engine and seeded registry; the roll-up applies every level's quantity; the quantity step stays in one place; the Warn rule |
| 4 Tasks, queues, overdue, bell | R1 core (EPIC-04) | Engineers see the status |
| 5 Estimate workspace | R1 core (EPIC-05) | Any input change marks the estimate out of date; the Warn dialog at Calculate |
| 6 Cost view, approval, lock, unlock | R1 core (EPIC-06) | Cleared total; approval blocked while stale; optional reason; the Warn notice |
| 7 Excel export | R1 core (EPIC-07) | One total, total Tool Cost shown; the Warn notice on the preview, none in the file |
| 8 Admin configuration UI | R2 (EPIC-08) | |
| 9 E-mail alerts and scheduled jobs | R2 (EPIC-09) | Outlook named; sender address does not exist yet (Q-18) |
| 10 Polish, accessibility (WCAG 2.2 AA), E2E, Docker, README | R1 core for delivered screens (EPIC-10); repeated for R2 screens | Responsive and accessible are built in from step 1 |

## 6. Checkpoints and cut ladder

Checkpoints re-issue the date from actuals. Method: actual hours for the finished epics divided by their estimate gives a ratio; remaining effort x ratio / 8 + remaining stages x M + remaining human waits gives the new date. This is the first time any velocity exists. After DL-010 and with HOLD-01 met, the only human waits left in the model are code merges and the master data term kept for this re-issue (3.2).

| Checkpoint | When (central) | Question | Decision |
|------------|----------------|----------|----------|
| A | EPIC-01 with enablers 10.01 and 10.02 complete (about Thu 2026-11-05 after its merge) | Ratio of actual to estimated hours, with the scaffold, CI and token share visible for the first time | Re-issue the date; drop the master data wait if it is still in the model |
| B | EPIC-05 complete (about Thu 2026-11-12) | Is the core on track; does the roll-up match the constructed examples (PRD FR-030: 30, 5, 1000 and a parent with its own cost) and does Warn pass its tests (FR-104)? | Re-issue; decide whether to build the stretch |
| C | R1 core complete (about Wed 2026-11-18, merged Thu 2026-11-19) | Hand over the core now, or continue to R2 (scope A)? Handing over the core would end about Thu 2026-11-19 at the centre (3.6) | Their decision, logged by `master` |

### 6.1 Cut ladder (only if they want an earlier hand-over; each is a scope decision for them)

| Step | Cut | Hours saved (estimate) | Outcome lost |
|------|-----|------------------------|--------------|
| 0 | Do not start any stretch item | 6 to 9.5 | R1+ items |
| 1 | Move FR-063 Unlock and the Closed-to-Open reopen (FR-038 part) to a later stage | 1 to 2 | An approved estimate cannot be reopened |
| 2 | Move FR-058's six-stage accordion and formula display (and FR-060) to a later stage | 1 to 2 | Lead cannot see the arithmetic behind a price |
| 3 | Move FR-047 part pictures and export column C images to a later stage | 2 to 3 | Parts not identified visually; SPEC §14.12 image check fails |

Steps 1 to 3 save 4 to 7 h (about 0.5 to 0.9 working day). Not cut candidates: cost confidentiality (FR-007, 008), the calculation and its tests (FR-020 to 031), the quantity warning (FR-104, their decision), approve and lock with its stale-total rules (FR-062, 100, 101), the export itself (FR-066 to 070), responsive and accessibility tests (FR-085, NFR-016, NFR-018).

### 6.2 Process effects the estimate does not capture

- Parallel work is not assumed. After EPIC-01, EPIC-02, 03 and 04 are independent, and EPIC-06 and 07 are independent after EPIC-05; parallel developers would shorten elapsed time, not effort, and human merges would still serialise.
- Story count and size are not known until the backlog exists (G4); the merge model should be recalibrated then. The Warn work crosses four epics, so it needs its own story or clear splits (the backlog decides).
- The docs PR exists as draft PR #1; story branches start after it is merged at G4.

## 7. Human gates, stops and who waits for whom

| Point | Type | Effect on the plan |
|-------|------|--------------------|
| G3 | Done: the delivery lead approved (AQP-1 10491) and the master decided CONDITIONAL GO. Approval stops lifted afterwards (DL-010) | No wait in the dates. If they are asked to look again at the changed screens: one more wait W (3.4) |
| Q-35 (b), Q-36, Q-37, Q-38 | Delivery lead, business inputs, not approvals | No wait: labelled working assumptions run. Q-38 is not needed for any story |
| Master data stop (HOLD-01, TR-009) | **Met** 2026-11-01 (AQP-10 10512, D-23) | The W term stays in the model for this re-issue; dropping it moves no date |
| G4 | `master` | Draft PR #1 exists; the orchestrator merges it after G4 GO (docs-auto) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | Modelled as M per dependency stage |
| G8 | `master` decides; **no separate sign-off wait** (DL-010); a NO-GO stops the run; deployment stays human | No wait. The master's G8 decision day is the completion date |

## 8. Dependencies by stage

| Stage | Dependency | Owner | Status |
|-------|-----------|-------|--------|
| R1 core | Q-35 (a) and OQ-ARCH-10 | Santhosh | **Answered** (AQP-14 10510, AQP-15 10511); the master decides whether the roll-up story is clear for G4 |
| R1 core | Q-35 (b), Q-36, Q-37, Q-38 | Santhosh | Open, not blocking; working assumptions run (ASSUMPTION-52, 54, 55, 58) |
| R1 core | Enablers: stories 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) before any EPIC-01 story | product-owner; solution-architect to confirm the effort placement | Ruled in the backlog (CR-11); hours in 3.1 |
| R1 core | Master data defaults (TR-009) | Santhosh; the Admin | **Met** (D-23). Invented placeholders until the Admin types the real values at first use |
| R1 core | Hosting details: web address, IT person's name, which Outlook account (Q-18) | Santhosh, their IT person | Open; before the first deployment |
| R1 core | Cleaned sample worksheet (Q-30, not blocking) | Santhosh | Open. The repository stays public by their decision (D-13); the original is tracked since c7576f0; structure only is read from it |
| R1 core | Docs PR | orchestrator | Draft PR #1 exists; merged after G4 GO (docs-auto) |
| R1 core | A picture on every part (OQ-UX-13 / OQ-ARCH-04) and a notice of changed rates before approval (OQ-UX-16 / OQ-ARCH-06) | Santhosh | Open, not blocking; working assumptions apply (PRD section 12.2) |
| R2 | Sender address and Outlook account; whether it allows SMTP; one real send on the real mailbox before alerts go live | Santhosh, their IT person; solution-architect; developer | Open; alerts tested against a capturing mail server until then |
| R2 | Whether Settings may show a Last backup line (OQ-ARCH-12, FR-105) | Santhosh | Open; FR-105 is built only if they agree |
| After the date | Customer testing, acceptance, change requests; the usability test of PRD 12.2 (CR-20); go-live, training, parallel run (TR-003 to TR-005) | Santhosh, Accucut; qa-engineer (test plan) | Not in the dates. The delivery lead supplies the participants (at least 2 Engineers and 2 Leads) |
| R-OFF | Meaning of offline, hosting design | Santhosh | Open; settled when the release is planned |

## 9. Effect of each open item on this plan

| Item | If answered as assumed | If answered differently |
|------|------------------------|-------------------------|
| Q-35 (b) what a part below the top shows (display only); ASSUMPTION-57 an item that also has parts below it | The working assumptions stand. Effort and dates are as in sections 2 to 6 | Before the roll-up story is written: the story text changes, no build effort. After it is built: rework of that story, **0 to about 1 h** (estimate), not in the effort figures and not in either date. **Price effect, separate from effort:** for ASSUMPTION-57, where an item has both a cost on its own row and parts below it, at an item quantity above 1 |
| Q-38 Warn on a part with nothing below it | Left alone (ASSUMPTION-58): accepted with no message; 0 h | Also warn: about 0.5 h before the roll-up story is built, about 0.75 h after, **not in the headline figures**, shown in 3.4 (central date unchanged; the high date moves to Mon 2026-12-07 at 0.75 h) |
| Q-36, Q-37 (display only) | Working ASSUMPTION-54 and 55 stand | Display and export changes, under 1 h each (estimate); no price effect through approval |
| OQ-UX-13 (a picture on every part) | Required, as the SPEC's rule for visible inputs says; no extra hours | A picture optional for some parts: one setting in the field list, under 0.5 h (estimate) |
| OQ-UX-16 (a notice of changed rates before approval) | Not told, as built; no extra hours | A non-blocking notice: 0.5 to 1 h (estimate), not in the figures; a block until recalculated: not estimated |
| OQ-ARCH-12 (Last backup line, FR-105) | Not built unless they agree; 0 h | Built: under 0.5 h (estimate), not in the figures |
| Q-18 hosting details | Docker Compose; Outlook; weekly backup | Deployment and mail settings change; effect on hours not estimated. If they choose a nightly backup, the architect's earlier nightly design returns and no effort changes |
| ASSUMPTION-56 (symbols, session start) | Any non-alphanumeric character; 12 hours from sign-in | Under 1 h (estimate) |
| OQ-PM-01, OQ-PM-02 (their availability, holidays) | A wait of 0.5 to 1.5 days kept in the model; no holidays | Each lost weekday moves every later date by one weekday |

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
| 0.8 | 2026-11-01 | The delivery lead's answers on AQP-14, AQP-15 and AQP-10 (D-21 to D-23, SPEC v1.6; architecture v0.5 section 16.10; consistency report CR-11, 14, 20). **Effort:** Warn (FR-104) 3.75 to 5.75 h, central 4.75 h, split over EPIC-03, 05, 06 and 07, replaces the 1 h block that v0.7 held outside the headline; scope A is 87.5 to 131.5 h, central 109.5 h (R1 core 59 to 90.5 h). **Dates re-issued, not adopted:** central Thu 2026-11-26 (18.54 days; v0.7 Wed 2026-11-25), range Thu 2026-11-19 to Fri 2026-12-04 (unchanged); the high date is 0.06 day under a boundary. Sensitivity, milestones, checkpoints, 3.5, 3.6 and the fit table recomputed; the 1 h block rows removed, a Q-38 row (+0.5 or +0.75 h) added. HOLD-01 shown as met (D-23): the W term stays for this re-issue and the plan shows that dropping it moves no date. Q-35 (a) restated as settled for a single-piece item (D-21). Decisions: CR-11 (no hours moved; enablers 10.01 and 10.02 first; the scaffold and shell hours stay in EPIC-01 and the CI, scan and token hours in EPIC-10, none itemised), CR-14 (FR-105 added, Should, R2, under 0.5 h, not in the figures), CR-20 (usability test during customer acceptance, after the date, not in the dates). Supersedes the v0.7 dates | AQP-14 10510; AQP-15 10511; AQP-10 10512; SPEC v1.6; architecture v0.5; PRD v0.8 |
