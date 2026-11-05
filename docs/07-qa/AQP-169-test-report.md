# Test Report — AQP-169 (STORY-10.10): NFR-009 guards: JS budget check and Lighthouse reference run (enabler)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `6ae0c2f` on `feat/AQP-169-nfr-009-guards` (PR #70) |
| Environment | CI: GitHub-hosted `ubuntu-24.04` (required job `Stages 1 to 11`, run 41933808548). Reference runner: the Nightly workflow on the same runner image, **run 41933808592 attempt 2** (started by QA for this G7). Local: Windows 11, Node 22, the developer's worktree at `6ae0c2f`, and a throwaway Postgres 17 database (Compose project `qa169`, port 55669, since removed) |
| Date | 2026-11-04 |
| Evidence list | master's G6 GO, Jira AQP-169 comment 10902 (DL-086) |
| **Recommendation** | **ACCEPT** |

## Summary

All eight developer ACs are met:
- **Step 11b (AC-1 to AC-5).** It measures every route in CI: `/` 197,116 B, `/queue` 198,229 B, `/sign-in` 160,490 B, not-found 135,547 B, against 200,000 B. It fails a route that is over its limit, as the negative control (run 41927422200) showed. It adds about 2 s to the required job.
- **Nightly workflow (AC-6 to AC-8).** It runs Lighthouse 12.6.1 with the Chromium that Playwright provides. It signs in, keeps the reports for 30 days and reports the CI feedback time.

**AC-9 (baseline, reported, not asserted):** `/` signed in, Wi-Fi profile, 5 runs on the reference runner.
- Median LCP **235 ms** and median TBT **19 ms**.
- Median `benchmarkIndex` **1993.5**, so **B0 = 1993.5**. The summary rounds it to 1994.
- Chromium **156.0.0.0**.

Both medians are far inside the PRD targets (LCP ≤ 2,000 ms, TBT ≤ 200 ms). These figures go to the product-manager and master for the RISK-020 decision.

**QLT-45:** the README's local path now gives the clear "another Admin already exists" message and changes nothing. **Regression:** CI is green on the final head. **Defects:** none.

