# Review Report — AQP-244 (STORY-10.20, CI path variance) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master` (322cd8e) `...feat/AQP-244-ci-path-variance`, PR #166 |
| Commit reviewed | 953b8cacbf294e3458f110738a0cbb74cdfc0b9e |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (single token, so submitted as COMMENT): https://github.com/sankumar76/Accucut-Quotation/pull/166 (label `review:performance-approved`).

## Summary
The story's acceptance is a measured CI result, so I rebuilt every figure of AC-3 and AC-6 from the GitHub jobs API (ten attempts, 50 jobs) and from the 30 shard job logs. **All of them match the PR**: path, `Stages 1 to 11b`, shard durations, billed and raw minutes, the five-run medians, slowest, mean and sd, the cache hit in every job, the listed, skipped and active counts for all six shard rows, and the per-shard summed test seconds (26 s before, 16 s after). The ceilings of AC-3 (a) are met and the 0.95 cost ratio is right. The code change is two `testIgnore` entries and cannot hurt a runtime path. What the numbers do not show is any effect of the cut on time: the path difference (-4 s) is a quarter of its noise, the head drew hosts about 7 % faster, and the 16 s versus 26 s comparison sits inside a noise of about 40 to 70 s per shard median. I record that as one Minor (the wording proposed for AC-3 (c) rests on a statistic that cannot carry a 35 s line) and three Info items. None holds the merge.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
Read-only, as the brief required. No local test run, build, `npm ci` or Playwright; the only local processing was `awk` over saved API output and log text.

