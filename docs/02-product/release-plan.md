# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.3 (Draft for G2 attempt 2; G2 remediation 4 and 5 applied: Q-32 effort versus price, Q-32 split per DL-005, scope and dates unadopted per DL-004, RISK-006 sample-file statement; no date changed) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | **Proposal. Not agreed.** Proposed answer to Q-34 and the realistic date requested on [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) (comment 10446). **The scope is Santhosh's choice (ASSUMPTION-50; Q-34 due G3 approval, DL-004); both dates are unadopted estimates** |
| Companion | `docs/02-product/prd.md` v0.3 (FR, NFR, assumption register, epics, release moves in section 6.3) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed | AQP-2 |
| Start date 2026-11-02 (Monday); 10 working days at 8 hours a day | Confirmed | AQP-2 |
| End date 2026-11-13 (Friday) | Confirmed **as a target, not a fixed constraint**. The delivery lead asks for a realistic date and says the date is not a blocker | AQP-1 10441 (h); AQP-12 10446 |
| What the date is for | Answered (Q-29): to complete development and hand that version to his customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live | AQP-12 10446 |
| Offline use | Decided: the next release, not Release 1. What it means and the hosting details are open (Q-18, due G3). **Not estimated** | AQP-11 10444; AQP-1 10441 (e) |
| Cost rule | Main rule confirmed in his own words as corrected (D-08). **Open: Q-32 (a) to (e), carried by ASSUMPTION-48, the analyst's reading, not accepted by him.** (a), (b) hold G2; (c), (d), (e) are due G3 (DL-005). The 10415 per-level rule is withdrawn "as written"; whether a part's quantity multiplies the parts under it is Q-32 (a). Interim readings (b3) and (e1) are named in PRD FR-029 and FR-030. No Q-32 answer is applied in this plan | AQP-9 10442; AQP-13 10445 |
| "Not applicable" in the Material and Treatment lists | Confirmed on list wording (DL-001); values are Q-33 (ASSUMPTION-49) | AQP-1 10441 (b) |
| Scope behind the realistic date | **Open, Q-34. His choice (ASSUMPTION-50); due G3 approval; does not hold G2 (DL-004).** The proposed answer in section 2 is input only; the master did not choose. Until he answers: no FR moves, both dates are unadopted, UX and architecture cover every FR through R2, the build starts with the R1 core | none yet |
| Sample workbook | Tracked on `origin/master` since c7576f0 in a repository readable without sign-in (RISK-006). Earlier wording that it was not committed was wrong. What to do with the repository and the files is his decision; agents do not change visibility or history | gate log G2 |
| Holidays and his availability between 2026-11-02 and 2026-12-09 | Not known, not verified (OQ-PM-02) | none |

Every hour, day and date below is an **estimate** by the product manager. **There is no team velocity behind it**: no story has been built by this team on this stack, and the method (relative size converted to hours, then to working days at 8 hours a day) is judgement, not measurement. Dates are re-issued after the first completed epic (section 6).

## 2. The realistic development completion date (proposed answer to Q-34)

### 2.1 What the date means

"Development completion date" = the working day on which the delivery lead gives the G8 release-readiness sign-off, so the version, its release notes and its install steps can be handed to his customer. Not included in the date: the customer's testing and acceptance, change requests, go-live, master data entry beyond the defaults he provides at the TR-009 stop, training, the parallel run (TR-003 to TR-005), and the offline release.

### 2.2 The two scopes and their dates (estimates)

| | **Scope A (proposed)**: whole SPEC except offline | **Scope B (alternative)**: first-release proposal |
|---|---|---|
| Contents | R1 core + R1+ stretch + R2: EPIC-01 to EPIC-10, 90 FRs (67 + 6 + 17). Excludes dark mode (FR-090) and the UI-sample extras (FR-097), which are Could and not estimated; if the delivery lead wants them inside the date he says so and the product manager estimates them | R1 core only: EPIC-01 to 07 and EPIC-10 core (67 FRs). Admin screens for fields and formulas, e-mail alerts and the R1+ stretch come in a later release |
| Development effort (estimate) | 71.5 to 103 h, central 87.25 h | 46 to 67 h, central 56.5 h |
| **Central date** | **Friday 2026-11-27** | **Monday 2026-11-23** |
| **Range** | **Thursday 2026-11-19 to Wednesday 2026-12-09** | **Monday 2026-11-16 to Tuesday 2026-12-01** |
| Working days from 2026-11-02 | central 20 (range 14 to 28) | central 16 (range 11 to 22) |
| Misses the 2026-11-13 target? | Yes in every case modelled | Yes in every case modelled; see 3.3 for the only way to reach it |
| SPEC §14 criteria met at hand-over | all except any that touch offline | 1, 2, 3, 4, 5, 12, 13, 14 and 10 only if FR-014 is built; 6, 7, 8, 9, 11 follow in a later release |

