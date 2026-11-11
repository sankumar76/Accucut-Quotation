# Test Report — AQP-244 (STORY-10.20): CI path variance, the own-width cut (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `a4eab7f` on `feat/AQP-244-ci-path-variance` (PR #166, `sankumar76/Accucut-Quotation`, base `322cd8e`), plus this report (docs only; the CI run on that commit is posted on the PR) |
| CI | Final head `a4eab7f`: run 42867165582, attempt 1, 5 of 5 success, 665 passed / 23 skipped, 0 flaky. AC-3 readings: base `master` `322cd8e` run 42850365032 attempts 1 to 5; head `953b8ca` run 42852486467 attempts 1 to 5 |
| Environment | G7 through the Actions API and CI only (DL-137, DL-141): nothing was run locally except git and small scripts that read API output and job logs (kept in the QA scratch folder, outside the repository). Two QA control PRs were run in CI and closed unmerged |
| Date | 2026-11-10 |
| **Recommendation** | **ACCEPT.** AC-1 to AC-6 pass; no defect found. Open defects: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0. AC-3 (a) is met by the five-run head (median 4:37, slowest 4:52, ceilings 5:00 and 5:30), every job `hit`, 0 flaky in 11 runs. The files in the PR are the same five at both heads; the final head `a4eab7f` was read once (5:12, single run, not a reading) and its test counts are identical to `953b8ca`, as master ruled (DL-141) |

## Summary

The cut does what the ruling says and nothing else. `OWN_WIDTH_FILES` (`aqp-234-qa.spec.ts`, `masters-table-actions.spec.ts`) is in the `testIgnore` of `mobile` and `tablet`. I compared the list reporter output of all 31 shard logs: the head runs exactly the same 665 tests as the base, entry for entry, in every one of the five pairs and on the final head; the only entries that disappear are the 108 skipped, zero-cost entries of those two files in `mobile` and `tablet` (32 + 32 + 22 + 22). Apart from the three `[setup]` tests, which run in every shard by design, no test appears in two shards (656 tests, once each). The path medians recompute to the second: base 4:41 (slowest 5:17), head 4:37 (slowest 4:52). The guards catch both plants I added on the final head. Balance is reported only, as AC-3 (c) now says: the heaviest shard's host-free work is 27 s above the mean, far from the 80 s that would make a balance story due.

## AC Verification Matrix

