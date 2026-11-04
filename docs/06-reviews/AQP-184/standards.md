# Review Report — AQP-184 (DEF-009: axe scans wait for transitions) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-184-axe-wait` (PR #65) |
| Commit reviewed | d6a441f44e2ded82a4caa9eaa0b992d7f0fc7525 |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
This is a test-only fix. The shared axe helper now waits for running finite animations and transitions through the browser's `Animation.finished` before it scans. It adds no timeout, retry or wall-clock limit of its own, as test strategy §10 requires.

A new spec proves the helper, using a page built in the browser and a step transition so the result does not depend on machine speed. It also includes a control showing that an unwaited scan does fail.

There is one Minor finding: the control hard-codes its axe tags. Commit hygiene is clean. The worktree deviation left no trace in the repository.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Full diff | GitHub `pull_request_read` (diff, commits) | 2 files: `tests/e2e/support/design-system.ts`, `tests/e2e/axe-helper.spec.ts` (new) |
| CI | run 41866502689 | Green (E2E included) |
| Local lint / type-check | not run | The main folder holds another branch, so the review was done through GitHub only |
| Timeouts / wall clock | Reading the code | No per-file or per-test timeout, no `Date.now`/`performance.now` bound, no retry |
| Hygiene | Reading the added lines | No secret, `console.*`, `any`, assertion or TODO |
| Commit and branch | `get_commits` | 1 commit, `fix(test): wait for transitions before axe scans [AQP-184]`; branch `fix/AQP-184-axe-wait` follows §9 |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/axe-helper.spec.ts:90` | §1 (single source; no magic strings) | The control scan uses `withTags(['wcag2aa'])`, not the helper's `AXE_TAGS` | The control can drift from the helper it is meant to check | Export `AXE_TAGS` and use `.withTags([...AXE_TAGS])` |
| STD-02 | Info | `tests/e2e/axe-helper.spec.ts:55` (and lines 70, 96) | §4, §1 | `?? document.body` silently falls back; the "ends by itself" rule is written three times | A broken fixture gives a puzzling mismatch; possible drift | Throw as `startTransition` does; optionally export one `isFiniteAnimation` |
| STD-03 | Info | `tests/e2e/axe-helper.spec.ts:91-98` | Test strategy §10 | The control skips itself when the transition has already ended | Acceptable; it could quietly never run on a slow CI | List skipped tests in QA's CI-time report (§10.3) |
| STD-04 | Info | `tests/e2e/support/design-system.ts:61-87` | §10, §2, §8 | Good practice: no limits added, intent-revealing names, doc comments explain why | — | None. A page that restarts a finite transition forever would wait until the test timeout, which fails loudly |

## Commit hygiene and deviation
- **Branch name:** `fix/AQP-184-axe-wait` follows Coding Standards §9.
- **Commit:** a single Conventional Commit carrying the story key. A purist would type a test-only change as `test(e2e)`, but `fix` is defensible for a defect, so this is not a finding.
- **Worktree deviation:** the branch was cut from `origin/master` (`85c699f`) in the developer's existing worktree rather than a new one. This is a local process deviation and is recorded in the PR. It has no effect on the repository: the diff holds only the two intended files, with no stray, generated or unrelated change.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-184/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #65 COMMENT review (4 inline comments) and label `review:standards-approved` (other labels kept); hand-off comment on Jira AQP-184
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision; the developer can fix STD-01 with a one-line change
