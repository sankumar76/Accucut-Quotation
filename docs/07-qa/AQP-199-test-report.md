# Test Report — AQP-199 (STORY-10.14): Cut CI feedback time: E2E stage 12 faster without losing coverage (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **Final head `34e3ad0`** on `feat/AQP-199-ci-time` (PR #86; the orchestrator's update from `master` on top of `3808560`) |
| CI | Run **42142769067** on `34e3ad0`: green, one job named `Stages 1 to 11`; stage 12 had 308 passed, 21 skipped, **0 flaky**, 4 workers; no install stall (8 s) |
| Environment | Mostly the GitHub Actions API and run logs. **Local**, Windows 11, Node 22, on an isolated `git archive` copy of `34e3ad0` (no shared worktree, no `git merge`), only: `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/one-width-tag.test.ts`, plus one planted fault |
| Date | 2026-11-06 |
| Evidence list | master's G6 GO, Jira AQP-199 comment 11026, on the ACs restated in DL-102 |
| **Recommendation** | **ACCEPT** |

## Summary

- **AC-2:** recomputed from the run logs with one stall rule on both sides. Stage 12 median went from **308 s to 249 s, −19.2 %**, against the target of at least 15 %.
- **AC-3:** the 22 `@one-width` tests run on desktop only and all passed; a planted tag in an unlisted file fails the allow-list test.
- **AC-4:** the required check is still one job named `Stages 1 to 11`, and the negative control failed it.
- **AC-5:** 0 flaky on the final head at 4 workers, and no timeout widened.
- **AC-6:** runner minutes are at or below before.
- **AC-1 and AC-7:** the nightly output is recorded below; it has the exact 9-minute line.
- **Regression:** green on the final head, including stage 11b.

## AC Verification Matrix

