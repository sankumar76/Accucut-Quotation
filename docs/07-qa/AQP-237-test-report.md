# Test Report — AQP-237 (STORY-10.18): static checks that `audit.record` uses the change's transaction (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | G7 head `ea9aaab` on `feat/AQP-237-audit-record-tx-checks` (PR #250, `sankumar76/Accucut-Quotation`), a merge of `master` 774eff8 into d447e18; this report is added on top as a docs-only commit (the CI run on that commit is posted on the PR) |
| CI | Run **43136706441**, attempt 1, the only run on `ea9aaab`, 5 of 5 jobs `success`; merge ref **4909bca** (`ea9aaab` into `master` 774eff8). Base: push run **43135619452** on 774eff8 |
| Environment | CI for the regression and the plants. Locally, read-only: ESLint and Vitest previews of the plants on a worktree whose `node_modules` predates the Dependabot bumps (no `npm install`, no `npm ci`), and one scratch script that counts the visited calls. Local runs are labelled as such below and are not the evidence for any pass |
| Date | 2026-11-11 (CI times are UTC, 2026-11-12) |
| **Recommendation** | **ACCEPT.** AC-1 to AC-5 pass against their text and the product-owner's change notes. The three QA plants are red in CI, each on the stage and with the finding expected. Regression is 5 of 5 with the count invariant exact. No defect found. Open defects: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 (the two open Bugs in project AQP are Low: AQP-225, AQP-226, neither in this story's area). Two Info observations go to other roles (OBS-2, OBS-5). PRF-03 is reported, not ruled |

## Summary

