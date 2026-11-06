# Product Backlog: Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.4 (2026-11-02, G4 remediation 2: SPEC v1.12, PRD v0.11 to v0.12, UX v0.7, architecture v0.11, test plan v0.2, release plan v0.12; v0.3 was against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10, test plan v0.1, release plan v0.11) |
| Owner | product-owner |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10, 101 FRs |
| Source of truth | Jira project AQP. This file is the ordered view. **The stories below are candidates with provisional IDs**; the scrum-master creates them in Jira (label `aiid-STORY-NN.MM`) and the product-owner validates each against the Definition of Ready. Ranks 1 to 18 now exist in Jira as AQP-27 to AQP-148 (sprint 01, all Draft) and were validated against the Definition of Ready on 2026-11-02 (section 7). No other story exists |
| Companions | `consistency-report.md` (v0.4), `sprint-01-plan.md` (scrum-master, v0.3), `epics/EPIC-01` to `EPIC-10` |
| Development | HOLD-01 is met (D-23, DL-025). Development does not start before G4 and the master's rulings below |

## 1. What changed

**Added by the scrum-master, 2026-11-05 (an enabler for an existing NFR, DL-056, DL-095, DL-097):**
- **STORY-10.14, cut CI feedback time (enabler), row 12c, Jira AQP-199, 3 points.** PRF-02 and RISK-023: the median of the required job is 6 min 02 s and the p95 8 min 01 s over the last 20 pull-request runs. Four Playwright workers in CI and `@one-width` tests in four ruled spec files; one job, the required check unchanged. First in the sprint 01 stretch, so committed stays 54 of 55. **Product-owner result, 2026-11-05: NOT READY, 16 of 17 on the first pass; READY, 17 of 17, on the re-check (revision 3)** (section 7). The scrum-master moves it to Ready for Dev.

**Added by the scrum-master, 2026-11-04 (an enabler, ruled not product scope by DL-056 and DL-080; accepted by the product-manager, DL-081):**
- **STORY-10.13, first-load JS headroom (enabler), row 12b, Jira AQP-188, 5 points**, the #61 cut: the account menu and the mobile drawer load on first open, and a tap made before the page is interactive is kept (DEF-013, AQP-197). Candidates are now 92 (91 with 10.13 on 2026-11-04; 10.14 added 2026-11-05). It is committed, in series after 12a, and blocks every story that adds client JavaScript to a signed-in route. AQP-57, AQP-81 and AQP-90 (9 points) moved to the head of the sprint 01 stretch to keep the commitment at 54 of 55. **Product-owner result, 2026-11-04: NOT READY at 15 of 17, then 16 of 17 twice; READY, 17 of 17, on the third re-validation (description revision 6)** (section 7). The scrum-master moves it to Ready for Dev.

