# Test Report — AQP-276 (STORY-10.22): CI fourth shard (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | H_m = `eff79fe10213678cba38034440090c8abc353d7b` on `feat/AQP-276-fourth-shard` (PR #336, `sankumar76/Accucut-Quotation`; parents b94eba7 and `master` e76b513). This report is the one commit on top of it (H_r) and changes nothing else |
| CI evidence | Base: `master` e76b513 push run **43342511688** (3 shards), attempts 1 to 6. Head: H_m `pull_request` run **43342625012** (4 shards, merge ref c699ba8 into e76b513), attempts 1 to 6. Controls: runs 43212324945 (#337) and 43212224753 (#338). CI on H_r is read after the push and posted on the PR and on Jira; it cannot be inside the commit it tests |
| Environment | No local test, build or server was run (machine memory is low; the delivery lead is validating on ports 3100 and 55450, untouched). Everything below is read-only `gh api` (jobs per attempt, job logs with `--allow-escape-sequences`, runs, branch protection), `git diff`/`git show --cc` in a QA worktree, and Jira/GitHub reads. Logs were saved to files and grepped; none was kept whole in context |
| Date | 2026-11-13 |
| **Recommendation** | **ACCEPT.** AC-1 to AC-5 and AC-7 to AC-9 pass. AC-4 passes outright (head median 4:54, slowest 5:11; no exit). AC-6 is met in substance under DL-203 (4) (i) to (iii), which master fixed before samples 5 to 10; read literally ("0 flaky in the head's five runs") it shows 1 flaky test, which is DEF-036. **Master decides that reading at G7.** No new defect. Open defects: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-036, pre-existing, Test type, AQP-290 / #364), Sev-4 0 |

## Summary

The enabler is what the story says: three files, +14 / -14, one executable line (`shard: [1, 2, 3, 4]`), two pins, and comments. I recomputed all ten paths, costs and the flaky and name checks from the Actions API and the job logs, and every figure in the developer's record (Jira 11775, PR body) reproduces to the second. The head is faster than the base by 48 s, its median (4:54) and slowest run (5:11) are inside 5:00 and 5:30, and the cost is 1.157 times raw and 1.200 times billed against a limit of 1.30. There were 0 replacements in either set, 0 red runs, and 893 of 893 real test names (896 distinct names with `setup`) are present in every head sample. The one flaky test (sample 4) is DEF-036's signature, and it passes (i) to (iii). Five observations are listed under "Notes for master"; none changes a result.

## AC Verification Matrix

Unit-level evidence is the CI run on H_m, attempt 1 (`Stages 1 to 11b`, job 131614342060): Vitest `tests/unit` 3,333 passed (168 files) and full Vitest 5,818 passed (230 files), identical to the base's attempt 1 (job 131613963119) and to attempts 6 of both. QA added no automated test: the story's tests are the two pins and the guards that already exist, and AC-4 to AC-7 are live-run measures.

| AC | Test ID(s) / method | Technique | Result | Evidence |
|----|--------------------|-----------|--------|----------|
| AC-1 matrix | `git diff e76b513 eff79fe`; `ci-workflow.test.ts` (pin), `ci-workflow-shards.test.ts` (exact block), `ci-fan-in.test.ts` (all green in the CI runs above); logs of all ten sample attempts | Inspection, boundary (list of 4) | ✅ Pass | The only non-comment `ci.yml` change is `-shard: [1, 2, 3]` / `+shard: [1, 2, 3, 4]` (line 330). The block holds `fail-fast: false` and the shard list only; no `include`, `exclude` or `max-parallel` (the three `continue-on-error` lines, 570/580/588, are step-level and unchanged). `--shard="${SHARD_INDEX}/${SHARD_TOTAL}"`, `SHARD_TOTAL` = `strategy.job-total`; job name template and the `required` job (`Stages 1 to 11`, the only job with `needs`) untouched. Every head log reads `Running N tests using 4 workers, shard i of 4` (30 of 30), every base log `... shard i of 3` (24 of 24). Each shard job ran its own install, build, migrations and stage 12a (steps all `success`). Comments say four; the "three widths" comments are left. |
| AC-2 guards | Same files; `e2e-shards.test.ts` unchanged; branch-protection read | Inspection, plant review | ✅ Pass | `ci-workflow.test.ts:191` `toEqual([1, 2, 3, 4])`; `ci-workflow-shards.test.ts:49` exact string with `[1, 2, 3, 4]`. `e2e-shards.test.ts` and `own-width` / `one-width` guards: `git diff` shows no change; they pass in CI. The developer's plants (return to three, fifth shard) are in the PR body; QA did not re-run them locally (no local runs). `ci-workflow.test.ts` is 396 lines (no line added). `gh api .../branches/master/protection`: `strict: true`, `contexts: ["Stages 1 to 11"]`, `enforce_admins: true`; no shard job is required. |
| AC-3 live controls | #337, #338 and their runs, re-read | Negative path | ✅ Pass | #337 and #338 are CLOSED, unmerged, base `master`, heads `control/AQP-276-shard4-fails` (7eaaa7b) and `control/AQP-276-shard4-cancelled` (da25f00); each is 0c8b898 plus one new spec (`compare`: ahead 1, 1 file; `zz-control-shard-4-fails.spec.ts`, `zz-control-shard-4-waits.spec.ts`). Run 43212324945: shard 4 `failure`, shards 1 to 3 and `Stages 1 to 11b` success, fan-in `failure`, log `##[error]E2E finished as 'failure', not 'success'`. Run 43212224753: shard 4 `cancelled`, others success, fan-in `failure`, `##[error]E2E finished as 'cancelled', not 'success'`. Both heads start with `control/`, so 10.3's window leaves them out. |
| AC-4 measure | `/runs/<id>/attempts/<n>/jobs`; earliest `started_at` of any job to `completed_at` of `Stages 1 to 11` | Measurement, replacement rules, DL-187 | ✅ Pass, no exit | See "AC-4 in detail". Base median **5:42**, slowest 5:52; head median **4:54**, slowest **5:11**; gain **48 s**. 0 replacements in each set. |
| AC-5 cost | Same ten attempts, job durations summed (`completed_at` minus `started_at`), billed = each job rounded up | Measurement | ✅ Pass | Raw first: base median 18.00 min, head 20.83 min = **1.157** times. Billed: base 20, head 24 = **1.200** times. Both at most 1.30. |
| AC-6 nothing lost | Flaky lines in all 45 sample job logs; diff; name sets | Log inspection, DL-203 (4) | ✅ Pass in substance (DL-203 (4)); literal text: 1 flaky | See "AC-6 in detail". One flaky (DEF-036 signature) in head sample 4; 0 in the other nine samples; no test dropped, moved, retried, widened; 893 / 893 real names present. |
| AC-7 reported | PR body vs API and logs | Inspection | ✅ Reported, all figures reproduce | See "AC-7 figures". |
| AC-8 record | PR body "AC-8" | Inspection | ✅ Pass | The PR hands the AC-4 to AC-7 figures to the solution-architect for 10.5 item 12 (with STD-03), and says: RISK-023 falls to 4 under DL-151 (5) only when a median of five on a `master` head, or a nightly window of at least 13 runs built by 10.3's rule, reads 5:00 or less; the measure ran on a pull-request head (median 4:54), so RISK-023 stays at 8. |
| AC-9 merge order | `gh pr view 297 / 341`, `git log` | Inspection | ✅ Pass (merge hold stands) | AQP-142 (#297) is MERGED as **0ca47df** (`master` 2026-11-13 06:11 IST). AQP-81 (#341) is OPEN, not merged (head ceb6787 at the time of reading). #336 is not merged. DL-190 (1): #336 merges before #341. |

### AC-4 in detail

Samples, in run order (the attempt 1s, base 6:40 and head 4:52, are not samples). "Q" is the largest `started_at` minus `created_at` in the attempt.

| # | Set | Attempt | Created (Z) | Path | Q | Slowest shard (job time, runner) | Replaced? |
|---|-----|---------|------------|------|---|----------------------------------|-----------|
| 1 | base | 2 | 01:16:25 | **5:42** | 4 s | 1 of 3 (5:29, 1000003820) | no |
| 2 | head | 2 | 01:22:56 | **5:11** | 3 s | 3 of 4 (5:01, 1000003826) | no |
| 3 | base | 3 | 01:29:25 | **5:49** | 3 s | 3 of 3 (5:36, 1000003837) | no |
| 4 | head | 3 | 01:35:48 | **4:54** | 3 s | 3 of 4 (4:44, 1000003841) | no (flaky, DL-203 (3)) |
| 5 | base | 4 | 04:35:41 | **5:01** | 3 s | 1 of 3 (4:51, 1000003851) | no |
| 6 | head | 4 | 04:42:39 | **4:53** | 2 s | 3 of 4 (4:44, 1000003864) | no |
| 7 | base | 5 | 04:49:18 | **5:01** | 3 s | 2 of 3 (4:52, 1000003869) | no |
| 8 | head | 5 | 04:55:03 | **4:44** | 3 s | 3 of 4 (4:34, 1000003874) | no |
| 9 | base | 6 | 05:00:39 | **5:52** | 3 s | 3 of 3 (5:42, 1000003880) | no |
| 10 | head | 6 | 05:07:13 | **5:01** | 3 s | 1 of 4 (4:49, 1000003885) | no |

- **Order.** The attempts alternate base, head, base, head and so on, one at a time: each attempt ended before the next was created (for example base 2 ended 01:22:10, head 2 was created 01:22:56). The pause between samples 4 and 5 (01:40Z to 04:35Z) is DL-203's.
- **Window.** `master` is still e76b513 and the PR head is still eff79fe throughout, so no test-adding merge or push fell between the sets. Both sets hold the same tests: 902 listed / 878 passed / 24 skipped on every base attempt, 905 / 881 / 24 on every head attempt.
- **Replacement rules (test strategy v0.37 (d), DL-128 (4), DL-187), checked on all ten samples and both attempt 1s.**
  - Queue wait over 20 s: none. The maximum in any job of any attempt is **4 s** (55 sample jobs: 25 base, 30 head; 11 more in the attempt 1s).
  - Next.js build cache not an exact hit: none. All 54 job logs of attempts 1 to 6 show `Cache hit occurred on the primary key nextjs-Linux-41a90a44...-e9137080...`; none shows the `restore-keys` prefix or a Next.js `Cache not found`.
  - `node_modules` cache miss or fallback: none. In every shard job, `npm ci (cache miss)` and `npm ci (cache fallback)` are `skipped`, and `Stages 1 to 11b` has the same two steps `skipped`.
  - Slow host: not replaced, by rule (the runner id of each slowest shard is in the table; the CPU model line is only on the job summary pages, which the API and the logs do not return).
  - **Replacements: 0 base, 0 head.** The budget of two per set is unused, and the set-ending third replacement does not arise.
- **Medians and lines.**

| | Sorted paths | Median of five | Slowest of five |
|---|---|---|---|
| Base (3 shards, e76b513) | 5:01, 5:01, 5:42, 5:49, 5:52 | **5:42** | 5:52 |
| Head (4 shards, H_m) | 4:44, 4:53, 4:54, 5:01, 5:11 | **4:54** | **5:11** |

- **DL-187 applied.** The head's median is at most 5:00 (margin 6 s) and its slowest run is at most 5:30 (margin 19 s), so the main lines are met. The 5:15 median exit does not apply (the median is not over 5:00). The slowest-run exit does not apply (the slowest is not over 5:30). **No exit is taken**, so there is nothing to state separately for two exits. Base median minus head median = 342 s minus 294 s = **48 s**, which is at least 20 s (comparator (c)); it is not needed for a pass and is reported. v0.37 (b) expected a head of 4:50 to 5:15 and a gain of 35 to 50 s: both inside. The pass depends on the head's own figures only, so the base's host draw (5:01 to 5:52) cannot change it. An exit is not a reading of 5:00 or 5:30 for any other rule (RISK-023 stays at 8).

### AC-5 in detail

| Sample | Base raw min | Base billed | Head raw min | Head billed |
|---|---|---|---|---|
| attempt 2 | 18.000 | 20 | 21.450 | 26 |
| attempt 3 | 18.550 | 21 | 20.833 | 24 |
| attempt 4 | 16.533 | 19 | 20.883 | 24 |
| attempt 5 | 16.817 | 19 | 19.833 | 23 |
| attempt 6 | 20.250 | 23 | 20.717 | 23 |
| **Median** | **18.000** | **20** | **20.833** | **24** |

Raw ratio 20.833 / 18.000 = **1.157** (read first). Billed ratio 24 / 20 = **1.200**. Limit 1.30 each, so both pass (1.87 x 1.30 = 2.43 stays under AQP-208 AC-6's 2.5). The Actions timing API reports 0 billable ms on this public repository, so billed minutes are computed per job (A-2, A-3). Sensitivity: if base sample 1 (see note N-3) were replaced by any value at all, the base medians cannot fall below 16.817 raw or 19 billed, so the worst ratios are 1.239 raw and 1.263 billed: still under 1.30.

### AC-6 in detail

**Flaky lines.** Each of the 45 sample job logs (attempts 2 to 6; 20 base, 25 head, shard and `Stages 1 to 11b` jobs) was searched for the Playwright summary `N flaky`, for `(retry #`, for `✘`, for `ECONNRESET` and for the server digest. The 9 attempt-1 logs were read the same way.

- **Exactly one flaky test in all ten samples and both attempt 1s: head sample 4 (attempt 3), shard 3 of 4, job 131625693705.** `01:39:47.055Z` `[WebServer] ⨯ Error: The destination stream errored while writing data.` with `digest: '3305231884'`; `01:39:47.286Z` `✘ 186 [desktop] › tests/e2e/customers.spec.ts:175:3`, `apiRequestContext.post: read ECONNRESET` at `support/customers.ts:52` (`makeCustomer`, called from `customers.spec.ts:194`); `✓ 192 ... (retry #1)` at `01:40:02Z`; summary `1 flaky`, `2 skipped`, `223 passed`. This is the only `(retry #` line in 45 logs, the only `✘` line, and the only `ECONNRESET`.
- **No red job**, no failed test, no `did not run` in any attempt. All jobs of all 12 attempts are `success`.
- **Base samples: 0 flaky, 0 retries.** Head samples 1, 3, 5 and 6 (attempts 2, 4, 5, 6): 0 flaky, 0 retries.

**DL-203 (4) applied to the DEF-036 instance.**
- **(i) No flaky test's spec, helper or server code is in AQP-276's diff: met.** The diff is `ci.yml`, `ci-workflow.test.ts` and `ci-workflow-shards.test.ts`. It touches neither `customers.spec.ts`, `support/customers.ts`, nor any server file (`git diff --stat e76b513 eff79fe -- src tests/e2e playwright.config.ts docs` is empty).
- **(ii) Every flaky instance in the head's five samples is DEF-036's signature or shown at three shards without AQP-276's change: met.** The one instance is an `apiRequestContext.post` failing with ECONNRESET against the dev server (`POST` to `localhost:3100`, `makeCustomer`), 0.23 s after the `digest '3305231884'` server error. The server half of the signature is in this window's base set: the digest line appears in **all five base samples** (attempts 2 to 6: 5, 4, 4, 1 and 3 lines) at three shards on e76b513's tree, in the same `customers.spec.ts` edit-page and reset tests, with no test failing there. (It appears in all five head samples too: 1, 6, 4, 4, 5 lines for attempts 2 to 6.)
- **(iii) The signature does not recur in two or more head samples while it is in none of the base: met.** ECONNRESET is in **1** of the head's five samples and in 0 of the five base samples; the digest is in 5 of 5 on both sides, so the recurrence line is not approached.
- **Other AC-6 clauses.** No test dropped, moved, retried or given a wider timeout; `@one-width`, `OWN_WIDTH_FILES`, `PARTLY_DESKTOP_ONLY`, `tests/e2e/**`, `playwright.config.ts` and `src/**` untouched (empty diff above); no `PWTEST_*` and no custom or weighted split (the workflow diff has only the matrix line and comments).
- **Every base name is present.** Names are `[project] › file › title` with `:line:col` stripped, from the `✓ ✘ -` result lines of the shard logs, per attempt (skipped tests included, retry suffix ignored). Each of the five base attempts has **896 distinct names**; each of the five head attempts has the same 896 (head attempt 3 shows one extra line only for the `(retry #1)` of the flaky test); the union of the base names is 896; **0 base names are missing from any head attempt**, and the five same-numbered pairs agree. 896 is 893 real tests plus the 3 distinct `setup` names (see N-2).
- **Reading.** DL-203 (4) is met on all three conditions, so AC-6 is met in substance; the AC's literal sentence ("0 flaky tests in the head's five runs") is not, by one test. That reading is master's (DL-185 (5), DL-203 (4)); QA does not read it for master.

### AC-7 figures (reported, not judged)

All reproduce from the API and the logs.

| Per shard | Listed | Skipped | Active | Test-step median of five | Shard job median |
|---|---|---|---|---|---|
| Base 1 of 3 | 301 | 3 | 298 | 4:01 | 4:51 |
| Base 2 of 3 | 301 | 4 | 297 | 3:28 | 4:52 |
| Base 3 of 3 | 300 | 17 | 283 | 3:37 | 4:35 |
| Head 1 of 4 | 227 | 2 | 225 | 3:04 | 4:09 |
| Head 2 of 4 | 226 | 3 | 223 | 3:02 | 3:53 |
| Head 3 of 4 | 226 | 2 | 224 | 3:50 | 4:44 |
| Head 4 of 4 | 226 | 17 | 209 | 2:47 | 3:54 |

- **Listed counts (PRF-01).** Base 902 listed (878 passed, 24 skipped); head 905 (881 passed, 24 skipped). Real tests are **893** on both sides (902 minus 9 and 905 minus 12 `setup` entries: 3 `setup` tests per shard, 3 shards against 4). That is test strategy v0.37 (a) with Q + R = 2: 900 + 2 listed and 891 + 2 real at three shards, 903 + 2 listed at four. Counts are identical in every attempt of each set. The head set is +0 / +0 / +3 / +0 against the base on attempt 1 (S): 3,333 / 5,818 / 905 vs 902 / 24 vs 24.
- **Slowest shard per run (PRF-05).** Table above. Base: shard 1, 3, 1, 2, 3. Head: shard 3 in four of five (attempts 2, 3, 4, 5), shard 1 in attempt 6.
- **Slack to `Stages 1 to 11b` (PRF-06, seconds).** Base 115, 101, 91, 121, 94, median **101**. Head 59, 67, 43, 20, 48, median **48**. Positive in all ten, so a shard still sets the path. `Stages 1 to 11b` median: base 3:34, head 4:01.
- **Queue wait and run order (PRF-03).** Waits 2 to 4 s in every job of every attempt (see AC-4); order as in the AC-4 table (base 2, head 2, base 3, head 3, base 4, head 4, base 5, head 5, base 6, head 6).
- **Head minus base.** Median 4:54 minus 5:42 = minus 48 s.

## Automated Test Results

| Suite | Command / source | Total | Passed | Failed | Skipped | Duration |
|-------|------------------|-------|--------|--------|---------|----------|
| New acceptance tests | None added by QA (the story's tests are its two pins and the existing guards) | n/a | n/a | n/a | n/a | n/a |
| Unit (`tests/unit`), CI Stage 6, H_m attempt 1 | read from job 131614342060 | 3,333 | 3,333 | 0 | 0 | see log |
| Full Vitest, CI Stage 11, H_m attempt 1 | same job | 5,818 | 5,818 | 0 | 0 | see log |
| Same two, base e76b513 attempt 1 | job 131613963119 | 3,333 / 5,818 | all | 0 | 0 | see log |
| E2E, H_m attempts 2 to 6 | shard logs | 905 listed | 881 (one test passed on retry #1 in attempt 3) | 0 | 24 | 2.6 to 4.0 min per shard |
| E2E, base attempts 2 to 6 | shard logs | 902 listed | 878 | 0 | 24 | 3.1 to 4.8 min per shard |
| Regression on the final head (H_r) | CI run on the report commit | read after the push | must be +0 / +0 / +3 / +0 against e76b513's push run | | | posted on the PR and Jira |

No local suite was run. This is a limit: the unit tests and plants were not re-run by QA; they were read from CI and from the developer's record. The CI jobs ran the unit suite, the E2E suite and the guards on this exact tree (and on H_m attempts 1 to 6).

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| CI feedback time | NFR-009 (p95 at most 10 min; 6:00 warning), RISK-023 | AC-4 | Head median 4:54, slowest 5:11; far inside 6:00 and 10:00 |
| Cost | AQP-208 AC-6 guard, DL-151 | AC-5 | 1.157 raw, 1.200 billed (limit 1.30) |
| Security smoke | NFR security | Gitleaks `no leaks found` in all 12 `Stages 1 to 11b` jobs read (attempts 1 to 6, both runs); no workflow permission, action, secret or pin changed in the diff; control PRs carry no data or secret | ✅ |
| Fan-in cannot be merged past | branch protection | AC-3 and the protection read | ✅ Red on a failed and on a cancelled shard 4; required context is exactly `Stages 1 to 11` |
| Accessibility | n/a | No user-facing screen | n/a |

## Exploratory Testing

Charter: find what the fourth shard changes that the nine ACs do not name. Time-box 45 minutes, read-only. Areas: every job log of the ten samples and the two attempt 1s (cache lines, install steps, worker count, shard banner, retries, digest), step times of stage 12a, runner images, and other workflow runs in the window.

Findings are N-1 to N-5 below. In short: a Playwright system-packages cache miss on a new runner image in sample 1, other CI runs overlapping four samples, a test-title wording difference, and a count wording in the PR body. None is a defect and none moves a result.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-036 (AQP-290, #364) | `customers.spec.ts:175` flaky on the E2E dev server (`apiRequestContext.post` ECONNRESET beside "destination stream errored", digest 3305231884) | Sev-3, type Test, pre-existing on `master` since AQP-142 | Open (opened by QA under DL-203 (6); root cause on AQP-290 comment 11774; fix `fix/AQP-290-*` before G8) | AC-6 |

No new defect is opened by this report. Open by severity: Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 0. DEF-036 is not caused by this diff (DL-203 (2); this report's AC-6 reading) and does not block the story's own fix, but a recurrence line in DL-203 (4)(iii) stays watched until its fix merges.

## Notes for master

- **N-1 (STD-01 wording).** DL-185 (2) asked for the reviewer's text. The reviewer (`standards.md`, STD-01) suggested `'AQP-276 AC-2 (AQP-227 AC-1, AQP-208 AC-1): ...'`; b94eba7 has `'AQP-276 AC-2 (AQP-227 AC-1): ...'`, so ", AQP-208 AC-1" is dropped. One line, title only, no line added (396 of 400), the AC ID is the current owner's, and nothing asserts on the title. QA reads it as satisfying the finding's purpose; master verifies S from the diff, so it is named here. Not opened as a defect.
- **N-2 (count wording in the PR body, for the architect's AC-8 record).** The PR says both sets hold "896 real tests plus `setup` (6 on base, 9 on head)". The logs show 3 `setup` tests per shard: 9 entries on the base, 12 on the head, 893 real tests on both sides. 896 is the number of distinct names with the 3 `setup` names. The difference (+3) and v0.37 (a) are right; use 893 / 9 / 12 in 10.5.
- **N-3 (cache miss outside the listed causes).** Sample 1 (base attempt 2), shard 2 of 3, job 131617691544: the **Playwright system-packages cache** was not found (`Cache not found for input keys: playwright-debs-e1-ubuntu26-20261111.82.6-1.65.0`; saved afterwards). That job ran on a newer runner image (`ubuntu26/20261111.82`; most other jobs show `20261101.186`, some `20261111.196`), and its stage 12a took 35 s instead of 3 to 8 s. This is not a cause in v0.37 (d) (queue wait; Next.js build cache; `node_modules` miss or fallback), so it is not a replacement and was not replaced. It did not set the path: that shard's job was 293 s against shard 1's 329 s. It affects the base only; the cost ratios stay under 1.30 whatever replaces it (AC-5 sensitivity), and the head's pass lines do not read the base. Suggest the architect considers adding "any cache not found" to (d) for a later measure.
- **N-4 (other CI runs overlapped four samples).** On the docs branch `docs/AQP-1-records-sprint1-m`: run 43344826509 (01:25:34Z to 01:30:44Z) overlaps head sample 2 and base sample 3; runs 43366454432 (cancelled, 04:34:56Z to 04:37:13Z) and 43366655599 (04:36:46Z to 04:43:00Z) overlap base sample 5 and, by 19 s, head sample 6. Two head and two base samples are touched. Queue waits stayed at 2 to 4 s, so no runner contention showed; no replacement rule covers it. DL-185 (4) says "one at a time, no other measure"; these are not measures, but the overlap is stated for the record.
- **N-5 (thin median margin).** The head's median passes by 6 s (4:54 against 5:00) and the gain of 48 s is inside v0.37 (b)'s 35 to 50 s. The result is a pass, not a near miss, but the next E2E-adding story (AQP-81, then AQP-90 and AQP-148) uses up that margin; RISK-023 stays at 8.

## Residual Risks / Notes

- RISK-023 stays at **8**. It falls to 4 under DL-151 (5) only when a median of five on a `master` head, or a nightly window of at least 13 runs built by 10.3's rule, reads 5:00 or less. This measure ran on a pull-request head; the merge and this result alone do not lower it.
- DEF-036 can still turn a run red twice in a row (it fails closed). Its fix is outside this story.
- Architect, by G8 and not holding G7: 10.5 item 12 record with STD-03 (architecture 9.2 and the pin row to `[1, 2, 3, 4]`), v0.37 "ruled" marker (DL-187), N-2 counts. Delivery lead: delete `control/AQP-276-shard4-fails` and `control/AQP-276-shard4-cancelled` after G7 (STD-04).
- Merge: after G7 GO, by the orchestrator with the strict update-branch rule; not inside any other measure window; #336 before #341 (DL-190). A push to `master` before the merge needs the update-branch checks (empty `--cc`, same 3 files, CI +0 / +0 / +3 / +0).
- Story status stays **In QA** until master's G7 decision is relayed.
