# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.18 (Draft; 2026-11-05: **AQP-199 (PR #86) missed its proposed targets and is accepted as built with restated ACs; the CI targets are staged; a shard story (3 points) is placed first in the stretch** (new 3.11). Measured: required job 468 s to 411 s (-12 %), stage 12 313 s to 249 s (-20 %), 0 flaky. **Sprint 1 stays 55 of 55 committed.** Effort +1.5 to +2.5 h in EPIC-10: scope A is **96.0 to 144.5 h, central 120.25 h**. **Dates, upper bound:** central 21.03 working days (Mon 2026-11-30 or Tue 2026-12-01), high end Thu 2026-12-17 or Fri 2026-12-18; the upper-bound additions since v0.14 now stack, so the sprint 1 review should replace them with a re-run on actual merge dates. Dates are estimates and none is adopted). Version 0.17 (Draft; 2026-11-05: **DEF-015 (AQP-206), the CI install stall, is placed as its own defect fix after AQP-199, not as a task inside it** (master DL-100; new 3.10). It is not pointed and not counted in the 55; AQP-199 stays at 3 points and committed stays 55 of 55. **Effort:** +1.0 to +1.5 h in EPIC-10 (estimate): scope A is **94.5 to 142.0 h, central 118.25 h**. **Dates, upper bound:** it gates no story, so it adds effort only: with AQP-199 on the chain (the trigger fired, DL-099) the central reads 20.78 working days, Mon 2026-11-30, and the high end Thu 2026-12-17. The simulation was not re-run. Dates are estimates and none is adopted). Version 0.16 (Draft; 2026-11-05: **STORY-10.14, the CI-time cut (AQP-199, 3 points proposed), is placed and taken into the date model** (master DL-095, RISK-023; new 3.9). **Placement:** sprint 1, first in the stretch, Ready before the sprint 1 review and built in the first idle merge wait; committed stays 54 of 55. **Effort:** +1.5 to +2.5 h in EPIC-10 (estimate): scope A is **93.5 to 140.5 h, central 117.0 h**. **Dates, upper bound:** built in a wait it adds its effort only (central 20.12 working days, which v0.15 already read as Fri 2026-11-27 or Mon 2026-11-30); if master's 9-minute trigger fires first and it lands on the chain, the high end reads Thu 2026-12-17. The simulation was not re-run. Dates are estimates and none is adopted). Version 0.15 (Draft; 2026-11-04: **STORY-10.13, the first-load JavaScript cut (AQP-188, 5 points), is taken into the date model** (DL-081; new 3.8). **Effort:** +2.0 to +3.0 h in EPIC-10 (estimate): scope A is **92.0 to 138.0 h, central 115.0 h**. **Dates, upper bound:** DL-080 puts AQP-169 and AQP-188 in series before the stories they gate, so both merge waits now count (3.7 had AQP-169 filling a wait): central **Fri 2026-11-27** (was Thu 2026-11-26, and only 0.13 day from the boundary), low Fri 2026-11-20, high **Wed 2026-12-16** (was Fri 2026-12-11, outside the stated range by up to three working days). The simulation was not re-run; sections 2.2, 3.1, 3.2, 3.6 and 4 still carry the v0.14 figures until checkpoint A, and 3.8 is the difference. Dates are estimates and none is adopted). Version 0.14 (Draft; 2026-11-03: **STORY-10.10, the NFR-009 guards (AQP-169, 5 points), is taken into the date model** (DL-058; new 3.7). **Effort:** +1.5 to +2.5 h in EPIC-10 (estimate): scope A is **90.0 to 135.0 h, central 112.5 h**. **No stated date moves on the arithmetic:** central Thu 2026-11-26, range Thu 2026-11-19 to Fri 2026-12-11, and the committed milestone Mon 2026-11-09 all hold. **The high end holds by only 0.06 working day, less than the model's noise, so read it as Fri 2026-12-11 or Mon 2026-12-14.** The simulation was not re-run (the script was not kept): the figures are the v0.13 outputs plus the added effort as an upper bound. Dates are estimates and none is adopted). Version 0.13 (Draft; master data names and units corrected by the delivery lead (SPEC v1.13, AQP-1 10672): no effort, scope or date changed. A plating cost calculation is recorded as backlog candidate BC-01 in 5.1: a possible later change, not Release 1, not estimated. Version 0.12: G4 attempt 1 remediation 4 and the answers of 2026-11-02 applied. **The merge model is recalibrated** from the story graph: 89 candidate stories (18 in Jira), a chain of 21 stories in a line, and sprint 1's own chain of 8 to 9 stories, which means 7 merge waits against the 2 stage waits modelled before. The ways of working that change the date are set out in 3.3 for the delivery lead to choose. **Effort:** +0.5 to +0.75 h in EPIC-10 for the guided `clear-copies.sh`: scope A is **88.5 to 132.5 h, central 110.5 h**. **Dates (the way of working as it is today, one PR per story merged by the delivery lead within half a day):** central **Thu 2026-11-26** (unchanged), range **Thu 2026-11-19 to Fri 2026-12-11**; the high end moves a week because the model now charges every merge wait. The date depends on how fast each PR is merged: 0.25 day gives Tue 2026-11-24, 1 day gives Wed 2026-12-09. All of this is an estimate and none of it is adopted by the delivery lead) |
| Owner | product-manager |
| Date | 2026-11-03 |
| Status | **Estimates. Not adopted.** The scope is decided (scope A). Their reply says "prefer" and does not mention dates, so no date in this plan is theirs. These dates supersede the v0.11 to v0.6 dates and the v0.4 dates posted on [AQP-12](https://sankumar76.atlassian.net/browse/AQP-12) (comment 10478) |
| Companion | `docs/02-product/prd.md` v0.12 (FR, NFR, readings, epics, release moves in section 6.3, decisions in sections 12.2 and 13.4 to 13.7) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed | AQP-2 |
| Start date 2026-11-02 (Monday); 10 working days at 8 hours a day | Confirmed | AQP-2 |
| End date 2026-11-13 (Friday) | Confirmed **as a target, not a fixed constraint**. The delivery lead asks for a realistic date and says the date is not a blocker | AQP-1 10441 (h); AQP-12 10446 |
| What the date is for | Answered (Q-29): to complete development and hand that version to their customer for testing, acceptance and new change requests; the next steps are decided afterwards. It is not production go-live | AQP-12 10446 |
| Scope behind the date | **Decided: scope A**, in their own words: "I prefer the scope A for the intial release." (spelling as written). Scope A = R1 core + R1+ stretch + R2 (EPIC-01 to EPIC-10), built as one hand-over; offline use, dark mode and the UI-sample extras are outside it. They did not mention dates | AQP-12 10488 (D-14) |
| Work already done | G2 attempt 2 CONDITIONAL GO, UX spec v0.4 and screens, architecture v0.8, the inception backlog (epics and the consistency report) and the master's G3 decision (CONDITIONAL GO, 16 conditions) all exist; the delivery lead approved G3 (AQP-1 10491) | Gate log; project state |
| Human approval stops | Lifted by their instruction "dont ask me for any approvals except for git merge. But I need to view the result after each iteration (and gate reviews if required)" (AQP-1 10495; DL-010). **G8 does not wait for a separate sign-off**; a NO-GO still stops the run; code pull request merges and deployment stay human | DL-010 |
| How code is merged | Each code PR is merged by the delivery lead (`MERGE_POLICY` docs-auto, code-human). **How fast they merge, and in what way, now decides the date more than the effort does** (3.3). They choose the way; this plan uses today's rule | CLAUDE.md §1a; G4 attempt 1, remediation 4 |
| Master data (HOLD-01) | **Met.** The Admin holds and loads the values and types them in at first use; no values were given; development uses invented placeholders. **No wait is modelled for it** | AQP-10 10512 (D-23) |
| Holidays and days away | **None between 2026-11-02 and 2026-12-09**, in their word. No allowance is modelled; OQ-PM-02 is closed | AQP-1 10555 (D-35) |
| Offline use | Decided: the next release, not Release 1. What it means and the remaining hosting details are open (Q-18). **Not estimated** | AQP-11 10444; AQP-1 10441 (e) |
| Cost rule | **Settled on 2026-11-02 as the worksheet's own rule:** QTY per Assy is the count of the part for the whole order, typed on every row; a row's BG is that count times the cost of one piece; BL = SUM(BG) over every row; no parent sum, no multiplying down the tree. It replaces the every-level rule of v0.6 to v0.8. The portal now agrees with the worksheet at any quantity. A parent shows only its own row. Q-35 (a) is 1000 (their number; their working "500 x 2" does not match the example and the number is taken as the answer) | AQP-26 10533 to 10537; AQP-14 10510; AQP-1 10542; D-12, D-21, D-25 |
| Warn on a QTY per Assy of 0 | **Decided for every 0**, with one wording ("That row will cost 0"), no minimum and no block: "Warn" (AQP-15 10511), "Yes" for a part with nothing below it (10527), "Keep warning" (10543). FR-104, 3.5 to 5.25 h in the figures | D-22, D-26 |
| Cleared figures and the download | Every figure clears on any input change; the Excel download is refused until a calculation is current; the earlier approved price stays, labelled, until approved again or removed by the Admin after a cancel | AQP-1 10545, 10552, 10553, 10554 (D-28 to D-30) |
| Picture, rate notice, backups | The Part Model picture is optional (D-31). A Lead is told when rates changed before approval (D-32). The Settings page shows a Last backup line; copies stay on the same server; a server or disk failure loses the live data and every backup (D-33). **The Admin holds the backup key, is given server access and runs the restore**, which replaces "the Admin only checks" (their words, relayed: "Admin holds hte backup key"; "Admin should be given teh server access and run the restore") | AQP-1 10546, 10548, 10549, 10550, 10559, 10560 |
| "Not applicable" in the Material and Treatment lists | Offered to Engineer, Lead and Admin; the words show on the part to everyone; zero values and master-list entries stay hidden (D-27, narrowing D-17) | AQP-1 10544 |
| Export totals | One total only; the total Tool Cost is shown (the export differs from the sample on purpose) | AQP-1 10490 (D-16) |
| Usability test | 2 Engineers, 2 Leads and 1 Admin, no names, on built pages during the customer's acceptance, after the date | AQP-1 10556; CR-20 |
| Sample workbook | Tracked on `origin/master` since c7576f0 in a repository that stays public by the delivery lead's decision (D-13). They state the workbook has no real data; that is their statement, not verified. Rule unchanged: no sample cell value in documents, Jira or GitHub (NFR-006) | AQP-1 10465 |

Every hour, day and date below is an **estimate** by the product manager. **There is no team velocity behind it**: no story has been built by this team on this stack, and the method (relative size converted to hours, then to working days at 8 hours a day) is judgement, not measurement. Dates are re-issued after the first completed epic (section 6).

## 2. The realistic development completion date (estimate, not adopted)

### 2.1 What the date means

"Development completion date" = the working day on which the master records the G8 release-readiness decision (GO or CONDITIONAL GO) with the last code pull request merged, so the version, its release notes and its install steps are ready to hand to their customer. **The delivery lead's sign-off is not part of the definition and no wait for it is modelled** (DL-010): the orchestrator reports the G8 result and says that no separate sign-off was requested, so they can still stop it. A NO-GO stops the run and the date then does not hold. The merge of each code pull request is a human act and stays inside the dates (M, 3.2). Deployment is a human act by their IT person and is not in the date. Not included in the date: the customer's testing and acceptance (which includes the usability test), change requests, go-live, training, the parallel run (TR-003 to TR-005), and the offline release.

### 2.2 The date for scope A (estimates)

| | **Scope A (adopted)**: whole SPEC except offline, dark mode and the UI-sample extras |
|---|---|
| Contents | R1 core + R1+ stretch + R2: EPIC-01 to EPIC-10, 101 FRs (78 + 6 + 17). Excludes dark mode (FR-090), the UI-sample extras (FR-097) and offline use (FR-092), which are not estimated; if the delivery lead wants any of them inside the date they say so and the product manager estimates them |
| Development effort (estimate) | 90.0 to 135.0 h, central 112.5 h (v0.13: 88.5 to 132.5 h, central 110.5 h; the difference is STORY-10.10, 3.7; v0.11: 88 to 131.75 h, central 109.875 h). **Not in:** the forced password change after an Admin-set password (OQ-UX-15) and the password step on an Admin hand-over (OQ-UX-17), under 0.75 h together (estimate); a refused SMTP sign-in (about 4 h, architect). See the sensitivity rows in 3.4 |
| **Central date** | **Thursday 2026-11-26** (v0.11: the same) |
| **Range** | **Thursday 2026-11-19 to Friday 2026-12-11** (v0.11: to Friday 2026-12-04) |
| Working days from 2026-11-02 | central 19 (range 14 to 30); unrounded 13.43 / 18.56 / 29.94 (the v0.13 simulation, 13.24 / 18.31 / 29.63, plus the effort of STORY-10.10 as an upper bound, 3.7) |
| Assumes | The way of working of today: one PR per story, and the delivery lead merges each within 0.25 / 0.5 / 1 working day (low / central / high). Other ways are in 3.3 |
| Misses the 2026-11-13 target? | Yes in every case modelled (3.6) |
| SPEC §14 criteria met at hand-over | all except any that touch offline |

The range is "everything goes well" to "everything goes slowly" taken together: low = low effort estimate and a quarter-day merge; high = high effort estimate and a full-day merge. A date near the central value is the most likely single outcome of this model, and the model is itself uncertain (no velocity). **The central date is steady, but it hides a steep dependence: at a half-day merge the waits cost about 2.6 working days; at three-quarters of a day, Wed 2026-12-02; at a full day, Wed 2026-12-09.** The high end moves from Fri 2026-12-04 to Fri 2026-12-11 for that reason, and not because the effort grew. Part of the central date is luck of arrangement: while a story waits to be merged, the agents pick up an independent story, and the model finds enough of them at the centre (3.2). The first sprint is where that fails: its stories are almost one chain. The R1 core alone, handed over at checkpoint C, would end about Wed 2026-11-25, only a day earlier (section 6).

### 2.3 How the dates moved since v0.11

| Step | Working days (low / central / high) |
|------|--------------------------------------|
| v0.11, 88 / 109.875 / 131.75 h, five stage waits | 13.75 / 18.18 / 24.22 (Thu 2026-11-19 / Thu 2026-11-26 / Fri 2026-12-04) |
| +0.5 to +0.75 h for `clear-copies.sh` (central +0.625 h): 88.5 / 110.5 / 132.5 h, same model | +0.06 / +0.08 / +0.09 = 13.81 / 18.26 / 24.31 |
| Replace the five stage waits (1.25 / 2.5 / 5 days) with the waits found by running the 89 stories through their dependencies (0.67 / 2.55 / 10.31 days) | -0.57 / +0.05 / +5.32 |
| **v0.12** | **13.24 / 18.31 / 29.63 (Thu 2026-11-19 / Thu 2026-11-26 / Fri 2026-12-11)** |

The central waits barely change (2.5 days before, 2.55 now), but not for the reason the old model gave: the old model charged one wait at each of five stage boundaries, and the new one charges a wait at every merge that something depends on, then lets independent stories fill part of it. At a quarter-day merge almost all of it is filled (0.67 days); at a full day almost none is (10.31 days). Nothing else changed: the G3 rework term, the backlog term and the close-out keep their values. The v0.6 credit for steps completed on 2026-11-01 (2.90 days) is unchanged; if the delivery lead would rather not count it, the central date is Tue 2026-12-01 (3.4).

### 2.4 Risks of scope A

The estimate has no velocity behind it; EPIC-08 (11.75 to 15.75 h) and now EPIC-06 (11.1 to 15.9 h, with cancel approval and remove price) are the largest and least certain blocks; the architect's hours are the architect's estimate, not a measurement, and his stated total for the answers of 10546 to 10554 was 0.25 h above the sum of his own rows at each end, which is now dropped (3.1); the scaffold, CI gates, secret scan and design tokens were never itemised (3.1); the merge model is new and rests on an equal split of each epic's hours over its stories (3.2); the Engineer now types the whole-order counts and nothing on the screen flags a wrong one (ARCH-R6), which no hour estimate covers; alerts can only be tested against a capturing mail server until the Outlook account is named (Q-18), and the OAuth sign-in to Outlook is designed and unproven (RISK-014); the disk size is unnamed (OQ-ARCH-03), no restore has been tried and only the Admin's rehearsal will show that the Admin can do it from the README alone; both block go-live, not the date.

## 3. How the dates were built

### 3.1 Demand (effort, estimate)

Effort per epic includes development, the three reviews and QA for each story, and excludes waits for a human. Nothing is built, so the change of the quantity rule costs no rework. The v0.9 changes are the architect's lists (architecture sections 16.12 and 16.13, development with tests, no velocity behind them). Where the architect gave one range for several epics the product manager splits it in eighth hours; that split is an estimate and does not change the total.

| Epic | Stage | Effort (h) | Midpoint | Change from v0.8 |
|------|-------|-----------|----------|------------------|
| EPIC-01 Foundation, access, confidentiality (includes the scaffold and application shell as sized for SPEC step 1) | R1 core | 5.75 to 9.5 | 7.625 | 0 |
| EPIC-02 Masters and settings (incl. FR-018 1.5 to 3; FR-105, the Last backup line, 0.25 to 0.5) | R1 core | 5.75 to 9.5 | 7.625 | +0.25 to 0.5: FR-105 |
| EPIC-03 Registry and calculation engine (FR-030 is now a `SUM(BG)` seed and its cases, 0.5 to 0.75) | R1 core | 9 to 13.625 | 11.3125 | -2.25 to -3.125: the quantity step, the multiplied walk and ROLLUP go (-2 to -3.25); Warn re-sized (-0.25 to 0); picture optional (0 to +0.125) |
| EPIC-04 Tasks and queues | R1 core | 3.25 to 5.75 | 4.5 | 0 |
| EPIC-05 Estimate workspace | R1 core | 11.75 to 17.125 | 14.4375 | -0.25 to -0.625: the parent and item figures go; one clearing rule; Warn re-sized; picture optional |
| EPIC-06 Cost review and approval | R1 core | 11.125 to 15.875 | 13.5 | +3.375 to +4.375: rate notice +1 to 1.5; cancel approval and remove price +2.75 to 4, with the password step-up they use, which ships here and is reused by the four R2 actions (no change to the total); latest approved price +0.25; less the sums and the item table |
| EPIC-07 Excel export | R1 core | 5.625 to 7.875 | 6.75 | -1.375 to -2.375: no out-of-date file, markers or dialog; no file until current; fewer figures to show. The file saving is read as every other saving is: -0.25 low, -0.5 high |
| EPIC-10 Experience, brand, delivery (incl. the CI gates, secret and repository scan and design tokens, which no estimate itemised; the guided restore command, its README and tests, 1 to 1.5; the guided `clear-copies.sh`, 0.5 to 0.75; the NFR-009 guards of STORY-10.10, 1.5 to 2.5) | R1 core | 9.5 to 15 | 12.25 | v0.14: +1.5 to +2.5 for STORY-10.10 (3.7). v0.12: +0.5 to +0.75: `clear-copies.sh` (architecture v0.11, 9.5), on top of the restore command and the free-space check |
| **R1 core** | | **61.75 to 94.25** | **78** | v0.13: 60.25 to 91.75 (76); +1.5 low, +2.5 high (STORY-10.10). v0.11: 59.75 to 91 (75.375); +0.5 low, +0.75 high |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 | 0 |
| EPIC-08 Admin configuration | R2 | 11.75 to 15.75 | 13.75 | -0.25: no ROLLUP warning on the formula check. Its password re-entry (FR-080) reuses the step-up built in EPIC-06; any shift between the two epics is inside their ranges |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 10.5 to 15.5 | 13 | 0 |
| Checked against the architect's rows | | 0 | 0 | **Closed.** The +6.5 the architect first published for 10546 to 10554 was an addition error: his rows sum to +3.75 to +6 (additions of 4 to 6.5, less the file saving of 0.25 to 0.5). No row is missing and nothing is held. The v0.9 "held" 0 to 0.5 h and the v0.10 "dropped" 0.25 h at each end are both gone |
| **Scope A total** | | **90.0 to 135.0** | **112.5** | v0.13: 88.5 to 132.5 (110.5); +1.5 low, +2.5 high (STORY-10.10). v0.11: 88 to 131.75 (109.875); +0.5 low, +0.75 high |

**Where the scaffold, CI, tokens and shell effort sits (CR-11).** Unchanged from v0.8: no hours moved between epics. The scaffold and the application shell were sized in EPIC-01 as SPEC step 1; the CI gates, the secret and repository scan and the design tokens sit in EPIC-10. Neither was ever itemised, so no separate figure exists. Stories 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) come before every EPIC-01 story, which changes the order and not the totals. Checkpoint A reads EPIC-01 with 10.01 and 10.02 and is the first place a shortfall shows. The architect confirmed the placement and says the hours are not shown to be enough.

