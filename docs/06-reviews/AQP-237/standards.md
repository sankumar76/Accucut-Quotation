# Review Report — AQP-237 (STORY-10.18) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-237-audit-record-tx-checks` (PR #250; base b3403e3, `master` now c6b9074) |
| Commit reviewed | 87465b68f888344df48a108a24912ca161b6b2f6 (2 commits: c6ade88, 87465b6) |
| Date | 2026-11-11 |
| **Verdict** | **REQUEST CHANGES** (one Major, STD-01; no Blocker or Critical) |

PR review: https://github.com/sankumar76/Accucut-Quotation/pull/250 (submitted as COMMENT, `REVIEW_IDENTITY = single-token`; label `review:standards-changes-requested`). Inline comments carry the same IDs.

## Summary

The change is tightly scoped: five files, nothing under `src/`, no dependency, no CI change, no `eslint-disable`, no allow-list, no cast, `any` or non-null assertion, no secret. CI is green 5 of 5. The one Major is Coding Standards §1: `checkAuditTransactions` is a 152-line function with no inline justification. The Minors are cheap and change no behaviour: complexity 14 in `chainProblem`, a new test file at 442 lines, an unnamed 120 s hook limit, the fourth copy of the ESLint test helper, a stale comment and an incomplete `import()` message in `eslint.config.mjs`, an overstated "types only" claim, and naming. The change to `tests/security/engineer-import-rule.test.ts` (G12 scope) is **not a weakening** (STD-10).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 8 |
| Info | 3 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Lint | CI stage 4, run 43027184210 on 87465b6 (`npm run lint`) | Pass (not re-run here: the local disk is nearly full, no `npm ci`) |
| Type-check | CI stage 5, same run | Pass |
| Format-check | none configured in the project | n/a |
| Tests | CI run 43027184210: unit 3,054 (+140 = 29 + 111), full Vitest 5,377 (+140), E2E 778 | 5 of 5 check runs success (Stages 1 to 11, 1 to 11b, E2E shards 1 to 3), read from the PR check runs |
| Plants | #251 (P4, stage 4 lint, one problem) and #252 (P1, P2, P3, P3b, P5, stage 6, five findings) | As reported in the PR body and Jira 11505; not re-run by me |
| Secret scan | CI stage 2 (full history); developer's Gitleaks (Docker) on the 5 files | No leaks reported; not re-run by me |
| Read in full | the 5 changed files at 87465b6, `src/server/repositories/transaction.ts`, the services' imports of it, `eslint.config.mjs`, the old `engineer-import-rule.test.ts` | Done |
| Function length (§1, 40 lines) | boundaries by `grep -n` in `audit-transaction-check.ts` | `checkAuditTransactions` 152; `chainProblem` 27; `createServicesProgram` about 20; all others under 25 |
| Complexity (§1, 10) | by reading (no ESLint `complexity` rule exists) | `chainProblem` 14 (STD-02); `callsAnotherRepository`, `usesOf` about 8 to 9 |
| File length (§1, 400) | `wc -l` | `audit-transaction-architecture.test.ts` 442 (STD-03); `audit-transaction-check.ts` 280; `transaction-handle-rule.test.ts` 93; `engineer-import-rule.test.ts` 225 to 241 |
| Casts, `any`, `!`, suppressions, TODO, `console` | `grep` over the new files | None in code (matches are in comments) |
| Duplicate helper | `grep "new ESLint("` over `tests` | 4 builders: `layer-rules.test.ts:16`, `engineer-import-rule.test.ts:30`, the new file, `aqp-27-scaffold.test.ts:273` (STD-05) |
| Version control | `git log`, PR title and body | Branch `feat/AQP-237-…`; commits `test(audit): … [AQP-237]`; PR title `AQP-237: STORY-10.18: …`; PR template followed; no generated file |

## Findings

| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Major | `tests/support/audit-transaction-check.ts:129-280` | Coding Standards §1 (functions ≤ 40 lines, justify exceptions inline) | `checkAuditTransactions` is 152 lines and holds ten inner functions plus the scan loop. No justification comment. | The standard is explicit; AQP-113 STD-01 (192-line component) was a Major, and `createMasterRepository` / `createMastersService` are accepted only because each carries an inline justification. The ten helpers cannot be read, named or tested apart, and #235 will edit this file. | Lift the helpers to module level and pass `{ checker, rootDir }`; `checkAuditTransactions` falls to about 20 lines. Minimum: the inline justification, but fix STD-02 either way. |
| STD-02 | Minor | `tests/support/audit-transaction-check.ts:231-257` | §1 (cyclomatic complexity ≤ 10) | `chainProblem` has complexity 14 (11 `if`/`for`/ternary decisions, two `\|\|`, plus 1). | Over by four; it is the recursive core a maintainer must hold in the head (AQP-113 STD-03 was raised at 11). | Split into `problemAtCallback` and `problemWithCallers`; each is under 10 (snippet in the PR comment). |
| STD-03 | Minor | `tests/unit/audit-transaction-architecture.test.ts:1-442` (tables at 40-383) | §1 (files ≤ 400 lines) | A new file at 442 lines; 344 are fixtures and case tables. | A new file should not start over the limit (AQP-122 STD-07 raised 401). | Move `THING_REPOSITORY`, `PRELUDE`, `Case`, `PASSING`, `FAILING` to `tests/support/audit-transaction-cases.ts`; the test file keeps about 110 lines. |
| STD-04 | Minor | `tests/unit/audit-transaction-architecture.test.ts:407` | §1 (no magic numbers); test strategy §10, DL-057 | `}, 120_000);` is an unnamed hook limit; the sibling file names its limit (`ESLINT_WARM_UP_TIMEOUT`). | The reader cannot tell what 120 s is for; the two new files disagree. | `const PROGRAM_BUILD_TIMEOUT = 120_000;` with a one-line why. |
| STD-05 | Minor | `tests/unit/lint/transaction-handle-rule.test.ts:14-19`, `59-63` | §1 (DRY; rule of three) | `new ESLint({ cwd: ROOT })`, `ruleIdsFor` and the warm-up are now word-for-word in `layer-rules.test.ts`, `engineer-import-rule.test.ts` and here. | The standard says extract at three; the next lint story pastes a fourth. | `tests/support/lint-fixture.ts` exporting `createRuleIdsFor(root)`, used by the new file. Leave the G12 file and `layer-rules` alone in this PR; open a `tech-debt` issue for them. |
| STD-06 | Minor | `eslint.config.mjs:139-144`, block at `209-216`, header `10-11` | §8 (comments explain why and stay true) | The comment says the handle entry is listed "in the general block"; it is not (`accucut/rules`, line 201, lists only `NEXT_IMAGE_IMPORT`). The new block must stay above the group blocks, and nothing says so. | Moved below them, `restrict([])` silently replaces the Engineer allow-list, the Prisma ban and the lib purity rules for every file (the tests would catch it, but the file should say it). | Correct the sentence and add "this block must stay above the group blocks, because a later block replaces an earlier one". |
| STD-07 | Minor | `eslint.config.mjs:149`, `164-171` | §4 (actionable messages) | The one `message` serves the static rule and the `import()` selector. For `import()` the whole module is refused (Decision 3), but the text says only "may import createTransactionHandle". | A developer who writes `import('…/transaction')` for a type or `clientFor` is told about a function they did not name. | Add: "An import() of this file is refused whole, because the lint cannot see which names it takes; use a static import of the names you need." Assert the text for the `import()` case in the lint test. |
| STD-08 | Minor | `tests/security/engineer-import-rule.test.ts:117-122`, `179-180`; PR body Decision 2 | §8 (comments stay true) | Comment, constant `TYPE_ONLY_IMPORTS` and test title say a view may import `transaction` "for its types only". The lint refuses only `createTransactionHandle` and the whole-module forms; `import { clientFor, createTransactionRunner } from '…/transaction'` still passes for a view. | The architect may record "types only" in architecture §8/§10 as enforced. It is not (reaching a client still needs a `PrismaClient`, which the allow-list refuses, so this is wording, not a hole). | State what is enforced; rename to `NAMED_IMPORTS_ONLY`; add one `import { clientFor }` control expecting `[]`, or drop the claim; add a sentence to the allow-list comment (`eslint.config.mjs:72-82`). |
| STD-09 | Minor | `tests/support/audit-transaction-check.ts:39`, `63`, `83`, `160`, `185`, `270` | §2 (functions are verbs; intent-revealing), §1 (no magic strings) | `parts()` and `slashes()` do not say what they do; `REPOSITORIES` is a directory path (and an object of file lists in the Engineer test); `'record'` is written twice and `'run'` once as bare strings. | Readability of a file whose subject is these two method names. | `typeConstituents`, `toForwardSlashes`, `REPOSITORIES_DIRECTORY`, `AUDIT_RECORD_METHOD`, `RUNNER_RUN_METHOD`. |
| STD-10 | Info | `tests/security/engineer-import-rule.test.ts:179` | Test strategy §10 (G12: assertion removed or weakened) | **Not a weakening.** The two `toEqual([])` assertions for `transaction` (master lines 164-169, one pair per view) become three stricter ones (type import passes; namespace import and `import()` refused). No `expect` dropped without an equal or stronger one, no matcher widened, no count lowered (4 controls before, 4 after; the file's total is unchanged, as CI's +140 = 29 + 111 shows), forbidden list and block-by-default classification untouched, no exemption. The product behaviour narrows, which AC-1 requires. | The PR body names the four cases, the two forms and the reason (Decision 2, Files table, commit c6ade88): the disclosure the rule asks for. | None. The planted-fault proof is reviewer-quality's. See STD-08 for the wording. |
| STD-11 | Info | `eslint.config.mjs:146-148` | n/a | The match is by module name (`**/transaction`, `(^\|/)transaction(…)?$`), not by resolved path. For a static import `importNames` confines it to `createTransactionHandle`; for `import()` any module whose last segment is `transaction` is refused. | None today (no such module); `lib/formula` entries are name-based the same way. | None. If the name is ever reused, anchor the regex on `repositories${SLASH}transaction`. |
| STD-12 | Info | remote branches `chore/AQP-237-plants-control`, `chore/AQP-237-plants-control-b`; PR body | §9 (version control hygiene) | Both control branches are still on the remote with the plant code (the developer was not permitted to delete them). AC-3 and the Dev Context say plants are "never committed"; they were committed to these throwaway branches so CI could prove them red. | A faulty branch left around can be picked up by mistake. | Someone with rights deletes both after G6/G7; neither is ever merged. No change to the PR. |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01 and STD-02 (one refactor)