## AC Verification Matrix

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 (counting, roles, one row per route) | `tests/unit/js-budget*.test.ts`, `tests/integration/js-budget.test.ts`, `next-server.test.ts`; CI step 11b | Re-ran the story's tests locally; read the CI log | ✅ Pass | **Local:** 15 files, 207 tests passed. **CI 41933808548, step 11b:** the invented Admin was created, then 5 rows (`PASS / gzip 197,116 limit 200,000 headroom 2,884`; `/queue` 198,229, headroom 1,771; `/sign-in` 160,490; `not-found` 135,547; `/design-system` "answers 404 as required (hidden in production)"), ending "all 5 rows are within their limit". `/queue` is behind sign-in, so measuring it at 198,229 B (the same as the AQP-38 figure) shows the signed-in fetch works. **Covered by unit tests:** the counting rules (no `nomodule`; preload and modulepreload with `as=script`; each URL once; gzip level 9, pinned by the QLT-46 test; 1 KB = 1,000 B) |
| AC-2 (negative: named reason, nothing skipped, not-found row) | `tests/unit/js-budget-check.test.ts`, `tests/integration/js-budget.test.ts`; CI negative control | Tests plus a CI run | ✅ Pass | **Integration tests:** a 500 answer fails; 200 on the not-found path fails; an unreachable server fails; a planted 210,000 B chunk fails only its own route. **PR #73 (closed, never merged), run 41927422200:** `FAIL /queue gzip 198,229 limit 150,000 headroom -48,229 over its limit by 48,229 bytes`, then "1 of 5 rows failed … /queue", exit 1. The other four rows still printed, so nothing was skipped |
| AC-3 (limit table) | `tests/unit/js-budget.test.ts` | Code read plus a unit test | ✅ Pass | `DEFAULT_LIMIT_BYTES = 200_000`. `ROUTE_LIMITS = {}`, so there are no exceptions at merge. `limitTableProblems` rejects an entry equal to the default, one without a decision ID, a raised limit without a "met" run, and a lowered limit without a "missed" run |
| AC-4 (calibration on `6f66b97`) | Developer's run (PR #70 Dev Record) and reviewer-performance's independent run (Jira 10894) | Two independent measurements reviewed; **not re-run by QA** (a full Turbopack build of an old commit, against "keep local runs light") | ✅ Pass | **Developer:** `/` 184,594 B, not-found 135,094 B. **Reviewer-performance:** `/` 184,591 B, not-found 135,094 B. The story's figures are 184.6 KB and 135.1 KB, so both differences are under 1 KB. No BLOCKED path is needed |
| AC-5 (step 11b, blocks merge, under 60 s) | `tests/unit/ci-workflow.test.ts`; CI 41933808548; master CI 41921471225; negative control 41927422200 | Read the CI step list and timing | ✅ Pass | **Order:** step 11b runs inside `Stages 1 to 11` (job name unchanged), after "Stage 11: coverage of changed code" and before "Stage 12: E2E". **Step 11b time:** 23:28:52.36 to 23:28:54.12, about **1.8 s**. **Job time:** this PR 3 m 24 s (23:27:09 to 23:30:33) against 4 m 15 s for the last green `master` run (9d924a1, run 41921471225), so the step adds well under 60 s. **Blocks merge:** the negative control failed the required job at step 11b. The story's "2 m 34 s today" figure is out of date because stage 12 is now in the job |
| AC-6 (`@lhci/cli` and `lighthouserc.cjs`) | `tests/unit/lighthouserc.test.ts`, `licences.test.ts`; the Nightly reports | Code read; settings checked inside all 10 report JSON files | ✅ Pass | **Dependency:** `"@lhci/cli": "0.15.1"` (exact, dev) runs Lighthouse **12.6.1**. **Settings in every report:** `formFactor: mobile`, 360×800 at 1.75, `throttlingMethod: simulate`. Wi-Fi uses `rttMs 40, throughputKbps 10240, cpuSlowdownMultiplier 4`; Slow 4G uses `150 / 1638.4 / 4`. **Config:** `numberOfRuns` 5; `onlyCategories: ['performance']`; `puppeteerScript` with `disableStorageReset`; `chromePath` is Playwright's Chromium (156.0.0.0). `KEY_SCREENS = []`, so the LCP and TBT `median` assertions apply to no URL yet, and `/` is report-only. **CI:** stages 1 (`npm ci`), 7 (audit) and 8 (licences) are green. `allowScripts` is unchanged, as `@lhci/cli` brings no install script |
| AC-7 (nightly, on demand, PR path trigger) | `tests/unit/nightly-workflow.test.ts`, `lighthouse-summary.test.ts`, `summarise-lighthouse-script.test.ts`; Nightly 41933808592 attempts 1 and 2 | Workflow read; QA re-run | ✅ Pass | **Triggers:** `schedule`, `workflow_dispatch`, and `pull_request` on `master` limited to the Lighthouse files (never `pull_request_target`). **Least privilege:** `permissions: contents: read, actions: read` only; the only token is the automatic `github.token`, for the CI-time job, and no repository secret is used. **Actions:** all pinned to a commit SHA. **Throwaway values:** passwords are generated in the job and masked (`***` in the log). **Reports:** artefact `lighthouse-reports` uploaded with `retention-days: 30` (artefact 13373906330); nothing goes to a public server, and the log shows "GitHub token not set" for LHCI, so there is no upload. **Summary table:** LCP, TBT, `benchmarkIndex` and Chromium for both profiles. **25 % rule:** unit-tested, including exactly 25 % and just over |
| AC-8 (CI feedback time) | `tests/unit/ci-feedback-time.test.ts`; Nightly job "CI feedback time" (attempt 2) | Tests plus a run | ✅ Pass | The run output was: `CI feedback time of "Stages 1 to 11" (only 18 runs, fewer than the 20 asked for): p95 5 m 20 s (target at most 10 m), median 3 m 57 s (early warning over 6 m)`, and the step passed. The unit tests cover the cases the AC lists: fewer than 20 runs, a re-run attempt excluded, queue wait excluded, a breach and a pass |
| AC-9 (baseline at G7) | Nightly run 41933808592, attempt 2 | QA re-run on the reference runner; each report file read | ✅ Reported (no assertion) | See "AC-9 baseline" below |

## AC-9 baseline (for the product-manager and master; RISK-020)

**Run:** https://github.com/sankumar76/Accucut-Quotation/actions/runs/41933808592/attempts/2 (job "Lighthouse reference run", https://github.com/sankumar76/Accucut-Quotation/actions/runs/41933808592/job/126941332235). It ran on GitHub-hosted `ubuntu-24.04` at head `6ae0c2f`, with Lighthouse 12.6.1 and Chromium 156.0.0.0 (Playwright 1.64.1). Reports: artefact 13373906330, kept for 30 days.

**Signed in:** every run's `finalDisplayedUrl` is `http://localhost:3000/`, the page requested. The sign-in therefore took effect: an anonymous visitor would end on `/sign-in`. The summary's "NOT THIS PAGE" note column is empty.

| Profile | Run | LCP (ms) | TBT (ms) | benchmarkIndex |
|---|---|---|---|---|
| Wi-Fi | 1 | 235 | 19 | 1944 |
| Wi-Fi | 2 | 216 | 22 | 2050 |
| Wi-Fi | 3 | 236 | 10 | 1993.5 |
| Wi-Fi | 4 | 272 | 22 | 2080.5 |
| Wi-Fi | 5 | 225 | 14 | 1951.5 |
| **Wi-Fi median** | 5 runs | **235** | **19** | **1993.5** |
| Slow 4G (report only) median | 5 runs | 673 | 19 | 2025.5 |

