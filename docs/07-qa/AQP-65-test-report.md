# Test Report — AQP-65 (STORY-01.04): Admin creates and deactivates users; one Admin

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `3e2a695` on `feat/AQP-65-users` (PR #87), plus QA's own spec in this commit |
| CI | Run 42154016256 on `3e2a695`: green, one attempt, no install stall (21 s). Stage 11b passed. Stage 12: 339 passed, 21 skipped, 0 failed, 0 flaky, 4 workers. **CI is the reference for the full suite** (the PC is low on memory) |
| Environment | **Local, targeted only:** Windows 11, Node 22, an isolated `git archive` copy of `3e2a695` (no shared worktree, no `git merge`). One development server (port 3165) for both E2E ports, so no production build was made locally. Throwaway Postgres 17 (Compose `qa65`, port 55665, removed afterwards). Invented users only |
| Date | 2026-11-06 |
| Evidence list | master's G6 CONDITIONAL GO 11035 and closure 11045; the architect's one-width ruling for test (a), 11046 |
| **Recommendation** | **ACCEPT, with DEF-016 (AQP-215, #95, Sev-4) for master's ruling.** Every AC is met. One evidence item is short of "exactly": the own-row Reset accessible name lacks its final full stop. It is a one-character fix plus an exact assertion. WCAG 2.5.3 is met and axe is clean. Fix before the merge, or fix forward: master's call |

## Summary

- **Role matrix:** `/users` and its three API routes are Admin-only. A Lead and an Engineer get the fixed 403 (the page shows SCR-26 "no access") with the same body for a real and an invented ID; signed out gets 401 or the redirect.
- **CSRF loop:** it runs over the new state-changing routes, and a planted empty manifest throws `EmptyLoopError` in both loops.
- **Self-guards:** own reset, own deactivate and own demote each return 409 with the ID in lower, upper and mixed case, and the database row stays unchanged.
- **One Admin:** a second active Admin is refused by create, promote and activate.
- **SCR-14:** at three widths it shows no sideways scroll, 44 px targets (36 px row icons) and axe with `wcag21a` at 0 violations.
- **QA's two E2E tests:** both pass, and each fails against its planted fault.
- **Log check:** an invented e-mail in a users-route error, on both the refusal and the 500 path, never reaches the log.
- **Regression:** green, including stage 11b.
- **Defect:** the only finding is DEF-016, the missing full stop.

## AC Verification Matrix

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 (add, edit, (de)activate; unique e-mail ignoring case; invalid e-mail message; argon2id only; no `password_hash`) | `tests/integration/users/users-database.test.ts`; `users.spec.ts` (add, edit, list); live probe | Real PostgreSQL locally; CI E2E | ✅ Pass | **Integration (local, 18/18):** an argon2id hash only, the e-mail stored in lower case, a new password required at the first sign-in, and an e-mail differing only in case refused with "A user with this e-mail already exists.". **Live:** the duplicate in upper case gave 422 `EMAIL_TAKEN`; the invalid e-mail gave 422 `VALIDATION_FAILED` on the `email` field. **CI:** the add and edit tests passed |
| AC-2 (deactivated cannot sign in, open session refused; role change at once) | Integration | Local PostgreSQL | ✅ Pass | "a deactivated person cannot sign in (the same answer as a wrong password) and an open session is refused at the next request"; "a role change is read at the next request, from the database" |
| AC-3 (one active Admin, via the API and direct SQL) | Integration; live probe | Local PostgreSQL plus live | ✅ Pass | **Direct SQL** (owner and runtime roles): fails on `uq_users_single_active_admin`, and nothing changes. Simultaneous creations: exactly one wins. **Live:** create a second Admin gives 409 "There is already an active Admin. Only one Admin can be active." with `currentAdmin` named. Promoting the Engineer gives 409 `ADMIN_ALREADY_ACTIVE` with the ID in lower, upper and mixed case. Activating an inactive Admin (upper-case ID) gives 409. One active Admin remains |
| AC-4 (no deactivating or re-roling yourself; own-row control disabled and named) | Integration; unit (STD-06); live probe; QA SCR-14 probe | All tiers | ✅ Pass (wording: DEF-016) | **Live, own ID `9343e96b-…` in lower case, `9343E96B-…` upper and `9343E96b-…a0Ce` mixed (hex letters in each):** own reset 409 `CANNOT_RESET_OWN_PASSWORD`, own deactivate 409 `CANNOT_DEACTIVATE_OWN_ACCOUNT`, own demote 409 `CANNOT_CHANGE_OWN_ROLE`, all three in all three cases. **Row unchanged:** role, active flag, session version, must-change flag and the hash's md5 are identical before and after. **Own-row Reset control:** disabled at 360, 768 and 1366 px; the name begins with the visible "Reset password" (WCAG 2.5.3 met), **but it lacks the final full stop** of the agreed wording, so it is DEF-016. The Deactivate name "You cannot deactivate your own account" matches |
| AC-5 (reset: 204, hashed, must-change, block cleared, session ended) | Integration | Local PostgreSQL | ✅ Pass | "stores the new hash, asks for a change, ends the old session, lifts the sign-in block and lets the new password in"; "leaves every other person blocked" |
| AC-6 (role check first; fixed 403 for real and invented IDs; SCR-26; 401 or redirect; manifest; matrix) | `tests/security/role-matrix.test.ts`, `users-page-order.test.ts`, `manifest-completeness.test.ts`; `users-production.spec.ts` (CI); live probe | Local security tests (219/219 with the users unit tests); live | ✅ Pass | **Live, Lead and Engineer:** `GET /users` gives 403 with "You do not have access to this page" and no list data. `GET` and `POST /api/v1/users`, `PATCH /api/v1/users/{real}` and `{invented}`, and `POST …/password-reset` for real and invented IDs **all give 403 `{"title":"You do not have access to this.","code":"FORBIDDEN"}`, identical apart from the request ID**. **Signed out:** `/users` gives 307 to `/sign-in?callbackUrl=%2Fusers`; the API gives 401 "Sign in to continue.". **CI:** `users-production.spec.ts` (the production-build 403, TD-06) passed |
| AC-7 (three widths: no sideways scroll, 44/36 px, axe 0, dialogs by keyboard) | `users.spec.ts` three-width tests (CI); QA SCR-14 probe | CI plus live | ✅ Pass | **CI** (run 42154016256): `users.spec.ts` passed 6 on mobile, 6 on tablet and 13 on desktop (the 7 one-width tests included). These cover the list (scroll and axe), the 44 px test, the add dialog by keyboard, the field messages, and the reset and deactivate dialogs (alertdialog, safe choice, Escape, focus return). The suite's axe tags include `wcag21a` (AQP-198). **Live at 360, 768 and 1366 px:** axe with `wcag21a` gives 0, horizontal overflow 0 px, and the own-row Reset is 163×44 on the card and 36×36 in the row |

## Master's G7 items (11035, 11045)

| Item | Result | Evidence |
|---|---|---|
| Role matrix | ✅ | AC-6 above |
| CSRF loop runs over the new routes; a planted empty manifest throws `EmptyLoopError` | ✅ | `csrf.test.ts` and `role-matrix.test.ts` pass (123 tests). **Plant:** the three `/api/v1/users*` rows marked `planned` in QA's copy. `csrf.test.ts` fails with "EmptyLoopError: The "per-route CSRF" loop has nothing to iterate over…", and `role-matrix.test.ts` with "EmptyLoopError: The "same 403 for a real and an invented ID" loop…". Restored: 123 of 123 pass |
| Self-guards with upper- and mixed-case hex IDs | ✅ | AC-4 above (live), plus the integration upper-case test and the unit mixed-case test (STD-06) |
| SCR-14 at three widths: axe with `wcag21a`, keyboard dialogs, 44 px, exact own-row Reset name | ✅ except the exact name | AC-7 above. **Name:** at every width, "…in the account menu" instead of "…in the account menu.". See DEF-016 |
| QA test (a): Edit with no change closes the dialog and sends no request | ✅ | `tests/e2e/aqp-65-qa.spec.ts`, "[AQP-65 AC-1] edit with no change closes the dialog and sends no request". It is top-level and tagged `@one-width`, per the architect's ruling (11046). It checks nothing touched, and then only spaces added around the name: Save closes the dialog both times, **0 non-GET requests** reach `/api/v1/users*`, and no status or alert notice appears. `tests/unit/one-width-tag.test.ts` now allow-lists the file and the title: **7 files, 35 tests**, 10 of 10 passing. **Planted fault** (the no-change return removed in `edit-submit.ts`): the test **fails**, because the dialog stays open after Save |
| QA test (b): an off-screen failure notice is scrolled into view | ✅ | `aqp-65-qa.spec.ts`, "[AQP-65 SCR-25] a "did not open" notice that would be off-screen is scrolled into view", at **three widths**. With 24 invented people the list runs below the fold. The test scrolls to the last person, so the page heading is above the viewport. The dialogs' code is refused, and Edit is pressed: the alert "The form did not open. Check your connection and try again." becomes **wholly inside the viewport**. The next press, with the code reachable, opens the dialog. **Planted fault** (the `revealNearest` call removed): the test **fails**, with the notice at y = −27,294 px |
| Log check with an invented e-mail | ✅ | **Refusals:** a duplicate e-mail, an invalid e-mail and a second Admin were sent with invented addresses (`qa.logcheck.*@example.test`). Each refusal is logged as `{"route":"/api/v1/users","method":"POST","status":422,"code":"EMAIL_TAKEN","msg":"route refused"}`, with status and code only. **Unexpected error (planted):** `GET /api/v1/users` threw with the invented address in both message and cause. The response was 500 "Something went wrong on our side." with `req-…`, and the log line was `{"route":"/api/v1/users","method":"GET","errorName":"Error","msg":"route failed unexpectedly"}`. **All invented addresses appear 0 times in the server log** |
| Regression including 11b | ✅ | CI 42154016256. Stage 11b: `/` 163,566, `/queue` 164,700, `/sign-in` 163,287, **`/users` 170,909** (headroom 29,091), all 6 rows within the limit. The install took 21 s (no stall), and no attempt was repeated |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Security plus users unit tests (local) | `npx vitest run tests/security tests/unit/users*` | 219 | 219 | 0 | 0 | under 1 min |
| Users integration (local PostgreSQL) | `npx vitest run tests/integration/users` | 18 | 18 | 0 | 0 | under 1 min |
| One-width allow-list (local, with QA's change) | `npx vitest run tests/unit/one-width-tag.test.ts` | 10 | 10 | 0 | 0 | about 1 min |
| QA spec (local dev server) | `npx playwright test tests/e2e/aqp-65-qa.spec.ts --retries=0` | 4 (and 2 set-up) | 4 | 0 | 0 | 1.0 min |
| Full regression (CI) | Run 42154016256 | all stages | ✅ (339 E2E) | 0 | 21 (viewport-specific) | 8 m 34 s; stage 12 4 m 55 s |

## Exploratory Testing

**Charter:** try to get past the Admin guards with the inputs a careless or hostile caller would use, and check what the screen and the log reveal. **Time-box:** 60 min.
- **Letter case:** UUIDs in lower, upper and mixed case on all three own-account guards and on promotion all came back as 409, with the row unchanged.
- **Access:** real and invented IDs for refused roles gave identical bodies.
- **Logs:** both the refusal and the 500 paths are free of personal data.
- **Touch:** nothing touch-specific was found, so no phone check is needed.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-016 ([AQP-215](https://sankumar76.atlassian.net/browse/AQP-215), [#95](https://github.com/sankumar76/Accucut-Quotation/issues/95)) | The own-row Reset password accessible name lacks the final full stop of the agreed wording; the E2E checks only a prefix | Sev-4 Minor | New | AC-4, AC-7 (SCR-14 wording) |

Open from this story: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 1.

## Residual Risks / Notes

- **Merge order:** PR #92 may merge first. If it does, PR #87 is updated from `master` and CI is re-run before the merge (QLT-83; the orchestrator handles it).
- **Phone-card hint line:** the visible hint (ux-spec v0.15) arrives with AQP-81, not here (master, 11045).
- **QA's spec in CI:** QA's spec adds four instances to stage 12 (one desktop, three widths).
