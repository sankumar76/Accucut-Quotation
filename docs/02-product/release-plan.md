# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.13 (Draft; master data names and units corrected by the delivery lead (SPEC v1.13, AQP-1 10672): no effort, scope or date changed. A plating cost calculation is recorded as backlog candidate BC-01 in 5.1: a possible later change, not Release 1, not estimated. Version 0.12: G4 attempt 1 remediation 4 and the answers of 2026-11-02 applied. **The merge model is recalibrated** from the story graph: 89 candidate stories (18 in Jira), a chain of 21 stories in a line, and sprint 1's own chain of 8 to 9 stories, which means 7 merge waits against the 2 stage waits modelled before. The ways of working that change the date are set out in 3.3 for the delivery lead to choose. **Effort:** +0.5 to +0.75 h in EPIC-10 for the guided `clear-copies.sh`: scope A is **88.5 to 132.5 h, central 110.5 h**. **Dates (the way of working as it is today, one PR per story merged by the delivery lead within half a day):** central **Thu 2026-11-26** (unchanged), range **Thu 2026-11-19 to Fri 2026-12-11**; the high end moves a week because the model now charges every merge wait. The date depends on how fast each PR is merged: 0.25 day gives Tue 2026-11-24, 1 day gives Wed 2026-12-09. All of this is an estimate and none of it is adopted by the delivery lead) |
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
| Development effort (estimate) | 88.5 to 132.5 h, central 110.5 h (v0.11: 88 to 131.75 h, central 109.875 h). **Not in:** the forced password change after an Admin-set password (OQ-UX-15) and the password step on an Admin hand-over (OQ-UX-17), under 0.75 h together (estimate); a refused SMTP sign-in (about 4 h, architect). See the sensitivity rows in 3.4 |
| **Central date** | **Thursday 2026-11-26** (v0.11: the same) |
| **Range** | **Thursday 2026-11-19 to Friday 2026-12-11** (v0.11: to Friday 2026-12-04) |
| Working days from 2026-11-02 | central 19 (range 14 to 30); unrounded 13.24 / 18.31 / 29.63 |
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
| EPIC-10 Experience, brand, delivery (incl. the CI gates, secret and repository scan and design tokens, which no estimate itemised; the guided restore command, its README and tests, 1 to 1.5; the guided `clear-copies.sh`, 0.5 to 0.75) | R1 core | 8 to 12.5 | 10.25 | +0.5 to +0.75: `clear-copies.sh` (architecture v0.11, 9.5), on top of the restore command and the free-space check |
| **R1 core** | | **60.25 to 91.75** | **76** | v0.11: 59.75 to 91 (75.375); +0.5 low, +0.75 high |
| R1+ stretch: FR-014 (2 to 3), 035, 039, 054, 057, 088 | R1+ | 6 to 9.5 | 7.75 | 0 |
| EPIC-08 Admin configuration | R2 | 11.75 to 15.75 | 13.75 | -0.25: no ROLLUP warning on the formula check. Its password re-entry (FR-080) reuses the step-up built in EPIC-06; any shift between the two epics is inside their ranges |
| EPIC-09 Alerts and jobs, plus FR-003, 006, 040 | R2 | 10.5 to 15.5 | 13 | 0 |
| Checked against the architect's rows | | 0 | 0 | **Closed.** The +6.5 the architect first published for 10546 to 10554 was an addition error: his rows sum to +3.75 to +6 (additions of 4 to 6.5, less the file saving of 0.25 to 0.5). No row is missing and nothing is held. The v0.9 "held" 0 to 0.5 h and the v0.10 "dropped" 0.25 h at each end are both gone |
| **Scope A total** | | **88.5 to 132.5** | **110.5** | v0.11: 88 to 131.75 (109.875); +0.5 low, +0.75 high |

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

Not with scope A in any way of working modelled. The quickest case, way 5 at the low effort (88.5 h), ends Wed 2026-11-18 (12.56 working days). For information only, because scope B was not chosen: the core epics alone, with way 1 at the centre, end about Wed 2026-11-25 (17.25 working days), a day before the full scope, because in the full scope the R2 stories fill the merge waits. I do not consider 2026-11-13 reachable.

## 4. Fit analysis against the target (estimate)

The target is 80 hours (10 days x 8 h). The date is a target and not a blocker, so the analysis states how far scope A is from it and what the fit rule says. **The low end of the effort, 88.5 h, is above the 80 h itself.**

| Scope | Effort | Elapsed working days (low / central / high) | Against the 10-day target |
|-------|--------|---------------------------------------------|----------------------------|
| A (adopted): R1 core + R1+ + R2, way 1 | 88.5 to 132.5 h | 13.24 / 18.31 / 29.63 | Misses by 4 to 20 working days; central 9 days over |
| v0.11 for comparison (same scope, stage waits) | 88 to 131.75 h | 13.75 / 18.18 / 24.22 | Misses by 4 to 15 working days; central 9 days over |

**The "Must at most about 60 % of MVP effort" rule is not met.** Scope A: Musts are about 90 to 91 % of the effort (about 7.75 to 12.5 h of Should across FR-003, 006, 035, 039, 040, 041, 054, 057, 071, 088, 103; FR-105 to FR-108 are Musts by the delivery lead's decision). The R1 core alone is about 97 % Must or a little more. The split of hours between Must and Should is a rough estimate. The rule cannot be met without removing SPEC MUST items or decisions of the delivery lead; the cut ladder in 6.1 moves Musts to a later stage but does not lower the Must share of what is built. What stands in for the rule: the date is a range with its assumptions stated, the build order puts the core first, and checkpoints re-issue the date. This is a recorded deviation (DL-002) for the master and the delivery lead to weigh.

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
