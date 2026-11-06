# Test Report — AQP-206 (DEF-015): CI stage 12 can stall in `playwright install --with-deps`; the browser's system packages are now cached and bounded (stage 12a)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `a330eb0` on `fix/AQP-206-playwright-deps-cache` (PR #92). Its tree is identical to the fix push `762f1ea` (`be5af21…`); the temporary negative-control commits in between are reverted |
| CI | Run 42160587281 on `a330eb0`: green (system-package cache hit, 308 E2E passed, 0 flaky) |
| Environment | GitHub Actions API and **every run log, read by QA** (not the developer's summary). Locally, only `tests/unit/playwright-system-deps.test.ts` and `ci-workflow.test.ts`, plus one planted fault, in an isolated `git archive` copy of `a330eb0` (no shared worktree, no `git merge`) |
| Date | 2026-11-06 |
| Evidence list | master's G6 closure, Jira AQP-206 comment 11050 |
| **Recommendation** | **ACCEPT** |

## Summary

Stage 12a now installs the browser's system packages from a cache keyed on `CACHE_EPOCH`, the runner image and the Playwright version:
- **On a hit** it uses dpkg with **no download**.
- **On a miss** it runs a bounded apt (20 s stall timeout, 3 retries, an 8-minute step limit) and saves the packages.
- **If a cached entry is bad**, it falls back to apt with a warning that names the key and the exact delete command.

Every item of master's list is met, from QA's own reading of the logs:
- **(a)** CI is green on the final head.
- **(b)** The cold run misses and saves.
- **(c)** Two hits download 0 packages.
- **(d)** The negative control turns the job red, and removing `set -e` fails the QLT-79 test.
- **(e)** The fallback prints the key and the `gh cache delete` command.
- **(f)** Job time and 11b are unchanged.

## Evidence against master's list (11050)

| Item | Run / attempt (commit) | What the log shows (read by QA) | Result |
|---|---|---|---|
| (a) CI green on the final head | 42160587281 a1 (`a330eb0`) | Job `Stages 1 to 11` **success**. System-package cache: "Cache hit for: playwright-debs-e1-ubuntu26-20261101.186.1-1.64.1 … Cache Size: ~21 MB". Stage 12a (3 s): "System packages installed from the cache, with no download.", with **0 apt `Get:` lines**. Post step: "Cache hit occurred on the primary key …, not saving cache.". E2E: 308 passed, 21 skipped | ✅ |
| (b) Cold run on the new key: a miss that saves | 42154546800 **a1** (`762f1ea`, the same tree) | "Cache not found for input keys: playwright-debs-e1-ubuntu26-20261101.186.1-1.64.1". Stage 12a (9 s) ran apt: "Installing dependencies…", "Fetched 4615 kB in 0s", "Fetched 21.9 MB in 1s" (29 `Get:` lines), then "**Cached 9 system packages.**". Post step: "**Cache saved with key: playwright-debs-e1-ubuntu26-20261101.186.1-1.64.1**". E2E 308 passed | ✅ |
| (c) Two hits with 0 apt lines | 42154546800 **a2** and **a3** | Both show "Cache hit for: playwright-debs-e1-…" (~21 MB). Stage 12a took **3 s** each: "System packages installed from the cache, with no download.", with **0 `Get:` / `Hit:` / `Err:` lines**. Post step: "not saving cache" (an immutable key). E2E 308 passed in both | ✅ |
| (d) Negative control turns the job red | 42160257283 a1 (`785e4df`, temporary, reverted) | The key `playwright-debs-e99-…` was a miss, with the apt mirror pointed at 127.0.0.1:9. Log: "W: Failed to fetch … Unable to connect to 127.0.0.1:9", "E: Unable to fetch some archives…", "##[error]Process completed with exit code 1". **Stage 12a failed in 5 s, stage 12 was skipped, and the job `Stages 1 to 11` concluded failure.** No save line was written, so nothing was cached on the failure | ✅ |
| (d) The QLT-79 test fails when `set -e` is removed | Local, `a330eb0` copy | `npx vitest run tests/unit/playwright-system-deps.test.ts` passes 8 of 8. **Plant:** line 22 `set -euo pipefail` → `set -uo pipefail`. Result: **1 failed** of 8, and it is exactly "QLT-79: when only the system-package install fails, the step fails and the browser install is not reached". Restored: 8 of 8 pass. `ci-workflow.test.ts` also passes (31 tests across the two files) | ✅ |
| (e) Fallback prints the key and the `gh cache delete` command | 42159562776 a1 (`85cdf25`, temporary: a planted corrupt `.deb`, reverted) | The cache hit, then dpkg refused the planted file ("dpkg-deb: error: '…/zzz-corrupt.deb' is not a Debian format archive"), followed by: **`##[warning]The cached system packages could not be installed (cache key playwright-debs-e1-ubuntu26-20261101.186.1-1.64.1); falling back to the normal install. The entry stays until it is deleted: a maintainer runs 'gh cache delete playwright-debs-e1-ubuntu26-20261101.186.1-1.64.1', or raises CACHE_EPOCH in ci.yml.`** The bounded apt install then ran ("Installing dependencies…", 19 `Get:` lines), with "Cached 0 system packages." and "not saving cache" (a hit is never re-saved). **The job was green**, with E2E 308 passed | ✅ |
| (f) Job time unchanged | All five PR runs above that ran E2E; master after AQP-199 | **PR runs:** jobs of 365, 378, 445, 377 and 445 s, a **median of 378 s**. Stage 12a + 12: 9+187, 3+205, 3+245, 9+190 and 3+250 s, a **median of 208 s**. **Master with the same 4-worker setup:** 2d208f5, job 396 s, stage 12 (install inside) 217 s; d5eb4b6, job 477 s, stage 12 261 s. So the time is not longer. The developer's round-1 median of 380 s is consistent | ✅ |
| (f) 11b unchanged | Every run above | In every run: `/` 163,294, `/queue` 164,428, `/sign-in` 162,852, not-found 156,332, `/design-system` 404 as required. "all 5 rows are within their limit". Byte for byte the same as before | ✅ |
| (g) Close DEF-015 only after master's posted G7 | — | Pending master's G7 (DL-098) | Pending |

## Workflow review (security and scope)

- **Changes:** the new steps are "Read the Playwright and runner image versions" (pure node and env), "Cache the Playwright system packages" (the same pinned `actions/cache@55cc834…` as stage 9) and "Stage 12a" (`bash scripts/ci/playwright-system-deps.sh`, `timeout-minutes: 8`).
- **Unchanged:** the trigger is still `pull_request` only, permissions are read-only, no secret is used, and the job name `Stages 1 to 11` is unchanged.
- **Comments:** they say caches are scoped by ref, and that shared entries come only from `master` push runs (STD-01).
- **README:** "Playwright install cache" documents both recovery routes: `gh cache delete <key>`, or raising `CACHE_EPOCH`.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Script and workflow unit tests (local) | `npx vitest run tests/unit/playwright-system-deps.test.ts tests/unit/ci-workflow.test.ts` | 31 | 31 | 0 | 0 | under 1 min |
| Full regression (CI, final head) | Run 42160587281 | all stages | ✅ (308 E2E) | 0 | 21 (viewport-specific) | 7 m 25 s |

## Exploratory Testing

**Charter:** decide from the raw logs alone whether a stall can still stretch the required job, and whether a bad cache entry can trap the team. **Time-box:** 30 min.

**Findings:**
- **A stall is bounded.** A miss runs a bounded apt inside an 8-minute step limit. A hit makes no network call, which removes the stall path seen in DEF-015 (where the install took 584 s at 35.9 kB/s).
- **A bad entry cannot trap the team.** It is not re-saved, the warning names it, and the README gives both ways out.

## Defects

None new. **DEF-015** (AQP-206, #88) is fixed and verified, and closes on master's posted G7.

## Residual Risks / Notes

- **The first `master` run after the merge is a miss.** The new `playwright-debs-e1-*` entry exists only under `refs/pull/92/merge` (caches are scoped by ref). That run takes the bounded apt path once and saves the entry for every branch.
- **PR #92 is BEHIND `master`.** Squash-merge only (master, 11050), after an update from `master` and a green CI.
- **Process (master, 11050):** the negative controls were temporary commits on the story branch editing the required workflow. They are fully reverted (identical tree). The next evidence run of that kind belongs on `workflow_dispatch` or a throwaway PR.
- **PRF-02 (cache pruning):** it is the delivery lead's decision. Some stale caches were already deleted with their approval, and PR #92's own entries were kept.
