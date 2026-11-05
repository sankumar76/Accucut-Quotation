# Review Report — AQP-198 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...` (PR #85, DEF-014 account trigger label in name) |
| Commit reviewed | 2d1e2f3 (CI run 42032666310 green) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The change adds the initials to the account trigger's accessible name, puts spaces between its text elements, adds `wcag21a` to the axe tags and adds one E2E spec. Its runtime cost is +5 B of first-load JS on two routes and no extra work: `initialsOf` now runs once instead of twice. It adds about 15 to 30 s to stage 12. Separately, the CI job median over the last 20 PR runs is 6 min 02 s, past the test strategy's 6-minute early warning, driven by E2E growth over the last two days. That is raised as a Minor follow-up; this PR did not cause it.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 1 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Source diff | `git diff f698984 2d1e2f3 -- src tests/e2e/support` | `account-trigger.tsx` (name, two `' '` text nodes, initials computed once); `AXE_TAGS` + `wcag21a`; new `account-trigger-name.spec.ts` (4 tests); one line in `shell-lazy-load.spec.ts`. The docs removals in the branch diff come from the branch point and are not part of the change |
| First-load JS | CI stage 11b (as given) | `/` 163,294 (+5), `/queue` 164,428 (+5), `/sign-in` 162,852 (0), not-found 156,332 (0) |
| Stage 12 | `gh api .../jobs`, Playwright summary from `gh run view --log` | PR 42032666310: 373 tests, 273 s (4.1 min). Master 42030026521: 361 tests, 227 s (3.6 min). Master 42025187343: 361 tests, 332 s (5.2 min) |
| CI job trend | Job "Stages 1 to 11", last 20 successful first-attempt PR runs (42032666310 back to 41955178503) | Median 362 s (6 min 02 s), p95 481 s (8 min 01 s). Today 337 to 494 s; master push 42025187343 took 8 min 24 s |
| Local build, tests | n/a | Not run: low memory; CI figures suffice |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `src/components/shared/account-trigger.tsx:37` | NFR-009; CLS | Longer label template, two space text nodes, initials computed once | +5 B on `/` and `/queue`; one fewer `initialsOf` call per render; the spaces sit between flex items and blocks, so there is no layout change | None |
| PRF-02 | Minor | `tests/e2e/support/design-system.ts:26` | Test strategy 10.3 (CI p95 ≤ 10 min; warning when the median passes 6 min) | The PR adds 12 tests (4 × 3 projects, each signing in and opening the menu) and the `wcag21a` rules to every scan. The CI job median has reached 6 min 02 s; stage 12 grew from about 80 to 120 s two days ago to 3.6 to 5.2 min now | This PR: about 15 to 30 s plus under 2 s for the tags (estimates). The warning line is crossed; p95 8 min 01 s is still under 10 min | Not for this PR. Before more E2E lands: run the 3 Playwright projects as parallel jobs (or shards), or raise CI `workers` from 2 to 4, or run layout-independent specs at one width. Orchestrator to schedule; the nightly CI-time job should report the median |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR / target | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS | None: +5 B | PRF-01 |
| CLS / INP | None | PRF-01 |
| CI feedback time (test strategy 10.3) | **Medium**: median 6 min 02 s past the 6-minute warning; p95 8 min 01 s, under 10 min; trend rising | PRF-02 |

## Previous Findings (re-review only)
n/a (first round).
