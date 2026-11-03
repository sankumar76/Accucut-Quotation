# DEF-006: rate-name guard accepts a name that reads as other rate names and an operator, so a stored formula can change meaning

| Field | Value |
|-------|-------|
| Story / AC | AQP-106 (STORY-03.02) / AC-6; GitHub #35 (QLT-05) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Product |
| Status | New |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `5c2326d` on `feat/AQP-106-formula-engine` (PR #45) |
| Environment | Windows 11, Node v24.19.0; pure code, no database |
| Jira / GitHub | [AQP-181](https://sankumar76.atlassian.net/browse/AQP-181) / [#49](https://github.com/sankumar76/Accucut-Quotation/issues/49) |

## Steps to Reproduce
All names invented.
1. Rates `Cost` and `Waste` exist.
2. Call `rateNameIssues('Cost-Waste', ['Cost', 'Waste'])`, and `rateNameIssues('AB-Waste', ['Waste'])`.
3. With `Cost`, `Waste` and `Cost-Waste` in the context, take the stored formula `{{rate:<Cost>}}-{{rate:<Waste>}}` (what an Admin's `Cost-Waste` becomes before the third rate exists), call `toDisplayForm`, then `toInternalForm` on the result.

## Expected Result
Step 2 refuses both names: with those rates present they read as `Cost - Waste` and `AB - Waste`. The guard's own comment states this aim ("a name that could also be read as part of a formula ... would mean one thing when the Admin types it and another when the rate list changes, and the stored formula would then be a different price with no error"). Step 3 returns the stored text unchanged (AC-6: "the round trip is exact").

## Actual Result
Step 2 returns `[]` for both names. Step 3 displays `Cost-Waste` and converts it back to `{{rate:<Cost-Waste>}}`: one rate instead of a subtraction. A Lead reading the formula sees a meaning other than the stored one; re-saving it in the formula editor (R2) would change the price with no error.

## Evidence
- `tests/acceptance/aqp-106-formula-engine.test.ts`, test "DEF-006 reproduction" (a characterisation test that pins today's behaviour, so CI stays green; the fix flips its last expectations).
- `src/lib/formula/rate-names.ts`, `readsAsFormulaText`: `tokenize(name, { form: 'display', context: { fieldIds: [], rates: [] }, anyColumn: true })`. With `rates: []` the other rate names (and the case "name + operator + other name") are never considered.

## Suspected Area
`src/lib/formula/rate-names.ts`: tokenise the proposed name with `otherNames` as the rate list (the fixed Material-* and ExchangeRate-* operands are already added by `namedOperands`), and refuse a name that reads as more than one token.

## Impact
No price is wrong today: in R1 no screen creates a rate (02.01) or edits a formula (R2), and every seed formula has spaces around its operators. It becomes reachable when 02.01 lets the Admin add a rate. It does not hold G7 by the gate rule (no open Sev-1 or Sev-2); the master decides whether AC-6 is read to include it.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
