# Review Report — AQP-237 (STORY-10.18) — Quality

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
