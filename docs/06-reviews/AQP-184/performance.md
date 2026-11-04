# Review Report — AQP-184 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...fix/AQP-184-axe-wait` (PR #65) |
| Commit reviewed | 09f8022 (base 85c699f) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE |

## Summary
This is a test-only change (DEF-009): every axe scan now waits for finite animations and transitions to finish. Each scan waits at most about 200 ms, and nothing under reduced motion, and every wait is bounded by the Playwright test timeout. The new helper spec adds about 10 s of wall time to stage 12. The stage 12 difference between runs is within runner noise, and the CI job stays at 3 to 4 minutes against the 10-minute target. No production code changed, so first-load JS (NFR-009) is unaffected.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 85c699f 09f8022` | 2 files, both under `tests/e2e/`; no `src/`, config or dependency change |
| Stage 12 timings | `gh run view <id> --json jobs` (step start and end) | 41860370753 (before): 79 s; 41866502689: 108 s; 41868171176 (head): 79 s |
| Test counts | `gh run view <id> --log`, Playwright summary | Before 166 tests (155 passed, 11 skipped), 1.2 min; after 181 (170 / 11), 1.5 min and 1.2 min |
| Whole job | Same | 3 min 29 s; 4 min 00 s; 2 min 59 s |
| Motion in the app | `git grep` over `src/` | `sheet-in` / `sheet-out` / `fade-in` / `fade-out` 200 ms; `transition-colors` and `transition-transform` 150 ms (Tailwind default); `shimmer` and `spin` infinite; `prefers-reduced-motion` turns every animation and transition off |
| Builds and tests | n/a | Not run: QA is using the machine (coordinator's brief) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `tests/e2e/support/design-system.ts:81` | Test strategy 10.3 (CI time), bounded waits | The wait loop has no limit of its own; it waits on `Animation.finished` of finite animations only | Worst case about 200 ms per scan (drawer slide, scrim fade), usually 0; 0 under reduced motion. About 45 scans (15 sites × 3 projects) give at most about 4.5 s of wall time on 2 workers. Something that starts new finite animations for ever would be stopped by the 30 s test timeout (1 retry), so CI cannot stall | None |
| PRF-02 | Info | `tests/e2e/axe-helper.spec.ts:17` | Test strategy 10.3 | 5 new tests × 3 projects; 3 of them wait out a 2 s probe transition, deliberately, so the result does not depend on machine speed | About 20 s of test time, about 10 s of wall time (estimate) | None; the 2 s is what makes the test robust |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| CI feedback time (p95 ≤ 10 min, warning at a 6 min median) | None: job 3 to 4 min; added cost about 10 to 15 s, within the ±30 s noise between runs | PRF-01, PRF-02 |
| NFR-009 first-load JS | None: no production code, config or dependency changed | n/a |

**Stage 12 before and after**

| Run | Head | Tests | Stage 12 | Job |
|---|---|---|---|---|
| 41860370753 (PR #62, before) | 46483e2 | 166 | 79 s | 3 min 29 s |
| 41866502689 | d6a441f | 181 | 108 s | 4 min 00 s |
| 41868171176 | 09f8022 | 181 | 79 s | 2 min 59 s |

The two runs of this PR differ by 29 s on the same code, so that is the noise. Per test, the head run is at about the same rate as before.

## Previous Findings (re-review only)
n/a (first round).
