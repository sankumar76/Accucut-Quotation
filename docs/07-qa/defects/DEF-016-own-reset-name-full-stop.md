# DEF-016: The own-row Reset password accessible name lacks the final full stop of the agreed wording; the E2E checks only a prefix

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.04 (AQP-65) / AC-4, AC-7; UX spec v0.15 SCR-14 |
| Jira / GitHub | [AQP-215](https://sankumar76.atlassian.net/browse/AQP-215) / [#95](https://github.com/sankumar76/Accucut-Quotation/issues/95) |
| Severity | Sev-4 Minor |
| Priority | P4 |
| Type | Product (wording) + Test (the check is too loose) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-06 (AQP-65 G7) |
| Build / commit | `3e2a695` (PR #87) |
| Environment | Development server of a scratch copy, Chromium (Playwright 1.64.1), invented users |

## Steps to Reproduce
1. Sign in as the invented E2E Admin and open `/users` at 360, 768 or 1366 px.
2. Read the `aria-label` of the disabled Reset password control on the Admin's own row or card.

## Expected Result
"Reset password is not available for your own account. Use Change password in the account menu."

This is the ux-expert's wording, adopted "with a full stop at the end" (Jira AQP-65 comment 11038), which the G7 evidence names exactly.

## Actual Result
"Reset password is not available for your own account. Use Change password in the account menu". It has no final full stop, and the same name appears at all three widths.

## Evidence
- `src/components/features/users/users-list.tsx:25`, `OWN_PASSWORD_NAME`.
- `tests/e2e/users.spec.ts:87` matches only the prefix (`/^Reset password is not available for your own account/`).
- QA probe at 360 / 768 / 1366 px:
  - the label is as above at every width;
  - visible text "Reset password" (card) and none (icon);
  - disabled at every width; 163×44 px on the card, 36×36 px in the row;
  - axe (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) 0 violations.

## Suspected Area (optional)
- Add the full stop to `OWN_PASSWORD_NAME`.
- Assert the exact name in `tests/e2e/users.spec.ts`, for example `{ name: OWN_PASSWORD_NAME, exact: true }`.

WCAG 2.5.3 is already met: the name begins with the visible text.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