The range is "everything goes well" to "everything goes slowly" taken together: low = low effort estimate, shortest waits; high = high effort estimate, longest waits. A date near the central value is the most likely single outcome of this model, and the model is itself uncertain (no velocity). Scope A passes an interim milestone: the R1 core is complete on about **Thursday 2026-11-19** (central), before the close-out and G8 wait that give scope B its sign-off date of Monday 2026-11-23.

### 2.3 Why scope A is proposed

1. The date is no longer a deadline (AQP-12 10446), which removes the main reason for the first-release split in v0.1 (fitting 10 days). Scope A costs about 4 working days more than scope B at the centre (31 h of effort plus one more merge stage).
2. Scope A meets every SPEC §14 criterion except offline in one hand-over. The SPEC treats every criterion as a hard requirement; scope B leaves five for a second hand-over and a second customer test cycle.
3. It matches his wording: "the next release" is then the offline release (AQP-11 10444). Under scope B the order of the Admin-screens release and the offline release is a new question (OQ-PM-06).
4. What scope B gives that A does not: a hand-over about 4 working days earlier at the centre (Mon 23 Nov against Fri 27 Nov), and a smaller estimate with less uncertainty. Scope A keeps the choice open: the build order puts the R1 core first, so he can still choose to hand over the core at checkpoint C (section 6), at the cost of a customer test cycle running while the build continues.
5. Risks of scope A: the larger estimate has no velocity behind it; EPIC-08 (12 to 16 h) is the largest and least certain block; alerts can only be tested against a capturing mail server until Accucut IT names an SMTP service (Q-18).

He decides; nothing is moved until he answers Q-34. The proposal is input to his choice, and neither date is adopted (DL-004).

## 3. How the dates were built

### 3.1 Demand (effort, estimate)

Effort per epic includes development, the three reviews and QA for each story, and excludes waits for a human. The v0.1 figures are kept; the changes are the confirmed items brought into the core.

| Epic | Stage | Effort (h) | Midpoint |
|------|-------|-----------|----------|
| EPIC-01 Foundation, access, confidentiality | R1 core | 4 to 6 | 5 |
| EPIC-02 Masters, incl. FR-018 "Not applicable" (+0.5 to 1) | R1 core | 4.5 to 7 | 5.75 |
| EPIC-03 Registry and calculation engine, incl. FR-030 quantity roll-up (+2.5 to 4; v0.1 said 2 to 3 for the older rule) and the BN divisor change | R1 core | 9.5 to 14 | 11.75 |
| EPIC-04 Tasks and queues | R1 core | 3 to 5 | 4 |
| EPIC-05 Estimate workspace | R1 core | 10 to 14 | 12 |
| EPIC-06 Cost review and approval | R1 core | 5 to 7 | 6 |
| EPIC-07 Excel export | R1 core | 5 to 7 | 6 |
| EPIC-10 Experience, brand, delivery (E2E, accessibility, Docker, README, tags) | R1 core | 5 to 7 | 6 |
| **R1 core (scope B)** | | **46 to 67** | **56.5** |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 |
| EPIC-08 Admin configuration | R2 | 12 to 16 | 14 |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 7.5 to 10.5 | 9 |
| **Scope A total** | | **71.5 to 103** | **87.25** |

### 3.2 Elapsed-time model

Effort is converted to working days at 8 hours a day (the unit the delivery lead used). Each human point is a number of working days during which agents on that thread wait. Weekends are not worked; no holidays are assumed (3.5).

