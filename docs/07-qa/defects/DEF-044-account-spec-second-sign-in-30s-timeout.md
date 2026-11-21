# DEF-044: `account.spec.ts:299` ("Set a new password" AC-5, AC-7) flaky: the second sign-in with the Admin-reset temporary password hits the 30 s test timeout at line 356 (3 of 24 recent CI runs)

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.05 (AQP-81) AC-5, AC-7 (sub-task AQP-95, T5 SCR-23) |
| Severity | Sev-3 Moderate (raise to Sev-2 if the sign-in itself failed for the user) |
| Priority | P2 |
| Type | Test (leading hypothesis: 30 s budget on a loaded runner); product fault not excluded |
| Status | **Closed** (Jira Done; GitHub #482 closed). Fixed by PR #486, squash `04824cc8` |
| Jira / GitHub | [AQP-347](https://sankumar76.atlassian.net/browse/AQP-347) / [#482](https://github.com/sankumar76/Accucut-Quotation/issues/482) |
| Found by / date | qa-engineer, 2026-11-17 |
| Environment | CI Stage 12, dev server on :3100, mobile and tablet; runs 44085427766 (#451, failed try and retry), 44116589557 (#474, failed try and retry), 44123525451 (#470, flaky) |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-347, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
CI only. Last steps of the test: the Admin resets the person to the temporary password (204), cookies cleared, `signIn(page, person, TEMPORARY_PASSWORD)` (line 355), `expect(page).toHaveURL(/account$/)` (line 356).

## Expected Result
The sign-in is accepted, the page lands on `/queue`, the server redirects a person who must change their password to `/account`, all within 30 s (passing attempts took 12.6 to 29.7 s).

## Actual Result
`Test timeout of 30000ms exceeded` at line 356 (or inside the sign-in); two of four failing attempts saw `/queue` first, so the sign-in was accepted and only the redirect was late. 20 of 70 passing attempts took 25 s or more.

## Suspected Area
`tests/e2e/account.spec.ts:299-359`: the test is one long journey; the second sign-in could use `signInWithoutThePage` (`auth.ts`) as AQP-340 did. No trace was kept.

## Fix & Verification  _(developer / qa-engineer)_
PR #486 (test-only).
