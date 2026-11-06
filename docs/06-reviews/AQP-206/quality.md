# Review Report: AQP-206 (DEF-015), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...fix/AQP-206` (PR #92) |
| Commit reviewed | 71ebe79625131ef27758c66f1c2c8dfe4e163506 (tree equals 1a635f8; 57d9ea0 is the reverted negative control) |
| Date | 2026-11-06 |
| Reviewed against | DEF-015 (Jira AQP-206); architect's approach (AQP-199 comment 10992; test strategy §10.6); product-manager placement (10995); master's G7 evidence (DL-101); developer 11036 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
**Stage 12a now installs the browser's system packages from a cache.** The cache is keyed by runner image and Playwright version:
- a hit uses `dpkg -i` with no network;
- a miss, or a failed hit, runs a bounded apt (20 s timeout, 3 retries) inside an 8-minute step, and caches only what it downloaded.

The browser cache is keyed on the Playwright version. Stage 12 runs only the tests.

**The evidence matches the logs and the API:** 12a took 16 s on a miss and 3 s on a hit. The negative control (a corrupt `.deb`) printed the warning, fell back and stayed green. The tests run the real script against fake programs and catch 13 of 15 planted faults.

**Two Minor findings:**
- the "outage is red" test does not depend on `set -e` (QLT-79);
- the spawn-heavy script test timed out once in four local Windows runs (QLT-80).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-92` (5 files); `nightly.yml`; issue #93 | see Findings |
| Unit tests (a `git archive` copy of 71ebe79) | `npx vitest run tests/unit/playwright-system-deps.test.ts tests/unit/ci-workflow.test.ts` | 27 of 27 passed in 3 of 4 runs; 1 run failed "a miss bounds apt…" at 6.3 s, over the 5 s default (QLT-80) |
| Planted-fault probe (`--testTimeout=30000`, so timing does not mask a result) | 10 edits to the script and 5 to `ci.yml` | 13 caught. Survived: `set -e` removed (QLT-79), `dpkg --configure -a` removed (not modelled by the fakes; covered by the negative-control run) |
| Evidence | Actions API (step durations) and `gh run view --log` for 42147037438, 42150840857 and 42151550488 | Miss: 12a 16 s. Hits: 12a 3 s ("installed from the cache, with no download"). Negative control: `dpkg: error … zzz-corrupt.deb`, the warning, a bounded install, green, 12a 6 s. Final head: 12a 6 s, stage 12 175 s, job 344 s |
| Overlap with PR #87 | read both diffs of `tests/unit/one-width-tag.test.ts` (a test merge was not permitted here) | Hunks in different places; nearest pair one unchanged line apart; no semantic conflict (QLT-83) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-79 | Minor | `tests/unit/playwright-system-deps.test.ts:124` | Test adequacy (DEF-015: a real outage must be red) | The fake `npx` fails every call, including the final browser install, so the script fails even without `set -e`. Removing errexit passes all 27 tests. | Without `-e`, an apt failure after the retries would end stage 12a green with system libraries missing; the failure would appear later, in stage 12, or not at all. | Fail the fake only for `install-deps`, and assert the browser install was not reached. |
| QLT-80 | Minor | `tests/unit/playwright-system-deps.test.ts:90` | Test reliability (DL-057) | Each case spawns bash and three or four fakes; on Windows (Git Bash) cases took 1.3 to 6.3 s, and 1 of 4 local runs timed out at the 5 s default. | A flaky unit test on the developers' Windows machines; CI on Linux is unaffected. | Fewer processes (fakes made once in `beforeAll`), or a per-file timeout if the DL-057 rule owner allows it. |
| QLT-81 | Info | `.github/workflows/ci.yml:242` | Developer's open risk | Bad entry: the fallback (bounded) runs on every run until `ImageVersion` or the Playwright version changes. An entry in use is never evicted, and a `master` entry (`ci.yml` also runs on `push` to `master`) is restored by every PR. | Time on every run, never red. | **Acceptable, no salt:** `gh cache delete <key>` (or Actions → Caches) replaces it in one command. Print the key and the command in the fallback warning; note it in the workflow comment. |
| QLT-82 | Info | issue #93, `nightly.yml:138` | Scope | The nightly workflow still runs the unbounded `--with-deps`. | None for the required job or the CI-time measure (which reads `Stages 1 to 11` of `ci.yml`). | Agreed out of DEF-015's scope; the follow-up should reuse the script and the two cache steps. |
| QLT-83 | Info | `tests/unit/one-width-tag.test.ts:152` | Merge order | PR #87 changes the header, `RULED_FILES`, `ONE_WIDTH_TESTS` and the "22 → 34" test two lines after this PR's `}, LIST_TIMEOUT_MS);`. | A textual merge is likely clean; there is no semantic conflict. | Whichever PR merges second updates from `master` and re-runs the test. |
| QLT-84 | Info | `scripts/ci/playwright-system-deps.sh:44` | Correctness (edge case) | The cache holds only packages downloaded in the miss run. A package installed then from a `.deb` already in the image's apt archive would be absent, and `dpkg -i` on a hit would still succeed. "Cached 0 system packages" in the negative control is expected (the good cached packages were installed by the partial `dpkg -i`). | Small: runner images ship an empty apt archive, and the key includes the image version. | Optional: after a hit, `npx playwright install-deps --dry-run chromium`, and fall back if anything is listed. |

## Reviewer-specific tables
**Quality: requested checks**

| Check | Result |
|-------|--------|
| Hit: `dpkg -i`, no network | Correct; shown in the logs of 42147037438 attempts 2 and 3 |
| Miss: bounded apt, then cache only the new `.deb` files | Correct; 12a 16 s on the miss attempt |
| Fallback when a cached `.deb` fails | Correct; negative control 42150840857 (warning, fallback, green) |
| Cache key: runner image + Playwright version | `playwright-debs-${ImageOS}-${ImageVersion}-<version>`; the browser cache uses `<os>-<version>` |
| Bounds: 20 s timeout, 3 retries, 8-minute step | Present and pinned by tests (probe: 120 s timeout, no bounds file and a 30-minute step are each caught) |
| Do the tests fail when the behaviour breaks? | 13 of 15 caught (QLT-79) |
| Immutable key | Acceptable; manual delete plus weekly rotation (QLT-81) |
| #93 nightly | Out of scope, agreed (QLT-82) |
| Overlap with PR #87 | No conflict expected (QLT-83) |

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: re-review of 71ebe79..a330eb0 (DL-091)

| Field | Value |
|-------|-------|
| Commit reviewed | a330eb071c9fb162f071add3660ba8711020dc40; its tree equals 762f1ea (checked with `git diff --quiet`), and the two temporary negative-control commits are reverted |
| Scope | My own items QLT-79, QLT-80 and QLT-81; Jira 11047; PR comment 6676728434 |
| CI | 42160587281 green |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 0 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-79 | Minor | **Fixed** | The fake `npx` fails only `install-deps`, and the test asserts that the browser install is not reached. Planted `set -euo` → `set -uo`: exactly one test fails, "QLT-79: … the step fails and the browser install is not reached" (1 failed, 30 passed with `ci-workflow.test.ts`) |
| QLT-80 | Minor | **Fixed** | The scenarios run once in `beforeAll` (120 s hook limit), and the tests read the outcomes. Four local Windows runs: 8 of 8 passed each time, in 20.1, 7.9, 6.9 and 5.2 s |
| QLT-81 | Info | **Fixed** | The warning names `cache key <key>` and `gh cache delete <key>`, or "raise CACHE_EPOCH in ci.yml". `CACHE_EPOCH: '1'` is part of the key (`playwright-debs-e<epoch>-<image>-<version>`). The README "Playwright install cache" section covers both routes (delete by a maintainer, or raise the epoch in a reviewed PR) and the ref scoping. Planted faults: a warning without the key fails the QLT-81 test; a key without the epoch fails the workflow test |
| QLT-82, QLT-83, QLT-84 | Info | Unchanged | Not in scope for this round |

**Spot check of 762f1ea:** the temporary list is cleaned up on every exit (`trap … EXIT`; STD-04 test), and the workflow comments are corrected on cache scoping. No issue found.