| Input (estimate) | Low | Central | High | Why |
|------------------|-----|---------|------|-----|
| Human wait W at each of four points: reply on Q-32 (a), (b) for G2 (DL-005; before DL-004 this point was the Q-34 reply, which now falls inside the G3 review wait), G3 review, master data defaults (TR-009 stop), G8 sign-off, in working days | 0.5 | 1 | 1.5 | He is the only human; his replies on 2026-10-31 and 2026-11-01 came within hours (Jira comment times), which is thin evidence, so the central value is one working day |
| G2 close and PRD finalised, days | 0.3 | 0.5 | 0.75 | 2 to 3 h of work (v0.1) |
| UX and architecture in parallel, days | 0.75 | 0.9 | 1.0 | 6 to 8 h; the longer of the two sets the time (v0.1) |
| G3 fixes after his review, days | 0.25 | 0.5 | 0.75 | Estimate |
| Backlog, G4 and docs PR (runs while the master data defaults are awaited), days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1); the TR-009 stop costs max(W, this) |
| Merge wait M per dependency stage, days | 0.25 | 0.5 | 1.0 | See 3.4 |
| Close-out before the G8 wait: release notes, G8 pack, README check, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| Dependency stages that gate on a merge | 4 (scope B), 5 (scope A) | | | EPIC-01; then EPIC-02, 03, 04; then EPIC-05; then EPIC-06, 07 (EPIC-10 alongside); scope A adds R1+ and R2 as one more stage |

Elapsed working days = [W + G2] + UX/architecture + [W + fixes] + max(W, backlog) + effort / 8 + stages x M + close-out + W.

| Scope | Case | Effort | Elapsed working days | Completion |
|-------|------|--------|----------------------|------------|
| B | Low | 46 h | 10.55 | Mon 2026-11-16 |
| B | **Central** | 56.5 h | 15.56 | **Mon 2026-11-23** |
| B | High | 67 h | 21.62 | Tue 2026-12-01 |
| A | Low | 71.5 h | 13.99 | Thu 2026-11-19 |
| A | **Central** | 87.25 h | 19.91 | **Fri 2026-11-27** |
| A | High | 103 h | 27.12 | Wed 2026-12-09 |

Central-case milestones (scope A, the same order serves scope B up to the R1 core): pre-development ends Fri 2026-11-06 (G2 Mon 2 Nov; UX and architecture Tue 3 Nov; his G3 review Wed 4 Nov; G3 fixes and the master data request Thu 5 Nov; defaults and G4 Fri 6 Nov); development starts Mon 2026-11-09; **R1 core complete Thu 2026-11-19**; stretch complete Fri 2026-11-20; R2 complete Thu 2026-11-26; G8 sign-off Fri 2026-11-27.

### 3.3 What the human waits are assumed to be

- **G3 (human):** the package is ready at the end of the UX and architecture day; he reviews it in W working days; fixes follow; development cannot start before approval.
- **TR-009 master data stop (human):** asked after G3 approval, before development. The backlog, G4 and docs PR work runs during that wait, so the stop costs W or the backlog time, whichever is longer. If he asks agents to start with invented placeholder data this changes nothing here; he said development waits for his defaults (AQP-10).
- **Docs PR (BLK-01):** assumed created by hand or by a fixed token and merged during the master data stop, so story branches can start. If this is not resolved, development does not start on the dates above; each working day lost here moves every later date by one working day.
- **Code PR merges (`MERGE_POLICY` = docs-auto, code-human; one human merge per story):** the story count is not known yet. The model does not count PRs. It assumes the delivery lead merges ready PRs at least once a working day, that agents work on independent stories while a merge waits, and that only a dependent stage waits: M per stage (0.25, 0.5, 1.0 working days) for 4 stages in scope B and 5 in scope A, which adds 1 to 4 days in B and 1.25 to 5 days in A. A wait longer than a working day on a stage boundary is the main way the high case arises.
- **G8 (human):** W working days after the close-out work.
- **Clock:** the clock does not stop at any human point; every wait above is inside the dates. This answers OQ-PM-01 for the dates.

### 3.4 Sensitivity (central effort, other inputs central)

| Change | Scope B date | Scope A date |
|--------|--------------|--------------|
| Central case | Mon 2026-11-23 | Fri 2026-11-27 |
| Every human wait 0.5 day | Thu 2026-11-19 | Thu 2026-11-26 |
| Every human wait 1.5 days | Wed 2026-11-25 | Tue 2026-12-01 |
| Every human wait 2 days | Fri 2026-11-27 | Thu 2026-12-03 |
| Merges do not wait (M = 0) | Thu 2026-11-19 | Wed 2026-11-25 |
| Each merge stage waits 1 day | Wed 2026-11-25 | Wed 2026-12-02 |
| Effort at the low end, waits central | Fri 2026-11-20 | Wed 2026-11-25 |
| Effort at the high end, waits central | Tue 2026-11-24 | Tue 2026-12-01 |
| Open Q-32 details answered differently (0 to 2 h of build effort, PRD section 9.1; this is effort, not price) | at most 1 working day later | at most 1 working day later |

