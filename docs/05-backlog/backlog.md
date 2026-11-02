# Product Backlog: Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.2 (re-issued 2026-11-02 against SPEC v1.11, PRD v0.10, UX v0.5, architecture v0.9 and the release plan v0.10; v0.1 was written against SPEC v1.5, PRD v0.7, UX v0.3, architecture v0.4) |
| Owner | product-owner |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10, 101 FRs |
| Source of truth | Jira project AQP. This file is the ordered view. **The stories below are candidates with provisional IDs**; the scrum-master creates them in Jira (label `aiid-STORY-NN.MM`) and the product-owner validates each against the Definition of Ready. No story has been created, estimated or validated yet |
| Companions | `consistency-report.md` (v0.2), `epics/EPIC-01` to `EPIC-10` |
| Development | HOLD-01 is met (D-23, DL-025). Development does not start before G4 and the master's rulings below |

## 1. What changed since v0.1

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
| 6 | EPIC-07 Excel export | AQP-22 | R1 core | 4 | 5.375 to 8.125 | High | Draft |
| 7 | EPIC-10 remainder | AQP-25 | R1 core, R1+ | 4 | 7.5 to 11.75 (+1 to 1.5) | High | Draft |
| 8 | R1+ stretch (inside EPIC-02, 04, 05, 10) | | R1+ | | 6 to 9.5 | | Build only if the core is on track (checkpoint B) |
| 9 | EPIC-08 Admin configuration | AQP-23 | R2 | 3 | 11.75 to 15.75 | Medium | Draft |
| 10 | EPIC-09 E-mail alerts and jobs | AQP-24 | R2 | 3 | 10.5 to 15.5 | Medium | Draft; mail facts needed |
| | **Scope A total** | | | | **87.75 to 132, central 109.875** (release plan v0.10; v0.9 said 87 to 130.75) | | |

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
| 8 | 03.01 Registry seed and column letters | Starts the engine early; independent of masters |
| 9 | 03.02 Formula engine | The highest-uncertainty item in R1; gives checkpoint A an honest first data point |
| 10 | 02.01 Process Master | Feeds the first calculation (03.03); a small CRUD that also exercises the audit service |

