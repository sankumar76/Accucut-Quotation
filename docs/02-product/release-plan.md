# Release Plan — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 (Draft for G2) |
| Owner | product-manager |
| Date | 2026-11-01 |
| Status | **Proposal. Not agreed.** Input to Q-29 ([AQP-12](https://sankumar76.atlassian.net/browse/AQP-12)). Revised after the delivery lead replies to G1 conditions 1 to 3 |
| Companion | `docs/02-product/prd.md` (FR, NFR, assumption register, epics) |

## 1. What is fixed, what is labelled

| Item | Status | Source |
|------|--------|--------|
| Budget: no limit | Confirmed, delivery lead's own words | AQP-2 |
| Start date 2026-11-02 (Monday) | Confirmed, his own words | AQP-2 |
| 10 working days at 8 hours a day = 80 hours | Confirmed, his own words | AQP-2 |
| End date 2026-11-13 (Friday), Monday-to-Friday week | **Unconfirmed (UNC-h)**: rests on comment 10417. Counting Monday 2 to Friday 13 November gives exactly 10 weekdays, so the end date and the 10 days agree if the week is Monday to Friday | AQP-1 |
| What the date delivers (option a, b or c) | **Open, Q-29**; the working assumption is option (a): Release 1 built, deployed and ready for acceptance at G8; go-live, training and the parallel run follow (ASSUMPTION-45) | AQP-12 |
| Offline use in Release 1 | **Unconfirmed conflict (UNC-e, Q-18)**; the plan assumes internet-hosted only | AQP-11, AQP-1 |
| Quantity rule (UNC-d, Q-32) | Unconfirmed; SPEC §7.4 stays in force; FR-030 sits outside the core | AQP-13 |
| Public or Accucut holidays in the window | Not known, not verified (OQ-PM-02) | none |

Every hour and day figure below is an **estimate** by the product manager. There is no velocity or history for this team on this stack, and the estimate method (relative size converted to hours) is judgement, not measurement.

## 2. Releases

| Release | Name | Epics | What a user can do at the end | Brief goals |
|---------|------|-------|-------------------------------|-------------|
| **R1 (proposal)** | Assign, enter, calculate, approve, export | EPIC-01, 02, 03, 04, 05, 06, 07, 10 | Admin creates users and masters; Lead assigns a task; Engineer enters a part tree and presses Calculate and sees no cost; Lead views costs and formulas, approves and locks a price, unlocks if needed; Lead downloads the Excel file in the worksheet layout; the bell and Overdue tab show late work | GOAL-01, 02, 03, 04, 07 in full; GOAL-05 in part (no e-mail); GOAL-06 in part (no configuration control) |
| R1 stretch | Pulled in only if the core is on track | FR-014, 035, 039, 054, 057, 088; FR-018 only if UNC-b is confirmed | Propagation prompt for process defaults, Lead default filter, task filters, autosave, completeness count, loading and empty states | Same |
| R1 conditional | Only if the delivery lead confirms | FR-030 (UNC-d) adds 2 to 3 h to the core; FR-018 (UNC-b) | Quantity roll-up; "Not applicable" entries | GOAL-03 |
| **R2** | Admin control and alerts | EPIC-08, EPIC-09 (FR-003, 006, 019, 040, 072 to 084) | Admin changes fields and formulas with re-lettering, versions, checkpoints and change history; e-mail alerts and the 11:00 IST digest; password reset by e-mail; task reassign | GOAL-05, GOAL-06 in full |
| **R3** | Later | EPIC-11 (FR-090, 097) | Dark mode; UI-sample extras. Offline use and drawing input only if the delivery lead schedules them | GOAL-07 |

SPEC §14 acceptance criteria by release: **R1** meets 1, 2, 3, 4, 5, 12, 13, 14, and 10 if FR-014 is reached; **R2** meets 6, 7, 8, 9, 11. The SPEC says every criterion is a hard requirement; this split means the SPEC is not fully met until Release 2.

What the SPEC §13 order looks like in the split:

| SPEC §13 step | Release | Note |
|---------------|---------|------|
| 1 Scaffold, auth, users, roles, shell, About | R1 (EPIC-01) | |
| 2 Masters, Settings | R1 masters (EPIC-02); Settings and alerts switch in R2 | Settings only controls e-mail |
| 3 Registry, seed, formula engine | R1 (EPIC-03) | The engine and seeded registry; no editing screen |
| 4 Tasks, queues, overdue, bell | R1 (EPIC-04) | |
| 5 Estimate workspace | R1 (EPIC-05) | |
| 6 Cost view, approval, lock, unlock | R1 (EPIC-06) | |
| 7 Excel export | R1 (EPIC-07) | |
| 8 Admin configuration UI | **R2** (EPIC-08) | The seed covers today's worksheet |
| 9 E-mail alerts and scheduled jobs | **R2** (EPIC-09) | SMTP details do not exist yet (Q-18) |
| 10 Polish, accessibility, E2E, Docker, README | R1 for the screens delivered (EPIC-10); repeated for R2 screens | Responsive and accessible are built in from step 1, not left to step 10 |

## 3. Does it fit 10 working days? (estimate)

### 3.1 Capacity

Total window: 10 days × 8 h = 80 h (confirmed). The clock is assumed not to pause at human gates (OQ-PM-01) and no holidays are assumed (OQ-PM-02).

| Activity before development (estimate) | Hours | Reasoning |
|----------------------------------------|-------|-----------|
| Close G2 after the delivery lead's reply, revise PRD | 2 to 3 | Short document change; master decision |
| UX (screens, 14 or so, and spec) and architecture run in parallel; the longer one sets the elapsed time | 6 to 8 | Gate log: no UX or architecture work before G2; the HTML screens exist as a sample to build on |
| G3 package, delivery lead's review, fixes | 3 to 6 | Human gate; his wait time is unknown |
| Master data stop after G3 approval (TR-009, HOLD-01) | 2 to 4 | Human stop; his wait time is unknown |
| Backlog: epics, stories, G4 | 4 to 6 | Product-owner and scrum-master work |
| **Pre-development total** | **17 to 27** | |
| Close-out: G8 pack, release notes, README check, human sign-off | 4 to 6 | G8 is a human gate |
| **Overhead total** | **21 to 33** | |
| **Development capacity** (80 − overhead) | **47 to 59 h** | About six working days |

### 3.2 Demand

Effort per epic includes development, the three reviews and QA for each story, and excludes the wait for the delivery lead to merge each code pull request (see 3.4).

| Epic | Release | Effort (h, estimate) | Midpoint |
|------|---------|----------------------|----------|
| EPIC-01 Foundation, access, confidentiality | R1 core | 4 to 6 | 5 |
| EPIC-02 Masters (without propagation prompt) | R1 core | 4 to 6 | 5 |
| EPIC-03 Registry and calculation engine | R1 core | 7 to 10 | 8.5 |
| EPIC-04 Tasks and queues | R1 core | 3 to 5 | 4 |
| EPIC-05 Estimate workspace | R1 core | 10 to 14 | 12 |
| EPIC-06 Cost review and approval | R1 core | 5 to 7 | 6 |
| EPIC-07 Excel export | R1 core | 5 to 7 | 6 |
| EPIC-10 Experience, brand, delivery (E2E, accessibility, Docker, README, tags) | R1 core | 5 to 7 | 6 |
| **R1 core** | | **43 to 62** | **52.5** |
| R1 stretch (FR-014, 018, 035, 039, 054, 057, 088) | R1+ | 6.5 to 10.5 | 8.5 |
| FR-030 quantity roll-up (only if UNC-d is confirmed) | R1\* | 2 to 3 | 2.5 |
| EPIC-08 Admin configuration | R2 | 12 to 16 | 14 |
| EPIC-09 Alerts and jobs, plus FR-006 and FR-040 | R2 | 7.5 to 10.5 | 9 |

### 3.3 Result

| Scope | Development hours | Plus overhead 21 to 33 | Working days (80 h = 10 days) | Fits 10 days? |
|-------|-------------------|------------------------|-------------------------------|---------------|
| Full SPEC (R1 core + stretch + R2) | 69 to 99 (+ FR-030 if confirmed) | 90 to 132 h | **about 11 to 17 days** | **No.** Exceeds the window even at the low end |
| R1 core + stretch | 49.5 to 72.5 | 70.5 to 105.5 h | about 9 to 13 days | **No** in general; fits only if every estimate lands at the low end |
| **R1 core only (proposal)** | **43 to 62** | **64 to 95 h** | **8.0 to 11.9 days; midpoint about 9.9 days** | **Borderline.** At the midpoint it uses the whole window with no contingency. Fits at the low end, misses at the high end. I rate the risk of missing 2026-11-13 as High (RISK-003 stays High) |
| R1 core with the cut ladder in 4.1 applied | 39 to 55 | 60 to 88 h | 7.5 to 11.0 days | Better odds; still not safe at the high end |

Reasoning for the split. (1) Steps 1 to 7 are the shortest path that gives the primary outcome and each later step depends on the one before; none can be dropped without removing a step of the flow. (2) Step 8 is the largest single block (12 to 16 h) and is not needed to run today's worksheet, because the registry is seeded; if the Admin must change a formula before Release 2, a developer changes the seed. (3) Step 9 needs SMTP details that nobody has supplied (Q-18), so it could not be finished in Release 1 even with time. (4) Step 10's accessibility, responsive and security tests are kept in Release 1 because three of the SPEC §14 criteria (1, 13, and by implication 4) are tests, and building without them would mean rebuilding screens later. (5) Nothing in the core is padded: the core needs about 99 % of the midpoint capacity.

**Rule not met.** The product-manager rule that Musts stay at about 60 % of MVP effort is breached: the 63 core Musts need about 99 % of development capacity at the midpoint (73 to 132 % across the ranges). It cannot be met without cutting a step of the primary outcome. It is flagged for `master` and the delivery lead rather than hidden.

### 3.4 Process effects the estimate does not capture

- **Code pull requests wait for a human merge** (`MERGE_POLICY = docs-auto, code-human`). One pull request per story puts many merge decisions inside about six development days. Any wait adds elapsed time that is not in the effort figures.
- **The docs pull request cannot be created (BLK-01, 403)**; story branches start after it is merged at G4.
- **Parallel work.** The epics are costed in sequence. After EPIC-01, EPIC-02, 03 and 04 are independent and could run as parallel streams if the orchestrator can run developers in parallel; EPIC-06 and EPIC-07 are independent after EPIC-05. Parallelism would shorten elapsed time but not effort, and human merges would still serialise. It is not assumed.
- **Estimate quality.** The first completed epic gives the first real actual (checkpoint A below).

## 4. Provisional calendar (illustration at the middle of the pre-development range)

Illustration only. It assumes the delivery lead replies before Monday 2 November so G2 can close on day 1, and that each human gate is answered within the hours shown.

| Day | Date | Planned activity | Human involvement |
|-----|------|------------------|-------------------|
| 1 | Mon 2 Nov | G2 closes; PRD revised; UX and architecture start | Reply to G1 conditions 1 to 3 (before G2) |
| 2 | Tue 3 Nov | UX and architecture complete; G3 package | none |
| 3 | Wed 4 Nov | G3 review and approval; then master-data stop; backlog and G4 work starts | **G3 approval; master data defaults** |
| 4 | Thu 5 Nov | G4; development starts: EPIC-01, 02, 03, 04 | Docs PR created or opened by hand (BLK-01) |
| 5 | Fri 6 Nov | EPIC-03, 04 continue | Code PR merges |
| 6 | Mon 9 Nov | EPIC-05 starts | Code PR merges |
| 7 | Tue 10 Nov | EPIC-05 | Code PR merges |
| 8 | Wed 11 Nov | EPIC-05 completes; EPIC-06 starts | Code PR merges |
| 9 | Thu 12 Nov | EPIC-06, EPIC-07, EPIC-10 tests | Code PR merges |
| 10 | Fri 13 Nov | Close-out; G8 pack; release notes | **G8 sign-off** |

On this calendar development has six days (Thu 5 to Thu 12 November, 48 h), which sits inside the 47 to 59 h model range (pre-development takes 24 h here). Against the core midpoint of 52.5 h that is a shortfall of about 4.5 h; at the core low end (43 h) it fits with 5 h to spare; at the high end (62 h) it is 14 h short.

### 4.1 Cut ladder and checkpoints

Checkpoint A, end of day 7 (Tue 10 Nov): is EPIC-05 at least half done and are EPIC-01 to 04 done? Checkpoint B, end of day 9 (Thu 12 Nov): are EPIC-05 and 06 done and EPIC-07 under way? If either answer is no, apply the next step below in order; each is a scope decision for the delivery lead (via `product-manager`, logged in the decision log), not an automatic cut.

| Step | Cut | Hours saved (estimate) | Outcome lost |
|------|-----|------------------------|--------------|
| 0 | Do not start any stretch item or FR-030 | 0 (already outside the core) | none |
| 1 | Move FR-063 Unlock and the Closed-to-Open task reopen (FR-038 part) to Release 2 | 1 to 2 | An approved estimate cannot be reopened; a wrong approved price cannot be corrected in Release 1 |
| 2 | Move FR-058's six-stage accordion and formula display (and FR-060) to Release 2; Lead sees the inputs, the final cost per node and the totals only | 1 to 2 | Lead cannot see the arithmetic behind a price |
| 3 | Move FR-047 part pictures (and export column C images) to Release 2 | 2 to 3 | Parts are not identified visually; SPEC §14.12 export check on images fails |

Steps 1 to 3 together save 4 to 7 h (shown in 3.3 as 39 to 55 h). The following are not cut candidates in this plan: cost confidentiality (FR-007, 008), the calculation and its tests (FR-020 to 029, 031), approve and lock (FR-062), the export itself (FR-066 to 070), and the responsive and accessibility tests (FR-085, NFR-016, NFR-018).

## 5. Human gates, stops and who waits for whom

| Point | Type | Effect on the plan |
|-------|------|--------------------|
| Reply to G1 conditions 1 to 3 | Delivery lead | G2 cannot pass before it; no UX or architecture work starts before G2 (gate log) |
| G2 | `master`, not a human point (`HUMAN_APPROVAL_POINTS` = G1, G3, G8) | Held until the reply |
| G3 | **Human** | UX and architecture package reviewed by the delivery lead |
| Master-data stop (TR-009, HOLD-01) | **Human**, process stop outside `CLAUDE.md` | Development does not start until defaults are provided |
| G4 | `master` | Needs the docs PR (BLK-01) |
| Each story G5 to G7 | Agents | Three reviews and QA per story |
| Each code PR merge | **Human** (`MERGE_POLICY`) | See 3.4 |
| G8 | **Human** | Last day |

## 6. Dependencies by release

| Release | Dependency | Owner | Status |
|---------|-----------|-------|--------|
| R1 | Answers on G1 conditions 1 to 3 (Q-29, Q-32 and the UNC items) | Santhosh | Open |
| R1 | Master data defaults | Santhosh | Stop after G3 |
| R1 | Cleaned sample worksheet or reading rights on the original (Q-30) | Santhosh | Open |
| R1 | Hosting target, web address, IT contact (Q-18) | Santhosh, IT | Open |
| R1 | Docs PR (BLK-01) | Santhosh | Open |
| R1 | Logo file in `docs/03-ux/assets/` | Santhosh | Present |
| R2 | SMTP service and sender address | Accucut IT | Open |
| R2 | Release 1 live so that Admin configuration is tested against real use | Delivery team | Follows R1 |
| Go-live (Q-29 options b) | First users, training, parallel run of real past estimates (TR-003 to TR-005) | Santhosh, Accucut | Not in the Release 1 proposal |

## 7. What Q-29 decides in this plan

The three meanings in AQP-12 give these consequences (facts, not a recommendation of an answer):

| If the date means | Consequence for this plan |
|-------------------|---------------------------|
| (a) Release 1 built, deployed and ready for acceptance at G8 | The R1 core above; High risk of missing; cut ladder available |
| (b) Production go-live | Master data entry, user creation, training and the parallel run (TR-003 to TR-005) are added to the same window. They are not estimated here (no information on who trains or how many estimates); the Release 1 content would shrink beyond the cut ladder |
| (c) A first usable part, the rest later | This proposal is built for (c); it still does not fit comfortably |

If the delivery lead accepts the full SPEC for the same date, the estimate in 3.3 says it needs about 11 to 17 working days. Either the scope or the date has to give; the estimate is an estimate and can be recalibrated at checkpoint A.

## 8. Effect of each unconfirmed item on this plan

| Item | If confirmed as proposed | If rejected |
|------|--------------------------|-------------|
| UNC-a BN divisor | Divisor changes in FR-025; no effect on hours | A replacement rule is needed because the SPEC rule is incomplete (prd 9.1); small effect |
| UNC-b "Not applicable" | FR-018 added, 0.5 to 1 h | FR-018 withdrawn |
| UNC-c recalculation after unlock | FR-063 as written | FR-063 follows his rule; no hours effect expected |
| UNC-d quantity multiplication | FR-030 built, +2 to 3 h to the core, which worsens the fit | FR-030 withdrawn; oracle stays the worksheet |
| UNC-e / Q-18 offline | Offline stays out of R1 | Offline joins R1; the plan cannot fit 10 days |
| UNC-f | none | Switch becomes a Could |
| UNC-g | none | Single FRs change; hours effect small each |
| UNC-h end date | none | Capacity rescales at 8 h per working day |

## 9. Change Log

| Version | Date | Change | Reason |
|---------|------|--------|--------|
| 0.1 | 2026-11-01 | First proposal | G2 input; Q-29 |