### 3.5 Holidays (OQ-PM-02)

Holidays are unknown and are **not assumed**: every date above counts Monday to Friday with no day lost. Treatment: each weekday on which the team cannot work, or on which the delivery lead cannot answer, moves every later date by one weekday. For three lost weekdays the central dates become **Thu 2026-11-26 (B)** and **Wed 2026-12-02 (A)**. As general knowledge, not verified, early to mid November 2026 may include Diwali-related closures in India; the delivery lead says which days apply and the dates are re-issued.

### 3.6 Can 2026-11-13 be reached?

Scope B reaches Friday 2026-11-13 only if all of these hold together: effort lands at or below the low end (46 h); every human point is answered within about a quarter of a working day; merges never wait; and no day is lost. The model gives 8.5 working days for that, which ends Thursday 2026-11-12. My own low case (waits of half a day) ends Monday 2026-11-16. I do not consider the combination realistic. Scope A cannot reach 2026-11-13 under any case modelled (best case Thursday 2026-11-19).

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The v0.1 analysis compared effort with the hours left after overhead. The date is now a target and not a blocker, so the analysis states how far each scope is from it and what the fit rule says.

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| B (R1 core) | 46 to 67 h | 10.55 / 15.56 / 21.62 | Misses by 1 to 12 working days; central 6 days over |
| A (whole SPEC less offline) | 71.5 to 103 h | 13.99 / 19.91 / 27.12 | Misses by 4 to 18 working days; central 10 days over |
| v0.1 comparison | R1 core 43 to 62 h without FR-018 and FR-030 | n/a (80 h window, waits counted in hours) | Borderline |

What changed from v0.1: (1) FR-030 and FR-018 are confirmed and enter the core (+3 to 5 h); (2) human waits and merge waits are now counted in working days instead of a fixed 21 to 33 h overhead; the v0.1 overhead assumed the G3 review and the master data stop took 2 to 6 hours each.

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope B: Musts are about 96 to 98 % of the effort (Shoulds FR-041 and FR-071, about 1 to 2 h). Scope A: about 88 to 90 % (about 7.5 to 12 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088). The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a deviation for `master` and the delivery lead to weigh.

## 5. Releases and build stages

| Stage | Name | Epics | What a user can do at the end | Brief goals |
|-------|------|-------|-------------------------------|-------------|
| **R1 core** | Assign, enter, calculate, approve, export | EPIC-01, 02, 03, 04, 05, 06, 07, 10 | Admin creates users and masters; Lead assigns a task; Engineer enters a part tree, presses Calculate, sees no cost; Lead views costs and formulas, approves and locks a price, unlocks if needed; Lead downloads the Excel file in the worksheet layout; the bell and Overdue tab show late work | GOAL-01, 02, 03, 04, 07 in full; GOAL-05 in part (no e-mail); GOAL-06 in part |
| R1+ stretch | Built after the core | FR-014, 035, 039, 054, 057, 088 | Propagation prompt for process defaults, Lead default filter, task filters, autosave, completeness count, loading and empty states | Same |
| **R2** | Admin control and alerts | EPIC-08, EPIC-09 (FR-003, 006, 019, 040, 072 to 084) | Admin changes fields and formulas with re-lettering, versions, checkpoints and change history; e-mail alerts and the 11:00 IST digest; password reset by e-mail; task reassign | GOAL-05, GOAL-06 in full |
| R3 | Later | EPIC-11 (FR-090, 097) | Dark mode; UI-sample extras. Drawing input only if scheduled | GOAL-07 |
| **R-OFF** | The next release (confirmed) | EPIC-12 (FR-092), outline only | Use without internet; meaning and design open | GOAL-01 |

Under scope A the first three rows are one hand-over. Under scope B the first row is the hand-over and the second and third follow (OQ-PM-06 asks where R-OFF sits among them). Release moves since v0.1 are PROPOSED in PRD section 6.3: FR-030 and FR-018 into the core, FR-018 from Should to Must, FR-092 to R-OFF.