**Current** (shape)
```ts
export function checkAuditTransactions(program, root, files): AuditTransactionReport {
  const checker = program.getTypeChecker();
  const rootDir = rootOf(root);
  ...
  function parameterOf(...) { ... }          // uses checker
  function chainProblem(...) { ... }         // complexity 14
  ...
  for (const name of files) { ... }
}
```
**Suggested**
```ts
interface CheckContext {
  readonly checker: ts.TypeChecker;
  readonly rootDir: string;
}
function parameterOf(context: CheckContext, argument: ts.Expression | undefined): ParameterRef | undefined { /* ... */ }

function chainProblem(context: CheckContext, parameter: ParameterRef, steps: number, path: readonly FunctionNode[], repositoryCallSeen: boolean): string | undefined {
  const { fn } = parameter;
  if (path.includes(fn)) return `${nameOf(context, fn)} is reached through its own callers (a cycle), so no .run( callback can be found`;
  const seen = repositoryCallSeen || callsAnotherRepository(context, fn, parameter.symbol);
  if (isRunCallback(context, fn)) return problemAtCallback(parameter, seen);
  if (steps >= MAX_HELPER_STEPS) return `${nameOf(context, fn)} is more than ${MAX_HELPER_STEPS} calls away from its .run( callback`;
  return problemWithCallers(context, parameter, steps, path, seen);
}

export function checkAuditTransactions(program: ts.Program, root: string, files: readonly string[]): AuditTransactionReport {
  const context: CheckContext = { checker: program.getTypeChecker(), rootDir: rootOf(root) };
  // the scan loop only
}
```
Behaviour is unchanged; the 29 + 111 tests and the real-services run are the guard.

### STD-06 suggested comment text
```js
// Only the transaction runner makes a `Transaction` handle (STORY-10.18, architecture section 6). ...
// A literal `import()` of that file is refused whole, because `no-restricted-syntax` cannot see which names a dynamic import uses.
// It is in the block below (every file but the runner's own and the tests) and, because a later block replaces an earlier one,
// also in every group of `restrict()`. That block must stay above the group blocks.
```

### STD-07 suggested message
```js
message: 'Only src/server/repositories/transaction.ts and tests/** may import createTransactionHandle: a service gets its Transaction from TransactionRunner.run (architecture section 6). An import() of this file is refused whole, because the lint cannot see which names it takes; use a static import of the names you need.',
```
</details>

## Reviewer-specific tables

Not applicable (standards).

## Answers to the orchestrator's open questions (standards lane)

| Question | Answer |
|----------|--------|
| How a "step" is counted in the callback | Header (`audit-transaction-check.ts:20-21`), code (`steps >= MAX_HELPER_STEPS` is tested after the callback test) and test names agree: three calls below the callback pass, four fail. Whether the callback counts is the architect's and product-owner's decision, not a standards item. |
| Change to the Engineer import rule test (G12 scope) | Not a weakening (STD-10). Wording fix STD-08. |
| Architecture §6 still says "eight" | Architect's change (15 now; 11 at 023e17d). Not a defect of the PR. Test strategy §10 "Vitest totals of record" will need the move 2,914 to 3,054 (unit) and 5,237 to 5,377 (full) after merge. |

## Good practice to keep

- Both file headers state what the check cannot see (AC-5), so no pass is read as more than it proves.
- A check that visits nothing cannot pass: `checked >= 15` is pinned and an unknown path throws.
- 25 in-memory cases cover each plant form and each edge of the chain, so a check gone too loose or too strict shows in a unit test, not only on the real code.
- The lint rule is applied in every group (9 import forms in 9 file groups) and the `next/image` ban is shown to survive.
- Heavy set-up runs in its own hooks (test strategy §10, DL-057).
- Each plant's diff is printed before its result; the count of 15 against AC-4's 11 is stated, and the AC is not edited.

## Previous Findings (re-review only)

Not applicable (round 1).

## Issues for other roles

- solution-architect: architecture §6 "eight" to 15 (11 at 023e17d); record the real meaning of the Engineer allow-list entry `transaction` (STD-08); update test strategy §10 totals after merge.
- product-owner: AC-4 says 11 at 023e17d; the test pins "at least 15".
- orchestrator / delivery lead: delete the two control branches after G6/G7 (STD-12); PR #250 is "behind" `master` (c6b9074, docs only); update by a merge commit before G7 as under §8.
