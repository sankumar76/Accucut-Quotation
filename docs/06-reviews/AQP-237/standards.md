# Review Report — AQP-237 (STORY-10.18) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 (sections below up to "Issues for other roles"), then **2** (re-review, last section "Round 2") |
| Base…branch | `master...feat/AQP-237-audit-record-tx-checks` (PR #250; base b3403e3, `master` now c6b9074) |
| Commit reviewed | Round 1: 87465b68f888344df48a108a24912ca161b6b2f6 (2 commits: c6ade88, 87465b6). Round 2: 57acbae200ffca4befb99a757bd41aea557e8a22 (fix commit on merge commit 2c543cd) |
| Date | Round 1: 2026-11-11. Round 2: 2026-11-11 |
| **Verdict, round 1** | **REQUEST CHANGES** (one Major, STD-01; no Blocker or Critical) |
| **Verdict, round 2** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; one new Minor, STD-13; two new Info) |

PR review: https://github.com/sankumar76/Accucut-Quotation/pull/250 (submitted as COMMENT, `REVIEW_IDENTITY = single-token`; label `review:standards-changes-requested` after round 1, `review:standards-approved` after round 2). Inline comments carry the same IDs.

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

Not applicable in round 1. The round-2 status of every finding above is in the "Round 2" section at the end.

## Issues for other roles

- solution-architect: architecture §6 "eight" to 15 (11 at 023e17d); record the real meaning of the Engineer allow-list entry `transaction` (STD-08); update test strategy §10 totals after merge.
- product-owner: AC-4 says 11 at 023e17d; the test pins "at least 15".
- orchestrator / delivery lead: delete the two control branches after G6/G7 (STD-12); PR #250 is "behind" `master` (c6b9074, docs only); update by a merge commit before G7 as under §8.

---

# Round 2: re-review of the fix round (DL-156 condition R)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 |
| Scope | `87465b6..57acbae` only. The merge commit 2c543cd (`master` 2891457 into the branch) by `git show --cc 2c543cd`: **empty output, a clean merge with no conflict resolution** to read. The new work is the single fix commit 57acbae: `git diff 2c543cd 57acbae`, 8 files, +996 / -605 |
| Head | 57acbae200ffca4befb99a757bd41aea557e8a22 (CI run 43056524392, 5 of 5 check runs success: Stages 1 to 11, 1 to 11b, E2E 1, 2 and 3) |
| **Verdict** | **APPROVE WITH COMMENTS** |

| Severity | New this round | Open at the end of round 2 |
|----------|----------------|----------------------------|
| Blocker | 0 | 0 |
| Critical | 0 | 0 |
| Major | 0 | 0 |
| Minor | 1 (STD-13) | 1 (STD-13), plus the remainder of STD-05 deferred to tech-debt #259 by master (DL-156 (4)) |
| Info | 2 (STD-14, STD-15) | 3 (STD-12 still open, STD-14, STD-15) |

## Round 2 summary

All nine round-1 findings that DL-156 made a condition are fixed, and they are fixed the way the suggestions asked, not by a justification comment. The refactor of `tests/support/audit-transaction-check.ts` is behaviour-preserving as far as the standards lane can see (the module-level helpers take a `Context`, nothing is cast, nothing is suppressed): the longest function in the file is 21 lines and the highest complexity is 10, which is the limit. The case tables left the test file (94 lines), `tests/support/lint-fixture.ts` exists and is used by the new lint test only, the `eslint.config.mjs` comments now say what is true, and the `NAMED_IMPORTS_ONLY` rename comes with the `clientFor` control and is disclosed in the PR body (Decision 2, Files table). The one new Minor is in the extracted lint helper: it hides a fixture that does not parse (STD-13). Two Info items follow. Nothing blocks the merge from the standards side.

## Checks Run (round 2)