**FR-105 moves earlier (CR-14).** Its line is built in the R1 core (EPIC-02) with the Settings page frame, whose hours stay in EPIC-09's row; the alert switch, sender and test e-mail follow in R2. The total does not change. The reason is that backups start at the first deployment and, until the line ships, the Admin has no quick sign that they ran.

**The Admin's restore (architecture 16.14).** The Admin holds the key, has server access and runs the restore with one guided command (`restore.sh`), from a README, on a limited account that Accucut IT grants (A-35, proposed). The +1 to +1.5 h is the command, its README and tests of its failure paths, all in EPIC-10. The Admin also clears old copies with one guided command, `clear-copies.sh` (+0.5 to +0.75 h, EPIC-10): it keeps the newest 4 copies, because on a 40 GB disk the 2 years of retention are "as the disk allows", with a ceiling at about 5 to 6 GB of data where only 4 copies fit (PRD NFR-013). No restore has been tried: only the Admin's rehearsal, run from the README alone, shows that the Admin can do it, and that rehearsal is a human step before go-live (3.3). The Admin's time on it is not in the hours.

Not in the hours: dark mode and the UI-sample extras (outside scope A), offline use, the two small PRD 12.2 decisions on passwords (OQ-UX-15 and 17, under 0.75 h together, estimate), and a refused SMTP sign-in (about 4 h for another transport, architect).