**Added by the scrum-master, 2026-11-03 (a scope addition for the product-manager and the master, not a product-owner version):**
- **STORY-10.10, the NFR-009 guards (enabler), row 12a, Jira AQP-169, 5 points**, carved out of 10.09 on the solution-architect's test strategy v0.13 section 10.4 and the master's G6 decision on AQP-28 (DL-053, RISK-020, issue #36). 10.09 keeps NFR-010 to 012 and NFR-024. It is the first story of the sprint 01 stretch and must be Done before 02.01 reaches G6. Candidates are now 90. The product-owner validated it READY, 17 of 17, on 2026-11-03 (AQP-169 comment 10726), and the scrum-master moved it to Ready for Dev.
- **The privacy story is renumbered 10.12** (row 67), because 10.10 was its provisional ID. It is not in Jira.

**Since v0.3 (G4 attempt 1 was NO-GO; remediation 2):**
- **Definition of Ready re-validated on all 17 items, not 16.** The item missed was the business-rule item. All 18 sprint 01 stories are READY (section 7); 11 needed a Trace-line correction, made by the product-owner and disclosed.
- **Section 4 now agrees with section 5.** The v0.3 top-10 table had 03.01, 03.02 and 02.01 at ranks 8 to 10, but section 5 (and the Jira ranks in the stories) put them at 11 to 13 after 01.05, 01.06 and 01.08. The table now follows section 5.
- **Story 10.05 (row 59)** gains `clear-copies.sh` (AQP-1 10614, 10620, 10621): see the row.
- **Closed or settled:** CR-23 (master, DL-027 to DL-038), CR-32 (UX v0.7), CR-33 (architecture v0.11, one test-plan sentence left), CR-34, CR-35.
- **Hours:** PRD v0.12 and release plan v0.12 give scope A as 88.5 to 132.5 h, central 110.5 h (the extra 0.5 to 0.75 h is `clear-copies.sh`).

**Since v0.2 (2026-11-02, later):**
- **The password step-up is its own story.** STORY-06.14 (enabler, EPIC-06) is ranked before 06.12 (cancel approval) and 06.13 (remove price). It had been an item inside 06.12. PRD v0.11 and architecture v0.10 ship the step-up in R1 for those two actions, and 01.09, 08.02, 08.04 and 08.06 reuse it. No hours move: the 2.75 to 4 h of 06.12 and 06.13 includes it (release plan 3.1). Candidates are now 89.
- **Hours:** PRD v0.11 and release plan v0.11 give scope A as 88 to 131.75 h, central 109.875 h; EPIC-07 is back to 5.625 to 7.875 h. No date moves.
- **Closed:** CR-09 (generator committed, the delivery lead accepts the ten numbers), CR-20 (test plan v0.1), CR-22, CR-24, CR-26 and CR-29 (see the consistency report v0.3), CR-30 (the delivery lead keeps the disk at 40 GB).
- **Dependencies of the 18 sprint stories confirmed, and nine more found** (section 7).

**Since v0.1:**
- **The roll-up story shrank to a seed formula and its cases.** BL is `SUM(BG)` and the Engineer types the count for the whole order on every row (D-12 as rewritten, AQP-26). STORY-03.04 is 0.5 to 0.75 h and **no story is held** by AQP-14, AQP-15 or AQP-26 any more. Every Held mark of v0.1 is cleared; the Jira "blocks AQP-18" links from AQP-14 and AQP-15 remain only because the tools here cannot remove them (CR-31).
- **Stories added for FR-104 to FR-108:** 05.12 (Warn at Calculate), 06.10 (Warn for Lead and Admin), 07.06 (Warn notice on the export preview), 06.11 (rate-change notice), 06.12 (cancel approval), 06.13 (remove price), 02.09 (Settings page with the Last backup line), 10.11 (the Admin's guided restore). 80 candidates became 88.
- **Stories reshaped:** 02.06 ("Not applicable" shown to everyone), 05.07 (picture optional), 05.03 (hint under QTY per Assy), 07.04 (download refused until a calculation is current; the out-of-date file is not built), 06.04 and 06.08 (every figure clears; the earlier price stays labelled).
- **Order corrected:** 05.09 (Calculate) now follows 03.05 (the calculation record); v0.1 had them the other way round.

## 2. FRs mapped (exactly one epic each)

Scripted against PRD v0.10 section 4: 108 FR rows, 0 duplicates, 0 unmapped. Scope A is 101 FRs (Must 90, Should 11), equal to PRD 6.2.

| Epic | Jira | FRs | Count |
|------|------|-----|-------|
| EPIC-01 Foundation, access, confidentiality | AQP-16 | 001, 002, 004, 005, 006, 007 to 011, 098, 099 | 12 |
| EPIC-02 Masters and settings | AQP-17 | 012 to 018, **105** | 8 |
| EPIC-03 Registry and calculation engine | AQP-18 | 020 to 031 | 12 |
| EPIC-04 Task assignment and queues | AQP-19 | 032 to 041, 102 | 11 |
| EPIC-05 Estimate workspace | AQP-20 | 042 to 057, **104** | 17 |
| EPIC-06 Cost review and approval | AQP-21 | 058 to 065, 100, 101, 103, **106, 107, 108** | 14 |
| EPIC-07 Excel export | AQP-22 | 066 to 071 | 6 |
| EPIC-08 Admin configuration | AQP-23 | 072 to 080 | 9 |
| EPIC-09 E-mail alerts and jobs | AQP-24 | 003, 019, 081 to 084 | 6 |
| EPIC-10 Experience, brand, delivery | AQP-25 | 085 to 089, 091 | 6 |
| **Scope A** | | | **101** |
| EPIC-11 Later (no Jira epic) | | 090, 097 | 2 |
| EPIC-12 Offline (no Jira epic) | | 092 | 1 |
| Not planned | | 093 to 096 | 4 |

Rulings that make the map exact: FR-003 and FR-019 to EPIC-09 (PRD section 7); FR-006 to EPIC-01 and FR-040 to EPIC-04 (their effort stays in EPIC-09); FR-090 to EPIC-11; **FR-104 to EPIC-05 (the Engineer's Calculate), its work shared with 06.10 and 07.06; FR-105 to EPIC-02 (PRD section 7), the Settings page frame it needs being the product-manager's hours in EPIC-09 (CR-26)**; FR-106, 107, 108 to EPIC-06.

## 3. Epics in order

| Rank | Epic | Jira | Stage | Value (PRD) | Effort h (estimate) | Jira priority | Status |
|------|------|------|-------|-------------|---------------------|---------------|--------|
| 1 | EPIC-10 enabler slice (stories 10.01, 10.02) | AQP-25 | R1 core | enabler | inside EPIC-10 | High (epic) | Draft |
| 2 | EPIC-01 Foundation, access, confidentiality | AQP-16 | R1 core | 5 | 5.75 to 9.5 | Highest | Draft |
| 3 | EPIC-02 Masters and settings | AQP-17 | R1 core, R1+ | 4 | 5.75 to 9.5 (+2 to 3) | High | Draft |
| 3 | EPIC-03 Registry and calculation engine | AQP-18 | R1 core | 5 | 9 to 13.625 | Highest | Draft; nothing held |
| 3 | EPIC-04 Task assignment and queues | AQP-19 | R1 core, R1+, R2 | 4 | 3.25 to 5.75 (+1.5 to 2.5) | High | Draft |
| 4 | EPIC-05 Estimate workspace | AQP-20 | R1 core, R1+ | 5 | 11.75 to 17.125 (+1.5 to 2.5) | Highest | Draft |
| 5 | EPIC-06 Cost review and approval | AQP-21 | R1 core | 5 | 11.125 to 15.875 | Highest | Draft |
| 6 | EPIC-07 Excel export | AQP-22 | R1 core | 4 | 5.625 to 7.875 | High | Draft |
| 7 | EPIC-10 remainder | AQP-25 | R1 core, R1+ | 4 | 7.5 to 11.75 (+1 to 1.5) | High | Draft |
| 8 | R1+ stretch (inside EPIC-02, 04, 05, 10) | | R1+ | | 6 to 9.5 | | Build only if the core is on track (checkpoint B) |
| 9 | EPIC-08 Admin configuration | AQP-23 | R2 | 3 | 11.75 to 15.75 | Medium | Draft |
| 10 | EPIC-09 E-mail alerts and jobs | AQP-24 | R2 | 3 | 10.5 to 15.5 | Medium | Draft; mail facts needed |
| | **Scope A total** | | | | **88 to 131.75, central 109.875** (release plan v0.11; v0.10 said 87.75 to 132) | | |

Hours are the product-manager's estimates with no velocity behind them; no date is adopted. Jira priority follows the PRD value score (5 Highest, 4 High, 3 Medium). Epic dependencies are Jira "blocks" links (AQP-16 to AQP-17, 18, 19; AQP-17, 18, 19 to AQP-20; AQP-18, 20 to AQP-21; AQP-20, 21 to AQP-22; AQP-18 to AQP-23; AQP-19 to AQP-24). AQP-25 is ranked before AQP-16.

## 4. Why this order (top 10 stories)

Value, risk reduction, dependencies and learning. The first ten stories carry no open question.

| Rank | Story | Why here |
|------|-------|----------|
| 1 | 10.01 Scaffold, CI and repository hygiene | Prerequisite for every story, and it installs the secret and repository scan that protects a public repository before any master data can arrive (RISK-006, NFR-006). Enabler, justified in EPIC-10; contents listed in architecture 16.11 |
| 2 | 10.02 Design tokens and responsive app shell | Every screen story needs one design system at three widths (NFR-016 to 021). The real-phone, screen-reader and high-contrast checks (DL-017) attach to the first built page. Enabler |
| 3 | 01.01 Sign in and sign out | First user-visible slice through UI, API and data; proves the stack end to end |
| 4 | 01.02 Role enforcement and navigation | The route manifest that makes the main promise (GOAL-02) enforceable; cheaper to start with than to retrofit |
| 5 | 01.03 Engineer sees no cost: projection and scan | The riskiest promise (ARCH-R2). The projection and the build-time scan must exist before any cost-bearing view, so every later story, the Warn dialog included, is born under the scan |
| 6 | 01.04 Admin creates users; one Admin | An Engineer and a Lead must exist; small |
| 7 | 01.07 Audit service and screen | Masters, approval, the quantity warning, cancel approval and remove price all write to it |
| 8 | 01.05 Password rule and change own password | One rule at every place a password is set, and the forced change for a password the Admin gave. Needs 01.01 and 01.04, so it follows them; small |
| 9 | 01.06 12-hour session | Closes the sign-in loop (a session that ends, plainly told). Needs 01.01 and 01.02 (the error model and the system pages); 2 points |
| 10 | 01.08 About page | One read-only screen (FR-010) that exercises the manifest and the Engineer scan on a page every role reaches; 1 point. It needs 01.02 and 01.03, so it cannot come earlier |

Ranks 11 to 13 are also in sprint 01: **03.01** Registry seed and column letters (11; starts the engine early, independent of masters), **03.02** Formula engine (12; the highest-uncertainty item in R1, which gives checkpoint A an honest first data point) and **02.01** Process Master (13; feeds the first calculation, 03.03, and exercises the audit service). They are ranked after the access stories because the access stories are small and unblock every page, while 03.01 only needs 10.01 and moves up if the team wants the engine's uncertainty reduced first; that swap is the scrum-master's to propose, not a silent change. Ranks 14 to 18 are the other masters and assignment (02.03, 02.04, 02.05, 02.02, 04.01).

**Ranks 12a and 12b (added 2026-11-03 and 2026-11-04) sit between 12 and 13 because they are predecessors, not because they carry value of their own.** 12a (the JS budget check) measures; 12b (the lazy account menu and drawer) restores 10,000 B or more of headroom on every signed-in route, where `/queue` has 1,640 B left (RISK-020, PRF-04). Under DL-080 no story that adds client JavaScript to the portal frame or a signed-in route starts development before 12b merges, so 12b is placed after 01.01 (which 12a needs) and before 01.02 in execution order, even though its rank number is 12b. Execution order in sprint 01 is in `sprint-01-plan.md` v0.6: 10.01, 10.02, 01.01, 10.10, 10.13, 01.02, 01.04, 01.07, 01.06, with 03.01 and 03.02 as the independent engine chain. The stretch now begins 01.03 (rank 5), 01.05 (rank 8) and 01.08 (rank 10), which keep their ranks here: none is a predecessor of a committed story, and 01.03 must be Done before any cost-bearing story starts (Jira links). Learning: 12b is the first story to test the overlay rule (architecture section 10), so the later dialogs follow a measured pattern.

Stories 19 to 36 take the walking skeleton (03.03, one row end to end) through the calculation record, the product total, assignment, the workspace, Calculate and Warn. **The product total (03.04, rank 21) is no longer a critical-path risk:** it is a seed formula and its constructed cases. The longest chain is now 03.05, 05.09, 06.02, 06.04, 06.06, 06.14, 06.12, 06.13 and 07.03 to 07.04. Ranks 48 and 49 (cancel approval, remove price) are cut-ladder step 4 in the release plan: the delivery lead's to cut, 2.75 to 4 h. The step-up check (rank 47) is not cut with them while R2 needs it for formula save, field delete, revert and the Admin hand-over.

## 5. Ordered stories (candidates)

Status: **Draft** = to be written by the scrum-master. There is no Held story. A note in the last column names an input that is still open but does not hold the story (a labelled reading or an outside party). Pri is MoSCoW of the highest FR in the story. Enabler = no FR, justified in the epic file.

| Rank | Story | Title | Epic | FRs | Pri | Stage | Note |
|------|-------|-------|------|-----|-----|-------|------|
| 1 | 10.01 | Scaffold, CI and repository hygiene | 10 | NFR-006, 025 | Enabler | R1 | |
| 2 | 10.02 | Design tokens and responsive app shell | 10 | 085, 086 | Enabler | R1 | |
| 3 | 01.01 | Sign in and sign out | 01 | 001 | Must | R1 | |
| 4 | 01.02 | Role enforcement and navigation per role | 01 | 007, 009 | Must | R1 | |
| 5 | 01.03 | Engineer sees no cost: projection and scan | 01 | 008 | Must | R1 | |
| 6 | 01.04 | Admin creates and deactivates users; one Admin | 01 | 004, 005 | Must | R1 | |
| 7 | 01.07 | Audit service and audit screen | 01 | 011 | Must | R1 | |
| 8 | 01.05 | Password rule and change own password | 01 | 002, 098 | Must | R1 | |
| 9 | 01.06 | 12-hour session | 01 | 099 | Must | R1 | |
| 10 | 01.08 | About page | 01 | 010 | Must | R1 | |
| 11 | 03.01 | Field registry seed and column letters | 03 | 020, 021 | Must | R1 | |
| 12 | 03.02 | Formula engine | 03 | 022, 023, 026 | Must | R1 | |
| 12a | 10.10 | NFR-009 guards: JS budget check and Lighthouse reference run (enabler) | 10 | NFR-009 | Enabler | R1 | Jira AQP-169. Needs 01.01 (AQP-38). Added 2026-11-03 as a scope addition, first in the stretch; **committed since 2026-11-04** because it blocks 12b (DL-080, DL-081, sprint plan v0.6). It measures 12b's cut; no other rank moves |
| 12b | 10.13 | First-load JS headroom: account menu and mobile drawer load on first open; an early tap is kept (enabler) | 10 | NFR-009 (FR-009, FR-085 for AC-10) | Enabler | R1 | Jira AQP-188, 5 points, sprint 01 **committed**, in series after 12a. Blocks AQP-48, 65, 74, 81, 89, 113, 122, 123, 130, 142 and 148: no story that adds client JavaScript to the portal frame or a signed-in route starts development before it merges (DL-080). Not linked, by the architect (10863): AQP-57 and AQP-90. Closes DEF-013 (AQP-197) at its G7. Target 190,000 B gzip on every signed-in route, a floor under the unchanged 200,000 B limit (PM, 10867). Added 2026-11-04. **READY, 17 of 17 (section 7, 2026-11-04). Waits for the scrum-master to move it to Ready for Dev, and for the docs PR with ux-spec v0.11 before development starts** |
| 12c | 10.14 | Cut CI feedback time: E2E stage 12 faster without losing coverage (enabler) | 10 | NFR-009 (CI feedback time), NFR-016 (coverage kept), NFR-025 | Enabler | R1 | Jira AQP-199, 3 points, sprint 01 **committed since 2026-11-05** (DL-099: the DL-095 trigger fired; AQP-89 stepped out); built as PR #86; **AC-1 and AC-2 restated by the product-manager (AQP-199 comment 11006: no numeric target; stage 12 at least 15 % shorter), re-validated READY 17 of 17 (comment 11015)**; was "stretch, first" (product-manager 10969, DL-097). Ready before the sprint 1 review (master, DL-095); built in the first idle merge wait. Relates to AQP-169 (done) and AQP-198; no "blocks" link, because the master's hold is conditional. **If the nightly CI-time p95 passes 9 minutes before it merges it moves to committed and AQP-89 (2 points) steps out (55 of 55).** Added 2026-11-05. **READY, 17 of 17 (section 7, 2026-11-05, description revision 3); Ready for Dev since 2026-11-05; re-validated READY, 17 of 17, on the restated AC-1 and AC-2 (revision 7, comment 11015)** |
| 12d | 10.15 | CI shard step: stage 12 in two self-building shard jobs behind a fan-in job named Stages 1 to 11 (enabler) | 10 | NFR-009 (CI feedback time), NFR-016 (every test still runs), NFR-025 | Enabler | R1 | Jira AQP-208, 3 points, sprint 01 **stretch, first; not committed** (committed stays 55 of 55). Added 2026-11-05 from the architect's recommendation (AQP-199 comment 11004) and the product-manager's decision (11006). Built after the DEF-015 fix (AQP-206, a Bug, no points), which follows AQP-199. Two shard jobs with their own build and 4 workers; the fan-in job keeps the check name `Stages 1 to 11`, so no repository setting changes; the CI-time measure runs from the first job's start to the fan-in job's end. Targets: median at most 6:00, p95 at most 7:00; the runner-minutes guard is 2 times; if missed, three shards at 2.5 times are pre-authorised. Relates to AQP-199 and AQP-206; holds no story at G6 unless DL-102's fallback applies. **Ready for Dev (moved by the scrum-master 2026-11-05, revision 5, after READY). Product-owner result, 2026-11-05: NOT READY, 14 of 17 on the first read; READY, 17 of 17, on the re-read of revision 4 (section 7; comment 11020)** |
| 13 | 02.01 | Process Master | 02 | 012 | Must | R1 | |
| 14 | 02.03 | Material Master | 02 | 015 | Must | R1 | |
| 15 | 02.04 | Exchange Rate Master | 02 | 016 | Must | R1 | |
| 16 | 02.05 | Treatment / Color list | 02 | 017 | Must | R1 | |
| 17 | 02.02 | Customers with default rates and reset | 02 | 013 | Must | R1 | |
| 18 | 04.01 | Assign a task | 04 | 032, 033, 041 | Must | R1 | |
| 19 | 03.03 | Row-level outputs, walking skeleton | 03 | 024 (row), 027, 028 | Must | R1 | |
| 20 | 03.05 | Calculation record and master snapshot | 03 | 031 | Must | R1 | Moved up: Calculate needs it |
| 21 | 03.04 | Product total: BL as the sum of BG, BN, BO | 03 | 024 (product), 025, 029, 030 | Must | R1 | 0.5 to 0.75 h; CE cases assert from the first commit |
| 22 | 04.02 | My tasks and the task queue by role | 04 | 034 | Must | R1 | Story-prep note (DL-086, PRF-04): the story gets an AC that `/queue` is added to `KEY_SCREENS` in `lighthouserc.cjs` with the Wi-Fi assertions (LCP at most 2,000 ms, TBT at most 200 ms, median of 5) passing; each later key-screen story does the same. `LIGHTHOUSE_B0` is set by the delivery lead from QA's AQP-169 AC-9 figure before the first key screen's G6 |
| 23 | 04.03 | Overdue cues and bell | 04 | 036, 037 | Must | R1 | |
| 24 | 04.04 | Engineer sees the status of own work | 04 | 102 | Must | R1 | |
| 25 | 06.01 | Estimate status flow | 06 | 064 | Must | R1 | Before 05.09 |
| 26 | 05.01 | Open the task and choose the customer | 05 | 042 | Must | R1 | |
| 27 | 05.02 | Build the parts tree | 05 | 043, 044 | Must | R1 | |
| 28 | 05.03 | Part form, first sections, hint on QTY per Assy | 05 | 045 (part), 046, 051, 052, 029 (hint) | Must | R1 | |
| 29 | 05.04 | Part form, remaining sections | 05 | 045 | Must | R1 | |
| 30 | 05.05 | Fasteners fields show only when needed | 05 | 048 | Must | R1 | |
| 31 | 02.06 | "Not applicable" system entries | 02 | 018 | Must | R1 | Reading D-27 stated in Dev Context |
| 32 | 05.06 | Surface Treatments and Treatment / Color | 05 | 049, 050 | Must | R1 | |
| 33 | 05.07 | Part picture, optional | 05 | 047 | Must | R1 | |
| 34 | 05.08 | Save a draft and the unsaved-changes warning | 05 | 053, 100 (hook) | Must | R1 | |
| 35 | 05.09 | Calculate | 05 | 055, 056 | Must | R1 | |
| 36 | 05.12 | Warn on a 0 in QTY per Assy | 05 | 104 | Must | R1 | Reading R-2 (a top-level item's own 0 warns) |
| 37 | 06.02 | Estimate review: totals and rows | 06 | 024, 025, 029, 030 (display) | Must | R1 | |
| 38 | 06.03 | Cost details and Lead formula view | 06 | 058, 059, 060 | Must | R1 | |
| 39 | 06.04 | Recalculate and the cleared figures | 06 | 061, 100 | Must | R1 | |
| 40 | 06.05 | Approval blocked while not current | 06 | 101 | Must | R1 | |
| 41 | 06.06 | Approve and lock | 06 | 062 | Must | R1 | |
| 42 | 06.07 | Price override with optional reason | 06 | 103, 011 | Should | R1 | |
| 43 | 06.08 | Unlock with reason and notices | 06 | 063 | Must | R1 | |
| 44 | 06.09 | Approved estimate keeps its approved values | 06 | 065 | Must | R1 | |
| 45 | 06.10 | Quantity warning for Lead and Admin | 06 | 104 | Must | R1 | Warning notice states are wording previews (CR-28) |
| 46 | 06.11 | Rate-change notice to the Lead | 06 | 106 | Must | R1 | Reading R-3 |
| 47 | 06.14 | Password step-up check (enabler) | 06 | NFR-004 | Enabler | R1 | Before 06.12 and 06.13; no FR of its own; reused by 01.09, 08.02, 08.04, 08.06 |
| 48 | 06.12 | Cancel approval, Admin only | 06 | 107 | Must | R1 | Cut-ladder step 4; uses the step-up check of 06.14 |
| 49 | 06.13 | Remove the cancelled price, Admin only | 06 | 108 | Must | R1 | Cut-ladder step 4; reading R-4; uses 06.14 |
| 50 | 07.01 | Download the worksheet layout | 07 | 066, 071 | Must | R1 | |
| 51 | 07.02 | Node rows, picture and hidden lines | 07 | 067, 068 | Must | R1 | |
| 52 | 07.03 | One total and the total Tool Cost | 07 | 069 | Must | R1 | |
| 53 | 07.04 | Refuse the download until a calculation is current | 07 | 070 | Must | R1 | Reading R-1 confirmed (D-37) |
| 54 | 07.06 | Quantity-warning notice on the export preview | 07 | 104 | Must | R1 | |
| 55 | 02.07 | Delete customer or material with guard | 02 | 013, 015 | Must | R1 | |
| 56 | 10.06 | Reserved drawing region | 10 | 087 | Must | R1 | |
| 57 | 10.03 | Page metadata and indexing | 10 | 089 | Must | R1 | |
| 58 | 10.04 | Install and update with Docker Compose | 10 | 091 (part) | Must | R1 | OQ-ARCH-02, 03 (Accucut IT). Story-prep note (DL-086, PRF-03): its Dev Context says `NODE_ENV=production` is set in every deployed container and dev tooling (`@lhci/cli` and the other devDependencies) stays out of the image (install with `--omit=dev`), because the measurement-user guard (`scripts/lib/measurement-user.ts`) allows the Compose host names `db` and `postgres`. **Story-prep note (DL-096): staging goes to the delivery lead only at G8, so deployment-only faults are first exercised here and this story's G7 must exercise all three in full, as ACs with evidence:** (1) the reverse proxy passes `X-Forwarded-For` and the app reads the real client address (RISK-021, GitHub #59: the sign-in limit per address; test with the proxy in front, not the app alone); (2) the argon2id cost is measured on the host that will run it, and the figure is recorded (the sign-in time budget depends on it); (3) production mode only: `NODE_ENV=production` in every deployed container and no dev tooling in the image (`--omit=dev`; DL-086), checked by inspecting the built image |
| 59 | 10.05 | Weekly backup, watch check and free-space check, and the Admin's guided `clear-copies.sh` | 10 | 091 | Must | R1 | OQ-ARCH-03 (disk size). `clear-copies.sh` (architecture 9.5, A-35 and A-36): a second guided command beside `restore.sh`, run by the Admin; clears the oldest copies first, always keeps the newest 4, asks for a typed date, needs `sudo` under the Admin's limited server account, and writes a `job_runs` row. "2-year pruning" stays as written: "up to 2 years, as the disk allows" (DL-034). +0.5 to +0.75 h. At about 5 to 6 GB of data only 4 copies fit and clearing can do no more (RISK-017). Not yet in Jira |
| 60 | 02.09 | Settings page frame and the Last backup line | 02 | 105 | Must | R1 | Frame hours sit in EPIC-09 (CR-27); SCR-15 is staged R1 core for this line since UX v0.6 |
| 61 | 10.11 | Admin restores a backup with one guided command | 10 | 091 | Must | R1 | A-35 (Accucut IT grants the account) |
| 62 | 04.05 | Task closes on approval, reopens on unlock or cancel | 04 | 038 | Must | R1 | |
| 63 | 03.06 | Calculation performance gate | 03 | NFR-008 | Must | R1 | |
| 64 | 07.05 | Export size and time gate | 07 | NFR-010 | Must | R1 | OQ-PM-05 |
| 65 | 10.08 | End-to-end, responsive and accessibility suites | 10 | NFR-016, 018, 019 | Must | R1 | |
| 66 | 10.09 | Performance, capacity and observability | 10 | NFR-010 to 012, 024 | Must | R1 | Q-18 (web address). NFR-009 moved to 10.10 on 2026-11-03 |
| 67 | 10.12 | Privacy and data-handling checks | 10 | NFR-028, 029 | Must | R1 | Renumbered from 10.10 on 2026-11-03 (10.10 is now the NFR-009 guards). Not in Jira |
| 68 | 02.08 | Propagate a changed default | 02 | 014 | Must | R1+ | |
| 69 | 04.06 | Lead default filter and task filters | 04 | 035, 039 | Should | R1+ | |
| 70 | 05.10 | Autosave every 30 seconds | 05 | 054 | Should | R1+ | |
| 71 | 05.11 | Completeness count and tree icons | 05 | 057 | Should | R1+ | |
| 72 | 10.07 | Loading, empty and error states | 10 | 088 | Should | R1+ | |
| 73 | 08.01 | Fields and formulas list | 08 | 072 | Must | R2 | |
| 74 | 08.02 | Edit a formula | 08 | 073, 080 (part) | Must | R2 | Reuses the step-up check of 06.14 |
| 75 | 08.03 | Insert a field with re-lettering | 08 | 074, 075 | Must | R2 | |
| 76 | 08.04 | Delete a field | 08 | 076, 080 (part) | Must | R2 | |
| 77 | 08.05 | Configuration versions | 08 | 077 | Must | R2 | |
| 78 | 08.06 | Checkpoints and revert | 08 | 078, 080 (part) | Must | R2 | |
| 79 | 08.07 | Change history | 08 | 079 | Must | R2 | |
| 80 | 01.09 | Admin hand-over | 01 | 006 | Should | R2 | |
| 81 | 04.07 | Reassign or change a deadline | 04 | 040 | Should | R2 | |
| 82 | 09.01 | Mail outbox and transport (enabler) | 09 | NFR-014 | Enabler | R2 | |
| 83 | 09.02 | Settings: switch, sender, test e-mail | 09 | 019 | Must | R2 | OQ-ARCH-11 |
| 84 | 09.03 | Assignment e-mail | 09 | 081 | Must | R2 | |
| 85 | 09.04 | Overdue e-mail within 5 minutes | 09 | 082 | Must | R2 | |
| 86 | 09.05 | Daily digest at 11:00 IST | 09 | 083 | Must | R2 | |
| 87 | 09.06 | No duplicates, logged, retried | 09 | 084 | Must | R2 | |
| 88 | 09.07 | Reset a password by e-mailed link | 09 | 003 | Should | R2 | |
| 89 | 09.08 | One real send on the real mailbox | 09 | 019 (verification) | Must | R2 | Waits for Accucut IT |

91 candidate stories (89 until 10.10 was added on 2026-11-03; 90 until 10.13 was added on 2026-11-04). Every in-scope FR appears in at least one row and is owned by exactly one epic (section 2). FR-104 is traced from four rows (05.12, 06.10, 07.06 and the rule in 03.04's cases); FR-091 from 10.04, 10.05 and 10.11.

## 6. What the scrum-master should know before sprint planning

- **Sprint 1 is ranks 1 to 18, 12a and 12b** (Jira AQP-27 to AQP-148, AQP-169 and AQP-188). The DoR result per story is in section 7: 19 are READY on 17 of 17 items (after the product-owner's Trace-line corrections, which the scrum-master should confirm); **12b (AQP-188, added 2026-11-04) is READY, 17 of 17, after three validation passes** (section 7); the scrum-master moves it to Ready for Dev. **12c (AQP-199, added 2026-11-05, stretch, first) is READY, 17 of 17, on the re-check.** That makes 21 of 21 sprint 01 stories READY. No open question holds any of them. Nothing needs real master data (the Admin types it at first use, D-23; invented placeholders in tests, NFR-006, ADR-014). 03.03 follows once 02.01 to 02.04 exist.
- **No Held stories.** Do not read an outdated mark from comment 10515 or from the v0.1 files.
- **G4 is the master's.** Attempt 1 was NO-GO (gate log). The master has since recorded the whole-order rule, D-25 to D-37 and PRD 13.4 to 13.6 (DL-027 to DL-038, CR-23 closed). My remediation 2 (this file, the consistency report v0.4 and the 18 PO Validation sections) is ready for attempt 2; it reads remediation 1 (scrum-master) and 2 only. Moving any story to Ready waits for that decision.
- **Slicing:** 05.03 and 05.04 may need splitting by section of SPEC 7.1 (eight sections) to fit a sprint. 03.03 may be split by output group after the first row works.
- **Every UI story** carries NFR-016, 017, 018 as acceptance criteria (consistency report section 8) and cites screen names in `ux-spec.md` (v0.7).
- **Product-total story (03.04):** its acceptance criteria cite CE-1 at 30, CE-2 at 840, 316 and 660, CE-3 to CE-7, CE-9 (BL column), CE-10, CE-11 and CE-12 at 15, 5, 17 and 1000 (test strategy 5.6, control 2). The warnings column of CE-9 belongs to 05.12. No figure from the test strategy goes into a Jira question.
- **Human step before go-live:** the Admin's restore rehearsal from the README alone (10.11). It is not in the hours or the dates.
- **Re-issue the dates** from the story count at G4 (release plan 6.2).

## 7. Sprint 01: Definition of Ready validation (re-issued 2026-11-02, G4 remediation 2)

Validated by the product-owner against **all 17 items** of `docs/standards/definition-of-ready.md` (business clarity 4, acceptance criteria 4, technical clarity 4, UX clarity 3, sizing 2), the test plan section 9 (testability), the SPEC, the PRD, architecture v0.11, the UX spec v0.7 and the ADRs. The first check (v0.3 of this file) counted 16 items: **the item not counted was "Relevant business rules (BR-IDs) listed"**, which I had marked n/a for most stories (CR-36). It is now applied with one rule (R-BR): a story lists every BR-ID that one of its acceptance criteria asserts (the Admin-only and role-refusal criteria and the Engineer scan included), plus the BRs its epic assigns it; an enabler that asserts none says so in its Trace line.

All 18 stories were read again from Jira after the scrum-master's edits (AQP-1 10611 and 10620). The text of each PO Validation section is in the story; each story has a new comment that replaces the 16-item comment. **No status is changed in Jira:** a story moves from Draft to Ready only after the master decides G4 attempt 2, and then by the scrum-master.

| Rank | Story | Jira | Pts | ACs | DoR (of 17) | Item 4 (BR) as found | Trace correction made by the product-owner |
|------|-------|------|-----|-----|-------------|----------------------|--------------------------------------------|
| 1 | 10.01 Scaffold, CI | AQP-27 | 8 | 10 | **READY 17/17** | Pass (none asserted) | States "BR: none asserted (enabler)" |
| 2 | 10.02 Tokens and shell | AQP-28 | 5 | 10 | **READY 17/17** | Pass (none asserted) | States "BR: none asserted (enabler)" |
| 3 | 01.01 Sign in and sign out | AQP-38 | 5 | 8 | **READY 17/17** | Pass (BR-001) | none |
| 4 | 01.02 Role enforcement and navigation | AQP-48 | 5 | 9 | **READY 17/17** | **Fail**: BR-002, BR-003 missing | BR-002, BR-003 added to BR-004 |
| 5 | 01.03 Engineer sees no cost | AQP-57 | 5 | 8 | **READY 17/17** | **Fail**: BR-004 missing | BR-004 added to BR-003 |
| 6 | 01.04 Admin creates and deactivates users | AQP-65 | 3 | 7 | **READY 17/17** | **Fail**: BR-004 missing | BR-004 added to BR-001 |
| 7 | 01.07 Audit service and screen | AQP-74 | 5 | 9 | **READY 17/17** | Pass (none asserted; FR-011, BRQ-007) | States it in the Trace line |
| 8 | 01.05 Password rule and change own password | AQP-81 | 3 | 7 | **READY 17/17** | Pass (BR-049) | none |
| 9 | 01.06 12-hour session | AQP-89 | 2 | 6 | **READY 17/17** | Pass (BR-050) | none |
| 10 | 01.08 About page | AQP-90 | 1 | 5 | **READY 17/17** | **Fail**: BR-003 missing (AC-3 scan) | BR-003 added |
| 11 | 03.01 Field registry seed | AQP-97 | 3 | 7 | **READY 17/17** | **Fail**: only BR-034 | BR-003, 008, 023, 026, 027, 036, 047 added |
| 12 | 03.02 Formula engine | AQP-106 | 8 | 9 | **READY 17/17** | **Fail**: BR-025 missing; AC-2 cites FR-027, not traced | BR-025 and FR-027 added |
| 12a | 10.10 NFR-009 guards (enabler) | AQP-169 | 5 | 9 | **READY 17/17** (2026-11-03, comment 10726) | Pass (none asserted, stated in the Trace line) | none; wording of AC-1 and AC-2 and the Dev Context corrected by the product-owner (the not-found page) |
| 12b | 10.13 First-load JS headroom: account menu and drawer on first open; early tap kept (enabler) | AQP-188 | 5 | 10 | **READY 17/17** (2026-11-04, revision 6; first pass 15/17, then 16/17 twice) | Pass (BR-003 listed; revision 5 added it and NFR-001, NFR-002, NFR-016 to 018) | Trace written by the scrum-master (DL-039). AC-9 reworded by the solution-architect (10887) |
| 12c | 10.14 Cut CI feedback time (enabler) | AQP-199 | 3 | 7 | **READY 17/17** (2026-11-05, revision 3; first pass 16/17); **re-validated READY 17/17 on revision 7** (restated AC-1, AC-2) | Pass (none asserted; stated in the Trace line) | none |
| 12d | 10.15 CI shard step (enabler) | AQP-208 | 3 | 7 | **READY 17/17** (2026-11-05, revision 4; first read 14/17); Ready for Dev (revision 5) | Pass (none asserted; stated in the Trace line) | none |
| 13 | 02.01 Process Master | AQP-113 | 3 | 9 | **READY 17/17** | **Fail**: BR-003, 004, 021 missing | BR-003, 004, 021 added; FR-011 traced |
| 14 | 02.03 Material Master | AQP-122 | 3 | 8 | **READY 17/17** | **Fail**: BR-003, 004 missing | BR-003, 004 added; FR-011 traced |
| 15 | 02.04 Exchange Rate Master | AQP-123 | 2 | 7 | **READY 17/17** | Pass (BR-003, BR-004, added by the scrum-master) | FR-011 traced |
| 16 | 02.05 Treatment / Color list | AQP-130 | 2 | 8 | **READY 17/17** | **Fail**: BR-003 missing (options route and scan) | BR-003 added to BR-004; FR-011 traced |
| 17 | 02.02 Customers | AQP-142 | 5 | 8 | **READY 17/17** | **Fail**: BR-003, 004, 030, 032 missing | BR-003, 004, 030, 032 added; FR-011 traced |
| 18 | 04.01 Assign a task | AQP-148 | 5 | 7 | **READY 17/17** | **Fail**: BR-004 missing (AC-5) | BR-004 added |

Result: **19 of 19 READY on 17 of 17 items**: the 18 of G4 attempt 2, and AQP-169 (10.10), added and validated on 2026-11-03 (comment 10726; its BR item passes, none asserted; the scrum-master moved it to Ready for Dev). Of the 18, 11 stories failed the BR item as found and 7 passed it; the corrections are Trace-line text only (no AC, estimate, sub-task or link changed) and were made by the product-owner, so the scrum-master should confirm them (they do not gate G4). The nine stories the first check sent back (AQP-27, 89, 90, 113, 122, 123, 130, 142, 148) now have the dependency text and the Jira links; AQP-27 has AC-10 and sub-task T10 (AQP-164). The seven stories that changed after architecture v0.11 (AQP-48, 57, 65, 74, 97, 113, 130) were re-read in their v0.11 form; AQP-113 has a ninth AC (README first-use sentence) and sub-task T7 (AQP-165).

**AQP-188 (rank 12b), validated 2026-11-04: READY, 17 of 17, on the third pass (description revision 6). The first pass was 15 of 17 and the next two 16 of 17; the history is kept below.** Read from Jira after the scrum-master's revision 3 (comment 10876): description, the ACs of comments 10862 and 10870, the target of 10867, the 13 links and the 8 sub-tasks. Passing: story form; trace to NFR-009, FR-009, FR-085 and EPIC-10; value and priority; 10 ACs in Given/When/Then with IDs; the negative paths (AC-8 delayed and failed, the stop rule in AC-1); measurable figures (190,000 B, 500 B, 1,000 B, 0 px, 3 s, 20 of 20); Dev Context with architecture v0.17 section 10, test strategy 10.1 and the files; no data or API change; dependencies linked (AQP-169 in; 11 stories and AQP-197 out); no open question of the scrum-master's; SCR-25 linked; accessibility notes; 5 points and 8 sub-tasks covering all 10 ACs. The links to AQP-48 (error boundary and the shell files, architect 10871) and AQP-89 (AC-4 client handling of 401) are right.

| # | DoR item | Gap | Owner | Needed |
|---|----------|-----|-------|--------|
| 1 | Business clarity, BR-IDs listed (rule R-BR, DL-039) | AC-9 asserts "the Engineer canary scan finds 0" (BR-003) and is headed "NFR-001, NFR-002", yet the Trace line says "BR: none asserted" and lists only NFR-009, FR-009, FR-085. AQP-90 failed the same way on the same assertion. Required Trace line: BR-003; NFR-001, NFR-002 added to the NFR list. Optional: NFR-016, 017, 018, since sprint-plan rule 4 makes them an AC of every UI story and AC-3, AC-6 and AC-7 test them at three widths (NFR-017's 44 px is only in the UX references) | scrum-master (names only; writes it) | Before Ready |
| 2 | UX clarity, states defined | The first-open pending and failed states are not in `ux-spec.md`, and the pending look contradicts it: section 7.3.1 rule 7 and the Loading row of section 6 say a button with `aria-busy` is disabled and shows no pressed state, while AC-8 and AC-10 hold the pressed look with `aria-busy="true"` on a control that stays enabled (Escape must reach it). The shared `Button` sets `disabled` whenever `aria-busy` is set (`loading`). Also, the master's G7 record for AQP-182, condition 5, names "solution-architect, then ux-expert" before the #61 story reaches Ready; the architect has ruled (10870) but no ux-expert entry is on the story | ux-expert | Before Ready |

**Re-validation, 2026-11-04 (later).** Gap 2 is closed: `ux-spec.md` v0.11 (main folder, uncommitted; builds on v0.10, which is the file on PR #56's branch) adds section 7.3.1 rule 11 (the one exception to rule 7: an enabled control, `aria-busy="true"`, the pressed look held, a second press ignored, Escape cancels, the last press wins, failure clears the look) and the SCR-25 states table with the two failure lines, word for word as in AC-8, `role="alert"`, 0 px shift, cleared on the next press. I read both against AC-8, AC-10 and AC-7; they agree, and the ux-expert confirms no AC changes (comment 10883). **Gap 1 is not closed in Jira.** Comment 10881 says the description is revision 4 with BR-003, NFR-001, NFR-002 and NFR-016 to 018 in the Trace line. I read the description twice (markdown and HTML) and it is still revision 3 ("BR: none asserted", no NFR-001/002), its Gates and DoR self-check unchanged, and the issue changelog shows no description edit after 2026-11-04 12:59:40. The edit most likely did not save. Re-check needed: the scrum-master saves the Trace line and also cites 7.3.1 rule 11 and the SCR-25 states table in the UX references, and drops "proposed" from the failure lines in AC-8 (the ux-expert confirmed them). Then 17 of 17 with no other change. Conditions carried to Ready, not DoR items: the spec v0.11 is on no branch yet, so the docs PR with it must merge (after PR #56) before AQP-188 development starts, or the developer reads it from the main folder; the SCR-25 mock-up pages do not draw the new states (ux-expert, Minor, before G6); rule 11 gives the account trigger a pressed rule it has not had, which reviewers should expect.

**Second re-validation, 2026-11-04 (revision 5, saved 16:48:34, read back by me from Jira).** The Trace line, the UX references and AC-8 are as the scrum-master says. The Trace line and UX items pass. **One new failure, which is mine to own: I passed AC-9 on the first two reads without asking whether its scan exists.** It does not. AC-9 ends "The Engineer canary scan finds 0", but `master` has no canary scan (only `scripts/secret-scan-control.ts`); story 01.03 (AQP-57) builds it, 01.03 is now in the stretch after 01.02, and AQP-188 is not blocked by it. Every other story that uses the scan (AQP-90, 113, 122, 123, 130, 142, 148) is blocked by AQP-57 in Jira; AQP-188 alone is not. QA could not verify that sentence at G7. The testing note names `tests/security/canary-scan.spec.ts`, which exists nowhere in the repository or the test strategy. Options (the AC is the solution-architect's to word): (A) replace the sentence with a check that can run now, for example that the only data the layout passes to the client components is the person's name, e-mail and role and the role's navigation entries, and say that the 01.03 scan will cover the frame when it lands (BR-003 stays); or (B) delete the sentence and BR-003 and keep NFR-001 and NFR-002. Recommended: A. Also found: the scrum-master's statement "ACs unchanged apart from AC-8" is not exact. AC-2, 3, 4, 5 and 7 were condensed; I read each against revision 3 and the intent is unchanged. Two testable phrases went with it: AC-3 "(the scripts requested after the first open are exactly the lazy ones)" and AC-7 "Nothing in the first load changes size when the lazy code arrives"; both are covered by other text (AC-3 "later opens request nothing more"; AC-7 0 px), and the AC-3 phrase should come back when there is room. Not blocking. Links and sub-tasks were not re-read; a description save does not touch them.

**Third re-validation, READY 17 of 17 (2026-11-04, revision 6 saved 17:19:02, read back by me once).** AC-9 is the architect's option A (10887): the layout builds the client props in one function, and a unit test (`tests/unit/portal-frame-props.test.ts`, new) gives it a user with every field of `AuthenticatedUser` and asserts only the name, e-mail, role label and navigation entries come out. I checked it against `origin/master` (9d924a1): `AuthenticatedUser` has `id`, `name`, `email`, `role` and `mustChangePassword`; the layout today passes `name`, `email` and `roleLabel(role)` and `navGroups(role)` inline, so the one-function extraction is real but small; `tests/e2e/shell.spec.ts`, `tests/e2e/sign-in.spec.ts` and `tests/unit/auth-session.test.ts` exist. The invented path is gone and AC-3's "exactly the lazy ones" phrase is back. CR-41, CR-38 and CR-39 are closed. Notes carried, none a DoR item: the docs PR with ux-spec v0.11 merges before development starts; PR #56 and #65 merge first; the new props test is not named in sub-task T6 (AQP-194); the description still says files were checked at `origin/master` 15cd9cb and `master` is now 9d924a1, so the developer branches from the current head.

Not DoR items, for the record: (a) the sprint plan puts the ux-expert's check at G6 ("visible on the iPhone"); condition 5 reads as an earlier step, so the master may confirm which applies. (b) T4 (loader states, the inline capture and its hand-over) and T5 carry the most work; if either is over half a day, the scrum-master splits it, with no change to the 5 points. (c) Test strategy 10.1 and the test plan do not name the three new E2E checks (network log, layout-shift observer, 20 of 20 early tap) or say the 190,000 B figure is checked once by reviewer-performance and not by the limit table; solution-architect and qa-engineer, Minor. (d) The "Depends on" line inside AQP-89's text does not list AQP-188; the link is the record, as for the CR-34 stories.

**AQP-199 (rank 12c), validated 2026-11-05: NOT READY, 16 of 17 on the first pass; READY, 17 of 17, on the re-check of revision 3 (see "Re-check" after the table).** Read from Jira (revision 2, comments 10968, 10969, 10971), against PRD v0.15 (NFR-009, NFR-016, NFR-025, 13.10), release plan v0.16 3.9, test strategy v0.16 10.3 and 10.5, architecture v0.20 9.2, DL-095, DL-097, RISK-023, sprint plan v0.7, and `origin/master` d8cb223 (`ci.yml`, `playwright.config.ts`, `scripts/lib/ci-feedback-time.ts`, `tests/unit/ci-workflow.test.ts` and the four ruled specs). Passing: story form; NFR-009, NFR-016, NFR-025 and EPIC-10; value and priority; BR none asserted (stated); 7 ACs in Given/When/Then; negative paths (AC-4 negative control, AC-5 flakiness, AC-7 boundary); measurable figures; the files and test names exist at `origin/master`; the approach matches test strategy 10.5 and architecture 9.2; the figures match PRD 13.10 and release plan 3.9; the per-spec ruling matches the real test titles; one job `verify` named `Stages 1 to 11` is what `ci-workflow.test.ts` asserts; 3 points and 6 sub-tasks covering AC-1 to AC-7. **Coverage at three widths holds:** every test that reads layout, focus order or touch targets, or runs axe per width, stays at three (the `SCR-01 at this width (AC-8)` block, the account-menu test, the AC-8 keyboard block, the locked and 503 states); only server rules, messages, cookies and the helper test move to one width, and a unit test guards the four files.

| # | DoR item | Gap | Owner | Needed |
|---|----------|-----|-------|--------|
| 1 | Technical clarity: no open question that would block implementation | AC-7 asks for a line written "until this story has merged" and not after, and AC-1 reads "runs made after the merge". The story says "the mechanism is the architect's", but the architect's comment (10968), test strategy 10.3 and 10.5 and architecture 9.2 give none, and 10.3 does not mention the 9-minute line at all. `scripts/lib/ci-feedback-time.ts` reads the last 20 runs with no notion of a merge point. T4 (AQP-203) cannot be built, and a pull request cannot write down its own merge date or commit. Suggested: show the line only while `tests/unit/one-width-tag.test.ts` is absent from the checked-out `master` (the file arrives with the merge), and make AC-1's "after the merge" a note for QA and the product-manager, with the step stating the count it used. The architect decides and adds the sentence to 10.3 | solution-architect (mechanism, 10.3 wording); scrum-master applies to AC-7 and AC-1 | Before Ready |

**Re-check, READY 17 of 17 (2026-11-05, revision 3, saved 08:58:22, read back by me).** The gap is closed by the architect's ruling (10976, test strategy 10.3): no merge detection; the 9-minute line is written whenever the p95 is over 540 s (nothing at exactly 540 s), with before-merge and after-merge wording, and the step reports the run count and the start time and head commit of the oldest and newest runs. AC-1 is read from the first report whose oldest counted run started after the merge commit, which the report now lets a reader check. AC-2 has a fixed baseline. Feasible on today's code: `JobRecord` already holds the start time, and the runs list the step fetches carries `head_sha`. The sub-task titles AQP-200, 203, 204 and 205 match the tasks, and the files were checked at `origin/master` d8cb223. Open, Minor, not DoR (CR-43): test strategy rows 33 and 387 and the test plan R-e2e still lack a pointer to 10.5; the exact line reads "test strategy 10.5" in AC-7 and "section 10.5" in 10.3, so the architect aligns 10.3 to the AC; AC-2 does not say which statistic of the three runs is compared (suggest the median); the "first push with no change" needs an empty commit or a documentation-only change; A-3 (runner minutes) is the product-manager's check.

Earlier notes from the first pass, now closed or narrowed: (a) Sub-task titles are older than the description: AQP-204 (T5) omits the negative-control run (AC-4), AQP-205 (T6) says "ask the architect for test strategy 10.3 wording" where the description says "hand the 5:00 check to QA", and AQP-200 omits AC-6; scrum-master to align. (b) AC-2 compares this PR's run with the median of the last five `master` runs, and the suite grows as other stories merge (332 and 373 tests in PRF-02); state the base commit, or normalise per test, as AQP-188 AC-2 did. (c) Test strategy rows 33 and 387 and the test plan (R-e2e) still say "critical journeys at all viewports" and "3 widths" with no pointer to 10.5; the sign-in landing is UJ-01, a critical journey. Solution-architect and qa-engineer, Minor (CR-43). (d) 10.5 excludes tests that read focus order, and `sign-in.spec.ts` AC-2 asserts that focus lands on the notice; the architect ruled it one width, so I read it as server-driven focus and ask the architect to confirm. (e) The description says files were checked at `origin/master` f698984; it is d8cb223 now. (f) A-3 (runner minutes are not billed on a public repository) is the product-manager's assumption to check in the repository settings.

**AQP-199 re-validated on revision 7, READY 17 of 17 (2026-11-05, comment 11015).** The ACs changed after Ready (product-manager 11006, DL-102, PRD 13.12, release plan 3.11): AC-1 has no numeric target (the nightly report is recorded at the sprint 1 review and does not hold Done); AC-2 needs stage 12 at least 15 % shorter, median of three runs each; the 5:00 QA check is withdrawn, from AC-2, T6 and sub-task AQP-205; AC-3 to AC-7 are unchanged. I checked the description, PRD 13.12, release plan 3.11 and DL-102 against each other and against test strategy v0.18 10.3 and 10.5: they agree, NFR-009's limits are unchanged and NFR-016 coverage is untouched. AC-1 is a checkable recording obligation, not a pass or fail threshold. For G6 and G7, not DoR: reviewer-performance and reviewer-quality found the "before" figure counts an apt-stalled run (DL-100 says repeat, not count); on clean runs the result is about -13.7 % (range -5.7 % to -20.4 %), so the developer's re-run decides whether 15 % holds, and a second restatement would be the product-manager's recorded decision. I suggested dropping "(measured 20 %)" from AC-2.

**AQP-208 (rank 12d, STORY-10.15, the CI shard step), validated 2026-11-05 as a draft: NOT READY, 14 of 17.** Read from Jira (description, six sub-tasks AQP-209 to 214, links; no comments yet), against PRD 13.12, release plan 3.11, test strategy v0.18 10.3 and 10.5, architecture v0.22 9.2, DL-099 to DL-102, sprint plan v0.9 and `ci-feedback-time.ts`. The targets (median 6:00, p95 7:00), the 2x guard with 2.5x for three shards, and the order (after AQP-199 and AQP-206) match the PM's decisions. The ACs are marked as drafts for the solution-architect; the architect's review is still open. Gaps (owner): (1) the shard jobs' order against the renamed first job is not stated; the estimates only work if they run alongside it (about 4:35 against about 7:17 if after it, today 6:51) (architect, Major); (2) AC-3 says no test runs twice, but the `setup` project runs in each shard (architect); (3) no path when the PR's own median misses 6:00, since the three-shard authority is written only for after the merge (architect); (4) the 9-minute line says "the shard step is due" and goes stale after this story merges; AC-7 leaves it unchanged (master, architect); (5) test strategy 10.3's wording of the measure is the architect's file, but is listed under the developer's "Files to modify" (architect); (6) the links to AQP-199 and AQP-206 are "relates to", and the order is hard (scrum-master, CR-34 rule). Passing: story form, trace, value, BR (none), 7 ACs in Given/When/Then with negative controls, measurable figures, no data or API change, 3 points and six sub-tasks covering AC-1 to AC-7. Not DoR: the 4:40, 5:25 and 1.7 times figures are the architect's estimates (A-2), the same footing on which AQP-199's targets were set.

**AQP-208 re-read, READY 17 of 17 (2026-11-05, revision 4 saved 20:04:07, read back by me once; comment 11020).** The six gaps of the first read are closed: the shards start together with the renamed `Stages 1 to 11b` and only the fan-in `Stages 1 to 11` has `needs` (AC-4, test strategy v0.19 10.5); AC-3 compares the union of the `mobile`, `tablet` and `desktop` lists with `setup` counted per shard; AC-2 has the PR-miss path (three shards on the same PR at 2.5 times, else BLOCKED, nothing dropped, no timeout widened); AC-7 carries master's line from DL-103 word for word and pins it by a unit test; test strategy 10.3 states the measure, and `test-strategy.md` is out of the developer's files; "is blocked by" AQP-199 and AQP-206 are in the links. The sub-tasks AQP-209 to 214 match. Targets and guards match PRD 13.12 and release plan 3.11. The estimates (4:35 to 4:40, 5:25, 1.7 times) are still the architect's; AC-2's miss path answers that. Minor, not DoR: test strategy 10.3 still shows the proposed line without ", DL-102"; the story says it "holds no story at G6" while DL-102 has a conditional fallback hold.

**Answer on AQP-113, 122 and 142:** they need BR-004 (the Admin-only criterion asserts it) and BR-003 (they add Restricted values to `canaryMasters` and assert that no rate reaches an Engineer); AQP-142 also BR-030 and BR-032 (AC-4). AQP-123 and AQP-130 were treated the same way.

### Notes carried by individual stories (none blocks)

- AQP-27, AQP-28: 10 ACs is the DoR maximum; any addition is a new story. AQP-28 AC-9 (phone, screen reader, high contrast) is verified by QA at that story's G7.
- AQP-38: whether sign-out should raise `session_version` is with the solution-architect (not an AC). AQP-81: on pick-up, add 10 and 128 characters as accepted cases to AC-1 (test strategy 7 lists them).
- AQP-97, AQP-113, AQP-130: assumption A-1 is confirmed by architecture v0.11 section 5.6 (IMP-S1-02 closed). AQP-130: a deleted treatment on a draft estimate is open with the solution-architect before story 05.06.
- AQP-106: the split line (03.02b) is agreed with the product-owner, not taken silently.
- AQP-113: AC-9 is a documentation sentence, checked by a test or a review checklist; a rate left at 0 prices at 0 with no message (architecture 5.6, "One limit").

### Dependencies

The 28 links the sprint plan added and the 13 the product-owner found are all in Jira now (41 "is blocked by" links) and agree with the execution order of `sprint-01-plan.md` v0.3. Each story's "Depends on" text names its blockers, and every blocker has an earlier rank.

| Dependency | Stories that need it | Why |
|------------|----------------------|-----|
| 01.02 before 01.06 | AQP-89 | problem+json errors, `withRoute`, the system pages |
| 01.03 before 01.08, 02.01, 02.02, 02.03, 02.04, 02.05, 04.01 | AQP-90, 113, 142, 122, 123, 130, 148 | the `canaryMasters` file and the scan they extend or run |
| 02.01 before 02.03, 02.04, 02.05 | AQP-122, 123, 130 | they extend the master repository and service that 02.01 creates |
| 02.03 before 02.04, 02.05 | AQP-123, 130 | the SCR-13 tab shell is built in 02.03 |

Also confirmed: FR-012's "a new item is added to every customer" is delivered in 02.02, which creates `customer_rates`; the epic file lists the FR under 02.01 and 02.02 traces it.

### Items for other roles from this validation

- **qa-engineer:** test plan section 9 still gives the uniform 404 for audit and Settings; architecture v0.11 section 6 says 403 (CR-33 residual).
- **scrum-master:** confirm the Trace corrections above; create story 10.05 in Jira when it is next in line (it is not in Jira; the row below carries the new script); the sprint plan names the way of working once the delivery lead chooses (PRD v0.12).
- **solution-architect:** none blocking (a deleted treatment on a draft; sign-out and `session_version`; the two database roles).