| Check | Command / source | Result |
|-------|------------------|--------|
| Lint (CI) | CI run 43056524392 on 57acbae, job "Stages 1 to 11" (stage 4 `npm run lint`) | Pass (check run success) |
| Lint (local, my read) | The main checkout's `node node_modules/eslint/bin/eslint.js --stdin --stdin-filename <path>` on `git show 57acbae:<path>` for the 7 changed test and support files | exit 0, no message, for all 7 (`audit-transaction-check.ts`, `-cases.ts`, `-failing-cases.ts`, `lint-fixture.ts`, `audit-transaction-architecture.test.ts`, `transaction-handle-rule.test.ts`, `engineer-import-rule.test.ts`). Caveat: this uses the records branch's `eslint.config.mjs` (cdb5dec), which does not hold the PR's new handle block, so it proves the generic rules (no `any`, no `console`, no non-null, imports) and not the new rule. CI is the evidence for that. |
| Type-check | CI stage 5 (`npx tsc --noEmit`), same job | Pass. Not run locally (about 20 minutes on this machine, and the disk is 95 percent full). |
| Format-check | none configured in the project | n/a |
| Tests | CI check runs: 5 of 5 success. Counts as stated in the PR body: unit 3,078, full 5,441, E2E 778 (265 + 263 + 250), skipped 24 | I read the check-run conclusions, not the job logs. The arithmetic holds: 2,922 + 140 + 16. The 16 are the new architecture tests: 45 now against 29 (4 + 11 passing + 26 failing + 4 open limits, counted in the case files); the lint test stays at 111 (81 refusals, 27 allowed, 3 others). |
| Function length (§1, 40 lines) | ESLint core `max-lines-per-function` with `max: 1`, run from a scratch config in the session scratchpad (outside the repository), with the project's own `@typescript-eslint/parser`, on the files as `git show 57acbae:<path>` | `audit-transaction-check.ts`: `createServicesProgram` 21, `problemWithCallers` 13, `verdictOn` 13, `checkSource` 13, `problemWithUse` 10, `checkAuditTransactions` about 10; every other function under 10. `lint-fixture.ts`: `createLintFixture` 14. The only functions over 25 lines are test callbacks: the `describe` in `audit-transaction-architecture.test.ts` (61 lines, the suite wrapper), the `describe` in `transaction-handle-rule.test.ts` (30) and one in `engineer-import-rule.test.ts` (37, unchanged by this PR). Round 1 did not count suite wrappers and neither does this round. |
| Complexity (§1, 10) | ESLint core `complexity` with `max: 1`, same scratch config | `parameterOf` **10** (at the limit; the PR body says 9: ESLint also counts the `?.`), `verdictOn` 7, four functions 6, the rest 5 or less. Nothing over 10 (STD-15 notes the headroom). |
| File length (§1, 400) | `wc -l` on the files at 57acbae | `audit-transaction-check.ts` 368, `audit-transaction-failing-cases.ts` 327, `audit-transaction-cases.ts` 263, `engineer-import-rule.test.ts` 248, `eslint.config.mjs` 253, `transaction-handle-rule.test.ts` 101, `audit-transaction-architecture.test.ts` 94, `lint-fixture.ts` 40. All within 400. |
| Casts, `any`, `!`, suppressions, TODO, `console` | `grep` over the new and changed files | None in code. The `any` and the `as 'record'` in `audit-transaction-cases.ts` are inside fixture strings that the program reads as in-memory source (lines 52 and 257), not linted code. No `eslint-disable`, no allow-list. |
| Naming (§2) and magic values (§1) | read in full | `typeConstituents`, `toForwardSlashes`, `REPOSITORIES_DIRECTORY`, `AUDIT_RECORD_METHOD`, `RUNNER_RUN_METHOD`, `AUDIT_SERVICE_FILE`, `AUDIT_SERVICE_TYPE`, `TRANSACTION_RUNNER`, `PROGRAM_BUILD_TIMEOUT`, `LINT_WARM_UP_TIMEOUT`, `HANDLE_NAME`, `WHOLE_MODULE_REFUSED`, `NAMED_IMPORTS_ONLY` are all in place. No bare `'record'` or `'run'` is left in code. |
| Layering and dependency | read | Tests and test support only; no `src/` file, no dependency, no `package.json` or lockfile change, no CI file. `tests/support` imports `eslint` and `typescript`, both already dev dependencies. |
| Version control (§9) | `git log`, `git show -s 57acbae`, PR title and body | Fix commit `test(audit): audit.record checks hold lexically, awaited, by receiver type [AQP-237]`, Conventional Commits, key present, body names the findings. It is one commit for about fifteen findings, which DL-156 (5) asked for ("then pushes the fixes"); under the squash merge of `MERGE_POLICY` that is moot. The merge commit 2c543cd has git's default subject with no key, which the squash also removes; the developer's Decision 7 says it is the orchestrator's. No generated file, no secret. `master` has moved by one docs-only commit (cdb5dec); no file of the PR is touched, so the merge before G7 under section 8 is clean. |
| Secret scan | CI stage 2 (Gitleaks, full history) is in the green job "Stages 1 to 11"; the PR body says no leaks | Not re-run by me. A read of the new files finds no credential, token, URL or personal data. |
| Plants and mutation runs | #263, #264 (developer); reviewer-quality's own | Not my lane (reviewer-quality). |