### 3.2 Elapsed-time model

**What changed (G4 attempt 1, remediation 4).** The v0.6 to v0.11 model charged five waits, one at each dependency stage, and counted no pull requests. The backlog now exists: **89 candidate stories** (18 in Jira, 71 still candidates), 41 links in sprint 1, and a **longest chain of 21 stories in a line** from the scaffold to the last export story. Sprint 1 alone has a chain of 9 stories (10.01, 10.02, 01.01, 01.02, 01.04, 01.07, 02.01, 02.03, 02.04; the master counts 8 to 02.03), which is **7 to 8 merge waits against the 2 stage waits** the old model gave the same span, 1.75 to 7 working days at 0.25 to 1 per wait against 0.5 to 2. A story branches from the merged base (playbook 5.2), so it cannot start until the story it depends on is merged.

**The method.** A small simulation, run for this plan (a throwaway script, not kept in the repository), takes: the 89 stories with their "Depends on" columns in the epic files, plus the 21 links the sprint plan records as confirmed in Jira; one development stream (parallel work is not assumed); each story's effort as its epic's central hours (R1+ hours added to their epics) divided equally over the epic's stories; the stories in backlog order. When a story is done its pull request is raised, and it is merged M later; the next story starts as soon as the lowest-ranked story whose prerequisites are all merged is free, and when none is, the agents wait. A story's effort already includes its three reviews and QA. The elapsed time is the G3 rework and backlog time, plus the simulated development time (effort plus waiting plus the last merge), plus the close-out.

| Input (estimate) | Low | Central | High | Why |
|------------------|-----|---------|------|-----|
| G3 conditions rework pass, in working days | 0.5 | 0.75 | 1.25 | The values stay as in v0.6 |
| Backlog, G4 and docs PR, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| **Merge wait M after each pull request, working days** | 0.25 | 0.5 | 1.0 | The delivery lead's turnaround on each PR. It was a per-stage figure before; it is now per PR, and it is the input that moves the date most (3.4) |
| Close-out before the G8 decision, days | 0.5 | 0.6 | 0.75 | 4 to 6 h (v0.1) |
| Stages that gate on a merge | not used | not used | not used | Replaced by the story graph |

| Case | Effort | M | Idle waiting (days) | Elapsed working days | Completion |
|------|--------|---|---------------------|----------------------|------------|
| Low | 88.5 h | 0.25 | 0.42 | 13.24 | Thu 2026-11-19 |
| **Central** | 110.5 h | 0.5 | 2.05 | 18.31 | **Thu 2026-11-26** |
| High | 132.5 h | 1.0 | 9.31 | 29.63 | Fri 2026-12-11 |
| v0.11 for comparison | 88 / 109.875 / 131.75 h | stage waits 0.25 / 0.5 / 1 | n/a | 13.75 / 18.18 / 24.22 | Thu 2026-11-19 / Thu 2026-11-26 / Fri 2026-12-04 |

**The table above is the v0.13 simulation output.** STORY-10.10 (v0.14) is added to it by arithmetic in 3.7, because the simulation script was not kept.

**Checks and limits.** With M = 0 the simulation gives exactly the effort plus the fixed terms (15.76 working days at the centre), so the waits are the only thing it adds. Weighting the 18 sprint-1 stories by their story points instead of an equal split moves the central by +0.3 day (18.59, the same date). The 71 candidate stories' dependencies come from the epic files and have not been validated by the product-owner; the equal split understates large stories (10.01 is 8 points and gets about an hour), which would lengthen the chain and shorten the idle time; and the simulation is lumpy, so differences below about 0.3 day are noise. There is no velocity behind any of it.

**Where the central waits fall.** Over the whole backlog the idle waiting is 2.05 days, because from the second sprint on many stories are independent and fill the waits. In **sprint 1 they do not**: the 18 stories need 2.4 working days of effort and 5.85 days elapsed (2.95 idle) at a half-day merge. At a full day the first sprint alone is near 10 days.

