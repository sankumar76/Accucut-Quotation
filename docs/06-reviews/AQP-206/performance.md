# Review Report — AQP-206 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...fix/AQP-206-…` (PR #92, DEF-015: bound and cache the Playwright system packages) |
| Commit reviewed | 71ebe79 (base d5eb4b6; CI run 42151550488 green) |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The fix does what DEF-015 needs, and every figure the developer gave is correct.
- **Cache hit:** the browser's system packages install from the cache with `dpkg -i` in 3 to 6 s, with no apt download (0 `Get:` lines).
- **Cache miss:** apt cuts silent stalls after 20 s with 3 retries. A slow trickle is stopped by the step's 8-minute limit, so the worst case is a visible red job at about 11 minutes instead of a silent 16 minutes.
- **Stage 11b:** unchanged.

Two Minor findings concern how often the miss path will run. The repository's cache store is already over GitHub's 10 GB limit (10.49 GB), so eviction can remove the new entry. A corrupt entry is never re-saved, so it would push every run onto the mirror until the key changes. Once 20 post-merge runs exist, the nightly p95 should read about 8:00 to 8:20, meeting DL-102's 9:00.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff d5eb4b6 71ebe79` | `ci.yml` (versions step, browser key on the Playwright version, new `.deb` cache, Stage 12a with `timeout-minutes: 8`, install removed from Stage 12), new `scripts/ci/playwright-system-deps.sh`, unit tests |
| Step timings | `gh api .../runs/{id}/attempts/{n}/jobs` for 42147037438 (1 to 3), 42150840857, 42151550488 | See table |
| Job logs | `gh api .../actions/jobs/{job}/logs` | Cache restore and save lines, apt `Fetched`/`Get:` lines, dpkg errors, 11b rows, test counts |
| Cache store | `GET /repos/.../actions/cache/usage`, `/actions/caches` | 67 entries, 10,494,586,895 B |
| Local runs | n/a | None |

**Runs (job / 12a / 12, seconds)**

| Run | Head | Job | 12a | 12 | Packages | apt `Get:` | Tests |
|---|---|---|---|---|---|---|---|
| 42147037438 a1 (miss) | 1a635f8 | 380 | 16 | 193 | both keys not found; 21.9 MB at 29 MB/s; 9 packages cached; both entries saved | 25 | 329, 308 passed (3.2 m) |
| a2 (hit) | 1a635f8 | 419 | 3 | 224 | "installed from the cache, with no download"; not re-saved | 0 | 329 |
| a3 (hit) | 1a635f8 | 424 | 3 | 237 | hit | 0 | 329 |
| 42150840857 (control) | 57d9ea0 | 323 | 6 | 171 | `dpkg: error … zzz-corrupt.deb`, warning, fallback install; not re-saved | 18 | 329 |
| 42151550488 (head, hit) | 71ebe79 | 344 | 6 | 175 | hit | 0 | 329 |

- **Comparison:** AQP-199's after-median was 411 / 249 s (12 then included the install) and master d5eb4b6 was 477 / 261 s. 12a + 12 is now 181 to 240 s.
- **Cache sizes:** browsers 293,323,082 B, `.deb` files 21,785,461 B; each restores in 1 to 4 s.
- **11b in all five runs:** `/` 163,294, `/queue` 164,428, `/sign-in` 162,852, not-found 156,332.

**Repository cache store (at review time)**

| Key prefix | Entries | Size | Note |
|---|---|---|---|
| `node-cache` | 19 | about 4.66 GB | setup-node, per lockfile |
| `playwright` | 12 | about 3.10 GB | 10 are the old `playwright-Linux-<lockfile hash>` browser entries (about 2.8 GB), unused after this merge |
| `nextjs` | 36 | about 2.25 GB | per lockfile and source hash, per PR ref |
| Total | 67 | **10.49 GB** | over the 10 GB limit; GitHub evicts least-recently-used |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `.github/workflows/ci.yml:245` | DEF-015; DL-101 evidence | Hit, miss and fallback paths, and the bound | Verified as above. The bound cuts silent stalls (at most about 4 × 20 s per package); a trickling download is stopped only by the 8-minute step, so the job goes red at about 11 minutes and needs a re-run | None |
| PRF-02 | Minor | `.github/workflows/ci.yml:235` | Test strategy 10.6; DL-102 | The repository's cache store is 10.49 GB, over the 10 GB limit. The new key leaves 10 old browser entries (about 2.8 GB) unused | LRU eviction can drop master's `playwright-debs-…` entry in a quiet spell or a PR burst. A miss brings back the mirror exposure | After the merge, delete the old `playwright-Linux-<64 hex>` entries and the `node-cache`/`nextjs` entries of closed PR refs (`gh cache delete`). Optionally a weekly prune, or a coarser `nextjs` key |
| PRF-03 | Minor | `scripts/ci/playwright-system-deps.sh:55` | DEF-015 | After a fallback the good packages are not saved, because `actions/cache` skips the save on a primary-key hit (control log: "Cache hit occurred on the primary key …, not saving cache") | A corrupt or incomplete entry makes every run repeat the bounded apt, with stall risk, until the image or Playwright version changes or the entry is evicted (about a week) | Save under a fresh key after a fallback (`actions/cache/save` with a run-ID suffix and a `restore-keys` prefix), or add a manual `CACHE_EPOCH` to the key |
| PRF-04 | Info | `scripts/ci/playwright-system-deps.sh:37` | DL-102 (p95 ≤ 9:00), test strategy 10.3 | Expected nightly p95 | Clean jobs on current code are 284 to 495 s, and a hit adds 3 to 6 s. Nearest-rank p95 over 20 runs is the 19th value, so one slow run is tolerated. Expected about 8:00 to 8:20 once 20 post-merge runs exist (estimate), about 40 to 60 s under 9:00. Each new E2E story adds about 20 to 90 s | Read DL-102 from the first nightly report whose oldest run is after the merge. The shard step stays the lever for growth. The nightly workflow's install (#93) does not affect the measure |

## Reviewer-specific tables
**Performance: NFR impact**

| Target | Risk | Findings |
|-----|------|----------|
| CI p95 ≤ 9:00 (DL-102); ≤ 10:00 (NFR-009 row) | Low once about 20 post-merge runs exist, provided the caches stay resident | PRF-01 to PRF-04 |
| NFR-009 first-load JS | None | PRF-01 |

**RISK-023.** This fix removes the stall tail that set the p95 (15:05). What remains is CPU-bound test time in the median, which is the shard step's job, and cache residency (PRF-02 and PRF-03).

## Previous Findings (re-review only)
n/a (first round).
