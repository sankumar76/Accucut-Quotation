# Combined security-and-quality review: AQP-293 / GitHub #432, PR #445

| Item | Value |
|------|-------|
| PR | #445 "AQP-293: snapshot keeps only the referenced rates (DL-225, #432)" |
| Head reviewed | 7486868c (merge of master 63c31db1 into the branch). The developer's own commits, ec15b2e7 and 146fc6e8, are the same as at 146fc6e8 |
| Diff reviewed | `git diff 63c31db1 7486868c -- src tests` (10 files, +507 / -8) |
| Reviewer | reviewer-quality, one combined review under CLAUDE.md section 9 item 2 (stored calculation records and the NFR-002 surface) |
| Date | 2026-11-16 |
| Rulings checked against | architecture v0.49 section 4.2 (the snapshot block), 4.8 and 5.1; DL-225; GitHub #432; AQP-293 combined review SQR-05; AQP-320 (cost working reruns the figures from the record) |
| **Verdict** | **APPROVE WITH COMMENTS**: 0 Blocker, 0 Critical, 0 Major, 3 Minor, 4 Info |

## 1. Checks run

| Check | Result |
|-------|--------|
| CI run 43820154013 on 7486868c | **All green**: "Stages 1 to 11" and "Stages 1 to 11b" (lint, type-check, unit, the integration suite with `tests/integration/calc/calculation-record.test.ts`, the secret scan and the cost-confidentiality scan), and E2E shards 1 to 4. Shard 2 (tablet) passed this time, so the earlier "web server aborted" failures on 146fc6e8 did not come back. Nothing in this diff touches a route, page, response or client bundle |
| Earlier runs | 43813338993 (ec15b2e7) failed on the hex-colour scan. Commit 146fc6e8 fixed it. Run 43814913697 (146fc6e8) was cancelled when the branch was updated from master |
| Targeted unit tests (local, in a detached scratch worktree at 7486868c) | `npx vitest run` on `referenced-rate-ids`, `calculation-snapshot-rates`, `cost-working-snapshot-shapes`, `calculation-record` and `calculation-service`: **5 files, 119 tests, all passed** |
| Mutation 1: the snapshot keeps every customer rate again (`calculation-masters.ts`, snapshot built from `customer.rates`) | 6 tests failed (test 2 in `calculation-snapshot-rates`, plus `calculation-record`). Reverted |
| Mutation 2: one referenced rate dropped from the filtered list | 22 tests failed, including the fixed-figure tests in `calculation-service.test.ts` (AL 5.00, BG 451.40 and others). Reverted. So the existing figure tests guard test 4 |
| Playwright, `next build`, Docker | Not run, as the brief says |

## 2. Required checks from the brief

