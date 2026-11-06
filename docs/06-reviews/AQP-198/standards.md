# Review Report — AQP-198 (DEF-014: account trigger label in name) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (f698984)...fix/AQP-198-account-trigger-label-in-name` (PR #85) |
| Commit reviewed | 2d1e2f34876a4a2b6d17bfe4f0fd770784ac4bcb |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The account trigger's accessible name becomes `Account menu, <initials>, <name>, <role>`, as ux-spec v0.13 SCR-25 specifies. Real spaces now separate the visible text elements, and `AXE_TAGS` gains `wcag21a` (DL-094).

The change conforms to the standards. The tests check the WCAG 2.5.3 rule itself in every state and at three widths, and require axe's rule to be applied, not merely absent. There is one Minor finding, a type assertion in the new E2E spec, and no security impact.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | GitHub `get_diff` (5 files) | Read in full |
| Commits | GitHub `get_commits` | 1 Conventional Commit with `[AQP-198]`; branch `fix/AQP-198-account-trigger-label-in-name` |
| CI | run 42032666310 | Green |
| Hygiene | Reading the added lines | No `console.*`, TODO, `eslint-disable`, `any` or secret; one `as` cast in a test (STD-01) |
| Test strategy §10 | Reading the tests | No per-file timeout or wall-clock bound; reuses `SLOW_OPEN_WAIT_MILLISECONDS` |
| Local lint / type-check | not run | The main folder holds another branch; CI covers them |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/account-trigger-name.spec.ts:40` | §10 (no `as` casts) | `(element as HTMLElement).innerText` | A wrong element type would be hidden rather than failing | `element instanceof HTMLElement ? element.innerText : ''` |
| STD-02 | Info | `tests/unit/button-pending.test.ts:95` and `tests/e2e/account-trigger-name.spec.ts:32` | §1 | The WCAG 2.5.3 `normalise` comparison is written twice | The unit and E2E checks could drift apart | A shared `tests/support/label-in-name.ts` helper (optional) |
| STD-03 | Info | `src/components/shared/account-trigger.tsx:24-37` | §8, §5 | Good practice: matches the spec, initials computed once, the *why* documented, no new data exposed, rule-level tests, `wcag21a` added | — | — |

## Notes
- The PR shows `behind` master; bring it up to date before merge.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-198/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #85 COMMENT review (3 inline comments plus the summary); label `review:standards-approved` added (other labels kept); comment on Jira AQP-198
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision; the developer can fix STD-01 with a one-line change