SPEC §14 acceptance criteria by stage: **R1 core** meets 1, 2, 3, 4, 5, 12, 13, 14 and 10 if FR-014 is reached; **R2** meets 6, 7, 8, 9, 11.

| SPEC §13 step | Stage | Note |
|---------------|-------|------|
| 1 Scaffold, auth, users, roles, shell, About | R1 core (EPIC-01) | |
| 2 Masters, Settings | R1 core masters (EPIC-02); Settings and alerts switch in R2 | |
| 3 Registry, seed, formula engine | R1 core (EPIC-03) | Engine and seeded registry; the item-quantity roll-up needs a design decision by the architect (Q-32) |
| 4 Tasks, queues, overdue, bell | R1 core (EPIC-04) | |
| 5 Estimate workspace | R1 core (EPIC-05) | |
| 6 Cost view, approval, lock, unlock | R1 core (EPIC-06) | |
| 7 Excel export | R1 core (EPIC-07) | |
| 8 Admin configuration UI | R2 (EPIC-08) | |
| 9 E-mail alerts and scheduled jobs | R2 (EPIC-09) | SMTP details do not exist yet (Q-18) |
| 10 Polish, accessibility, E2E, Docker, README | R1 core for delivered screens (EPIC-10); repeated for R2 screens | Responsive and accessible are built in from step 1 |

## 6. Checkpoints and cut ladder

Checkpoints re-issue the date from actuals. Method: actual hours for the finished epics divided by their estimate gives a ratio; remaining effort x ratio / 8 + remaining stages x M + remaining human waits gives the new date. This is the first time any velocity exists.

| Checkpoint | When (central) | Question | Decision |
|------------|----------------|----------|----------|
| A | First epic complete (EPIC-01, about Tue 2026-11-10) | Ratio of actual to estimated hours | Re-issue the date for the chosen scope |
| B | EPIC-05 complete (about Tue 2026-11-17) | Is the core on track; has Q-32 changed the roll-up? | Re-issue; decide whether to build the stretch |
| C | R1 core complete (about Thu 2026-11-19) | Hand over the core now, or continue to R2 (scope A)? | His decision, logged by `master` |

### 6.1 Cut ladder (only if he wants an earlier hand-over; each is a scope decision for him)

| Step | Cut | Hours saved (estimate) | Outcome lost |
|------|-----|------------------------|--------------|
| 0 | Do not start any stretch item | 6 to 9.5 | R1+ items |
| 1 | Move FR-063 Unlock and the Closed-to-Open reopen (FR-038 part) to a later stage | 1 to 2 | An approved estimate cannot be reopened |
| 2 | Move FR-058's six-stage accordion and formula display (and FR-060) to a later stage | 1 to 2 | Lead cannot see the arithmetic behind a price |
| 3 | Move FR-047 part pictures and export column C images to a later stage | 2 to 3 | Parts not identified visually; SPEC §14.12 image check fails |

Steps 1 to 3 save 4 to 7 h (about 0.5 to 0.9 working day). Not cut candidates: cost confidentiality (FR-007, 008), the calculation and its tests (FR-020 to 031), approve and lock (FR-062), the export itself (FR-066 to 070), responsive and accessibility tests (FR-085, NFR-016, NFR-018).

### 6.2 Process effects the estimate does not capture

- Parallel work is not assumed. After EPIC-01, EPIC-02, 03 and 04 are independent, and EPIC-06 and 07 are independent after EPIC-05; parallel developers would shorten elapsed time, not effort, and human merges would still serialise.
- Story count and size are not known until the backlog exists (G4); the merge model should be recalibrated then.
- The docs PR cannot be created today (BLK-01).

## 7. Human gates, stops and who waits for whom

| Point | Type | Effect on the plan |
|-------|------|--------------------|
| Q-32 (a), (b) answer (or explicit acceptance of ASSUMPTION-48) and the master's G2 attempt 2 | Delivery lead, then `master` (not a human gate: `HUMAN_APPROVAL_POINTS` = G1, G3, G8) | UX and architecture start after G2 attempt 2 returns GO or CONDITIONAL GO. This is the one wait W for G2 already in the central case, so an answer on 2026-11-02 costs nothing against the dates |
| Q-34 answer (scope) | Delivery lead, at G3 approval (DL-004) | No wait added: the G3 approval stop already exists. Does not hold G2 |
| G3 | **Human** | One wait W |
| Master data stop (TR-009, HOLD-01) | **Human**, process stop outside `CLAUDE.md` | One wait W, overlapped with backlog and G4 |
| G4 | `master` | Needs the docs PR (BLK-01) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | Modelled as M per dependency stage |
| G8 | **Human** | One wait W; its sign-off day is the completion date |

