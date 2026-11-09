# Review Report — AQP-57 (STORY-01.03) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-57-engineer-projection-scan` (PR #115, sankumar76/Accucut-Quotation) |
| Commit reviewed | ff9d9a3d71b4dae191ad5dba00aefdaf36d634e4 |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary

The change adds no measurable runtime cost to the product. `withRoute` already parsed every answer with its schema (`with-route.ts:164` is unchanged context); the PR only exposes that schema as a property, once, at module load. No schema file changed, no client code changed (Stage 11b is byte-identical to master), and the only Engineer-reachable API route today is `/api/v1/me`. The cost is in CI: the scan and the warm-up add 17 test runs (about 27 to 29 worker-seconds, about 2 % of the 1,238 to 1,368 worker-seconds of a run) and the required path is 5:47 and 5:22 on the two runs that count, the slowest first attempt in the last 17 PR runs but still 13 s under the 6:00 early warning. Nothing here breaches NFR-009 or NFR-010 or needs a change before merge. Three Minor findings (CI headroom, shard balance, scan test growth) and six Info items are recorded; none is a condition.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 (PRF-01, PRF-02, PRF-03) |
| Info | 6 (PRF-04 to PRF-09) |

## Checks Run

All inspection was read-only: `git fetch`, `git diff origin/master...ff9d9a3`, `git show`, `gh run view`, `gh api` (jobs, attempts), and one throw-away zod micro-benchmark run from the session scratchpad against the repository's installed zod (nothing written to the repository). The branch was not checked out.

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff scope | `git diff --stat origin/master...ff9d9a3` | 32 files; product code: `with-route.ts`, `schemas/index.ts`, `engineer-me.ts` (rename), `negative-control-gate.ts`, `test-only/leak/route.ts`, `me/route.ts`. Everything else is tests, CI, ESLint, README |
| Required path, this PR | `gh api .../runs/42463553178/attempts/{1,2}/jobs` | Attempt 1: 5:47 first job start to end of `Stages 1 to 11` (5:44 to the start of the fan-in job). Attempt 2: 5:22 (5:18). Attempts 3 to 5 reused attempt 3's shard results (same start 09:24:21, same end times), so their paths are not measurements |
| Required path, comparison | `gh api` on 24 recent PR runs and 5 `master` pushes | 17 successful first-attempt PR runs (test strategy 10.3 measure): median 4:59, p95 5:47, min 4:11, max 5:47 (this PR). `master` pushes: 4:38 to 4:55, median 4:45 (to the fan-in start) |
| Shards | job logs, attempts 1 and 2, and `master` run 42428217735 | See "Shard balance" |
| Scan cost | per-test lines of the four shard logs | See "Cost of the scan" |
| Stage 11b | log of attempt 1 vs `master` run 42428217735 | Identical bytes on every measured route |
| Zod cost | `node` micro-benchmark, zod 4.6.7, Node 24.19 | `/me` response: 4.9 us per parse; 100-entry audit page: 115 us |
| Not run | Playwright, the scan, Lighthouse, load test | No local database or `next start` in this review; scan time at scale is an estimate and labelled so |

## Developer figures, verified

