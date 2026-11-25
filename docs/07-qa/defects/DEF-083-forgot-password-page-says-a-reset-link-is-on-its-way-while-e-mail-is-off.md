# DEF-083: `/forgot-password`, opened by typing its address while `FEATURE_EMAIL` is off, shows "Check your e-mail. If that address is registered, a reset link is on its way." although no token, no row and no mail are made (Product; wording and behaviour; Sev-3; Jira AQP-427, GitHub #712)

| Field | Value |
|-------|-------|
| Story / AC | STORY-09.07 (AQP-354, Done), **AC-1** (entry) and decision **D-1**. **No AC fails as written:** AC-1 says that with the flag off the route "still gives the same 202 and the same body as AC-2" and makes nothing, and the code does exactly that. The defect is that AC-1's own intent, "the link must not lead to a mail that can never be sent", is met only at the sign-in page (the link is replaced by "Forgot your password? Ask the Admin to reset it."); the request page itself, reached by a typed address or a bookmark, is not covered and promises a mail that will never come. A **gap in AC-1 and D-1** (type Requirement at the root, Product in the fix), found by the solution-architect (architecture v0.70 section 4.7, G-2) and graded here. |
| Severity | **Sev-3 Moderate (qa-engineer, 2026-11-24, agreeing with master's proposal in DL-379 (C)).** Reasons: a false statement to the person on a security-adjacent screen, a person who has forgotten their password and is waiting for a mail that never comes; but it is reached only by a typed address or bookmark (nothing links to it while the flag is off, sign-in shows the Ask-the-Admin line), no data is wrong or exposed (FR-001 intact), no cost or role boundary involved, and a workaround exists and is documented (ask the Admin; SCR-14 Reset password, FR-004). Not Sev-4 because the wrong sentence is the only guidance the person gets on that page. Not a G8 blocker as Sev-3 (test plan section 6); master has said so (DL-379 (C)). |
| Priority | P3 (Jira Medium, label `sev-3`). Lane per DL-379: fixed in the G-1 PR if the delivery lead picks option B, otherwise after G8 with a workaround line in KG-2. |
| Type | **Product** (wording and behaviour of one public page). Not a test defect, not an environment issue. |
| Status | **Open (new), 2026-11-24, later (qa-engineer).** Verified from the code on `origin/master` `3637ec7f` (read, not run: no browser test was run for this record). |
| Jira / GitHub | [AQP-427](https://sankumar76.atlassian.net/browse/AQP-427) / [#712](https://github.com/sankumar76/Accucut-Quotation/issues/712) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-083, agent-qa-engineer). Relates to AQP-1, AQP-354 (STORY-09.07) and AQP-355 (STORY-09.08, Deferred; the go-live without e-mail, DL-374). Raised by architecture v0.70 section 4.7 G-2 and master's DL-379; GitHub #710 holds the architecture risk G-1 (a different item). |
| Found by / date | solution-architect (architecture v0.70, G-2); verified and graded by qa-engineer, 2026-11-24 |
| Build / commit | `origin/master` `3637ec7f` (the files below are as on that commit) |
| Environment | Any install with `FEATURE_EMAIL` off or absent, which is the go-live set-up (DL-374, DL-378): Windows server, web and worker both reading the flag. |

## Steps to Reproduce
1. Run the portal with `FEATURE_EMAIL` absent, empty or `off` (the default of `featureEnvSchema`, `src/lib/env.ts:116`).
2. Open `/forgot-password` by typing the address. The sign-in page does not link to it in this state.
3. Type a well-formed e-mail (registered or not) and press "Send reset link".
4. Read the green notice. Check the database and the outbox.

## Expected Result
The page does not promise a mail it cannot send. With the flag off it shows the Release 1 words the sign-in page already uses ("Forgot your password? Ask the Admin to reset it.", `sign-in-form.tsx:31`), and no form, or at least an answer that does not say "on its way". FR-001 stays intact.

## Actual Result
The form is shown and accepted. The server answers 202 with `FORGOT_ACCEPTED_MESSAGE`, and the form shows it in a success notice: "Check your e-mail. If that address is registered, a reset link is on its way. It can be used once." No token, no outbox row and no mail are made (D-1). The person waits for a mail that never arrives.

## Evidence (code on `origin/master` `3637ec7f`; no secrets or personal data)
- `src/app/(public)/forgot-password/page.tsx:14-20`: the page renders `ForgotPasswordForm` unconditionally; its comment (line 12) says it "reads no session and no setting, so it is the same for everyone".
- `src/components/features/auth/forgot-password-form.tsx:28,58-65,72`: any `sent` result is shown as a success `Notice` with `result.message`; the form has no flag input.
- `src/app/api/v1/account/password/forgot/route.ts:14-23`: returns 202 and `FORGOT_ACCEPTED_MESSAGE` whatever happened; its comment lists "`FEATURE_EMAIL` off alike".
- `src/lib/auth/password-reset.ts:35`: `FORGOT_ACCEPTED_MESSAGE = 'Check your e-mail. If that address is registered, a reset link is on its way. It can be used once.'`
- `src/server/services/password-reset-service.ts:160`: `if (!emailEnabled()) return;` after the two throttle reservations: nothing is made.
- Contrast `src/components/features/auth/sign-in-form.tsx:31,46`: the sign-in page does read the flag (a server-decided prop) and shows the Ask-the-Admin text.
- Pinned by tests that run with the flag on: `tests/e2e/password-reset.spec.ts:21` (the sentence), `tests/unit/password-reset-routes.test.ts:50`. No test covers the page with the flag off.

## Suspected Area (leads, not findings; master and the developer decide)
- **Fix shape:** the page, a server component, reads the flag (as the sign-in page does, through its prop from `loadEmailFeature`, `env.ts:202`) and, when off, shows the Release 1 words instead of the form, with the way back to sign-in. **Leave the route byte-identical** (AC-1: same 202, same body), so FR-001 and the enumeration test stay as they are. The flag is server-wide, so the page reveals nothing about any account. A UX read of the wording belongs to the ux-expert.
- **Watch point for the developer:** the page must read the flag per request, not at build time (check how the sign-in page does it); otherwise a built image would freeze the value.
- **Binding:** authentication and passwords are a critical area (CLAUDE.md section 9 item 2), so the fix PR needs the combined security-and-quality review before merge. New tests: the page with the flag off (no form, the Release 1 words, axe at three widths) and with it on (unchanged); the existing e2e keeps its flag-on set-up.
- **Workaround until fixed:** tell people to ask the Admin, not to use the forgot-password page (architecture v0.70 G-2; KG-2 line, DL-379).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

Proof proposed for QA: on the fix PR's run of record, the new flag-off page case passes at three widths and the flag-on e2e (`password-reset.spec.ts`) is unchanged; QA reads the page once with the flag off in a run or locally before closing.

## Records
Jira Bug AQP-427 and GitHub issue #712, created 2026-11-24, later (searched first: JQL on `aiid-DEF-083` and the title words returned nothing; the next free DEF number was DEF-083 in the repo, in Jira and in GitHub). Related: AQP-1, AQP-354, AQP-355, GitHub #710 (G-1), #711 (stale comments), DL-374, DL-378, DL-379.