## 8. Dependencies by stage

| Stage | Dependency | Owner | Status |
|-------|-----------|-------|--------|
| R1 core | Answer to Q-32 (a), (b) and G2 decision | Santhosh, master | Open |
| R1 core | Answer to Q-34 (scope for the date; DL-004) | Santhosh | Open; due G3 approval; does not hold G2 |
| R1 core | Master data defaults (TR-009) | Santhosh | Stop after G3 |
| R1 core | Roll-up details Q-32: (a), (b) before G2; (c), (d), (e) before G3 and the roll-up design (DL-005) | Santhosh | Open; ASSUMPTION-48 in force as the analyst's reading, not accepted by him |
| R1 core | Hosting details, web address, IT contact (Q-18) | Santhosh, IT | Open, due G3 |
| R1 core | Cleaned sample worksheet (Q-30); export totals (Q-31); decision on the repository and the two tracked files (RISK-006) | Santhosh | Open. The original sample is already tracked on `origin/master` since c7576f0 in a public repository; structure only is read from it |
| R1 core | Docs PR (BLK-01) | Santhosh | Open |
| R2 | SMTP service and sender | Accucut IT | Open; alerts tested against a capturing mail server until then |
| After the date | Customer testing, acceptance, change requests; go-live, training, parallel run (TR-003 to TR-005) | Santhosh, Accucut | Not in the dates |
| R-OFF | Meaning of offline, hosting design | Santhosh | Open; settled when the release is planned |

## 9. Effect of each open item on this plan

| Item | If answered as assumed | If answered differently |
|------|------------------------|-------------------------|
| Q-34 scope (his choice, due G3 approval) | Scope A dates (neither date is adopted until he chooses) | Scope B dates; OQ-PM-06 arises |
| Q-32 (a) to (e) | ASSUMPTION-48 stands (the analyst's reading, not accepted by him) | **Build effort** 0 to about 2 h and at most one working day. **This is effort, not price.** The price effect is separate and can be large: a factor of 3 in the FR-030 example under (a), 58.6 % lower on the sample under (b1) children only, about 16 % higher under (e2) (PRD section 9.1). That is why (a) and (b) hold G2 and no answer is assumed in the plan |
| Q-33 values | ASSUMPTION-49 stands | Seed data and FR-018 change; under 1 h |
| Q-31 per-item totals | Row 2 only | 1 to 2 h; FR-069 changes |
| Q-18 hosting details | Docker Compose, SMTP later | Deployment and mail settings change; effect on hours not estimated |
| OQ-PM-02 holidays | None | Each lost weekday moves every later date by one weekday |

## 10. Change Log

| Version | Date | Change | Reason |
|---------|------|--------|--------|
| 0.1 | 2026-11-01 | First proposal | G2 input; Q-29 |
| 0.2 | 2026-11-01 | UNC items resolved and labels removed; realistic completion date added for two scopes with a proposed answer to Q-34; elapsed-time model with human and merge waits; fit analysis and Must share restated; FR-030 and FR-018 into the core (PROPOSED); offline set to the next release | AQP-1 10441, 10443; AQP-9 10442; AQP-13 10445; AQP-11 10444; AQP-12 10446 |
| 0.3 | 2026-11-01 | Q-32 shown as open with (a), (b) due G2 and (c), (d), (e) due G3, no answer applied; the "0 to 2 h" stated as build effort, not price, with the price ratios; Q-34 shown as his choice due G3 approval, both dates unadopted (DL-004, ASSUMPTION-50); the G2 human wait relabelled from the Q-34 reply to the Q-32 (a), (b) reply (same wait, **no date changed**); sample-file statement added (tracked on `origin/master` since c7576f0, RISK-006); "not applicable" labelled "confirmed on list wording" (DL-001) | G2 attempt 1 NO-GO, remediation 4 and 5; DL-001, DL-004, DL-005 |
