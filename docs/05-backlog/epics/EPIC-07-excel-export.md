# EPIC-07: Excel export

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-22](https://sankumar76.atlassian.net/browse/AQP-22) (labels `ai-delivery`, `aiid-EPIC-07`, `agent-product-owner`; relates to AQP-1; blocked by EPIC-05 and EPIC-06) |
| Release | R1 core |
| Priority | High. PRD value 4. Effort 5.625 to 7.875 h (estimate, release plan v0.11; was 6.5 to 9.5 h at v0.1) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. **No story is held any more.** The out-of-date file is gone and the download is refused instead. The Jira epic was edited |

## Goal & User Value
A Lead or Admin downloads the estimate as an `.xlsx` in the worksheet's own layout (GOAL-04), with one total and the total Tool Cost. A file exists only when a calculation is current, so no file with figures that are out of date can leave the portal.

## Requirements Covered
- Functional: FR-066 to FR-070 (Must, R1); FR-071 (Should, R1). 6 FRs. FR-104 shares the work here (story 07.06).
- Non-functional: NFR-027 (export fidelity), NFR-010 (50 nodes with 50 images within 10 s), NFR-002 (Engineers refused), RISK-010 (close at the G7 of the export story).
- Business rules: BR-023, 024, 026, 055; D-16, D-28, D-30, D-37.

## Scope
**In:** header row and columns A to BO, widths, centred cells, currency formats; one row per node, depth first, Sl. No as text, the part picture in column C when there is one (empty cell when there is none); every column exported (hidden cost lines as 0, divide by zero as empty); BL2, BN2 and BO2 once in row 2, BO2 holding the latest approved price unless its approval was cancelled; the total Tool Cost in a footer row two below the last part, label in the cell to its left, no node's own Tool Cost cell replaced; each row holds its own values, so the exported BG column adds up to BL2 at any quantity; **the download refused, with the reason and a link to Calculate or Recalculate, while the figures are cleared or the estimate was never calculated; no partial file, no marker, no confirmation**; file name pattern; Engineers refused; the quantity-warning notice on the export preview, and no warning in any cell.
**Out:** the override reason and the quantity warning in any cell (decided no); per-item totals (decided one total only, D-16); the out-of-date file, its markers and its dialog (not built, D-28).

## UX & Architecture References
- Screens / journeys: SCR-10 (states Total cleared, Not calculated; no file card in either); UJ-09.
- Components: `server/export` (`build-workbook.ts`, `product-cells.ts`), worker thread; architecture section 4.6; ADR-012 (the paragraph "Replaced for v0.7" governs); TD-01 (ExcelJS pinned, behind `build-workbook.ts`).

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-07.01 | Download the worksheet layout | Header, A to BO in order, widths from the registry, centred, currency formats, file name pattern, Lead and Admin only (FR-066, 071, 070 role part) | Happy path, workflow step | 05.04, 03.01 | Draft |
| 2 | STORY-07.02 | Node rows, picture and hidden lines | Depth-first rows, Sl. No as text ("1.10" keeps its zero), picture scaled in column C or an empty cell, every column present, empty cell for divide by zero (FR-067, 068) | Data variation | 07.01, 05.07 | Draft |
| 3 | STORY-07.03 | One total and the total Tool Cost | BL2, BN2, BO2 once in row 2; footer total Tool Cost equals the sum of the entries; the exported BG column adds up to BL2; BO2 empty for a cancelled approval (FR-069) | Business rule | 07.02, 03.04, 06.06 | Draft |
| 4 | STORY-07.04 | Refuse the download until a calculation is current | A never-calculated estimate and one changed since its last calculation get a refusal that names Calculate or Recalculate; after Recalculate the file downloads; nothing else is blocked (FR-070, D-30, D-37; reading R-1 confirmed) | Unhappy path | 07.03, 06.04 | Draft |
| 5 | STORY-07.05 | Export size and time gate | 50 nodes with 50 images within 10 s (p95); 500-node measurement recorded; RISK-010 closed or restated at G7 (NFR-010) | Non-functional verification | 07.04 | Draft |
| 6 | STORY-07.06 | Quantity-warning notice on the export preview | While current, the preview names each row with a 0, who went ahead and when; no warning in any cell (FR-104, architecture A-24) | Role variation of 05.12 | 07.03, 05.12 | Draft |

## Epic Acceptance Criteria
- [ ] The SPEC 14.12 checklist passes, read with the D-16 exception, and the file opens in Excel desktop with no repair prompt.
- [ ] BL2, BN2 and BO2 are populated once; the total Tool Cost appears once and equals the sum of the Tool Cost entries; no per-item totals; no node's own Tool Cost entry is replaced; the exported BG column adds up to BL2 at any quantity.
- [ ] SPEC 14.15: for an estimate never calculated, and after any input change until Calculate or Recalculate, the download is refused and says which; with a current calculation a Lead or Admin can download; an Engineer's request is refused.
- [ ] A cancelled approval leaves BO2 empty; a part with no picture leaves column C empty and passes.
- [ ] A 50-node estimate with 50 images exports within 10 s (p95).

## Dependencies & Risks
- Depends on: EPIC-05 (inputs and pictures), EPIC-06 (approval, cleared state). 07.01 and 07.02 can start as soon as the form exists.
- **Nothing is held.** The questions that held 07.03 and 07.04 at v0.1 (the roll-up number, the A-18 ruling, Q-37) are all answered.
- Open inputs: OQ-PM-05 (largest realistic estimate with images; the architect measured about 17 s for 500 nodes on a laptop against a 10 s target set for 50 nodes: different sizes, so no conflict, but the limit decision is open and the PROPOSED value stands).
- SPEC §10 is corrected in v1.12 (CR-24 closed): the exported BG column adds up to BL at any quantity, as FR-069 says.
- Risks: RISK-010, TD-01 (ExcelJS has had no stable release since 2023). A file downloaded while current can fall behind later on someone's disk; the portal cannot recall it (ADR-012).
