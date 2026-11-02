# ADR-006: BL as a plain sum of BG, with no roll-up

| Field | Value |
|-------|-------|
| Status | Accepted, **rewritten 2026-11-02 for architecture v0.7**, for `master` to record and check at G4. The decision accepted at G3, one named quantity step and a display roll-up, is withdrawn on the delivery lead's answers. The file keeps its name so that links hold |
| Date | 2026-11-02 |
| Deciders | Santhosh (the rule and what a parent shows); solution-architect (the design) |
| Related | FR-022, 024, 025, 029, 030, 056, 075, 104; GOAL-03; NFR-008; SPEC v1.9 §7.1 H, §7.4 BL, §8.2, §18.5; G2 conditions 5, 6; RISK-002, RISK-013, ARCH-R6; Q-35, Q-38, Q-39, Q-41; OQ-ARCH-10; DL-012, DL-024; AQP-1 comment 10542; AQP-14 comment 10510; AQP-15 comments 10511, 10527, 10543; AQP-26 comments 10530 to 10537; ADR-004, ADR-005, ADR-007, ADR-008 |

## Context
From G3 until now this ADR held the every-level rule: `T(row) = BG(row) + H(row) x sum of T(child)`, with one named `applyQuantityStep`, a `ROLLUP` function and a parent figure kept apart from its row. That rested on reading QTY per Assy as the count in one parent (AQP-13 comment 10487) and on their count of 24 lids.

Asking what is typed changed it. For 4 frames with 3 brackets each: "So the user will enter 4 frames and 12 brackets", at 600 + 240 (AQP-26 comment 10535). For frames, pipes and lids: "yes, this has 24 lids. Engineer should typ 24" (10537). So 24 is typed, not worked out by the portal. **H is the count for the whole order, on every row, and BL is the sum of BG over all rows.** That also gives their 1000 for 5 at 200 (AQP-14 comment 10510), and it is the worksheet's own `SUM(BG2:BG11)` (SPEC §18.5). The rule as one sentence is the team's; the typing and the numbers are theirs.

Then "Q-35(b) - no, not required" (AQP-1 comment 10542): a parent shows only its own row's figures, with no sum of the rows below it.

## Decision Drivers
- The delivery lead's answers above
- GOAL-03: the portal matches the worksheet
- FR-075: BL must re-letter like any other column
- Simplest design that works: nothing should remain for a rule that no longer exists
- RISK-002: a rule that changed twice should sit where a change is small

## Considered Options
### Option A — BL is `SUM(BG)` in the formula engine, and no roll-up exists at all
- Pros: no new function, and SPEC §8.2 already has `SUM`; identical to the worksheet; one fewer module, two fewer stored fields; the screen and the file hold the same figure for every row
- Cons: nothing in the portal helps the Engineer work out a count (ARCH-R6)
- Cost / effort: 0.5 to 0.75 h, against 2.5 to 4 h

### Option B — Keep `ROLLUP(BG)`, redefined to mean a plain sum
- Pros: no change to formula text already drawn
- Cons: a second name for `SUM`, more to explain and to test, for nothing
- Cost / effort: slightly higher

### Option C — Drop the multiplier, and keep a display walk for a parent's sum
- Pros: a parent would show its own row plus everything below it
- Cons: they said it is not required (Q-35 (b)). It would keep two figures per row, the pair of boxes, item totals and a stored column
- Cost / effort: about 1 h more than Option A, and more on the screens

### Option D — Keep the every-level rule and ask Engineers to type per-parent counts
- Pros: the portal multiplies, so a count cannot be mis-multiplied by hand
- Cons: it contradicts what they said is typed, and the 840 and "typ 24" they gave. Typed 12 would count 48
- Cost / effort: already designed; rejected on their answer

## Decision
We will use Option A.

- **H is applied in one place: `BB = BA * H`**, a row's own seed formula. H is an operand in no other seed formula, and a test holds that.
- **BL is seeded as `SUM(BG)`**, and BN as `BL / SUM(BM)`. BL stays visible, re-letters like any other formula and stays a system field.
- **A parent shows only its own row.** Every row has one figure, the same on screen and in the file. There is no Σ figure and no item total, so `calculation_rows.rollup` and `calculations.item_totals` are not created, and the `rollupDisplay` flag and `src/lib/rollup/` do not exist.
- **Removed:** `T(row)`, `applyQuantityStep`, `quantity-step.ts`, the multiplier above each row, `ROLLUP`, the closed-form test oracle, and SCR-18's warning that a formula stopped using `ROLLUP`.
- **Warn is outside this rule (AQP-15 comments 10511, 10527, 10543).** It sits in `lib/estimate/validation` and applies to every 0 in QTY per Assy. A 0 now affects only its own row, and the wording says that row costs 0 (architecture section 4.3).

Totals use unrounded values, so printed figures can differ from their total by a few hundredths, and the screens must say so (UX-02).

**History, kept short.** Versions up to 0.6 of this ADR recorded the every-level rule, and two corrections of how far a change would reach. They are in git history (commit `ba94fd3` and earlier). Twice the claim "one line would change" proved too small. This design has no such line.

## Consequences
- Positive: the portal agrees with the worksheet at any quantity, so a parallel run can now test BL. A change to how totals work is a change to one seed formula. Parent double counting cannot happen, as there is no parent figure. A move no longer changes the price. No schema, API field or screen depends on a roll-up.
- Negative / trade-offs accepted: **the Engineer now does the multiplying** (ARCH-R6, GitHub #11). A wrong count is a wrong price and nothing can flag it: 3 typed for 12 gives 660. The delivery lead's own first answers show the slip is easy. A change to the number of items means retyping every row below it. The field's name says the opposite of what it now means. G2 conditions 5 and 6 are overtaken in form.
- Follow-up actions (with owners): `master` records the rule and registers ARCH-R6; product-manager rewrites FR-022, 029, 030, 056, 100 and 104, and decides with the delivery lead whether the field keeps its name; ux-expert applies UX-52 to UX-56.

## Verification
Constructed examples in `test-strategy.md` section 5, through the real evaluator: 2, 6, 24 at 0, 1, 1 gives BL 30; 4 and 12 at 150 and 20 give 840; 5 at 200 gives 1000. `quantity-in-one-formula`, `bl-is-sum-bg` and `no-rolled-up-figure` hold the structure, and a test fails the build if any quantity case is pending. **Limit:** these tests prove the code matches the stated rule. They cannot show that a typed count is right.
