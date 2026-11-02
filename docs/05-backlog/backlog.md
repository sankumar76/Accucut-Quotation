# Product Backlog: Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 |
| Owner | product-owner |
| Date | 2026-11-01 |
| Scope | Scope A (D-14): EPIC-01 to EPIC-10 |
| Source of truth | Jira project AQP. This file is the ordered view. **The stories below are candidates with provisional IDs**; the scrum-master creates them in Jira (label `aiid-STORY-NN.MM`) and the product-owner validates each against the Definition of Ready. No story has been created, estimated or validated yet |
| Companions | `consistency-report.md` (issues CR-01 to CR-20), `epics/EPIC-01` to `EPIC-10` |
| Development | Does not start until HOLD-01 inputs arrive (AQP-10, comment 10508). Backlog and G4 work continue meanwhile |

## 1. Epics in order

| Rank | Epic | Jira | Stage | Value (PRD) | Effort h (estimate) | Priority in Jira | Status |
|------|------|------|-------|-------------|---------------------|------------------|--------|
| 1 | EPIC-10 enabler slice (stories 10.01, 10.02) | AQP-25 | R1 core | enabler | inside EPIC-10 | High (epic) | Draft |
| 2 | EPIC-01 Foundation, access, confidentiality | AQP-16 | R1 core | 5 | 5.75 to 9.5 | Highest | Draft |
| 3 | EPIC-02 Masters and settings | AQP-17 | R1 core, R1+ | 4 | 5.5 to 9 (+2 to 3) | High | Draft |
| 3 | EPIC-03 Registry and calculation engine | AQP-18 | R1 core | 5 | 10 to 15 | Highest | **Roll-up story held** (AQP-14, AQP-15) |
| 3 | EPIC-04 Task assignment and queues | AQP-19 | R1 core, R1+, R2 | 4 | 3.25 to 5.75 (+1.5 to 2.5) | High | Draft |
| 4 | EPIC-05 Estimate workspace | AQP-20 | R1 core, R1+ | 5 | 11 to 16 (+1.5 to 2.5) | Highest | Draft; zero check waits on AQP-15 |
| 5 | EPIC-06 Cost review and approval | AQP-21 | R1 core | 5 | 6.75 to 10 | Highest | **Held** behind the roll-up story |
| 6 | EPIC-07 Excel export | AQP-22 | R1 core | 4 | 6.5 to 9.5 | High | First two stories free; rest held |
| 7 | EPIC-10 remainder | AQP-25 | R1 core, R1+ | 4 | 6.5 to 10 (+1 to 1.5) | High | Draft |
| 8 | R1+ stretch (inside EPIC-02, 04, 05, 10) | | R1+ | | 6 to 9.5 | | Build only if the core is on track (checkpoint B) |
| 9 | EPIC-08 Admin configuration | AQP-23 | R2 | 3 | 12 to 16 | Medium | Draft |
| 10 | EPIC-09 E-mail alerts and jobs | AQP-24 | R2 | 3 | 10.5 to 15.5 | Medium | Draft; mail facts needed |

Jira priority follows the PRD value score (5 Highest, 4 High, 3 Medium). Jira rank: AQP-25 (EPIC-10) was ranked before AQP-16 because its first two stories come first; the other nine epics keep creation order (AQP-16 to AQP-24), which equals the order above. EPIC-10's later stories (rank 7) are ordered in section 3, not by epic rank. Epic dependencies are Jira "blocks" links (AQP-16 to AQP-17, 18, 19; AQP-17, 18, 19 to AQP-20; AQP-18, 20 to AQP-21; AQP-20, 21 to AQP-22; AQP-18 to AQP-23; AQP-19 to AQP-24; AQP-14 and AQP-15 to AQP-18).

## 2. Why this order (top 10 stories, with the reasons)

The order weighs value, risk reduction, dependencies and learning. The first ten stories carry no open question.

