# Review Report — AQP-237 (STORY-10.18) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | **2** (re-review, DL-156 condition R) |
| Base…branch | `87465b6..57acbae` (PR #250); merge `2c543cd` (`master` 2891457) read with `git show --cc` |
| Commit reviewed | 57acbae |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review, round 2 (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/250#pullrequestreview-5867152081

## Round 2

### Summary

The fix round closes both gaps that blocked G6. The function that lexically holds the call must own the `tx` parameter, at the `record` call and at every helper step (QLT-01). Each call on the chain must be awaited, returned or an arrow body (QLT-02). `record` is selected by its receiver type, so `.call`, `.bind` and aliases fail, and `z.record` is not visited (QLT-03). The lint test asserts the rule's own message (QLT-05). Both headers list each form the check does not close (QLT-06). All six required reviewer plants are red on a `master`-based control, each with exactly one finding at the right line. Q6 is green with no finding, and Q4 and Q5 pass as the headers say. I ran the `restrict()` mutation myself: every refusal row fails. The merge `2c543cd` is clean (`git show --cc` prints no hunk). The only new note is an optional Info (QLT-08).

| Severity | New in round 2 |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 1 |

### Previous Findings (re-review only)

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| QLT-01 | Critical | **Fixed** | `problemWithPlacement` (`audit-transaction-check.ts:189-194`) requires `holderOf(call) === parameter.fn`. It is applied at the `record` call (`problemWithRecord`, :311-315) and at every helper call (`problemWithUse`, :300-309). FAILING cases Q2, Q2 `Promise.all(map)` and Q2b. Control #272: Q2 red at `user-service.ts:239`, Q2b red at `:245`. Thread reply r4544752203 |
| QLT-02 | Major | **Fixed** | `isAwaitedOrReturned` (:181-186) is applied through `problemWithPlacement` to `record` and every helper call. FAILING cases Q1, Q1b, Q1c; PASSING "returned". Control #272: Q1 red at `:222`, Q1b red at `:230`. r4544752704 |
| QLT-03 | Minor | **Fixed** | `verdictOn` / `isAuditServiceRecord` (:318-340): selection by the `AuditService` member in `audit-service.ts`; an `any` receiver fails; a use that is not the callee fails. Control #272: Q3 `:262`, Q3b `:272` red; Q6 not visited (`checked: 24` = 15 + 9 planted uses, so Q6 is not counted). r4544753177 |
| QLT-04 | Minor | **Deferred** (DL-156 (4), #259); accepted | Listed as ACCEPTED in both headers; `OPEN_LIMITS` Q5 case. Q5 passes on #272. r4544753602 |
| QLT-05 | Minor | **Fixed**, verified | Every refusal row asserts the rule's own message. My mutation (`TRANSACTION_HANDLE_IMPORT` removed from `restrict()`, `eslint.config.mjs:161`, local, reverted): **81 failed / 30 passed of 111**, with **27 of 27** lib, page and component rows failing (round 1: 22 of 27 stayed green). The 30 passes are the 27 allowed-file rows and 3 other-rule rows. r4544753967 |
| QLT-06 | Minor | **Fixed** | Check header :28-40 lists ACCEPTED and FAILS forms; test header :19-21 summarises them and points to it; each ACCEPTED form is pinned by an `OPEN_LIMITS` case. r4544754418 |
| QLT-07 | Info | **Accepted** | Q4 passes on #272, as documented; `OPEN_LIMITS` Q4 (two files). r4544754776 |

### Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Merge commit | `git show --cc 2c543cd` | no combined hunk (clean merge). `master`'s side changes to PR files: `engineer-import-rule.test.ts` +2 (`master-constraints`, `material-repository` from #235) |
| CI on fix head | run 43056524392, attempt 1 (57acbae) | 5 of 5 green; unit 3,078 (= 2,922 + 140 + 16), full 5,441, E2E 778, skipped 24 |
| Test counts | the case tables, read | architecture test 45 = 4 + 11 PASSING + 26 FAILING + 4 OPEN_LIMITS (n_u = 45 − 29 = 16, matching the Dev Record) |
| Local test run | `npx vitest run` on the architecture, lint-rule and Engineer-import test files, on the plant branch | 809 of 810 pass; the only failure is the planted AC-4 row, so the fix head is 810 of 810 |
| Reviewer plants | control **PR #272**, branch `chore/AQP-237-r3-qlt-plants` (57acbae + 2e8d999), base `master`; diff printed in the PR body before the result; plants applied by a script that fails unless each anchor occurs exactly once; **CI run 43126285285**, attempt 1, read in full | Stage 4 lint green; stage 6 **3 failed of 3,079**: the AC-4 row and the probe (exactly 6 findings, `checked: 24`), plus `tokens.test.ts` reading the text `#259` in my plant comment as a hex colour (an artefact of the plant); E2E green. Result comment 6810619265; PR closed unmerged |
| `restrict()` mutation | see QLT-05 | killed in every group |

### Plant results (control #272, run 43126285285)

| Plant | Form | Required | Result (CI, quoted) |
|---|---|---|---|
| Q1 | `void audit.record(tx, e)` in the callback | red | `user-service.ts:222: the record call is not awaited or returned, so it can run after the .run( callback has returned` |
| Q1b | `audit.record(tx, e)` with no `await` | red | `user-service.ts:230: the record call is not awaited or returned, …` |
| Q2 | `['a','b'].forEach(async () => { await audit.record(tx, e) })` | red | `user-service.ts:239: the record call sits in a nested function, not in the function at line 236, whose parameter it passes` |
| Q2b | `['a'].forEach(async () => { await plantedQ2bNote(audit, context, tx) })` | red | `user-service.ts:245: the call to plantedQ2bNote at line 250 sits in a nested function, not in the function at line 247, whose parameter it passes` |
| Q3 | kept handle, `audit.record.call(audit, kept, e)` | red | `user-service.ts:262: AuditService.record is used other than as the callee of a direct call (.call, .bind or an alias), which the check cannot follow` |
| Q3b | kept handle, `const write = audit.record.bind(audit); await write(kept, e)` | red | `user-service.ts:272: AuditService.record is used other than as the callee …` |
| Q6 | `export const plantedQ6 = z.record(z.string(), z.string())` in `audit-events.ts` | green, no finding | not visited; no finding |
| Q4 | exported helper; a correct caller in its own file, a kept-handle caller in `exchange-rate-service.ts` | passes (listed) | no finding |
| Q5 | P3 with (b) met by a closure that never runs | passes (listed, #259) | no finding |
| X1 (exploratory) | awaited `record` inside `try { } catch { }` that drops the error | — | no finding (QLT-08) |

### Findings (round 2)

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-08 | Info | `tests/support/audit-transaction-check.ts:34-37` | AC-5 (list); architecture §6 "or not at all" | An awaited `record` whose error is caught and not rethrown inside the callback passes (X1). This is correct for AC-2, because the entry is in the change's transaction, but the header does not list it | If `record` throws before it reaches the database, the change commits without its entry. No real call sits in a `try` today | Optional: add `ACCEPTED: a record whose error is caught and not rethrown inside the callback (error handling is outside this check)`, and optionally an `OPEN_LIMITS` case with the X1 body |

**New-code review notes (no finding).** `holderOf` uses `ts.isFunctionLike`, so a `record` inside a constructor, an accessor, a class-field arrow or an IIFE fails closed. Either its parameter is not a `FunctionNode`, or the function is not a named helper. Some legitimate shapes are refused with a "not awaited" message, for example `await (audit.record(tx, e) as Promise<void>)`, `await Promise.all([repo.add(tx), audit.record(tx, e)])` and `repo.add(tx).then(() => audit.record(tx, e))`. DL-156 accepted this strictness, and AC-4 routes any real case to the solution-architect. A receiver typed as an intersection, a `Pick<AuditService, 'record'>` or `AuditService | undefined` is still visited. A wrapper class inside `src/server/services` that delegates to `AuditService.record` is caught at the delegation, which is not a named helper. No new defect found.

### AC conformance (fix head 57acbae)

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 import rule | `eslint.config.mjs` (`TRANSACTION_HANDLE_IMPORT`, block `accucut/transaction-handle-is-for-the-runner`, `restrict()`) | `transaction-handle-rule.test.ts` (111, message asserted); Engineer controls | **Met**; P4 red on #264 (developer); mutation killed in every group |
| AC-2 (a) lexical holder F, chain ≤ 3, no cycles | `problemWithRecord`, `problemWithPlacement`, `chainProblem`, `problemWithCallers`, `problemWithUse` | 11 PASSING, 26 FAILING | **Met** (QLT-01 and QLT-02 closed; Q1 to Q3b red on #272) |
| AC-2 (b) another repository call | `callsAnotherRepository`, `isRepositoryCallWith`, `isAnotherRepository` | P3, P3b, local store, stray handle | **Met** as written; dead-closure limit deferred (#259) |
| AC-3 plants | the two checks | P1 to P5 on #263 and #264 (developer); Q1 to Q3b on #272 (reviewer) | **Met**; every diff printed before its result |
| AC-4 today's code passes, no escape hatch | no allow-list, no `eslint-disable` | AC-4 row: 15 checked, no finding, pinned at ≥ 15 | **Met**; count of 15 explained (PO change note, 2026-11-11) |
| AC-5 cost, stage, header | existing stages; both headers | CI stage 6 | Header list **met**. Time: **10.5 s in stage 6 on the fix-head run, over the 10 s report line**. The developer reported it. → reviewer-performance (DL-156 (7) re-run trigger, over 8 s) and the solution-architect. Not a quality finding |

### Issues for other roles (round 2)

- **reviewer-performance / solution-architect:** stage 6 file time 10,515 ms (run 43056524392) is over AC-5's 10 s line and DL-156 (7)'s 8 s re-run trigger.
- **orchestrator / delivery lead:** delete the remote branch `chore/AQP-237-r3-qlt-plants`. PR #272 is closed unmerged. My session does not delete branches.

---

## Round 1

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-237-audit-record-tx-checks` (PR #250) |
| Commit reviewed | 87465b6 |
| Date | 2026-11-11 |
| **Verdict** | **REQUEST CHANGES** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/250#pullrequestreview-5860664620

## Summary

The change is clear and honestly described. The lint half (AC-1) is sound, and the six plants of the developer fail as claimed. But the architecture check accepts an audit entry that runs **after its callback has returned** in two cases: a `record` inside a nested async function (QLT-01, which is looser than the AC-2 (a) text) and a `record` that is simply not awaited (QLT-02). That is the third form architecture section 6 forbids, and the main thing this story exists to stop. Both fixes are small. A local probe shows that all 15 real calls still pass under them.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 1 |
| Minor | 4 |
| Info | 1 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Architecture test at head | `npx vitest run tests/unit/audit-transaction-architecture.test.ts` (local; `node_modules` linked to the main checkout's identical lockfile, no `npm ci`) | 29/29 pass (31 s locally on a shared, loaded machine; CI 5.2 s) |
| Reviewer plants Q1 to Q6 | control PR #257 (87465b6 + 4f5e9b0, base master), CI run 43042052703; diff printed in the PR body before the result (DL-091) | Stage 4 lint green (no rule fires). Stage 6: 2 failed of 3,055: the check visited **21** calls and found **1** (Q6, a false positive). Closed unmerged |
| Same plants, locally | the same diff, plus a probe that prints the report | `checked=20` with Q1 to Q5 and no finding; `checked=21` and 1 finding with Q6 |
| Lexical-holder probe | local probe: for each `.record(`, is the function that lexically holds it the owner of its `tx` parameter? | All 15 real calls: same. Only Q2 differs |
| Lint-rule mutation | `restrict()` changed so that only the general block keeps `TRANSACTION_HANDLE_IMPORT`; `npx vitest run tests/unit/lint/transaction-handle-rule.test.ts` | 31 of 111 fail (mutation killed); 22 of 27 lib, page and feature-component rows stay green (QLT-05) |
| #235 + #247 robustness | local merge of #235 (7cef82a) and #247 (9e98dca) into 87465b6; the 4 affected test files; `npx eslint src` + PR test files | merges cleanly; 795/795 pass; `checked=15`, 0 findings; eslint exit 0 |
| CI on head | run 43027184210 (from the PR) | green: unit 3,054, full 5,377, E2E 778 |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Critical | `tests/support/audit-transaction-check.ts:142-143, 259-263`; test case at `audit-transaction-architecture.test.ts:180` | AC-2 (a); architecture §6 "The two checks as built" | F should be "the function that lexically holds the call", but here it is any enclosing function whose parameter `tx` is (PR Decision 4; no ruling from the architect or PO) | Plant Q2 (`forEach(async () => { await audit.record(tx, e) })`) passes: the entry is written after the callback returned | Require `parameter.fn === holderOf(call)`; move the nested-arrow case to FAILING; or get an architect ruling and align AC-2, §6 and the header |
| QLT-02 | Major | `audit-transaction-check.ts:270-272` | §6 "never after the callback has returned"; AC-5 | A `record` that is neither awaited nor returned in the callback passes (Q1 `void`, Q1b forgotten `await`); lint is silent too | The change commits while the entry is written late or lost; a forgotten `await` is the likely accidental form | Require every call on the chain to be awaited, returned or an arrow body (`isAwaitedOrReturned`); otherwise list it in the headers + a `tech-debt` issue for type-aware `no-floating-promises` |
| QLT-03 | Minor | `audit-transaction-check.ts:270` | AC-2 "visits every `.record(` call"; AC-4 | Calls are picked by member name: `audit.record.call(…)` / `.bind` (Q3, Q3b) are not visited; `z.record(…)` in a service (Q6) is a false positive | Deliberate bypass of P2 unseen; the first service needing a Zod record schema fails with a misleading message, with no escape hatch | Decide by the receiver's type (`AuditService`), fail closed on `any`; flag any non-callee use of `AuditService.record` |
| QLT-04 | Minor | `audit-transaction-check.ts:177-196` | AC-2 (b); AC-5 | (b) is met by a repository call in a closure that never runs (Q5) | P3 hidden behind dead code | Do not descend into nested functions unless they are passed to an awaited call, or list the limit |
| QLT-05 | Minor | `tests/unit/lint/transaction-handle-rule.test.ts:68`; `tests/security/engineer-import-rule.test.ts` (new control) | Test adequacy | Assertions check only the rule ID, and the group's own bans already produce it | Dropping the entry from `restrict()` goes unseen for lib, page and component files | Also assert that the message includes `createTransactionHandle` |
| QLT-06 | Minor | `tests/unit/audit-transaction-architecture.test.ts:22-29`; `audit-transaction-check.ts:23-31` | AC-5 | "Cannot see" lists omit the forms of QLT-01 to QLT-04 | A green run is read as more than it proves | List every form not closed in code |
| QLT-07 | Info | `audit-transaction-check.ts:24-25` | AC-5 | Q4 (an exported helper called from another file with a kept handle) passes, as documented | none beyond the documented limit | Optional: report an exported function that holds `record` (none is exported today, per `git grep` at 87465b6) |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01
**Current** (`parameterOf` resolves `tx` to the parameter of any function; `chainProblem` starts there)
```ts
return { fn: declaration.parent, index: declaration.parent.parameters.indexOf(declaration), symbol };
```
**Suggested**
```ts
function holderOf(node: ts.Node): FunctionNode | undefined {
  for (let n = node.parent; n !== undefined; n = n.parent) if (isFunctionNode(n)) return n;
  return undefined;
}
// in problemWithRecord, after the parameter is found:
if (parameter.fn !== holderOf(call)) return `the record call sits in a nested function, not in ${nameOf(parameter.fn)} whose parameter it uses`;
```
At a helper step, AC-2 says "a parameter of a qualifying function that **encloses** that call", so `forEach(async () => { await note(tx) })` would still pass. To close that too, apply the same lexical rule at each step and QLT-02's "awaited or returned" rule.

### QLT-02
```ts
function isAwaitedOrReturned(call: ts.CallExpression): boolean {
  let node: ts.Node = call;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  return ts.isAwaitExpression(parent) || ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node);
}
```
Apply it to the `record` call and to each helper call that `chainProblem` follows. All 15 real calls are `await audit.record(…)`.

### Reviewer plants (control PR #257)
| Plant | File | Form | Result in CI |
|---|---|---|---|
| Q1 | user-service.ts | `void audit.record(tx, e)` inside the callback | passes (no finding) |
| Q1b | user-service.ts | `audit.record(tx, e)` without `await` | passes |
| Q2 | user-service.ts | `['a','b'].forEach(async () => { await audit.record(tx, e) })` | passes |
| Q3 | user-service.ts | handle kept, then `audit.record.call(audit, kept, e)` | not visited |
| Q3b | user-service.ts | handle kept, `const write = audit.record.bind(audit); await write(kept, e)` | not visited |
| Q4 | user-service.ts + exchange-rate-service.ts | exported helper, correct caller in its own file, kept-handle caller in another | passes (documented) |
| Q5 | user-service.ts | `users.update(…)` without `tx`; `(b)` met by an uncalled closure | passes |
| Q6 | audit-events.ts | `export const plantedQ6 = z.record(z.string(), z.string())` | finding: `audit-events.ts:298: the transaction passed to record is not a parameter of a function around the call` (false positive) |

The remote branch `chore/AQP-237-qlt-plants-control` was **not deleted** because I was not permitted to delete it. PR #257 is closed unmerged. Someone with rights can delete the branch, together with the developer's `chore/AQP-237-plants-control` and `chore/AQP-237-plants-control-b`.

</details>

## Reviewer-specific tables

**AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 import rule | `eslint.config.mjs` (`TRANSACTION_HANDLE_IMPORT`, `restrict()`, block `accucut/transaction-handle-is-for-the-runner`) | `tests/unit/lint/transaction-handle-rule.test.ts` (111) | Met; P4 fails in CI (#251); weak assertions (QLT-05) |
| AC-2 (a) F, chain ≤ 3, no cycles | `audit-transaction-check.ts` (`parameterOf`, `chainProblem`) | 9 PASSING / 16 FAILING cases | **Implemented differently** (QLT-01); un-awaited calls pass (QLT-02) |
| AC-2 (b) another repository call | `callsAnotherRepository`, `isAnotherRepository` | P3, P3b, local store, stray handle | Met as written; dead-closure gap (QLT-04) |
| AC-3 plants P1 to P5 | the check and the lint rule | in-memory cases; control PRs #251 (P4, lint) and #252 (5 findings) | Met |
| AC-4 today's code, no escape hatch | no allow-list, no `eslint-disable` | "at least 15 record calls were checked" | Met; 15 calls at b3403e3 explained (11 at 023e17d + AQP-123, AQP-130); Zod false-positive risk (QLT-03) |
| AC-5 cost, stage, header | existing unit and lint stages; header comments | CI 5.2 s in stage 6 | Met for the 4 required items; list incomplete (QLT-06) |

**Robustness to #235 and #247.** #235 moves the material methods to `material-repository.ts` (still under `src/server/repositories/`, and `MasterRepository` extends them, so `isAnotherRepository` still matches) and adds `master-constraints.ts`. No helper that holds `record` moves to another file; `masters-service.ts` changes by +3 −2. #247 changes `audit-events.ts` and `audit-service.ts` and adds no `.record(` call. With both merged into 87465b6 locally: `checked=15`, no finding, 795/795 tests in the four affected files, and eslint is clean.

**Open questions from the brief.**
- *Step count:* a helper 3 calls below the callback passes, and one 4 calls below fails. That matches §6, "at most three steps from the callback". I agree; for the PO to confirm.
- *Engineer import rule:* the change follows from AC-1, and the control is stronger, not weaker (QLT-05 aside).
- *Architecture "eight":* v0.32 already changed it to 11; the count to update now is 15 (solution-architect).

## Issues for other roles

- **solution-architect:** rule on QLT-01 (lexical F) and QLT-02 (awaited chain) if the developer proposes to keep the current behaviour; update the §6 count to 15.
- **product-owner:** confirm the step-count reading.
- **orchestrator / delivery lead:** delete the remote branches `chore/AQP-237-qlt-plants-control`, `chore/AQP-237-plants-control` and `chore/AQP-237-plants-control-b`.

## Previous Findings (re-review only)

n/a (round 1).
