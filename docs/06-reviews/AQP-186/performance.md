# Review Report — AQP-186 / AQP-187 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...fix/AQP-186-187-test-timing` (PR #71) |
| Commit reviewed | 1d9285c (updated from master); CI figures from run 41933460028 at fb472a3 |
| Date | 2026-11-04 |
| **Verdict** | APPROVE |

## Summary
This is a test-only change (DEF-011, DEF-012): the drawer tests wait for hydration, a new test delays every script by 1.5 s, the sign-in specs make a fresh user per test run, and the token scan reads the source tree once in a hook. Its CI cost is a few seconds at most. Stage 12 went from 116 s on this branch's earlier run (181 tests) to 122 s (184 tests). Master-equivalent runs ranged from 79 to 126 s on the same day, so the change is inside the runner noise. The unit stage is unchanged, and the token scan now reads each file once instead of three times. Every new wait ends by itself or at the test's timeout. No file under `src/` changed, so first-load JS is unaffected.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff scope | `git diff 9d924a1 1d9285c` | 6 files, all under `tests/`; no `src/`, config or dependency change |
| Stage 12 | `gh api .../runs/<id>/jobs`; Playwright summary from `gh run view --log` | 41933460028 (fb472a3): 184 tests (172 passed, 12 skipped), 1.9 min, step 122 s. 41924802851 (f17378a, this branch earlier): 181 tests, 1.8 min, 116 s. Master-like runs the same day: 79 s (41868171176) to 126 s (41917981785) |
| Stage 6 (unit) | Same | 41933460028: 1,488 tests, Vitest 13.15 s, step 14 s; 41924802851: 1,488 tests, 12.55 s, step 13 s |
| Whole job | Same | 5 min 07 s (41933460028); p95 over the last 17 PR runs is 5 min 20 s (AQP-169 review) |
| Builds and tests | n/a | Not run, as the brief asks (CI timings only) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `tests/e2e/shell.spec.ts:119` | Test strategy 10.3 (CI time) | New late-scripts test: every `/_next/static/*.js` request waits 1.5 s. The route handlers run in parallel, so a page load costs about 1.5 s plus hydration, not 1.5 s per script. It runs in the two drawer projects (desktop skips it: 12 skipped now, against 11) | About 2 to 4 s of test time, about 2 s of wall time on 2 workers (estimate). The delay is fixed, so it cannot grow | None |
| PRF-02 | Info | `tests/e2e/support/design-system.ts:116` | Bounded waits | `waitUntilHydrated` polls with `waitForFunction` (every animation frame) until the button's React props carry `onClick`; it has no limit of its own | Usually returns within milliseconds of load. If hydration never comes, it is bounded by the test timeout (Playwright default 30 s, 1 retry), so it cannot stall CI | None |
| PRF-03 | Info | `tests/e2e/support/auth.ts:79` | Test strategy 10.3; test-data growth | `createDisposableUser` hashes with the test hasher and opens one `pg` connection per call. It runs 3 times per project and run (axe, slip, sign-out), so 9 per CI run plus retries | Tens of milliseconds each (estimate); negligible. The rows are never deleted: a throwaway database in CI, but a local development database gains about 9 `users` rows and a few `login_throttles` rows per E2E run, which is harmless at any realistic count | None. Optionally let the local reset (`ensureE2eUsers`) delete `e2e.%.r%@example.test` rows owned by earlier runs |

Also checked, no finding: `tests/unit/tokens.test.ts:114` now walks and reads the source tree once in `beforeAll`. Before, each of the three pattern tests read every file again, so this is about 3× less file I/O for that suite, and the hook sits under the 120 s hook limit. Stage 6 time is unchanged within noise (13 to 14 s).

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| CI feedback time (p95 ≤ 10 min, warning at a 6 min median) | None: a few seconds added; job 5 min 07 s, within the recent 3 to 5.3 min spread | PRF-01, PRF-02, PRF-03 |
| NFR-009 first-load JS | None: no production code, config or dependency changed | n/a |

## Previous Findings (re-review only)
n/a (first round).