| Rank | Story | Why here |
|------|-------|----------|
| 1 | 10.01 Scaffold, CI and repository hygiene | Prerequisite for every story. It also installs the secret and repository scan that protects a public repository before any master data can arrive (RISK-006, NFR-006). Enabler, justified in EPIC-10 |
| 2 | 10.02 Design tokens and responsive app shell | Every screen story needs one design system at three widths (NFR-016 to 021). Doing it second means no screen is ever restyled. Enabler. The real-phone, screen-reader and high-contrast checks (DL-017) attach to the first built page |
| 3 | 01.01 Sign in and sign out | First user-visible slice through UI, API and data; proves the stack end to end; unblocks everything behind sign-in |
| 4 | 01.02 Role enforcement and navigation | Builds the route manifest that makes the main promise (GOAL-02) enforceable. Cheaper to start with than to retrofit |
| 5 | 01.03 Engineer sees no cost: projection and scan | The riskiest promise (ARCH-R2). The projection layer and the build-time scan must exist before any cost-bearing view is built, so every later story is born under the scan |
| 6 | 01.04 Admin creates users; one Admin | Needed to have an Engineer and a Lead at all; small |
| 7 | 01.07 Audit service and screen | Masters, approval and configuration all emit into it; building it before them avoids retrofitting events |
| 8 | 03.01 Registry seed and column letters | Starts the engine early: the largest technical risk and the most learning (GOAL-03). Independent of masters |
| 9 | 03.02 Formula engine | The highest-uncertainty item in R1; early work gives the checkpoint-A ratio an honest first data point |
| 10 | 02.01 Process Master | Feeds the first calculation (03.03); a small CRUD that also exercises the audit service |

Stories 11 to 33 take the walking skeleton (03.03 calculates one row end to end) through assignment, the workspace and Calculate. **The roll-up (03.04) is not in the first ten, deliberately.** It is the one story that cannot be Ready (AQP-14, no fallback), and everything that can be built without it is placed ahead of it (07.01 and 07.02, the export of rows, are free of it). If AQP-14 is answered during the first sprints, 03.04 moves to rank 12 and the held chain follows at once.

## 3. Ordered stories (candidates)

Status: **Draft** = to be written by the scrum-master; **Held** = cannot reach Ready until the named input arrives or the master rules. Pri is MoSCoW of the highest FR in the story. Enabler = no FR, justified in the epic file.

