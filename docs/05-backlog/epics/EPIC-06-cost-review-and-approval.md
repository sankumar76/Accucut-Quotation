# EPIC-06: Cost review and approval

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-21](https://sankumar76.atlassian.net/browse/AQP-21) (labels `ai-delivery`, `aiid-EPIC-06`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-03 and EPIC-05) |
| Release | R1 core |
| Priority | Highest. PRD value 5. Effort 11.125 to 15.875 h (estimate, release plan v0.10; was 6.75 to 10 h at v0.1) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.11, PRD v0.10, UX v0.5, architecture v0.9. **No story is held any more.** FR-106, 107 and 108 added. The Jira epic was edited |

## Goal & User Value
Leads and Admins check the arithmetic, set the Approved Quote Price and lock it, only from a current calculation, and are told when rates have changed since. They can unlock with a reason. Only the Admin can cancel an approval and then remove its price. An approved estimate never changes when masters change later (GOAL-06).

## Requirements Covered
- Functional: FR-058 to FR-065, 100, 101, 103, **106, 107, 108** (R1 core; FR-103 is Should). 14 FRs. FR-104 shares the work here (story 06.10).
- Non-functional: NFR-004 (two of the six step-up actions are here at R1), NFR-007 (override, approval, unlock, cancel, removal and warning audited), NFR-026 (regression: approve, change masters, compare screen and export), NFR-002 (Lead and Admin only; no button for Engineers), NFR-017, 018.
- Business rules: BR-011, 012, 026, 027, 051, 054, 056; D-07, D-18, D-20, D-28, D-29, D-32.

## Scope
**In:** estimate review (BL, BN, BO tiles; the parts tree with one figure per row, the same on screen and in the file; how the total is built); View Cost Details in six stages with formulas; hidden unselected treatment lines; Lead reads formulas read-only on SCR-07 (FR-060); Recalculate; **every calculated figure cleared on any input change** (BL, BN, pre-fill, total Tool Cost, every row's values, reconciliation) while BO, the latest approved price, stays labelled; approval blocked while cleared or never calculated; Approve and lock with override and optional reason; unlock with reason and notices, the earlier price kept labelled "Approved earlier"; status flow; approved estimate kept as approved; **the quantity-warning notice for Lead and Admin (FR-104); the rate-change notice before approval, counts by kind, approval not blocked (FR-106); Admin-only cancel approval with reason and password (FR-107); Admin-only removal of the cancelled price with password (FR-108)**.
**Out:** the Excel file (EPIC-07); a Lead's formula editing (EPIC-08).

## UX & Architecture References
- Screens / journeys: SCR-06 (states Total cleared, Rates changed, Quantity warning, Warning on this calculation, Cancel approval, Approval cancelled, Remove price, Price removed), SCR-07, SCR-08, SCR-09, SCR-16; UJ-06, UJ-07, UJ-08.
- Components: `server/approval`, `server/calc`, `lib/estimate/figure-state.ts`, `lib/estimate/rate-diff.ts`; architecture sections 4.4, 4.8, 4.10; ADR-007 (columns added to `approvals`), ADR-009 (step-up). Test strategy sections 5.2 (CE-9), 9.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-06.01 | Estimate status flow | DRAFT, SUBMITTED, APPROVED and back on unlock; Engineer inputs read-only once SUBMITTED; a Lead's Recalculate on a DRAFT sets SUBMITTED with the same checks (FR-064) | Workflow step; scheduled before 05.09 | 04.01 | Draft |
| 2 | STORY-06.02 | Estimate review: totals and rows | BL, BN and BO tiles once each; every row one figure with its count beside it, equal to its row in the file; how the total is built, adding to BL (FR-024, 025, 029, 030 display) | Workflow step (read) | 03.04, 05.09 | Draft |
| 3 | STORY-06.03 | Cost details and Lead formula view | Six stages with formulas for one row; unselected treatment lines hidden; no edit controls for a Lead; Engineers never see the button; "Cleared. Press Recalculate" in place of the stages (FR-058, 059, 060) | Data variation by stage | 06.02 | Draft |
| 4 | STORY-06.04 | Recalculate and the cleared figures | Any input change clears every calculated value until Recalculate; autosave with no change does not; BO keeps the latest approved price, labelled (FR-061, 100) | Business rule | 06.02, 05.08 | Draft |
| 5 | STORY-06.05 | Approval blocked while not current | The server refuses on a never-calculated estimate and on one changed since the last calculation, naming the missing step (FR-101) | Unhappy path | 06.04 | Draft |
| 6 | STORY-06.06 | Approve and lock | Approved Quote Price pre-filled and editable; inputs read-only; approver and time stored (FR-062) | Happy path | 06.05 | Draft |
| 7 | STORY-06.07 | Price override with optional reason | Override logged; optional reason up to 500 characters, shown on the estimate and in the audit log, written into no cell (FR-103, FR-011) | Business-rule variation | 06.06, 01.07 | Draft |
| 8 | STORY-06.08 | Unlock with reason and notices | Reason, configuration and rate notices, back to DRAFT; the price approved earlier stays, labelled, until approved again or removed (FR-063) | Workflow step | 06.06 | Draft |
| 9 | STORY-06.09 | Approved estimate keeps its approved values | Immutable record; regression test over rates, material prices and exchange rates (FR-065, NFR-026) | Non-functional verification | 06.06, 03.05 | Draft |
| 10 | STORY-06.10 | Quantity warning for Lead and Admin | A Lead's or Admin's Calculate or Recalculate asks again, even for a 0 the Engineer already went ahead on; while current, the review shows a notice naming each row, who went ahead and when, with the row marked; the approval dialog says it in one line and approval is not stopped; withheld while cleared (FR-104) | Role variation of 05.12 | 05.12, 06.02, 06.06 | Draft |
| 11 | STORY-06.11 | Rate-change notice to the Lead | While current and not approved, the review and the approval dialog count what changed by kind with a link to Recalculate, no old or new value; approval is not blocked; an approved estimate shows no notice; a formula change alone shows none (FR-106, reading R-3) | Business rule | 06.02, 06.06, 03.05 | Draft |
| 12 | STORY-06.12 | Cancel approval, Admin only | Reason and password; on an APPROVED estimate it does what Unlock does; the price stays on screen labelled "Approval cancelled" and leaves the file; a Lead has no button and a request is refused; audited with the price before; builds the step-up primitive (FR-107, NFR-004, NFR-007) | Role variation of 06.08; **cut-ladder step 4** | 06.06, 06.08, 01.07 | Draft |
| 13 | STORY-06.13 | Remove the cancelled price, Admin only | A separate step with a second password; offered only after a cancel and only for the latest approval; BO reads "Not set yet" on every screen and in the file; no undo; the audit keeps the price (FR-108, reading R-4) | CRUD operation (delete) as its own slice; **cut-ladder step 4** | 06.12 | Draft |

## Epic Acceptance Criteria
- [ ] Approval on a never-calculated estimate and on one changed since its last calculation is refused by the server with a message naming the missing step; after Recalculate it is accepted.
- [ ] After a change to any input (Remarks included) BL, BN, the pre-fill, the total Tool Cost and every row's calculated values show no value until Recalculate; autosave with no change leaves them in place; a value changed and changed back counts as two changes; BO still shows the latest approved price, labelled.
- [ ] After approval inputs are read-only; approver and time are recorded; an override is logged; the reason is optional and stored with the override.
- [ ] Unlock logs a reason, shows the configuration and rate notices, and recalculation then uses the current masters. After a change of a rate, a material price and an exchange rate the review counts 1 of each kind and shows no value; an approved estimate shows no notice.
- [ ] After approval, changing a process rate, a material price and an exchange rate leaves the approved screen and export identical.
- [ ] The Admin cancels an approval with a reason and the right password (status DRAFT, task open, BO2 empty in a new file); removal is offered only after a cancel; a Lead has no button and a Lead's request is refused; both steps are audited with the price before.

## Dependencies & Risks
- Depends on: EPIC-03 (STORY-03.04 and 03.05) and EPIC-05. Only 06.01 can start before Calculate exists.
- **Nothing is held.** v0.1 held this epic behind a roll-up story and a ruling on a childless item's figure. The roll-up is gone (SUM(BG)), and every row's figure clears with the rest, so a single-piece product is no special case (DL-018 overtaken by Q-37). The Held marks of v0.1 are cleared.
- Readings carried (SPEC §18, PRD 9.1): R-1 "block the portal" means the Excel download only (confirmed "Yes", D-37); R-3 "rates" means the master values and an approving Admin sees the notice too; R-4 "removed" means gone from every screen and the file, the audit record keeps the price. FR-107 and FR-108 are conditional in their wording ("only IF POSSIBLE", feasible per the architect, 2.75 to 4 h): **cut-ladder step 4**, the delivery lead's to cut.
- Dependency for EPIC-01 and EPIC-08: 06.12 builds the step-up primitive (password re-entry in the same request) that 01.09, 08.02, 08.04 and 08.06 reuse.
- Risks: ARCH-R8 (the one Admin holds the top role, the key and server access: cancel and remove are audited, and the audit log is a record, not a control over the Admin), RISK-013, RISK-012 (closed by the master when the out-of-date file went), the "wording preview" states of the Warn notice (CR-28).
