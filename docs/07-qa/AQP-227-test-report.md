# Test Report — AQP-227 (STORY-10.17): Three E2E shards in CI

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `0147c3e` on `feat/AQP-227-three-shards` (PR #124, `sankumar76/Accucut-Quotation`), plus this report and DEF-022 committed with it (docs only) |
| CI | Run 42588037093 on `0147c3e`: all five jobs success. Evidence for AC-5 to AC-8 is run 42513656141 on `fe520d2` (stage 12 unchanged since: see AC-1) |
| Environment | Windows 11, Node v24.19.0 (CI uses Node 22), `npm ci` in a QA worktree at `0147c3e`; every Vitest run used a new, empty `PWTEST_CACHE_DIR`. The Actions API and logs were read with `gh` (read only). No live control was run by QA (see AC-4); no commit was pushed for a control |
| Date | 2026-11-09 |
| **Recommendation** | **ACCEPT.** AC-1 to AC-8 all pass, no Sev-1 or Sev-2 defect. One new defect, **DEF-022 (AQP-236, #129), Sev-3, type Test**: the AC-2 guard `e2e-shards.test.ts` still fails on a cold Playwright cache when it runs in the same Vitest run as `one-width-tag.test.ts` (3 of 10 clean runs). It is the residual of G6 ruling 4 (QLT-04), pre-existing at base, not seen in CI. Open: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-022 new), Sev-4 0. **Master's call:** G6 ruling 4 was verified on the single file (10 of 10 here too); if master reads it as "the six guard files pass on a fresh cache", this is a hold for a test-only fix |

## Summary

The change does what the eight ACs say. The only executable line that differs from `master` is `shard: [1, 2]` to `[1, 2, 3]` in `ci.yml`; everything else in the diff is comments and three test files. I rebuilt every CI figure from the Actions API and they match the Dev Record to the second: median required path 4:37 against 4:45, billed 1.20 times against 1.60. Nineteen faults planted one at a time (outside the repository's history, each reverted, none committed) were each caught by the guards, with one gap in the six named files that a seventh file covers (P14). The guards also fail closed on a shard list written in another style (P16).

The one finding is flakiness in a guard, not in the product: on a cold Playwright cache, two guard files list the whole suite at the same moment and one of the two listings can return wrong line numbers.

## AC Verification Matrix

Plant IDs P1 to P18 are defined in "Plants" below. "Six guards" = `ci-workflow`, `ci-workflow-shards`, `e2e-shards`, `ci-fan-in`, `ci-feedback-time`, `one-width-tag` (83 tests).

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | `ci-workflow.test.ts` (AQP-227 AC-1 pin; AQP-208 AC-4 topology tests), `ci-workflow-shards.test.ts` (3 tests); plants P1, P2, P4, P6, P7, P8, P9, P10, P11, P12, P13, P16 | Boundary values on the list, error guessing on the strategy block | ✅ Pass | `git diff 3695f90 0147c3e -- .github/workflows/ci.yml`, non-comment lines: exactly `-        shard: [1, 2]` and `+        shard: [1, 2, 3]`. Shard job name `Stage 12: E2E (shard ${{ matrix.shard }} of ${{ strategy.job-total }})`; command reads `SHARD_TOTAL: ${{ strategy.job-total }}`; `fail-fast: false`; `required` job still named `Stages 1 to 11`, `needs: [verify, e2e]`, the only job with `needs`; actions pinned to SHAs; `permissions: {}` on the fan-in job. No "two shards" wording is left in `ci.yml` or the tests. Every plant that returns to two shards, adds a fourth, reorders, adds `include`, `exclude` or `max-parallel`, turns `fail-fast` on, writes a literal total, renames the fan-in job or adds `needs` to `e2e` fails at least one test (table below). **Note under AC-1/AC-2 (rulings 1 and 2):** P4 and P6 fail 2 tests each; P1, P7, P8 still fail |
| AC-2 | `e2e-shards.test.ts` (union, balance within one, `fullyParallel`, 10 %), plant P3 | EP, boundary values | ✅ Pass | `playwright test --list --shard=i/3` counted independently: whole = setup 3, mobile 140, tablet 140, desktop 187. Shard 1: mobile 140, tablet 16, desktop 0 = **156**. Shard 2: tablet 124, desktop 32 = **156**. Shard 3: desktop 155 = **155**. `setup` = 3 in each shard. Multiset union of the shards equals the whole list (467 width tests, 442 distinct keys). Largest deviation from the mean 0.43 %. **Ruling 1:** P3 (`fullyParallel: false`, split 163 / 156 / 148) fails 2 tests (`fullyParallel stays on` and `tests per shard: 163 / 156 / 148: expected 15 to be less than or equal to 1`); the 10 % test still passes, as the test's comment says. `retries: 1` and `forbidOnly: IN_CI` unchanged in `playwright.config.ts`; `@one-width` pins pass (P15 shows a stray tag fails 2 tests). The union test is the one that flakes cold: **DEF-022** |
| AC-3 | `gh api repos/sankumar76/Accucut-Quotation/branches/master/protection` (read only) | Inspection | ✅ Pass | `required_status_checks.strict: true`, `contexts: ["Stages 1 to 11"]`, `checks: [{context: "Stages 1 to 11", app_id: 15368}]`; `rules/branches/master`: `[]` (no ruleset). No shard job is required by name. PR #124 is `mergeable_state: clean`. No setting was changed |
| AC-4 | Throwaway PRs #125, #126 (developer's, at `fe520d2`), re-read by QA through the API and logs. `ci-fan-in.test.ts` (unchanged), plant P17 | Negative path | ✅ Pass | #125 and #126 are CLOSED, `merged: null`. Control (a), run 42514331234: `Stages 1 to 11b` success, shards 1 and 2 success, **shard 3 failure** (`1 failed`, `141 passed`), fan-in `Stages 1 to 11` **failure** with `##[error]E2E finished as 'failure', not 'success'`. Control (b), run 42513957102: all four jobs cancelled, fan-in **failure** with `VERIFY finished as 'cancelled'` and `E2E finished as 'cancelled'` (GitHub cannot cancel one job; whole run cancelled, accepted by master as QLT-05). Run 42513902330 (invalid first spec) is correctly not used. **No new live control was run:** the controls' value is the workflow's executable text, which is identical at `0147c3e` (zero non-comment `ci.yml` lines changed since `fe520d2`), so a repeat would test the same file. P17 (fan-in accepts anything but `failure`, so a cancelled shard passes) fails 3 tests (2 in `ci-fan-in.test.ts`, 1 in `ci-workflow.test.ts`). `ci-fan-in.test.ts` and `scripts/lib/ci-feedback-time.ts` are unchanged in the diff |
| AC-5 | Actions API, `scripts/` method of test strategy 10.3 (first job start to end of `Stages 1 to 11`, queue wait excluded) | Measurement | ✅ Pass | Recomputed by QA with `gh api .../runs/<id>/attempts/<n>/jobs`. Head `fe520d2`, run 42513656141, attempts 1 to 3: **4:37 (277 s), 4:26 (266 s), 4:39 (279 s); median 4:37**, 8 s under 4:45. Extra attempts 4 and 5: 4:44, 4:21. Final head `0147c3e`, run 42588037093 attempt 1: 4:24. Base `3695f90` at N = 2, run 42493817041, attempts 1 to 3: 6:30, 3:53, 5:36 (median 5:36). Shard spread (head): 34, 66, 32, 81, 85 s, and 78 s on `0147c3e`; over 45 s in 4 of 6 runs, reported not a pass line, input to the next trigger. `master` is still at `3695f90`, so no test-adding PR merged between base and head and the base needs no re-measure. Stage 12a: no run needed replacing |
| AC-6 | Same runs | Measurement | ✅ Pass | Billed minutes (each job rounded up): head 17, 18, 20 (median **18**), base 17, 12, 15 (median **15**): ratio **1.20**, limit 1.60. Raw minutes: head 15.27, 14.67, 17.18 (median 15.27), base 13.82, 9.75, 12.87 (median 12.87): 1.19. `0147c3e`: billed 17, raw 15.00 |
| AC-7 | Same runs, `created_at` to `started_at` per job | Measurement | ✅ Pass | Largest wait in any job: 3 s in head attempts 1 to 4, 4 s in attempt 5, 3 s in all three base attempts and in `0147c3e`. No wait over 60 s in any run; nothing to report |
| AC-8 | Playwright summary line of every shard log, attempts 1 to 5 of run 42513656141 and run 42588037093 | Inspection | ✅ Pass | Every shard log: `157 passed` (shards 1 and 2) and `141 passed` (shard 3), `2 skipped` and `17 skipped` by the tests themselves; no `failed` line and no `flaky` line in any of the 18 shard logs |

## Plants (guard checks; nothing committed)

Each plant was applied to a clean checkout of `0147c3e`, the six guard files were run on a new `PWTEST_CACHE_DIR`, and the tracked files were restored with `git checkout`; `git status` was clean after every plant. "Fails" counts only tests the plant can cause.

| Plant | Fault | Guard that fails | Real failures |
|-------|-------|------------------|---------------|
| P1 | `shard: [1, 2]` | `ci-workflow` AC-1 pin; `ci-workflow-shards` block | 2 |
| P2 | `needs: [verify]` on `e2e` | `ci-workflow` only the fan-in job has `needs` | 1 |
| P3 | `fullyParallel: false` | `e2e-shards` cause and effect | 2 |
| P4 | `exclude: - shard: 3` | `ci-workflow-shards` (both strategy tests) | 2 |
| P5 on `e2e` | job-level `continue-on-error: true` | `ci-workflow-shards` | 1 |
| P5 on `verify` | job-level `continue-on-error: true` | `ci-workflow-shards` | 1 |
| P6 | `include: - shard: 4` | `ci-workflow-shards` (both strategy tests) | 2 |
| P7 | `max-parallel: 1` | `ci-workflow-shards` (2), `ci-workflow` strategy shape (1) | 3 |
| P8 | `shard: [3, 2, 1]` | `ci-workflow` pin; `ci-workflow-shards` block | 2 |
| P9 | `fail-fast: true` | `ci-workflow-shards` block; `ci-workflow` shape | 2 |
| P10 | literal `--shard="${SHARD_INDEX}/3"` | `ci-workflow` | 1 |
| P11 | `shard: [1, 2, 3, 4]` | `ci-workflow` pin; `ci-workflow-shards` block | 2 |
| P12 | fan-in job renamed `Stages 1 to 12` | `ci-workflow` (2) | 2 |
| P13 | `if: ${{ always() }}` removed from the fan-in job | `ci-workflow` fan-in test | 1 |
| P14 | `Math.min` to `Math.max` in `ci-feedback-time.ts` (start of the path) | **None of the six** (83 of 83 pass). `ci-feedback-time-sharded.test.ts`, which is not in the list of six, fails 5 | 0 of six; 5 in the seventh |
| P15 | `@one-width` added to a test in `canary-scan.spec.ts` | `one-width-tag` (2) | 2 |
| P16 | shard list written over three lines | `ci-workflow-shards`, `ci-workflow` (2), `e2e-shards` (3): fails closed | 6 |
| P17 | fan-in accepts any result but `failure` | `ci-fan-in` (2), `ci-workflow` (1) | 3 |
| P18 | path measured from run creation, not first start | `ci-feedback-time` (queue wait left out) | 1 |

In P1, P8, P13 and P18 the `e2e-shards` union test also failed. None of those plants can break it (P1 and P8 keep a complete union at 2 and 3 shards; P13 and P18 touch the fan-in job and the feedback script). These are the cold-cache flake of DEF-022, not plant detections, and are not counted above.

Master's list P1, P3, P4, P5 (both), P6, P7, P8 all fail; each was also confirmed fresh by QA. P2 and P9 to P18 are QA's additions.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Six guard files, fresh cache, first run | `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-workflow-shards.test.ts tests/unit/e2e-shards.test.ts tests/unit/ci-fan-in.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/one-width-tag.test.ts` | 83 | 83 | 0 | 0 | 15 s |
| Six guard files, 10 more fresh caches | same, loop | 830 | 827 | 3 (3 runs, one test each, **DEF-022**) | 0 | |
| `e2e-shards.test.ts` alone, 10 fresh caches | `npx vitest run tests/unit/e2e-shards.test.ts` | | 10 of 10 runs pass | 0 | | |
| Unit suite | `npx vitest run tests/unit` (fresh cache) | 2,483 (129 files) | 2,458 | 0 | 25 | 134 s; 1 file failed its hook (below) |
| The failed file alone | `npx vitest run tests/unit/playwright-system-deps.test.ts` | 25 | 25 | 0 | 0 | 94 s |
| Lint | `npx eslint .` | | exit 0 | | | |
| Type-check | `npx prisma generate`, `npx tsc --noEmit` | | exit 0 | | | |
| Integration, build, E2E | not run locally | | | | | CI run 42588037093: `Stages 1 to 11b` (stages 1 to 11b including integration and build) and all three shards success. The change touches no `src/`, no `playwright.config.ts`, no migration |

The one failing file in the unit run is `tests/unit/playwright-system-deps.test.ts`, `Hook timed out in 120000ms` in the full run on Windows and green alone: the known load-sensitive case **DEF-018 (AQP-225)**, not caused by this story (the PR changes none of its inputs). It is not a new defect.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Required-path time | NFR-009, RISK-023 | AC-5 above, recomputed from the Actions API | ✅ median 4:37 (limit 4:45); worst of 6 head runs 4:44; headroom to the 5:30 trigger 53 s at the median |
| Cost | NFR-025 | AC-6 | ✅ 1.20 billed, 1.19 raw (limit 1.60) |
| Security smoke of the workflow | NFR-002 context | Read of the full diff and `ci.yml` | ✅ trigger `pull_request` only; no secret added; permissions unchanged (`contents: read`, fan-in `permissions: {}`); every `uses:` pinned to a commit SHA; no tool output or password printed. Branch protection unchanged. Canary scan files untouched |
| Accessibility | NFR-018 | n/a (no screen) | n/a |

## Exploratory Testing

Charter: break the claim that "the required check cannot go green with fewer than three shards, or with a shard that failed". Time-boxed to one session. Areas: the shape of the strategy block (inline form, multi-line list, `include`, `exclude`, `max-parallel`, `fail-fast`), job-level `continue-on-error`, the fan-in script's accepted results, the shard-count source in the command, the measure code, and the `@one-width` allow-list. Findings: the guards read the YAML as text, so any other spelling of the shard list fails closed (P16, six failures) rather than passing; that is the safe direction but means a harmless reformat needs a test edit. One real gap in the named six: the start of the measured path (P14) is guarded only by `ci-feedback-time-sharded.test.ts`; the story does not change it and that file runs in CI, so this is a note, not a defect. The flaky listing (DEF-022) was found by running the six files together on a cold cache, then reproduced with a plain Node script, two concurrent `playwright test --list` on one cache: 3 of 6 trials gave one listing with compiled line numbers.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-022 ([AQP-236](https://sankumar76.atlassian.net/browse/AQP-236), [#129](https://github.com/sankumar76/Accucut-Quotation/issues/129)) | `e2e-shards` union test still fails on a cold Playwright cache beside `one-width-tag.test.ts` (3 of 10 clean runs) | Sev-3, type Test | New | AC-2 (guard); G6 ruling 4 |

## Residual Risks / Notes

* **Merge order (condition 8 and DL-117):** the docs PR (test strategy v0.26 10.5, architecture v0.30 9.2) merges before PR #124. At the time of this report `master` is still `3695f90`, so it has not merged yet. The code comment in `e2e-shards.test.ts` cites "test strategy 10.5, Three shards".
* **Headroom:** the median has 8 s of margin on AC-5 and 53 s to the 5:30 trigger (about two stories); shard 1 (mostly `mobile`) is the slowest in most runs. These are the performance reviewer's and architect's points and QA's figures agree.
* **QA did not run a new live control** (AC-4); the developer's two controls at `fe520d2` stand because the workflow's executable text is unchanged since.
* QA added no new test files: every AC already has a guard, and the plants show each one fails when its fault is put in. The QA scripts (plant runner, timing, flake loops) are in the QA scratch folder, outside the repository.
* The branch carries one docs-only commit from QA (this report and DEF-022); the head moves from `0147c3e`. Stage 12 and every test are unchanged by it.