- **B0 = 1993.5.** This is the median `benchmarkIndex` of the five Wi-Fi runs. The job summary prints it rounded ("record 1994 as B0"). `LIGHTHOUSE_B0` accepts a decimal, and either value gives the same comparability result.
- **Variance.** The developer's first attempt of the same run gave a Wi-Fi median index of 2043, LCP 275 ms and TBT 21 ms: 2.5 % away from this B0, well inside the 25 % rule.
- **Against the PRD targets** (`/` is reported, not asserted): LCP 235 ms against ≤ 2,000 ms, and TBT 19 ms against ≤ 200 ms. Both are met with a wide margin on the Wi-Fi profile, and also on Slow 4G (673 ms and 19 ms).
- **Who decides.** The product-manager and master decide whether RISK-020 falls to 6 and whether the 200 KB budget is reviewed (PRD NFR-009). In QA's view, the figures support the targets being met on `/`. The JS headroom stays tight, though: 2,884 B on `/` and 1,771 B on `/queue`.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Story tests (unit and integration), local | `npx vitest run` on the 12 unit and 3 integration files of this PR | 207 | 207 | 0 | 0 | under 1 min |
| Full regression (CI, required job) | Run 41933808548, stages 1 to 12 at `6ae0c2f` | all stages | ✅ | 0 | stage 13 (disabled) | 3 m 24 s |
| Nightly (both jobs) | Run 41933808592 attempt 2 | 2 jobs | 2 | 0 | 0 | 3 m 27 s (Lighthouse) |
| CI on the report commit | the PR run after this report is pushed | recorded on the PR | | | | |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| First-load JS per route ≤ 200,000 B gzip | NFR-009 | CI step 11b | ✅ All within. Tightest is `/queue`, 1,771 B headroom |
| LCP ≤ 2 s and TBT ≤ 200 ms (Wi-Fi, median of 5) | NFR-009 | Nightly attempt 2 on `/` (report only) | ✅ 235 ms and 19 ms |
| CI feedback time (p95 ≤ 10 min, median ≤ 6 min) | NFR-025 / NFR-009 row | Nightly CI-time job | ✅ p95 5 m 20 s, median 3 m 57 s (18 runs) |
| Security smoke (secrets, privilege, guards) | Architecture section 8 | Logs, workflow and the guard run locally | ✅ All values that must stay secret show as `***` in the logs; there are no repository secrets; tokens are read-only. `ensure-measurement-user` refuses `staging.example.test`: "not a throwaway database (allowed: localhost, 127.0.0.1, ::1, db, postgres). Staging is never allowed", exit 1 |
| Accessibility | — | n/a (no screen) | n/a |

## Exploratory Testing

**Charter:** follow the README "Performance checks" local path on a throwaway database, as a developer would, and confirm QLT-45 and the guard. **Time-box:** 20 min. **Database:** Compose `qa169` on 127.0.0.1:55669, migrated, removed afterwards with its volume.

| # | Step | Observed | Result |
|---|---|---|---|
| E1 | Fresh database: `npx tsx scripts/ensure-measurement-user.ts` with invented `MEASUREMENT_ADMIN_*` | "the invented Admin was created.", exit 0; the password is not printed | ✅ |
| E2 | The same command again | "the user already exists; nothing was changed.", exit 0 | ✅ Idempotent |
| E3 | `DATABASE_URL` host `staging.example.test` | Refused, as quoted above; exit 1; no connection attempted | ✅ STD-01 guard |
| E4 | New database state: `npx tsx scripts/bootstrap-admin.ts` (invented first Admin), then E1's command (the **QLT-45 path**) | "ensure-measurement-user failed: another Admin already exists in this database and the portal allows one active Admin, so the measurement user cannot be added. Use a fresh throwaway database, or leave this script out and set MEASUREMENT_ADMIN_EMAIL and MEASUREMENT_ADMIN_PASSWORD to that Admin's own sign-in (it must not be forced to change its password)." Exit 1. Afterwards only the first Admin exists | ✅ QLT-45 fixed: a clear message, nothing changed, and it matches the README |

**Not exercised locally:** a full `next build` followed by `check-js-budget.ts` on this PC. This was to keep local runs light while the AQP-183 phone session uses the PC. CI is the reference for the byte figures (QLT-49), and reviewer-performance reproduced them independently.

## Defects

None.

## Residual Risks / Notes

- **OBS-1 (Info, for master and the product-manager):** `KEY_SCREENS` is empty, so the Wi-Fi assertions check nothing until the queue story adds `/queue` (PRF-04, DL-086 follow-up).
- **OBS-2 (Info):** the CI-time sample was 18 runs, not 20, because only successful first attempts count (QLT-48). The report says so, as AC-8 asks.
- **OBS-3 (Info):** the measurement runner is a fast GitHub-hosted machine with simulated throttling. The figures are comparable between runs through B0, not with a real phone.
- **RISK-020:** the JS headroom is small (`/queue` 1,771 B), so the next feature on `/` or `/queue` will reach the limit. The Radix lazy-load cut (#61) is the planned relief.
- **Delivery lead action (DL-086):** set the repository variable `LIGHTHOUSE_B0` to **1993.5**.
