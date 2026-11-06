# Review Report — AQP-199 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-199-ci-time` (PR #86, STORY-10.14) |
| Commit reviewed | 03ad852 (base d8cb223); reviewed against the restated ACs (Jira 11006: AC-2 stage 12 at least 15 % shorter, the 5:00 check withdrawn) |
| Date | 2026-11-05 |
| **Verdict** | REQUEST CHANGES (AC-2 evidence only; code approved) |

## Summary
The CI changes are correct and cheap: 4 workers in CI, a warm-up of `/`, `/queue` and `/design-system`, `@one-width` on 22 tests in the four ruled files, and the 9-minute line with the run report. Every figure in the developer's comment 11003 matches the GitHub API and the job logs.

The stage 12 "−20 %" is not robust, though. The "before" median includes attempt 3, which stalled 9.5 minutes in apt, while the "after" stalls (attempts 4 and 5) were excluded and repeated, as DL-100 requires. With stalls excluded on both sides, stage 12 falls by 13.7 %. The install-free test run falls by 7 %, or about 10 % allowing for the 12 tests #85 added. Both are under the restated 15 %. One more "before" attempt gives a clean median.

The logs also show the runner is already CPU-bound at 2 workers: 4 workers do not raise throughput, and the gain comes from the one-width tag. I agree 3 workers would not help; more CPU through the shard step would. Runner minutes are at or below before (AC-6). The warm-up costs about 1.3 s per run, and the nightly step adds no measurable cost.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 0 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff d8cb223 03ad852` | `ci.yml` (runner-size echo, comment), `playwright.config.ts` (workers `IN_CI ? 4 : 2`, `grepInvert` on mobile and tablet), `auth.setup.ts` (warm-up loop), four specs tagged, `ci-feedback-time.ts` and `check-ci-time.ts` (9-minute line, oldest and newest run), unit tests |
| Run and attempt timings | `gh api .../actions/runs/{id}/attempts/{n}/jobs` for 42061753504 (1 to 3) and 42070716328 (1 to 7) | See the table |
| Stage 12 split | `gh api .../actions/jobs/{job}/logs`: time of `playwright install`, `Running N tests using W workers`, `N passed (x m)`, `flaky`, the `[setup]` test time | See the table |
| Runner | Job log, `echo "Runner: …"` | 4 vCPU, 15,987 MB |
| Jira | Comments 10968, 10976, 10985, 11003, 11004, 11006 | Restated ACs applied |
| Local runs | n/a | None |

**Evidence (seconds unless marked)**

| Attempt | Job | Stage 12 | Install (apt) | Test run | Tests, workers | Set-up | Flaky |
|---|---|---|---|---|---|---|---|
| before 1 | 468 | 313 | about 20 | 5.0 m | 361, 2 | 7.6 s | 0 |
| before 2 | 396 | 264 | about 17 | 4.2 m | 361, 2 | 5.8 s | 0 |
| before 3 (stall) | 992 | 842 | about 591 | 4.3 m | 361, 2 | 5.9 s | 0 |
| after 1 | 413 | 249 | about 17 | 4.0 m | 329, 4 | 7.2 s | 0 |
| after 2 | 411 | 254 | about 19 | 4.1 m | 329, 4 | 7.8 s | 0 |
| after 3 | 403 | 245 | about 18 | 3.9 m | 329, 4 | 7.0 s | 0 |
| after 4 / 5 (stall) | 792 / 796 | 635 / 640 | stall | n/a | n/a | n/a | n/a |
| after 6 | 393 | 246 | about 21 | 3.9 m | 329, 4 | 7.0 s | 0 |
| after 7 | 284 | 171 | about 13 | 2.7 m | 329, 4 | 4.3 s | 0 |

**AC-2 under three treatments**

| Basis | Before | After (median of 1 to 3) | Change |
|---|---|---|---|
| As reported (stall counted before only) | 313 s | 249 s | −20 % |
| Stalls excluded on both sides (before = {313, 264}) | 288.5 s | 249 s | −13.7 % |
| Test run only (install excluded) | 258 s (4.3 m) | 240 s (4.0 m) | −7 % (about −10 % allowing for #85's 12 instances) |
| Whole job, stalls excluded | 432 s | 411 s | −5 % |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | **Major** | `.github/workflows/ci.yml:230` | AC-2 (restated: stage 12 at least 15 % shorter, median of three); DL-100 | "Before" counts the stalled attempt 3; "after" excludes its stalls. The "before" median therefore lands on attempt 1, the slowest test run | AC-2 is not robustly shown: 13.7 % with stalls treated alike, 7 to 10 % on the test run alone | Re-run 42061753504 once (attempt 4, same commit), take the median of three stall-free "before" attempts, and report stage 12 split into install and test run. If under 15 %, the product-manager restates or accepts. No code change |
| PRF-02 | Info | `playwright.config.ts:56` | Test strategy 10.5; architect's ruling (11004) | 4 workers on 4 vCPU | Throughput before 1.20 / 1.43 / 1.40 tests per second, after 1.37 / 1.34 / 1.41: no gain over 2 workers; the saving is the tag's instance cut. 3 workers would not help | Keep 4 (0 flaky) or 2; the lever is the shard step (more CPU) |
| PRF-03 | Info | `tests/e2e/auth.setup.ts:14` | Test strategy 10.5 | Warm-up loop of three routes | Set-up project median 5.9 → 7.2 s: about +1.3 s per run | None |
| PRF-04 | Info | `scripts/lib/ci-feedback-time.ts:184` | AC-6, AC-7 | Runner minutes; nightly step reads `head_sha` | Minutes 7, 7, 7, 7, 5 after against 8, 7 (17 stalled) before: AC-6 met. No extra API request in the nightly step | None |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR / target | Risk | Findings |
|-----|------|----------|
| CI feedback time (NFR-009 row; test strategy 10.3) | Medium: the gain is real but modest (job −5 %, stage 12 −7 to −14 %); apt stalls set the p95 (AQP-206), and test time sets the median (shard step) | PRF-01, PRF-02 |
| Runner resource use (AC-6) | None | PRF-04 |
| Product NFRs | None: no `src/` change | n/a |

**RISK-023.** Unchanged in substance. With stalls removed, the job is about 6:51 against about 7:12, and AQP-65 will add about 90 s even with its one-width ruling. The p95 relief comes from AQP-206 and the median relief from the shard step, which the throughput data supports.

## Previous Findings (re-review only)
n/a (first round).

---

# Round 2 — head 3808560 (CI run 42141321692), narrow: PRF-01 and AC-2 (Jira 11022)

| Field | Value |
|-------|-------|
| Review round | 2 |
| Commit reviewed | 3808560 (only `tests/unit/one-width-tag.test.ts` changed since 03ad852) |
| Date | 2026-11-06 |
| **Verdict** | APPROVE |

## Summary (round 2)
The developer ran the fixed "before" commit a fourth time (attempt 4, no stall) and now excludes stalled runs on both sides, a stall being an install step over 120 s. Each side is the median of three clean runs: stage 12 goes from 308 s to 249 s, **−19.2 %**, and the test run alone goes from 5.0 m to 4.0 m, −20 %. I checked every figure against the API and the job log. **The restated AC-2 (at least 15 % shorter) is met.**

My round-1 figure of 288.5 s was the mean of only two clean "before" runs, a stopgap. AC-2 requires the median of three, and the third clean run decides it.

Attempt 4 also corrects PRF-02. At 2 workers the median throughput is 1.20 tests per second, not about 1.4, so 4 workers give about +14 % throughput. The architect's 1.21 → 1.43 is close. The conclusion stands: CPU-bound, 3 workers would not help, and the shard step is the lever.

The head run 42141321692 is the fastest yet: job 332 s, stage 12 184 s, test run 2.9 m, no stall, 0 flaky.

| Severity | Open after round 2 |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 (PRF-02 corrected, PRF-03, PRF-04) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Before attempt 4 | `gh api .../runs/42061753504/attempts/4/jobs`; job log 127638551579 | Head 423fafe (the fixed baseline). Job 509 s; stage 12 00:58:35 → 01:03:43 = **308 s**; install about 18 s; 361 tests, 2 workers; 340 passed (5.0 m); 0 flaky |
| Head run | `gh api .../runs/42141321692/jobs`; job log 127642051651 | 3808560. Job 01:04:35 → 01:10:07 = **332 s**; stage 12 **184 s**; install about 13 s; 329 tests, 4 workers; 308 passed (2.9 m); 0 flaky |
| Change since 03ad852 | `git diff 03ad852 3808560 --stat` | One unit test file; no workflow, config or spec change, so the "after" runs 1 to 3 still stand |

**AC-2, stalls excluded on both sides, median of three**

| | Runs | Stage 12 (s) | Test run (m) |
|---|---|---|---|
| Before | 42061753504 attempts 1, 2, 4 | 313, 264, 308 → **308** | 5.0, 4.2, 5.0 → 5.0 |
| After | 42070716328 attempts 1, 2, 3 | 249, 254, 245 → **249** | 4.0, 4.1, 3.9 → 4.0 |
| Change | n/a | **−19.2 %** (met, at least 15 %) | −20 % |

**Throughput (tests per second of test run):** before 1.20, 1.43, 1.20 (median 1.20); after 1.37, 1.34, 1.41 (median 1.37); +14 %.

## Previous Findings (round 1)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-01 | Major | **Fixed** | Third clean "before" run; the median of three on both sides gives −19.2 %. My 288.5 s was a two-run mean, now superseded. Thread resolved |
| PRF-02 | Info | **Corrected** | 4 workers give about +14 % throughput (not 0 %); CPU-bound conclusion unchanged; thread resolved with the correction |
| PRF-03 | Info | Holds | Warm-up about +1 s (set-up 6.9 s before attempt 4, 4.9 s on the head) |
| PRF-04 | Info | Holds | Runner minutes: head run 6 min |

**RISK-023.** AQP-199 delivers a real cut of about 20 % in stage 12. The p95 still depends on apt stalls (AQP-206, next) and the median on the shard step.
