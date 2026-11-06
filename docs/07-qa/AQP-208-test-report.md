# Test Report — AQP-208 (STORY-10.15): CI shard step: stage 12 in two shard jobs behind a fan-in job named `Stages 1 to 11` (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **Final head `47722b1`** on `feat/AQP-208-ci-shards` (PR #96) |
| CI | Run 42196055291 on `47722b1`: green. Jobs `Stages 1 to 11b`, `Stage 12: E2E (shard 1 of 2)`, `Stage 12: E2E (shard 2 of 2)` and the fan-in `Stages 1 to 11` all succeeded. Required path 272 s, 0 flaky |
| Environment | GitHub Actions API and run logs, read by QA. **Locally**, Windows 11 and Node 24, in an isolated `git archive` copy of `47722b1` (no shared worktree, no `git merge`): unit tests only, one run after another, with free memory recorded. **No evidence run was made on the story branch;** the negative controls are on the throwaway PR #98 |
| Date | 2026-11-06 |
| Evidence list | master's G6 CONDITIONAL GO 11071 and closure 11092 |
| **Recommendation** | **ACCEPT** |

## Summary

- **AC-2:** the required path, from the start of the first job to the end of the fan-in, has a median that went from **503 s to 285 s (−43 %)**. That is at most 6:00.
- **AC-3:** the two shards together hold the whole list of **362** width tests, with **0 missing and 0 in two shards**. Two planted faults each fail `e2e-shards.test.ts`.
- **AC-4:** all three negative controls on PR #98 turn `Stages 1 to 11` red, with the right reason.
- **AC-5:** five consecutive runs had 0 flaky.
- **AC-6:** runner minutes are 1.36× raw and 1.56× billed, both at most 2×.
- **AC-7:** the DL-103 line is exact, pinned, and seen live.
- **QA's own 20-run series** of the shard-coverage test passed **20 of 20**.
- **Windows:** the fixed tests pass 4 of 4.
- **Regression:** green on the final head.

## AC Verification Matrix

