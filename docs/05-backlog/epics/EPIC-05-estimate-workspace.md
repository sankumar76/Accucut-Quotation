# EPIC-05: Estimate workspace

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-20](https://sankumar76.atlassian.net/browse/AQP-20) (labels `ai-delivery`, `aiid-EPIC-05`, `agent-product-owner`; relates to AQP-1, AQP-15) |
| Release | R1 core (FR-054, 057 R1+ stretch) |
| Priority | Highest. PRD value 5, effort 11 to 16 h core plus 1.5 to 2.5 h stretch (estimate); the largest R1 epic |
| Status | Draft |

## Goal & User Value
Engineers enter a product tree quickly through a guided form with no cost shown, and press Calculate. This is the primary user flow (GOAL-01).

## Requirements Covered
- Functional: FR-042 to FR-053, 055, 056 (R1 core); FR-054, 057 (R1+, Should). 16 FRs.
- Non-functional: NFR-002 (no cost on any workspace response), NFR-005 (images), NFR-009 (key screen load), NFR-016, 017, 018 per story.
- Business rules: BR-006 to 010, 013, 014, 048; D-05, D-06.

## Scope
**In:** customer chosen before entry and confirmed on change; product tree to any depth with automatic Sl. No; the eight-section part form (SPEC 7.1) with column-letter badges and range labels; Enter to the next field; part picture (paste, drop, file or camera; under 200 KB); Fasteners fields shown only when needed; Surface Treatments multi-select; Treatment / Color with "Other"; read-only shaded auto fields and Material Rate absent; number rules; save any time with the unsaved-changes warning; Calculate with completeness validation, the single success message, SUBMITTED; zero accepted for fields a part does not need; autosave and completeness indicators (stretch).
**Out:** reserved drawing region (FR-087, EPIC-10 story 10.06, built on this screen); the status machine (FR-064, EPIC-06 first story); showing any cost to an Engineer.

## UX & Architecture References
- Screens / journeys: SCR-05 (default, phone and tablet frames); UJ-04, UJ-05.
- Components: `lib/estimate`, `server/estimates`, `server/images`, `server/views`; architecture sections 4.4, 4.5, 6; ADR-013; test strategy sections 6, 12.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-05.01 | Open the task and choose the customer | Entry blocked until a customer is chosen; a later change asks for confirmation (FR-042) | Workflow step | 04.01, 02.02 | Draft |
| 2 | STORY-05.02 | Build the parts tree | Add child or sibling, reorder, delete, to any depth; Sl. No generated and renumbered (FR-043, 044) | CRUD operations on the tree | 05.01 | Draft |
| 3 | STORY-05.03 | Part form, first sections | Form shell with letter badges, section ranges, Enter-to-next-field, auto fields read-only, decimals rules (FR-045 part, 046, 051, 052) | Data variation by section (SPEC 7.1 has eight; the scrum-master splits further by section if a story exceeds one sprint) | 05.02 | Draft |
| 4 | STORY-05.04 | Part form, remaining sections | The rest of SPEC 7.1 including Tool Cost, Machining Cost and Plating Cost typed with the other inputs (FR-045) | Data variation by section | 05.03 | Draft |
| 5 | STORY-05.05 | Fasteners fields show only when needed | Qty and Cost hidden, not required, stored 0 when Fasteners is None or blank (FR-048) | Business rule | 05.03 | Draft |
| 6 | STORY-05.06 | Surface Treatments and Treatment / Color | One multi-select sets eight flags; Treatment / Color or "Other" with free text (FR-049, 050) | Data variation | 05.03, 02.05 | Draft |
| 7 | STORY-05.07 | Part picture | Add by paste, drop or file; preview; replace and remove; refuse wrong type and over 200 KB (FR-047, NFR-005) | Happy path, then error paths | 05.03 | Draft |
| 8 | STORY-05.08 | Save a draft and the unsaved-changes warning | Save with blanks; warning before leaving with unsaved changes (FR-053) | Happy path | 05.03 | Draft |
| 9 | STORY-05.09 | Calculate | Blank visible inputs block with the nodes and fields named; success sets SUBMITTED, shows only the fixed message and no cost; zero accepted for fields a part does not need; QTY per Assy of 0 per AQP-15 (FR-055, 056) | Happy and unhappy path | 05.04, 03.03, 06.01 | Draft; **AQP-15 part held** |
| 10 | STORY-05.10 | Autosave every 30 seconds (R1+) | A save that changes nothing is not a change (FR-054) | Workflow step | 05.08 | Draft |
| 11 | STORY-05.11 | Completeness count and tree icons (R1+) | Count and icon, not by colour alone (FR-057) | Data variation | 05.09 | Draft |

## Epic Acceptance Criteria
- [ ] SPEC 14.3 and 14.4 pass: Sl. No renumbers after add, reorder and delete; Fasteners fields hide and store 0; a blank visible input blocks Calculate and names the nodes and fields.
- [ ] A 199 KB PNG is accepted; a 201 KB file and a text file renamed `.png` are refused with a clear message.
- [ ] Calculate on success sets SUBMITTED and shows only "Cost will be calculated based on the input fields and sent for review/approval."; the Engineer's inputs are then read-only.
- [ ] A zero in any number field other than QTY per Assy passes Calculate; the rule for QTY per Assy of 0 on a part with parts below it follows the answer to AQP-15, or the block fallback.
- [ ] The EPIC-01 Engineer scan finds 0 cost, rate or formula values on every workspace page and response.

## Dependencies & Risks
- Depends on: EPIC-02, EPIC-03 (row-level calculation), EPIC-04 (the estimate). 05.09 also needs the DRAFT to SUBMITTED transition: EPIC-06's first story (06.01) is scheduled before 05.09.
- Open inputs: OQ-UX-13 (a picture required on every part: working design is required, no message is defined, UX owes one); AQP-15 for the zero check; Q-37 does not touch this epic except that any input change (including a picture, a move or a reorder) must mark the estimate out of date (FR-100 hook, 0.5 to 1 h in the epic estimate).
- Risks: ARCH-R2 (leak through a passed prop), the Enter key on mobile keyboards, 500-node tree performance (NFR-008, NFR-009).
