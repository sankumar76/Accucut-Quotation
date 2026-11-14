# EPIC-05: Estimate workspace

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-20](https://sankumar76.atlassian.net/browse/AQP-20) (labels `ai-delivery`, `aiid-EPIC-05`, `agent-product-owner`; relates to AQP-1, AQP-15) |
| Release | R1 core (FR-054, 057 R1+ stretch) |
| Priority | Highest. PRD value 5. Effort 11.75 to 17.125 h core plus 1.5 to 2.5 h stretch (estimate, release plan v0.11); the largest R1 epic |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. FR-104 added to this epic, the picture is optional, QTY per Assy gets a hint; the zero check is no longer held. The Jira epic was edited |

## Goal & User Value
Engineers enter a product tree quickly through a guided form with no cost shown, type the count of each part for the whole order, and press Calculate. If any count is 0 they are warned and can go ahead. This is the primary user flow (GOAL-01).

## Requirements Covered
- Functional: FR-042 to FR-053, 055, 056, **104** (R1 core); FR-054, 057 (R1+, Should). 17 FRs. FR-104 is owned here; its work is shared with EPIC-03 (the rule), EPIC-06 (the Lead's screens) and EPIC-07 (the export preview), where stories 06.10 and 07.06 carry the other parts.
- Non-functional: NFR-002 (no cost on any workspace response, the warning included), NFR-005 (images), NFR-009 (key screen load), NFR-016, 017, 018 per story.
- Business rules: BR-006 to 010, 013, 014, 048; D-05, D-06, D-22, D-26, D-31, D-34.

## Scope
**In:** customer chosen before entry and confirmed on change; product tree to any depth with automatic Sl. No; the eight-section part form (SPEC 7.1) with column-letter badges and range labels; **QTY per Assy typed on every row as the count for the whole order, with the hint "Enter the count for the whole order, not per assembly" under the field (label and Excel header unchanged)**; Enter to the next field; part picture (paste, drop, file or camera; under 200 KB; **optional, never required, no missing-picture message**); Fasteners fields shown only when needed; Surface Treatments multi-select; Treatment / Color with "Other" and "Not applicable"; read-only shaded auto fields and Material Rate absent; number rules; save any time with the unsaved-changes warning; any real input change bumps the estimate's revision (the hook that clears figures, FR-100); Calculate with completeness validation, the single success message, SUBMITTED; zero accepted for fields a part does not need; **the quantity warning: every 0 in QTY per Assy is named by Sl. No and name, says that row will cost 0, and the Engineer can go back or go ahead (FR-104)**; autosave and completeness indicators (stretch).
**Out:** any cost display to an Engineer; the reserved drawing region (FR-087, EPIC-10 story 10.06, built on this screen); the status machine (FR-064, EPIC-06 story 06.01, scheduled before Calculate); the Lead's warning screens (06.10) and the export notice (07.06).

## UX & Architecture References
- Screens / journeys: SCR-05 (default, phone and tablet frames; states "Quantity warning" and "Warning with a new list"); UJ-04, UJ-05.
- Components: `lib/estimate` (`quantityWarnings` in `validation`, `warning-copy.ts`), `server/estimates`, `server/images`, `server/views`; architecture sections 4.3, 4.4, 4.8, 6; ADR-008 (the 409 `CALCULATE_ACK_REQUIRED` keeps one strict schema), ADR-013; test strategy sections 5.2 (CE-9), 6, 12.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-05.01 | Open the task and choose the customer | Entry blocked until a customer is chosen; a later change asks for confirmation (FR-042) | Workflow step | 04.01, 02.02 | Ready for Dev (AQP-301, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 2 | STORY-05.02 | Build the parts tree | Add child or sibling, reorder, delete, to any depth; Sl. No generated and renumbered; a move or reorder changes no price (FR-043, 044) | CRUD operations on the tree | 05.01 | Ready for Dev (AQP-302, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 3 | STORY-05.03 | Part form, first sections, and the hint on QTY per Assy | Form shell with letter badges, section ranges, Enter-to-next-field, auto fields read-only, decimals rules; the hint under QTY per Assy (FR-045 part, 046, 051, 052, 029 hint) | Data variation by section (SPEC 7.1 has eight; the scrum-master splits further if a story exceeds one sprint) | 05.02 | Ready for Dev (AQP-303, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 4 | STORY-05.04 | Part form, remaining sections | The rest of SPEC 7.1 including Tool Cost, Machining Cost and Plating Cost typed with the other inputs (FR-045) | Data variation by section | 05.03 | Ready for Dev (AQP-304, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 5 | STORY-05.05 | Fasteners fields show only when needed | Qty and Cost hidden, not required, stored 0 when Fasteners is None or blank (FR-048) | Business rule | 05.03 | Ready for Dev (AQP-313, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 6 | STORY-05.06 | Surface Treatments and Treatment / Color | One multi-select sets eight flags; Treatment / Color or "Other" with free text; "Not applicable" shown as text on the part (FR-049, 050, 018 display) | Data variation | 05.03, 02.05, 02.06 | Ready for Dev (AQP-314, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 7 | STORY-05.07 | Part picture, optional | Add by paste, drop or file; preview; replace and remove; refuse wrong type and over 200 KB; a part with no picture passes Calculate and is not listed as missing (FR-047, NFR-005) | Happy path, then error paths | 05.03 | Ready for Dev (AQP-315, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 8 | STORY-05.08 | Save a draft and the unsaved-changes warning | Save with blanks; warning before leaving with unsaved changes; a real change bumps the revision and a save that changes nothing does not (FR-053, FR-100 hook) | Happy path | 05.03 | Ready for Dev (AQP-316, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 9 | STORY-05.09 | Calculate | Blank visible inputs block with the nodes and fields named, checked before any warning; success sets SUBMITTED, shows only the fixed message and no cost; a 0 in any number field is accepted (FR-055, 056) | Happy and unhappy path | 05.04, 03.05, 06.01 | Ready for Dev (AQP-317, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 10 | STORY-05.12 | Warn on a 0 in QTY per Assy | First press of Calculate returns the list of rows with a 0 and writes nothing; "Go back" changes nothing; "Calculate anyway" repeats the request with the revision it was shown and runs the calculation; a changed input shows the new list; the acknowledgement is stored with the calculation and audited; the 409 carries no cost, rate or formula and is the same under two sets of masters; a top-level item's own 0 warns (reading R-2) (FR-104, CE-9 warnings column) | Business-rule variation: happy path, then stale list | 05.09, 03.05, 01.07 | Ready for Dev (AQP-318, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 11 | STORY-05.10 | Autosave every 30 seconds (R1+) | A save that changes nothing is not a change (FR-054) | Workflow step | 05.08 | Draft |
| 12 | STORY-05.11 | Completeness count and tree icons (R1+) | Count and icon, not by colour alone; Part Model is not counted as a required input (FR-057) | Data variation | 05.09 | Draft |

Numbering note: 05.12 was added after 05.11 so that IDs already shown in comment 10515 do not move.

## Epic Acceptance Criteria
- [ ] SPEC 14.3 and 14.4 pass: Sl. No renumbers after add, reorder and delete; Fasteners fields hide and store 0; a blank visible input blocks Calculate and names the nodes and fields (the Part Model picture is never an error).
- [ ] A 199 KB PNG is accepted; a 201 KB file and a text file renamed `.png` are refused with a clear message; a part with no picture passes Calculate.
- [ ] Calculate on success sets SUBMITTED and shows only "Cost will be calculated based on the input fields and sent for review/approval."; the Engineer's inputs are then read-only.
- [ ] With a 0 in QTY per Assy on any row, Calculate warns first naming each such row, writes nothing on the first press, calculates on "Calculate anyway" and gives that row BG 0 while the rows below it keep theirs (CE-9 variants A to G; FR-104 fit criteria 1, 2, 5, 6, 7, 8).
- [ ] The EPIC-01 Engineer scan finds 0 cost, rate or formula values on every workspace page and response, including the warning.

## Dependencies & Risks
- Depends on: EPIC-02, EPIC-03 (row-level calculation and the calculation record), EPIC-04 (the estimate). Calculate also needs the DRAFT to SUBMITTED transition of FR-064 (STORY-06.01, scheduled before 05.09).
- **Nothing is held.** OQ-UX-13 is answered (picture optional, D-31); AQP-15 is answered (Warn, D-22, D-26). **Correction to v0.1:** 05.09 now depends on 03.05, because Calculate stores the calculation record (FR-031); v0.1 ordered 03.05 after it by mistake.
- Reading carried: a top-level item's own 0 warns (R-2, the architect's reading, A-27); "Keep warning" did not say. If the master rules otherwise it is one condition in the rule.
- The quantity-warning notice on SCR-06, 08 and 10 is a labelled wording preview with example rows, because the sample has no row with a 0 (UX hand-off 10564; CR-28).
- Risks: ARCH-R2 (leak through a passed prop), ARCH-R6 (a mistyped count is a wrong price that nothing flags; the hint and the count shown beside each row on the Lead's screens are the only help), RISK-013 (a warning can be passed unread), the Enter key on mobile keyboards, 500-node tree performance (NFR-008, NFR-009).