| AC | Technique | Result | Evidence |
|----|-----------|--------|----------|
| AC-1 (nightly report, no numeric target) | Read the nightly CI-time step on the PR head | ✅ Recorded | See "Nightly output" below. The AC-1 reading proper starts with the first nightly report whose oldest counted run started after this story's merge commit, and it is recorded at the sprint 1 review. That cannot happen before the merge |
| AC-2 (stage 12 median at least 15 % shorter, median of three, fixed baseline, stalls repeated) | Recomputed from the Actions API (job and stage 12 step times) and each attempt's log (install time). **Stall rule, applied to both sides:** the install part of stage 12 (from the step's start to Playwright's first output) over **120 s** is an Environment stall; it is excluded and repeated (DL-100). **Not re-measured on the updated head (11026)** | ✅ **−19.2 %** | See the table below |
| AC-3 (coverage kept; tag only in the ruled files) | Final-head CI log; local unit test with a planted fault | ✅ | **Final head:** 22 tests carry `@one-width`, and **all 22 ran on desktop and passed (✓); none ran on mobile or tablet, and none was skipped.** By file: `sign-in.spec.ts` 12, `axe-helper.spec.ts` 5, `aqp-38-qa.spec.ts` 3, `production-routes.spec.ts` 2. The 21 skipped tests are the existing viewport-specific skips, the same 21 as before the change. `grep -rl @one-width tests/e2e` finds exactly the four ruled files. `retries: 1` and `forbidOnly: IN_CI` are unchanged. **Planted fault:** with `{ tag: '@one-width' }` added to the first test of `tests/e2e/shell.spec.ts` (not ruled), `one-width-tag.test.ts` **fails**: "appears in no file of tests/e2e except the four ruled … expected [ 'shell.spec.ts' ] to deeply equal []", 2 failures. Restored: 10 of 10 pass, and the file has no diff |
| AC-4 (the gate stays a gate) | API; the negative-control run; local unit test | ✅ | Run 42142769067 has **one job, named `Stages 1 to 11`**. **Negative control:** [run 42073527588](https://github.com/sankumar76/Accucut-Quotation/actions/runs/42073527588), on PR #89 ("AQP-199: negative control, do not merge", closed and **not merged**, `66f577f`). The job `Stages 1 to 11` **failed** at "Stage 12: E2E", on `negative-control.spec.ts:7` "this test fails on purpose" (and its retry). `tests/unit/ci-workflow.test.ts` passes locally (in the 57 of 57 below) and in CI |
| AC-5 (no new flakiness; no timeout widened) | Final-head CI log; the PR diff | ✅ | **Final head:** "Running 329 tests using 4 workers", 308 passed, 21 skipped, **0 flaky**. The earlier five-run series on `03ad852` (attempts 1, 2, 3, 6 and 7 green) also had 0 flaky; the stalled attempts 4 and 5 were repeated, not counted. **Timeouts:** the diff against `master` changes `workers` only (`IN_CI ? 4 : 2`). `expect.timeout` (15 s), the web-server timeouts (120 s and 300 s) and `retries` (1) are unchanged. The one new `timeout:` line in `auth.setup.ts` reuses the existing `COMPILE_TIMEOUT` (120 s, unchanged) for the added `/queue` warm-up |
| AC-6 (security, and minutes at or below before) | `ci.yml` read; minutes from the API (job time, rounded up) | ✅ | **Workflow:** `ci.yml` changes are a comment and one `echo` of the runner size ("Runner: 4 vCPU, … MB"). The trigger is still `pull_request` only, `permissions: contents: read`, every action pinned to a commit SHA, no repository secret, passwords masked. **Minutes per run:** before (clean) 8, 7, 9 (median 8); after (clean) 7, 7, 7 (median 7); **final head 7**. All are at or below before, and far under the 2x cap |
| AC-7 (the 9-minute line) | Nightly output on the PR head; unit tests | ✅ | Over 540 s, the exact sentence is printed (below), together with the run count and the oldest and newest run with their start times and head commits. The 540 s and 541 s cases, fewer than 20 runs and a re-run attempt excluded are covered in `ci-feedback-time.test.ts`, which passes locally |

### AC-2 recomputed (stage 12 and the required job, from the Actions API; install time from each attempt's log)

| Side | Run, attempt | Commit | Job (s) | Stage 12 (s) | Install (s) | Tests (workers) | Counted? |
|---|---|---|---|---|---|---|---|
| Before | 42061753504 a1 | `423fafe` | 468 | **313** | 9 | 361 (2) | yes |
| Before | 42061753504 a2 | `423fafe` | 396 | **264** | 9 | 361 (2) | yes |
| Before | 42061753504 a3 | `423fafe` | 992 | 842 | **584** (apt 20.5 MB at 35.9 kB/s) | 361 (2) | **no: stall, repeated (DEF-015)** |
| Before | 42061753504 a4 | `423fafe` | 509 | **308** | 8 | 361 (2) | yes |
| After | 42070716328 a1 | `03ad852` | 413 | **249** | 8 | 329 (4) | yes |
| After | 42070716328 a2 | `03ad852` | 411 | **254** | 8 | 329 (4) | yes |
| After | 42070716328 a3 | `03ad852` | 403 | **245** | 9 | 329 (4) | yes |
| After | 42070716328 a4 | `03ad852` | 792 | 635 | **426** (apt 18.1 MB at 45.7 kB/s) | 329 (4) | no: stall |
| After | 42070716328 a5 | `03ad852` | 796 | 640 | **442** (apt 21.9 MB at 50.6 kB/s) | 329 (4) | no: stall |

| Median of three counted runs | Before | After | Change |
|---|---|---|---|
| **Stage 12** | **308 s** (313, 264, 308) | **249 s** (249, 254, 245) | **−19.2 %** (at least 15 % required): **met** |
| Required job | 468 s | 411 s | −12.2 % |

- **The stall rule was applied the same way to both sides:** one stall in "before" and two in "after", each excluded.
- **"After" uses the head plus its first two clean re-runs.** Later clean attempts of the same head do not change the result: with a6 (246 s) and a7 (171 s) as well, the median of all five clean attempts is 246 s, −20.1 %.
- **Test counts:** "After" ran 32 fewer test runs, because of two effects:
  - 22 tests no longer run on mobile and tablet: 44 fewer.
  - 12 more tests came from `master` (#85).
  - Net: −44 + 12 = −32. So the cut is, if anything, slightly understated.
- These figures match the developer (11022), reviewer-quality (11025) and reviewer-performance (11024) to the second.

### Nightly output (AC-1, AC-7), recorded as printed

Nightly run 42142769100 on the final head `34e3ad0`, job "CI feedback time". It fails, as expected, on the existing breaches:

```
CI feedback time of "Stages 1 to 11" (only 15 runs, fewer than the 20 asked for): p95 15 m 05 s (target at most 10 m), median 8 m 01 s (early warning over 6 m).
Runs used: 15. Oldest run 42027779941 started 2026-11-05T12:30:58.000Z, head commit efc88f4a9343c8eae51d4f82bf78553293e2510c. Newest run 42141321692 started 2026-11-06T01:04:35.000Z, head commit 380856001a789974f50051f836c76a224383e819.
CI feedback time: the p95 of "Stages 1 to 11" is 15 m 05 s, over the 10-minute target (15 runs).
CI feedback time: the median of "Stages 1 to 11" is 8 m 01 s, over the 6-minute early warning (15 runs).
p95 over 9 minutes (DL-095): before AQP-199 merges, stories that add E2E specs are held at G6; after it, the shard step of test strategy 10.5 is due.
```

The previous head's nightly (42141321642, on `3808560`) printed the same figures over a different window of 15 runs.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| CI-time and coverage unit tests (local) | `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/one-width-tag.test.ts` | 57 | 57 | 0 | 0 | about 1 min (the allow-list test lists the suite with `playwright test --list`) |
| Full regression (CI, final head) | Run 42142769067 | all stages | ✅ (E2E 308) | 0 | 21 (viewport-specific) | 6 m 23 s; stage 12 211 s |

**Stage 11b on the final head:** `/` 163,294, `/queue` 164,428, `/sign-in` 162,852, not-found 156,332, all within 200,000 B (and under the 190,000 B floor).

## Exploratory Testing

**Charter:** check that the measurement can be trusted, rather than the code. Read every attempt's log, not just the summary, and apply the stall rule the same way on both sides. **Time-box:** 45 min. **Findings:**
- Each stalled attempt shows the same apt pattern: tens of kB/s from the Azure Ubuntu mirror, inside `playwright install --with-deps`. That is DEF-015 (AQP-206), not this story.
- No test hung in any attempt.
- No figure changed when every attempt was recomputed from the raw logs.

## Defects

None new. **DEF-015** (AQP-206, #88; Environment, Sev-3), the apt stall, caused every excluded attempt. It is fixed in its own PR after this story merges (product-manager, 10996).

## Residual Risks / Notes

- **RISK-023:**
  - The nightly p95 (15 m 05 s) and median (8 m 01 s) are still over target, because the window holds runs from before this change and the apt stalls.
  - The levers are AQP-206 (the p95) and the shard step, AQP-208 (the median).
- **The merge is pending:** GitHub shows the PR as BLOCKED. It waits for the G7 decision and the delivery lead's merge.
- **After the merge:** AQP-65's G6 hold lifts (DL-099), and AQP-206 starts.
- **Closure:** QA moves the story to Done only after master's G7 decision is posted (DL-098).
