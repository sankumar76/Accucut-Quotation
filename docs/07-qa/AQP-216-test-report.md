# Test Report — AQP-216 (STORY-10.16): CI cache warm-up on `master` and a bounded stage 12a download (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `ebd83be` on `feat/AQP-216-ci-cache-warm` (PR #100) |
| CI | CI run 42234917024 and Nightly run 42234917054 on `ebd83be`: both green |
| Environment | **GitHub Actions API and job logs only, read by QA.** No local build, Docker or test run, because the disk was critical (about 200 MB to 2 GB free on C:) |
| Date | 2026-11-06 |
| Evidence list | master's G6 11114 and closure 11123 (DL-105) |
| **Recommendation** | **ACCEPT** |

## Summary

Master's evidence items (a) to (d) and (f) are met from QA's own reading of the logs:
- **(a) Save, then hit.** A miss downloads with bounded times and the key is saved; the next run hits in both shards with no download.
- **(b) Dead mirror.** Try 1's update fails with status 100 at 16 to 17 s, and try 2 on archive.ubuntu.com completes within 4 minutes.
- **(c) Planted faults.** Each is caught by the intended tests.
- **(d) Regression.** Green on the head.
- **(f) Throwaway PRs.** All evidence ran on closed, unmerged PRs (#101, #105), and the story branch holds no evidence commit.

**(e)**, the `master`-scope proof, is recorded after the merge and does not hold Done.

## Evidence against master's list

| Item | Run(s) | What the logs show (read by QA) | Result |
|---|---|---|---|
| (a) Save | CI 42230394633 (`a95b6b2`, throwaway #105) with Nightly 42230394560 (same commit) | **Both CI shards** report "Cache not found for input keys: playwright-debs-e6-ubuntu26-20261101.186.1-1.64.1", then "Try 1 of 3, mirror mirror+file:/etc/apt/apt-mirrors.txt.", "apt-get update took 6 s" / "5 s", "The download took 3 s" / "5 s", "Cached 9 system packages." Stage 12a took 20 s and 21 s (bound 90 s). Both shards' post step: "Failed to save: Unable to reserve cache … another job may be creating this cache". **The same key was saved by the Nightly warm-up job of the same commit:** "Cache saved with key: playwright-debs-e6-ubuntu26-20261101.186.1-1.64.1" (cache created 14:05:42 under `refs/pull/105/merge`). One saver per key, the others harmless, as designed. E2E 181 + 164 passed | ✅ |
| (a) Then hit | CI 42231271036 (`1345f23`) | **Both shards:** "Cache hit for: playwright-debs-e6-…", "**System packages installed from the cache, with no download.**", "not saving cache". Stage 12a took **6 s and 3 s**, with 0 apt `Get:` lines. E2E 181 + 164 passed, and the run is green | ✅ |
| (b) Dead-mirror control | CI 42232188426 (`340faa4`, epoch 7) and 42233000524 (`8370352`, epoch 8) | **Every shard that missed** (shard 1 of the first run; both shards of the second) shows "Try 1 of 3, mirror mirror+file:…", "Could not connect to 192.0.2.1:80 … connection timed out", "E: Failed to fetch http://192.0.2.1/…", "**apt-get update failed with status 100 after 16 s / 17 s / 17 s; ending this try.**", then "**Try 2 of 3, mirror archive.ubuntu.com.**", with `Get:` lines from archive.ubuntu.com only. **No download from the dead mirror.** Stage 12a took **40 s, 54 s and 43 s**, within the 4-minute bound, and the shards were green. In the first run, shard 2 hit the e7 key and so did not exercise the control. The two runs are red only at stage 6, by design: the control edits `ci.yml`'s epoch and mirror alone, and `nightly-workflow.test.ts` ("uses the same four steps as CI, word for word"; "keeps CACHE_EPOCH equal to the one in ci.yml") catches that divergence | ✅ |
| (c) Planted fault 1: the fallback rewrite removed | CI 42233860764 (`44553be`) | Stage 6: **6 failed of 2071, all in `tests/unit/playwright-system-deps.test.ts`**, including "QLT-95 (4) / QLT-93: the view of each try names only that try's mirror and keeps Signed-By…", "AC-4 / QLT-95 (2): a failed apt-get update ends the try at once … try 2 uses …", and "AC-5 / QLT-95 (6): … three tries, no download at all…" | ✅ |
| (c) Planted fault 2: update limit 45 s → 60 s | CI 42234600018 (`034d179`) | Stage 6: **exactly 1 failed** of 2071, `tests/unit/ci-workflow.test.ts` "DEF-015 (AQP-206): the script bounds apt on a miss…". This is the test that now reads the limits from the script and the workflow (STD-02) | ✅ |
| (d) Regression | CI 42234917024 and Nightly 42234917054 (`ebd83be`) | **CI:** all four jobs succeeded. Stage 6 had 2071 of 2071 passed and stage 11 2864 of 2864; both shards hit `playwright-debs-e1-…` with no download; E2E 181 + 164 passed, 0 failed; required path 293 s. **11b:** `/` 163,566, `/queue` 164,700, `/sign-in` 163,287, `/users` 170,916, not-found 156,598; all 6 rows within the limit. **Nightly:** "Warm the Playwright cache" hit "playwright-debs-e1-…" with no download; Lighthouse and CI feedback time succeeded | ✅ |
| (e) `master`-scope proof | After the merge | The first nightly warm-up on `master` saves (or hits) the key for the image, and the next PR run restores from the `master` key with no download. **Recorded by QA after the merge; it does not hold Done. If it fails, QA raises a Sev-3 defect** | Pending (after the merge) |
| (f) Evidence only on throwaway PRs | PR list and story branch commits | **#101** (`throwaway/AQP-216-evidence`) and **#105** (`throwaway/AQP-216-g6-evidence`) are both **closed, not merged**. **PR #100's commits** are `0bc177a`, `7bda9e0`, `ab1d6a2` and `ebd83be`, all `feat(ci)` / `fix(ci)` work: **no throwaway, control or planted-fault commit**. Merge state CLEAN | ✅ |

## Automated Test Results

| Suite | Where | Total | Passed | Failed | Notes |
|-------|-------|-------|--------|--------|-------|
| Unit (stage 6) | CI 42234917024 | 2071 | 2071 | 0 | final head |
| Integration and the rest (stage 11) | CI 42234917024 | 2864 | 2864 | 0 | final head |
| E2E, two shards | CI 42234917024 | 345 run | 345 | 0 | 21 skipped (viewport-specific) |
| Planted faults | CI 42233860764 / 42234600018 | — | — | 6 / 1 | as intended |

No local test run (disk critical; master's instruction).

## Exploratory Testing

**Charter:** from the logs alone, check whether a dead or slow mirror can still stall stage 12a, whether a bad key can be saved, and whether the runner's own apt sources are touched. **Time-box:** 40 min.

**Findings:**
- **A dead mirror is bounded:** it ends try 1 at the update step (status 100, 16 to 17 s), with no download from it.
- **A hit makes no network call.**
- **Saving is single-winner:** concurrent saves of one key lose the reservation harmlessly.
- **The runner's sources are untouched:** each try runs against its own temporary apt view (QLT-93 / QLT-95, verified at G6 by reviewer-quality on the script; the logs show only the try's mirror being fetched).

## Defects

None.

## Residual Risks / Notes

- **(e) is pending.** The `master`-scope proof is the next step after the merge.
- **RISK-023** is lowered after the first full sharded window (master, 11114).
- **Image-roll misses:** a runner-image change still gives one bounded miss per image until the nightly warm-up on `master` saves its key.
- **Gitleaks:** this report is pushed as a single commit after `gitleaks` exits 0 (DL-108).
