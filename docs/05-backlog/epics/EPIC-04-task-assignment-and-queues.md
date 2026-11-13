# EPIC-04: Task assignment and queues

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-19](https://sankumar76.atlassian.net/browse/AQP-19) (labels `ai-delivery`, `aiid-EPIC-04`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-035, 039 R1+ stretch; FR-040 R2) |
| Priority | High. PRD value 4, effort 3.25 to 5.75 h core plus 1.5 to 2.5 h stretch (estimate) |
| Status | Draft. Re-issued 2026-11-02 against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10; scope unchanged, so the Jira epic was not edited |

## Goal & User Value
A Lead or Admin assigns work with a folder path and deadline; Engineers see their own queue and the status of their work, never a price; late work is visible in the portal (bell and Overdue tab).

## Requirements Covered
- Functional: FR-032, 033, 034, 036, 037, 038, 041, 102 (R1 core); FR-035, 039 (R1+, Should); FR-040 (R2, Should; its effort sits in EPIC-09, release plan 3.1). 11 FRs.
- Non-functional: NFR-015 (IST display, UTC storage; a 23:30 IST deadline test), NFR-002 (Engineer pages), NFR-017, 018.
- Business rules: BR-002, 045, 052; D-18.

## Scope
**In:** assign a task (folder path as link and Copy path, deadline in IST, optional title and notes) creating an empty estimate; task IDs Q-year-number; Open, Closed and Overdue tabs by role; overdue cues; bell count; task closes on approval and returns on unlock; Engineer status display; Lead default filter and task filters (stretch); reassign and change deadline (R2).
**Out:** e-mail alerts (EPIC-09); the workspace (EPIC-05).

## UX & Architecture References
- Screens / journeys: SCR-03 (Lead, Admin, Engineer variants and phone and tablet frames), SCR-04; UJ-02, UJ-03, UJ-13.
- Components: `server/tasks`, `lib/time.ts`; architecture sections 4.4, 5.1, 6; `task_sequences`, `assignment_revision`.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-04.01 | Assign a task | Lead or Admin assigns an Engineer with folder path (link and Copy path) and IST deadline; empty DRAFT estimate and ID created in one transaction (FR-032, 033, 041) | Happy path, create operation | 01.04, 01.02 | Draft |
| 2 | STORY-04.02 | My tasks and the task queue by role | Open, Closed and Overdue tabs sorted by deadline; Engineer sees own tasks only, Lead and Admin see all (FR-034) | Business-rule variation by role | 04.01 | Ready for Dev (AQP-298, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 3 | STORY-04.03 | Overdue cues and bell | Colour, icon and "Overdue by X"; bell count per role opens the Overdue tab and stays visible on mobile (FR-036, 037, NFR-015) | Data variation by role | 04.02 | Ready for Dev (AQP-295, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 4 | STORY-04.04 | Engineer sees the status of own work | Draft, Submitted, Approved, Closed on every Engineer page that lists or opens a task, and no price (FR-102) | Business rule | 04.02, 01.03 | Ready for Dev (AQP-296, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 5 | STORY-04.05 | Task closes on approval, reopens on unlock or cancel | Derived from estimate status, so an unlock and an Admin's cancel approval (FR-107) both reopen it (FR-038) | Workflow step | 04.02, 06.06, 06.08, 06.12 | Ready for Dev (AQP-297, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 6 | STORY-04.06 | Lead default filter and task filters (R1+) | "Assigned by me" opens by default and can be changed; filter by Engineer, customer and date (FR-035, 039) | Data variation | 04.02 | Draft |
| 7 | STORY-04.07 | Reassign or change a deadline (R2) | Logged with who, when, old and new; refused on an approved task (FR-040) | CRUD (update) | 04.02, 01.07 | Draft |

## Epic Acceptance Criteria
- [ ] A task assigned by a Lead or Admin appears in the Engineer's Open queue and its estimate exists in DRAFT.
- [ ] Tab membership and order are correct on seeded tasks; an overdue task stays in Open too; an Engineer cannot open another's task.
- [ ] Every overdue row shows colour, icon and "Overdue by X"; the bell count is right per role and opens the Overdue tab.
- [ ] Every Engineer page showing a task shows its status and no cost, rate or formula value (the EPIC-01 scan still finds 0).
- [ ] Approve moves the task to Closed and unlock returns it to Open (verified when EPIC-06 lands).

## Dependencies & Risks
- Depends on: EPIC-01. 04.05 needs EPIC-06 approval and unlock (schedule last).
- Open inputs: none blocking. The folder path link behaviour is the kept assumption Q-12 (tooltip explains blocked links).
- Risks: the 23:30 IST deadline edge (NFR-015); the bell on mobile (SCR-03 phone frame).
