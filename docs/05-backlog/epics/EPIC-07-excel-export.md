# EPIC-07: Excel export

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-22](https://sankumar76.atlassian.net/browse/AQP-22) (labels `ai-delivery`, `aiid-EPIC-07`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-05 and EPIC-06) |
| Release | R1 core |
| Priority | High. PRD value 4, effort 6.5 to 9.5 h (estimate) |
| Status | Draft |

## Goal & User Value
A Lead or Admin downloads the estimate as an `.xlsx` in the worksheet's own layout (GOAL-04), with one total and the total Tool Cost, and is told plainly when a file is out of date.

## Requirements Covered
- Functional: FR-066 to FR-070 (Must, R1); FR-071 (Should, R1). 6 FRs.
- Non-functional: NFR-027 (export fidelity), NFR-010 (50 nodes with 50 images within 10 s), NFR-002 (Engineers refused), RISK-010 (close at the G7 of the export story, as the master did not take the architect's closure).
- Business rules: BR-023, 024, 026; D-16.

## Scope
**In:** header row and columns A to BO, widths, centred cells, currency formats; one row per node, depth first, Sl. No as text, part picture in column C; every column exported (hidden cost lines as 0, divide by zero as empty); BL2, BN2 and BO2 once in row 2; the total Tool Cost in a footer row two below the last part, label in the cell to its left, no node's own Tool Cost cell replaced; export at any status including never calculated; the out-of-date file (stated choice, file name, sheet tab and notice row); file name pattern; Engineers refused.
**Out:** the override reason in any cell (decided no, OQ-UX-19); per-item totals (decided one total only, D-16).

## UX & Architecture References
- Screens / journeys: SCR-10 (Total cleared, Confirm out-of-date download); UJ-09.
- Components: `server/export` (`build-workbook.ts`, `product-cells.ts`), worker thread; architecture section 4.6; ADR-012; TD-01 (ExcelJS pinned, behind `build-workbook.ts`).

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-07.01 | Download the worksheet layout | Header, A to BO in order, widths from the registry, centred, currency formats, file name pattern, Lead and Admin only (FR-066, 071, 070 role part) | Happy path, workflow step | 05.04, 03.01 | Draft |
| 2 | STORY-07.02 | Node rows, picture and hidden lines | Depth-first rows, Sl. No as text ("1.10" keeps its zero), picture scaled in column C, every column present, empty cell for divide by zero (FR-067, 068) | Data variation | 07.01, 05.07 | Draft |
| 3 | STORY-07.03 | One total and the total Tool Cost | BL2, BN2, BO2 once in row 2; footer total Tool Cost equals the sum of the entries (FR-069 current state) | Business rule | 07.02, 03.04, 06.06 | **Held** (03.04) |
| 4 | STORY-07.04 | Out-of-date and never-calculated files | Stated choice before download; file name, sheet tab and notice row say OUT OF DATE; cost cells empty on a never-calculated estimate (FR-069, 070) | Unhappy path | 07.03, 06.04 | **Held** (A-18, Q-37) |
| 5 | STORY-07.05 | Export size and time gate | 50 nodes with 50 images within 10 s (p95); 500-node measurement recorded; RISK-010 closed or restated at G7 (NFR-010) | Non-functional verification | 07.04 | Draft |

## Epic Acceptance Criteria
- [ ] The SPEC 14.12 checklist passes, read with the D-16 exception, and the file opens in Excel desktop with no repair prompt.
- [ ] BL2, BN2 and BO2 are populated once; the total Tool Cost appears once and equals the sum of the Tool Cost entries; no per-item totals; no node's own Tool Cost entry is replaced.
- [ ] On an estimate whose inputs changed after the last calculation, BL2, BN2, BO2 and the total Tool Cost are empty, the download asks for a confirmation, and the file name, sheet tab and notice row carry OUT OF DATE.
- [ ] An Engineer request for the export is refused; a Lead's download of a never-calculated Draft gives the inputs and no cost values.
- [ ] A 50-node estimate with 50 images exports within 10 s (p95).

## Dependencies & Risks
- Depends on: EPIC-05 (inputs and pictures), EPIC-06 (approval; cleared state). 07.01 and 07.02 can start before the roll-up story is Ready.
- Held by: AQP-14 and AQP-15 (through 03.04, for BL2), the A-18 ruling and Q-37 (what the file holds while the total is cleared, and for a single-piece item's row).
- Open inputs: OQ-PM-05 (largest realistic estimate with images; the architect measured about 17 s for 500 nodes on a laptop against a 10 s target set for 50 nodes: different sizes, so no conflict, but the limit decision is open).
- Risks: RISK-010, RISK-012, TD-01 (ExcelJS has had no stable release since 2023).