| Rank | Story | Title | Epic | FRs | Pri | Stage | Status |
|------|-------|-------|------|-----|-----|-------|--------|
| 1 | 10.01 | Scaffold, CI and repository hygiene | 10 | NFR-006, 025 | Enabler | R1 | Draft |
| 2 | 10.02 | Design tokens and responsive app shell | 10 | 085, 086 | Enabler | R1 | Draft |
| 3 | 01.01 | Sign in and sign out | 01 | 001 | Must | R1 | Draft |
| 4 | 01.02 | Role enforcement and navigation per role | 01 | 007, 009 | Must | R1 | Draft |
| 5 | 01.03 | Engineer sees no cost: projection and scan | 01 | 008 | Must | R1 | Draft |
| 6 | 01.04 | Admin creates and deactivates users; one Admin | 01 | 004, 005 | Must | R1 | Draft |
| 7 | 01.07 | Audit service and audit screen | 01 | 011 | Must | R1 | Draft |
| 8 | 01.05 | Password rule and change own password | 01 | 002, 098 | Must | R1 | Draft |
| 9 | 01.06 | 12-hour session | 01 | 099 | Must | R1 | Draft |
| 10 | 01.08 | About page | 01 | 010 | Must | R1 | Draft |
| 11 | 03.01 | Field registry seed and column letters | 03 | 020, 021 | Must | R1 | Draft |
| 12 | 03.02 | Formula engine | 03 | 022, 023, 026 | Must | R1 | Draft |
| 13 | 02.01 | Process Master | 02 | 012 | Must | R1 | Draft |
| 14 | 02.03 | Material Master | 02 | 015 | Must | R1 | Draft |
| 15 | 02.04 | Exchange Rate Master | 02 | 016 | Must | R1 | Draft |
| 16 | 02.05 | Treatment / Color list | 02 | 017 | Must | R1 | Draft |
| 17 | 02.02 | Customers with default rates and reset | 02 | 013 | Must | R1 | Draft |
| 18 | 04.01 | Assign a task | 04 | 032, 033, 041 | Must | R1 | Draft |
| 19 | 03.03 | Row-level outputs, walking skeleton | 03 | 024 (row), 027, 028 | Must | R1 | Draft |
| 20 | 04.02 | My tasks and the task queue by role | 04 | 034 | Must | R1 | Draft |
| 21 | 04.03 | Overdue cues and bell | 04 | 036, 037 | Must | R1 | Draft |
| 22 | 04.04 | Engineer sees the status of own work | 04 | 102 | Must | R1 | Draft |
| 23 | 06.01 | Estimate status flow | 06 | 064 | Must | R1 | Draft |
| 24 | 05.01 | Open the task and choose the customer | 05 | 042 | Must | R1 | Draft |
| 25 | 05.02 | Build the parts tree | 05 | 043, 044 | Must | R1 | Draft |
| 26 | 05.03 | Part form, first sections | 05 | 045 (part), 046, 051, 052 | Must | R1 | Draft |
| 27 | 05.04 | Part form, remaining sections | 05 | 045 | Must | R1 | Draft |
| 28 | 05.05 | Fasteners fields show only when needed | 05 | 048 | Must | R1 | Draft |
| 29 | 05.06 | Surface Treatments and Treatment / Color | 05 | 049, 050 | Must | R1 | Draft |
| 30 | 05.07 | Part picture | 05 | 047 | Must | R1 | Draft |
| 31 | 05.08 | Save a draft and the unsaved-changes warning | 05 | 053 | Must | R1 | Draft |
| 32 | 02.06 | "Not applicable" system entries | 02 | 018 | Must | R1 | Draft (Q-36 assumption labelled) |
| 33 | 05.09 | Calculate | 05 | 055, 056 | Must | R1 | Draft; **zero check held** (AQP-15) |
| 34 | 03.05 | Calculation record and master snapshot | 03 | 031 | Must | R1 | Draft |
| 35 | 07.01 | Download the worksheet layout | 07 | 066, 071 | Must | R1 | Draft |
| 36 | 07.02 | Node rows, picture and hidden lines | 07 | 067, 068 | Must | R1 | Draft |
| 37 | 02.07 | Delete customer or material with guard | 02 | 013, 015 | Must | R1 | Draft |
| 38 | 10.06 | Reserved drawing region | 10 | 087 | Must | R1 | Draft |
| 39 | 10.03 | Page metadata and indexing | 10 | 089 | Must | R1 | Draft |
| 40 | 10.04 | Install and update with Docker Compose | 10 | 091 (part) | Must | R1 | Draft (OQ-ARCH-02, 03) |
| 41 | 10.05 | Weekly backup, watch check and restore | 10 | 091 | Must | R1 | Draft (OQ-ARCH-12) |
| 42 | 03.04 | Roll-up and product-level values | 03 | 024 (roll-up), 025, 029, 030 | Must | R1 | **Held** (AQP-14, AQP-15) |
| 43 | 06.02 | Estimate review: totals and parts tree | 06 | 024, 025, 029, 030 (display) | Must | R1 | **Held** (03.04) |
| 44 | 06.03 | Cost details and Lead formula view | 06 | 058, 059, 060 | Must | R1 | Held (03.04; UX-39) |
| 45 | 06.04 | Recalculate and the cleared total | 06 | 061, 100 | Must | R1 | **Held** (A-18 ruling, Q-37; UX-38) |
| 46 | 06.05 | Approval blocked while stale or never calculated | 06 | 101 | Must | R1 | Held (06.04) |
| 47 | 06.06 | Approve and lock | 06 | 062 | Must | R1 | Held |
| 48 | 06.07 | Price override with optional reason | 06 | 103, 011 | Should | R1 | Held (UX-43) |
| 49 | 06.08 | Unlock with reason and notices | 06 | 063 | Must | R1 | Held |
| 50 | 06.09 | Approved estimate keeps its approved values | 06 | 065 | Must | R1 | Held |
| 51 | 07.03 | One total and the total Tool Cost | 07 | 069 | Must | R1 | Held (03.04) |
| 52 | 07.04 | Out-of-date and never-calculated files | 07 | 069, 070 | Must | R1 | **Held** (A-18 ruling, Q-37) |
| 53 | 04.05 | Task closes on approval, reopens on unlock | 04 | 038 | Must | R1 | Held (06.06, 06.08) |
| 54 | 03.06 | Calculation performance gate | 03 | NFR-008 | Must | R1 | Held (03.04) |
| 55 | 07.05 | Export size and time gate | 07 | NFR-010 | Must | R1 | Held (07.04) |
| 56 | 10.08 | End-to-end, responsive and accessibility suites | 10 | NFR-016, 018, 019 | Must | R1 | Draft |
| 57 | 10.09 | Performance, capacity and observability | 10 | NFR-009 to 012, 024 | Must | R1 | Draft (Q-18) |
| 58 | 10.10 | Privacy and data-handling checks | 10 | NFR-028, 029 | Must | R1 | Draft |
| 59 | 02.08 | Propagate a changed default | 02 | 014 | Must | R1+ | Draft |
| 60 | 04.06 | Lead default filter and task filters | 04 | 035, 039 | Should | R1+ | Draft |
| 61 | 05.10 | Autosave every 30 seconds | 05 | 054 | Should | R1+ | Draft |
| 62 | 05.11 | Completeness count and tree icons | 05 | 057 | Should | R1+ | Draft |
| 63 | 10.07 | Loading, empty and error states | 10 | 088 | Should | R1+ | Draft |
| 64 | 08.01 | Fields and formulas list | 08 | 072 | Must | R2 | Draft |
| 65 | 08.02 | Edit a formula | 08 | 073, 080 (part) | Must | R2 | Draft |
| 66 | 08.03 | Insert a field with re-lettering | 08 | 074, 075 | Must | R2 | Draft |
| 67 | 08.04 | Delete a field | 08 | 076, 080 (part) | Must | R2 | Draft |
| 68 | 08.05 | Configuration versions | 08 | 077 | Must | R2 | Draft |
| 69 | 08.06 | Checkpoints and revert | 08 | 078, 080 (part) | Must | R2 | Draft |
| 70 | 08.07 | Change history | 08 | 079 | Must | R2 | Draft |
| 71 | 01.09 | Admin hand-over | 01 | 006 | Should | R2 | Draft |
| 72 | 04.07 | Reassign or change a deadline | 04 | 040 | Should | R2 | Draft |
| 73 | 09.01 | Mail outbox and transport (enabler) | 09 | NFR-014 | Enabler | R2 | Draft |
| 74 | 09.02 | Settings: switch, sender, test e-mail | 09 | 019 | Must | R2 | Draft (OQ-ARCH-11) |
| 75 | 09.03 | Assignment e-mail | 09 | 081 | Must | R2 | Draft |
| 76 | 09.04 | Overdue e-mail within 5 minutes | 09 | 082 | Must | R2 | Draft |
| 77 | 09.05 | Daily digest at 11:00 IST | 09 | 083 | Must | R2 | Draft |
| 78 | 09.06 | No duplicates, logged, retried | 09 | 084 | Must | R2 | Draft |
| 79 | 09.07 | Reset a password by e-mailed link | 09 | 003 | Should | R2 | Draft |
| 80 | 09.08 | One real send on the real mailbox | 09 | 019 (verification) | Must | R2 | Draft (OQ-ARCH-11) |

