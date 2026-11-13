# EPIC-03: Field registry and calculation engine

| Field | Value |
|-------|-------|
| Owner | product-owner |
| Jira | [AQP-18](https://sankumar76.atlassian.net/browse/AQP-18) (labels `ai-delivery`, `aiid-EPIC-03`, `agent-product-owner`; relates to AQP-1, AQP-14, AQP-15) |
| Release | R1 core |
| Priority | Highest. PRD value 5. Effort 9 to 13.625 h (estimate, release plan v0.11; v0.1 of this file said 10 to 15 h) |
| Status | Draft. **Re-issued 2026-11-02** against SPEC v1.12, PRD v0.11, UX v0.6, architecture v0.10. **No story is held any more.** Scope changed, so the Jira epic was edited |

## Goal & User Value
The portal calculates every cost column from master data as the worksheet does, and totals an estimate as the worksheet does: BL is the sum of BG over every row. The Engineer types QTY per Assy as the count for the whole order on every row; the portal multiplies no row by another row's count. The user value reaches people through EPIC-05 (Calculate) and EPIC-06 (the Lead's figures).

**Why this is an enabler epic.** The formula module is pure logic with a hand-calculated oracle and a 95 percent coverage rule (NFR-025). Its stories deliver through the API and the test harness until EPIC-05 puts a screen on them. To keep value visible early, story 03.03 is sliced as a walking skeleton that calculates one row end to end. This is the only epic that is horizontal by design.

## Requirements Covered
- Functional: FR-020 to FR-031 (12 FRs, all Must, R1). FR-029 and FR-030 now describe the worksheet's own rule, not a roll-up.
- Non-functional: NFR-008 (500 nodes under 2 s), NFR-025 (formula module at least 95 percent), NFR-026 (stored values unchanged); NFR-002 in the response shape.
- Business rules: BR-012, 015 to 025, 034, 035, 036 (BL as a plain formula), 037, 039, 046, 047; D-04, D-05, D-06, D-07, D-08, D-12, D-21, D-25.

## Scope
**In:** field registry and sections seeded from SPEC section 7 (structure only); Excel-style letters derived from position; formula engine (operands, + - x /, brackets, SUM, MIN, MAX, ROUND, IF with comparisons; no `eval`; **no ROLLUP**); dependency order and cycle rejection; SPEC 7.4 outputs per BR-015 to BR-022, `BB = BA x H` as the only place H is used; division by zero shows a dash and an empty export cell; server-side calculation at full precision; percentage rates; **BL seeded as `SUM(BG)` and BN as `BL / SUM(BM)`**; BO; calculation records with a master snapshot and a place for the acknowledged quantity warnings.
**Out:** the Calculate and Recalculate buttons (EPIC-05, EPIC-06); the quantity warning itself (FR-104; its rule, dialog and notices are stories 05.12, 06.10 and 07.06); Admin editing of fields and formulas (EPIC-08); clearing figures on an input change (FR-100, EPIC-06).

## UX & Architecture References
- Screens / journeys: none of its own (SCR-18 formula editor is EPIC-08); results show on SCR-06, 07.
- Components: `lib/formula`, `lib/fields`, `lib/columns.ts`, `lib/estimate`, `server/calc`. There is no `lib/rollup` any more. Architecture sections 4.2, 4.3, 4.5, 5.1; ADR-004, 005, 006 (rewritten), 007. Test strategy section 5 (CE-1 to CE-12) and 5.4 (`quantity-in-one-formula`, `bl-is-sum-bg`, `no-rolled-up-figure`).

## Stories (ordered)