## Previous Findings (re-review only)

Replies are posted in each original thread on the PR. Status words as in the playbook: Fixed / Not fixed / Rebuttal accepted.

| ID | Sev (round 1) | Status | Evidence at 57acbae |
|----|---------------|--------|---------------------|
| STD-01 | Major | **Fixed** | The ten helpers are module-level functions that take `context: Context` (`{ checker, rootDir }`, lines 77-81). `checkAuditTransactions` (360-368) is the scan loop only, about 10 lines. The longest function in the file is `createServicesProgram`, 21 lines, measured with ESLint's `max-lines-per-function`. No justification comment was needed or added. |
| STD-02 | Minor | **Fixed** | `chainProblem` (276-283) is now short and the work is in `problemAtCallback` (270), `problemWithCallers` (285) and `problemWithUse` (300). Measured: none of them is over 5. The file's maximum is `parameterOf` at 10, the limit (see STD-15). |
| STD-03 | Minor | **Fixed** | The test file is 94 lines. The tables moved to `tests/support/audit-transaction-cases.ts` (263) and `tests/support/audit-transaction-failing-cases.ts` (327). Two files and not the one I suggested, because one would be 582 lines; that is the right call and the header of the second says where the first is. The checker is 368, under 400 with 32 to spare. |
| STD-04 | Minor | **Fixed** | `PROGRAM_BUILD_TIMEOUT = 120_000` with a one-line reason (DL-057), used at `audit-transaction-architecture.test.ts:49`. |
| STD-05 | Minor | **Fixed for this PR; the remainder is Rebuttal accepted (deferred)** | `tests/support/lint-fixture.ts` exists (`createLintFixture(root)`, `LINT_WARM_UP_TIMEOUT`) and `transaction-handle-rule.test.ts` uses it (lines 5 and 19); the file no longer builds its own `ESLint`. The two older files keep their copies by master's decision (DL-156 (4), tech-debt #259), as I had suggested. See STD-13 and STD-14 for two points on the new helper. |
| STD-06 | Minor | **Fixed** | `eslint.config.mjs:142-149`: the comment now says the entry is in the dedicated block `accucut/transaction-handle-is-for-the-runner` and in every group of `restrict()`, "that block must stay above the group blocks", and why. The block repeats it at 219. The header lines 10-11 ("not one block per rule") were already true and need no change. The lint test now fails if the entry leaves `restrict()` (quality's mutation: 81 of 81). |
| STD-07 | Minor | **Fixed** | The message ends "An import() of this file is refused whole, because the lint cannot see which names it takes; use a static import of the names you need." (`eslint.config.mjs:155-156`). The lint test asserts it for both `import()` forms in every group (`WHOLE_MODULE_REFUSED`, `transaction-handle-rule.test.ts:23, 47`). |
| STD-08 | Minor | **Fixed** | `TYPE_ONLY_IMPORTS` is `NAMED_IMPORTS_ONLY`; its comment says what is enforced and that the file is not "types only" (`engineer-import-rule.test.ts:119-123`); the control has the `import { clientFor }` line expecting `[]` and an `import { createTransactionHandle }` line expecting `no-restricted-imports` (lines 185-192); the allow-list comment in `eslint.config.mjs:81-84` says the same. G12 check again: the control still has the same number of tests (one per view), each with more assertions (5 against 3), no matcher widened, nothing removed; the PR body discloses the file (Decision 2 and the Files table). |
| STD-09 | Minor | **Fixed** | All five names are in place, plus three more constants (`AUDIT_SERVICE_FILE`, `AUDIT_SERVICE_TYPE`, `TRANSACTION_RUNNER`); `grep` finds no bare `'record'` or `'run'` in code. |
| STD-10 | Info | Closed, no action | Accepted as Info by master (DL-156 (4)). The G12 file changed again in this round (STD-08); the reading above is the same: stricter, not weaker. |
| STD-11 | Info | Closed, no action | The match is still by module name; unchanged, accepted as Info. |
| STD-12 | Info | **Not fixed (not a PR change)** | The two round-1 control branches are still on the remote, and the developer reports two more (`chore/AQP-237-r2-plants-a`, `-b`) that it could not delete. DL-156 (8) assigns the deletion of all of them to the delivery lead before G8. Nothing to change in the PR; kept open so it is not lost. |

## New findings (round 2)

| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-13 | Minor | `tests/support/lint-fixture.ts:32` | Coding Standards §1 (fail fast and loudly; never swallow silently) | `messagesFor` drops every message whose `ruleId` is `null`: `flatMap(({ ruleId, message }) => (ruleId === null ? [] : [...]))`. ESLint reports a fixture that does not parse as a message with `ruleId: null` and `fatal: true`, and a path that matches an ignore pattern as a `null` warning ("File ignored..."). Both come back as `[]`. | Every "allows" and "leaves open" test (`toEqual([])`) passes without the rule having read the code, so a typo in a fixture, or a fixture path that falls under an ignore pattern, turns a test into a no-op. The code is moved as it was in the round-1 test (it is what STD-05 asked to extract), so this is not a regression; but the header now tells the next lint-test author to take the helper from here, and extraction is the cheap moment to make it safe. | Throw on a fatal message, and on the ignored-file warning:<br>`const [result] = await eslint.lintText(code, { filePath: `${root}${filePath}` });`<br>`if (result === undefined) throw new Error(`ESLint returned no result for ${filePath}`);`<br>`return result.messages.flatMap(({ ruleId, message, fatal }) => {`<br>`  if (fatal === true) throw new Error(`${filePath}: the fixture does not parse: ${message}`);`<br>`  return ruleId === null ? [] : [{ ruleId, message }];`<br>`});`<br>Optionally one test in `transaction-handle-rule.test.ts` that a source string with a syntax error makes `messagesFor` reject. |
| STD-14 | Info | `tests/support/lint-fixture.ts:4-5` | §8 (comments stay true) | The comment says "Three older lint tests keep a copy ... (`layer-rules`, `engineer-import-rule`, `aqp-27-scaffold`; GitHub #259)". Issue #259 names two files (`layer-rules.test.ts`, `engineer-import-rule.test.ts`); `tests/acceptance/aqp-27-scaffold.test.ts` is not in it, and the developer's reply on STD-05 repeats the same count. | A reader who follows the reference finds two files, and the third copy has no ticket. | Either reword to "Older lint tests keep a copy (`layer-rules`, `engineer-import-rule`; GitHub #259)" or ask master to add `aqp-27-scaffold` to #259. No change to behaviour. |
| STD-15 | Info | `tests/support/audit-transaction-check.ts:164-172`, `232` | §1 (complexity at most 10; readability over cleverness), §8 (comments explain why) | (1) `parameterOf` measures 10 with ESLint's `complexity` rule (it counts `?.`, each `&&`/`\|\|` and each `if`); the PR body says 9. That is inside the limit, with nothing in reserve. (2) Line 232, `ts.forEachChild(node, (child) => visit(child) \|\| undefined) === true`, relies on `forEachChild` stopping at the first truthy return and the `\|\| undefined` to turn `false` into "keep going"; no comment says so. | The next edit to `parameterOf` breaks the limit; the idiom on 232 is easy to "simplify" into a bug. No behaviour issue today. | (1) If `parameterOf` is touched again, lift the guard on line 170 into `isFunctionParameter(declaration)`. (2) Add one line: `// forEachChild stops at the first truthy result, so false is mapped to undefined to keep scanning`. No change asked now. |

## Reviewer-specific notes

- The lane boundary held: I did not judge whether the lexical-holder, awaited and receiver-type rules are right or complete (reviewer-quality), nor the 10.5 s stage 6 time that the PR reports against AC-5's 10 s line (the architect and reviewer-performance; DL-156 (7) re-runs performance only if the program set-up changes beyond moving code, and `createServicesProgram` is unchanged in substance).
- A cross-reference only: the PR body says the highest complexity is 9 and the lint-fixture comment cites three files for #259. Both are small facts to correct in the Dev Record if the developer touches the PR again; neither needs a push of its own.

## Answers to the orchestrator's items (round 2)

| Item | Answer |
|------|--------|
| Helpers at most 40 lines and complexity at most 10 | Yes: 21 lines and 10 at the extremes (measured, not counted by eye). |
| Cases in `tests/support/audit-transaction-cases.ts` | Yes, and `audit-transaction-failing-cases.ts` beside it. The test file is 94 lines. |
| Lint-fixture helper | Present, used by the new lint test only; STD-13 and STD-14 on it. |
| `NAMED_IMPORTS_ONLY` plus a `clientFor` control, disclosed | Yes. G12 reading: stricter, no weakening; disclosed in the PR body. |
| Commit hygiene | Conventional Commit with the key; one logical fix commit; merge commit clean (`--cc` empty); nothing generated or secret. |
| Label | `review:standards-changes-requested` was missing from the PR (the labels were `ai-delivery`, `feature`, `review:quality-changes-requested`, `review:performance-approved`); with an APPROVE WITH COMMENTS verdict the label to set is `review:standards-approved`, and that is the only standards label left on the PR. |

## Good practice to keep (round 2)

- The fix reached the findings by structure (a `Context`, small functions with a verb for a name), not by a justification comment or a suppression.
- The two support files are split by purpose and each header points at the other; no file is over 400.
- The lint test asserts the rule's own message, so the test names the thing it protects; the message text the developer ships tells the reader what to do.
- The Dev Record maps each finding to its resolution and its test, and says where the work is deferred (#259) and why.

## Issues for other roles (round 2)

- orchestrator / master: add `tests/acceptance/aqp-27-scaffold.test.ts` to tech-debt #259, or tell the developer to reword the comment (STD-14).
- delivery lead: delete the four control branches and the three `docs/AQP-237-review-*` side branches before G8 (STD-12; DL-156 (8)).
- solution-architect: unchanged from round 1 (architecture §6 and the Engineer `transaction` entry; test strategy §10 totals, now 3,078 / 5,441 to be confirmed after merge).
- orchestrator: update the PR by a merge commit from `master` (cdb5dec, docs only) before G7, as under section 8.
