# DEF-006: rate-name guard accepts a name that reads as other rate names and an operator, so a stored formula can change meaning

| Field | Value |
|-------|-------|
| Story / AC | AQP-106 (STORY-03.02) / AC-6; GitHub #35 (QLT-05) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Product |
| Status | Verified for Release 1 on `c262853` (PR #107); closes (Done) only after master's posted G7 decision, DL-098 and DL-110 |
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
| Fixed, round 1 (the new name judged against the others) | developer | 2026-11-06 | `8d15405`; PR #107 |
| Fixed, round 2 (the whole resulting set judged on add and rename, QLT-01) | developer | 2026-11-06 | `bc09fac`, `f2e9fe1`, `66ae511` (`rateSetIssues`, `ambiguousRateNames`) |
| Fixed, round 3 (every stored formula must round-trip under the names a change would leave, QLT-15 and QLT-17) | developer | 2026-11-07 | `5182720`, head `c262853` (`rate-name-rules.ts`, `formula-round-trip.ts`) |
| Regression tests added | developer | 2026-11-06 / 07 | `tests/unit/masters-service-round-trip.test.ts`, `masters-service-set.test.ts`, `formula-round-trip.test.ts`, `tests/integration/masters/process-items-names.test.ts`; the AQP-106 AC-6 characterisation test was rewritten to expect the refusal |
| **Verified** | qa-engineer | 2026-11-07 | Head `c262853`. Test report `docs/07-qa/AQP-113-test-report.md`; QA tests `tests/acceptance/aqp-113-process-master.test.ts` (not committed; see the report) |

### QA verification result (2026-11-07, head `c262853`, R1 scope)
Through the real route handlers (`POST` and `PATCH /api/v1/process-items`) over real PostgreSQL, with the stored formula held as a `config_versions` row and read by `getCurrentVersion` as `composition.ts` does. All names are invented.

| Case | Result |
|------|--------|
| Step 2 of the record: parts `Cost` and `Waste` exist, then `Cost-Waste` is added; and `AB-Waste` with `Waste` | Both refused, 422 `RATE_NAME_REFUSED`, no row, no entry |
| Round-1 reverse order: compound first, then one part (accepted), then the other part | Refused (`RATE_SET_AMBIGUOUS_MESSAGE`), in both orders of the parts |
| Rename path: `Alpha` and `Beta` become the parts of the existing compound | First rename accepted, second refused, the rate keeps its name, no entry; both orders |
| Rename into the compound of two others | Refused |
| Probe (a): `Cost`, `Waste-Fee`, `Cost-Waste`, `Cost-Waste-Fee`, stored `{{Cost}}-{{Waste-Fee}}` | `Cost-Waste` refused by the round trip on add and on rename; `Cost-Waste-Fee` refused (by the name guard) in both orders, on add and rename |
| Probe (b): `Cost`, `Waste-Fee`, `Cost-Waste`, `Fee`, same stored formula | `Fee` accepted; `Cost-Waste` refused at the step that breaks the formula, whichever comes first, on add and on rename (both orders) |
| Column letter plus hyphen: stored `{{AL}}-{{Waste-Fee}}`, add or rename to `AL-Waste`, with and without a rate `Fee` | Refused by the round trip only (the name guards pass it) |
| Spaces round the operator; the renamed rate inside the formula | Refused |
| Controls: the 15 seed names renamed (first letter in the other case) and a rate added with the seed configuration; a harmless name with a stored formula | All accepted |
| QLT-17: a stored set already unsafe, or a formula already broken | An unrelated add and rename are accepted; an add that makes another name ambiguous is still refused |
| Refusal messages | 83 name refusals read (55 `RATE_NAME_REFUSED`, 28 `NAME_TAKEN`): six fixed sentences, none names a rate, a formula or a value |
| Planted faults, one at a time, each restored with `git checkout -- src` and never committed | Round-1 rule only (set check and round trip removed): 23 tests fail. Set guard removed: 8. Round trip removed: 11. Round trip on add only: 6. On rename only: 7. Round-trip before/after comparison removed: 1. Guard before/after comparison removed: 2. Message that names the rate: 11 |

**Scope of the closure.** Closed for Release 1, where a create or a rename of a rate is the only write that can break a stored formula (DL-110 ruling 1). The invariant at the Release 2 formula write paths (edit, re-lettering, publish, revert) is #112 and RISK-024, as new work, not DEF-006. **Closure order (DL-098):** this record stays "Verified" until master posts the G7 decision; QA then sets it to Closed, and Jira AQP-181 and GitHub #49 to Done and closed.
