# Review Report — AQP-169 (STORY-10.10) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-169-nfr-009-guards` (PR #70) |
| Commit reviewed | 51b0954 (scripts and tests unchanged at the updated head 4ffc01634b21101117fc009e9034d44500b4588c) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The NFR-009 budget check is well built. Counting is a pure function of the page HTML and the build output. The HTTP side is injected, and every way a route cannot be measured becomes a failed row with its reason. Routes are ordered by code point and numbers are formatted without a locale, so the result is deterministic. The not-found page is measured at an unused path, and `/design-system` must answer 404. The negative controls (PR #73 failing `/queue` at a 150,000 B limit; a planted 210,000 B chunk failing only its route) are sound. A mutation probe killed 15 of 16 planted faults; the survivor is the gzip level (QLT-46). The other Minor is the documented local path, which clashes with the one-active-Admin index (QLT-45).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git show 51b0954:<file>` for every changed script, `ci.yml`, `nightly.yml`, README | see Findings |
| Unit and integration tests (scratch copy of 51b0954 via `git archive`; no working tree touched) | `npx vitest run` on the 13 relevant files (`js-budget*`, `ci-feedback-time`, `lighthouse-summary`, `lighthouserc`, `nightly-workflow`, `ci-workflow`, the 3 integration files) | 173 of 173 passed |
| Mutation probe | 16 single-line edits across `js-budget.ts`, `js-budget-check.ts`, `js-budget-routes.ts`, `ci-feedback-time.ts`, `lighthouse-summary.ts` | 15 killed. Survivor: gzip level 6 instead of 9 |
| Full job | not run locally (needs `next start` and a database) | CI run 41927088763 green; the control run 41927422200 is taken from the PR record |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-45 | Minor | `scripts/ensure-measurement-user.ts:33-39` | AC-1, README "Performance checks" | On the README's local database, which already has the bootstrap Admin, creating a second **active** Admin violates `uq_users_single_active_admin`; the script prints only "unexpected error". CI is unaffected (throwaway database; E2E makes only Leads and Engineers). | The documented local path fails with no usable message. | Detect an existing active Admin (or map the unique violation) and say to use that Admin's invented credentials or a fresh database; one README sentence. Add an integration test. |
| QLT-46 | Minor | `tests/unit/js-budget.test.ts:114-119` | AC-1, AC-4 (`gzip -9`) | The level-9 test's sample compresses equally at levels 6 and 9; changing `gzipBytes` to level 6 passes all 173 tests (probe). | A silent level change would shift every route by tens to hundreds of bytes; `/queue` has 1,771 B of headroom. | Use a sample where the levels differ, with a guard that they do, or a committed real chunk with its known level-9 size. |
| QLT-47 | Info | `scripts/lib/js-budget.ts:95-111` | AC-1 ("a URL used twice counts once") | Deduplication is on the URL text; one file named absolutely and relatively, or with two query strings, would count twice. | A false failure only; Next 16 emits one relative form today. | Deduplicate on the resolved `.next/static` path. |
| QLT-48 | Info | `scripts/lib/ci-feedback-time.ts:141-146` | AC-8 | The success-only filter applies after taking 20 completed runs, so the sample can be 16 (first nightly). | The p95 rests on fewer points in a week of failing runs. | Page through runs until 20 successful first attempts (or the history ends). |
| QLT-49 | Info | measurement | AC-1 | Byte equality across machines holds for this build, but builds can embed module paths (the performance review saw 0 to 27 B between worktrees). | Near the limit, a local figure can differ from CI by tens of bytes. | Keep CI (Linux) as the reference; say so in the README note. |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 counting rules, viewers, table | `js-budget.ts`, `js-budget-check.ts`, `js-budget-http.ts`, `js-budget-run.ts`, `check-js-budget.ts`, `next-server.ts` | unit, integration; probes nomodule, duplicates, modulepreload, empty page, smallest viewer killed | Met (QLT-46, QLT-47) |
| AC-2 failures named, nothing skipped, not-found 404 | `js-budget-check.ts`, `js-budget-routes.ts` | unit and integration (500, not-found 200, hidden route served, unreachable, no credentials); probes killed | Met |
| AC-3 limit table rules | `ROUTE_LIMITS` (empty), `limitTableProblems` | `js-budget.test.ts`; probe killed | Met |
| AC-4 calibration on `6f66b97` | `--build-dir` | PR record: `/` 184,594 B, not-found 135,094 B (performance review: 184,591 and 135,094) | Met |
| AC-5 step 11b, under 60 s, negative control | `ci.yml` | `ci-workflow.test.ts`; about 2 s; control run 41927422200 (`/queue` −48,229 against 150,000) | Met |
| AC-6 Lighthouse configuration | `lighthouserc.cjs`, sign-in script | `lighthouserc.test.ts`, `licences.test.ts` | Met |
| AC-7 nightly, least privilege, 25 % rule | `nightly.yml`, `lighthouse-summary.ts` | workflow and summary tests; probe at exactly 25 % killed | Met |
| AC-8 CI feedback time | `ci-feedback-time.ts`, `check-ci-time.ts` | unit; probes for re-runs, p95 rank and the 10-minute boundary killed | Met (QLT-48) |
| AC-9 baseline | QA at G7 | — | Left to QA |

**Error paths:**
- build missing: `next start` exits, reported with the log tail; with `--base-url`, "no app-paths-manifest … run the production build first";
- manifest missing or malformed: a clear error and exit 1;
- a route answering 404 or 500: a failed row naming the viewer and the status, other rows still reported;
- a server that cannot be reached: every row fails;
- in every case the server is stopped in `finally`.

**Determinism:** the measurement has no clock. The only timers are the 90 s server-readiness wait and the 30 s request timeout, which are set-up limits.

## Previous Findings (re-review only)
n/a (first quality review of this PR).
