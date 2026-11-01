# ADR-006: Cost roll-up and one named quantity step

| Field | Value |
|-------|-------|
| Status | Proposed. The rule is the D-12 baseline; Q-32 (a) still needs the delivery lead's own-words confirmation before G3 can pass (DL-006) |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-024, 025, 029, 030; GOAL-03; SPEC §7.4 BL, §18 D-08, D-12, §18.5; G2 condition 5; RISK-002 |

## Context
BL = item quantity x the sum of BG over the item's own row and every descendant row, and the estimate's BL is the sum over top-level items. A parent shows its own row plus everything below it, not multiplied again by its own quantity; the export shows each row's own values (D-12).

Two things make this dangerous:
1. Q-32 (a), whether a quantity between the item and a lowest-level part multiplies the parts under it, rests on list wording. Column H "QTY per Assy" is undefined. The two readings differ by a factor of 3 in the FR-030 example (a sub-part counted 8 or 24 times).
2. If a parent's displayed figure ever enters a sum, the parent is counted twice.

G2 condition 5 requires one named step, and the stored row BG kept apart from the displayed figure.

## Decision Drivers
- RISK-002: a change to (a) must not cost a redesign
- GOAL-03: the sample cannot test quantities, and no later test can catch a wrong rule
- FR-029, FR-030: exact roll-up
- FR-075: BL must re-letter like any other column

## Considered Options
### Option A — One function for every quantity application, branded row and rolled-up types, roll-up in pure code, `ROLLUP(column)` in the formula language
- Pros: (a) lives in one branch of one function; double counting does not compile; BL stays a visible formula; no schema depends on the rule
- Cons: one new formula function that SPEC §8.2 does not list
- Cost / effort: within FR-030's 2.5 to 4 h

### Option B — A per-level multiplier stored as a configuration setting
- Pros: (a) can change at run time
- Cons: puts a pricing rule into a switch that nobody asked for, which could be flipped by accident, and adds a test matrix. The delivery lead's answer should settle it once
- Cost / effort: higher

### Option C — Write the roll-up as ordinary formulas over tree helpers in the seed configuration
- Pros: fully Admin-editable
- Cons: tree recursion in the language; the rule would spread across formulas, against condition 5
- Cost / effort: higher and riskier

## Decision
We will put the rule in `src/lib/rollup/`.

- `quantity-step.ts` exports `applyQuantityStep(sum, quantity, level)`, with levels `'top-item'` and `'into-parent'`. **This is the only place a quantity is applied to a sum.** At the baseline, `'top-item'` multiplies and `'into-parent'` returns the sum unchanged.
- `roll-up.ts` walks the tree bottom-up in O(n), reading row outputs and producing figures, item totals and BL. It is the only importer of `quantity-step.ts`.
- `calculation_rows.outputs` holds each row's own values. `calculation_rows.rollup` holds displayed figures. The types `RowOutputs` and `RolledUpFigures` are branded and not assignable to each other. Nothing reads `rollup` back into a sum. Export reads `outputs` only.
- BL is seeded as `ROLLUP(BG)`. Columns with `rollupDisplay` (BG, BJ, BK) go through the same walk, so no letter is special-cased.

A change to Q-32 (a) means changing the `'into-parent'` branch to `sum.times(quantity)` and the expected values in the test table. Schema, API, screens, row outputs and approved estimates do not change. Checked by hand against the FR-030 example: the baseline gives 14, and the changed branch gives 30, with the sub-part counted 24 times.

## Consequences
- Positive: condition 5 is met in code structure, not by convention, and the change has a known size.
- Negative / trade-offs accepted: `ROLLUP` is one more function to explain; SCR-06's "How the total is built" covers it. An Admin could replace `ROLLUP(BG)` with `SUM(BG)` in R2, which silently drops the item quantity: SCR-18 therefore warns when a formula on a field that held `ROLLUP` stops using it.
- Follow-up actions (with owners): business-analyst and product-manager update BR-047, SPEC §7.4 BL, FR-030 and GOAL-03 if the reply differs from D-12; product-manager lists `ROLLUP` in FR-022.

## Verification
Constructed examples in `test-strategy.md` section 5, through the real evaluator. Architecture tests that hold the step to one place. **Limit:** these tests prove the code matches the stated rule. They cannot prove the rule is right, and the parallel run cannot either, since it uses a worksheet calculated the same way. Only the delivery lead's confirmation closes that.
