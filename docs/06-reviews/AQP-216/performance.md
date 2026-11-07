# Review Report — AQP-216 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-216-ci-cache-warm` (PR #100, STORY-10.16) |
| Commit reviewed | 7bda9e0 (base 4c12103; CI run 42204070612 green); evidence on throwaway PR #101 (closed); notes Jira 11107 |
| Date | 2026-11-06 |
| **Verdict** | APPROVE |

## Summary
STORY-10.16 makes three changes:
- **Bounded download:** a cache miss of the Playwright system packages now downloads them with `apt-get install --download-only` under `timeout`: 45 s for update and 90 s for the download per try, up to 3 tries, with `archive.ubuntu.com` as the fallback mirror from try 2.
- **Offline install:** the downloaded packages are then installed without network access.
- **Nightly warm-up:** a nightly job on `ubuntu-latest` saves the CI keys in master's scope, so pull requests rarely miss.

Every figure the developer gave is verified. The natural stall in run 42205780147 shows the change working: try 1 was cut at 90 s, and try 2 finished from the fallback mirror in 118 s in all. The warm-up costs about 1 minute a night. Storage grows by about 40 MB per runner image against a store now at 5.1 GB.

Once the window holds 20 sharded runs, the nightly p95 should read about 5:00 to 5:40. The failing "CI feedback time" job was window lag only, and it already passes (median 4:51 on 9 runs). Only its non-failing 9-minute notice remains, until 20 qualifying runs exist.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 4c12103 7bda9e0` | `scripts/ci/playwright-system-deps.sh` (bounded tries, fallback mirror, offline install), new `playwright-deps-packages.sh` (dry-run parser with a package-name check), `nightly.yml` (`warm-playwright-cache` job; Lighthouse job uses the same 12a script and keys), tests |
| Runs | `gh api .../runs/{id}/jobs` for PR #100 (42204070612 CI, 42204070575 Nightly) and PR #101 (8604a34, 0473a28, 1d96791, 209335b, 03874b8; CI and Nightly each) | See table |
| Logs | `gh api .../actions/jobs/{id}/logs` for the stall, the all-unreachable control and two CI-time jobs | Try lines and reports quoted below |
| Cache store | `GET /actions/cache/usage`, `/actions/caches?key=playwright` | 5,091 MB, 36 entries |
| Local runs | n/a | None |

**Stage 12a per shard**

| Case | Run (head) | Shard 1 | Shard 2 | Evidence |
|---|---|---|---|---|
| This PR, hit | 42204070612 (7bda9e0) | 4 s | 3 s | n/a |
| Forced miss | 42204272850 (8604a34) | 19 s | 13 s | downloaded, cached |
| Hit | 42204925707 (0473a28) | 3 s | 3 s | from the cache |
| Natural stall | 42205780147 (1d96791) | 19 s | **118 s** | try 1: update 4 s, "The download reached its 90 s limit after 90 s"; try 2 (archive.ubuntu.com): update 14 s, download 1 s, 9 packages cached |
| First mirror unreachable | 42206740125 (209335b) | 35 s | 55 s | recovered on the fallback |
| All mirrors unreachable | 42207530048 (03874b8) | 63 s, failed | 53 s, failed | 3 tries, each "download failed with status 100 after 0 s" |

Warm-up job runs: 58, 69, 79, 82, 71 s (all green, 12a on a hit 3 to 4 s). The Lighthouse job's 12a was 3 to 17 s on a hit and 71 s on a miss.

**"CI feedback time" reports (nightly workflow on these PRs)**

| Run (time) | Runs used | Oldest run | Median | p95 | Job |
|---|---|---|---|---|---|
| 42204070575 (10:37) | 13 | 42159682199 (pre-shard, 03:58) | 7:25 | 9:34 | failed (median over 6:00) |
| 42207529855 (11:05) | 9 | 42173161146 (first sharded run) | 4:51 | 9:34 | passed; 9-minute notice only |

## Findings
| ID | Severity | File:line | Rule / NFR | Issue | Impact | Suggested fix |
|----|----------|-----------|------------|-------|--------|---------------|
| PRF-01 | Info | `scripts/ci/playwright-system-deps.sh:46` | DEF-015; #99; test strategy 10.6 | Bounded download-only tries with a fallback mirror | Verified as above. Worst case 3 × (45 + 90) s = 6.75 min, inside the step's 8 minutes. A slow live stream is now cut at 90 s, which `Acquire::http::Timeout` could not do. The 90 s cap needs about 245 kB/s for the 21.9 MB set; below that try 1 is lost and try 2 recovers | None |
| PRF-02 | Info | `.github/workflows/nightly.yml:265` | Resource use | Nightly warm-up job; per-image keys | About 1 to 2 billed minutes a night. Store 5,091 MB in 36 entries; about +40 MB per runner-image change (one CI `ubuntu26` and one Lighthouse `ubuntu24` `.deb` entry); old image keys expire after 7 days unused. The log's mirror name is generic ("the mirror of the runner image") because the runner uses a `mirror+file:` list | Delivery lead: delete PR #101's entries (`gh cache delete --all --ref refs/pull/101/merge`, about 80 MB) and master's `playwright-Linux-665576d2…` (279 MB, AQP-206 list row 4) |
| PRF-03 | Info | `scripts/ci/playwright-system-deps.sh:48` | DL-102 (median ≤ 6:00, p95 ≤ 7:00); RISK-023 | Expected nightly figures | Misses happen only between an image change and the next 01:17 UTC nightly, and cost 13 to 19 s (about 2 min with a stalled first mirror). Sharded clean paths are 238 to 291 s, so median about 4:15 to 4:50 and p95 about 5:00 to 5:40 (estimate) once the window holds 20 sharded runs | Recommend master lowers RISK-023 (8 → about 4) after the first full sharded window |

## On the "CI feedback time" failures (question from the coordinator)
- **Window lag only.** The failure on 7bda9e0 came from pre-shard runs in the window (median 7:25 over 13 runs).
- **Already cleared.** By 11:05 the window started at the first sharded run, the median was 4:51, and the job passed.
- **What remains.** The non-failing "p95 over 9 minutes" notice comes from one 9:34 run (42179402882, AQP-74 before it took the shards). With fewer than 20 runs, the nearest-rank p95 is the maximum. It clears when 20 qualifying runs exist, about 11 more successful first-attempt PR runs, after which that run is only the 20th value. Failed or throwaway runs do not count, which is why the window is short now.

## Reviewer-specific tables
**Performance: NFR impact**

| Target | Risk | Findings |
|-----|------|----------|
| CI median ≤ 6:00, p95 ≤ 7:00 (DL-102); NFR-009 row | Low | PRF-01, PRF-03 |
| Runner minutes and cache storage | Low | PRF-02 |
| Product NFRs | None: no `src/` change | n/a |

**RISK-023.** Slow test time is addressed by the shards (AQP-208). Install stalls are addressed by the cache (AQP-206), and now by the bound and the warm-up (this PR). The residual risk is a full mirror outage (a red run at about 1 minute, retried) and E2E growth over time.

## Previous Findings (re-review only)
n/a (first round).