| # | Story ID | Title | Intent (one line) | Splitting pattern | Depends on | Status |
|---|----------|-------|-------------------|-------------------|------------|--------|
| 1 | STORY-03.01 | Field registry seed and column letters | Registry holds every SPEC section 7 field in order with letter, section, type, width and format; letters derived, never stored; BL seeded `SUM(BG)`, BN `BL / SUM(BM)` (FR-020, 021) | Data variation (fields); enabler | 10.01 | Draft |
| 2 | STORY-03.02 | Formula engine | Parse and evaluate the supported operands, operators and functions with no `eval`; dependency order; reject unknown names, syntax errors and cycles naming the cycle (FR-022, 023, 026) | Enabler (pure module, justified above) | 03.01 | Draft |
| 3 | STORY-03.03 | Row-level outputs, walking skeleton | Calculate one node's SPEC 7.4 outputs (columns M to BK) from a customer's rates, material and exchange rates, full precision, 2 decimals shown, percentage rates typed as 12 for 12 % (decimals allowed, 12.5 gives 0.125; EPIC-02 ruling of 2026-11-12) (FR-024 row level, 027, 028) | Workflow step (one row end to end), then data variation by output group | 03.02, 02.02, 02.03, 02.04 | Ready for Dev (AQP-291, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 4 | STORY-03.04 | Product total: BL as the sum of BG, BN and BO | The seed formulas work through the real evaluator; the constructed cases assert from the first commit: CE-1 at 30 (and 24 with cost on the lid alone), CE-2 at 840, 316 and 660, CE-3 at 5, CE-4 at 15, 25 and 30, CE-5, CE-6 at 246, CE-7 (BN 6), CE-9 BL column (variants A to G), CE-10 at 6, CE-11, CE-12 at 15, 5, 17 and 1000; the three structure tests (FR-024 product level, 025, 029, 030) | Business-rule variation (a seed formula and its oracle; 0.5 to 0.75 h) | 03.03, 03.01 | Ready for Dev (AQP-292, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 5 | STORY-03.05 | Calculation record and master snapshot | Each Calculate and Recalculate stores the configuration version, every master value used and a `warnings` list (empty by default); stored values unchanged after master edits (FR-031, NFR-026) | Workflow step | 03.03 | Ready for Dev (AQP-293, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |
| 6 | STORY-03.06 | Calculation performance gate | 500 nodes recalculate in under 2 s, p95 over 20 runs, machine recorded (NFR-008) | Non-functional verification | 03.04 | Ready for Dev (AQP-294, 2026-11-13, fast track CLAUDE.md §9, light DoR; no PO validation round). |

## Epic Acceptance Criteria
- [ ] Every SPEC 7.4 output matches a hand-calculated value to 2 decimals on known inputs, and the tree 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 passes end to end.
- [ ] BL equals the sum of the BG column at any quantity: CE-1, CE-2, CE-12 and the properties of test strategy 5.5 pass, none pending, skipped or marked todo (test strategy 5.6); `quantity-in-one-formula`, `bl-is-sum-bg` and `no-rolled-up-figure` pass.
- [ ] A configuration with an unknown name, a syntax error or a cycle fails validation and names the cycle; code search finds 0 uses of `eval` or `new Function`; formula module coverage is at least 95 percent.
- [ ] A 500-node estimate recalculates in under 2 seconds (p95, 20 runs).
- [ ] A previously calculated estimate's stored values are unchanged after any master change.

## Dependencies & Risks
- Depends on: EPIC-01 (shell, audit), EPIC-02 (master values for 03.03).
- **Nothing is held.** The roll-up that held 03.04 at v0.1 no longer exists. AQP-14 (Q-35 a: 1000), AQP-15 (Warn) and AQP-26 (Q-39: 4 and 12 typed, 840) are answered in SPEC §18 (D-12, D-21, D-22, D-26). Their Jira issues still read "To Do" and AQP-14 and AQP-15 still carry a "blocks AQP-18" link, which the master ruled no longer holds (DL-022, DL-024); neither can be removed with the Jira tools available here (CR-31). The expected values come from their numbers (test strategy 5.6, control 2). **No figure from the test strategy goes into any question.**
- Reading carried: the 840 of CE-2 is their two figures added (600 and 240), not a number they stated (SPEC §7.4 BL). The master has not said whether that meets DL-024's "a number" for Q-39 (CR-23).
- Residual risk the tests cannot catch: ARCH-R6, a mistyped count is a wrong price (3 typed for 12 gives 660). The field keeps its name "QTY per Assy" with a hint under it (D-34).
- Risks: RISK-002 (largely answered; the master restates it), ARCH-R6, RISK-001.