| # | Check | Finding |
|---|-------|---------|
| 1 | **`referencedRateIds` is complete** | **Yes.** `referencesOf` (`src/lib/formula/ast.ts:97`) walks every node through `nodesOf` and `childrenOf`. `childrenOf` covers `negate`, `binary`, `min`, `max`, `round` and `if` (the condition's left and right sides and both branches), and it ends in `assertNever`, so a new node kind is a type error rather than a gap that nobody notices. `compilePlan` (`plan.ts:59`) passes `rowOrder` and then `productOrder`. Every formula field is in one of the two, because `analyzeFormulas` visits every field that has a formula and `RowScope` is only `row` or `product`. Only formulas in these two lists are ever evaluated, so nothing outside the set can be read. The plan cache compiles without `rateIds`, so an ID that is not in the Process Master still goes into the set, and the filter then leaves it out. That matches section 4.2. A missing rate here could have made AQP-320 return 500 on a new record, but none can be missed |
| 2 | **One filtered list** | **Yes.** `readMasters` filters once (`calculation-masters.ts:76`), and both `rates` (the evaluator) and `snapshot.rates` are mapped from that one array. `readMasters` has one caller, `run` (`calculation-service.ts:305`), which takes the set from the very plan it then evaluates. No stored figure changes: the oracle tests, unedited, pass, and mutation 2 shows they would catch it. Re-evaluating from the record matches exactly, in memory and against PostgreSQL. In PostgreSQL the record is read back as the runtime role, and that test is green in CI |
| 3 | **Old records** | **Accepted.** `masterSnapshotSchema` is unchanged. The diff has no migration, no marker key and no `UPDATE`. Every reader parses through the same schema (`calculation-repository.ts:216`, `:267`) |
| 4 | **Readers that list or count rates** | **No reader breaks.** The only current reader is the cost working (`cost-working.ts:177`, `:207`, `:298`). It looks up each rate operand by ID and uses the record's own configuration version (`cost-details-service.ts:104`). Its display context is built from `snapshot.rates`. A formula of that version can only name rates in the plan's set, so shape 2 covers every name the working shows. `rate-diff` and the unlock preview do not exist yet (06.11), and the export lists no rates. No reader counts `rates` |
| 5 | **Leaks** | **None.** No route, page, response schema, log line or error message changed. `FormulaConfigurationError` lists rule messages and never formula text or a value. The logger already redacts `*.rates` (`logger.ts:72`). The data an Engineer can reach is unchanged, so the canary scan keeps its meaning. It passed in CI |
| 6 | **Tests** | All five tests in section 4.2 exist and can fail (mutations 1 and 2). Two small gaps follow (QLT-02, QLT-03). The new integration tests await every call in turn and start no concurrent promise, so they cannot leave an unhandled rejection of the #443 kind |
| 7 | **DL-217 comment** | **Done.** `estimate-service.ts:106` now says "**Decision (DL-217)**". The change is to the comment only |

## 3. Acceptance conformance (architecture 4.2, the five required tests)

| Test | Code | Test file | Status |
|------|------|-----------|--------|
| 1. The referenced set (distinct, first-appearance order, product-only, IF, MIN/MAX/ROUND, negation, exclusions, empty, stable, cached) | `plan.ts:59-71` | `tests/unit/formula/referenced-rate-ids.test.ts` (all cases, plus the seed plan without Plating) | Met |
| 2. A stored subset (in the set's order, with the name and value at that time; a missing rate left out and its figure null; materials and exchange rates unchanged) | `calculation-masters.ts:55-90` | `tests/unit/calculation-snapshot-rates.test.ts:56-98`, `tests/unit/calculation-record.test.ts:413-420` | Met; the "figure is null" clause is not asserted at the service level (QLT-03) |
| 3. Re-evaluating the record gives the record (PostgreSQL, runtime role, more than one material) | `calculation-service.ts:304-305` | `tests/integration/calc/calculation-record.test.ts:328-363` (green in CI), and in memory at `calculation-snapshot-rates.test.ts:150` | Met |
| 4. Figures unchanged, no figure test edited | none (no formula change) | the existing `calculation-service`, `calculate-service`, product-total and acceptance tests are unedited and green. The one edit, `calculation-record.test.ts:420`, changes an assertion about the snapshot's shape, not a figure, and is justified | Met (QLT-02 is about one test that is redundant and wrongly named) |
| 5. Shape 1 still reads (schema; AQP-320 working the same for both shapes) | schema untouched | `calculation-snapshot-rates.test.ts:170-185`, `tests/unit/estimate/cost-working-snapshot-shapes.test.ts` | Met; tested through the schema, not `findCalculation` (QLT-04) |

## 4. Findings

### QLT-01 · Minor: the filter ignores letter case, but every other rate lookup does not

- **Where:** `src/server/services/calculation-masters.ts:56-58`, compared with `src/lib/formula/rates.ts:40` (`createRateLookup`, an exact match), `src/lib/estimate/cost-working.ts:207` (an exact match) and `src/lib/formula/plan.ts:67` (a `Set` of exact strings).
- **Issue:** `referencedRates` matches IDs with `toLowerCase()`, but the evaluator and the cost working look rates up by the exact string. The tokenizer accepts an upper-case UUID (`tokenizer.ts:52`, flag `/i`).
- **Impact:** this applies only if a stored formula holds a rate UUID whose letter case differs from `process_items.id`. Today's internal form is written from database IDs, which are lower case, and the seed is lower case, so this cannot happen in normal use. If it did happen, the snapshot would store a rate that the evaluator could not find (its figure would be null, as before this change). That breaks the "stored = evaluated" rule in section 4.2. Two case variants of one ID would also put the same rate in the snapshot twice. No figure changes.
- **Fix (cheap, in this PR or later):** use one rule. Either match exactly, as `createRateLookup` does:
  ```ts
  const byId = new Map(rates.map((rate) => [rate.processItemId, rate]));
  return referencedRateIds.flatMap((id) => { const rate = byId.get(id); return rate === undefined ? [] : [rate]; });
  ```
  or lower-case the IDs once in `referencedRateIdsOf` and in `createRateLookup`.
- **Test that would catch it:** a plan whose formula holds an upper-case rate ID. Assert that the stored `rates` are exactly the rates the evaluator resolved, and that no ID appears twice.

### QLT-02 · Minor: the "figures unchanged" test cannot fail for the reason its name gives

- **Where:** `tests/unit/calculation-snapshot-rates.test.ts:160-167`.
- **Issue:** the test is named "with every rate", but `calculateEstimate` runs through the same `run` and `readMasters`, with the same filtered list. Both sides are filtered, so a figure change caused by the filter would show on both sides and the test would still pass.
- **Impact:** a reader could believe this test is the guard for test 4. The real guard is the set of unedited fixed-figure tests in `calculation-service.test.ts` (mutation 2: 22 failures), so nothing is unprotected today.
- **Fix:** rename it to "the stored record and a calculation of the same estimate give the same figures", or make it a true check: evaluate with every customer rate through `calculateRowOutputs` and compare with the record.

### QLT-03 · Minor: section 4.2 test 2 does not assert "its figure is null, as before"

- **Where:** `tests/unit/calculation-snapshot-rates.test.ts:75-81`.
- **Issue:** the test checks that a referenced rate with no customer row is left out, but not that the figure that reads it is null. `tests/unit/formula/rates.test.ts:62` covers this for `createRateLookup` alone, but not through `readMasters` and the service.
- **Fix (cheap):** store a calculation for a customer without one of the referenced rates (for example, remove Cutting-Rate-per-Sec from the fake customer). Assert that the fields that read it are `null` in the record, and that re-evaluating the record gives the same nulls.

### QLT-04 · Info: shape 1 is parsed through the schema, not through `findCalculation`

- **Where:** `tests/unit/calculation-snapshot-rates.test.ts:175-181`; the integration `readBack` at `tests/integration/calc/calculation-record.test.ts:331-342` also calls the schema directly.
- **Note:** section 4.2 test 5 names `findCalculation`. That function parses with the same `masterSnapshotSchema` (`calculation-repository.ts:216`), so the risk is low. A shape-1 fixture inserted by the owner and read through `findCalculation` would close the gap.

### QLT-05 · Info: the cached set is a plain, unfrozen array

- **Where:** `src/lib/formula/plan.ts:70`.
- **Note:** the plan cache shares one plan between all requests. `referencedRateIds` is `ReadonlyArray` only in its type. `Object.freeze([...ids])` would make it read-only at run time too, the same way the cached document is deep-frozen (architecture 4.2).

### QLT-06 · Info: the plan is now compiled before the masters are read

- **Where:** `src/server/services/calculation-service.ts:304-305`.
- **Note:** this order is needed, and the PR description states it. A bad configuration is now reported before an unknown customer or material. On the Calculate path the customer has already been checked by that point, and `FormulaConfigurationError` holds no value or formula text, so nothing leaks. Accepted.

### QLT-07 · Info (praise)

The rule is kept in one place: the set is computed once in `compilePlan`, the list is filtered once in `readMasters`, and the schema is untouched. `reevaluateRecord` is one shared helper, so the unit test and the PostgreSQL test prove the same thing. The deviation in `calculation-record.test.ts` is explained and changes no figure.

## 5. Majors as GitHub issues

None. No issue was created.

## 6. Issues for other roles

- **developer (06.11, AQP-328):** `rate-diff` must restrict `snapshot.rates` to `plans.get(config_version_id).referencedRateIds`, as section 4.2 requires. If QLT-01 is fixed by lower-casing, use the same normalisation there.

## 7. Things created by this review

- A detached worktree at 7486868c: `C:\Users\sanku\AppData\Local\Temp\claude\859e50c63dd2e28b\f8facd72-e7cc-4f45-9a83-c1cba182f3b1\scratchpad\wt-445`, with a `node_modules` junction to the main checkout. The two mutations were reverted (`git checkout -- src`). The worktree can be removed with `git worktree remove --force <path>`.
- The local ref `refs/remotes/origin/pr-445`.
- This file (not committed).
