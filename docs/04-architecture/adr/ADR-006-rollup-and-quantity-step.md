# ADR-006: Cost roll-up and one named quantity step

| Field | Value |
|-------|-------|
| Status | Accepted (G3 CONDITIONAL GO, condition 14, 2026-11-01): the structure, meaning one named step, figures kept apart, and `ROLLUP`. The rule is D-12 as revised in SPEC v1.4, every level's quantity; DL-006 is met (DL-011). **Revised 2026-11-02 for architecture v0.6, for `master` to check at G4.** A top-level item with nothing below it is settled: Q-35 (a) answered 1000 (AQP-14 comment 10510; D-21; DL-024). **Q-39 is unresolved:** its rupee answer, 660, does not fit the rule, which gives 840, while their counts of 24 lids and 12 brackets do, and the rupee total is still being confirmed (AQP-26 comments 10530, 10531, 10533). This decision is frozen as written until they answer, and the roll-up story cannot pass G7. What a part shows rests on ASSUMPTION-52. A QTY per Assy of 0 warns on every row (AQP-15 comments 10511, 10527; A-27 for a top-level item) |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-024, 025, 029, 030, 056, 104; GOAL-03; NFR-008; SPEC §7.4 BL, §18 D-08, D-12, D-21, D-22, §18.5; G2 condition 5; RISK-002, RISK-013; Q-35, Q-38, Q-39; OQ-ARCH-10; DL-012, DL-013, DL-022, DL-024; AQP-14 comment 10510; AQP-15 comments 10511, 10527; AQP-26 comments 10530, 10531, 10533; ADR-007, ADR-008 |

## Context
The rule changed in SPEC v1.4. QTY per Assy (H) is how many identical pieces of a part sit in one of its parent (AQP-13 comment 10487, their own words), and every level's quantity applies: 2 frames, 3 pipes per frame and 4 lids per pipe count 24 lids (AQP-1 comment 10490, relayed). The version 1.3 rule, multiply once at the top item, is withdrawn.

`T(row) = BG(row) + H(row) x sum of T(child)`, and BL is the sum of T over the top-level items. A part shows T(row) on screen (ASSUMPTION-52); the export shows each row's own values.

Three things make this dangerous:
1. Each row's BG already holds its own H (`BB = BA * H`). Applying H to a row's own figure again would overcharge it.
2. If a parent's displayed figure ever enters a sum, the parent is counted twice.
3. The sample has quantity 1 on every row, so it cannot test any of this.

G2 condition 5 requires one named step, and the stored row BG kept apart from the displayed figure.

## Decision Drivers
- RISK-002: a change to the rule must not cost a redesign
- GOAL-03: the sample cannot test quantities, and no later test can catch a wrong rule
- FR-029, FR-030: exact roll-up
- FR-075: BL must re-letter like any other column
- NFR-008: 500 nodes in under 2 s, at any depth

## Considered Options
### Option A — One function for every quantity application, branded row and rolled-up types, roll-up in pure code, `ROLLUP(column)` in the formula language
- Pros: the rule lives in one small module; double counting does not compile; BL stays a visible formula; no schema depends on the rule
- Cons: one new formula function that SPEC §8.2 does not list
- Cost / effort: within FR-030's 2.5 to 4 h

### Option B — A per-level multiplier stored as a configuration setting
- Pros: the rule can change at run time
- Cons: puts a pricing rule into a switch that nobody asked for, which could be flipped by accident, and adds a test matrix
- Cost / effort: higher

### Option C — Write the roll-up as ordinary formulas over tree helpers in the seed configuration
- Pros: fully Admin-editable
- Cons: tree recursion in the language; the rule would spread across formulas, against condition 5
- Cost / effort: higher and riskier

### Option D (for v0.3) — The closed form: each BG times the product of H over the rows above it
- Pros: reads like SPEC §7.4
- Cons: O(n x depth). Measured at 186 ms for one column on a 500-deep chain, against 6 ms for three columns by Option A
- Cost / effort: low, but used only as a test oracle

## Decision
We will put the rule in `src/lib/rollup/`.

- `quantity-step.ts` exports `applyQuantityStep(childTotals, ownQuantity)`. **This is the only place a quantity is applied to a sum.** It takes only the children's totals, so a row's own BG can never meet its own H.
- `roll-up.ts` walks the rows once, in reverse depth-first order, with no recursion, in O(n): `T(row) = BG(row) + applyQuantityStep(Σ T(child), H(row))`. It also records the multiplier above each row, for reconciliation. It is the only importer of `quantity-step.ts`.
- `calculation_rows.outputs` holds each row's own values. `calculation_rows.rollup` holds displayed figures. The types `RowOutputs` and `RolledUpFigures` are branded and not assignable to each other. Nothing reads `rollup` back into a sum. Export reads `outputs` only.
- BL is seeded as `ROLLUP(BG)`. Columns with `rollupDisplay` (BG, BJ, BK) go through the same walk, so no letter is special-cased.