| AC | Technique | Result | Evidence |
|----|-----------|--------|----------|
| AC-1 (nightly median at most 6:00, p95 at most 7:00 after the merge) | — | Recorded after the merge | Read from the first nightly report whose oldest counted run started after the merge commit, and recorded at the sprint 1 review; it does not hold Done. **Today's window holds only pre-shard runs:** nightly run 42196055135 on the PR head, "CI feedback time" job, reports "(only 13 runs, fewer than the 20 asked for): p95 9 m 34 s …, median 7 m 45 s". Its oldest run is 42154016256 (`3e2a695`) and its newest 42179402882 (`3aa50db`) |
| AC-2 (required path: median at most 6:00, from the first job's start to the fan-in's end) | Recomputed by QA from the Actions API jobs of each attempt | ✅ **Met** | See the table below. **Before: 503 s. After: 285 s (4:45), −43 %** |
| AC-3 (every test runs once; `setup` once per shard) | Local `playwright test --list`, whole and `--shard=1/2` and `2/2`; `e2e-shards.test.ts`; planted faults | ✅ | **Whole list:** mobile 109, tablet 109, desktop 144, so 362 width tests (plus `setup` 2). **Shard 1 of 2:** mobile 109, tablet 72, setup 2. **Shard 2 of 2:** tablet 37, desktop 144, setup 2. **Union 362, equal to the whole list; 0 duplicates, 0 missing.** CI on the final head agrees: "Running 183 tests … shard 1 of 2" and "… shard 2 of 2", 366 = 362 + 4 set-up runs. **Planted fault 1** (missing tests: the listing helper asks for `--shard=i/(N+1)`): the union test fails with "expected [ …(242) ] to deeply equal [ …(362) ]". **Planted fault 2** (duplicates: every shard asks for `--shard=1/N`): the same test fails, with 362 entries but repeats. Restored: 3 of 3 pass. The `@one-width` tags, `grepInvert`, `retries: 1` and `forbidOnly` are unchanged (`one-width-tag.test.ts` passes) |
| AC-4 (the gate stays a gate) | API and fan-in job logs of the three controls on throwaway **PR #98** ("THROWAWAY, DO NOT MERGE: AQP-208 negative controls", **closed, not merged**) | ✅ | **[42173935608](https://github.com/sankumar76/Accucut-Quotation/actions/runs/42173935608)** (one failing E2E test): shard 1 `failure`, shard 2 `success`, `Stages 1 to 11b` `success`, **`Stages 1 to 11` failure** with "##[error]E2E finished as 'failure', not 'success'". **[42174577700](https://github.com/sankumar76/Accucut-Quotation/actions/runs/42174577700)** (shard job skipped): **`Stages 1 to 11` failure** with "E2E finished as 'skipped', not 'success'". **[42175229469](https://github.com/sankumar76/Accucut-Quotation/actions/runs/42175229469)** (cancelled): all jobs `cancelled`, **`Stages 1 to 11` failure** with "VERIFY finished as 'cancelled'…" and "E2E finished as 'cancelled'…". In each the fan-in exits 1. The required check keeps its name and branch protection is unchanged. `ci-workflow.test.ts` passes (69 of 69 together with the two CI-time test files) |
| AC-5 (five consecutive runs, 0 flaky) | Shard job logs of 42173161146 attempts 1 to 5 | ✅ | Every shard job of all five attempts reports "181 passed" or "164 passed", with **no flaky and no failed** line. The final head (42196055291) also had 0 flaky |
| AC-6 (security; runner minutes at most 2×) | `ci.yml` read; minutes from the API (raw seconds and per-job billed minutes) | ✅ | **Raw:** before (a2 to a4) 507, 499, 503 s, median 503 s; after (a1 to a3) 685, 632, 720 s, median 685 s, so **1.36×**. **Billed:** before 9 minutes; after 14, 13, 14, so **1.56×**. Both are at most 2×. **Workflow:** `pull_request` and `push` triggers, no `pull_request_target`, `contents: read`, the fan-in `permissions: {}` (tested), every action SHA-pinned, no secret, and each shard with its own throwaway PostgreSQL and generated, masked passwords. Each shard runs stage 12a; on the final head **both shards hit the package cache** ("Cache hit for: playwright-debs-e1-…") |
| AC-7 (measure follows the fan-in; the DL-103 line) | Source read; unit tests; live nightly output | ✅ | `scripts/lib/ci-feedback-time.ts:42` and the pinned test (`ci-feedback-time.test.ts:159`, `:164`) read exactly: **"p95 over 9 minutes (DL-095, DL-102): CI feedback is too slow; the next step is named in test strategy 10.5."** At exactly 540 s nothing is written (test). **Live:** nightly 42196055135 printed the same line word for word, because the p95 was 9 m 34 s. The sharded and one-job measures and the excluded cases are in `ci-feedback-time-sharded.test.ts` (passes) |

### AC-2 recomputed by QA (first job start → end of `Stages 1 to 11`, from the Actions API)

| Side | Run, attempt | Commit | Required path | Jobs | Billed min | Counted |
|---|---|---|---|---|---|---|
| Before | 42166426901 a1 | `84f5d11` | 703 s | one job, **failure**: "##[error]The action 'Stage 12a…' has timed out after 8 minutes" | 12 | **No: Environment (12a cap), repeated** |
| Before | 42166426901 a2 | `84f5d11` | **507 s** | one job | 9 | yes |
| Before | 42166426901 a3 | `84f5d11` | **499 s** | one job | 9 | yes |
| Before | 42166426901 a4 | `84f5d11` | **503 s** | one job | 9 | yes |
| After | 42173161146 a1 | `9c725e1` | **291 s** | 11b 181 s; shard 1 283 s; shard 2 217 s; fan-in 4 s | 14 | yes |
| After | 42173161146 a2 | `9c725e1` | **238 s** | 11b 208 s; shard 1 232 s; shard 2 189 s; fan-in 3 s | 13 | yes |
| After | 42173161146 a3 | `9c725e1` | **285 s** | 11b 176 s; shard 1 278 s; shard 2 263 s; fan-in 3 s | 14 | yes |
| After (extra) | 42173161146 a4, a5 | `9c725e1` | 244 s, 252 s | — | 12, 13 | not in the median of three |
| Final head | 42196055291 a1 | `47722b1` | 272 s | 11b 184 s; shard 1 192 s; shard 2 260 s; fan-in 3 s | 14 | regression |