| Check | Command | Result |
|-------|---------|--------|
| PR and diff | `gh pr view 166`, `gh pr diff 166` | 4 files, +158 / -10: `playwright.config.ts` (2 `testIgnore` lines and the constant), a test-support reader, one relaxed assertion, one new guard file. Head runs built merge commit 4244240 = 953b8ca into 322cd8e, so head = base + this diff exactly |
| Jobs and steps, 10 attempts | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/{42850365032,42852486467}/attempts/{1..5}/jobs` | 5 jobs each, all success, `run_attempt` = n for every job (full re-runs). Interleaved in time (base 16:01 to 16:32Z, head 16:14 to 16:39Z), so host drift hits both sides alike |
| Shard job logs, 30 | `gh api --allow-escape-sequences repos/.../actions/jobs/<id>/logs` (one 503 retried) | read in full for counts, per-test seconds, cache lines, failures |
| Branch protection | `gh api repos/.../branches/master/protection` | required checks are exactly `Stages 1 to 11` (strict) |
| Docs of record | test strategy v0.31 section 10.5 item 9 (branch `docs/AQP-1-g6-aqp-269`), risk register RISK-023, DL-134 | used as the definitions |

## AC-3 and AC-6, recomputed

**Path** = first job start to the end of `Stages 1 to 11` (queue excluded). Queue wait was 2 to 5 s in every job.

| Run:attempt | Path | `Stages 1 to 11b` | Shard 1 | Shard 2 | Shard 3 | Billed min | Raw min |
|---|---|---|---|---|---|---|---|
| base 42850365032:1 | 4:56 | 2:56 | 4:44 | 4:42 | 4:02 | 19 | 16.55 |
| :2 | 4:26 | 3:30 | 4:14 | 3:10 | 3:38 | 18 | 14.68 |
| :3 | 4:41 | 2:55 | 3:07 | 4:13 | 4:32 | 18 | 14.88 |
| :4 | 5:17 | 2:48 | 4:19 | 3:52 | 5:08 | 19 | 16.22 |
| :5 | 4:30 | 3:18 | 4:19 | 4:20 | 3:53 | 19 | 15.95 |
| head 42852486467:1 | 4:10 | 2:44 | 3:48 | 3:51 | 3:57 | 16 | 14.48 |
| :2 | 4:52 | 2:57 | 3:17 | 4:38 | 3:59 | 17 | 15.02 |
| :3 | 4:28 | 3:27 | 4:18 | 3:53 | 3:29 | 18 | 15.23 |
| :4 | 4:37 | 3:24 | 4:04 | 4:26 | 4:17 | 20 | 16.30 |
| :5 | 4:40 | 3:26 | 4:30 | 3:50 | 3:21 | 18 | 15.23 |

Every cell equals the PR table (raw minutes to the PR's one decimal). Billed = each job rounded up to the minute, summed (five jobs); raw = job seconds / 60.

| | Median | Slowest | Mean | sd (n-1) | Billed median (mean) | Raw median |
|---|---|---|---|---|---|---|
| base | **4:41** (281 s) | 5:17 | 4:46 | 20.9 s | 19 (18.6) | 15.95 |
| head | **4:37** (277 s) | 4:52 | 4:33 | 15.6 s | 18 (17.8) | 15.23 |
| difference | -4 s | -25 s | -13 s | | 0.947 (means 0.957) | 0.955 |

- **Cache hit in every job: confirmed, 40 of 40.** In each of the 10 attempts, the `npm ci (cache miss)`, `npm ci (cache fallback)` and `save node_modules` steps are `skipped` in all four install jobs, and the 30 shard logs each carry `Cache restored from key: node-modules-v1-...` and two Playwright cache restores (60 lines). No run needs replacing under DL-128 (4).
- **AC-3 (a): met.** Head median 4:37 is 23 s under 5:00; head slowest 4:52 is 38 s under 5:30. The binding job rotates (head: shard 3, 2, 1, 2, 1), so no shard is systematically last.
- **AC-3 (b): the arithmetic is right** (-4 s median, -25 s slowest). The normal-approximation standard error of a difference of two medians of five is about 15 s with these sds (the PR says about 20 s); either way the median difference is a quarter of one SE. Reported, not judged, as ruled.
- **AC-6 cost: met, 0.95 times** (18 against 19 billed; raw 15.23 against 15.95), against a limit of 1.30. The head's billed spread (16 to 20) is wider than the difference between the medians, so the ratio is noise around 1.0; the change adds no job or step. Branch protection and the `Stages 1 to 11` fan-in are unchanged. 0 failed, 0 flaky and 0 retried tests in all 30 shard logs.
- **Not on the path:** `Stages 1 to 11b` ended at least 43 s before the last shard in all ten runs (base 43 to 140 s, head 50 to 101 s), so it never binds.

## AC-3 (c): counts and summed test time, recomputed from the logs

Counts (identical in all five runs of each side) match the PR for all six rows: base 263 / 56 / 207, 262 / 58 / 204, 262 / 17 / 245; head 227 / 2 / 225, 226 / 4 / 222, 226 / 17 / 209 (listed / skipped / active, the 3 set-up tests left out). Test-step medians: base 206 / 206 / 181 s, head 180 / 172 / 185 s (max minus mean 8 s and 6 s).

Summed test seconds, from the `list` lines of passed tests (set-up project left out):

| Shard | Base, 5 runs (s) | Base median / mean / sd | Head, 5 runs (s) | Head median / mean / sd |
|---|---|---|---|---|
| 1 | 691, 671, 448, 690, 656 | 671 / 631 / 103 | 568, 482, 685, 598, 702 | 598 / 607 / 90 |
| 2 | 673, 461, 674, 526, 695 | 673 / 606 / 106 | 560, 722, 556, 709, 562 | 562 / 622 / 86 |
| 3 | 595, 563, 745, 844, 597 | 597 / 669 / 121 | 597, 588, 477, 621, 466 | 588 / 550 / 72 |
| **max minus mean** | | **26.3 s** (median of medians basis, as the PR) | | **15.6 s** |

The PR's 26 s and 16 s are reproduced, and the total work (1,941 s base, 1,748 s head, -10 %) is reproduced as well.

**Modelled 68 s: reproduced from the logs, and the cause of the gap is not what the PR says.** Using each test's median over the five base runs and the head's actual test-to-shard assignment (taken from the head logs, so no Playwright run was needed), shard sums are 705 / 663 / 544, max minus mean 67.7 s, against 657 / 631 / 623 (20 s) for the base assignment. That is the PR's 68 and 20. The model prices every test at the base's cost, and the base's shards 1 and 2 drew slower hosts than its shard 3. When I fit one host factor per job (30 jobs) and one cost per test (656 tests, ten observations each, 40 iterations; my estimate, not a run of the suite), the factors are base 1.02 / 1.10 / 0.99 and head 0.92 / 1.06 / 0.92 (head hosts 6.8 % faster on average), and the host-free work per shard is:

| | Shard 1 | Shard 2 | Shard 3 | Max minus mean |
|---|---|---|---|---|
| Base (host-free work, s) | 609 | 545 | 670 | 61.7 |
| Head | 654 | 581 | 588 | 45.9 |

Two things follow (estimates). First, the base's shard 3 really did carry about 60 s of extra work; the median of five hid it because the two slowest base shard-3 sums (745 and 844 s) fall outside the median. Second, the cut moved the heavy tail from shard 3 to shard 1 and gained about 16 s of summed work (62 to 46), roughly 4 s of wall time at four workers. The model's 68 s is inflated by the host draw; the measured 16 s is flattered by it (head shard 1 and 3 drew factors of 0.92). The assumption that a test's cost does not depend on its shard holds to within a few percent in my fit (the big groups that stayed put fit at 1.00 to 1.02; the 18 tests that moved from shard 2 to 1 read 0.92 in the base and 1.12 in the head, about 9 s of summed time), so I do not find the model's premise refuted; its input was noisy.

## RISK-023: does it now meet its fall condition?
The register (DL-134) says it falls to 3 (P 2) "when AQP-244's AC-3 passes (a median of five at most 5:00, the slowest at most 5:30, with misses replaced under DL-128 (4)), or when a nightly window of at least 13 runs reads a median of 5:00 or less. PR-run readings do not count", and goes back to 8 if a reading on a `master` commit goes over 5:30.

- **On the numbers, yes.** Five full runs, a cache hit in every job (no miss to replace): head median 4:37 and slowest 4:52; **the base on `master` 322cd8e (push run 42850365032) reads 4:41 and 5:17, which meets the same two lines.** Because the base is a `master` commit, the fall does not depend on whether a PR-ref reading counts. The nightly route is not used.
- **What the pass means.** The ceilings were already met before the cut, by AQP-243's cache and set-up cut and the DEF-023 fix. AC-3 (a) therefore says the post-AQP-243 baseline is under 5:00 and 5:30; it does not say the cut did it (PRF-02).
- **Margin is thin.** 23 s to 5:00 at the head (19 s at the base) with sd 16 to 21 s; 38 s to 5:30 at the head, 13 s for the slowest base run (5:17). At the ledger's +33 s per E2E-adding story (estimate; AQP-123 is already inside 322cd8e), the P 2 reading holds for about one more such story. The raise-again trigger (a `master` reading over 5:30) stays close.
- **My reading:** the fall condition is met as written. The decision and the wording of the score are master's (the register says "falls to 3 (P 2)", while P 2 times Impact 2 is 4; master to state the score).

## NFR impact

| NFR / item | Risk after this PR | Findings |
|-----|------|----------|
| NFR-009 CI feedback (p95 at most 10 min; 6:00 median warning; 5:00 / 5:30 ceilings of AC-3) | Met: median 4:37, slowest 4:52 (base 4:41 / 5:17). The cut adds no measurable time effect, either way. Residual: 23 s to 5:00, trend +33 s per E2E story | PRF-02, PRF-03 |
| Runner cost guard (test strategy 10.5 item 8, at most 1.30 times billed and raw) | None: 0.95 times (billed), 0.955 (raw); no job or step added | PRF-04 |
| AC-3 (c) shard balance (summed test seconds, max minus mean at most 35 s, proposed) | Passes on the median statistic (16 s), not robust: 29 s on means, 46 s host-free, 68 s modelled | PRF-01 |
| RISK-023 (score 6) | Fall condition met by the numbers; margin thin | PRF-02, PRF-03 |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `docs/04-architecture/test-strategy.md` 10.5 item 9, AC-3 (c) wording proposed in v0.31 (not a code line) | AC-3 (c); NFR-009 | The proposed line "max minus mean of the per-shard medians of five summed test seconds is at most 35 s" cannot discriminate. A shard's summed time has sd 72 to 121 s per run, so a median of five has a standard error of about 40 to 70 s (estimate, 0.56 sd); the line is below the noise floor of the statistic. Measured pass: 15.6 s on medians. The same ten head logs give 29 s on means of five (base 34 s), 46 s host-free (base 62 s) and 68 s modelled. The base reads 26 s on medians, so the line also passes before the cut | The 35 s test passes or fails by the draw of hosts. A future shard-balance story judged on it could be accepted or rejected for no reason in the code | Before the wording is adopted: name the statistic (mean of five, or the host-free fit) and print the sd beside it, or keep the figures as reported only. Judge balance on the test-step spread (8 s base, 6 s head) together with the active counts |
| PRF-02 | Info | `playwright.config.ts:41` (`OWN_WIDTH_FILES`) | AC-2, AC-3 (b) | The cut's effect on time cannot be shown by this sample and is probably near zero: path -4 s against an SE of about 15 s; head hosts were about 6.8 % faster, which by itself flatters the head by about 10 s of path (test work of about 146 s per shard, times 6.8 %; estimate), so the host-adjusted difference is about +6 s, and the work-based estimate is -4 s. To see a 12 s effect (the ruling's expectation) at sd 19 s needs about 40 runs per side, about 1,500 billed minutes in all (estimate) | Not a defect: the cut is harmless and removes 108 listing entries that cost nothing and a guard blind spot. It must not be quoted as the reason the path is under 5:00 | Accept as ruled (reported, not judged). Say in the decision log that the ceilings were met by the base and that the cut's value is structural, so RISK-023 is not credited to it |
| PRF-03 | Info | n/a (reading) | NFR-009; RISK-023 | Headroom to the ceilings is small in absolute terms: 23 s to 5:00 (head median), 13 s from the base's slowest run to 5:30, with a trend of +33 s per E2E-adding story (ledger, estimate) | One more E2E-adding story can take the median to the 5:00 line; the fourth-shard gate (median of five on `master` and the next nightly both over 5:00) is then in reach | No action now. Read the next `master` push as a median of five hit runs, as item 9 rules, and watch the nightly |
| PRF-04 | Info | `tests/unit/own-width-files.test.ts:88-89` (the `beforeAll` listing) | NFR-009 (cost only) | A third unit test file spawns `playwright test --list` (`one-width-tag` and `e2e-shards` already do), run once in `beforeAll`. Stage 6 median reads 25 s (base) and 31 s (head), range 24 to 32 on both sides, so the added time is not separable from noise; `Stages 1 to 11b` median 2:56 against 3:24 (means 3:05 against 3:12) | Off the path: `Stages 1 to 11b` ended 43 s or more before the last shard in all ten runs. Cost is a few runner seconds per run, well under 1 % of 18 billed minutes (estimate) | None. If `Stages 1 to 11b` ever nears the shards (slack is 43 s at the least), one shared listing for the three files is the first saving |

## Considered and not flagged
- **Hard-coded two-file list:** a third spec with the skip line fails the source-scan guard (a), so the listing cannot silently grow zero-cost entries again; adding a file needs a ruling. Fine for performance.
- **Shard balance by listing:** Playwright shards `fullyParallel` tests by listed count; the cut brings the active counts to within 6 of their mean (was 26; listed counts differ by at most one) but does not balance work; the project order is unchanged (mobile, then tablet, then desktop), so shard 3 stays the desktop shard. Revisit only on the measured test-step spread, as v0.31 rules.
- **`--list` cost in CI:** not on the path (see PRF-04). **No `ci.yml` change,** no new dependency, no runtime or `src/` change, so memory, I/O, DB and front-end checks have nothing to apply to.

## Issues for other roles
- **solution-architect / product-owner:** PRF-01 before the AC-3 (c) wording is made lasting; PRF-02 for the decision text.
- **master:** RISK-023 score wording ("falls to 3 (P 2)": P 2 x I 2 = 4) and whether to credit the fall to AQP-243 plus the DEF-023 fix rather than to this cut.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-244/performance.md` (branch `docs/AQP-244-review-performance`, no PR)
- Jira / GitHub updates: PR #166 review (COMMENT), label `review:performance-approved`; hand-off comment on AQP-244
- Open questions: none
- Risks raised: none new; RISK-023 reading above
- Recommended next agent: master (G6 decision once the quality review is in); solution-architect for PRF-01
