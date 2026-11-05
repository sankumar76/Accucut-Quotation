# Test Report — AQP-48 (STORY-01.02): Role enforcement and navigation per role

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `561f48e` on `feat/AQP-48-role-enforcement-nav` (PR #79) |
| CI | Run 42019269128 on `561f48e`: green, with stage 11b and stage 12 (E2E 340 passed, 21 skipped, 0 failed). **CI is the reference E2E run** (the PC is low on memory) |
| Environment | **Local:** Windows 11, Node 22. The code was an isolated `git archive` copy of `561f48e`, so no shared worktree and no `git merge` were used. Tests: Vitest. Exploration: a production build (`next start`, port 3148) against a throwaway Postgres 17 database (Compose `qa48`, port 55648, since removed). The users were invented: an Admin (`qa.admin@example.test`), a Lead and an Engineer (the E2E users) |
| Date | 2026-11-05 |
| Evidence list | master's G6 closure, Jira AQP-48 comment 10949 (DL-093); PR #79 issuecomment-6657117755 |
| **Recommendation** | **ACCEPT.** One pre-existing accessibility defect was found outside this story's scope: DEF-014 (AQP-198, #82, Sev-3), the account trigger's name and WCAG 2.5.3. It does not block this story |

## Summary

- **Route enforcement:** every route goes through `withRoute` or the page guard. The role matrix shows 0 differences from SPEC §3 and §9, and the manifest matches the source tree, with planted faults caught.
- **A refused role gets the fixed 403.** Live, it is the same for a real and an invented ID apart from the request ID. Signed out gets 401 on the API and a redirect for a page.
- **The three SCR-26 pages** have one action each, which goes to `/queue` and is named by role. They pass axe (the project's tags) at three widths and work by keyboard.
- **Log check:** an invented e-mail in an error's message and cause never reaches the log.
- **Planted fault:** removing `experimental.authInterrupts` fails the config test.
- **Budget:** every route is under 190,000 B.

## AC Verification Matrix

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 (`withRoute`: session, role, origin, zod, problem+json with request ID, `no-store`) | `tests/unit/http-with-route.test.ts`, `http-problem.test.ts`, `http-origin-check.test.ts`; `tests/security/manifest-completeness.test.ts` | Local run of 16 files (280 tests, all passed); live probe | ✅ Pass | **Live:** every API answer, whether 200, 401, 403 or 500, had `Content-Type: application/problem+json` (for errors), `Cache-Control: private, no-store` and a `req-…` reference. **Architecture test:** a handler declared without `withRoute` fails (planted fault in the test) |
| AC-2 (role matrix: 0 differences from SPEC §3 and §9) | `tests/security/role-matrix.test.ts` | Local run; CI stage 11 | ✅ Pass | "allows exactly the roles of the SPEC on each screen: 0 differences"; "gives an Engineer none of the Lead or Admin screens"; every implemented API route and page is called as Admin, Lead, Engineer and signed out |
| AC-3 (manifest completeness) | `tests/security/manifest-completeness.test.ts` | Local run | ✅ Pass | The scan is not empty, and there are no problems. **Planted faults the test catches:** a route or page file without a row; a handler without `withRoute`; a method mismatch; a page without `authorizePage`; an implemented row with no file; a planned row with a file |
| AC-4 (role first; fixed 403; 401 or redirect; SCR-26; uniform 404) | `role-matrix.test.ts` ("a refused role gets the same 403 for an invented ID and a real one"); `http-with-route.test.ts` AC-4; `http-page-access.test.ts`; `navigation.spec.ts` "signed out"; **live probe with plants** | Tests plus live exploration | ✅ Pass | **Live 403**, with `/api/v1/me` restricted to Admin in QA's copy: Lead and Engineer each got 403 `{"type":"about:blank","title":"You do not have access to this.","status":403,"code":"FORBIDDEN","requestId":"req-…"}`. `?estimate=EST-0001` and `?estimate=INVENTED-99999` gave **identical bodies apart from the request ID**. **Signed out:** `/api/v1/me` gave 401 problem+json "Sign in to continue."; `/queue` gave a 307 redirect to `/sign-in`; `/no-such-page` gave a 307 redirect to `/sign-in?callbackUrl=%2Fno-such-page`, a same-origin return address. **Forbidden page**, with `/queue` restricted to Admin: HTTP **403** and SCR-26 "You do not have access to this page". **Uniform 404:** an address with no route and a planned estimate address (`/estimates/EST-404`) show the identical not-found card with HTTP 404, for the Engineer and the Lead. No estimate route is implemented yet, so the "another Engineer's estimate" case is held by the role-matrix test |
| AC-5 (foreign Origin refused; `APP_ORIGIN` accepted; no Server Actions) | `tests/security/csrf.test.ts`; `http-with-route.test.ts` AC-5; `http-origin-check.test.ts` | Tests; live | ✅ Pass | **Unit and security tests:** a foreign Origin gets 403 `ORIGIN_REFUSED` before the session is read; a request that says nothing about where it came from is refused; `APP_ORIGIN` and `Sec-Fetch-Site: same-origin` pass. The control route shows the loop cannot pass by finding nothing. There is no `"use server"`. **Live:** no implemented route changes state yet (`/api/v1/me` is GET only), so a POST with a foreign or an own Origin answers **405** |
| AC-6 (header and per-role navigation) | `navigation.spec.ts` AC-6 (Lead and Engineer) | CI stage 12, three widths | ✅ Pass | The Lead's menu has no Admin item. The Engineer's menu has no Admin or Lead item, not even a disabled one. The top bar has the logo, the name, the bell and the account menu |
| AC-7 (`GET /api/v1/me`) | `navigation.spec.ts` AC-7; `tests/unit/me-view.test.ts` | CI plus local | ✅ Pass | Strict shape, overdue count 0, no cost field, not cached |
| AC-8 (SCR-26: one action, a `req-…` reference, no technical detail, the same for any address) | `tests/unit/system-pages.test.ts`; `navigation.spec.ts`; **live probe** | Tests plus live | ✅ Pass | **Each card has one action.** No access and not found have a link to `/queue`. The error card has the "Try again" button and the text "…give the Admin this reference: req-…". The planted message "qa planted page failure" **was not shown**. **The label is named by role:** Engineer "Go to my tasks"; Lead and Admin "Go to the task queue". All go to `/queue`. **The neutral "Go to the task list"** is held by `system-pages.test.ts` and `viewer-role.test.ts`; it cannot be reached live, because a signed-out visitor is redirected. **"No access" is the same for any address:** its text has no address, page or role in it; across roles only the button label differs |
| AC-9 (three widths, 44 px, no scroll, axe 0, keyboard) | `navigation.spec.ts` (AC-8, AC-9, keyboard sign-out); **live probe** | CI plus live | ✅ Pass | **Live, real pages**, for no access (Lead and Engineer, 403), not found (all roles, 404, both addresses) and error (all roles, 500), at 360, 768 and 1366 px: **0 axe violations with the project's tags** (`wcag2a, wcag2aa, wcag21aa, wcag22aa`), **0 px horizontal overflow**, and every action 44 px high. **Keyboard:** the action is reached by Tab (6 Tabs on no access past the frame, 2 on not found and error). Enter on "Go to my tasks" or "Go to the task queue" goes to `/queue`, and Enter on "Try again" re-runs the page. CI's E2E covers the drawer, the account menu and sign-out by keyboard at three widths |

## Live probes: QA plants in a scratch copy, never committed

Every implemented route is open to every role, and no page fails on purpose, so the real "no access" and "error" pages cannot be reached in the product today. The E2E only re-labels the not-found card. To test the real pages, QA built `561f48e` with three plants in its own copy:
1. `/queue` and `/api/v1/me` listed for Admin only.
2. `/api/v1/me` throws for an Admin, with **an invented e-mail address in both the message and the cause**.
3. `/` throws.

| Check | Observed |
|---|---|
| **Log check (STD-01)** | The Admin's `GET /api/v1/me` gave 500 problem+json "Something went wrong on our side." with `req-…`. The server log line is `{"level":50,"requestId":"req-2998ce6b","route":"/api/v1/me","method":"GET","errorName":"Error","msg":"route failed unexpectedly"}`. **The invented address appears 0 times in the server log**, in neither the message nor the cause |
| No access (403) | See AC-4 and AC-9 |
| Error (500) | See AC-8 and AC-9 |

## Planted fault (QLT-62)

| Plant | Command | Result |
|---|---|---|
| Remove `experimental: { authInterrupts: true }` from `next.config.ts` | `npx vitest run tests/unit/next-config.test.ts` | **Failed:** "turns on experimental.authInterrupts … expected undefined to be true". **Restored:** 4 of 4 passed |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Story security and unit tests (local) | `npx vitest run tests/security` plus the 13 unit files of this PR (`http-*`, `system-pages`, `next-config`, `me-view`, `viewer-role`, `auth-session`, `auth-proxy`, `portal-frame-props`) | 280 | 280 | 0 | 0 | under 1 min |
| Full regression (CI) | Run 42019269128, stages 1 to 12 on `561f48e` | all stages | ✅ | 0 | stage 13 (disabled); 21 E2E viewport-specific | 6 m 02 s |

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| First-load JS ≤ 190,000 B per route | NFR-009 | CI stage 11b | ✅ `/` 163,289; `/queue` 164,423; `/sign-in` 162,852; not-found 156,332 (PRF-05, accepted, #81 item 5); `/design-system` 404 as required |
| Authorisation (deny by default; role first) | NFR-001, BR-002, BR-003 | Role-matrix tests plus live | ✅ |
| CSRF | NFR-003 | `csrf.test.ts`, unit | ✅ (no live state-changing route yet) |
| Accessibility | NFR-016 to NFR-018 | CI E2E plus live axe, widths and keyboard | ✅ with the project's axe tags. See DEF-014 for one WCAG 2.1 Level A rule outside the project's tag set |
| No technical detail or personal data in answers or logs | Architecture section 6, STD-01 | Live | ✅ |

## Exploratory Testing

**Charter:** reach the real SCR-26 pages and the API refusals in a production build, as each role, and look for leaks in bodies, logs and wording. **Time-box:** 60 min.
- **Bodies:** no data in the 403. The 401 says "Sign in to continue." and the 500 says "Something went wrong on our side." Neither shows a stack trace, a message or a cause.
- **SCR-26 frame:** "no access" keeps the portal frame (top bar, a menu with the one item the role has). "Not found" for a signed-in person has no top bar, as SCR-26 states ("points at the menu only where there is a menu").
- **Extra axe run:** QA also ran axe with the WCAG 2.1 Level A tag (`wcag21a`), which the project's E2E set leaves out. It found one serious issue in the **portal frame**, not in the SCR-26 card: the account trigger's accessible name "Account menu, E2E Lead, Lead" does not contain its visible text. The visible text is "EL E2E Lead Lead" at 1366 px, and only "EL" at 360 px. That is WCAG 2.5.3 Label in Name, Level A. The trigger is not changed by this PR (`account-trigger.tsx`, from AQP-38 and AQP-188), so this is raised as **DEF-014** and does not block AQP-48.
- **Touch:** nothing touch-specific was found, so no phone check is needed.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-014 ([AQP-198](https://sankumar76.atlassian.net/browse/AQP-198), [#82](https://github.com/sankumar76/Accucut-Quotation/issues/82)) | The account trigger's accessible name does not contain its visible text (WCAG 2.5.3, Level A); the E2E axe tags omit `wcag21a` | Sev-3, Product (accessibility) plus Test (tag set) | New. Origin AQP-38 / AQP-188; **not caused by this PR** | AC-9 (frame), NFR-018 |

Open defects from this story's own changes: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0.

## Residual Risks / Notes

- **What live testing could not reach yet.** The 403 page, the uniform 404 for another Engineer's estimate and a state-changing route's Origin check cannot be reached live: they need routes from later stories. The unit and security tests hold them now, and each later story's G7 should exercise them on its real routes.
- **PRF-05:** the not-found page is 156,332 B, about 20.8 KB over `master`. It was accepted by master and is tracked as #81 item 5.
- **DEF-014** needs a ux-expert decision on the trigger's accessible name, and `wcag21a` added to `AXE_TAGS` (expect other 2.1 Level A findings to surface once it is).