**Medians: before 503 s, after 285 s, −43.3 %.** Both match master's and the reviewers' figures. A shard is the critical path in every run.

## QA's shard-coverage series and the Windows check

| Series | Command | Result |
|---|---|---|
| 20 runs, one after another, on `47722b1` | `npx vitest run tests/unit/e2e-shards.test.ts` (each run lists the suite whole and per shard) | **20 of 20 passed** (3 of 3 tests each). Durations 6 to 30 s; free memory before each run 0.91 to 1.48 GB of 7.8 GB. **No failure, so nothing to classify.** No listing failed with empty output, so master's Test-defect trigger (11092) did not fire |
| Windows, the fixed tests | `npx vitest run tests/unit/ci-fan-in.test.ts tests/unit/e2e-shards.test.ts tests/unit/one-width-tag.test.ts`, 4 times in sequence | **4 of 4**, 16 of 16 tests each run, 8 to 9 s each. No limit raised, no retry |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Shard coverage, 20 times | `npx vitest run tests/unit/e2e-shards.test.ts` | 60 | 60 | 0 | 0 | 6 to 30 s per run |
| Fixed tests, 4 times | the three files above | 64 | 64 | 0 | 0 | 8 to 9 s per run |
| Workflow and CI-time tests | `npx vitest run tests/unit/ci-workflow.test.ts tests/unit/ci-feedback-time.test.ts tests/unit/ci-feedback-time-sharded.test.ts` | 69 | 69 | 0 | 0 | under 1 min |
| Regression (CI, final head) | Run 42196055291 | 4 jobs | ✅ (E2E 181 + 164 passed) | 0 | 21 (viewport-specific) | required path 272 s |

**Stage 11b on the final head:** `/` 163,566, `/queue` 164,700, `/sign-in` 163,287, `/users` 170,916, not-found 156,598. All 6 rows are within the limit.

## Exploratory Testing

**Charter:** try to find a run shape in which a broken run would still show a green `Stages 1 to 11`, or a shard split that loses a test. **Time-box:** 40 min. **Findings:**
- **Fan-in:** it names every non-success result (failure, skipped, cancelled) and exits 1, under `if: always()`, so a skipped required check cannot pass silently.
- **Shard split:** the split is by count (shard 1 holds mobile and part of tablet; shard 2 the rest of tablet and desktop). It is complete and has no overlap.
- **Imbalance (QLT-87 / PRF-02, Info):** shard 1 ran 181 tests against 164 for shard 2, which is noted and accepted.

## Defects

None.

## Residual Risks / Notes

- **The PR shows "UNSTABLE"** only because the non-required nightly "CI feedback time" job fails on today's window of 13 pre-shard runs: median 7 m 45 s, **p95 9 m 34 s**.
  - **For master:** in 11071 the p95 was 8:59 and DL-102's fallback ("p95 still over 9:00 after AQP-206 holds the next E2E-adding story at G6 until this story merges") did not arm. **Today's p95 is over 9:00.** The window holds no sharded run yet, and this story is the remedy. Whether the fallback applies before this merge is master's call.
- **#99 / STORY-10.16:** the key warm-up and the bounded download follow this story (product-manager, 11073).
- **RISK-023** falls to 6 when this story merges and a nightly window meets a median of at most 6:00 and a p95 of at most 7:00 (master, 11071).
