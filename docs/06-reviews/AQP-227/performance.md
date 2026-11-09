# Review Report — AQP-227 (STORY-10.17) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-227-three-shards` (PR #124, base 3695f90) |
| Commit reviewed | fe520d2 |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The developer's figures reproduce from the job timestamps: median path 4:37 against the 4:45 target, billed 1.20 times and raw 1.19 times the two-shard base, queue wait 2 to 4 s in all 37 jobs of all 8 runs, 0 flaky tests, Stage 12a a hit in every shard. Nothing in the diff (one matrix line, one pin, one assertion, comments) can slow a run or a request, and no NFR-009 limit is at risk. The 4:37 sits above the architect's 4:05 to 4:30 only because the estimate described the average shard (3:54 measured) and the path is the slowest shard (4:26). That leaves 53 s to the 5:30 trigger, which is about two stories of the size ahead, not three to four, and the third masters story (02.02, AQP-142) is the one expected to cross it. A duration-aware or project-aware split is not worth building (best case 17.5 s of path, mean of five runs); the set-up cut already ranked first in test strategy 10.5 is the lever that matters, and `Stages 1 to 11b` now bounds anything a fourth shard could buy.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 (PRF-01, PRF-03) |
| Info | 3 (PRF-02, PRF-04, PRF-05) |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git fetch origin feat/AQP-227-three-shards`; `git diff origin/master...origin/feat/AQP-227-three-shards` | 3 files: `ci.yml` (+8/-5), `ci-workflow.test.ts` (+4/-5), `e2e-shards.test.ts` (+18). Head = fe520d2 |
| Jobs per attempt | `gh api repos/sankumar76/Accucut-Quotation/actions/runs/{42493817041,42513656141}/attempts/{1..5}/jobs` | Base 3 attempts, head 5 attempts. Path = earliest job start to end of `Stages 1 to 11`; raw = sum of job durations; billed = sum of each job rounded up to a whole minute. Queue = `started_at - created_at` |
| Step times | same JSON (`steps[]`) | Set-up against test time per shard (below) |
| Playwright counts, cache state, flaky | `gh run view {run} --attempt {n} --log` filtered for `passed`, `skipped`, `flaky`, `Cache hit for` | See Evidence 4 and 5 |
| Repo visibility | `gh repo view --json visibility` | PUBLIC (billed minutes are theoretical, A-2; the guard still applies) |
| Other reviews | `gh api pulls/124/reviews` | One submitted review (standards, COMMENT); none pending |
| Not run | Unit tests, build, local Playwright | No `node_modules` in the review worktree; CI is green on fe520d2 |

## Verification of the developer's figures (all reproduce)
| Claim | Recomputed | Result |
|-------|-----------|--------|
| Base paths 6:30, 3:53, 5:36; median 5:36 | 6:30, 3:53, 5:36 | Match |
| Base billed 17, 12, 15 | 17, 12, 15 | Match |
| Head paths 4:37, 4:26, 4:39; median 4:37 | 4:37, 4:26, 4:39 | Match |
| Head billed 17, 18, 20 | 17, 18, 20 | Match |
| Attempts 4 and 5: 4:44 and 4:21 | 4:44 and 4:21 (billed 18 and 18) | Match |
| Billed 1.20 | 18 / 15 | Match |
| Raw 1.19 | 15.3 / 12.9 = 1.186 | Match |
| Queue wait 2 to 4 s | min 2 s, max 4 s over 37 jobs (12 base, 25 head) | Match |
| Shard spread up to 85 s | 34, 66, 32, 81, 85 s | Match |
| Shard 1 slowest in 4 of 5 | Shards 1, 1, 2, 1, 1 (in attempt 3 shard 2 led shard 1 by 4 s) | Match |
| Spread over 45 s in 3 of 5 (hand-off 11213) | 66, 81, 85 s | Match |
| 0 flaky, Stage 12a hit in every shard | 0 `flaky` lines in 5 logs; 3 Playwright and 3 system-package cache hits in each | Match |

Two readings the PR should carry, neither a defect: (a) The mean-based ratios are higher than the median-based ones: billed 18.3 / 14.7 = 1.25, raw 15.7 / 12.2 = 1.29. They are far under the 1.60 limit, so AC-6 passes however it is read. (b) The five head runs were made in one 24-minute window (19:10 to 19:34 UTC) and the base's first attempt was made about four hours earlier (15:14 UTC). That is the AC-5 method, but it means the head's 10 s spread is a short-window figure (PRF-05).

## Evidence
### 1. Runs
| Run | Path | `11b` | Shard 1 | Shard 2 | Shard 3 | Shard spread | Slowest | Billed | Raw (min) |
|-----|------|-------|---------|---------|---------|--------------|---------|--------|-----------|
| Base 1 (N=2) | 6:30 | 3:15 | 6:23 | 4:08 | n/a | 135 s | 1 | 17 | 13.8 |
| Base 2 | 3:53 | 2:42 | 3:46 | 3:13 | n/a | 33 s | 1 | 12 | 9.8 |
| Base 3 | 5:36 | 3:59 | 5:30 | 3:21 | n/a | 129 s | 1 | 15 | 12.9 |
| Head 1 (N=3) | 4:37 | 2:47 | 4:30 | 4:00 | 3:56 | 34 s | 1 | 17 | 15.3 |
| Head 2 | 4:26 | 3:43 | 4:20 | 3:14 | 3:20 | 66 s | 1 | 18 | 14.7 |
| Head 3 | 4:39 | 4:08 | 4:28 | 4:32 | 4:00 | 32 s | 2 | 20 | 17.2 |
| Head 4 | 4:44 | 4:00 | 4:36 | 3:15 | 3:42 | 81 s | 1 | 18 | 15.6 |
| Head 5 | 4:21 | 4:04 | 4:11 | 3:38 | 2:46 | 85 s | 1 | 18 | 14.7 |

Head: median 4:37, mean 4:33, standard deviation about 10 s. Base: mean 5:20, standard deviation about 79 s. The path is the slowest shard plus about 7 s (start offset, fan-in wait, fan-in).

### 2. Where a shard's time goes (step durations from the jobs API)
| Step | Shard 1 (head, 5 runs) | Shard 2 | Shard 3 |
|------|------------------------|---------|---------|
| `npm ci` + `prisma generate` | 62 to 66 s | 40 to 66 s | 41 to 65 s |
| Playwright E2E step | 147 to 155 s (mean 152) | 110 to 155 s (mean 127) | 85 to 131 s (mean 112) |
| Everything else (containers 11 to 17 s, build 4 to 7 s, caches 2 to 8 s, roles, migrate, seed) | 40 to 53 s | about 40 s | about 40 s |

- Mean shard job 3:54. Slowest shard, mean 4:26. The 32 s between them is why 4:37 is above an estimate that was made for the average shard (Judgement 1).
- Shard 1's test step is steady (147 to 155 s in 5 of 5). Shards 2 and 3 move by 30 to 45 s between runs. Shard 1's install was 62 s or more in 7 of 8 runs; shard 2's was 58 s or more in 2 of 8 and shard 3's in 3 of 5. I cannot tell whether that is chance or something about shard 1's job; the runner names are generic. It matters to Judgement 2: moving tests off shard 1 would not help if shard 1 simply tends to land on a slower machine.
- The largest fixed cost is `npm ci`, in each of four jobs: 38 to 66 s each, about 3.7 runner minutes per run, about a quarter of raw time.

### 3. Counts
Listed per shard: 159 / 159 / 158 (head), 237 / 236 (base). Passed per shard: 157 / 157 / 141 (head). Shard 3 holds 17 skipped tests (desktop), shards 1 and 2 hold 2 each. The 10 % assertion counts listed tests, so it sees a near-perfect split while executed work is 157 / 157 / 141 (shard 3 is 7 % under the mean). Totals: base 473 listed, 452 passed; head 476 listed (setup runs in 3 shards, not 2), 455 passed.

### 4. Cache and flakiness
Stage 12a was a hit in all 15 head shard jobs and all 6 base shard jobs, with restore steps of 2 to 8 s. A third job restoring the same two keys at once shows no contention. In base attempt 1, shard 1's browser-cache restore took 47 s on a hit (shard 2: 8 s). That is a hit, so AC-5's "replace a run with a miss" rule would not catch it; it explains part of the 6:30. 0 flaky tests in all 5 head runs.

### 5. Queue wait
2 to 4 s in 37 of 37 jobs. All 8 runs were made one after another, so the concurrency case (four jobs per run, about five runs under way before a job waits; documentation-based and not checked on this account) was not exercised. It remains unverified and is not a finding.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `.github/workflows/ci.yml:254` | NFR-009 CI; RISK-023; AC-5; test strategy 10.5 | Median 4:37 meets 4:45 (8 s of margin; worst of five 4:44, 1 s) but is above the 4:05 to 4:30 estimate. The estimate is the mean shard (3:54 measured, so it was right); the path is the slowest shard (mean 4:26) plus about 7 s. Headroom to the 5:30 trigger is 53 s (46 s from the worst run), against the 60 to 85 s the estimate implied. 10.5 says the line is "three to four such stories away" from about 4:15; from 4:37 it is about two to three | Planning only; no NFR breach. At 0.47 s of path per added instance (estimate), 02.04, 02.05 and 02.02 together add 55 to 82 s, so the trigger fires at or after 02.02 (see the ledger in the notes) | No code change. Solution-architect: restate in 10.5 that the planning figure is the slowest shard (4:26 mean, 4:37 path), headroom 53 s, about two stories. Product-manager: use it in the release plan |
| PRF-02 | Info | `tests/unit/e2e-shards.test.ts:86` | NFR-009 CI; #116 PRF-02; AC-2 | Duration-aware or project-aware split: not worth building. Replaying the five head runs with each shard's test time set to the run's mean (an upper bound, tests treated as perfectly divisible) gives gains of 13, 32, 9, 26 and 7 s, mean 17.5 s. In practice about 10 to 12 s, because `Stages 1 to 11b` finishes within 7 to 36 s of the slowest shard in 4 of 5 runs and caps the gain. A project-aware split is today's split: the contiguous groups are already mostly one project each | 12 to 17 s of path for a script, its data and a rewritten AC-2 guard that someone has to maintain. This is the #116 estimate (about 15 s) confirmed on live data | None. Revisit only if, after the set-up cut, the slowest shard is more than 45 s behind `Stages 1 to 11b` in a median of three. The count assertion is a coarse tripwire (it sees listed tests, 157 / 157 / 141 executed); see STD-01 for its wording |
| PRF-03 | Minor | `.github/workflows/ci.yml:238` | NFR-009 CI; test strategy 10.5 step 2; AC-1 | The "fourth shard needs section 10.5 first" line points at a step whose figures are out of date. 10.5 says the first job "at 2:47 to 3:43" nearly binds and a fourth shard gains "40 s at most". `Stages 1 to 11b` is now 2:47, 3:43, 4:08, 4:00, 4:04 (median 4:00), within 7 to 36 s of the slowest shard in 4 of 5 runs. A fourth shard would save about 15 to 25 s (model: mean test step 162 s at N=2, 130 s at N=3, about 115 s at N=4; estimate) for about +22 % runner time (3 to 4 more runner minutes per run). The only lever that shortens both `11b` and every shard is the set-up cut that 10.5 already ranks first: `npm ci` + `prisma generate` at 38 to 66 s in each of four jobs | No defect in this PR. The next enabler is worth about 20 to 30 s of path and 1.5 to 2 runner minutes per run if install is halved (estimate), against 15 to 25 s of path for a fourth shard at about +22 % cost | Solution-architect: update the fourth-shard figures in 10.5. Product-manager and scrum-master: have the set-up-cut enabler Ready before AQP-142 (02.02) starts. Developer of that story: time `npm ci` against a `node_modules` restore first (`npm ci` deletes `node_modules`, so a plain cache of it must replace the install step, not precede it) |
| PRF-04 | Info | `.github/workflows/ci.yml:242` | NFR-009 CI; Review checklist 8 (observability) | Nothing records the per-shard times. The trigger (5:30, median of three) and the spread rule (45 s) were read here by pulling the jobs JSON by hand, as the developer did. The nightly step reports the path only | The next trigger decision depends on a manual extraction that is easy to get wrong (for example sharing one set of billed minutes) | Not in this PR (10.5 says the measure code does not change). In the set-up-cut story or the nightly: add to the job summary the slowest shard, its set-up and test split, and the gap to `Stages 1 to 11b`. Cheap, and it makes PRF-01 and PRF-03 readable from the report |
| PRF-05 | Info | PR description, AC-5 and AC-6 evidence | AC-5; AC-6 | The base is too noisy to credit the shard with a 59 s saving (5:36 to 4:37). Base runs span 3:53 to 6:30 (standard deviation about 79 s); the fastest base run beat every head run. The shard's real effect is on spread: head standard deviation about 10 s, and the worst run fell from 6:30 to 4:44. The head's 10 s comes from one 24-minute window; the base's first attempt was made four hours earlier and had a 47 s browser-cache restore on a hit | If the 59 s is quoted in planning, it overstates the gain; the measured mean gain is 46 s (5:20 to 4:34) and the median gain 59 s, both inside the base's noise | Carry in the PR and in 10.5: "at N=3 the path is steadier (about 10 s against 79 s over short windows), not 1:30 shorter". Read the first nightly after merge for the real variance; AQP-123's G6 should be measured against a fresh N=3 base commit, not this 4:37 |

<details><summary>Detailed notes</summary>

### PRF-01: why the estimate was right and the result still higher
Mean shard job 3:54 (head, 15 jobs). The test-step mean is 130 s (2.17 min), which is the 2.2 min the PRF-02 estimate of AQP-122 used; set-up (the rest of the job) is 80 to 118 s. The path is the largest of three shards, not the mean. Mean of the slowest shard per run: 4:26. Mean of the three: 3:54. Gap 32 s. Shard 1's test step is 22 s above the three-shard mean, constantly (147 to 155 s), and its install is the slow kind (62 to 66 s) in 5 of 5. So the estimate error is the max-of-three effect, and most of it is structural to shard 1.

Headroom ledger (estimates; start 4:37; slope 0.47 s of path per added instance = 1.4 s of shard time per instance from AQP-122 PRF-02, divided by 3, the same figure as the product-manager's; instances = tests x 3 widths, my counts from the ACs, AQP-122 added 48):
| Story | Size | Instances (est.) | Path added | Cumulative |
|-------|------|------------------|------------|------------|
| 02.04 AQP-123 | 2 pts, one tab, 7 ACs, plus the `@one-width` commit (-2 to -3 s) | 30 to 45 | +11 to +19 s | 4:48 to 4:56 |
| 02.05 AQP-130 | 2 pts, one tab, 8 ACs (delete dialog, keyboard) | 35 to 45 | +16 to +21 s | 5:04 to 5:17 |
| 02.02 AQP-142 | 5 pts, list and edit pages, rates table, reset dialog, 3 widths | 60 to 90 | +28 to +42 s | 5:32 to 5:59 |

If the true slope is half (0.24 s, which is the more favourable end), the three stories add about 26 to 40 s and end at 5:03 to 5:17. Either way the first two stories fit, and 02.02 is the one that can bring the median of three to 5:30. Cushions that are not in the ledger: one slow cache restore costs 40 to 47 s (a first attempt of 5:20 to 5:25 today); the re-run rule (median of three) absorbs it. If shard 1's slow draw is chance, the 4:37 is a pessimistic baseline; if it is systematic, it is the real one.

### PRF-02: replay method
For each head attempt: take each shard's E2E step duration, replace it by the mean of the three shards' E2E steps in that attempt, keep every other step, recompute the path as the latest of the three shard ends and the end of `Stages 1 to 11b`, plus the observed fan-in tail. This ignores that tests are not freely divisible and that set-up varies, so it is a ceiling. Attempt 3 would be a mix: shard 2 would not improve (it was the slowest by 4 s).

### PRF-03: model behind the fourth-shard figure
Test-step means: 161.7 s over 6 shard observations at N=2 (base), 130.3 s over 15 at N=3 (head). Solving `f + W/N` gives f about 68 s per shard (set-up project, route warm-ups and the dev server, replicated in every shard) and W about 188 s of shared work. At N=4: 68 + 47 = 115 s, 15 s below N=3. The data are noisy (runner draws move a shard by 25 to 70 s), so treat 15 to 25 s as a range, not a forecast. The per-shard `f` also says the split gains less than 1/N, which is part of why the path moved by 46 to 59 s and not 90 s.
</details>

## Judgements asked for
### 1. Does 4:37 against 4:05 to 4:30 matter?
Not for the story: AC-5 (4:45) is met, and the 4:05 to 4:30 was an expectation, not a limit. It matters only for what follows. Headroom to the 5:30 trigger is 53 s, which is about two stories of this size at the current slope, where 10.5 implies three to four. Say so in 10.5 (PRF-01). The estimate's logic was sound for the average shard; the path is the slowest one.

### 2. What does the shard spread mean for the 5:30 trigger? Is a duration-aware or project-aware split worth it now?
- **The trigger is reliable at this level.** The path is steady at N=3 (standard deviation about 10 s over five runs), because shard 1's test step is steady. A median of three full runs reaching 5:30 will mean the structure moved, not the weather. Keep the re-run confirmation: one slow cache restore (+40 to 47 s) puts a first attempt near 5:25 to 5:30 today.
- **The 85 s spread is mostly shards 2 and 3 being fast or slow in a given run, not shard 1 being slow.** Only about 22 s of it is the structural excess of shard 1; the rest is runner draw. A split fixes the 22 s; nothing in this PR fixes the draw.
- **Not worth it now (PRF-02).** Best case 17.5 s of path, realistically 10 to 12 s, capped by `Stages 1 to 11b`, which is within 7 to 36 s of the slowest shard in 4 of 5 runs. A project-aware split changes nothing, since the contiguous groups are already project-shaped. The cost is a script, a data file and a new guard. The architect's no-weighting ruling stands.
- **What to do instead:** the set-up cut (PRF-03), because it shortens `11b` and all three shards at once. A fourth shard is worth less than 10.5 says.

### 3. Headroom for 02.04, 02.05 and 02.02
See the ledger under PRF-01. In short: 02.04 lands at about 4:48 to 4:56, 02.05 at about 5:04 to 5:17, and 02.02 at 5:32 to 5:59 (upper slope). The trigger most likely fires at or just after 02.02. Because a 2-point enabler is built in one idle wait, it is cheapest to have the set-up-cut story Ready before AQP-142 starts, and to start it if either of the first two stories reaches 5:15 on a first attempt (my suggestion, not a rule in 10.5). 6:00 stays a warning (DL-102, DL-103); no hold is implied.

## Reviewer-specific tables
### NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 CI feedback, p95 at most 10 min, 6 min median warning, 5:30 trigger | Low now (median 4:37, worst 4:44, 53 s to the trigger); Medium when 02.02 merges | PRF-01, PRF-02, PRF-03, PRF-05 |
| NFR-009 first-load JS (200 KB gzip) | Not touched by this PR | none |
| Runner-minutes guard (AC-6; test strategy 10.5 section 4; not an NFR ID) | Low: 1.20 (median) to 1.29 (mean) times the base against a 1.60 limit; repository is public | PRF-05 |
| NFR-025 (maintainability: files at most 400 lines) | Not a performance matter; the standards reviewer notes `ci-workflow.test.ts` at 386 of 400 lines (STD-07) | none |
| NFR-016 (every E2E test keeps running) | No test dropped: 473 listed at N=2, 476 at N=3 (the 3 extra are the `setup` project, once per shard); 21 skipped in both | none |
| Observability | The trigger is read by hand from the jobs JSON | PRF-04 |
| RISK-023 (CI time) | Stays at 6 until 02.02 is measured | PRF-01, PRF-03 |

## Previous Findings (carried from AQP-122, PR #120)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| PRF-02 (AQP-122, restated as PRF-08) | Minor | **Addressed by this PR once merged** | N=3 on master after merge; 3-run median 4:37 (target 4:45); the AQP-122 estimate for N=3 (about 4:05 to 4:30) was 7 to 32 s optimistic for the reason in PRF-01 here |
| PRF-08 (AQP-122) | Minor | Closed with the above | The 3-shard enabler is this story; its test-strategy text must land before merge (see STD-05) |

## Issues for other roles
- **solution-architect:** (1) 10.5 "Three shards" item 3 and the "from about 4:15" line: headroom 53 s, about two stories (PRF-01). (2) 10.5 step 2: the fourth-shard figures use a first job of 2:47 to 3:43; it is now 2:47 to 4:08 and the gain is 15 to 25 s (PRF-03). (3) Concur with the developer's note and STD-01: the 10 % assertion does not trip on a per-file split on this suite and counts skipped tests (157 / 157 / 141 executed); 10.5's wording on what it detects needs a change. (4) Architecture 9.2 still describes two shards (PO note 4, 11203).
- **product-manager / scrum-master:** have the set-up-cut enabler Ready before AQP-142 starts (PRF-03); add the 53 s headroom and the two-story reading to the release plan 3.13.
- **orchestrator:** AQP-123's G6 should measure its path against a fresh `master` run at the merged N=3 base, and say its base commit and shard count (already in AQP-123's Dev Context).
- **developer:** no change requested for performance. The standards reviewer's items stand on their own (STD-01 to STD-08).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-227/performance.md` (main folder, not committed)
- Jira / GitHub updates: PR #124 COMMENT review at fe520d2 with inline comments PRF-01 to PRF-04 (PRF-05 in the body); label `review:performance-approved`; Jira AQP-227 "🤖 reviewer-performance — G6"
- Open questions: none
- Risks raised: RISK-023 stays at 6, expected to reach the 5:30 trigger at or after 02.02 (AQP-142)
- Recommended next agent: orchestrator — consolidate the three reviews; master — G6 once reviewer-standards' STD-01 is fixed. Findings by severity: Blocker 0, Critical 0, Major 0, Minor 2, Info 3
