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
| 12a | 10.10 | NFR-009 guards: JS budget check and Lighthouse reference run (enabler) | 10 | NFR-009 | Enabler | R1 | Jira AQP-169, sprint 01 stretch, first. Needs 01.01 (AQP-38); Done before 02.01 reaches G6 (test strategy 10.4, DL-053). Added 2026-11-03 as a scope addition; no other rank moves |
| 13 | 02.01 | Process Master | 02 | 012 | Must | R1 | |
| 14 | 02.03 | Material Master | 02 | 015 | Must | R1 | |
| 15 | 02.04 | Exchange Rate Master | 02 | 016 | Must | R1 | |
| 16 | 02.05 | Treatment / Color list | 02 | 017 | Must | R1 | |
| 17 | 02.02 | Customers with default rates and reset | 02 | 013 | Must | R1 | |
| 18 | 04.01 | Assign a task | 04 | 032, 033, 041 | Must | R1 | |
| 19 | 03.03 | Row-level outputs, walking skeleton | 03 | 024 (row), 027, 028 | Must | R1 | |
| 20 | 03.05 | Calculation record and master snapshot | 03 | 031 | Must | R1 | Moved up: Calculate needs it |
| 21 | 03.04 | Product total: BL as the sum of BG, BN, BO | 03 | 024 (product), 025, 029, 030 | Must | R1 | 0.5 to 0.75 h; CE cases assert from the first commit |
| 22 | 04.02 | My tasks and the task queue by role | 04 | 034 | Must | R1 | |
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
| 58 | 10.04 | Install and update with Docker Compose | 10 | 091 (part) | Must | R1 | OQ-ARCH-02, 03 (Accucut IT) |
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

90 candidate stories (89 until 10.10 was added on 2026-11-03). Every in-scope FR appears in at least one row and is owned by exactly one epic (section 2). FR-104 is traced from four rows (05.12, 06.10, 07.06 and the rule in 03.04's cases); FR-091 from 10.04, 10.05 and 10.11.

## 6. What the scrum-master should know before sprint planning

- **Sprint 1 is ranks 1 to 18 and 12a** (Jira AQP-27 to AQP-148, and AQP-169). The DoR result per story is in section 7: all 19 are READY on 17 of 17 items (after the product-owner's Trace-line corrections, which the scrum-master should confirm). No open question holds any of them. Nothing needs real master data (the Admin types it at first use, D-23; invented placeholders in tests, NFR-006, ADR-014). 03.03 follows once 02.01 to 02.04 exist.
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
| 13 | 02.01 Process Master | AQP-113 | 3 | 9 | **READY 17/17** | **Fail**: BR-003, 004, 021 missing | BR-003, 004, 021 added; FR-011 traced |
| 14 | 02.03 Material Master | AQP-122 | 3 | 8 | **READY 17/17** | **Fail**: BR-003, 004 missing | BR-003, 004 added; FR-011 traced |
| 15 | 02.04 Exchange Rate Master | AQP-123 | 2 | 7 | **READY 17/17** | Pass (BR-003, BR-004, added by the scrum-master) | FR-011 traced |
| 16 | 02.05 Treatment / Color list | AQP-130 | 2 | 8 | **READY 17/17** | **Fail**: BR-003 missing (options route and scan) | BR-003 added to BR-004; FR-011 traced |
| 17 | 02.02 Customers | AQP-142 | 5 | 8 | **READY 17/17** | **Fail**: BR-003, 004, 030, 032 missing | BR-003, 004, 030, 032 added; FR-011 traced |
| 18 | 04.01 Assign a task | AQP-148 | 5 | 7 | **READY 17/17** | **Fail**: BR-004 missing (AC-5) | BR-004 added |

Result: **19 of 19 READY on 17 of 17 items**: the 18 of G4 attempt 2, and AQP-169 (10.10), added and validated on 2026-11-03 (comment 10726; its BR item passes, none asserted; the scrum-master moved it to Ready for Dev). Of the 18, 11 stories failed the BR item as found and 7 passed it; the corrections are Trace-line text only (no AC, estimate, sub-task or link changed) and were made by the product-owner, so the scrum-master should confirm them (they do not gate G4). The nine stories the first check sent back (AQP-27, 89, 90, 113, 122, 123, 130, 142, 148) now have the dependency text and the Jira links; AQP-27 has AC-10 and sub-task T10 (AQP-164). The seven stories that changed after architecture v0.11 (AQP-48, 57, 65, 74, 97, 113, 130) were re-read in their v0.11 form; AQP-113 has a ninth AC (README first-use sentence) and sub-task T7 (AQP-165).

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