The story adds two guards and no production code (8 files, nothing under `src/`, no workflow, no dependency). The lint half refuses the name `createTransactionHandle` outside `transaction.ts` and `tests/**`. The architecture test reads the 12 service files with the type checker and visits 15 uses of `AuditService.record`; each is awaited, sits in the function that owns the `tx` parameter, and reaches a `.run(` callback of a `TransactionRunner` that also passes `tx` to a repository. I did not take the developer's and reviewers' plants on trust. On one control PR (#288, closed unmerged) I planted three forms none of them had tried, with each diff printed first: the handle in two real `src/app` and `src/components` files; a `record` inside an IIFE and inside a `.then(`; and a `record` given a transaction that is not the callback's own parameter. All three are red in CI, each at the stage the job reaches first, and the failing test names the planted line. The count invariant holds on the G7 head against the push run of the `master` commit in its merge ref: 3,081 / 5,444 / 778 / 24 = 2,922 / 5,285 / 778 / 24 plus 159 / 159 / 0 / 0.

## AC Verification Matrix

| AC | Method | Result | Evidence |
|----|--------|--------|----------|
| AC-1 Import rule | `tests/unit/lint/transaction-handle-rule.test.ts` (113 tests, CI stage 6 and 11, file time 3,859 ms and 2,799 ms); `npx eslint .` (CI stage 4); QA plant (i) | ✅ Pass | `eslint.config.mjs`: block `accucut/transaction-handle-is-for-the-runner` (every code file except `transaction.ts` and `tests/**`), and the entry repeated in every `restrict()` group. The test lints 9 forms (static, alias, relative, sibling, namespace, re-export, `export *`, literal `import()` twice) in 9 refusing files, one per lint group (81 refusals, each asserting the rule's own message), and in 3 allowed files (27 "allows": `transaction.ts` itself and two files under `tests/`). The entry style follows the existing one (globs for `no-restricted-imports`, a regular expression for a literal `import()`). `npx eslint .` is green on the G7 head (stage 4, 14 s). **QA plant (i)**, below, adds two real files in forms the fixture does not use; `npx eslint .` fails and the message names the handle |
| AC-2 (a) Holder, awaited, chain | `tests/unit/audit-transaction-architecture.test.ts` (46 tests: 4 general, 11 passing, 26 failing, 5 `OPEN_LIMITS`); QA plants (ii) and (iii) | ✅ Pass | The check is lexical at the call and at each helper step (`holderOf`, `problemWithPlacement`), requires awaited / returned / arrow body, selects by receiver type `AuditService`, ends at a `.run(` callback typed `TransactionRunner` (first parameter), counts at most 3 steps, refuses a cycle. Step count as the product-owner's note: a helper 3 calls below the callback passes, 4 fails (case "a chain of 4 steps" in `audit-transaction-failing-cases.ts`). **Plants (ii) and (iii) are red** on the real `user-service.ts` with the findings named below |
| AC-2 (b) Another repository call | Same test; cases "a call on an object that is not declared under src/server/repositories", "a repository call that does not receive the callback handle", P3, P3b | ✅ Pass | `isRepositoryCallWith`: callee `x.m(...)` or `x['m'](...)`, type of `x` declared under `src/server/repositories/` excluding `transaction.ts` and `audit-repository.ts`, an argument that resolves to the step's transaction parameter. The element-access form is a passing case. Any method counts (L3 in the header, pinned) |
| AC-3 Plants | Cases P1, P2 (2 forms), P3, P3b, P5 (2 forms) in `audit-transaction-failing-cases.ts`; P4 in the lint test; the developer's #263 and #264 and reviewer-quality's #272 (read at G6); QA plants (i) to (iii) | ✅ Pass | Each named plant is a failing case with the expected message fragment, and `checked` is pinned per case. At G6 the controls ran on `master`-based PRs with the diff printed. Mine add three untried forms, below. The plants are never committed to #250: it holds no planted code (`git diff origin/master...ea9aaab` is the 8 files listed, none under `src/`) |
| AC-4 Today's code passes; no escape hatch | Test "AC-4: today's services pass with no allow-list, and at least 15 record calls were checked"; `git grep`; scratch script | ✅ Pass | `git grep -c "\.record(" ea9aaab -- src/server/services`: `exchange-rate-service.ts` 1, `masters-service.ts` 5, `treatment-service.ts` 3, `user-service.ts` 6 = **15** (11 at 023e17d plus the 4 added by AQP-123 and AQP-130, as the change note of 2026-11-11 explains; the AC text is unchanged). The test pins `checked >= 15` and an empty finding list, and it passes in stage 6 and stage 11 of run 43136706441 (153 and 212 files green). **Exact count, local scratch script** (`createServicesProgram` plus `checkAuditTransactions` over `serviceFilesUnder`, read-only): 12 files, **checked 15, findings 0**. The same test is the one that turns red in all three plants, so it is live. No allow-list; `git grep "eslint-disable\|@ts-ignore\|@ts-expect-error\|\.skip(\|\.only("` over the 6 test files of the PR and `eslint-disable` over `src/server/services`: no match. No call outside `src/server/services` exists (`git grep "\.record(" -- src ':!src/server/services'`: no match) |
| AC-5 Cost and where it runs | `git diff`; CI log of the G7 run; header read | ✅ Pass | No change to `.github/` or `package.json`: the guards run in the existing lint stage (4) and unit stage (6, repeated in 11). **Time (reported, as the AC asks):** file `audit-transaction-architecture.test.ts` **9,863 ms** in stage 6 (under the 10 s line; the AC's line is the program build, of which the file time is an upper bound) and 13,825 ms in stage 11 (see "Time readings"). The header of `audit-transaction-check.ts` lists what a pass does not prove: a chain over 3 steps (`MAX_HELPER_STEPS`, line 39), a helper in another file (line 30), a callback not typed `TransactionRunner` (line 40), and that neither a write nor an order is required (line 34). **X1 (QLT-08) is at `audit-transaction-check.ts:38`** and pinned as `X1: a record whose error is caught and not rethrown inside the callback passes (QLT-08)` in `OPEN_LIMITS` (`audit-transaction-cases.ts:252`). X1 is not in the short summary in the test file's header (`:19-21`); master ruled that no defect (A-check ruling 2, goes to #259) and I agree: the summary is marked "in short" and points to the full list |

## Count invariant (reading rule of DL-161 (7)(c), DL-163 (4)(a))

| | Unit (stage 6) | Full (stage 11) | E2E shards 1 / 2 / 3 | Skipped 1 / 2 / 3 |
|--|---------------|-----------------|----------------------|-------------------|
| Base: push run 43135619452 on 774eff8 (the `master` commit in the merge ref), read by me from the job logs | 151 files, 2,922 | 210 files, 5,285 | 265 / 263 / 250 = 778 | 3 / 4 / 17 = 24 |
| G7 head: run 43136706441 (merge ref 4909bca) | 153 files, **3,081** | 212 files, **5,444** | 265 / 263 / 250 = **778** | 3 / 4 / 17 = **24** |
| Difference | +159 | +159 | +0 | +0 |

Expected: 156 (round 2) + k = 3 (2 lint-fixture tests and 1 `OPEN_LIMITS` case, condition A) = 159, with `n_s` 0 and E2E +0. It matches on this base, so Playwright 1.65.0 moved no E2E count on this branch (DL-163 (4)(b)). Files +2 (the new architecture test and lint-rule test files). Per-shard E2E counts are equal to the base entry by entry in the total.

## Regression

| Item | Result |
|------|--------|
| CI on the G7 head | Run 43136706441, attempt 1: `Stages 1 to 11b`, E2E shard 1, 2, 3 and `Stages 1 to 11`, **5 of 5 `success`** (jobs API). Stage 4 lint, stage 5 type-check, stage 6 unit (3,081), stage 11 full (5,444), stage 12 E2E (778) all green |
| Cache | 18 "Cache restored successfully" (3 in the main job, 5 in each shard), 0 "Cache not found" |
| Secrets | Gitleaks: 702 commits scanned, no leaks found |
| Matched lines | `flaky`: only the branch names `fix/AQP-268-flaky-g7-7` and `fix/AQP-272-flaky-aqp-122-qa-tablet` in the fetch output. No `flaky`, `retry #` or `✘` line in any shard log. One `FATAL: password authentication failed for user "accucut_owner"` line in the container log, which is also in base run 43134732280 (read by master in the A-check) |
| Open Sev-1 / Sev-2 | JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)`: **0 issues**. JQL `project = AQP AND issuetype = Bug AND resolution = Unresolved`: AQP-225 and AQP-226, both Low (Sev-4), unrelated (a Windows-only hook timeout; a long-lived local database) |
| Path (reported, not held, DL-151) | First job start 01:45:42Z to the end of `Stages 1 to 11` 01:53:59Z = **8:17**. The slowest shard (2) ended at 01:50:57Z (5:15 from the first start). `Stages 1 to 11` then **waited 2:54 in the runner queue** (01:50:57Z to 01:53:51Z) and ran for 8 s. The wait is runner queue, not the PR's work, and this run is not a RISK-023 reading. **Slack** (slowest shard minus `Stages 1 to 11b`): shard 2 314 s minus 231 s = **+83 s** |

## QA plants (control PR #288, closed unmerged; diffs printed in its body before each result was read)

Base `master` 774eff8; branch = the G7 head `ea9aaab` plus one plant commit per plant (each commit starts from `ea9aaab`, so the plants do not stack). A script applied every plant and fails unless each anchor occurs exactly once. Stage 4 (lint) stops the job before stage 6, so a lint plant cannot also test the architecture test; that is why three runs, not one. Each run was cancelled after its red job. Before pushing, I previewed each plant locally (ESLint, `tsc --noEmit` for (ii) and (iii), and the architecture test); the local results matched CI and are not used as evidence.

| Plant | Commit, run, merge ref | Diff | Result in CI |
|-------|------------------------|------|--------------|
| **(i)** The handle imported in two REAL files in forms the fixture cases do not use | 49a1b76, run 43140272909, merge ref 2d7a19f | `src/app/api/v1/materials/[id]/route.ts`: `export { createTransactionHandle as plantedMakeHandle } from '../../../../../server/repositories/transaction';` (renamed re-export, deep relative path, real route handler in a bracket-named folder). `src/components/features/masters/master-opener.ts`: `import { type Transaction, createTransactionHandle } from '@/server/repositories/transaction';` plus a use (inline `type` specifier mixed with the name) | ✅ **Red at stage 4**: `npx eslint .` exit 1, 4 errors. In both files the story's message is present: `route.ts` 3:10 and `master-opener.ts` 6:28 `'createTransactionHandle' import from '…/transaction' is restricted … Only src/server/repositories/transaction.ts and tests/** may import createTransactionHandle: a service gets its Transaction from TransactionRunner.run (architecture section 6)`. The older `src/app and src/components import no repository` error also fires at 3:1 and 6:1, so the second message is what proves the new entry is in the presentation group's `restrict()` list |
| **(ii)** A `record` inside an IIFE and inside a `.then(`, both in the `.run(` callback of `user-service.ts` `update` | a20fbb4, run 43140750258, merge ref 23170a9 | Line 166: `await (async () => { await audit.record(tx, {user.renamed …}); })();`. Line 172: `await Promise.resolve().then(() => audit.record(tx, {user.activated …}));` | ✅ **Red at stage 6** (stages 4 and 5 green): 1 failed / 3,080 passed of 3,081, test `AC-4: today's services pass with no allow-list …`, findings exactly `user-service.ts:167` and `user-service.ts:175`: `the record call sits in a nested function, not in the function at line 142, whose parameter it passes` |
| **(iii)** A callback passing a transaction that is not its parameter, two forms | a6ab04f, run 43141092412, merge ref 85b688d | (a) Line 169: `const keptHandle = tx;` then `audit.record(keptHandle, {user.role_changed …})`. (b) Line 174: a second `transactions.run(async (inner) => { await users.findAccountForUpdate(target.id, inner); await audit.record(tx, {user.deactivated …}); })`, which gives `record` the OUTER `tx` | ✅ **Red at stage 6** (stages 4 and 5 green): 1 failed / 3,080 passed of 3,081, the same test, findings exactly `user-service.ts:170: the transaction passed to record is not a parameter of the function that holds the call` and `user-service.ts:177: the record call sits in a nested function, not in the function at line 142, whose parameter it passes` |

STD-13: no plant used the lint fixture, so the fixture's new refusal did not come into play; the lint plant went through the real `npx eslint .`. The 113-test file includes the two STD-13 tests (a source that does not parse; an ignored path `src/generated/example.ts`), which pass.

Note on what these plants do not show: each red is the single test `AC-4: today's services pass …`, which is the one that reads the real services. Its message names the file and line, so a reader can act on it without opening the checker.

## Time readings (AC-5; reported, no ruling on PRF-03)

Architecture test file time on the G7 run, with the host factor computed by me by the definition of test strategy section 10 (median, over the other files over 1 s in the same stage, of their time against reference run 43053208506):

| Stage | File time | Files over 1 s matched | Host factor (mine / master's A-check) | Normalised (mine / master's) |
|-------|-----------|------------------------|----------------------------------------|------------------------------|
| 6 (unit) | **9,863 ms** | 10 | 1.07 / 1.06 | 9.2 s / 9.3 s |
| 11 (full) | **13,825 ms** | 35 | 1.10 / 1.10 | 12.5 s / 12.6 s |

The stage 6 reading is under the 10 s report line and over the 8 s PRF-03 line; the PRF-03 trigger needs the post-squash `master` push run as well (DL-161 (4), A-check ruling 3), and I rule nothing on it. The stage 11 reading is above the 4.5 to 9.9 s normalised range of test strategy section 10; AC-5's line is the unit stage, so this is an observation and not an AC-5 finding. The 120 s hook limit holds (DL-057). My factors differ from master's by 0.01 because I take the upper median of an even set; neither changes a conclusion.

## Non-Functional Checks

| Check | Method | Result |
|-------|--------|--------|
| Security smoke (the story is a guard, not a feature) | ESLint on stdin as `src/server/services/probe.ts`, read-only, local: four other ways to reach the handle (see OBS-1) | ✅ every one refused, by this rule or a neighbouring one. No `src/` file changed, so no authZ, input or error-leak surface changed |
| Suppression audit | `git grep` for `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `.skip(`, `.only(` in the 6 PR test files and `eslint-disable` in `src/server/services` | ✅ none |
| Weakened tests | `git diff origin/master...ea9aaab -- tests/security/engineer-import-rule.test.ts` | ✅ the only change keeps the allow-list semantics and adds a control (`NAMED_IMPORTS_ONLY`); nothing is removed, skipped or loosened |
| Performance | Time readings above | Reported |
| Accessibility | n/a (no screen) | n/a |

## Exploratory Testing

Charter (45 minutes): break the claim "a `record` outside the change's transaction, or the handle outside the runner, cannot reach `master` unseen". Areas: other routes to the handle than the nine fixture forms; real files instead of fixtures; forms of a held transaction that the lexical rule might read as a parameter; the scope of the files read.

* **OBS-1 (Info), other routes to the handle are all refused.** ESLint run locally on stdin as a service file: a template-literal `import(\`@/server/repositories/transaction\`)` gives `no-restricted-syntax` "Dynamic import of a computed path is forbidden (ADR-010)"; `require('…/transaction')` and `import tx = require('…/transaction')` give `@typescript-eslint/no-require-imports`; `import type { createTransactionHandle } from …` gives this rule's `no-restricted-imports`. AC-1 names only static import, re-export and a literal `import()`, so the first three are neighbouring rules doing the work; I record them because the rule's own tests do not.
* **OBS-2 (Info, other role: solution-architect), the handle rule is shadowed in `src/app` and `src/components`.** A presentation file importing anything from `repositories` is already refused by the older ban, so a plant there is red even if the new entry were missing from `restrict()`. The 9-file fixture test covers it by asserting the rule's own message, and plant (i) shows the message on real files, so there is no gap. It means the message assertion, not the rule ID, is what carries the proof. Architecture section 6 ("The test lints each form in nine files … asserts the rule's own message") already says so; no change needed unless the section is next edited.
* **OBS-3 (Info), `checked` is not printed.** CI shows only the pass of the "at least 15" test. The exact figure (15 visited, 12 files, 0 findings) needed the scratch script. If a later reader wants the number in the log, the test could print it; nothing requires it (AC-4 asks the PR to state it, and the Dev Record and this report do).
* **OBS-4 (Info), failure message.** In the three red runs the reason is readable from the Vitest output alone (file, line, sentence). The test's name says "AC-4" for a cause that is an AC-2 rule; this is a naming point for #259, not a defect.
* **OBS-5 (Info, other role: solution-architect / #259), the check reads only `src/server/services`.** That is AC-2's scope. `AuditService` is also referenced in `src/server/composition.ts` and `src/app/api/v1/audit/route.ts`, and there is no `.record(` call in either today or anywhere outside the services (`git grep`, no match). A future `record` call written in one of them would not be visited, and the header's "what it does not see" list does not name this. By reading; I did not plant it, because it is outside the AC and a plant would only restate that. Suggest one line in the header at the next edit (the same edit as X1's pointer in the test header, #259).

No finding is a defect. No Info needs a change in #250.

## Defects

None. No DEF-NNN, Jira Bug or GitHub issue was created.

## Issues for other roles

* solution-architect, at the next edit of architecture section 6 or `audit-transaction-check.ts`'s header: OBS-5 (files outside `src/server/services` are not read). Already routed by master to #259: X1 in the test header summary.
* The architect also adds the four time readings (d447e18 and ea9aaab, stages 6 and 11) to the section 10 range, as master's A-check ruling 4 already says.
* The delivery lead deletes `control/AQP-237-qa-plants` (PR #288) with the other control branches before G8 (DL-161 (8)).

## Residual Risks / Notes

* **D is open and not a G7 item:** architecture v0.40 and test strategy v0.35 are on the records branch only; they must be on `master` before #250's final update and squash (DL-161 (7)(a)). I read §6 "The two checks as built" against the code: the lexical holder, awaited chain, receiver type, step count, count 15 and the accepted forms L1 to L5 all match the code I read.
* **Known limits stay known:** L1 to L5 are pinned `OPEN_LIMITS` cases; L2 (a repository call in a closure that never runs, Q5 / QLT-04) is open as #259, due before G8 and before any story whose callback passes `tx` into a nested function. My plants did not probe L2.
* **Merge:** an update by merge commit after the records PR (#285) changes nothing in the PR's 8 files; the invariant is recomputed against the push run of the `master` commit in the new merge ref (DL-161 (7)(b), (c)). The post-squash `master` push run's stage 6 time is the second PRF-03 reading.
* **Local runs:** the ESLint and Vitest previews and the scratch count ran on a worktree whose `node_modules` predates the Dependabot bumps. They are previews of the plants and the source of the exact `checked` figure; the verdicts above rest on CI.
* This report is committed to the PR branch; the commit changes no test, source, workflow or dependency.