Central-case story milestones (merged, today's way): the 12 committed stories of sprint 1 Mon 2026-11-09 (5.4 working days); all 18 Wed 2026-11-11; Calculate (05.09) Tue 2026-11-17; Approve and lock (06.06) Fri 2026-11-20; the export download (07.04) Tue 2026-11-24; every story Wed 2026-11-25; **the master's G8 decision Thu 2026-11-26**. These follow backlog order and the stories that fill a wait, so epics do not finish one after another.

### 3.3 What the human waits are assumed to be, and the ways of working to choose from

- **G3 and HOLD-01:** over (AQP-1 10491; D-23). **G8:** no wait (DL-010); a NO-GO stops the run. **Holidays:** none to 2026-12-09 (D-35).
- **Customer testing, acceptance, the usability test and the Admin's restore rehearsal:** after the date, not in it. They need Accucut staff, whose time this plan cannot assume.
- **Code pull request merges (`MERGE_POLICY` = docs-auto, code-human):** every code PR is merged by the delivery lead, and a dependent story starts only after its prerequisite is merged. The model charges M for each, and agents work on an independent story meanwhile. **This is the one wait that is both long and theirs to change.**

**The ways of working.** The dates below use the same effort and the same simulation; only the way of merging changes. The choice is the delivery lead's, because it changes what they see and when. None is adopted, and the dates stay estimates.

| Way | How it works | Central (low to high) | What it needs or costs |
|-----|--------------|-----------------------|------------------------|
| **1. One PR per story, merged by you after each (today)** | The rule as it stands. A dependent story waits for the merge | **Thu 2026-11-26** (Thu 2026-11-19 to Fri 2026-12-11). Sprint 1: 5.85 days for 2.4 days of work | You merge each PR within about half a day. At 0.75 day the central is Wed 2026-12-02, at 1 day Wed 2026-12-09, at 0.25 day Tue 2026-11-24 |
| **2. Fixed merge times** | You merge everything ready at set times, twice a day | Tue 2026-11-24 (Thu 2026-11-19 to Fri 2026-11-27). Once a day is worse: Wed 2026-12-02 | You are available at two set times each working day. A daily time makes every dependent story cost a day |
| **3. Stacked branches** | A dependent story branches from the unmerged story before it; the merges still happen in order | Tue 2026-11-24 with no rework; Wed 2026-11-25 with 10 % more effort; Fri 2026-11-27 with 20 % (at 10 %: Thu 2026-11-19 to Tue 2026-12-01). Sprint 1: 2.9 days | Playbook 5.2 (branch from the merged base) changes. If a review changes a story, the stories stacked on it are redone; the share is unknown, so 10 % and 20 % are stated cases, not forecasts. PRs stay one per story |
| **4. Bundled PRs** | One PR holds a few consecutive stories | Three stories per PR: Thu 2026-11-26 (Thu 2026-11-19 to Wed 2026-12-09). Five: Tue 2026-11-24 | CLAUDE.md §7.3 and the commit rule (one Jira key per PR) change; a bigger diff to read; one fault holds the others. The gain is small at three |
| **5. The orchestrator merges after G7 GO** (`MERGE_POLICY` all-auto) | No human wait for code merges; deployment and G8 stay yours | Mon 2026-11-23 (Wed 2026-11-18 to Fri 2026-11-27). Sprint 1: 2.4 days | You give up seeing each PR before it lands on master (you still see the result after each iteration). A bad merge is undone by a new PR. This is a change to `MERGE_POLICY` in CLAUDE.md §1a, which only you change |

Ways can be combined (for example 3 with 2). **What the team needs from the delivery lead:** which way, and the turnaround they will keep (M) if it is way 1 or 2. Until they say, this plan uses way 1 at half a day.

### 3.4 Sensitivity (central effort, way 1, other inputs central)

| Change | Scope A date |
|--------|--------------|
| Central case (18.31 working days) | Thu 2026-11-26 |
| Merge wait M = 0.25 day | Tue 2026-11-24 |
| Merge wait M = 0.75 day | Wed 2026-12-02 |
| Merge wait M = 1 day | Wed 2026-12-09 |
| Merge wait M = 1.5 days | Wed 2026-12-23 |
| Effort at the low end (88.5 h), M central | Tue 2026-11-24 |
| Effort at the high end (132.5 h), M central | Fri 2026-11-27 |
| G3 rework and backlog at their low values (1.0 day together) | Wed 2026-11-25 |
| G3 rework and backlog at their high values (2.0 days together) | Thu 2026-11-26 |
| The delivery lead is asked to review the changed screens again, a G8 sign-off is asked for after all, or one weekday is lost to a closure announced later (about 1 day) | Fri 2026-11-27 |
| Three weekdays lost to a closure announced later | Tue 2026-12-01 |
| Cut cancel approval and remove price (FR-107, FR-108), -2.75 to -4 h | Thu 2026-11-26 to Wed 2026-11-25 |
| A refused SMTP sign-in needs another transport (+4 h, architect) | Thu 2026-11-26 |
| No credit for the work done on 2026-11-01 (v0.5 treatment: 2.90 days added back) | Tue 2026-12-01 |

The simulation is lumpy: a small change in effort can move the date a little the other way, so read differences under about 0.3 working day as noise. The row to watch is M.

### 3.5 Holidays

The delivery lead said there are no holidays or days away between 2026-11-02 and 2026-12-09 ("none", AQP-1 10555; OQ-PM-02 closed), so none is modelled. The high date (Fri 2026-12-11) is now two days past what they covered; if a closure falls after 2026-12-09, each lost weekday moves the later dates by one weekday.

### 3.6 Can 2026-11-13 be reached?

Not with scope A in any way of working modelled. The quickest case, way 5 at the low effort (90.0 h; v0.13: 88.5 h), ends Wed 2026-11-18 (12.75 working days as an upper bound; v0.13: 12.56). For information only, because scope B was not chosen: the core epics alone, with way 1 at the centre, end about Wed 2026-11-25 (17.25 working days), a day before the full scope, because in the full scope the R2 stories fill the merge waits. I do not consider 2026-11-13 reachable.

### 3.7 STORY-10.10, the NFR-009 guards, in the date model (v0.14)

**What it is.** AQP-169 (STORY-10.10, EPIC-10): a CI check that fails a pull request when a route's first-load JavaScript passes 200 KB gzip, the nightly Lighthouse run on the Wi-Fi profile (the Slow 4G run beside it, report only), and the CI-time monitor (PRD NFR-009). It is **5 points**: the product-owner validated that figure and the solution-architect first proposed about 3 (AQP-169 comment 10733, DL-058). It is an enabler for an existing NFR and not new product scope (DL-056); no FR is added and scope A does not change. It sits in sprint 1 as the first stretch story and must be Done before 02.01 (AQP-113) reaches G6.

**Effort (estimate, no velocity behind it): +1.5 to +2.5 h, central 2.0 h, all in EPIC-10.** Sized by analogy with the rows the architect gave for the restore command and `clear-copies.sh` (scripts with tests and a README).

| Piece | Hours (estimate) |
|-------|------------------|
| JS budget check: route discovery with sign-in, gzip counting, limit table, tests, calibration on commit `6f66b97` | 0.5 to 0.75 |
| CI step 11b, the workflow test and the negative control | 0.25 |
| Lighthouse configuration for both profiles, the nightly workflow, the `benchmarkIndex` summary and its comparability rule, tests | 0.5 to 0.75 |
| CI feedback-time monitor: GitHub API, p95 and median, tests | 0.25 to 0.5 |
| README note and the hand-over of the baseline run to QA | 0 to 0.25 |
| **Total** | **1.5 to 2.5 (central 2.0)** |

None of it is counted inside EPIC-10's earlier 8 to 12.5 h. That range includes CI gates "which no estimate itemised", and no budget check, Lighthouse run or CI-time monitor was named in it. If some of it was there, the true addition is lower, so 2.0 h is the cautious side. The sprint plan's proxy (about 0.26 h a point, 1.3 h for 5 points) is a plan-wide average; this figure is higher because the story has 9 sub-tasks, two surfaces the team has not run (a signed-in Lighthouse run on a hosted runner, the GitHub API) and a calibration that can stop its merge (AQP-169, Sizing).

**Elapsed time.** The v0.13 simulation outputs are kept, and the effort is added at 8 hours a day as an **upper bound**: a story built during a merge wait adds less, and sprint 1 has 2.95 idle days at a half-day merge to absorb it. The throwaway simulation script was not kept, so the model has **not** been re-run; it is re-run at checkpoint A with 90 stories and real hours. Working day 1 is Mon 2026-11-02.

| Case | v0.13 simulated | Effort added | Elapsed (upper bound) | Working day | Date | Margin to the day boundary |
|------|-----------------|--------------|-----------------------|-------------|------|----------------------------|
| Low | 13.24 | +0.19 (1.5 h) | 13.43 | 14 | Thu 2026-11-19 | 0.57 day |
| **Central** | 18.31 | +0.25 (2.0 h) | 18.56 | 19 | **Thu 2026-11-26** | 0.44 day |
| High | 29.63 | +0.31 (2.5 h) | 29.94 | 30 | Fri 2026-12-11 | **0.06 day** |

**Do the dates move? On this arithmetic, no date moves.**
- **Central, Thu 2026-11-26:** holds, with 0.44 day to spare.
- **Range, Thu 2026-11-19 to Fri 2026-12-11:** holds, but **the high end holds by only 0.06 working day**, which is far less than the model's own noise of about 0.3 day (3.2). The honest reading of the high end is "Fri 2026-12-11 or Mon 2026-12-14". It is an upper bound: the high case has 9.31 idle days, so STORY-10.10 would be built inside a wait and add close to nothing.
- **Committed milestone, Mon 2026-11-09 (12 stories, 5.4 working days):** holds. STORY-10.10 is not committed, and even if it added its full 0.25 day the figure would be 5.65, inside working day 6. All 19 sprint-1 stories: about 7.2 working days (v0.13: all 18 on Wed 2026-11-11) plus at most 0.25 stays inside working day 8.
- **Every story merged, Wed 2026-11-25:** 17.71 plus at most 0.25 is 17.96, inside working day 18, by 0.04 day.
- **Not testable:** the unrounded values behind the later milestones (Calculate, Approve and lock, the export download), the ways of working 2 to 5 (3.3) and the sensitivity rows (3.4) were not kept. Each may move by one working day at most; they are re-issued at checkpoint A.

**The condition behind all of this.** The dates hold if STORY-10.10 is built in a merge wait early in sprint 1, as the sprint plan says (the first idle wait after 01.01 is merged). If it is left to the mid-sprint review, 02.01 cannot reach G6 until it is Done and it joins the critical chain: the central then pays its effort and its merge wait, 18.31 + 0.25 + 0.5 = 19.06, which is working day 20, **Fri 2026-11-27** (still inside the range). The calibration step (AC-4) can also stop its merge if `/` does not measure 184.6 KB; that is not modelled.

**Merges.** One more pull request for the delivery lead to merge: 90 candidate stories, 19 in sprint 1. The merge model's other inputs are unchanged.

### 3.8 STORY-10.13, the first-load JavaScript cut, in the date model (v0.15)

**What it is.** AQP-188 (STORY-10.13, EPIC-10): the account menu and the mobile drawer download only when first opened, so that every signed-in route has at least 10,000 B of room under the 200,000 B first-load limit of NFR-009 (RISK-020; today `/queue` is 198,360 B and `/` 197,247 B). It is an enabler for an existing NFR and not new product scope (DL-056, DL-080). No FR is added, no priority or release changes, and scope A does not change. **5 points**, the solution-architect's estimate (AQP-188 comment 10863: two different patterns, a reusable loader with failure and retry, new network and layout-shift tests); the scrum-master drafted 3. The target of 190,000 B is confirmed (DL-081): it is a floor of headroom and the limit stays 200,000 B.

**Effort (estimate, no velocity behind it): +2.0 to +3.0 h, central 2.5 h, all in EPIC-10.** Sized against 3.7: AQP-169 (5 points, 9 sub-tasks, two untried surfaces) was 1.5 to 2.5 h, central 2.0 h. AQP-188 has 8 sub-tasks, a change to the page frame where focus return and keyboard behaviour must not change, and three new test behaviours at three widths, so it is placed one step higher. None of it is inside EPIC-10's earlier 8 to 12.5 h. Scope A is now **92.0 to 138.0 h, central 115.0 h**; the R1 core is 63.75 to 97.25 h.

**Why the dates move when 3.7 said they would not.** 3.7 treated AQP-169 as built inside a merge wait. DL-080 changes that: AQP-188 is blocked by AQP-169 and blocks AQP-48, 65, 74 and 81 (and AQP-89 through AQP-48), so the two enablers now stand one after the other in front of the chain 01.02, 01.04, 01.07. A story branches from the merged base, so each of the two adds its effort and its merge wait to that chain. AQP-169's effort was already in the v0.14 figures; its merge wait was not.

| Case | v0.14 (upper bound) | AQP-188 effort | Merge waits of AQP-169 and AQP-188 | Elapsed (upper bound) | Working day | Date | Margin to the day boundary |
|------|---------------------|----------------|------------------------------------|-----------------------|-------------|------|----------------------------|
| Low | 13.43 | +0.25 (2.0 h) | +0.25 +0.25 | 14.18 | 15 | Fri 2026-11-20 (was Thu 2026-11-19) | 0.82 day |
| **Central** | 18.56 | +0.31 (2.5 h) | +0.5 +0.5 | 19.87 | 20 | **Fri 2026-11-27** (was Thu 2026-11-26) | **0.13 day** |
| High | 29.94 | +0.375 (3.0 h) | +1.0 +1.0 | 32.32 | 33 | Wed 2026-12-16 (was Fri 2026-12-11) | 0.68 day |

**Do the dates move? Yes, on this arithmetic, and it is an upper bound.**
- **Central:** one working day, to Fri 2026-11-27, inside the stated range. It sits 0.13 day from the boundary, less than the model's noise of about 0.3 day, so read it as Fri 2026-11-27 or Mon 2026-11-30.
- **High end:** Wed 2026-12-16, three working days past the stated Fri 2026-12-11. That leaves the stated range, so the delivery lead is told (DL-056, DL-081).
- **Committed milestone:** the committed set is no longer the same 12 stories, so the old Mon 2026-11-09 is not comparable. The chain to the end of the committed set is at most about 6.96 working days, Tue 2026-11-10.
- **If AQP-48 does not need the link:** the chain 01.02, 01.04, 01.07 would start after AQP-38 and not after AQP-188, and the central would be about 19.4 (still Fri 2026-11-27). The solution-architect (comment 10863) cleared AQP-57 and AQP-90 and did not state AQP-48.
- **Not modelled:** the 500 B tolerance on `/sign-in`; a failed or short cut (AC-10 stops the story and adds a decision and possibly a story); the simulation itself, whose script was not kept. It is re-run at checkpoint A (G4 condition 9).

**What would bring the dates back.** The two enablers are now on the chain, so the delivery lead's merge turnaround on these two pull requests (AQP-169 and AQP-188) is the largest input. At a same-day merge (0.25 day) for these two the central returns by 0.5 day, to about 19.4. Ways 2 and 5 of 3.3 act on every pull request, not only these two.

**Sprint 1 composition (DL-081).** Both enablers count in the commitment, 53 + 10 = 63 of 55 points. 01.03 (AQP-57, 5), 01.05 (AQP-81, 3) and 01.08 (AQP-90, 1) move to the head of the stretch, in that order, giving 54 of 55 committed, slack 1 (was 2), 29 points of stretch and 83 planned. They remain Must in Release 1, none is a predecessor of a story left in the committed set, and none is on the chain 01.02, 01.04, 01.07. AQP-57 must still be Done before any cost-bearing story starts; the Jira links enforce it.

**Merges.** Two enablers are now in series on the chain, each needing its own pull request merged before the next story starts: 20 pull requests in sprint 1 (was 19).

### 3.9 STORY-10.14, the CI-time cut (AQP-199), in the sprint and the date model (v0.16)

**What it is.** AQP-199 (STORY-10.14, EPIC-10): make the end-to-end stage of CI (stage 12, Chromium at 360, 768 and 1366 px) faster without dropping any test or screen width, so the required job `Stages 1 to 11` keeps feedback inside the 10 minutes the delivery lead agreed (chat of 2026-11-03; PRD NFR-009). It is an enabler for an existing NFR and not new product scope (DL-056, DL-095): no FR is added, no priority or release moves, and scope A does not change. **Why now:** over the last 20 pull-request runs the median is 6 min 02 s (past the 6-minute early warning) and the p95 is 8 min 01 s; the latest `master` run took 8 min 24 s; stage 12 grew from about 1.5 min to 3.6 to 5.2 min in two days (RISK-023, PRF-02). Every later story adds specs, so the slope continues.

**Targets (product-manager decision; the PRD NFR-009 limit of p95 at most 10 minutes and the 6-minute early warning are unchanged).** The story's targets are margin under those limits, like the 190,000 B floor under 200,000 B (3.8).
- **Confirmed as drafted:** AC-1 median at most 5 min 00 s and p95 at most 7 min 00 s; AC-2 stage 12 at least 40 % shorter; AC-5 five consecutive green runs with 0 flaky tests; AC-6 runner minutes not above twice today's; AC-7 the 9-minute line in the nightly summary.
- **Why they hold together:** a 40 % cut of a stage 12 of about 4.4 min (the middle of 3.6 to 5.2) saves about 1.8 min, giving a median near 4 min 15 s and a p95 near 6 min. That meets 5:00 and 7:00 with 0.7 to 1 min to spare. A looser p95 (8:00) would be no gain on today's 8:01. A tighter one (6:00) needs more than 40 %, which in the architect's options means more parallel jobs and more runner minutes, and gives up the margin the 9-minute watch relies on.
- **Coverage is not for sale (NFR-016):** the three widths stay. A spec may move to one width only by the architect's named ruling per spec (AC-3); no blanket cut, no quarantine, no extra retries.
- **Clarifications for the architect and scrum-master to apply (no change of intent):** (1) AC-1 reads 20 runs made after the merge, which at about two pull requests a day is roughly ten days away, so the merge test is AC-2 and AC-5, and QA also checks that the whole required path is at most 5 min 00 s on the pull request's run and its two re-runs; the nightly figure is recorded when 20 runs exist and does not hold Done. (2) After the merge the nightly window still holds old slow runs for about 19 more pull requests, so the AC-7 line should say it applies until AQP-199 merges (DL-095), or it will keep reporting a hold for days after the fix. (3) Public-repository standard runners are not billed, so the 2x runner-minutes cap in AC-6 is a guard on resource use and queueing, not on cost (assumption, to be checked in the repository settings; if the repository goes private, minutes are billed and the cap matters more).

**Sprint placement: sprint 1, first in the stretch (rank 12c), not committed.**
- **Ready before the sprint 1 review** (master's floor, DL-095): architect's approach and rulings, then product-owner DoR, then Ready for Dev with the `sprint-01` label. **Built in the first idle merge wait**, not at the review: master's trigger can fire before then.
- **Why not committed:** it is not a predecessor of any committed story (Jira links are "relates to"; master's hold is conditional). Committed stays 54 of 55. The DL-081 reason for committing the two earlier enablers (they gate committed stories) does not apply unless the trigger fires.
- **Why not sprint 2:** the stories that add E2E specs are the sprint 1 chain itself (AQP-65 `users.spec.ts`, AQP-74, AQP-89) and the stretch masters. With a p95 of 8:01 today and 9:00 as the trigger, a hold lands on the chain and costs a merge wait; building it first costs about the same effort and removes the hold.
- **If the nightly p95 passes 9 minutes before it merges:** it moves from the stretch head to committed at once, and AQP-89 (2 points) steps out to the stretch. At 3 points, committed is 55 of 55; at 5 points it is 57 of 55 and I take it to the delivery lead, and I do not demote AQP-65 or AQP-74, which are the chain.

**Effort (estimate, no velocity behind it): +1.5 to +2.5 h, central 2.0 h, all in EPIC-10** (+1 h if the architect moves it to 5 points). Sized against 3.7 and 3.8: 6 sub-tasks, small code (workflow, Playwright configuration, one script line, tests); the weight is the coverage comparison and five green runs, which are mostly waiting time on CI. None of it is inside EPIC-10's earlier 8 to 12.5 h; the CI feedback monitor it touches was counted in 3.7. Scope A is now **93.5 to 140.5 h, central 117.0 h**; the R1 core is 65.25 to 99.75 h.

**Dates (arithmetic on the v0.15 upper bounds; the model is not re-run; none adopted).**

| Case | v0.15 (upper bound) | Built in a wait (effort only) | Day | Date | On the chain (trigger fires first: effort + merge wait) | Day | Date |
|------|---------------------|-------------------------------|-----|------|------------------------------------------------------|-----|------|
| Low | 14.18 | 14.37 (+0.19) | 15 | Fri 2026-11-20 | 14.62 (+0.19 +0.25) | 15 | Fri 2026-11-20 |
| **Central** | 19.87 | 20.12 (+0.25) | 21 | Mon 2026-11-30 (0.12 day over the boundary) | 20.62 (+0.25 +0.5) | 21 | Mon 2026-11-30 |
| High | 32.32 | 32.63 (+0.31) | 33 | Wed 2026-12-16 | 33.63 (+0.31 +1.0) | 34 | Thu 2026-12-17 |

- Built in a wait, the central sits 0.12 day over the Friday boundary, inside the model's noise of about 0.3 day, which is what v0.15 already said ("Fri 2026-11-27 or Mon 2026-11-30"). No stated range moves beyond what 3.8 reported, except the high end by at most one working day if it lands on the chain.
- Both enablers of 3.8 (AQP-169, AQP-188) have passed G7 (DL-087, DL-092). When they merged is with the delivery lead, so the v0.15 upper bound stands until the model is re-run at checkpoint A (G4 condition 9).
- Not credited: shorter CI waits per story after the cut (about 1.8 min a run, on the order of 0.2 day over the sprint at three runs a story). Not modelled: the 5-point variant; a failed or flaky result in AC-5.

**Merges.** One more pull request for the delivery lead to merge: 21 in sprint 1 (was 20). It is off the chain unless the trigger fires.

### 3.10 DEF-015 (AQP-206), the CI install stall: where it goes (v0.17)

**What it is.** An Environment defect, Sev-3 (master DL-100). In run 42061753504, attempt 3, on unchanged code, stage 12 spent about 9.5 minutes inside `npx playwright install --with-deps chromium` (`apt-get` fetched 20.5 MB at 35.9 kB/s, single packages stalled up to 170 s), and then 340 tests passed in 4.3 minutes. The architect's fix (AQP-199 comment 10992; test strategy v0.17 10.6; architecture v0.21 9.2), all inside the one required job `Stages 1 to 11`, with no branch-protection change: cache the browser's system `.deb` packages and install them offline on a hit; bound a miss (20 s timeout, 3 retries, 8-minute step limit); fall back to the miss path if the offline install fails; key the browser cache on the Playwright version; split "Stage 12a" (install) from "Stage 12" (tests). Estimate 2 points.

**Decision: its own fix under AQP-206, after AQP-199 merges. Not a task inside AQP-199.**
1. **The split changes what "stage 12" means.** AQP-199's AC-2 asks for stage 12 at least 40 % shorter, before and after. Moving the install into a new stage 12a would make stage 12 look shorter without one test running faster. The "before" and "after" runs of AQP-199 are already pushed; folding the fix in would mean measuring both again, on a baseline that was fixed on purpose.
2. **It would hold the chain longer.** Under DL-099 AQP-65 waits at G6 until AQP-199 merges. Every extra day AQP-199 stays open is a day on the sprint 1 chain, and its developer is mid-measurement.
3. **The reason for folding it in is already covered.** The architect's concern is that a mirror stall makes the AC-1 and AC-2 timings unreliable. DL-100 already says a run slowed by a stall is recorded as Environment and repeated, not counted, and AC-2 uses the median of three runs, which one stalled run does not move.
4. **No capacity question arises.** Folding it in makes AQP-199 5 points and the committed set 57 of 55, which I said earlier I would take to the delivery lead. A separate defect fix does not.
5. **They touch the same lines** (stage 12 in `ci.yml` and `tests/unit/ci-workflow.test.ts`), so two pull requests cannot run side by side without conflicts. The fix branches from `master` after AQP-199 is merged.

**Placement.** A defect, not a story: AQP-206 stays a Bug with no story points, branch `fix/AQP-206-<slug>`, its own pull request. It is not in the committed 55 and not in the stretch. Defect fixes in sprint 1 have never been pointed or counted in the 55 (DEF-008, DEF-009, DEF-014); counting this one would be inconsistent, so its effort is carried in the date model instead. **Order:** after AQP-199 merges, in the first idle merge wait; chain work (AQP-74 and the gates of AQP-65) comes first. **Due before the end of sprint 1** (DL-100); if it has not started by the sprint 1 review it moves to the head of the queue. **Evidence** (the architect's): one miss run and two hit runs, with the times of steps 12a and 12 stated, a failed offline install shown falling back to a miss, and the whole-job time reported as before so the CI-time measure is comparable.

**Effort (estimate, no velocity behind it): +1.0 to +1.5 h, central 1.25 h, EPIC-10.** Sized as small: steps, one script, the workflow test, and three evidence runs that are mostly waiting on CI. Scope A is now **94.5 to 142.0 h, central 118.25 h**; the R1 core is 66.25 to 101.25 h.

**Dates (arithmetic on the v0.16 on-the-chain column, because AQP-199 is on the chain now (DL-099); model not re-run; none adopted).** The fix gates no story (AQP-65's hold lifts when AQP-199 merges), so it adds effort only, no merge wait.

| Case | v0.16, AQP-199 on the chain | Effort added | Elapsed (upper bound) | Working day | Date |
|------|----------------------------|--------------|-----------------------|-------------|------|
| Low | 14.62 | +0.125 (1.0 h) | 14.75 | 15 | Fri 2026-11-20 |
| **Central** | 20.62 | +0.16 (1.25 h) | 20.78 | 21 | **Mon 2026-11-30** (0.22 day to spare) |
| High | 33.63 | +0.19 (1.5 h) | 33.82 | 34 | Thu 2026-12-17 (0.18 day to spare) |

No stated date moves from v0.16. The margins are inside the model's noise of about 0.3 day. Not credited: fewer stalls in later CI runs. Not modelled: the offline install failing on a first hit.

**Does this need the delivery lead's approval? No.** It adds no story, changes no committed count and moves no date beyond v0.16. It is reported in the next result report (DL-010, DL-084).

**Merges.** One more pull request for the delivery lead to merge: 22 in sprint 1 (was 21). It is off the chain.

### 3.11 AQP-199 as built, the staged CI targets, and the shard story (v0.18)

**What was measured** (AQP-199 comment 11003, PR #86, median of three runs, the statistic AC-2 names). Required job 468 s to 411 s (-12 %); stage 12 313 s to 249 s (-20 %); 0 flaky in five valid runs; runner minutes per run 7 against 8, 7 and 17; coverage kept (361 to 317 test instances, every removed instance still runs on desktop); the check name `Stages 1 to 11` unchanged; the negative control failed the check. 3 of 10 runs lost 7 to 10 minutes inside `playwright install --with-deps` (DEF-015), and those stalls, not test time, set the nightly p95 of 15 min 05 s (the median is 6 min 56 s over 17 runs).

**Why the proposed targets were missed, and my part in it.** I confirmed median 5:00, p95 7:00 and stage 12 at least 40 % shorter (3.9) on the reasoning that a 40 % cut of stage 12 would follow. I confirmed those numbers before any mechanism had been chosen, and I did not ask what the mechanism would be limited by. Four Chromium workers and two Next.js servers saturate 4 vCPU: the time per test rose from 1.65 s to 2.80 s, so the gain was 20 %, not 40 %. The numbers were PROPOSED and PM-owned, and the NFR-009 limits (p95 at most 10 min, early warning at a 6 min median) were never at stake; but the lesson stands: targets for an approach come after the approach and its limiting resource are known.

**Decision 1: AQP-199 is accepted as built, with restated ACs.** The gain is real, comes with no lost coverage and no flakiness, and the merge ends AQP-65's hold at G6 (DL-099). Holding it for a target the approach cannot reach would stop the chain for no gain. Restated (the figures are PM-owned; the scrum-master applies them and the product-owner re-validates, since ACs change after Ready):
- **AC-1:** no numeric target. The nightly step reports, and the first post-merge report is recorded at the sprint 1 review. The median and p95 targets move to the two steps that can reach them, below.
- **AC-2:** stage 12 is at least **15 % shorter** than the fixed baseline, median of three runs each (measured 20 %); the job time is reported (measured -12 %). The 5:00 whole-path check I added for QA (3.9) is withdrawn for this story.
- **AC-3 to AC-7:** unchanged. AC-5 (0 flaky) and AC-6 (runner minutes) are met.

**Decision 2: the CI targets are staged by the step that can reach them.** The 10-minute p95 limit and the 6-minute early warning in NFR-009 do not change.

| Step | Target | Evidence behind it |
|------|--------|--------------------|
| AQP-199 (as built) | stage 12 at least 15 % shorter | measured -20 % |
| DEF-015 fix (AQP-206) | **p95 at most 9:00** on stall-free apt (keeps the DL-095 line quiet). **No median target:** the median stays above 6:00 until the shard step | stall-free runs after AQP-199 were 393 to 413 s (6:33 to 6:53), one 284 s; AQP-65 adds about 90 s, so about 8:00 to 8:25 after it |
| Shard story | **median at most 6:00, p95 at most 7:00** | the architect's estimate is about 4:40 today and about 5:25 with AQP-65 at two shards |

I do not take the architect's suggestion of median at most 6:00 after the DEF-015 fix: that fix removes stalls (the p95) and about 10 s of install, and the measured stall-free median is about 6:43 before AQP-65 adds its 90 s. It would fail on its first reading. The original 5:00 median is retired as a target: with AQP-65 the two-shard estimate is 5:25, and 5:00 needs a third shard (decision 4). The nightly step stays flagged on the median (its 6-minute threshold is unchanged) until the shard step merges; that is expected and is RISK-023's open signal, not a defect.

**Decision 3: placement and order.**
1. **AQP-199 merges** (G6, G7 on the restated ACs; master decides the gates).
2. **DEF-015 (AQP-206) straight after**, as decided in 3.10: its own defect fix, not pointed, due before the end of sprint 1. It comes before the shard story so the shard timings are clean (the architect's order, which I accept). AQP-74 is not held for it: the developer takes whichever of the two is not waiting on a merge or a review.
3. **The shard story (STORY-10.15, 3 points, the architect's estimate; the scrum-master writes it): sprint 1, first in the stretch (rank 12d), not committed.** Committed stays **55 of 55**; stretch +3, planned total +3. Reasons: it is a predecessor of no committed story (no "blocks" link); what it protects is the 10-minute limit a few stories from now (about 8:00 after AQP-65, about 9:30 after AQP-74 at one width), not sprint 1's committed set; and nothing off the chain is left to swap out, so committing it would mean 58 of 55 or demoting AQP-74. It is Ready before the sprint 1 review and built in the first idle merge wait after DEF-015. I recommend master does **not** re-arm a G6 hold on the chain for it (the DL-095 hold cost AQP-65 a wait). The signal is the existing nightly line "the shard step is due".
4. **AQP-65's one-width ruling (test strategy 10.5, v0.18) is accepted:** the whole `users-production.spec.ts` and seven named `users.spec.ts` tests at one width; the list (scroll, axe), 44 px, keyboard dialog, field message, reset-password and deactivate dialogs stay at three. That keeps NFR-016 for everything that reads layout and cuts AQP-65's added time from about 164 s to about 90 s (estimate).

**Decision 4: the third shard is not taken now; it is pre-authorised for later.** A third shard brings the estimate under 5:00 at about 2.2 times today's runner minutes, over the 2x guard in AC-6. I keep two shards at about 1.7x. Reasons: the gain is about 35 s for 0.5x more minutes and a third repeated build and database set-up; the shard count is one constant, so a third shard is a one-line change, not a story; and the guard protects resource use and queueing, not cost, on a public repository (A-3, closed as far as I can close it). **If the nightly median passes 6:00 or the p95 passes 7:00 after the shard step merges, the constant goes to three, and the runner-minutes guard for that case is raised to 2.5x** (decided here so it need not be asked again). If the repository goes private, minutes are billed and this should be looked at again.

**Effort (estimate, no velocity behind it): +1.5 to +2.5 h, central 2.0 h, EPIC-10, for the shard story** (the same size as AQP-199, 3 points). AQP-199 as built and the DEF-015 fix keep their earlier figures. Scope A is now **96.0 to 144.5 h, central 120.25 h**; the R1 core is 67.75 to 103.75 h.

**Dates (arithmetic on the v0.17 upper bounds; model not re-run; none adopted).** The shard story gates no story, so it adds effort only.

| Case | v0.17 | Effort added | Elapsed (upper bound) | Working day | Date |
|------|-------|--------------|-----------------------|-------------|------|
| Low | 14.75 | +0.19 (1.5 h) | 14.94 | 15 | Fri 2026-11-20 (0.06 day to spare) |
| **Central** | 20.78 | +0.25 (2.0 h) | 21.03 | 22 | Mon 2026-11-30 or **Tue 2026-12-01** (0.03 day over the boundary) |
| High | 33.82 | +0.31 (2.5 h) | 34.13 | 35 | Thu 2026-12-17 or Fri 2026-12-18 (0.13 day over) |

Every margin is inside the model's noise of about 0.3 day. The point to read is the pile-up: four worst-case additions (3.7, 3.8, 3.9/3.10, 3.11) have been added to a v0.13 simulation, and sprint 1 is passing gates faster than that bookkeeping assumes. I cannot show by how much without actual merge dates. The simulation should be re-run, with real hours and merge dates, at the sprint 1 review (G4 condition 9).

**Does anything need the delivery lead? No approval.** The 10-minute limit is theirs and is unchanged; sprint 1 stays 55 of 55; runner minutes are not billed on a public repository; the shard story adds two pull requests (DEF-015 and the shard story) for them to merge, 23 in sprint 1. They are told in the next result report (DL-010, DL-084): the CI gain from AQP-199 is smaller than proposed (-12 % job, -20 % stage 12), what the two follow-ups are, and that the upper-bound dates have moved about one working day more (high end Fri 2026-12-18).

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The date is a target and not a blocker, so the analysis states how far scope A is from it and what the fit rule says. **The low end of the effort, 90.0 h (v0.13: 88.5 h), is above the 80 h itself.**

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| A (adopted): R1 core + R1+ + R2, way 1 | 90.0 to 135.0 h | 13.43 / 18.56 / 29.94 (upper bound, 3.7) | Misses by 4 to 20 working days; central 9 days over |
| v0.11 for comparison (same scope, stage waits) | 88 to 131.75 h | 13.75 / 18.18 / 24.22 | Misses by 4 to 15 working days; central 9 days over |

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope A: Musts are about 89 to 90 % of the effort (about 9.25 to 15 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088, 103 and STORY-10.10, whose 1.5 to 2.5 h are new in v0.14; v0.13: about 90 to 91 % and 7.75 to 12.5 h; FR-105 to FR-108 are Musts by the delivery lead's decision). The R1 core alone is about 97 % Must or a little more. The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items or decisions of the delivery lead; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a recorded deviation (DL-002) for the master and the delivery lead to weigh.

## 5. Releases and build stages

| Stage | Name | Epics | What a user can do at the end | Brief goals |
|-------|------|-------|-------------------------------|-------------|
| **R1 core** | Assign, enter, calculate, approve, export | EPIC-01, 02, 03, 04, 05, 06, 07, 10 | Admin creates users and masters, reads the audit record, sees that the weekly backup ran (the Last backup line) and, with server access from Accucut IT, can restore from a copy with one guided command; Lead assigns a task; Engineer enters a part tree with the count of each part for the whole order, presses Calculate (and is warned about a 0 quantity), sees the status and no cost; Lead views costs and formulas, is told if rates changed, approves and locks a price only from a current calculation, unlocks if needed; Admin can cancel an approval and remove its price, each with a password re-entry (the step-up); Lead downloads the Excel file in the worksheet layout with one total and the total Tool Cost, only from a current calculation; the bell and Overdue tab show late work | GOAL-01, 02, 03, 04, 07 in full; GOAL-05 in part (no e-mail); GOAL-06 in part |
| R1+ stretch | Built after the core | FR-014, 035, 039, 054, 057, 088 | Propagation prompt for process defaults, Lead default filter, task filters, autosave, completeness count, loading and empty states | Same |
| **R2** | Admin control and alerts | EPIC-08, EPIC-09 (FR-003, 006, 019, 040, 072 to 084) | Admin changes fields and formulas with re-lettering, versions, checkpoints and change history; e-mail alerts and the 11:00 IST digest; password reset by e-mail; task reassign | GOAL-05, GOAL-06 in full |
| R3 | Later; **outside scope A** | EPIC-11 (FR-090, 097) | Dark mode; UI-sample extras. Drawing input only if scheduled | GOAL-07 |
| **R-OFF** | The next release (confirmed) | EPIC-12 (FR-092), outline only | Use without internet; meaning and design open | GOAL-01 |

The first three rows are one hand-over (scope A). Release moves since v0.1 are in PRD section 6.3. SPEC §14 acceptance criteria are all met at the hand-over except any that touch offline; by build stage, the **R1 core** meets 1, 2, 3, 4, 5, 12, 13, 14 and 10 if FR-014 is reached, and **R2** meets 6, 7, 8, 9, 11. Criterion 12 is read with the exception of D-16 (one total only, total Tool Cost shown).

| SPEC §13 step | Stage | Note |
|---------------|-------|------|
| 1 Scaffold, auth, users, roles, shell, About | R1 core (EPIC-01), with enablers 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) scheduled first | Includes the password rule, the 12-hour session and the audit screen |
| 2 Masters, Settings | R1 core masters and the Settings page frame with the Last backup line (EPIC-02); the alert switch, sender and test e-mail in R2 | "Not applicable" entries are system-created and hidden from lists; the words show on a part |
| 3 Registry, seed, formula engine | R1 core (EPIC-03) | Engine and seeded registry; BL is `SUM(BG)`; the Warn rule |
| 4 Tasks, queues, overdue, bell | R1 core (EPIC-04) | Engineers see the status |
| 5 Estimate workspace | R1 core (EPIC-05) | Any input change clears every figure; the Warn dialog at Calculate; the hint under QTY per Assy; the picture is optional |
| 6 Cost view, approval, lock, unlock | R1 core (EPIC-06) | Cleared figures; approval blocked while stale; optional reason; the Warn notice; the rate-change notice; Admin-only cancel approval and remove price |
| 7 Excel export | R1 core (EPIC-07) | One total, total Tool Cost shown; no file until a calculation is current |
| 8 Admin configuration UI | R2 (EPIC-08) | |
| 9 E-mail alerts and scheduled jobs | R2 (EPIC-09) | Outlook named; sender address does not exist yet (Q-18) |
| 10 Polish, accessibility (WCAG 2.2 AA), E2E, Docker, README | R1 core for delivered screens (EPIC-10); repeated for R2 screens | Responsive and accessible are built in from step 1 |

### 5.1 Backlog candidates (later changes, not scheduled)

Changes the delivery lead has named for after the hand-over. None is in scope A, none has an FR, none is in the effort or the dates, and each needs its own requirements and a scope-change proposal (PRD change log) before it enters a release.

| ID | Candidate | Origin | In Release 1 today | What it would change (not estimated) | Needed before it can be scheduled |
|----|-----------|--------|--------------------|--------------------------------------|-----------------------------------|
| BC-01 | Plating cost calculation: Plating Cost (AU) calculated from `Plating-rate-per-sqin` (per sq in) | D-40; Q-42 answered 2026-11-03 (relayed): "Keep the data for now. The admin will add the cost calculation details later." | The rate is stored data only (FR-012); the Engineer types AU (FR-045); the Plating flag (AD) is unused | The formula for AU, the field registry, the Part form (AU no longer typed), the Excel columns, the Engineer's view (FR-008) and the tests. Whether the Admin's own formula route (EPIC-08, R2) can carry it is the solution-architect's to say | The calculation details from the delivery lead or the Admin; their choice of release; a scope-change proposal |

## 6. Checkpoints and cut ladder

Checkpoints re-issue the date from actuals. Method: actual hours for the finished stories divided by their estimate gives a ratio; the story simulation (3.2) is re-run on the remaining stories with the ratio and the merge wait actually seen. This is the first time any velocity exists.

| Checkpoint | When (central, way 1) | Question | Decision |
|------------|-----------------------|----------|----------|
| A | Sprint 1's 12 committed stories merged (about Mon 2026-11-09) | Ratio of actual to estimated hours, with the scaffold, CI and token share visible for the first time; **the merge wait actually seen** | Re-issue the date; confirm or change the way of working (3.3) |
| B | Calculate (05.09) merged (about Tue 2026-11-17) | Is the core on track; does BL match the constructed examples (PRD FR-030: 30, 840, 1000, 5) and does Warn pass its tests (FR-104)? | Re-issue; decide whether to build the stretch |
| C | Approve and lock (06.06) merged (about Fri 2026-11-20) | Hand over the core now, or continue to R2 (scope A)? Handing over the core alone would end about Wed 2026-11-25 at the centre (3.6), only a day earlier. **An interim hand-over of the core must include FR-105, which is in the core, or the Admin has no quick sign that backups ran** | Their decision, logged by `master` |

### 6.1 Cut ladder (only if they want an earlier hand-over; each is a scope decision for them)

| Step | Cut | Hours saved (estimate) | Outcome lost |
|------|-----|------------------------|--------------|
| 0 | Do not start any stretch item | 6 to 9.5 | R1+ items |
| 1 | Move FR-063 Unlock and the Closed-to-Open reopen (FR-038 part) to a later stage | 1 to 2 | An approved estimate cannot be reopened |
| 2 | Move FR-058's six-stage accordion and formula display (and FR-060) to a later stage | 1 to 2 | Lead cannot see the arithmetic behind a price |
| 3 | Move FR-047 part pictures and export column C images to a later stage | 2 to 3 | Parts not identified visually; SPEC §14.12 image check fails |
| 4 | Move cancel approval and remove price (FR-107, FR-108) to a later stage | 2.75 to 4 | An earlier approved price can only be replaced by a new approval, not cancelled or removed. This is the one place their words are conditional ("only IF POSSIBLE", feasible per the architect), so it is theirs to cut |

Steps 1 to 4 save 6.75 to 11 h (about 0.85 to 1.4 working day). Not cut candidates: cost confidentiality (FR-007, 008), the calculation and its tests (FR-020 to 031), the quantity warning (FR-104, their decision), approve and lock with its stale-total rules (FR-062, 100, 101), the export itself (FR-066 to 070), the Last backup line (FR-105), responsive and accessibility tests (FR-085, NFR-016, NFR-018).

### 6.2 Process effects the estimate does not capture

- **Parallel work is not assumed.** The simulation uses one development stream. Parallel developers would shorten elapsed time, not effort, and merges would still serialise on the delivery lead unless the way of working changes (3.3).
- **The merge model is recalibrated, not validated.** It rests on 89 stories of which 71 are candidates; their dependencies are the epic files' columns, and the equal split of hours over a story's epic is a stated proxy. The model is re-run when the scrum-master writes each sprint, and at checkpoint A with the real merge wait. G4 remediation 4 is met by the recalibration and by the choice put in 3.3.
- **Sprint 1 is where waits cannot be hidden.** The first sprint's 18 stories are 2.4 days of work behind a chain of 9; at a half-day merge it takes 5.85 days. The sprint plan should say which way of working it assumes.
- The Warn work crosses four epics, so it needs its own story or clear splits (the backlog decides).
- The docs PR exists as draft PR #1; story branches start after it is merged at G4.

## 7. Human gates, stops and who waits for whom

| Point | Type | Effect on the plan |
|-------|------|--------------------|
| G3 | Done: the delivery lead approved (AQP-1 10491) and the master decided CONDITIONAL GO. Approval stops lifted afterwards (DL-010) | No wait in the dates. If they are asked to look again at the changed screens: one more wait of a day (3.4) |
| The open business questions | Answered on 2026-11-02, the backup key and the restore included (the Admin; AQP-1 10559, 10560). Open: the disk size (OQ-ARCH-03) and the Admin's server access (A-35), both Accucut IT's | No wait: these block go-live and not the dates |
| The Admin's restore rehearsal (NFR-013) | **Human step before go-live**, by the Admin from the README alone, on staging, with the IT person on hand | Outside the dates (go-live is after the hand-over); the time of the Admin and of Accucut IT is not estimated. One wait of about a day if it is done before the hand-over (3.4) |
| Master data stop (HOLD-01, TR-009) | **Met** (AQP-10 10512, D-23) | No wait in the model |
| G4 | `master` | Draft PR #1 exists; the orchestrator merges it after G4 GO (docs-auto) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | The largest single input to the date: M after every PR (3.2). The delivery lead chooses the way of working (3.3) |
| G8 | `master` decides; **no separate sign-off wait** (DL-010); a NO-GO stops the run; deployment stays human | No wait. The master's G8 decision day is the completion date |

## 8. Dependencies by stage

| Stage | Dependency | Owner | Status |
|-------|-----------|-------|--------|
| R1 core | Quantity rule, Q-35 to Q-41, picture, rate notice, backups | Santhosh | **Answered** (D-21 to D-35). The master records the reversal of DL-011 and DL-024 and checks G4 |
| R1 core | Enablers: stories 10.01 (scaffold, CI, scan) and 10.02 (tokens, shell) before any EPIC-01 story | product-owner; solution-architect | Ruled in the backlog (CR-11), placement confirmed; hours in 3.1 |
| R1 core | Master data (TR-009) | the Admin | **Met** (D-23). Invented placeholders until the Admin types the real values at first use |
| R1 core | Hosting details: web address, sender address and the IT person's name (the account is the company Microsoft 365 account, AQP-11) (Q-18) | Santhosh, their IT person | Open; before the first deployment |
| R1 core | VM disk size (OQ-ARCH-03): 40 GB is too small for about 105 full copies on the same server | Accucut IT | Open; before go-live |
| R1 core | Server access for the Admin: their own limited account (key-only SSH, `sudo` for the restore script only, not in the `docker` group) as the architect proposes (A-35), or full access as they asked | Accucut IT | Open; before the rehearsal. The backup key is held by the Admin (OQ-ARCH-12 closed) |
| R1 core | Cleaned sample worksheet (Q-30, not blocking) | Santhosh | Open. The repository stays public by their decision (D-13); structure only is read from it |
| R1 core | The way of working for code merges and the merge turnaround (3.3) | Santhosh | Open; before sprint 1 starts (G4 remediation 4). Until then way 1 at half a day |
| R1 core | Docs PR | orchestrator | Draft PR #1 exists; merged after G4 GO (docs-auto) |
| R2 | Sender address (the account is the company Microsoft 365 account, AQP-11); whether it allows SMTP; one real send on the real mailbox before alerts go live | Santhosh, their IT person; solution-architect; developer | Open; alerts tested against a capturing mail server until then |
| After the date | Customer testing, acceptance, change requests; the usability test (2 Engineers, 2 Leads, 1 Admin, no names; the qa-engineer writes the plan); go-live, training, parallel run (TR-003 to TR-005) | Santhosh, Accucut; qa-engineer | Not in the dates |
| Before go-live | The Admin's restore rehearsal: the Admin runs `restore.sh` from the README alone on staging, timed, with the IT person on hand (NFR-013) | the Admin; Accucut IT | Not in the dates; the time of both is not estimated |
| R-OFF | Meaning of offline, hosting design | Santhosh | Open; settled when the release is planned |

## 9. Effect of each open item on this plan

| Item | If answered as assumed | If answered differently |
|------|------------------------|-------------------------|
| Reading R-1: "block the portal" is applied to the Excel download | As built; no extra hours | More of the portal blocked: not estimated |
| Reading R-2: a top-level item's own 0 warns | As built | It should not: one condition in the rule, small, not sized |
| Reading R-3: "rates" are the master values only | As built | Configuration changes included: the comparison grows; not estimated |
| Reading R-4: a removed price stays in the audit record | As built | Erased from audit: breaks NFR-007; needs their decision; not estimated |
| Reading R-5: "server access" is the limited account of A-35, granted by Accucut IT | The restore command and README as costed (+1 to +1.5 h) | Full server access: the audit log is then a record kept by the person it records (ARCH-R8), and the portal's promises do not hold against that person; no hours change |
| OQ-ARCH-03 disk size | A larger VM; no effect on hours | A smaller disk is kept: backups fill it in about 6 months at an invented rate and stop the database (ARCH-R7) |
| Q-18 hosting details | Docker Compose; Outlook; weekly backup on the same server | Deployment and mail settings change; effect on hours not estimated |
| ASSUMPTION-56 (symbols, session start) | Any non-alphanumeric character; 12 hours from sign-in | Under 1 h (estimate) |
| The merge turnaround M | Half a day, as assumed | From half a day to three quarters adds about 4.3 working days, and to a full day about 9.4 (0.75 day: Wed 2026-12-02; 1 day: Wed 2026-12-09) |
| A refused SMTP sign-in | The OAuth mode works | About 4 h more (architect), 3.4 |
| The Engineer types a wrong count (ARCH-R6) | Not an effort item: a risk to prices, controlled by the hint, Warn and the Lead's review | Not estimated |
| Plating cost calculation (Q-42 answered, BC-01) | The rate is kept as data and AU stays typed; as built | The calculation is added later: a scope change, not estimated (5.1) |

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
| 0.8 | 2026-11-01 | The delivery lead's answers on AQP-14, AQP-15 and AQP-10 (D-21 to D-23, SPEC v1.6; architecture v0.5 section 16.10; consistency report CR-11, 14, 20). **Effort:** Warn (FR-104) 3.75 to 5.75 h, central 4.75 h, split over EPIC-03, 05, 06 and 07, replaces the 1 h block that v0.7 held outside the headline; scope A is 87.5 to 131.5 h, central 109.5 h (R1 core 59 to 90.5 h). **Dates re-issued, not adopted:** central Thu 2026-11-26 (18.54 days; v0.7 Wed 2026-11-25), range Thu 2026-11-19 to Fri 2026-12-04 (unchanged). HOLD-01 shown as met (D-23): the W term stayed for that re-issue. Decisions: CR-11 (no hours moved; enablers 10.01 and 10.02 first), CR-14 (FR-105 added, Should, R2), CR-20 (usability test during customer acceptance, after the date, not in the dates). Supersedes the v0.7 dates | AQP-14 10510; AQP-15 10511; AQP-10 10512; SPEC v1.6; architecture v0.5; PRD v0.8 |
| 0.9 | 2026-11-02 | The delivery lead's answers of 2026-11-02 (AQP-26 10530 to 10537; AQP-1 10542 to 10557; AQP-15 10543; SPEC v1.10; architecture v0.8 sections 16.12 and 16.13). **Effort:** 87 to 130.75 h, central 108.875 h (v0.8: 87.5 to 131.5 h): the whole-order rule and parent change -3.25 to -5.25, Warn re-sized to 3.5 to 5.25, clearing every figure -0.75 to -1.5, and six additions +3.75 to +6.5 (rate notice, cancel approval and remove price, Last backup line, same-server backups, picture optional, no file until current), with the architect's 0.5 h high-end surplus held outside any epic. Epics re-split; R1 core 58.75 to 89.5 h. **Model:** the master data wait W is dropped (HOLD-01 met, D-23; DL-025) and no holiday is assumed (D-35); the term is now the backlog and G4 time. **Dates re-issued, not adopted:** central Thu 2026-11-26 (18.06 days, unchanged date), range Thu 2026-11-19 to Fri 2026-12-04 (unchanged), the central value 0.06 day over a boundary. Sensitivity, milestones, checkpoints, 3.5, 3.6 and the fit table recomputed; the Q-38 row and the 1 h rows removed (answered); a cut ladder step 4 added for FR-107 and FR-108. FR-105 firm and moved into the R1 core (CR-14); the usability test has its participants (2 Engineers, 2 Leads, 1 Admin, no names). Supersedes the v0.8 dates | AQP-26; AQP-1 10542 to 10557; AQP-15 10543; SPEC v1.10; architecture v0.8; PRD v0.9 |
| 0.10 | 2026-11-02 | Architecture v0.9 section 16.14 and AQP-1 10559, 10560. **Effort:** the Admin's guided restore command, its README and tests, **+1 to +1.5 h in EPIC-10**; the architect's 0.5 h high-end surplus of 10546 to 10554 is **dropped** against his rows (they sum to +3.5 to +6.25 h against his +3.75 to +6.5), and the file saving of EPIC-07 is taken as a range; scope A is 87.75 to 132 h, central 109.875 h (R1 core 59.5 to 91.25 h). **Dates:** the working-day figures are 13.72 / 18.18 / 24.25 and **no date moves** (Thu 2026-11-19, Thu 2026-11-26, Fri 2026-12-04); the central value sits 0.18 day over a boundary (v0.9: 0.06). Sensitivity, milestones (R2 complete Wed 2026-11-25), 3.6 and the fit table recomputed. **New human step:** the Admin's restore rehearsal before go-live, outside the dates (3.3, 7, 8). Section 1 and 9: the Admin holds the key, has server access and runs the restore. Supersedes the v0.9 working-day figures, not its dates | AQP-1 10559, 10560; architecture v0.9; PRD v0.10 |
| 0.11 | 2026-11-02 | Architecture v0.10. **Effort:** the architect corrected an addition error: his rows for AQP-1 10546 to 10554 sum to +3.75 to +6 h, not +6.5, so the v0.9 "held" 0.5 h and the v0.10 "dropped" 0.25 h at each end were never work. His corrected ends, with every saving read the same way, are applied: scope A is 88 to 131.75 h (v0.10: 87.75 to 132), central 109.875 h unchanged; R1 core 59.75 to 91 h; EPIC-07 back to 5.625 to 7.875 h. **The password step-up ships in R1 with FR-107 and FR-108**, with no change to the total; EPIC-08 reuses it. **Dates:** working-day figures 13.75 / 18.18 / 24.22; **no date moves** (Thu 2026-11-19, Thu 2026-11-26, Fri 2026-12-04). Only the figures that moved are restated: 2.2, 2.3, 3.1, 3.2, 3.6 and 4. Supersedes the v0.10 ends, not its dates | Architecture v0.10 (corrected total, section 16.14); PRD v0.11 |
| 0.12 | 2026-11-02 | G4 attempt 1 remediation 4 and the answers of 2026-11-02. **Merge model recalibrated (3.2, 3.3, 6.2):** the five stage waits are replaced by a simulation of the 89 stories through their dependencies, with one development stream; sprint 1's chain of 8 to 9 stories gives 7 merge waits against the 2 stage waits modelled, and the whole backlog has a chain of 21. M is now per pull request. **Ways of working set out in 3.3** (one PR per story as today; fixed merge times; stacked branches; bundled PRs; the orchestrator merging after G7 GO) for the delivery lead to choose, with dates for each; none adopted. **Effort:** +0.5 to +0.75 h (EPIC-10, `clear-copies.sh`), scope A 88.5 to 132.5 h, central 110.5 h. **Dates, way 1:** central Thu 2026-11-26 (unchanged), range Thu 2026-11-19 to Fri 2026-12-11 (high end moved from Fri 2026-12-04). Checkpoints re-stated by story; sensitivity rewritten with M as the main row; the Admin's retention is "up to 2 years, as the disk allows" (PRD NFR-013); the picture limit is under 204,800 bytes and the mail account is the company Microsoft 365 account. Supersedes the v0.11 dates | G4 attempt 1 (gate log), remediations 4 and 9; DL-038; RISK-008; AQP-1 10610; architecture v0.11; PRD v0.12 |
| 0.13 | 2026-11-03 | Master data names and units corrected by the delivery lead (chat of 2026-11-03, relayed; SPEC v1.13 sections 4.1 and 4.3; PRD v0.13): the Process Master has 15 items (`Plating-rate-per-sqin` added) and the scrap rate field is `Material-Scrap-Rate`. Q-42 answered: the plating rate is kept as data and a plating cost calculation is a possible later change; it is recorded as backlog candidate BC-01 (new 5.1) and a row in section 9. **No effort figure, scope or date changed**; every v0.12 date stands, still unadopted | AQP-1 10672; SPEC v1.13, D-38, D-39, D-40; PRD v0.13 |
| 0.14 | 2026-11-03 | **STORY-10.10 (AQP-169, 5 points) taken into the date model** (master DL-058, AQP-169 comment 10733; DL-056). **Effort:** +1.5 to +2.5 h in EPIC-10 (estimate, new 3.7), so scope A is 90.0 to 135.0 h, central 112.5 h (v0.13: 88.5 to 132.5 h, central 110.5 h); R1 core 61.75 to 94.25 h. **Dates:** the simulation was not re-run; v0.13 outputs plus the added effort as an upper bound give 13.43 / 18.56 / 29.94 working days. Central Thu 2026-11-26, range Thu 2026-11-19 to Fri 2026-12-11 and committed milestone Mon 2026-11-09 **do not move**; the high end holds by 0.06 day, inside the model's noise. Sections 2.2, 3.1, 3.2 (pointer), 3.6 and 4 restated. All dates remain unadopted estimates | AQP-169 comment 10733; AQP-169; sprint-01-plan.md; DL-056, DL-058 |
| 0.15 | 2026-11-04 | **STORY-10.13 (AQP-188, 5 points) taken into the date model** (DL-080, DL-081; new 3.8). **Effort:** +2.0 to +3.0 h in EPIC-10 (estimate), so scope A is 92.0 to 138.0 h, central 115.0 h (v0.14: 90.0 to 135.0 h, central 112.5 h). **Dates, upper bound:** AQP-169 and AQP-188 now stand in series before the stories they gate, so both merge waits count (3.7 had AQP-169 filling a wait): 14.18 / 19.87 / 32.32 working days; central Fri 2026-11-27 (was Thu 2026-11-26, 0.13 day from the boundary), low Fri 2026-11-20, high Wed 2026-12-16, outside the stated range by up to three working days, so the delivery lead is told. Sprint 1: 01.03, 01.05 and 01.08 move to the head of the stretch; 54 of 55 committed. Sections 2.2, 3.1, 3.2, 3.6 and 4 keep the v0.14 figures until the model is re-run at checkpoint A. All dates remain unadopted estimates | AQP-188 comments 10862, 10863; DL-080, DL-081; AQP-188 |
| 0.16 | 2026-11-05 | **STORY-10.14 (AQP-199, 3 points proposed) placed and taken into the date model** (master DL-095; RISK-023; new 3.9). **Targets confirmed** as drafted (median at most 5:00, p95 at most 7:00, stage 12 at least 40 % shorter, 0 flaky in five runs, runner minutes at most twice, the 9-minute line), as margin under the unchanged NFR-009 limits, with three clarifications. **Placement:** sprint 1, first in the stretch, Ready before the sprint 1 review, built in the first idle wait; moves to committed (AQP-89 steps out) if the nightly p95 passes 9 minutes first. **Effort:** +1.5 to +2.5 h in EPIC-10, scope A 93.5 to 140.5 h, central 117.0 h. **Dates, upper bound:** built in a wait, central 20.12 working days (Fri 2026-11-27 or Mon 2026-11-30, as v0.15 read); on the chain, high end Thu 2026-12-17. Sections 2.2, 3.1, 3.2, 3.6 and 4 keep the v0.14 figures until checkpoint A. All dates remain unadopted estimates | AQP-199; DL-095; RISK-023; PRF-02; DL-056 |
| 0.17 | 2026-11-05 | **DEF-015 (AQP-206) placed** (master DL-100; architect's approach, AQP-199 comment 10992, 2 points; new 3.10). **Its own defect fix after AQP-199 merges, not task T7 inside AQP-199:** the 12a/12 split would change what AQP-199's AC-2 measures; AQP-199 is mid-measurement and AQP-65 waits at G6 for its merge; DL-100 already excludes stalled runs from the evidence; the same lines of `ci.yml` rule out parallel pull requests. AQP-199 stays 3 points, committed stays 55 of 55; the defect is not pointed (as DEF-008, DEF-009, DEF-014), due before the end of sprint 1. **Effort:** +1.0 to +1.5 h in EPIC-10, scope A 94.5 to 142.0 h, central 118.25 h. **Dates, upper bound:** effort only, central Mon 2026-11-30, high end Thu 2026-12-17, no stated date moves from v0.16. No delivery-lead approval needed. Sections 2.2, 3.1, 3.2, 3.6 and 4 keep the v0.14 figures until checkpoint A. All dates remain unadopted estimates | DEF-015; AQP-206; DL-100; AQP-199 comment 10992 |
| 0.18 | 2026-11-05 | **AQP-199 accepted as built; staged CI targets; shard story placed** (AQP-199 comments 11003, 11004; test strategy v0.18; new 3.11). Measured: job -12 %, stage 12 -20 %, 0 flaky; the 5:00, 7:00 and -40 % targets (3.9) are missed, with the product-manager's part in it stated. **AQP-199 ACs restated:** AC-1 no numeric target; AC-2 stage 12 at least 15 % shorter (measured 20 %); the 5:00 QA check withdrawn. **Staged targets:** DEF-015 fix p95 at most 9:00 (no median target); shard step median at most 6:00 and p95 at most 7:00; NFR-009 limits unchanged. **Placement:** DEF-015 straight after AQP-199; the shard story (STORY-10.15, 3 points) first in the stretch, not committed, committed stays 55 of 55; no hold re-armed. **Third shard:** not now; if the median passes 6:00 or the p95 passes 7:00 after the shard step, the shard constant goes to three and the runner-minutes guard to 2.5x. AQP-65's one-width ruling accepted. **Effort:** +1.5 to +2.5 h, scope A 96.0 to 144.5 h, central 120.25 h. **Dates, upper bound:** central Mon 2026-11-30 or Tue 2026-12-01, high end Thu 2026-12-17 or Fri 2026-12-18; re-run the model at the sprint 1 review. No delivery-lead approval needed. All dates remain unadopted estimates | AQP-199 comments 11003, 11004; DL-095, DL-099, DL-100; RISK-023 |
