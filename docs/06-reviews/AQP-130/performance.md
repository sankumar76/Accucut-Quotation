# Review Report — AQP-130 (STORY-02.05) — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-130-treatment-color-list` (PR #195, base 41848eb) |
| Commit reviewed | 67febe3adda3945b67a7650447d0d2458a4e5905 |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** (submitted as a PR review of type COMMENT, `REVIEW_IDENTITY` single-token) |

## Summary
The product code is cheap: a new table with one row, one query per read, one short transaction per change (3 to 5 statements), a lazy panel that adds +342 B to the first load, and no N+1 or unbounded loop. The only cost worth a decision is CI time. The +66 s that the developer reported (path 5:51 against master 4:45) is one sample; the story's own tests explain about +26 s of it and runner variance about +40 s. A reading above 5:30 cannot be accepted or refused from one run under test strategy v0.32 section 10.5 item 9, so PRF-01 asks for the median of five full runs of this head before the squash-merge. Nothing else blocks.

Evidence is read-only: the PR diff, the GitHub API job and step timings, and the per-test times in the job logs of the runs named below. Nothing was run locally.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read in full | `gh pr diff 195` (4,085 lines, 51 files) | Done |
| PR CI run, per job and step | `gh api .../actions/runs/42881974487/jobs` | 355 s run; shard 3 job 340 s sets the path |
| Master baseline run | run 42874256994 (push, master 41848eb) | 289 s run; shards 259 to 274 s |
| Same tests, other host draw | control PR #197, run 42883355254 (the same 311 / 310 / 310 E2E tests, a planted defect elsewhere) | 314 s run; E2E steps 235 / 225 / 224 s |
| Per-test worker time, master vs PR | job logs of the six E2E shard jobs, summed per spec file | see CI attribution |
| Master-family spread | 12 recent runs (jobs API) | single runs 260 to 316 s on unchanged code |
| Bundle budget | build-check lines in the Stage 11b logs | `/masters/materials` 187,115 → 187,457 B gzip (+342); limit 200,000; headroom 12,543 |
| Tests, lint, build, query plans | not run (machine limit); CI run 42881974487 is green | n/a |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Major | `tests/e2e/treatments.spec.ts:39` (and the three E2E specs) | RISK-023; test strategy v0.32 section 10.5 item 9; NFR-009 (tripwire only) | One run read 5:55 (355 s) against 4:45 to 4:49 for master. About +26 s of it is the story's own tests on shard 3; about +40 s is runner variance (the same 293 tests on shard 3: 273 s here, 224 s in control run 42883355254) | A single reading over 5:30 is neither a breach nor a clear under the rule; my estimate of the median is 5:10 to 5:25, over 5:00 and probably under 5:30 | The orchestrator runs five full runs of this head (cache hit in every job) before the squash-merge; if the median is 5:30 or more, do PRF-02 first. Downgrade to Info when the median is under 5:30 |
| PRF-02 | Minor | `tests/e2e/treatments-focus.spec.ts:45`; `tests/e2e/treatments.spec.ts:265, 280` | RISK-023 | Tests that cannot differ by width run at all three widths: about 22 of the 36 instances of the focus spec, and the two API-only tests of treatments.spec | About 70 worker-s, so about 6 s on each shard; about a quarter of the story's cost | Pin them to `desktop` with the `test.skip(testInfo.project.name !== 'desktop', ...)` form the file already uses. Optional if PRF-01 clears |
| PRF-03 | Info | `tests/e2e/masters-table-actions.spec.ts:64` | RISK-023 | One project, so each screen's eleven-width loop is a single group on one worker of one shard: 104 s → 161 s (+11 instances, 5.2 s each); it all sits on shard 3 | The biggest group of the suite; the next masters tab adds another 50 to 60 s to it | Nothing now. Split the screens into separate describe groups when the next one is added, or if a balance story is ever opened |
| PRF-04 | Info | `src/server/repositories/treatment-repository.ts:123` | NFR-010 | Checked: `LOCK TABLE ... SHARE ROW EXCLUSIVE` plus `FOR UPDATE` per change is stronger than needed (the unique index and the row lock already cover the races) but harmless | Admin-only, 3 to 5 statements, est. 10 to 30 ms; does not block reads or a future foreign key (`ROW SHARE`); wait bounded by the statement timeout | None |
| PRF-05 | Info | `src/server/services/treatment-service.ts:144` | AC-4 | No delete-in-use check yet (deferred by AC-4). When story 05.06 adds the reference, the referencing column has no index by default | A scan of the estimate parts table per delete, if not indexed | In 05.06: index the referencing column, `ON DELETE RESTRICT` as the backstop, and the "in use" check inside the same locked transaction as one indexed `EXISTS`. Record on the 05.06 notes |
| PRF-06 | Info | `src/server/repositories/treatment-repository.ts:114` | NFR-011 | The list and options reads are unbounded, and the PRD states no data volume for the Treatment / Color list | At my assumed 100 rows: about 10 KB of JSON, a sequential scan of one page, 400 buttons (table and cards both in the DOM). Not a problem at that size | Owner product-manager: add an expected maximum for this list to the PRD (one line under NFR-011). Cache or limit the options route only if it ever passes a few hundred rows |
| PRF-07 | Info | `src/components/features/masters/masters-screen.tsx:37` | NFR-009 | Panel is lazy as required (#121 PRF-01): +342 B first load, tripwire +1,500 B. Headroom on the route is 12,543 B (6.3 %), the lowest tracked; the lazy chunk is not measured by the budget script; first open is chunk then data | None today | Optional later story: report the lazy chunk size in the bundle check; start the data read in parallel with the chunk if the first open ever feels slow |

## CI time attribution (the part the orchestrator asked for)

### Test instances added (PR run 42881974487 against master push run 42874256994)
| Measure | Master | PR | Change |
|---|---|---|---|
| E2E tests scheduled (shards 1 / 2 / 3) | 269 / 268 / 268 = 805 | 311 / 310 / 310 = 931 | +126 |
| E2E tests passed | 213 / 210 / 251 = 674 | 242 / 240 / 293 = 775 | +101 |
| Unit run (vitest, Stage 6) | 2,785 in 143 files | 2,868 in 148 files | +83 |
| Combined run (Stage 11) | 4,903 in 199 files | 5,081 in 205 files | +178 |

The +101 passed E2E tests are exactly treatments.spec.ts (54) + treatments-focus.spec.ts (36) + masters-table-actions.spec.ts (22 → 33).

### Worker seconds (sum of the per-test times in the shard logs)
| Spec file | Master | PR | Change | Per test |
|---|---|---|---|---|
| treatments.spec.ts (new) | 0 | 166 | +166 | 3.1 s |
| treatments-focus.spec.ts (new) | 0 | 106 | +106 | 2.9 s |
| masters-table-actions.spec.ts (+11 tests) | 104 | 161 | +57 | 5.2 s |
| **Story's three specs** | | | **+329** | 3.3 s (suite average 3.2 s) |
| Every other spec (unchanged tests) | 2,028 | 1,874 | -154 | host speed only |
| **Total** | 2,132 | 2,307 | +175 | |

The unchanged specs ran 7 % faster in the PR run than in the master run (for example aqp-122-qa.spec.ts, identical tests: 256 s → 197 s). That gap is host speed, and it hid part of the story's cost in the raw totals.

### Per shard (worker-s; four workers a shard)
| Shard | Master | PR measured | PR expected (master + story's share) | PR E2E step | Control run E2E step (same tests) |
|---|---|---|---|---|---|
| 1 | 758 | 565 | 821 (+63) | 162 s | 235 s |
| 2 | 688 | 787 | 780 (+92) | 228 s | 225 s |
| 3 | 686 | 955 | 861 (+175) | 273 s | 224 s |

### Which shard sets the path and what is variance
- Shard 3 sets the path: job 340 s, E2E step 273 s, then the 7 s final job; the run is 355 s. It holds the whole masters-table-actions group (161 s on one worker) and its share of the two new specs (118 worker-s).
- The test split is fixed: the control run had the same 242 / 240 / 293 tests per shard. Yet shard 3 took 273 s in this run and 224 s in the control run (-49 s), and shard 1 took 162 s and 235 s (+73 s). So the imbalance seen in this run is the host, not the placement. Master's own runs span 260 to 316 s (twelve single readings) on unchanged code.
- Story's structural cost on the path: master's heaviest shard 758 worker-s, the PR's expected heaviest 861, over four workers, so +26 s. The control run (314 s against 289 s) is consistent with it (+25 s).
- Variance: the rest of the +66 s, about +40 s.
- Not on the path: unit and integration (Stage 11b job 217 s against the 340 s path; the +178 tests cost about 10 to 18 s inside it); the new warm-up of the treatment routes (Admin setup step 13.6 to 20.5 s here, 16.6 to 19.6 s on master).
- Balance: the placement excess I can attribute is about 20 s (expected sums 821 / 780 / 861), under the 80 s at which a balance story is due. It is reported only, as test strategy v0.32 requires.

### Is the story's own cost proportionate?
Yes. It adds 15 % of the E2E tests for 15 % of the E2E worker time (101 of 674; 329 of 2,132 s). The two new specs cost about twice what the neighbouring tabs cost (Exchange rates 48 tests, 116 s; Materials 47 tests, 156 s) because they carry the DL-135 and DEF-020 focus guards at three widths. The eleven-width table matrix (+11 tests, +57 s, desktop only) is the DEF-021 guard and is the right size. The one optional trim is PRF-02 (about 6 s a shard).

### Is a median of five needed before merge?
Yes, under test strategy v0.32 section 10.5 item 9: a reading against 5:00 or 5:30 is the median of five full runs with a cache hit in every job (the PR run had a hit: install 6 to 7 s, build 5 to 9 s per shard). The single 5:55 reading is above 5:30, so it needs that median to be accepted or refused. My estimate is 5:10 to 5:25 (master's 4:45 to 5:00 plus about 26 s). That is over the 5:00 line and probably under the 5:30 line, with little room. Suggested rule for the five: merge if the median is under 5:30; if it is 5:30 or more, apply PRF-02 and read again before merging. The orchestrator can run the five; I have not started any.

## NFR impact
| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 (pages interactive; LCP ≤ 2 s, TBT ≤ 200 ms) | Low: first load +342 B, panel and dialogs lazy; headroom 12,543 B | PRF-07 |
| NFR-010 (p95 ≤ 500 ms at 25 concurrent users) | Low: Admin-only, one transaction of 3 to 5 statements, est. 10 to 30 ms | PRF-04 |
| NFR-011 (capacity; fewer than 50 users) | Low; no volume stated for this list | PRF-06 |
| RISK-023 (CI path 5:00 / 5:30) | Medium until the median of five is read | PRF-01, PRF-02, PRF-03 |
| Cost carried to story 05.06 | Low | PRF-05 |

## Detailed notes

### Database
- Migration `20261110120000_treatments`: a new table, two unique indexes, one CHECK, one INSERT, and grants. It takes no lock on any existing table, so there is no deploy-time stall. `uq_treatments_name` (exact) is subsumed by `uq_treatments_name_lower`; the extra index costs one more index write on a table of tens of rows, and the Prisma `@unique` needs it.
- Per request: `GET /api/v1/treatments` and `GET /api/v1/options/treatments` are one `findMany` each with a small `select` (no `SELECT *`). Order is `is_system desc, created_at, id`, a sort of one page; no index is needed at this size. The `is_hidden = false` filter needs no index for the same reason.
- A change: `LOCK TABLE`, `SELECT ... FOR UPDATE`, the write, the audit insert, all with the caller's `tx`. The lock order is the same everywhere (table, then row), so no deadlock; reads are never held up.
- Delete-in-use check: none yet (AC-4); see PRF-05.

### Payloads and client
- The list payload is IDs, names and a flag (about 100 B a row). The options route returns IDs and names only.
- The panel re-reads the whole list after each change (one `GET`), which is simple and right at this size. The list is drawn as a table and as cards, one of them hidden by CSS (the same pattern as Materials).
- The E2E tests leave the treatments they create in the database (CI uses a fresh database; a reused local database grows by about 60 to 90 rows a run). Harmless in CI.

### Observability
No timing metric or trace is added on the new routes; the other masters routes have none either, and the shared `withRoute` already logs the request. No finding.

## Previous Findings (re-review only)
Not applicable (round 1).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-130/performance.md`
- Jira / GitHub updates: PR #195 review (COMMENT, 7 inline comments PRF-01 to PRF-07), label `review:performance-approved`; hand-off comment on AQP-130
- Open questions: none
- Risks raised: RISK-023 (story's own share about +26 s on the path; median of five needed)
- Recommended next agent: orchestrator, to run five full CI runs of head 67febe3 and pass the median to master for G6; product-manager for PRF-06 (one line in the PRD)
