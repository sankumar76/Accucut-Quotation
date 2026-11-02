# EPIC-03: Field registry and calculation engine

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-18](https://sankumar76.atlassian.net/browse/AQP-18) (labels `ai-delivery`, `aiid-EPIC-03`, `agent-product-owner`; relates to AQP-1, AQP-14, AQP-15; blocked by AQP-14 and AQP-15 for the roll-up story) |
| Release | R1 core |
| Priority | Highest. PRD value 5, effort 10 to 15 h (estimate). Rank 3, with the roll-up story held |
| Status | Draft; **roll-up story held** by AQP-14 and AQP-15 |

## Goal & User Value
The portal calculates every cost column from master data as the worksheet does (GOAL-03), and totals an estimate by the delivery lead's quantity rule: every level's quantity applies. The user value reaches people through EPIC-05 (Calculate) and EPIC-06 (the Lead's figures).

**Why this is an enabler epic.** The formula module is pure logic with a hand-calculated oracle and a 95 percent coverage rule (NFR-025). Its stories deliver through the API and the test harness until EPIC-05 puts a screen on them. To keep value visible early, story 03.03 is sliced as a walking skeleton that calculates one row end to end. This is the only epic that is horizontal by design, and the justification is recorded here.

## Requirements Covered
- Functional: FR-020 to FR-031 (12 FRs, all Must, R1).
- Non-functional: NFR-008 (500 nodes under 2 s), NFR-025 (formula module at least 95 percent), NFR-026 (stored values unchanged); NFR-002 in the response shape.
- Business rules: BR-012, 015 to 025, 034 to 037, 039, 046, 047; D-04, D-05, D-06, D-07, D-08, D-12.

## Scope
**In:** field registry and sections seeded from SPEC section 7 (structure only); Excel-style letters derived from position; formula engine (operands, + - x /, brackets, SUM, ROLLUP, MIN, MAX, ROUND, IF with comparisons; no `eval`); dependency order and cycle rejection; SPEC 7.4 outputs per BR-015 to BR-022; division by zero shows a dash and an empty export cell; server-side calculation at full precision; percentage rates; the roll-up with one named quantity step; BL, BN, BO; calculation records with a master snapshot.
**Out:** Calculate and Recalculate buttons (EPIC-05, EPIC-06); Admin editing of fields and formulas (EPIC-08); the cleared-total behaviour (FR-100, EPIC-06).

## UX & Architecture References
- Screens / journeys: none of its own (SCR-18 formula editor is EPIC-08); results show on SCR-06, 07.
- Components: `lib/formula`, `lib/rollup` (`applyQuantityStep` in `src/lib/rollup/quantity-step.ts`), `lib/fields`, `lib/columns.ts`, `server/calc`. Architecture sections 4.2, 4.3, 4.5, 5.1; ADR-004, 005, 006, 007. Test strategy section 5 (CE-1 to CE-12) and 5.6.

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-03.01 | Field registry seed and column letters | Registry holds every SPEC section 7 field in order with letter, section, type, width and format; letters derived, never stored (FR-020, 021) | Data variation (fields); enabler | 10.01 | Draft |
| 2 | STORY-03.02 | Formula engine | Parse and evaluate the supported operands, operators and functions with no `eval`; dependency order; reject unknown names, syntax errors and cycles naming the cycle (FR-022, 023, 026) | Enabler (pure module, justified above) | 03.01 | Draft |
| 3 | STORY-03.03 | Row-level outputs, walking skeleton | Calculate one node's SPEC 7.4 outputs (columns M to BK) from a customer's rates, material and exchange rates, full precision, 2 decimals shown, whole-percentage rates (FR-024 row level, 027, 028) | Workflow step (one row end to end), then data variation by output group | 03.02, 02.02, 02.03, 02.04 | Draft |
| 4 | STORY-03.04 | Roll-up and product-level values | `ROLLUP(BG)`, the quantity step, BL, BN and BO once per estimate, the FR-030 constructed cases and CE-2, CE-9, CE-12 asserted from the delivery lead's number (FR-024 roll-up, 025, 029, 030) | Business-rule variation; held | 03.03; **AQP-14, AQP-15** | **Blocked** |
| 5 | STORY-03.05 | Calculation record and master snapshot | Each Calculate and Recalculate stores the configuration version and every master value used; old values unchanged after master edits (FR-031, NFR-026) | Workflow step | 03.03 | Draft |
| 6 | STORY-03.06 | Calculation performance gate | 500 nodes recalculate in under 2 s, p95 over 20 runs, machine recorded (NFR-008) | Non-functional verification | 03.04 | Draft |

## Epic Acceptance Criteria
- [ ] Every SPEC 7.4 output matches a hand-calculated value to 2 decimals on known inputs, and the tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 passes end to end.
- [ ] The three FR-030 cases pass, and CE-2, CE-9 and CE-12 are asserted from the delivery lead's number with none pending, skipped or marked todo (test strategy 5.6).
- [ ] A configuration with an unknown name, a syntax error or a cycle fails validation and names the cycle; code search finds 0 uses of `eval` or `new Function`; formula module coverage is at least 95 percent.
- [ ] A 500-node estimate recalculates in under 2 seconds (p95, 20 runs).
- [ ] A previously calculated estimate's stored values are unchanged after any master change.

## Dependencies & Risks
- Depends on: EPIC-01 (shell, audit), EPIC-02 (master values for 03.03).
- **Held: STORY-03.04.** Q-35 (a) is Jira AQP-14: it asks for a number, silence does not close it and there is no fallback (DL-012). OQ-ARCH-10 is AQP-15: no reply by G4 means a block at Calculate and Recalculate applies as the labelled fallback (DL-013), which is the master's fail-safe and not the delivery lead's decision. The story's acceptance criteria cite CE-2, CE-9 and CE-12 with expected values worked from the delivery lead's number (test strategy 5.6, control 2). **No candidate figure from the test strategy goes into any question.**
- The wider chain: 03.04 feeds EPIC-06 and EPIC-07; if AQP-14 is still open when EPIC-05 finishes, those two epics stall.
- Rejected alternative: splitting 03.04 so that the part not touching the item's own row could start. Rejected because DL-012 holds the roll-up story as one unit and the test strategy forbids pending cases (control 3); the scrum-master may raise it again with the master.
- Risks: RISK-002 (rule differs from intent where the sample cannot show it), RISK-013 (QTY per Assy of 0), RISK-001.
