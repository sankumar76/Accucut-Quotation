# Review Report: AQP-208 (STORY-10.15), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-208-ci-shards` (PR #96) |
| Commit reviewed | 9c725e1b9adbfc5620bc4a571c5878bb50be9ca3 |
| Date | 2026-11-06 |
| Reviewed against | ACs 1 to 7, revision 5 (architect 11017; master DL-103); developer notes (Jira 11066, PR body) |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
**The design is as specified:**
- `verify`, renamed `Stages 1 to 11b`, and a two-shard matrix start together;
- each shard builds, migrates its own database, runs stage 12a and runs `--shard=i/N` with 4 workers;
- the fan-in `Stages 1 to 11` is the only job with `needs`, runs with `always()`, and passes only when every needed job's result is exactly `success`.

**Measured from the Actions API:** the required path went from a median of 503 s to 285 s (4:45), at 1.36 times the runner time. The three negative controls each turned `Stages 1 to 11` red, and the logs name the cause.

**Coverage and measure:** the shard coverage test lists the suite with Playwright itself and fails when a test is lost from one shard. The CI-time measure (earliest first-attempt job start to the end of the successful fan-in) handles old and new runs alike, and the DL-103 line is pinned.

**One Minor finding:** a 12-spawn bash test times out locally on Windows.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-96` (9 files); Jira AQP-208 revision 5; PR body | see Findings |
| Unit tests (a `git archive` copy of 9c725e1) | `npx vitest run tests/unit/e2e-shards.test.ts tests/unit/ci-workflow.test.ts tests/unit/ci-feedback-time.test.ts` | 74 of 74 with `--testTimeout=60000` (6 runs). With the default 5 s, the fan-in bash test timed out in 3 of 3 runs (QLT-85). `e2e-shards` failed once in the first baseline run, cause not captured (QLT-86) |
| Planted-fault probe | 16 edits to the config, workflow and measure (one invalid mutant redone) | 15 of 15 meaningful faults caught |
| AC-2 figures | Actions API: earliest job start to fan-in end, per attempt; the sum of job times | Before 507 / 499 / 503 s → **503 s**; after 291 / 238 / 285 s → **285 s**; attempts 4 and 5: 244 and 252 s; runner time 685 s against 503 s → **1.36 times** |
| AC-4 controls | `actions/runs/{id}/jobs` and `gh run view --log` for 42173935608, 42174577700 and 42175229469 | Fan-in **failure** in all three; logs: `E2E finished as 'failure'`, `'skipped'`, and `VERIFY` / `E2E` `'cancelled'` |
| E2E | not run locally | CI per the PR (5 green runs, 0 flaky) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-85 | Minor | `tests/unit/ci-workflow.test.ts:175` | Test reliability (DL-057; same class as QLT-80 on PR #92) | "fails when any needed job failed, was cancelled or was skipped" spawns `bash` 12 times in one test; it timed out at the 5 s default in 3 of 3 local Windows runs (8.8 s once). | A flaky unit test on the developers' Windows machines; CI on Linux is unaffected. | Run the combinations once in `beforeAll` (120 s hook limit), or in one `bash` process that loops, as QLT-80 was fixed. |
| QLT-86 | Info | `tests/unit/e2e-shards.test.ts:77` | AC-3 | The check works: planted faults (a spec dropped from shard 2 only, a shard's list narrowed, `setup` missing from a shard) each fail it. A duplicate cannot be planted through `--shard`, but sorted equality and the `Set` checks would show one. It failed once in the first local baseline run and in 2 of 15 probe runs whose fault was elsewhere, then passed 6 times in a row; the cause was not captured. | A possible local flake. | If it recurs, include Playwright's exit status and stderr in the failure, as `one-width-tag.test.ts` does (STD-06). |
| QLT-87 | Info | `.github/workflows/ci.yml:245` | AC-1 and AC-2 (balance) | `--shard` cuts contiguous blocks: shard 1 holds all mobile and 72 tablet tests, shard 2 holds 37 tablet and all desktop tests. Tests took 167 s against 107 s, jobs 283 s against 217 s. | Acceptable now (median 4:45 against 6:00). The gap grows with the suite and recurs with 3 shards. | Compare per-shard test time at the 3-shard step; rebalance (for example the project order) before adding a shard. |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 (nightly median ≤ 6:00, p95 ≤ 7:00) | Read after the merge | The measure is implemented and tested |
| AC-2 (median required path ≤ 6:00, fixed baseline) | **Met: 285 s** | API, as above; stalled before attempt 1 excluded under DL-100 |
| AC-3 (every test once; setup per shard) | Met | 362 = 362; `e2e-shards.test.ts` (faults caught) |
| AC-4 (fan-in gate; no setting change) | Met | 3 negative controls red; workflow tests and the bash fan-in test (faults caught) |
| AC-5 (5 green runs, 0 flaky) | Met per the PR | 42173161146 attempts 1 to 5 |
| AC-6 (security; minutes ≤ 2 times) | Met | `pull_request` only, pinned actions, own database per shard, 12a per shard; 1.36 times (1.56 times billed) |
| AC-7 (measure follows the fan-in; DL-103 line) | Met | Earliest job start to fan-in end; failed or skipped fan-in and re-runs excluded; line pinned (faults caught) |

## Previous Findings (re-review only)
n/a (first quality review of this PR).