Stories 11 to 36 take the walking skeleton (03.03, one row end to end) through the calculation record, the product total, assignment, the workspace, Calculate and Warn. **The product total (03.04, rank 21) is no longer a critical-path risk:** it is a seed formula and its constructed cases. The longest chain is now 03.05, 05.09, 06.02, 06.04, 06.06, 06.12, 06.13 and 07.03 to 07.04. Rank 47 and 48 (cancel approval, remove price) are cut-ladder step 4 in the release plan: the delivery lead's to cut, 2.75 to 4 h.

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
| 47 | 06.12 | Cancel approval, Admin only | 06 | 107 | Must | R1 | Cut-ladder step 4; builds the step-up primitive |
| 48 | 06.13 | Remove the cancelled price, Admin only | 06 | 108 | Must | R1 | Cut-ladder step 4; reading R-4 |
| 49 | 07.01 | Download the worksheet layout | 07 | 066, 071 | Must | R1 | |
| 50 | 07.02 | Node rows, picture and hidden lines | 07 | 067, 068 | Must | R1 | |
| 51 | 07.03 | One total and the total Tool Cost | 07 | 069 | Must | R1 | SPEC §10 stale sentence (CR-24): follow FR-069 |
| 52 | 07.04 | Refuse the download until a calculation is current | 07 | 070 | Must | R1 | Reading R-1 confirmed (D-37) |
| 53 | 07.06 | Quantity-warning notice on the export preview | 07 | 104 | Must | R1 | |
| 54 | 02.07 | Delete customer or material with guard | 02 | 013, 015 | Must | R1 | |
| 55 | 10.06 | Reserved drawing region | 10 | 087 | Must | R1 | |
| 56 | 10.03 | Page metadata and indexing | 10 | 089 | Must | R1 | |
| 57 | 10.04 | Install and update with Docker Compose | 10 | 091 (part) | Must | R1 | OQ-ARCH-02, 03 (Accucut IT) |
| 58 | 10.05 | Weekly backup, watch check and free-space check | 10 | 091 | Must | R1 | OQ-ARCH-03 (disk size) |
| 59 | 02.09 | Settings page frame and the Last backup line | 02 | 105 | Must | R1 | Frame hours sit in EPIC-09 (CR-26); SCR-15 labelled R2 (CR-26) |
| 60 | 10.11 | Admin restores a backup with one guided command | 10 | 091 | Must | R1 | A-35 (Accucut IT grants the account) |
| 61 | 04.05 | Task closes on approval, reopens on unlock or cancel | 04 | 038 | Must | R1 | |
| 62 | 03.06 | Calculation performance gate | 03 | NFR-008 | Must | R1 | |
| 63 | 07.05 | Export size and time gate | 07 | NFR-010 | Must | R1 | OQ-PM-05 |
| 64 | 10.08 | End-to-end, responsive and accessibility suites | 10 | NFR-016, 018, 019 | Must | R1 | |
| 65 | 10.09 | Performance, capacity and observability | 10 | NFR-009 to 012, 024 | Must | R1 | Q-18 (web address) |
| 66 | 10.10 | Privacy and data-handling checks | 10 | NFR-028, 029 | Must | R1 | |
| 67 | 02.08 | Propagate a changed default | 02 | 014 | Must | R1+ | |
| 68 | 04.06 | Lead default filter and task filters | 04 | 035, 039 | Should | R1+ | |
| 69 | 05.10 | Autosave every 30 seconds | 05 | 054 | Should | R1+ | |
| 70 | 05.11 | Completeness count and tree icons | 05 | 057 | Should | R1+ | |
| 71 | 10.07 | Loading, empty and error states | 10 | 088 | Should | R1+ | |
| 72 | 08.01 | Fields and formulas list | 08 | 072 | Must | R2 | |
| 73 | 08.02 | Edit a formula | 08 | 073, 080 (part) | Must | R2 | Reuses step-up from 06.12 |
| 74 | 08.03 | Insert a field with re-lettering | 08 | 074, 075 | Must | R2 | |
| 75 | 08.04 | Delete a field | 08 | 076, 080 (part) | Must | R2 | |
| 76 | 08.05 | Configuration versions | 08 | 077 | Must | R2 | |
| 77 | 08.06 | Checkpoints and revert | 08 | 078, 080 (part) | Must | R2 | |
| 78 | 08.07 | Change history | 08 | 079 | Must | R2 | |
| 79 | 01.09 | Admin hand-over | 01 | 006 | Should | R2 | |
| 80 | 04.07 | Reassign or change a deadline | 04 | 040 | Should | R2 | |
| 81 | 09.01 | Mail outbox and transport (enabler) | 09 | NFR-014 | Enabler | R2 | |
| 82 | 09.02 | Settings: switch, sender, test e-mail | 09 | 019 | Must | R2 | OQ-ARCH-11 |
| 83 | 09.03 | Assignment e-mail | 09 | 081 | Must | R2 | |
| 84 | 09.04 | Overdue e-mail within 5 minutes | 09 | 082 | Must | R2 | |
| 85 | 09.05 | Daily digest at 11:00 IST | 09 | 083 | Must | R2 | |
| 86 | 09.06 | No duplicates, logged, retried | 09 | 084 | Must | R2 | |
| 87 | 09.07 | Reset a password by e-mailed link | 09 | 003 | Should | R2 | |
| 88 | 09.08 | One real send on the real mailbox | 09 | 019 (verification) | Must | R2 | Waits for Accucut IT |

88 candidate stories. Every in-scope FR appears in at least one row and is owned by exactly one epic (section 2). FR-104 is traced from four rows (05.12, 06.10, 07.06 and the rule in 03.04's cases); FR-091 from 10.04, 10.05 and 10.11.

## 6. What the scrum-master should know before sprint planning

- **Sprint 1 candidates with no open question:** ranks 1 to 18, then 03.03 once 02.01 to 02.04 exist. Nothing needs real master data (the Admin types it at first use, D-23; invented placeholders in tests, NFR-006, ADR-014).
- **No Held stories.** Do not read an outdated mark from comment 10515 or from the v0.1 files.
- **G4 is the master's.** DL-026 (2026-11-02) says G4 cannot pass while G3 conditions 12 and 13 are open. The ux-expert reports 12 closed (UX spec v0.4, comment 10539) and the generator, with its checks and a README, is in the working tree but untracked (condition 13); the master has not decided. The master has also not recorded the whole-order rule, D-25 to D-37 or PRD 13.4 (CR-23). The test plan (condition 15) is still absent.
- **Slicing:** 05.03 and 05.04 may need splitting by section of SPEC 7.1 (eight sections) to fit a sprint. 03.03 may be split by output group after the first row works.
- **Every UI story** carries NFR-016, 017, 018 as acceptance criteria (consistency report section 8) and cites screen names in `ux-spec.md` v0.5.
- **Product-total story (03.04):** its acceptance criteria cite CE-1 at 30, CE-2 at 840, 316 and 660, CE-3 to CE-7, CE-9 (BL column), CE-10, CE-11 and CE-12 at 15, 5, 17 and 1000 (test strategy 5.6, control 2). The warnings column of CE-9 belongs to 05.12. No figure from the test strategy goes into a Jira question.
- **Human step before go-live:** the Admin's restore rehearsal from the README alone (10.11). It is not in the hours or the dates.
- **Re-issue the dates** from the story count at G4 (release plan 6.2).