| AC | Method | Result | Evidence |
|----|--------|--------|----------|
| AC-1 Attribute first | Read of the developer's comment 11338 (read-only, before any change) against the logs | ✅ Pass | 11338 gives the per-attempt table, the largest cause in seconds (host speed in the shard test step, 52 of 81 s), the path standard deviation and range on unchanged code (26 s over 8 hit runs; 66 s range), tests by shard and project with the "not attributed" column, the split of the 76 s rise, and the three limits. I did not recompute its figures (the runs it reads are older than the QA window), but I confirmed its structural finding from the base logs: 131 skipped entries, 108 of them the two files in `mobile` and `tablet` (32 + 32 + 22 + 22), shards 1 and 2 holding 56 and 58 skipped against 17 in shard 3 |
| AC-2 The cut as ruled | Diff `322cd8e..a4eab7f` (5 files, +205 / -16); guard tests on CI; list reporter comparison of base and head | ✅ Pass | `playwright.config.ts`: `OWN_WIDTH_FILES` in the `testIgnore` of `mobile` and `tablet` only, `desktop` and `setup` untouched. Test strategy 10.5 item 9 (v0.30 to v0.32) holds the ruling. **Each test runs once:** passed entries (`project / file / title`) of the head equal the base in 5 of 5 pairs (665 passed, 659 distinct keys, differing keys 0 + 0) and on the final head against both. The 108 skipped entries that are gone are all in the two files, `mobile` or `tablet`; none is new. Final head skips by project: `shell` 8 + 2 + 2, `shell-first-open` 5, `shell-lazy-load` 4, `aqp-234-qa` 2 in desktop (the measure-only blocks) = 23. Keys seen in more than one shard: only the three `[setup]` tests (one per shard). `desktop` is unchanged. CI stage 6 and 11: `own-width-files.test.ts (8 tests)`, `one-width-tag.test.ts (10)`, `e2e-shards.test.ts (6)`, `ci-workflow.test.ts`, `ci-workflow-shards.test.ts`, `ci-fan-in.test.ts` all pass; stage 6 `Test Files 144 passed (144)`, `Tests 2793 passed`; stage 11 `200 passed`, `4911 passed` (run 42867165582). Expected gain about 12 s (range 0 to 18 s); measured median difference 4 s, inside the range |
| AC-3 (a) Ceilings | Actions API, jobs of the runs, first job start to end of `Stages 1 to 11` | ✅ Pass | Head `953b8ca`, run 42852486467: paths **4:10, 4:52, 4:28, 4:37, 4:40; median 4:37** (limit 5:00); **slowest 4:52** (limit 5:30). Every job of every run is `hit` (4 jobs x 5 runs = 20 of 20), all jobs success, queue wait at most 5 s |
| AC-3 (b) Difference | Same method on the base | ✅ Reported | Base `322cd8e`, run 42850365032 (read after the DEF-023 fix; PR #160 is an ancestor, `compare` status `ahead`, merged 15:44Z, base runs 16:01Z, and no shard of the base prints a `flaky` line): paths 4:56, 4:26, 4:41, 5:17, 4:30; **median 4:41, slowest 5:17**; all 20 jobs `hit`. Difference: median 4 s lower, slowest 25 s lower, path sd 20.9 s (base) against 15.6 s (head). Reported, not judged (standard error of a median of five about 20 s) |
| AC-3 (c) Balance, reported only | Counts and step times from the logs; host-free fit (below) | ✅ Reported | See "Balance (reported only)". Heaviest shard host-free work: base 50 s above the mean (shard 3), head **27 s** (shard 1), ends last in 2 of 5 runs; the trigger for a balance story (80 s and last in at least 3 of 5) is not met on either side |
| AC-3 (d) Host-draw exit | n/a | ✅ Not needed | Head median 4:37 is under 5:00 |
| AC-4 Exit | n/a | ✅ Taken for host speed only | Recorded by 11338 and 11342: the in-repository part is the cut, so AC-3 applies, as read above |
| AC-5 Reading rule | Median of five full runs of one commit, `hit` in every job | ✅ Pass | Applied to both sides above. Each run's slowest shard: base shard 1, 1, 3, 3, 2; head shard 3, 2, 1, 2, 1. The host line (CPU model) is written to each job's summary page, which the API does not expose, so it is not posted here |
| AC-6 Guards | Branch protection read back; diff; `--list` guard on CI; billed minutes | ✅ Pass | `gh api .../branches/master/protection`: required checks exactly `["Stages 1 to 11"]`, `strict: true`, force pushes off. The diff touches no `ci.yml`: the fan-in job keeps its name and remains the only job with `needs`, matrix `[1, 2, 3]`. The union test and the count guard (`e2e-shards.test.ts`, 6 tests) pass on CI. **0 flaky:** no `flaky` or `failed` line in any of the 33 shard logs read (5 base, 5 head, 1 final, 3 shards each). **Billed minutes:** base 19, 18, 18, 19, 19 (median 19), head 16, 17, 18, 20, 18 (median 18): **ratio 0.947**, limit 1.30; raw median 15.95 against 15.23 minutes (0.955). Fan-in job 7 s both sides |

## Counts per shard (reported, deterministic)

From the Playwright summary lines of every shard log; "listed" is passed + skipped (it includes the three `[setup]` tests of each shard); "active" is passed. The numbers are the same in every one of the five runs of each side and in the final-head run.

| | Shard 1 | Shard 2 | Shard 3 | Total | Spread of active |
|--|---------|---------|---------|-------|------------------|
| Base `322cd8e`: listed | 266 | 265 | 265 | 796 | |
| Base: skipped | 56 | 58 | 17 | 131 | |
| Base: active | 210 | 207 | 248 | 665 | 41 |
| Head `953b8ca` and final `a4eab7f`: listed | 230 | 229 | 229 | 688 | |
| Head: skipped | 2 | 4 | 17 | 23 | |
| Head: active | 228 | 225 | 212 | 665 | 16 |

The count split of `e2e-shards.test.ts` (listed tests excluding the setup tests, 227 / 226 / 226) still differs by at most one; what changed is that the listing now matches what runs.

## Balance (reported only; medians of five hit runs, sd in brackets)

Test-step time is the `Stage 12: E2E (Chromium...)` step of each shard job, from the jobs API.

| | Shard 1 | Shard 2 | Shard 3 |
|--|---------|---------|---------|
| Base: test-step median (sd) | 206 s (32.2) | 206 s (32.6) | 181 s (37.5) |
| Base: ends last in | 3 of 5 | 0 of 5 | 2 of 5 |
| Head: test-step median (sd) | 180 s (28.0) | 172 s (25.4) | 185 s (22.7) |
| Head: ends last in | 2 of 5 | 2 of 5 | 1 of 5 |
| Base: host-free work | 624 s | 612 s | 694 s |
| Head: host-free work | 670 s | 651 s | 608 s |

Host-free work is the fit of PRF-01 (test strategy 10.5 item 9): one host factor per job and one cost per test, 30 jobs (5 base and 5 head runs x 3 shards), 659 distinct test entries, 6,650 observations; the work of a shard is the sum of the fitted costs of the tests that ran there. **Fit residual 11.7 % of the logged test seconds**; host factors 0.75 to 1.30 (sd 0.15). Heaviest shard above the mean of the three (643 s on both sides): **base 50 s (shard 3), head 27 s (shard 1)**. The reviewer's estimate was 62 s and 46 s; my fit uses the same method on my own parse and gives lower figures, and both sides are under the 80 s line. For comparison only (not used): the raw medians of summed test seconds give a maximum minus mean of 28 s (base) and 14 s (head). No balance story is due.

## Plants (guard checks, CI only; the controls are closed unmerged, diffs in each PR)

| Plant | Where | Result |
|-------|-------|--------|
| P1 third file in `OWN_WIDTH_FILES` | developer's #175 | `own-width-files.test.ts`: `holds every spec that skips every non-desktop project, and only those` fails (read from the log of run 42862311362) |
| P2 own-width file dropped from `desktop` | #176 | `lists the tests of each own-width file in desktop only, and each file has tests` fails (run 42862323696) |
| P3 `OWN_WIDTH_FILES` applied to `desktop` | #177 | `is added to the testIgnore of mobile and tablet, and of no other project` and the listing test fail (run 42862339575) |
| P5 a non-listed file hidden from `mobile` | #179 | `one-width-tag.test.ts` `run in the desktop project only, and every other test runs in all three width projects` and two more fail (run 42862372215) |
| P4 in the 953b8ca form (skip inside the describe, plus a top-level test) | developer's #183 | `skips outside desktop at file level in each own-width file` fails (run 42867966691) |
| P8 unruled third own-width file with the file | #193 | `is exactly the two files ruled in test strategy 10.5 item 9, and no other` fails (run 42870032956) |
| **QA P4, re-planted by me on the final head `a4eab7f`:** `masters-table-actions.spec.ts` back to `322cd8e`, so the hook is inside the describe, plus a top-level test | **#207** (run 42889358345) | **Fails 1 of 2,793** in `Stages 1 to 11b`: `own-width-files.test.ts > skips outside desktop at file level in each own-width file`, `masters-table-actions.spec.ts: a column-0 test.beforeEach with test.skip(testInfo.project.name !== 'desktop', ...): expected false to be true`. The run was cancelled after the red verify job |
| **QA P9 (mine):** `shell.spec.ts` added to `OWN_WIDTH_FILES` **and** to the pinned `RULED_OWN_WIDTH_FILES`, and the `PARTLY_DESKTOP_ONLY` exemption emptied, so that the pin, the scan and the config agree | **#208** (run 42889472762) | **Fails 1 of 2,793**: the same file-level test, for `shell.spec.ts` (`a column-0 test.beforeEach ...: expected false to be true`). Only that guard objects: the plant edited the name pin, the scan list and the config consistently |

The six developer and quality plants were read from their control PRs (all CLOSED, `merged: null`) and logs; P1 to P3 and P5 ran before round 2 (their logs carry the earlier guard names, for example `guard (b)` for the listing test), and the final head's guards are exercised by P4 (#183 and my #207), P8 and my P9.

**G12 relaxation read against the pinned names.** `one-width-tag.test.ts` now expects `['desktop']` for any test of a file in `OWN_WIDTH_FILES`; that list is read from the config text. The names are pinned in `own-width-files.test.ts` (`RULED_OWN_WIDTH_FILES`), and the pin, the scan, the file-level hook check and the `--list` check all read the same list, so the exemption is exact for the two ruled files and cannot widen without an edit of both lists. P9 shows what is left when both lists are edited together: the file-level hook guard is then the last guard, and it holds for a file like `shell.spec.ts` whose skip is inside one describe. A file that already had a file-level hook, added to both lists, would pass every guard; that is the review rule of test strategy section 10 (a ruling for each new entry), as the test's own comment says. No test is removed, skipped or moved to one width; the moved hook in `masters-table-actions.spec.ts` changes nothing that runs (passed sets are identical).

## Automated Test Results

| Suite | Where | Total | Passed | Failed | Skipped |
|-------|-------|-------|--------|--------|---------|
| Unit, stage 6, final head | CI run 42867165582 | 144 files, 2,793 tests | 2,793 | 0 | |
| Integration and the rest, stage 11, final head | same run | 200 files, 4,911 tests | 4,911 | 0 | |
| E2E, final head | same run, shards 1 / 2 / 3 | 228 / 225 / 212 passed | 665 | 0 failed, 0 flaky | 2 / 4 / 17 |
| E2E, head `953b8ca` x 5 | run 42852486467, attempts 1 to 5 | 665 each | 665 each | 0 | 23 each |
| E2E, base `322cd8e` x 5 | run 42850365032, attempts 1 to 5 | 665 each | 665 each | 0 | 131 each |
| Local runs | none | | | | not run by QA: G7 via API and CI only |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Required-path time | NFR-009, RISK-023 | AC-3, recomputed from the jobs API | ✅ head median 4:37 and slowest 4:52 against 5:00 and 5:30; read under the median-of-five rule with `hit` in every job. The final head's single run read 5:12 (one job waited 42 s in the queue, which the path excludes); it is one run and not a reading |
| Cost | NFR-025 | AC-6 | ✅ 0.947 billed, 0.955 raw (limit 1.30) |
| Security smoke | | Read of the diff | ✅ no `ci.yml`, script, secret or permission change; the change is a Playwright project setting, one test-support file and tests |
| Accessibility | NFR-018 | n/a (no screen) | n/a |

## Exploratory Testing

Charter: break the claim "the listing now matches what runs and each test still runs once". Areas: the pin and the scan against a consistent edit of both lists (P9), the hook position (P4, twice), the multiset of tests across shards and projects, the skipped entries (what disappeared and what appeared), the shard-count arithmetic, and the base's retry line. Findings: (1) no test is lost or doubled; the only cross-shard keys are the three `[setup]` tests, by design; (2) **OBS-1 (Info):** with P9 a single guard stands between a mistaken or hurried addition and the config. Test strategy section 10's review rule covers it and #203 (QLT-06, a syntax-based check) is already open; I raise nothing new; (3) **OBS-2, method note:** `gh run view <run> --job <id> --log` returns the log of the run's latest attempt, not of that attempt's job. I noticed this when five "attempts" of one run returned the same log, and read every per-attempt log of this report with `gh api --allow-escape-sequences repos/.../actions/jobs/<id>/logs`. I re-read the logs behind DEF-023 (AQP-243 G7) the same way: all 8 attempts (3 base, 5 head) print `1 flaky` for `aqp-234-qa.spec.ts:446` with exactly the three rows described there (received 3, slots 4 to 7), so DEF-023's "9 of 9 runs" stands; the evidence of PR #160 and #189 was read attempt by attempt as each finished and was not affected.

## Defects

None new. DEF-023 and DEF-027 are fixed and closed (AQP-268, AQP-272). #203 (QLT-06) and #137 stay open as tech-debt.

## Residual Risks / Notes

* **AC-3 reads `953b8ca`, the final head is `a4eab7f`.** Round 2 changed test and config-guard files only; the counts per shard are identical (665 / 23) and the ruling of master (DL-141) is no re-measure. The first five runs on `master` after the merge are the next reading (DL-128 (4): replace a `miss` or `fallback` run before reading it).
* **PR #166 is behind `master`** (base `322cd8e`); the update by merge commit and the "passed total equal to the `master` push run" rule are the orchestrator's (master's merge route).
* **The host line (CPU model) was not read.** Job summaries are not available through the API.
* **Fit residual 11.7 %.** The host-free figures carry that uncertainty; both are far from the 80 s line.
* This report is committed to the PR branch; the commit changes no workflow, script or test file.
