# EPIC-06: Cost review and approval

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-21](https://sankumar76.atlassian.net/browse/AQP-21) (labels `ai-delivery`, `aiid-EPIC-06`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-03 and EPIC-05) |
| Release | R1 core |
| Priority | Highest. PRD value 5, effort 6.75 to 10 h (estimate) |
| Status | Draft; **review and approval stories held** behind STORY-03.04 and the A-18 ruling |

## Goal & User Value
Leads and Admins check the arithmetic, set the Approved Quote Price and lock it, only from a current calculation. They can unlock with a reason. An approved estimate never changes when masters change later (GOAL-06).

## Requirements Covered
- Functional: FR-058 to FR-065, 100, 101 (Must, R1); FR-103 (Should, R1). 11 FRs.
- Non-functional: NFR-007 (override, approval and unlock audited), NFR-026 (regression: approve, change masters, compare screen and export), NFR-002 (Lead and Admin only, no button for Engineers), NFR-017, 018.
- Business rules: BR-011, 012, 026, 027, 051; D-07, D-18, D-20.

## Scope
**In:** estimate review (BL, BN, BO tiles, the parts tree with the Sigma figures and the export-row figure side by side); View Cost Details in six stages with formulas; hidden unselected treatment lines; Lead reads formulas read-only on SCR-07 (PM decision OQ-UX-18, FR-060); Recalculate; the total cleared on any input change; approval blocked while stale or never calculated; Approve and lock with override and optional reason; unlock with reason and notices; status flow; approved estimate kept as approved.
**Out:** the Excel file (EPIC-07); a Lead's formula editing (EPIC-08).

## UX & Architecture References
- Screens / journeys: SCR-06 (default, phone, tablet), SCR-07, SCR-08, SCR-09; UJ-06, UJ-07, UJ-08.
- Components: `server/approval`, `server/calc`, `lib/estimate/figure-state.ts`; architecture sections 4.4, 4.8; ADR-007. UX-29, UX-30, UX-31, UX-38, UX-39, UX-43 (see consistency report).

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-06.01 | Estimate status flow | DRAFT, SUBMITTED, APPROVED and back on unlock; Engineer inputs read-only once SUBMITTED; a Lead's Recalculate on a DRAFT sets SUBMITTED with the same checks (FR-064) | Workflow step; scheduled before 05.09 | 04.01 | Draft |
| 2 | STORY-06.02 | Estimate review: totals and parts tree | BL, BN and BO tiles once each, the tree with figures, the screen figure against the export row, how the total is built (FR-024 display, 025 display, 029 display, 030 display) | Workflow step (read) | 03.04, 05.09 | **Held** (AQP-14, AQP-15) |
| 3 | STORY-06.03 | Cost details and Lead formula view | Six stages with formulas for one row; unselected treatment lines hidden; no edit controls for a Lead; Engineers never see the button (FR-058, 059, 060) | Data variation by stage | 06.02 | Held |
| 4 | STORY-06.04 | Recalculate and the cleared total | Any input change clears BL, BN and the pre-fill until Recalculate; row costs stay and are marked out of date (FR-061, 100) | Business rule | 06.02 | **Held** (A-18 ruling, Q-37) |
| 5 | STORY-06.05 | Approval blocked while stale or never calculated | Server refuses and names the missing step (FR-101) | Unhappy path | 06.04 | Held |
| 6 | STORY-06.06 | Approve and lock | Approved Quote Price pre-filled and editable; inputs read-only; approver and time stored (FR-062) | Happy path | 06.05 | Held |
| 7 | STORY-06.07 | Price override with optional reason | Override logged; optional reason up to 500 characters, shown on the estimate, SCR-10 and the audit log, written into no cell (FR-103, FR-011) | Business-rule variation | 06.06, 01.07 | Held |
| 8 | STORY-06.08 | Unlock with reason and notices | Reason, configuration and rate notices, back to DRAFT, price approved earlier stays in history and is not the current price (FR-063) | Workflow step | 06.06 | Held |
| 9 | STORY-06.09 | Approved estimate keeps its approved values | Immutable record; regression test over rates, material prices and exchange rates (FR-065, NFR-026) | Non-functional verification | 06.06, 03.05 | Held |

## Epic Acceptance Criteria
- [ ] Approval on a stale or never-calculated estimate is refused by the server with a message naming the missing step; after Recalculate it is accepted.
- [ ] After a change to any input (Remarks included), BL, BN and the pre-fill show no value until Recalculate; autosave with no change leaves the total in place; a value changed and changed back counts as two changes.
- [ ] After approval inputs are read-only; approver and time are recorded; an override is logged; the reason is optional and stored with the override.
- [ ] Unlock logs a reason, shows the configuration and rate notices, and recalculation then uses the current masters.
- [ ] After approval, changing a process rate, a material price and an exchange rate leaves the approved screen and export identical.

## Dependencies & Risks
- Depends on: EPIC-03 (STORY-03.04) and EPIC-05. Only 06.01 can start before the roll-up story is Ready.
- **Held by:** AQP-14 and AQP-15 (through 03.04); the master's ruling on the A-18 extension (childless top-level item withheld on screen), which the PRD marks pending in FR-100; Q-37 (what a cleared total means for part figures, the export and a price approved before an unlock). The working assumption runs, but a story whose acceptance criteria rest on an unruled design cannot meet "no open question" in the DoR.
- Screen gaps for the ux-expert (not fixed here): UX-38 (no page shows a childless top-level item), UX-39 (SCR-07 has no Total cleared state), UX-43 (SCR-08 wording and the 409 `TOTALS_OUT_OF_DATE` message), UX-36 (the QTY per Assy 0 message on SCR-06, held for AQP-15).
- Open inputs, non-blocking: OQ-UX-16 (a notice of changed rates before approval; working design: no notice; 0.5 to 1 h if wanted).
- Risks: RISK-002, RISK-012 (out-of-date export), the single-piece product case (DL-012).
