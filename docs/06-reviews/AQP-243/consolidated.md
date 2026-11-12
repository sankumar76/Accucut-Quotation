# Consolidated Review — AQP-243 (STORY-10.19: CI set-up cut and set-up summary)

| Field | Value |
|-------|-------|
| PR | [#152](https://github.com/sankumar76/Accucut-Quotation/pull/152), head `c24fe22` |
| CI on head | Run 42763746916, attempts 1 to 5 green, 5 of 5 checks |
| Review route | Full three reviews: the PR changes `.github/workflows/ci.yml` (DL-124 (1)) |
| Reports | [standards.md](standards.md) (review 5837789330), [quality.md](quality.md) (review 5837890079), [performance.md](performance.md) |
| Consolidated by | orchestrator, 2026-11-10 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info |
|----------|---------|---------|----------|-------|-------|------|
| reviewer-standards | REQUEST CHANGES | 0 | 0 | 1 | 5 | 5 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 2 | 2 | 3 |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 0 | 2 | 3 |
| **Distinct (after de-duplication)** | | **0** | **0** | **3** | **6** | **10** |

## Findings (de-duplicated, by severity)

| ID | Severity | Location | Finding | Raised by |
|----|----------|----------|---------|-----------|
| QLT-01 | Major | `scripts/lib/ci-run-summary.ts:115-120` | `cacheState` reports a job whose fallback `npm ci` failed or was cancelled as `hit` (a failed miss as `n/a`); AC-5 requires a fallback to be marked as fallback. Confirmed by probe | quality |
| QLT-02 | Major | `tests/unit/ci-workflow.test.ts:214`, `:325-326`; `tests/unit/ci-setup-cut.test.ts:157-164` | G12 rule: two of the six declared narrowed guards are not fully replaced. Plants P3 (cache hand-over between `verify` and `e2e`) and P5 (a second save of the Playwright browsers under another key) pass all 160 guard tests | quality |
| STD-01 | Major | `scripts/lib/ci-run-summary.ts:320-327` | Both handlers of `main().then(...)` swallow any rejection silently (Coding Standards §1, §10). Fix: keep exit 0 and print a token-free `::warning::` | standards |
| STD-02 = QLT-04 = PRF-01 | Minor | `.github/workflows/ci.yml:563-584` | The three `Summary:` steps have no step `timeout-minutes`; a stall reaches the 5-minute job timeout, which `continue-on-error` does not absorb, and can turn the required check red after a passing verdict | standards, quality, performance |
| QLT-03 | Minor | `scripts/lib/ci-run-summary.ts:163-185` | After "Re-run failed jobs", jobs not re-run keep their old times, so the path and slowest shard count from the earlier attempt | quality |
| STD-03 | Minor | `scripts/ci/node-modules-integrity.sh:44`, `57`, `70` | `record` fails silently when `find` or `timeout` fails; `check` reports every listing failure as a timeout | standards |
| STD-04 | Minor | `ci-run-summary.ts:137`, `:282`; `node-modules-integrity.sh:57` | Unnamed numbers (`1_000`, `2_000`, `per_page=100`, `fingerprint 120`) | standards |
| STD-05 | Minor | `ci.yml:130`, `:377`; `node-modules-integrity.sh:19-20`; README | `v1` written in four places; the convention is the `CACHE_EPOCH` env entry; README gives no way to start a new key | standards |
| STD-06 + PRF-02 | Minor | `README.md:275-280` | README omits `gh cache delete --ref refs/pull/<n>/merge` and the host line; "a small share" understates the cache budget (repository at 10.89 GB of 10 GB; 1.40 GB is this story's six entries, 1,167 MiB in closed control PRs #153 and #154) | standards, performance |
| STD-07 = QLT-05 | Info | `ci.yml:130`; `node-modules-integrity.sh:19-20` | The literal `v1` in the key is sound (fails safe) but is not in the ruled key: the solution-architect records it | standards, quality |
| QLT-06 | Info | `ci-run-summary.ts:35` | AC-2 window leaves out the pinned-npm step; disclosed; passes either way (10-11 s vs 61-75 s) | quality |
| QLT-07 | Info | `node-modules-integrity.sh:40-50` | Size-and-name integrity check: good choice, stated limit | quality |
| PRF-03 | Info | `ci.yml:572` | Summary adds 5 s to the fan-in job (3 → 8 s), 9 % of the gross saving | performance |
| PRF-04 | Info | `ci.yml:134` | `setup-node` still restores a 258 MiB npm cache nothing reads on a hit (architect, AC-8) | performance |
| PRF-05 | Info | `ci.yml:138`, `:385` | First run after merge or after any key-input change is a miss at about base path (5:23); replace miss runs before reading against 5:30 (architect) | performance |
| STD-08 | Info | `node-modules-integrity.sh` | Needs GNU `find -printf` and `timeout`; exit codes undocumented | standards |
| STD-09 | Info | `node-modules-integrity.sh:1` | No `.gitattributes` for `*.sh eol=lf` (separate change) | standards |
| STD-10 | Info | `aqp-27-scaffold.test.ts`; `ci-workflow.test.ts` | Files at or over 400 lines; multi-concern commits (none after squash) | standards |
| STD-11 | Info | `ci-run-summary.test.ts:227` | Loopback server and child process in a unit test: accepted | standards |

## Verified figures (reviewer-performance, recomputed from the API)

- **AC-4:** pooled set-up median 71.5 s (base) → 7 s (head), 64.5 s lower against 20 s required; per-job medians 59, 72, 72, 73 s → 7, 7, 8, 7 s, every job lower. The 12 job runs are attempts 1 to 3 on each side.
- **Fan-in job:** 3 s → 8 s (A-1). **NFR-009 path median:** 5:38 → 4:46.
- **Cost:** billed 22 → 19 min (ratio 0.86, guard 1.30).
- **Plants (quality):** 6 of 8 caught; P3 and P5 survived (QLT-02). The dev-243 worktree was clean after every plant.

## For master (G6)

Zero Blocker and Critical findings; three Majors open (QLT-01, QLT-02, STD-01). Questions for the architect: the `v1` literal (STD-07/QLT-05), PRF-04 and PRF-05.
