# EPIC-02: Masters and settings

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-17](https://sankumar76.atlassian.net/browse/AQP-17) (labels `ai-delivery`, `aiid-EPIC-02`, `agent-product-owner`; relates to AQP-1) |
| Release | R1 core (FR-014 is R1+ stretch) |
| Priority | High. PRD value 4. Effort 5.75 to 9.5 h core plus 2 to 3 h stretch (estimate, release plan v0.11) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. Scope changed (FR-105 added; "Not applicable" narrowed), so the Jira epic was edited |

## Goal & User Value
The Admin holds the rates and lists that drive every calculation, so a Lead gets prices that follow Accucut's own rates and an Engineer picks customers and materials without ever seeing a rate. The Admin can also see on Settings that the weekly backup ran.

## Requirements Covered
- Functional: FR-012, 013, 015, 016, 017, 018, 105 (R1 core); FR-014 (R1+ stretch). 8 FRs. FR-019 (the alert switch on Settings) is EPIC-09.
- Non-functional: NFR-001 (Admin-only), NFR-006 (invented placeholders only), NFR-007 (master edits audited), NFR-013 (the Last backup line is how the Admin checks).
- Business rules: BR-003 and BR-004 (Admin-only masters; no rate reaches an Engineer; asserted by every master story's role and scan criteria), BR-028 to BR-033, BR-048; D-17, D-27, D-33, D-36.

## Scope
**In:** Process Master (named rate, unit, default; used-by check); Customers (name only required, rates, Reset to Defaults, delete guard); Material Master (unique Material in Drawing, Specific Gravity above 0, delete guard); Exchange Rate Master; Treatment / Color list ("Other" always present); system-created "Not applicable" entries: offered to anyone who edits a part, the words show on a part to everyone, no master list or Admin page holds them, zero values and the Material Considered and Material Rate fields stay hidden or blank (D-27); propagation prompt when a default changes (stretch); **the Settings page frame with the read-only Last backup line, the "Backup late" notice after 8 days and the "Disk nearly full" notice below 20 percent free (FR-105, firm, R1 core)**.
**Out:** the alert switch, sender and test e-mail on Settings (FR-019, EPIC-09, which fills the frame this epic builds); the backup job and the restore command (EPIC-10); real master data (the Admin types it at first use, D-23, ADR-014); entry of rates beyond 2 decimals (D-24: no).

## UX & Architecture References
- Screens / journeys: SCR-11, 12, 13, 15 (staged R1 core for the Last backup line and R2 for the alert controls since UX v0.6, CR-26 closed); UJ-10, UJ-13.
- Components: `server/masters`, `server/settings`, `lib/fields`; architecture sections 4.9, 5.1, 5.5, 9.5; ADR-002, ADR-014.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-02.01 | Process Master list and edit | Admin adds, updates and deletes rates; a used item cannot be deleted and the formulas are listed (FR-012) | CRUD operations | 01.04, 03.01 (the used-by index) | Draft |
| 2 | STORY-02.02 | Customers with default rates and Reset to Defaults | Name-only customer, one value per Process Master item, reload defaults after confirmation (FR-013) | CRUD (create, edit, reset) | 02.01 | Draft |
| 3 | STORY-02.03 | Material Master | Unique Material in Drawing, price per kg, Specific Gravity above 0, Material-Scrap-Rate per kg (FR-015) | CRUD | 01.04 | Draft |
| 4 | STORY-02.04 | Exchange Rate Master | 1 USD and 1 EUR in INR with last updated by and at (FR-016) | Data variation (two rates) | 01.04 | Draft |
| 5 | STORY-02.05 | Treatment / Color list | CRUD with "Other" locked (FR-017) | CRUD | 01.04 | Draft |
| 6 | STORY-02.06 | "Not applicable" system entries | Created at install in Material and Treatment, values 0, not editable or deletable, in no list; offered in the drop-down to Engineer, Lead and Admin; the words show on a part to everyone; material cost only skipped (FR-018, D-27) | Business-rule variation | 02.03, 02.05, 03.03 | Draft |
| 7 | STORY-02.07 | Delete customer or material with guard | Refused while a Draft or Submitted estimate uses it, estimates named; calculated estimates keep their figures (FR-013, 015) | CRUD (delete) | 02.02, 02.03, 04.01 | Draft |
| 8 | STORY-02.08 | Propagate a changed default (R1+) | Customers equal to the old default update; others get apply or keep, with apply-all and keep-all (FR-014) | Workflow step | 02.02 | Draft |
| 9 | STORY-02.09 | Settings page frame and the Last backup line | Admin-only Settings page with the date of the last good backup, "Backup late" after 8 days, "Disk nearly full" below 20 percent free; read-only, no control that starts, restores or deletes a backup; an Engineer or Lead cannot open it (FR-105, NFR-013) | Workflow step (read) | 01.02, 01.04, 10.05 (the `job_runs` it reads) | Draft |

Splitting note: 02.09 is the page frame that EPIC-09 later fills (STORY-09.02). Its hours are in EPIC-09's row, not here (release plan 3.1, CR-27).

## Epic Acceptance Criteria
- [ ] A new customer's rates equal the current defaults; reset after confirmation restores them.
- [ ] A used Process Master item cannot be deleted and the formulas using it are listed; a duplicate Material in Drawing is refused.
- [ ] "Not applicable" exists after install with all values 0, cannot be edited or deleted, appears on no list or Admin page, is offered to Engineer, Lead and Admin in the two drop-downs, and shows as text on a part to everyone.
- [ ] Deleting a customer or material used by a Draft or Submitted estimate is refused and names the estimates.
- [ ] In a controlled-clock test a last good backup 7 days old shows its date and no notice, one 9 days old shows "Backup late", and a free-space reading below the threshold shows "Disk nearly full"; the lines have no control that starts, restores or deletes a backup.
- [ ] Each master edit creates exactly one audit entry (FR-011); no rate reaches an Engineer response.

## Dependencies & Risks
- Depends on: EPIC-01. 02.07 needs EPIC-04 (estimates exist). 02.06's skip of material cost is exercised through EPIC-03. 02.09 needs the backup job's `job_runs` rows (STORY-10.05).
- **No open question holds a story.** Q-36 is answered (D-27), Q-40 is answered (D-24: 2 decimals on entry stands), and OQ-ARCH-12's key-holder part is answered (D-36). OQ-UX-07 (units beside inputs) stays with the Admin and is confirmed when the master data is typed in; it holds no story.
- Reading carried: D-27 narrows "do not show this anywhere" to "the text shows on a part; zero values and master lists stay hidden" (the orchestrator's reading, SPEC §18 D-27). Story 02.06 states it in Dev Context.
- Risks: RISK-006 (real data reaching the public repository): the stories use invented placeholders and the CI scan of story 10.01 applies. ARCH-R7 (a full disk on the same server) is shown to the Admin by 02.09.
