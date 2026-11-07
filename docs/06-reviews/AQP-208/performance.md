# Review Report — AQP-208 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...` (PR #96, STORY-10.15, CI shard step) |
| Commit reviewed | 9c725e1 (base 93d3b8f); developer notes in Jira 11066 |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The shard step works.
- **Required path:** from the first job's start to the end of the fan-in `Stages 1 to 11`, it goes from a median of 503 s to **285 s (−43 %)**.
- **Spread:** the five "after" runs take 238 to 291 s.
- **Runner minutes:** 1.21 to 1.43 × raw and 1.33 to 1.56 × billed, inside the 2× guard.
- **Developer's figures:** all verified. The per-job line mixes two attempts, which is immaterial.

**Shard balance:** shard 1's tests run 132 to 173 s and shard 2's 100 to 144 s, because `--shard` splits by test count, not duration. A perfect balance would save only about 15 s at the median, so it is not worth doing now.

**Caches:** two shards restoring the same keys at once is safe, and a duplicate save is a harmless notice. But on a 12a miss *both* shards go to the apt mirror. Because a PR run's saves are visible to that PR only, every PR run after a runner-image change misses until a master push saves the key. That is a Minor finding, and it shapes #99: warming the key on master, for example from the nightly workflow, removes almost all misses.

**Post-merge nightly estimate:** median about 4:10 to 4:45 and p95 about 5:00 to 5:40, against DL-102's 6:00 and 7:00. Both are met once 20 sharded runs fill the window.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 93d3b8f 9c725e1` | `verify` renamed `Stages 1 to 11b`; new `e2e` matrix `shard: [1, 2]` (no `needs`; own Postgres, `npm ci`, build, migrate, 12a, `playwright test --shard=i/N`); fan-in `required` named `Stages 1 to 11` (`needs: [verify, e2e]`, `if: always()`, fails unless every result is `success`); `ci-feedback-time.ts` measures from the earliest job start to the fan-in end |
| Run timings | `gh api .../runs/{id}/attempts/{n}/jobs` for 42166426901 (1 to 4) and 42173161146 (1 to 5) | See tables |
| Issue #99 | `gh issue view 99` | Read |

**Required path (first job start → fan-in end; queue wait about 3 s per job, excluded)**

| Run | Attempt | Path | Raw minutes | Billed minutes | Note |
|---|---|---|---|---|---|
| 42166426901 (before, 84f5d11) | 1 | 703 s | 11.7 | 12 | 12a timed out after 8 min (492 s), red; repeated |
| | 2 | 507 s | 8.4 | 9 | 12a 4 s, 12 288 s |
| | 3 | 499 s | 8.3 | 9 | 12a 6 s, 12 286 s |
| | 4 | 503 s | 8.4 | 9 | 12a 3 s, 12 294 s |
| **Before median (2 to 4)** | | **503 s (8:23)** | 8.4 | 9 | |
| 42173161146 (after, 9c725e1) | 1 | 291 s | 11.4 | 14 | |
| | 2 | 238 s | 10.5 | 13 | |
| | 3 | 285 s | 12.0 | 14 | |
| | 4 | 244 s | 10.2 | 12 | |
| | 5 | 252 s | 10.4 | 13 | |
| **After median (1 to 3)** | | **285 s (4:45)**, −43 % | 11.4 (1.36×) | 14 (1.56×) | over all five: 252 s |

**Per job, after (seconds)**

| Attempt | `Stages 1 to 11b` | Shard 1 job (E2E step) | Shard 2 job (E2E step) | Fan-in |
|---|---|---|---|---|
| 1 | 181 | 283 (168) | 217 (107) | 4 |
| 2 | 208 | 232 (134) | 189 (100) | 3 |
| 3 | 176 | 278 (173) | 263 (144) | 3 |
| 4 | 153 | 238 (138) | 218 (109) | 2 |
| 5 | 149 | 229 (132) | 245 (140) | 3 |

The developer's "11b 181 / shard 1 278 / shard 2 217 / fan-in 3" takes shard 1 from attempt 3 and the rest from attempt 1. The difference is immaterial. In every attempt a shard job is the critical path; `verify` (149 to 208 s) is never longest.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `.github/workflows/ci.yml:378` | AQP-208 ACs; DL-102 | Figures and the fan-in | Verified as above: −43 % path, minutes 1.36× raw and 1.56× billed (≤ 2×). The fan-in fails on any non-success result, so a skipped or failed shard cannot pass. The measure (`ci-feedback-time.ts:119`) takes the earliest job start, so single-job and sharded runs compare alike | None |
| PRF-02 | Info | `.github/workflows/ci.yml:368` | Test strategy 10.5 | Shard imbalance: the E2E step is 132 to 173 s on shard 1 and 100 to 144 s on shard 2. With `fullyParallel`, `--shard` divides tests by count in file order, not by duration, and the heavier sign-in and users specs cluster in shard 1 | A perfect split would save about 4 to 30 s a run, about 15 s at the median (about 5 %), estimate | Not worth a change now. If the path grows, a third shard (one constant) gives more than any reordering |
| PRF-03 | Minor | `.github/workflows/ci.yml:322` (the key itself is line 345, unchanged in the diff) | DEF-015 / test strategy 10.6; DL-102 | Both shards use the same cache keys. Concurrent restores are safe and a duplicate save is a harmless notice. But on a 12a miss **both** shards hit apt, and a PR run's save is visible to that PR only. So after every runner-image change, every PR run misses, twice over, until a master **push** run saves the new key | Each image change exposes several PR runs to the slow-mirror case (#99, up to 8 minutes and red). Two such runs in one 20-run window would break the nearest-rank p95 | Feed #99: warm the keys on master daily. The nightly workflow runs on master's schedule, so a bounded 12a step there saves the browser and `.deb` entries for every branch, and PR misses become rare. Decision for the architect; not required in this PR |
| PRF-04 | Info | `scripts/lib/ci-feedback-time.ts:119` | DL-102 (median ≤ 6:00, p95 ≤ 7:00) | Expected nightly figures | Sharded clean paths are 238 to 291 s. Once 20 such runs fill the window: median about 4:10 to 4:45, p95 about 5:00 to 5:40 (nearest-rank tolerates one slow run), meeting 6:00 and 7:00. Until then the window mixes in single-job runs of about 6:20 to 8:30 | Read DL-102 from the first report whose oldest run is sharded |

## Reviewer-specific tables
**Performance: NFR impact**

| Target | Risk | Findings |
|-----|------|----------|
| CI median ≤ 6:00, p95 ≤ 7:00 (DL-102); NFR-009 row ≤ 10:00 | Low once 20 sharded runs exist; the residual risk is image-change misses | PRF-01, PRF-03, PRF-04 |
| Runner minutes ≤ 2× (AC-6 analogue) | Low: 1.33 to 1.56× billed | PRF-01 |
| Product NFRs | None: no `src/` change | n/a |

**On #99.** The issue is right that `Acquire::http::Timeout` and `Retries` do not catch a slow but live transfer. Only the 8-minute step bound does. Two cheaper levers exist:
- **Make misses rare:** warm the master keys from the nightly run (PRF-03).
- **Cap a miss lower:** add a stall floor, such as `Acquire::http::Low-Speed-Limit` / `Low-Speed-Time`, if the runner's apt version supports them. Otherwise wrap the download in `timeout`.

The first removes nearly all exposure for no extra minutes on PRs.

**RISK-023.** With the shard step the path is about 4:45 against a 6:00 and 7:00 target. The remaining tail is the image-change miss (#99, PRF-03).

## Previous Findings (re-review only)
n/a (first round).
