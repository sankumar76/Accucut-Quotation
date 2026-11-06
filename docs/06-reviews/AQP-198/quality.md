# Review Report: AQP-198 (DEF-014), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...` PR #85 (account trigger accessible name, WCAG 2.5.3) |
| Commit reviewed | 2d1e2f34876a4a2b6d17bfe4f0fd770784ac4bcb |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The account trigger's accessible name is now `Account menu, <initials>, <name>, <role>`, as ux-spec v0.13 SCR-25 and DL-094 require. The initials come from the same value the avatar draws. Real spaces between the text parts make the DOM text read "EL E2E Lead Lead".

One component draws both the plain first-load button and the Radix trigger, so the name is identical in every state. Neither caller, nor Radix, sets an `aria-label` that could override it.

The `wcag21a` tag really does turn on `label-content-name-mismatch` across the suite. All 7 planted faults were caught. Two Info points about the tests.

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
| Code reading | `git diff origin/master...origin/pr-85` (5 files); ux-spec v0.13 SCR-25 "Account trigger: accessible name" | see Findings |
| Unit test (a `git archive` copy of 2d1e2f3) | `npx vitest run tests/unit/button-pending.test.ts` | 12 of 12 passed |
| Planted-fault probe (unit) | 7 single edits to `account-trigger.tsx`: label without initials; initials after the name; label initials from another source; no space after the avatar; no space between name and role; role missing from the label; avatar drawing other initials | 7 of 7 caught |
| axe rule set | the installed axe-core 4.14.0: rules tagged `wcag21a` | `label-content-name-mismatch` only; enabled by default, not experimental; `@axe-core/playwright` uses the same copy |
| Locators | `git grep "Account menu"` in `tests` and `src` at the PR head | All prefix-based (`/^Account menu/`, `/Account menu/`, `[aria-label^="Account menu"]`); the one full-pattern assertion (`shell-lazy-load.spec.ts:102`) is updated |
| E2E | not run locally | CI 42032666310 green (352 tests, 0 failures, per the coordinator) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-67 | Info | `tests/e2e/account-trigger-name.spec.ts:40` | Test adequacy | `innerText` already breaks lines between flex items and block boxes, so the visible-text check passes with or without the `{' '}` spaces. The unit tests (planted faults caught) and the axe rule guard the spaces. | None today; a later reader might trust this check alone. | A one-line comment saying so. |
| QLT-68 | Info | `tests/e2e/account-trigger-name.spec.ts:28`; `tests/e2e/shell-lazy-load.spec.ts:102` | Test robustness | `[A-Z]{1,2}` is narrower than `initialsOf` (`?` for an empty name, accented capitals such as `É`). | A fixture rename could fail the patterns while the product is correct. | `\S{1,2}` or `[^,]{1,2}`, or rely on the exact `EXPECTED_NAME` check. |

## Reviewer-specific tables
**Quality: correctness by state**

| State | Element | Name source | Covered by |
|-------|---------|-------------|------------|
| Closed | plain first-load button (`account-menu.tsx:52`) | `AccountTrigger` | e2e "closed" at 3 widths, axe rule applied and passed |
| Pending (`aria-busy`) | plain button | same | e2e "pending" |
| Failed (`aria-describedby`) | plain button | same | e2e "failed" |
| Open, and after the first open | Radix trigger (`account-menu-panel.tsx:61`, `asChild`) | same; Radix sets no `aria-label` | e2e "open": attribute read while open (the modal hides everything else), full checks after Escape |

## Previous Findings (re-review only)
n/a (first quality review of this PR).
