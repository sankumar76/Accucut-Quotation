# Test Report — AQP-236 (DEF-022): each `playwright test --list` gets its own cache folder

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `5ebe3b2` on `fix/AQP-236-list-cache-race` (PR #220, `sankumar76/Accucut-Quotation`; base `1d37902`, `master` now `225a1c9`). This report and its evidence folder are the only files QA adds (docs only; nothing under `src/` or `tests/` was changed by QA) |
| CI | Run 42978771784 on `5ebe3b2`: attempts 1 to 5 all success (5 jobs each). Read again on the report commit: see "CI" below |
| Environment | Windows 11 Pro, Node v24.19.0 (CI uses Node 22), Playwright 1.64.1, Vitest 5.0.5, `npm ci` in an isolated QA worktree at `5ebe3b2`. Nothing else heavy ran during the counted loops (checked for stray processes before each). Not a shared environment; no database used |
| Date | 2026-11-11 |
| Route | Master's G7 route, DL-146 (3), on the DL-120 narrow route. DEF-022 has no ACs; the bar is DL-120 and DL-146 (3) |
| **Recommendation** | **ACCEPT.** Every item of DL-146 (3) passes: the #221 plant fails the four named tests alone and beside the four listing files; both cold loops are 10 of 10 with the same test count every run and no folder left behind; the baseline on `master`'s helper fails 9 of 10, so the loop can see the race and the fix removes it. No new defect. Open defects: Sev-1 0, Sev-2 0, Sev-3 0 new (DEF-022 itself is fixed by this PR), Sev-4 0 |

## Summary

The change does what DL-120 asked: each `listPlaywrightSuites()` call runs Playwright with its own `mkdtemp` cache folder and removes it in `finally`, with no order, lock, retry, skip or longer limit (DL-057). On the same Windows host, with a new empty `PWTEST_CACHE_DIR` for every run, `master`'s helper failed the union test (and once also an `EPERM` on a shared `.map`) in **9 of 10** cold runs of the eight listing-related files; the head passed **10 of 10** on the DL-120 pair and **10 of 10** on a nine-file set, 16 of 16 and 113 of 113 tests every time. The independent #221 plant makes the four named unit tests fail every time, alone and beside the listing files, and even brings back the DEF-022 signature in the union test.

Because the baseline failed (not 0 of 10), the two-listing Node probe that DL-146 (3)(d) keeps for a zero baseline was not needed, and it was not run.

## AC Verification Matrix

DEF-022 has no ACs. The checks are the items of DL-146 (3) and the DL-120 / AQP-236 bar.

| Item | Test ID(s) | Technique | Result | Evidence |
|------|-----------|-----------|--------|----------|
| (a) Head under test is condition A's; QA adds only the report | `git rev-parse HEAD` = `5ebe3b237420925c5667919bfbc3f20bf3b1cedb`; `git diff origin/master...HEAD --stat` = 3 files under `tests/` (213 insertions, 16 deletions) | Inspection | ✅ Pass | Nothing under `src/`, config, CI or dependencies. This report adds only `docs/07-qa/` files |
| (b) #221 plant on the fixed test, alone | `tests/unit/playwright-list.test.ts` with the plant | Mutation (plant), error guessing | ✅ Pass | **4 failed, 2 passed**: concurrency test (`expected 1 to be 3`), both removal tests (`expected false to be true`: the folder did not exist while the listing ran), caller-override test (`expected 'accucut-playwright-list-shared-control' to match /^accucut-playwright-list-[A-Za-z0-9]{6}$/`). The two `withPrivateListCache` tests pass, as expected. `evidence/plant-alone-results.txt`. Unplanted: 6 of 6 pass |
| (b) #221 plant, beside the four listing files | `playwright-list`, `e2e-shards`, `one-width-tag`, `own-width-files`, `canary-scan-gate` with the plant | Mutation | ✅ Pass | Same 4 unit tests fail, same 2 pass. In the same run the real union test in `e2e-shards.test.ts` also failed with the DEF-022 signature (`expected [ …(688) ] to deeply equal [ …(688) ]`), so the plant restores the race itself. 41 passed, 5 failed of 46. `evidence/plant-beside-results.txt` |
| (c) Cold loop 1: DL-120 pair, 10 of 10 | `e2e-shards` + `one-width-tag` | Repetition on a cold cache | ✅ Pass | 10 of 10 exit 0, 16 of 16 tests every run, wall 19.9 to 26.8 s, no folder left. Table below |
| (c) Cold loop 2: nine-file set, 10 of 10 | DEF-022's six files + `own-width-files`, `canary-scan-gate`, `playwright-list` | Repetition on a cold cache | ✅ Pass | 10 of 10 exit 0, 113 of 113 tests every run, wall 28.9 to 36.0 s, no folder left. Table below |
| (c) No `accucut-playwright-list-*` folder before or after | `ls %TEMP%` before the loop and after every run | Inspection | ✅ Pass | 0 before each counted loop; 0 after every one of the 30 counted runs |
| (d) Baseline on `master`'s helper, 10 runs | The eight files that exist on `master`, helper and `e2e-shards.test.ts` taken from `1d37902`, a new empty `PWTEST_CACHE_DIR` per run (honoured there) | Repetition, before/after | ✅ The loop sees the race | **9 of 10 runs failed**, 1 passed (run 9). Union test failed in 9 runs with `expected [ …(688) ] to deeply equal [ …(688) ]`; run 6 also failed `own-width-files` with `EPERM … auditspec.map` in the shared cache (the same race as a Windows file lock, QLT-03). `evidence/baseline-failures.txt` |
| (d) Two-listing probe if the baseline is 0 of 10 | — | — | n/a | Baseline was 9 of 10, not 0, so the probe was not run |
| (e) DEF-022 record's rows | `docs/07-qa/defects/DEF-022-*.md` | — | Not changed here | DL-146 (3)(e) puts the verification and merge rows in the next records PR, not in #220. Ready-to-paste rows are under "Defects" |
| DL-120: no retry, longer limit, skip or order | Diff reading | Inspection | ✅ Pass | `LIST_TIMEOUT_MS` (100 s) and `hookTimeout` (120 s) unchanged; all `e2e-shards` `it` bodies unchanged (only `beforeAll`); no `skip`/`retry` added |
| DL-120: cleanup on success and on failure | `playwright-list.test.ts` tests 2, 3, 5, 6 (fake `execFile`) | State check, negative path | ✅ Pass | Pass unplanted; tests 2 and 3 fail under the plant only now because they assert the folder existed during the listing (QLT-01 fix verified by the plant) |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| New unit test | `npx vitest run tests/unit/playwright-list.test.ts` (5ebe3b2, unplanted) | 6 | 6 | 0 | 0 | about 1 s |
| Pair, cold, 10 runs | `npx vitest run tests/unit/e2e-shards.test.ts tests/unit/one-width-tag.test.ts` | 16 per run | 16 per run | 0 | 0 | 19.9 / 21.7 / 26.8 s (min / median / max) |
| Nine files, cold, 10 runs | the six DEF-022 files + `own-width-files`, `canary-scan-gate`, `playwright-list` | 113 per run | 113 per run | 0 | 0 | 28.9 / 31.4 / 36.0 s |
| Baseline (master helper), 10 runs | the eight files, `1d37902` helper | 107 per run | 106 in 8 runs, 104 in 1, 107 in 1 | 1 per failing run | 2 skipped in run 6 | 18.1 / 22.7 / 33.0 s |
| Lint | `npx eslint tests/support/playwright-list.ts tests/unit/playwright-list.test.ts tests/unit/e2e-shards.test.ts` | — | exit 0 | — | — | — |
| Type-check | `npx tsc --noEmit` (whole project) | — | exit 0 | — | — | — |
| Full regression (reference run) | CI run 42978771784, attempts 1 to 5, on `5ebe3b2` (DL-050: CI is the reference run) | Vitest 2,805 and 4,923; E2E 231 / 228 / 215 | all | 0 | E2E 2 / 4 / 17 by the tests | 5 of 5 success, no failed or flaky line reported by the developer |

A local full `vitest run tests/unit` was **not** run by QA: the developer already recorded a 120 s `beforeAll` timeout in an unrelated file under full-suite load on this host (DL-057 class), and master's route asks for the targeted loops. This is a deliberate choice, not a skipped failure.

### Cold loop 1: DL-120 pair (head `5ebe3b2`)

A new empty `PWTEST_CACHE_DIR` was set for every run, as the DL-120 method says; the fixed helper ignores it (QLT-06), so each listing was cold on its own `mkdtemp` folder. "Slowest `beforeAll`" is the longest `beforeAll` hook measured by a Vitest reporter (`onHookStart` / `onHookEnd`) in that run.

| Run | Exit | Wall (s) | Tests | Slowest beforeAll (s) | Folders left |
|-----|------|----------|-------|-----------------------|--------------|
| 1 | 0 | 24.0 | 16 of 16 | 19.5 (e2e-shards) | 0 |
| 2 | 0 | 21.4 | 16 of 16 | 15.8 (one-width-tag) | 0 |
| 3 | 0 | 26.8 | 16 of 16 | 16.9 (e2e-shards) | 0 |
| 4 | 0 | 20.5 | 16 of 16 | 13.9 (e2e-shards) | 0 |
| 5 | 0 | 20.5 | 16 of 16 | 13.5 (e2e-shards) | 0 |
| 6 | 0 | 19.9 | 16 of 16 | 12.5 (e2e-shards) | 0 |
| 7 | 0 | 22.6 | 16 of 16 | 15.6 (e2e-shards) | 0 |
| 8 | 0 | 21.9 | 16 of 16 | 14.7 (e2e-shards) | 0 |
| 9 | 0 | 20.5 | 16 of 16 | 13.3 (e2e-shards) | 0 |
| 10 | 0 | 24.0 | 16 of 16 | 15.7 (e2e-shards) | 0 |

### Cold loop 2: nine-file set (head `5ebe3b2`)

| Run | Exit | Wall (s) | Tests | Slowest beforeAll (s) | Folders left |
|-----|------|----------|-------|-----------------------|--------------|
| 1 | 0 | 31.4 | 113 of 113 | 26.9 (one-width-tag) | 0 |
| 2 | 0 | 36.0 | 113 of 113 | 24.1 (e2e-shards) | 0 |
| 3 | 0 | 31.4 | 113 of 113 | 22.0 (e2e-shards) | 0 |
| 4 | 0 | 28.9 | 113 of 113 | 20.0 (one-width-tag) | 0 |
| 5 | 0 | 29.3 | 113 of 113 | 19.9 (one-width-tag) | 0 |
| 6 | 0 | 34.5 | 113 of 113 | 26.1 (e2e-shards) | 0 |
| 7 | 0 | 32.7 | 113 of 113 | 23.9 (own-width-files) | 0 |
| 8 | 0 | 30.3 | 113 of 113 | 22.2 (one-width-tag) | 0 |
| 9 | 0 | 32.9 | 113 of 113 | 22.8 (one-width-tag) | 0 |
| 10 | 0 | 29.6 | 113 of 113 | 21.9 (canary-scan-gate) | 0 |

### Baseline: `master`'s helper at `1d37902` (identical at `225a1c9`), eight files

Method: in the QA worktree, `tests/support/playwright-list.ts` and `tests/unit/e2e-shards.test.ts` were taken from `1d37902` with `git checkout 1d37902 -- <files>` (the other six files and `playwright-list.test.ts`, which does not exist on `master`, were not run). A new empty `PWTEST_CACHE_DIR` per run, which `master`'s helper honours. The two files were restored with `git checkout HEAD --` afterwards and `git status` was clean.

| Run | Exit | Wall (s) | Tests | Slowest beforeAll (s) | Failure |
|-----|------|----------|-------|-----------------------|---------|
| 1 | 1 | 22.7 | 106 of 107 | 16.1 (e2e-shards) | union test, `expected [ …(688) ] to deeply equal [ …(688) ]` |
| 2 | 1 | 23.3 | 106 of 107 | 16.9 (e2e-shards) | same |
| 3 | 1 | 18.9 | 106 of 107 | 12.7 (e2e-shards) | same |
| 4 | 1 | 19.8 | 106 of 107 | 13.6 (e2e-shards) | same |
| 5 | 1 | 20.7 | 106 of 107 | 14.6 (e2e-shards) | same |
| 6 | 1 | 18.1 | 104 of 107, 2 skipped | 12.4 (e2e-shards) | `own-width-files` `beforeAll`: `playwright test --list failed`, `EPERM … auditspec.map` in the shared cache; and the union test, same signature |
| 7 | 1 | 33.0 | 106 of 107 | 26.7 (e2e-shards) | union test, same signature |
| 8 | 1 | 27.9 | 106 of 107 | 18.3 (e2e-shards) | same |
| 9 | 0 | 24.1 | 107 of 107 | 16.8 (e2e-shards) | none |
| 10 | 1 | 22.6 | 106 of 107 | 15.5 (e2e-shards) | union test, same signature |

### Before / after

| Check | Before (`master` helper) | After (PR #220, `5ebe3b2`) |
|-------|--------------------------|----------------------------|
| Cold runs that failed | **9 of 10** (8 with the union signature only; run 6 with the union signature and an `EPERM` on a shared `.map`) | **0 of 10** (pair) and **0 of 10** (nine files) |
| Test count per run | 107 (104 in run 6, where one file's `beforeAll` failed) | 16 (pair), 113 (nine files), the same every run |
| Median slowest `beforeAll` | 15.8 s (min 12.4, max 26.7) | 15.1 s on the pair (12.5 to 19.5); 22.5 s on the nine files (19.9 to 26.9) |
| Median wall time | 22.7 s (eight files) | 21.7 s (pair), 31.4 s (nine files) |

The nine-file set is not the same set as the baseline's eight (it adds `playwright-list`, which lists nothing), so the wall-time and `beforeAll` rows compare cost only roughly. The honest reading: with a cold folder per listing, the slowest `beforeAll` of the four listing files is about 7 s longer at the median than on the shared, partly warm folder (22.5 s against 15.8 s), a cost the developer and reviewer-quality also measured (+4 s and +0.2 s on CI). The worst case, 26.9 s, leaves more than 70 s under the 100 s listing limit and more than 90 s under the 120 s hook limit. No timeout or hook failure occurred in any counted run.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Performance (guard cost, timeout margin) | RISK-023 / DL-057 | Per-run wall time and per-hook time (tables above) | ✅ Worst `beforeAll` 26.9 s against limits of 100 s (listing) and 120 s (hook). No timeout in 30 counted runs |
| Temp-folder hygiene | — | `ls %TEMP%` before the loops and after each of the 30 counted runs; the plant's own shared folder (`accucut-playwright-list-shared-control`) was moved out of `%TEMP%` after the plant | ✅ 0 `accucut-playwright-list-*` folders at every check |
| Security smoke | — | Diff reading: the helper deletes only the path `mkdtemp` returned inside `tmpdir()`; `rm` with `force` and `maxRetries: 3`; the child gets `{ ...process.env, PWTEST_CACHE_DIR }`; no `src/` or secret touched | ✅ No finding |
| Accessibility | — | n/a (test support, no UI) | n/a |
| Lint, type-check | — | `eslint` on the three changed files; `tsc --noEmit` | ✅ exit 0 both |

## Exploratory Testing

**Charter.** Find any way the fix could hide the race instead of removing it, or leave the guard weaker than before. Done alongside the plant and the loops above, with no separate time-box.

* **Is the plant faithful?** The plant script replaces the `withPrivateListCache(...)` call and adds the fixed folder constant, exactly as PR #221's diff did. It fails (exit 1, file untouched) unless each anchor occurs once; the first attempt did fail on the `CRLF` line endings of the file, which proves the anchor check bites, and the script was then made line-ending aware. The diff that was applied is printed in `evidence/plant-diff.txt`.
* **Does the plant also show in the real guard?** Yes. Beside the listing files, the plant made the real `e2e-shards` union test fail with the DEF-022 signature in the same run. So the unit test and the real race are caught by the same mutation.
* **Is the union test still a real check?** The baseline shows it fails on the race; the head passes it 20 times in a row under the same cold method. Its bodies are unchanged; only `beforeAll` lists all five at once.
* **Is the `PWTEST_CACHE_DIR` I set doing anything on the head?** No, by design (QLT-06): the helper overrides it. So the head's loops are "cold per listing" whatever the variable says. They were still run with a new variable per run, so the method is the same as the baseline's and the DL-120 method.
* **Hard stop.** One loop of mine was stopped by force while a run was in flight (see "Process note"). Afterwards `%TEMP%` held no `accucut-playwright-list-*` folder at the time of checking. This is one observation, not a test of kill-safety; the residual is QLT-04 (a killed listing can leave a folder in `%TEMP%`).
* No anomaly found in the fixed code.

## Process note (excluded runs)

Honesty about runs that are **not** in the evidence:

* I started the pair loop once without per-hook timing, saw runs 1 to 3 pass, and stopped it to add the `beforeAll` reporter. The stop ended the tracked shell but not the loop script, which kept running in the background and overlapped with my second pair loop and a smoke run for a few minutes (the overlapped runs took 42 to 59 s instead of about 22 s). I found the stray script from the process list, stopped both loops, and discarded **every** run of that period, green or not (the ones that finished were green: exit 0). The counted loops were all started afterwards, on a machine with no other loop or Vitest process, with 0 temp folders before each.
* Two one-run smoke tests (to check the timing instrumentation) are also excluded.
* No failure was re-run or set aside: all 30 counted runs are reported, 20 head runs green and 10 baseline runs with their failures.

## Defects

No new defect. No Sev-1, Sev-2, Sev-3 or Sev-4 raised by this run.

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-022 (AQP-236, #129) | `e2e-shards` union test fails on a cold Playwright cache beside `one-width-tag` | Sev-3 Test | Fixed by PR #220 and verified here; closes when #220 merges (orchestrator closes #129 with the merge commit, DL-146 (4)(f)) | G6 ruling 4 / DL-120 |

Rows for DEF-022's *Fix & Verification* table, for the records PR that DL-146 (3)(e) names (not applied in #220):

| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-11 | PR #220: `ddf6191` (own cache folder per listing), `5ebe3b2` (G6 condition A: QLT-01 to QLT-05) |
| Regression test added | developer | 2026-11-11 | `tests/unit/playwright-list.test.ts` (6 tests; 4 fail under the #221 plant) |
| Verified | qa-engineer | 2026-11-11 | `docs/07-qa/AQP-236-test-report.md`: pair 10 of 10, nine files 10 of 10, baseline on `master`'s helper 9 of 10 failed, plant 4 failed / 2 passed alone and beside the listing files |

## CI

* Code head `5ebe3b2`: run 42978771784, attempts 1 to 5 success (Stage 12 shards 1, 2, 3; `Stages 1 to 11b`; `Stages 1 to 11`). Vitest 2,805 and 4,923 and E2E 231 / 228 / 215, as the developer reported, include `random-members.test.ts` (+6 tests, +1 file) from `225a1c9` in the merge ref.
* The report commit changes only `docs/07-qa/`; its CI result is in the PR comment and the Jira hand-off.

## Residual Risks / Notes

1. **CI cannot show the race.** Stage 6 is cold on every runner and has stayed green on `master` (reviewer-quality, run 42945910485). The evidence for "race removed" is the local Windows loops plus the unit test that fails on the plant every time; this report supplies the Windows loops (9 of 10 before, 0 of 20 after).
2. **Evidence of the fix is host-dependent.** The race is timing dependent and shows strongly on this Windows host. A Linux host was not tested locally; CI (Linux) is green.
3. **A killed listing can leave a folder in `%TEMP%`** (QLT-04, accepted by master). Not tested deliberately.
4. **Cost.** Each listing is cold: about 7 s more on the slowest `beforeAll` at the median on this host, and nowhere near a limit.
5. **The branch `control/AQP-236-shared-cache`** (the #221 plant, fixed shared folder) is still on origin per DL-146 D; a human deletes it. QA did not touch it or reopen #221.
6. The PR is `BEHIND` `master` (225a1c9) by design; QA did not update it (DL-146 (4)(b) is the orchestrator's merge-commit update).

## Evidence

`docs/07-qa/AQP-236-evidence/` (text only; the local scratch path is replaced by `<qa-scratch>`):
`loop-head-pair.txt`, `loop-head-nine.txt`, `loop-base-eight.txt` (one line per run: exit, wall time, tests, `beforeAll` times, folders left), `baseline-failures.txt`, `plant-diff.txt`, `plant-alone-results.txt`, `plant-beside-results.txt`, `method-scripts.txt` (loop script, Vitest hook reporter, summary script, plant script with its anchor check, and the two-listing probe that was prepared but not needed).
