# Review Report — AQP-186 (DEF-011, test part) and AQP-187 (DEF-012) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...fix/AQP-186-187-test-timing` (PR #71) |
| Commit reviewed | fb472a3 (the PR diff); posted against the updated head 1d9285cf2f2a1ac22a97a3ccad1cb575b14a67c7 (merge from master not reviewed) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The DEF-011 fix replaces a lost click with a real hydration signal. `openDrawer` (and the keyboard test) wait until the menu button carries React's hydrated props with an `onClick` handler. That is no sleep and no timeout of its own. The late-scripts test puts the click inside the pre-hydration window by delaying every script by 1.5 s, and the developer reports it fails 4 of 4 without the wait and passes 16 of 16 with it. The DEF-012 change moves the tokens scan's file reads into `beforeAll` with no change of coverage, and adds a guard against an empty scan. Per-run accounts and unknown e-mails isolate repeats. One Minor: the same pre-hydration race remains in the sign-in and account-menu helpers (QLT-51).

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
| Diff reading | `pull_request_read get_diff`; `git show` of the PR head for `auth.ts`, `sign-in.spec.ts`, `shell.spec.ts`, `design-system.spec.ts` | see Findings |
| Search for other pre-hydration clicks | `git grep` over `tests/e2e` at the PR head | sign-in submit and account-menu clicks without a wait (QLT-51) |
| E2E | not run locally (two servers and a database; shared PC) | CI run 41933460028 green; the developer's 16/16 and 4/4 figures are taken from the PR |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-50 | Info | `tests/e2e/support/design-system.ts` (`waitUntilHydrated`) | DEF-011 | A real signal: `__reactProps$…` with an `onClick` function, re-read on every check. React's root listeners exist once hydration has started, and a click on a not-yet-committed node is queued and replayed. It relies on a private React key, so a rename would make it hang loudly, never pass falsely. | Upgrade fragility only. | Optional follow-up: a public `data-hydrated` attribute set in a `useEffect` (product code, outside this PR). |
| QLT-51 | Minor | `tests/e2e/support/auth.ts` (`signInThroughThePage`); `design-system.spec.ts:101`, `sign-in.spec.ts:140` and `:214`; `aqp-38-qa.spec.ts:219` (QA-owned) | DEF-011 (same class) | Fields are filled and Sign in or the Account menu is clicked straight after `goto`, waiting only for server HTML. Before hydration, typed values in controlled inputs can be lost, and a click can submit the form natively or do nothing. | The same flake can appear on sign-in and account-menu specs. | Call `waitUntilHydrated` in `signInThroughThePage` (before filling) and before the account-menu clicks; tell QA about its spec. Test with the same script-delay scenario on `/sign-in`. |
| QLT-52 | Info | `tests/e2e/shell.spec.ts` (late-scripts test) | DEF-011, tablet caveat | The scenario places the click inside the pre-hydration window; the delay is the scenario, not a limit. No in-suite control; optional. Tablet (768 px) uses the same drawer path, so lost clicks are covered there too. Machine stalls are not; the new wait tells them apart by where the timeout happens. | — | QA at G7: `--repeat-each=10 --retries=0` on all three projects on an unloaded machine; classify each timeout as inside `waitUntilHydrated` (a stall) or on the drawer after the click (a lost click). |
| QLT-53 | Info | `tests/unit/tokens.test.ts` | DEF-012 | Same walk, same exclusion, same patterns, same output; the reads move into `beforeAll` under the shared hook limit. The new guard test (more than 50 files, `design-tokens.ts` in, `globals.css` out) blocks an empty scan from passing. | — | None. |
| QLT-54 | Info | `tests/e2e/sign-in.spec.ts`, `support/auth.ts` | Isolation | People and unknown e-mails are unique per kind, project, repeat, retry and random part. The address is drawn from about 65,000; collisions are harmless because one run makes at most about 7 failures and 30 are needed. All writes go through the DB guard. | — | None. |

## Reviewer-specific tables
**Quality: acceptance of the two defects**

| Requirement | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| DEF-011: the drawer click waits until the page is interactive, with no sleep | `waitUntilHydrated`, `openDrawer`, keyboard test | late-scripts test (16/16 with, 4/4 failing without, per the PR) | Met for the drawer; QLT-51 for the sibling helpers |
| DEF-011: repeats do not interfere | per-run people, unknown e-mails, wider address range | `sign-in.spec.ts` | Met |
| DEF-012: the tokens scan does its file work in set-up, not in the test | `beforeAll` in `tokens.test.ts` | guard test for an empty scan | Met |

**Tablet caveat:** plausibly covered for lost clicks (same code path below 1024 px). Machine stalls remain an environment matter; the G7 series should use the classification in QLT-52.

## Previous Findings (re-review only)
n/a (first quality review of this PR).
