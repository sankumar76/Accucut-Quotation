# Review Report — AQP-276 (STORY-10.22) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-276-fourth-shard` (PR #336; base master 3f22672) |
| Commit reviewed | 0c8b898 |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The diff does what the story says and nothing more: one matrix element (`shard: [1, 2, 3, 4]`), comments that said "three", and the two pins that read that line. It touches **no `src/` file and no runtime helper** (3 files, +14 / -14), so the narrow route (DL-179 (2)) holds. Nothing in it can threaten the 1.30 times cost limit or the shard balance by itself: the fourth shard is the same job as the other three, the command still reads N from `strategy.job-total`, and `e2e-shards.test.ts` passes unedited. The one-run readings agree with the model (path 4:12 against 5:40, raw runner time 1.04 times, billed about 1.05 to 1.15 times).

The AC-4 to AC-7 ten-run measure is not taken (it waits for AQP-142, DL-180), so **performance is verified structurally and by one run only; the pass lines are not yet shown.** The one finding that matters for that measure is PRF-01: the 5:00 line was calibrated on a window that does not yet hold AQP-142's 53 new E2E instances, and the measure is taken after they land, so a median of 4:50 to 5:10 is the honest expectation (estimate), not 4:35 to 4:50. That is a plan note for the solution-architect, not a defect in the diff.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff scope | `gh pr diff 336 -R sankumar76/Accucut-Quotation`; PR `changed_files` | 3 files: `.github/workflows/ci.yml` (matrix line and comments), `tests/unit/ci-workflow.test.ts`, `tests/unit/ci-workflow-shards.test.ts`. No `src/`, no `tests/e2e/**`, no `playwright.config.ts`, no `PWTEST_*`, no `include`/`exclude`/`max-parallel`. Narrow route confirmed |
| Workflow at head | `git show 0c8b898:.github/workflows/ci.yml` | `e2e` strategy block is `fail-fast: false` + `shard: [1, 2, 3, 4]`; `--shard="${SHARD_INDEX}/${SHARD_TOTAL}"` with `SHARD_TOTAL: ${{ strategy.job-total }}`; 4 workers, `retries: 1` in `playwright.config.ts` unchanged; `required` fan-in unchanged; `timeout-minutes: 30` per shard unchanged |
| Job timings, read-only | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/{43197966408,43202416203}/attempts/1/jobs` | Computed below (cost, balance, slack). Reads only; no run re-run, cancelled or started |
| Repository visibility | `gh api repos/sankumar76/Accucut-Quotation` | `private: false` (public). Standard-runner minutes are not billed on a public repository (story A-3, documentation-based; not verified by me) |
| Tests / CI | Not run by me | Brief forbids starting CI. I read the PR's evidence: run 43202416203 green (5 of 5 jobs + fan-in, no cache miss), 42 tests green in the four CI-guard files, plants fail both pins, controls #337 and #338 as described. Local unit timeouts (`playwright-system-deps`) are the developer's Windows note, untouched by the diff |

### Numbers behind the estimates (from the jobs API, attempt 1)
| | Base, master 3f22672, run 43197966408 (3 shards) | Head, 0c8b898, run 43202416203 (4 shards) |
|---|---|---|
| `Stages 1 to 11b` | 219 s | 202 s |
| Shard durations | 270 / 329 / 218 s | 240 / 197 / 199 / 240 s |
| Fan-in | 7 s | 7 s |
| Path (first start to fan-in end) | 340 s = 5:40 | 252 s = 4:12 |
| Raw runner time (sum of jobs) | 1,043 s = 17.4 min | 1,085 s = 18.1 min (**1.04 times**) |
| Billed, each job rounded up to whole minutes | 20 min | 21 to 23 min (two shards sit at 4:00 on the 4-to-5 minute boundary) (**about 1.05 to 1.15 times**) |
| Slowest shard to `11b` slack | 110 s (shard 2 ended 1:50 after 11b) | 38 to 39 s |
| Sum of Playwright wall per shard (Dev Record) | 10.8 min (3.6 + 4.5 + 2.7) | 10.7 min (2.8 + 2.3 + 2.4 + 3.2) |

One run each, different events and hosts: **information, not the AC-4 / AC-5 measure.** Billed minutes are my estimate from start and end times; the Actions "billable" endpoint was not used.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `.github/workflows/ci.yml:330` (the line the measure judges); test strategy §10.5 item 12 item 4 | NFR-009 / AQP-244 AC-3 (a) ceilings; AC-4; RISK-023 | The AC-4 line (median of five at most 5:00, slowest at most 5:30) rests on a model of 4:35 to 4:50 taken from the 20-run window (median 5:18). That window predates AQP-142's merge. The measure runs **after** AQP-142 merges (DL-180 (2), AC-9), and AQP-142 adds 53 E2E instances (DL-172 (1): 861 against 808 passed), which reviewer-performance attributed 19 to 28 s of path at three shards (DL-173 (1), estimate). Scaled to four shards (the cost per instance is split over four, not three) that is about +14 to +21 s. Master has also grown 808 to 820 passed since 6b1883f (+12, a few seconds). | Expected head median on the post-AQP-142 suite is about **4:49 to 5:11** (estimate; 4:35 to 4:50 plus 14 to 21 s), straddling the 5:00 line. Expected same-day base at three shards is about 5:37 to 5:46. A head median of 5:02 to 5:10 is therefore likely enough to occur even when the fourth shard performs exactly as modelled (about 40 s less), and it would be read as a miss or as the exit, not as suite growth. It also leaves almost no headroom for AQP-81, AQP-90 and AQP-148 (about 16 to 22 s each at four shards, estimate), so the "median at most 5:00" that lowers RISK-023 (DL-151 (5)) may not be reached soon even if this story works. | Before the measure starts, solution-architect restates in §10.5 item 12 the expected figure **on the post-AQP-142 suite** and the suite size of both sets (listed and active E2E counts, per shard), so a 5:00 to 5:15 result is read as "shard change worked, suite grew" with numbers. Do not move the pass line from here (the ruling is master's and the architect's). The PR already has AC-9 name AQP-142's merge commit; add the listed E2E count of base and head to the AC-7 figures. |
| PRF-02 | Info | test strategy §10.5 item 12 item 4 ("Host-draw exit"); AC-4 | AC-4 | The exit says "the base's median of five is at least 20 s slower" and names no comparator. Read as "slower than the head", it is satisfied whenever the shard change gains the expected 30 to 45 s, so it stops being a host-draw test. Read as "slower than the architect's window median (5:18)", it is. | A result of 5:08 can be waved through or blocked depending on the reading; the PR author cannot tell in advance. | Solution-architect states the comparator in one sentence before the measure (owner: solution-architect). |
| PRF-03 | Info | measure plan (T6, AC-4, AC-7); `ci.yml:39-43` concurrency; `ci.yml:432-438` Next.js cache step | NFR-009 method (§10.3); DL-128 (4); DL-173 (2) | Four things can contaminate ten runs, none in the diff. (a) A run now starts five parallel jobs, up from four. The path is read from the earliest `started_at`, so a shard that waits for a runner is counted. If the head and base sets overlap in time, or overlap the orchestrator's measure of PR #297, shared runner capacity can add queue wait to some runs (my assumption: the account's concurrent-job cap is not known to me; GitHub's Free plan is 20 standard Linux jobs, which is four runs of five). (b) Taking the base set first and the head set later puts a time-of-day host drift into the difference. (c) The `.next/cache` key is the hash of `src/**`; after AQP-142 merges it is new, so a head run started before master's own push run has saved it can read `miss` or fall back to the prefix key. (d) The `concurrency` group cancels an in-progress PR run on a new push, so five head runs made by pushing commits can cancel each other. | Each is an extra DL-128 (4) replacement or a distorted path, not a code defect. Cost: re-runs of ten runs. | Run base and head **alternately** (head, base, head, base, ...) and **one run at a time**; start only after the post-merge master push run has finished (so the cache key exists); report each job's queue wait (AC-7 already asks) and replace any run with a shard queue wait over a few seconds, as for a cache `miss`; make the repeats re-runs of one head commit, not new pushes. |
| PRF-04 | Info | `ci.yml:330`; AC-5 | AC-5 (1.30 times); AQP-208 AC-6 (2.5 times guard) | Cost. A fourth shard adds one job of the same shape: about 54 to 68 s of fixed work (checkout, restore, `prisma generate`, `next build`, migrations, stage 12a) plus a PostgreSQL service start, with the test work unchanged (sum of Playwright wall 10.8 against 10.7 min, so no contention cost). Raw ratio expected about 1.06 to 1.11; observed 1.04 on one pair. Billed is the noisy one: each job is rounded up to a whole minute and two head shards sit exactly at 4:00, so each can bill 4 or 5. | Billed per run is 21 to 26 min for the head against 19 to 22 for the base; extremes give 0.95 to 1.37 times, but a median of five narrows that, and the expected 1.05 to 1.25 holds. The diff does not threaten 1.30 times; only an unlucky pair of medians could. The repository is public, so the limit is a capacity guard rather than money (A-3, unverified by me). | No change. Report both ratios and the per-job rounding in AC-7, and read raw minutes first if billed lands in 1.25 to 1.35. |
| PRF-05 | Info | `ci-workflow-shards.test.ts`, `e2e-shards.test.ts`; AC-6; run 43202416203 | AC-2, AC-6, AC-7 | Balance. By count the split is as even as it can be (212 / 212 / 212 / 211 listed; the width-test counts differ by at most one, guard green). By time it is not: shards 1 and 4 ran 240 s, shards 2 and 3 ran 197 to 199 s, and shard 4 holds the desktop tail (194 passed and 17 skipped; its Playwright wall was the longest at 3.2 min). Spread max to min is 43 s, against 111 s at three shards (218 to 329 s). | The path is the slowest shard plus about 10 s, so a systematically heavy shard 4 costs 40 s of path against the others. This is by design (AC-6 forbids a custom or weighted split and any change to the `@one-width` allow-list, `OWN_WIDTH_FILES`, `PARTLY_DESKTOP_ONLY`). | No change. In the AC-7 per-shard table, state how many of the five head runs had shard 4 (or the same shard) slowest. If it is the slowest in 4 or 5 of 5, record it as structural so the architect can weigh it against the next E2E-adding story (placement of an own-width file is the lever that exists; weighting is not). |
| PRF-06 | Info | `ci.yml:312` ("A fifth shard needs section 10.5 first"); item 11 | RISK-023; test strategy §10.5 items 9, 11, 12 | Ceiling. Slack of the slowest shard to `Stages 1 to 11b` is 38 to 39 s on this run (model: 50 to 60 s). With `11b` median 216 s, a fifth shard (rest of shard about 54 s plus W/5, W about 472 s) would run near 150 to 180 s, below `11b`; the path floor becomes `11b` plus 10 s, about 3:46. | A fifth shard would save at most about 40 s more, for another 54 to 68 s of raw time, and the main job would then set the path. The comment is right that a fifth shard needs §10.5 first. Item 11's 20 s slack threshold is the sign to look at `Stages 1 to 11b` before adding shards. | None for this PR. For the architect's next §10.5 record: after this step the next lever is `Stages 1 to 11b`, not a fifth shard. |

<details><summary>Detailed notes & code suggestions</summary>

### PRF-01 arithmetic (all estimates)
- Model at N = 4 (item 12): path falls 30 to 45 s from 5:18, so 4:33 to 4:48; the story rounds to 4:35 to 4:50.
- AQP-142 share at N = 3: 19 to 28 s (DL-173 (1), reviewer-performance). The share is mostly test work, so at N = 4 it is 19 to 28 x 3/4 = 14 to 21 s. A pure proportional reading (53 of about 835 instances x W 472 s) gives only about 30 s of work, 8 s of path at four shards; I use the larger, measured-attribution range and note the smaller.
- Master since 6b1883f: 808 to 820 passed (+12), about +3 to +5 s of path at four shards.
- Head median expected: 4:35 to 4:50 + 0:14 to 0:21 (+ 0:03 to 0:05) = 4:52 to 5:16 at the extremes, 4:49 to 5:11 as the working range. The single head run on 3f22672 (before AQP-142) read 4:12, 25 to 40 s under the model, which is one run and a good draw; it should not be used to relax this.
- Standard error of a median of five is about 20 s (item 12). A true median of 5:00 gives about a one-in-two chance of a sample median above the line; the exit covers 5:00 to 5:15 only when the comparator in PRF-02 is met.
- The slowest-of-five line (5:30) has no exit. At three shards the 20-run window had 1 run over 6:10 (6:37, AQP-142's own), which is what 5:30 at four shards corresponds to; with five runs that is roughly a one-in-five chance of one outlier. The DL-128 (4) replacement covers a cache `miss` or `fallback`; whether it covers a slow-host outlier is not said. Worth one sentence from the architect alongside PRF-02.

### Why the diff itself is safe for the cost limit and the balance
- `shard: [1, 2, 3, 4]` is the only behavioural change. Everything that scales with the count (the `--shard` argument, the job name, the fan-in's `needs`) reads `strategy.job-total` or the `e2e` matrix result; nothing hard-codes N (pinned by `ci-workflow.test.ts` lines 193-194 and `ci-workflow-shards.test.ts`).
- The two pins cannot be satisfied by a different count: the exact-block pin fixes the whole `strategy` block, so an `include`, `exclude`, `max-parallel` or second dimension (each of which changes the real number of jobs, hence cost and balance) fails it.
- The test-file edits are string and comment changes in two files that read `ci.yml` once; run time is negligible. `ci-workflow.test.ts` stays at 396 lines.
- Shared cache keys (`node_modules`, `.next/cache`, Playwright browsers and debs) are the same for all shards, so a fourth shard adds no new cache entries and cannot grow the repository's cache beyond its current set.
</details>

## Reviewer-specific tables
- **Performance:** NFR impact

| NFR / limit | Risk | Findings |
|-------------|------|----------|
| NFR-009 (required path p95 at most 10 min; 6:00 median warning) | Low. Single-run path 4:12 (head) against 5:40 (base); the change can only shorten the path unless a runner queue forms. No limit near. | PRF-03, PRF-06 |
| AQP-244 AC-3 (a) ceilings, AC-4 here (median at most 5:00, slowest at most 5:30) | Medium for the **measure**, not for the diff. Expected post-AQP-142 median 4:49 to 5:11 straddles the line; the slowest-run line has no exit. | PRF-01, PRF-02, PRF-03 |
| DL-151 cost limit, AC-5 (at most 1.30 times billed and raw) | Low. Observed raw 1.04, billed about 1.05 to 1.15 on one pair; expected 1.05 to 1.25. Billed is sensitive to the minute boundary. | PRF-04 |
| AQP-208 AC-6 guard (2.5 times the one-job runner time) | Low. 1.87 times x 1.30 = 2.43 at the limit; observed ratio well under. | PRF-04 |
| Shard balance (`e2e-shards.test.ts`; AC-6) | Low by count (212 / 212 / 212 / 211); moderate by time (43 s spread, shard 4 heaviest). Within the design. | PRF-05 |
| NFR-016 (every E2E test keeps running) | Low. 847 listed over four shards less 12 per-shard `setup` = 835 real tests, same as 844 less 9 at three; passed 823 against 820, skipped 24 against 24. | none |
| RISK-023 (stays at 8 until a median of 5:00 or less is read, DL-151 (5)) | The merge does not lower it. Headroom after AQP-142 and the next three E2E-adding stories is thin. | PRF-01, PRF-06 |

## What the AC-4 to AC-7 measure must show (to be read when it is taken)
1. **AC-4:** head median of five at most 5:00 and slowest at most 5:30 (or the exit, once PRF-02 is stated). Read beside **head minus base**, which should be 30 to 45 s on equal suites; if it is, a miss on the absolute line is suite growth (PRF-01), not a shard failure.
2. **AC-5:** billed and raw minutes, each a median of five, at most 1.30 times the same-day base; read raw first (PRF-04).
3. **AC-6:** 0 flaky tests in the head's five runs; nothing dropped or retried; per-shard listed counts as in the Dev Record (about 212 each plus `setup`).
4. **AC-7 additions I ask for:** the listed E2E count of base and head; the slowest shard of each run and how often it is shard 4 (PRF-05); the slack of each run against `Stages 1 to 11b` (PRF-06; under 20 s means look at the main job first); queue wait per job (PRF-03); and the interleaved run order.
5. **Preconditions:** same-day base with no test-adding merge between the sets; the post-merge master push run finished so the Next.js cache key exists; runs one at a time and not overlapping #297's measure.

## Previous Findings (re-review only)
Not applicable (round 1).

## Issues for other roles
- **solution-architect:** PRF-01 (restate the expected figure on the post-AQP-142 suite before the measure) and PRF-02 (name the comparator of the host-draw exit; say whether the slowest-run line has a replacement rule). Test strategy docs/04 is the architect's.
- **orchestrator:** PRF-03 (run order and spacing of the ten runs; keep them clear of the PR #297 measure).
- **reviewer-standards:** cross-check only that the ci.yml comments that still say "three" are about widths (the diff leaves lines 506, 511, 517 alone, as the story says).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-276/performance.md` (not committed; the orchestrator commits it)
- Jira / GitHub updates: PR #336 review (COMMENT, verdict in body, 2 inline comments); label `review:performance-approved`; hand-off comment on AQP-276
- Open questions: none (PRF-01 and PRF-02 are for the solution-architect)
- Risks raised: none new; RISK-023 stays at 8 (PRF-01 notes thin headroom)
- Verdict: APPROVE WITH COMMENTS · Blocker 0, Critical 0, Major 0, Minor 1, Info 5
- Recommended next agent: reviewer-standards (second narrow-route report), then master for G6; solution-architect for PRF-01 and PRF-02 before the AQP-142-dependent measure