| Figure (hand-off 11161) | Result | Evidence |
|---|---|---|
| Required path 5:44 (attempt 1), 5:18 (re-run) | **Verified** (they are to the start of the fan-in job; to the end of `Stages 1 to 11`, as test strategy 10.3 measures, they are 5:47 and 5:22) | Attempt 1: first job 08:35:08, fan-in 08:40:52 to 08:40:55. Attempt 2: 09:18:25, fan-in 09:23:43 to 09:23:47 |
| `master` 3:54 and 4:45 | **4:45 verified; 3:54 not reproduced** | Five `master` pushes: 4:38, 4:44, 4:47, 4:45, 4:55. Shortest first-attempt PR run in the window is 4:11. The 3:54 may come from a run outside my window; it does not change any conclusion |
| Shard 1: 233 tests in 3.6 min; shard 2: 216 tests in 2.3 min | **Verified for attempt 1 only** | Attempt 1 logs: "233 passed (3.6m)" and "216 passed (2.3m)". Attempt 2: 233 in 3.5 min and 216 in 3.0 min. 2.3 min is the better of the two shard-2 results, so the gap is 1.3 min on one run and 0.5 min on the other |
| Scan tests 1.5 to 2.7 s each | **Verified, slightly wider** | Four scan tests ran 1.4 to 2.9 s over 4 shard runs; the route-absence test ran 18 to 29 ms |
| 11b: worst `/masters/process` 173,446 B, no client code changed | **Verified; one wording difference** | Same bytes as `master` on `/`, `/audit`, `/masters/process`, `/queue`, `/sign-in`, `/users`; `/design-system` answers 404 by design. The log lists 7 routes (6 measured), not 8. Headroom on the worst route is 26,554 B (13 %). The diff touches no file under `src/components` and no page |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Minor | `.github/workflows/ci.yml:366` | NFR-009 (CI feedback, PROPOSED); RISK-023; test strategy 10.3, 10.5 | Headroom to the 6:00 early warning is thin and shrinking. This PR's first attempt (5:47) is the slowest of 17 first-attempt PR runs; the last three stories' medians are about 4:58 (AQP-74), 5:22 (AQP-113) and 5:34 (this PR, two runs). The scan is not the cause (see PRF-02 and "Cost of the scan") | Estimate: +10 to +25 s of required path per story that adds 30 to 40 E2E runs, so the recent-run median reaches 6:00 in 2 to 4 stories. The 10-minute p95 target is not at risk (p95 5:47). The risk is a held G6 and slower feedback, not an NFR breach | No change to this PR. See "RISK-023" below: rule the scan's width, decide `N = 3` early, and read the nightly report |
| PRF-02 | Minor | `.github/workflows/ci.yml:367` | Test strategy 10.5 | `--shard` divides by test count (235 and 235), not by time. Shard 1 (mobile and tablet) is the longer shard in 5 of 6 comparable runs, by 40 s on average (98 s, 15 s, 21 s, 97 s, -14 s, 21 s). The scan puts 10 runs in shard 1 and 5 in shard 2 and widens the gap by about 2 s; the gap existed before (AQP-113's PR had 97 s) | A perfect balance would save half the gap: 8 s on attempt 2, 49 s on attempt 1 (average about 20 s) | Not a condition. A third shard (below) or tagging the scan `@one-width` (it would all move to shard 2, 3.9 s off shard 1) both help. A duration-aware split is only worth building if neither is enough |
| PRF-03 | Minor | `tests/e2e/support/canary-scan.ts:161` | AC-3, AC-6; DL-057 (no widened timeouts); NFR-002 | `fetchReferencedFiles` awaits each build file one at a time, and `AC-3` is a single test that opens every Engineer page, makes every call and crawls every chunk inside the default 30 s test timeout. It is driven by the manifest, so it grows with every story by design (AC-6). Now it is 3 Engineer pages, 1 API route and a few chunks: 1.5 to 2.7 s | Estimate: at about 15 to 20 Engineer pages, 30 Engineer calls and 100 or more chunks, 10 to 25 s on the 4-worker runner (per-test time rose 1.7 times at 4 workers, AQP-199). A scan that times out cannot be quarantined (AC-8) and DL-057 forbids widening the limit, so the fix would land under pressure | Fetch referenced files in batches of 6 to 8 with `Promise.all`, and split AC-3 into a pages test, an API test and a chunk test (or one test per manifest row). Add the scan's elapsed time to the test annotations so the trend shows before it bites |
| PRF-04 | Info | `tests/e2e/auth.setup.ts:58` | Test strategy 10.5 | The production warm-up costs nothing on the critical path: 2.2 to 2.7 s, run in the set-up project beside the Lead set-up (7.8 to 10.6 s) and the Admin set-up (11.1 to 14.3 s), which set the set-up wall time. It is serial and linear in manifest rows, so about 10 s at 80 rows, still under the 14 s it hides behind | None now. Its value (avoiding a cold first request inside a scan test's 30 s) is plausible but not measured: no unwarmed run exists to compare | Keep. Revisit if the warm-up passes about 12 s: warm in batches. Optionally record the warm-up time in the log |
| PRF-05 | Info | `src/server/http/with-route.ts:195` | NFR-010 (p95 <= 500 ms at 25 users), NFR-008 | The strict zod parse on every response and `responseSchema` cost nothing per request. The parse already existed (`:164`); this line is one property set at module load. Measured: 4.9 us for the `/me` answer (6 menu items), 115 us for a 100-entry audit page (not Engineer-reachable). About 1.2 us per 8-field entry, so a 500-node answer would be near 1 ms (extrapolated) | None. At 25 concurrent users the parse is below 0.01 % of the 500 ms budget; the session lookup is the real cost of `/me` | None. Keep one strict schema per route |
| PRF-06 | Info | `tests/e2e/canary-scan.spec.ts:47` | Test strategy 10.5 definition of `@one-width`; AC-8 | The proposal to run the 5 scan tests at one width (15 runs down to 5) is sound on coverage: nothing in the scan reads layout (status, headers, bodies, scripts), no server code branches on viewport or user agent (grep of `src`: none), and the scan opens no menu or drawer. The saving today is small: 10 runs, 14.6 to 15.6 s of worker time, about 3.9 s off shard 1 and 1.2 % of the run. It grows with the scan | Today about 4 s of path; later up to two thirds of the scan's cost (PRF-03). Two guards must change in the same PR as the ruling: the allow-list in `one-width-tag.test.ts`, and `canary-scan-gate.test.ts:85`, which asserts that the scan runs at all three widths ("a width is never skipped") | Support it as a separate follow-up, ruled by the solution-architect in test strategy 10.5, with the gate kept strict: the scan must still run on every PR (desktop project) and must never be tagged, skipped or narrowed by anything else. Do not apply it in this PR |
| PRF-07 | Info | `src/app/api/v1/me/route.ts:4` | NFR-009 (200 KB first load, 26.5 KB headroom on the worst route) | `/api/v1/me` imports from the new barrel, `@/server/views/schemas`. The other six routes import the file they need. The /me module graph now also loads the audit, process-item and user schemas and the audit cursor and event services. Server only, and a cold-start cost I could not measure (an estimate of a few ms once per server start). No client byte changed | None today. The trap is later: a client component that imports the barrel would carry zod and server services into the first-load bundle, and the budget guard would report it only when a route is over 200 KB | Import `@/server/views/schemas/me` here, as the other routes do, or add `import 'server-only'` to the barrel |
| PRF-08 | Info | `tests/unit/canary-scan-gate.test.ts:75` | Test strategy 10, stage 6 and 11 | New Vitest work: `engineer-import-rule.test.ts` is 355 lint calls in 6.1 s, and `canary-scan-gate.test.ts` starts `playwright test --list` (1.1 to 1.6 s). `tests/unit` runs in both stage 6 and stage 11, so the listing is paid twice, and three files now list Playwright's tests (one-width-tag, e2e-shards, this one). The verify job took 4:21 and 3:55, against the shard path of 5:42 and 5:15, so about 80 s of slack | Off the critical path. Stage 6 and 11 steps and the install ran 1.4 to 1.7 times slower than on the previous night's AQP-113 PR run in both attempts (install 64 to 65 s against 39 s), which this PR does not touch, so most of the difference is the runner, not the PR | None. If the verify job ever sets the path, share one listing through a file |
| PRF-09 | Info | `.github/workflows/ci.yml:112` (outside the diff) | I/O: timeouts and retries | The Gitleaks download is `curl -sSfL` with no `--retry`, `--connect-timeout` or `--max-time`. Two 504s cost attempts 3 and 4 (1.5 min each, no result for the shards) and a person's time. Re-run attempts are excluded from the CI-time measure, so the nightly figure is not polluted | Wasted attempts, not product time | For the solution-architect: add `--retry 5 --retry-all-errors --retry-delay 5 --connect-timeout 15 --max-time 120`, or cache the pinned binary (the SHA-256 check already guards it) |

<details><summary>Detailed notes and evidence</summary>

### Cost of the scan (what 17 added runs cost)

| Item | Attempt 1 | Attempt 2 |
|---|---|---|
| Scan runs, shard 1 (mobile 5, tablet 5) | 15.6 s worker time | 14.6 s |
| Scan runs, shard 2 (desktop 5) | 6.6 s | 9.0 s |
| Warm-up, per shard | 2.7 s and 2.2 s | 2.5 s and 2.6 s |
| Total worker time of the run (both shards) | 1,238 s | 1,368 s |
| Scan share of the run | 1.8 % | 1.7 % |
| Scan wall time (worker time / 4 workers) | about 3.9 s in shard 1, 1.7 s in shard 2 | 3.7 s and 2.3 s |

The shard test step is not a clean A/B. Same-code runs differ by more than the scan costs: the AQP-113 PR run (no scan) had 211 s and 134 s in the two shards, `master` pushes had 169 s and 138 s, and this PR had 218 s and 139 s (attempt 1) and 213 s and 183 s (attempt 2). Worker-seconds per shard moved from 592 (`master` push) to 735 (AQP-113 PR) to 771 (this PR) with no relevant code change, so run-to-run runner speed is worth 20 to 30 %. The added 17 runs are 3.9 % of the 449 tests that ran, and about 1.8 % of the time.

### Fixed cost per shard

Shard 1 on attempt 1: 342 s job, 218 s tests, so 124 s is install (65 s), build (18 s), database set-up, browser cache and server start. Shard 2: 244 s job, 139 s tests, 105 s fixed. Install varies 51 to 66 s on both `master` and PR runs, so no systematic PR cache-miss effect shows in these runs.

### RISK-023: what to do

Facts: median 4:59 and p95 5:47 over the 17 first-attempt PR runs I could measure (the nightly step prints these, but its summary is not in the job log, so I recomputed). That is under the 6:00 median warning and under the 9:00 trigger. The DL-102 fall-back condition (median at most 6:00 and p95 at most 7:00 in a nightly window) looks met; master should confirm it from the nightly report, not from my number. The AQP-208 AC-2 rule (head and two re-runs, median over 6:00, then `N = 3`) is not met: this PR's two runs have a median of 5:34.

Actions, cheapest first. All belong to the solution-architect or the product-manager; none is a condition of this PR.

1. Decide now that the next E2E-adding story that measures over 6:00 on its head and two re-runs sets `shard: [1, 2, 3]` (`ci.yml:251`), already pre-authorised by AQP-208 AC-1. Estimate: the path falls to 4:20 to 4:40 (tests per shard 357 s / 3 = 119 s plus 105 to 125 s fixed, with count-based imbalance of 30 s). Cost: one more job, about 3.5 to 4 runner minutes per run (14.2 now, about 18); the repository is public, so A-3 says no billing. A fourth shard is pointless: the verify job (3:55 to 4:21) becomes the floor.
2. Rule the scan `@one-width` (PRF-06) in the same sitting: it stops the scan growing three times faster than the manifest.
3. Keep the AC-3 scan test from growing into its timeout (PRF-03).
4. Consider caching `node_modules` by lockfile hash (install is 51 to 66 s in all three jobs). Estimate only: 30 to 40 s per job. The architect's decision; I have not measured it.
5. Master: lower RISK-023's score when the nightly window confirms median at most 6:00 and p95 at most 7:00 (DL-102); keep it open while the trend is up.

### Shard balance table

| Run | Shard 1 test step | Shard 2 test step | Shard 1 job | Shard 2 job |
|---|---|---|---|---|
| This PR, attempt 1 | 218 s (233 passed, 2 skipped) | 139 s (216 passed, 19 skipped) | 5:42 | 4:04 |
| This PR, attempt 2 | 213 s | 183 s | 5:15 | 5:00 |
| `master` push 42428217735 | 169 s (225 passed) | 138 s (207 passed) | 4:34 | 4:13 |
| AQP-113 PR 42427499733 | 211 s | 134 s | 5:25 | 3:48 |
| AQP-113 PR 42416813742 | 165 s | 174 s | 4:23 | 4:37 |
| `master` push 42263941881 | 169 s | 154 s | 4:40 | 4:19 |

Skipped tests count towards the 235 per shard. The 19 skipped in shard 2 are why the executed counts differ (233 against 216).

### Zod micro-benchmark

Node 24.19, zod 4.6.7 (the repository's), 20,000 warm iterations, `safeParse` on invented data: `/me` response with 6 menu items 4.9 us; 100-entry audit page with nested strict objects 115.4 us. Building a small schema took 0.29 ms, once, at module load. Not a load test; it bounds the parse, and the parse is not on the NFR-010 critical path.

### Not findings

- Test-only route (`src/app/api/test-only/leak/route.ts`): one env read and a 404 with no body, no database access, no allocation worth counting.
- `ensureCanaryProcessRates` and `readFormulaTexts` run once per scan test (9 times per shard set) against a throw-away database: 3 inserts, 3 updates over 15+ rows, one `LIMIT 1` read. No scale concern.
- Scanner cost: substring search of about 100 to 150 strings over the recorded bodies; the scan tests' total time (1.5 to 2.9 s) shows it is small. `answersProtectedRoute` rebuilds a regular expression per response and row; the effect is under 20 ms now and not worth a finding.

</details>

## Reviewer-specific tables

### NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 (pages interactive; JS budget 200 KB gzip) | None. Stage 11b bytes are identical to `master`; the worst route keeps 26,554 B (13 %) | PRF-07 (barrel trap, future) |
| NFR-009 / test strategy 10.3 (CI feedback p95 at most 10 min, median warning 6 min, PROPOSED) | Low now (median 4:59, p95 5:47, this PR 5:47 and 5:22); medium within 2 to 4 stories (estimate) | PRF-01, PRF-02, PRF-06, PRF-08, PRF-09 |
| NFR-010 (page-data and save requests p95 at most 500 ms at 25 users) | None: no new per-request work; strict parse is 5 us to 115 us | PRF-05 |
| NFR-008 (500-node recalculation under 2 s) | Not touched | none |
| NFR-011 (50 users, 25 concurrent, 500 nodes) | Not touched | none |
| NFR-002 (no cost value reaches an Engineer) | Not a performance risk, but the scan that enforces it can time out as it grows, and a timed-out scan cannot be quarantined (AC-8) | PRF-03, PRF-04 |

## Issues for other roles

- **solution-architect:** rule on `@one-width` for the scan (PRF-06) and on the third shard's trigger (PRF-01, PRF-02); retries and timeouts for the Gitleaks download (PRF-09); optional `node_modules` cache.
- **product-manager:** the CI-feedback numbers (p95 at most 10 min, median warning 6 min) and NFR-010's 500 ms are still PROPOSED and unconfirmed by the delivery lead (test strategy 10.3; PRD NFR-010). The numbers I used are those. There is no number for the scan's own duration; PRF-03 proposes treating 30 s as the ceiling DL-057 already sets.
- **master:** RISK-023 can be re-scored from the nightly report if it shows median at most 6:00 and p95 at most 7:00 (DL-102); my recomputation from job timestamps supports it.
- **developer:** nothing is required. PRF-03 and PRF-07 are cheap to do in this PR if wanted.

## Previous Findings (re-review only)

None; round 1.

## Hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-57/performance.md` (main folder, not committed)
- Jira / GitHub updates: see the final message of this run (PR #115 COMMENT review with inline comments, label `review:performance-approved`, Jira comment on AQP-57)
- Open questions: none
- Risks raised: none new; RISK-023 trajectory commented (PRF-01)
- Recommended next agent: master (G6 decision once all three reviews are in)

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 2 (after master's G6 attempt-1 NO-GO, DL-112, Jira 11166) |
| Diff reviewed | `ff9d9a3..c162eee` (developer: `539bded`, Jira 11168; `c162eee` is a docs-only template line). 31 files, +1,258 / -416 |
| CI measured | Run 42473467530 (head 539bded, attempt 1, green) and run 42474042206 (head c162eee, attempt 1, green, finished 11:08:20Z) |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** (unchanged) |

## Round 2 summary

Nothing changes the verdict. PRF-07 is fixed. PRF-03 is fixed in part (the chunk fetches are batched; the test is not split), so I lower it from Minor to Info. The product runtime is untouched: the only `src/` changes are one import path, a compile-time `server-only` marker on the barrel and comments. The scan grew from 5 to 6 tests (18 runs a pull request, from 15) and now costs 33 s of worker time, 10 s more than in round 1, which is about 3 % of a run. The required path was 5:11 on the developer's run and 4:50 on `c162eee`, both under the 6:00 warning. No new finding.

Open after round 2: Blocker 0, Critical 0, Major 0, Minor 2 (PRF-01, PRF-02), Info 6 (PRF-03 residual, PRF-04, PRF-05, PRF-06, PRF-08, PRF-09). Closed: PRF-07.

## Round 2 checks run

Read-only: `git fetch`, `git diff ff9d9a3 c162eee`, `gh run view`, `gh api` (jobs, steps). The branch was not checked out. Playwright and the scan were not run locally.

## Figures re-measured from the CI logs

| Figure | Developer | Measured | Result |
|---|---|---|---|
| Required path, run 42473467530 (539bded) | 5:11 | 5:11 from first job start 10:55:32 to end of `Stages 1 to 11` 11:00:43 (5:08 to the fan-in start) | **Verified** |
| Shards | 235 tests in 3.4 min; 217 in 2.1 min | Log: "235 passed (3.4m)" and "217 passed (2.1m)", 2 and 19 skipped. Test steps 204 s and 128 s; jobs 5:06 and 4:29 | **Verified** |
| Scan duration per width | 2.1 to 2.9 s per width | The AC-3 test alone: 2.9 s mobile, 2.1 s tablet, 2.6 s desktop (**verified**). The whole scan per width is 12.0 s mobile, 11.2 s tablet, 10.0 s desktop (six tests) | **Verified, with a wording note**: 2.1 to 2.9 s is one test, not the scan per width |
| Scan worker time over 18 runs | about 33 s | 33.2 s (run 42473467530); 32.1 s on `c162eee` | **Verified** |
| `c162eee` (docs-only on top of 539bded) | not reported | 4:50 (4:47 to the fan-in start); shards 235 in 3.0 min and 217 in 3.0 min; jobs 4:45 and 4:44; verify job 2:48 | Measured |

Same test code, two runs, 21 s apart (5:11 and 4:50): the spread between runs is larger than anything the scan adds. Test steps were 204 s and 128 s on one run (gap 76 s) and 183 s and 182 s on the other (gap 1 s), which shows again that the shard gap (PRF-02) is run-to-run variation on top of a mean offset, not a fixed property.

### Path and window

| Run | Required path | Note |
|---|---|---|
| This PR, round 1, attempts 1 and 2 | 5:47, 5:22 | head ff9d9a3 |
| This PR, 539bded | 5:11 | developer's re-run |
| This PR, c162eee | 4:50 | docs-only on top |

Adding the two new first attempts to the 17 of round 1 gives 19 runs: median 4:59, p95 5:47, unchanged. The 6:00 early warning is not breached; headroom on this PR's worst run is still 13 s. RISK-023 advice stands (PRF-01).

### Cost of the scan, round 1 and round 2

| | Round 1 (ff9d9a3) | Round 2 (539bded) | c162eee |
|---|---|---|---|
| Scan tests per width | 5 | 6 | 6 |
| Scan runs | 15 | 18 | 18 |
| Worker time of all scan runs | 22.2 s and 23.6 s | 33.2 s | 32.1 s |
| Share of the run's worker time (scan + 2 warm-ups) | about 2 % | 3.3 % (38.1 s of 1,158 s) | not summed |
| Warm-up per shard | 2.2 to 2.7 s | 2.2 to 2.7 s | not read |

The +10 s is mostly the new control that runs the whole Engineer scan a second time per width (2.1 s mobile, 2.5 s tablet, 1.6 s desktop = 6.2 s), plus the interception of every `fetch` and XHR that the browser makes (`context.route('**/*')`, about +0.3 s per width on the AC-3 test: 1.5 to 2.7 s before, 2.1 to 2.9 s now). The AC-5 test went from 2.0 to 2.9 s to 2.6 to 3.3 s. All of it is test-side.

## Previous findings

| ID | Prior severity | Status | Note |
|---|---|---|---|
| PRF-01 CI headroom | Minor | Not fixed, no condition | Numbers above. Path 5:11 and 4:50 on this PR's two new runs; window median 4:59, p95 5:47 |
| PRF-02 shard balance | Minor | Not fixed, no condition | Gap 76 s on one run, 1 s on the other. Still count-based. The six-test scan adds 12 runs to shard 1 (23.2 s, 5.8 s wall) and 6 to shard 2 (10.0 s, 2.5 s wall), so the scan now adds about 3 s to the gap |
| PRF-03 scan test grows towards 30 s | Minor | **Fixed in part; residual severity Info** | See below |
| PRF-04 warm-up | Info | Unchanged | 2.2 to 2.7 s, still behind the 10 to 14 s Admin set-up. `SETUP_TIMEOUT` is only the existing 180 s as a constant |
| PRF-05 zod cost | Info | Unchanged | `src/server/http/with-route.ts` is not in the round-2 diff |
| PRF-06 one width | Info | Unchanged, case slightly stronger | See below |
| PRF-07 barrel import | Info | **Fixed** | See below |
| PRF-08 verify-job additions | Info | Unchanged | `engineer-import-rule.test.ts` is now 522 tests in 4.8 s (was 355 in 6.1 s); `canary-scan-gate.test.ts` 9 tests in 0.7 to 1.1 s. Verify job 2:47 and 2:48, so slack to the shard path is about 2 min |
| PRF-09 Gitleaks `curl` | Info | Unchanged, outside the diff | For the solution-architect |

### PRF-03, checked

- **Chunk fetches batched: yes.** `fetchReferencedFiles` now fetches in batches of `CRAWL_BATCH = 8` with one `page.evaluate` and `Promise.all` per batch (`tests/e2e/support/canary-scan.ts`). Eight at once against the browser's six per host overlaps the round trips without exceeding the limit. The crawl's own bound (`MAX_CRAWL_ROUNDS = 8`) is kept.
- **Test split: no.** AC-3 is still one test that runs `scanAsEngineer` (pages, calls, crawl). The pages loop and the calls loop are still sequential, one `goto` and one RSC fetch per page. The split was a suggestion in round 1, not a condition, and the batching removed the part that scaled worst.
- **Elapsed time recorded: yes, but not visible.** The test adds an annotation (`N ms: pages, calls, build files`), but the CI workflow has no artifact upload and the list reporter does not print annotations, so nobody sees the number. A `console.log` of the same line would show in the shard log.
- **Residual risk (estimate).** The chunk crawl was the part that scaled worst; it is now a few round trips. What is left at Release 1 size (15 to 20 pages, about 30 calls) is about 9 to 10 s on an idle machine and about 15 s on the saturated runner, half the 30 s limit (estimate; the test measures 2.1 to 2.9 s today). That is Info, not Minor, and the `console.log` is the tripwire.

### PRF-07, checked

- `src/app/api/v1/me/route.ts:4` now imports `@/server/views/schemas/me`, so the route's module graph no longer carries the audit, process-item and user schemas or the audit services.
- The barrel (`schemas/index.ts`) now starts with `import 'server-only'`, and the new ESLint scope refuses the barrel in `engineer-*` views. `server-only` is a build-time marker that adds no run-time code to a server bundle.
- Stage 11b is identical to master and to round 1 on every route (worst `/masters/process` 173,446 B, 26,554 B headroom). **Fixed.**

### PRF-06, round 2

The scan is now six tests and 18 runs. Tagging all six `@one-width` would remove 12 runs: 23.2 s of worker time, about 5.8 s off shard 1, 2 % of the run, and it would drop the second full Engineer scan from two widths. Still small, still best taken as a separate ruling in test strategy 10.5 with the allow-list and the "all three widths" assertion in `canary-scan-gate.test.ts` changed together. The developer did not apply it; that is right.

## Product runtime in round 2

Confirmed: nothing the product serves changed in a way that costs time.

| Change | Where | Runtime effect |
|---|---|---|
| Body recording (interception of `fetch` and XHR, `route.fetch()` and `route.fulfill()`) | `tests/e2e/support/canary-scan.ts` | Test browser only. It doubles the hops for fetches inside the scan's browser; the server sees the same requests, once each. None in a deployment |
| Production-routes check | `scripts/check-production-routes.ts`, `scripts/lib/production-routes.ts` | CI stage 9, after `next build`; reads the compiled `.js` files of `.next/server` into memory and looks near the variable name. Stage 9 took 7 s in total on the developer's run (20 s and 8 s in round 1). Not in the image |
| `src/app/api/v1/me/route.ts` | import path only | None: one schema file instead of the barrel |
| `src/server/views/schemas/index.ts` | `import 'server-only'` | None at run time; also removes a client-bundle risk |
| `src/lib/negative-control-gate.ts`, `src/app/api/test-only/leak/route.ts`, `src/server/views/engineer-me.ts` | comments only (the gate's code is the same expression) | None |
| `eslint.config.mjs` | rule scope | Lint step 8 s (12 s in round 1) |

Stage 11b is byte-identical to master. No page, component or dependency changed.

## NFR impact, round 2

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 JS budget | None; bytes identical, 26,554 B headroom on the worst route | none open |
| NFR-009 CI feedback (PROPOSED) | Low now (this PR 5:11 and 4:50; window median 4:59, p95 5:47); medium within 2 to 4 stories (estimate) | PRF-01, PRF-02, PRF-06, PRF-08, PRF-09 |
| NFR-010 request latency | None | PRF-05 |
| NFR-002 (scan enforces it) | Low: the chunk crawl is batched; the remaining sequential loops are about half the 30 s limit at Release 1 size (estimate) | PRF-03, PRF-04 |

## Round 2 hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-57/performance.md` (Round 2 appended; main folder, not committed)
- Jira / GitHub updates: see the final message of this run (PR #115 COMMENT review for ff9d9a3..c162eee with thread replies; label `review:performance-approved` unchanged; Jira AQP-57 comment "reviewer-performance — G6 round 2")
- Open questions: none
- Risks raised: none new; RISK-023 unchanged in my reading (PRF-01)
- Recommended next agent: master (G6 attempt 2 once the other two re-reviews are in)