**Corrected for v0.3.** The earlier version of this ADR said a change to Q-32 (a) meant changing one branch, `'into-parent'`. That was true only when the item's own row holds 0. That branch alone would leave `itemTotal = H(item) x (BG(item) + ...)`, which counts the item's own row twice, the version 1.3 reading that SPEC v1.4 withdraws. The actual change was the step, the removal of the `top-item` level, and the T line of the walk. It stayed inside `src/lib/rollup/`, with no schema, API or screen-structure change, so condition 5's purpose held, though not in the one branch claimed.

**Corrected for v0.4.** This ADR said that if Q-35 (a) rules that the item's own row also takes the item quantity, one line in `roll-up.ts` changes. That repeated the overclaim corrected above. The change is still contained in `src/lib/rollup/`, its tests and the wording, with no schema or API change, but it touches the T line for top-level rows, the multiplier held for an item's own row, the rule that a row's own BG never reaches the step, and the closed-form test oracle, and it moves the reconciliation wording (architecture section 4.3). Case CE-2 would move from 316 to 326, and case CE-12, a single-piece product at quantity 3, from 15 to 45: on a top-level item with no rows below it the two readings differ by a factor of the item quantity (DL-012). If Q-35 (b) changes what a part shows, only the stored display figure and `rollup-copy.ts` change, and BL does not.

**Corrected for v0.6 (DL-024).** Version 0.5 said here that the reading above would not be needed and that the walk stood as confirmed. That overclaimed. Q-35 (a) was answered 1000 for quantity 5 at 200 a piece (AQP-14 comment 10510), which fits this decision for a top-level item with nothing below it, and only CE-12 variants A, B and D carry that number. Their working reads 500 x 2 where the example has 5 and 200, and it is unexplained.

**Q-39 unresolved, this decision frozen (AQP-26 comments 10530, 10531, 10533).** Their rupee answer on an item with a part below it is 660, against 840 by this rule. The item's own row agrees. The part does not: it is counted 3 times, not 12. Their counts fit the rule: 24 lids, and 12 brackets for 4 frames with 3 each. The rupee total is still being confirmed. Both are their answers, and the team does not choose. This ADR does not change until they answer, CE-1 and CE-2 are marked unconfirmed with their values unchanged, and no alternative is designed. An answer that takes the item's quantity off what sits below it would reach beyond the list in "Corrected for v0.4": the step itself, the multiplier above each row and most constructed cases, still inside `src/lib/rollup/`, its tests and the wording (architecture section 4.3).

**Warn (AQP-15 comments 10511, 10527).** Decided before the roll-up and outside it, in `lib/estimate/validation`, so `rollUp` and the step do not change. `quantityWarnings` reads only typed H and the tree, and warns on every row with H = 0, a top-level item included (A-27). Calculate and Recalculate return 409 `CALCULATE_ACK_REQUIRED` until the same request carries `acknowledge.inputsRevision`, equal to `estimates.inputs_revision` under the row lock. The design, its options and what the Lead sees are in architecture section 4.3.

**Wording.** "How the total is built" (SCR-06), the parent figure note (SCR-06, 07) and "How BL2 is made" (SCR-10) state the rule. UX spec v0.3 holds the wording (UX-28), and the developer builds it into one file, `rollup-copy.ts`.

Displayed figures are not rounded before they are added. Totals use unrounded values, so printed figures can differ from their total by a few hundredths, and the screens must say so (UX-02).

## Consequences
- Positive: condition 5 is met in code structure, not by convention, and the change has a known size.
- Negative / trade-offs accepted: `ROLLUP` is one more function to explain; SCR-06's "How the total is built" covers it. An Admin could replace `ROLLUP(BG)` with `SUM(BG)` in R2, which silently drops every quantity above a row: SCR-18 therefore warns when a formula on a field that held `ROLLUP` stops using it. H = 0 on a parent removes its subtree from `rollUp`, which stays a plain function of the tree. Such a tree reaches it once a person has acknowledged the warning, so a low price can reach the Lead, who sees the warning on SCR-06 and SCR-10 (RISK-013). Adding the exported BG column equals BL only when the quantities above are 1, so SCR-10 reconciles with the multiplier above each row.
- Follow-up actions (with owners): business-analyst lists `ROLLUP` in SPEC §8.2; Santhosh answers Q-39 and Q-35 (b); `master` says whether the roll-up story may still reach Ready; it cannot pass G7 with Q-39 unresolved, or with CE-2 or CE-12 pending (`test-strategy.md` section 5.6).

## Verification
Constructed examples in `test-strategy.md` section 5, through the real evaluator: the nested example gives BL 30 with 24 lids. CE-12 is asserted from the number the delivery lead gave for Q-35 (a), CE-1 and CE-2 are asserted and marked unconfirmed while Q-39 is unresolved, CE-9 covers Warn at every level, and a test fails the build if any quantity case is pending. Architecture tests hold the step to one place, and a test proves a row's own H is applied once. Timing: about 6 ms at worst for 500 nodes (Evidence, architecture section 4.3; not the target host). **Limit:** these tests prove the code matches the stated rule. They cannot prove the rule is right, and the parallel run cannot either, since it uses a worksheet calculated the same way.