80 candidate stories. Every FR in scope A appears in at least one row, and each FR is owned by exactly one epic (consistency report section 2). Stories that cross an epic boundary, such as 06.01 (needed by 05.09) and 10.06 (built on 05.03), keep their own epic and are ordered by their dependency.

## 4. What the scrum-master should know before sprint planning

- **Sprint 1 candidates with no open question:** ranks 1 to 18, plus 03.03 once 02.01 to 02.04 exist. Nothing needs the real master data (invented placeholders only, NFR-006, ADR-014).
- **Do not plan** 03.04, 05.09's zero check, or any Held story into a sprint as Ready. 03.04 and its chain become plannable on an answer to AQP-14 and either an answer to AQP-15 or the master's adoption of the block fallback at G4 (DL-013).
- **Slicing:** stories 05.03 and 05.04 may need to be split by section of SPEC 7.1 (eight sections) to fit a sprint. 03.03 may be split by output group after the first row works.
- **Every UI story** carries NFR-016, 017, 018 as acceptance criteria (consistency report section 8) and cites the screen names in `ux-spec.md`. Where `ux-spec.md` and PRD v0.7 differ (CR-08), follow the PRD and say so in Dev Context.
- **Roll-up story:** its acceptance criteria cite CE-2, CE-9 and CE-12 (test strategy 5.6) with expected values worked from the delivery lead's number only. No figure from the test strategy goes into a Jira question.
- **Re-issue the dates** from the story count at G4 (release plan 6.2).
