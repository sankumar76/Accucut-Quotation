# Review Report — AQP-186 (DEF-011 test part) and AQP-187 (DEF-012), with DL-085 — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-186-187-test-timing` (PR #71); PR diff a842154..fb472a3; the merge from master (1d9285c) is not reviewed |
| Commit reviewed | fb472a3 (review anchored on 1d9285cf2f2a1ac22a97a3ccad1cb575b14a67c7) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
This is a test-only change in six files:
- `openDrawer` waits for React's hydration signal before it clicks;
- `tokens.test.ts` reads the source tree once, in `beforeAll`, and checks that the scan is not empty;
- the sign-in spec makes a throwaway account, and a throwaway unknown e-mail, for each run (DL-085);
- the E2E ports are configurable and validated;
- a new late-scripts test fails without the fix.

It meets test strategy §10: no per-file timeout, no wall-clock limit, no retry. It holds no secrets: the accounts are invented and go through the database guard. There is one Minor finding, a doc comment left on the wrong function.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| PR diff | GitHub `get_diff`, `get_commits` | 6 test files, read in full |
| CI | run 41933460028 | Green, stages 1 to 12 |
| Local lint / type-check | not run | The main folder holds another branch; review done through GitHub only |
| Timeouts / clock | Reading the code | No per-file or per-test timeout; no wall-clock bound; the 1.5 s script delay is the scenario; `Date.now()` removed from an e-mail |
| Secrets | Reading the code | Invented `example.test` accounts, the existing invented `E2E_PASSWORD`, writes behind `assertSafeDatabaseTarget` |
| Commits and branch | `get_commits` | `fix(test): … [AQP-186] [AQP-187]`, `fix(test): … [AQP-186]`, `test(e2e): … [AQP-186]`; branch `fix/AQP-186-187-test-timing` |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/support/auth.ts:48-51` | §8 | The old "Makes sure the invented users exist" doc comment now sits on `connectToTestDatabase`; `ensureE2eUsers` (:62) has none | A misleading doc on a helper that guards database writes | A one-line doc for `connectToTestDatabase`; move and update the doc above `ensureE2eUsers` (now Lead and Engineer only, plus clearing `login_throttles`) |
| STD-02 | Info | `tests/e2e/support/auth.ts:79-100` | §1, §2, §5 | No secrets. Nits: `part` should be `uniqueSuffix`; the run label is built twice (`createDisposableUser`, `unknownEmail`) | Possible drift | A `runLabel(testInfo)` helper; optionally note in the README that local test databases accumulate `e2e.*` users |
| STD-03 | Info | `tests/e2e/support/design-system.ts:105-124` | Test strategy §10 | The hydration wait relies on React's internal `__reactProps$` key | It fails loudly (a timeout), not falsely, if React renames it | Name the dependency in the comment; DEF-013 may give a product-side signal later |
| STD-04 | Info | `tests/e2e/shell.spec.ts:115-122` | Test strategy §10, §2 | Meets §10. The local constant is written in `SCREAMING_CASE` | — | Move it to module level or use camelCase |
| STD-05 | Info | `tests/e2e/support/servers.ts:13-24` | §5, §1 | Good practice: validated port range, a message without the value, named constants, localhost only | — | — |

## Notes
- The PR says plainly that the local tablet series could not show 0 failures because the machine stalled. The formal QA series at G7 (DL-077) decides DEF-011.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-186/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #71 COMMENT review (5 inline comments); label `review:standards-approved` added (other labels kept); hand-off comments on Jira AQP-186 and AQP-187
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision; the developer can fix STD-01 by moving two comments
