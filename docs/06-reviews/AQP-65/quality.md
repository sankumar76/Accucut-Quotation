# Review Report: AQP-65 (STORY-01.04), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-65-users` (PR #87) |
| Commit reviewed | d1a01090a16e31ca13204c84e538a9b4bc86c911 (code of 6ec2575 plus the master merge) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS (the G6 decision is held until AQP-199 merges, DL-099) |

## Summary
User management is one service over one repository. The service holds the rules that stay true whoever calls:
- **one active Admin:** the service checks first so it can name the current Admin, and the partial index decides any race;
- **no self-lock-out:** the Admin cannot deactivate or re-role themself;
- **temporary passwords:** a password the Admin sets must be changed at the next sign-in.

Deactivation and reset raise `session_version` in the same statement as the change. A reset clears the sign-in block on the same key the sign-in uses. The routes use strict schemas, and the security loops are now non-empty and fail when empty (QLT-64). The TD-06 fix (no `loading.tsx`) is correct and guarded by a production-build 403 test.

The one Minor finding: nothing detects a page that reads data before its role check (QLT-69).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-87` (54 files); Jira AQP-65 ACs and task notes; architecture §6 Users rows | see Findings |
| Unit and security tests (a `git archive` copy of d1a0109; no working tree touched) | `npx vitest run tests/security` plus the unit tests for `user-service`, `users-routes`, `security-loops`, `http-problem`, `errors`, `database-errors`, `http-with-route`, `users-client` and `users-validation` | 309 of 309 passed |
| Planted-fault probe | 18 single edits to the service, manifest, problem, page, `withRoute` and schemas, run against the security tests and 6 unit files (257 tests) | 14 caught. Survived: the update pre-check (equivalent; the index answers the same), the page reading before its role check (QLT-69), the loose output schema and the non-strict PATCH body (QLT-70) |
| Integration (`tests/integration/users`) | not run locally (no project database running) | Read: the four-way create race, direct SQL as owner and runtime on insert, promote and activate, deactivation ends the session even after re-activation, reset clears the block and leaves others blocked. CI 42070657561 green |
| E2E (`users.spec.ts`, `users-production.spec.ts`) | not run locally | Read; CI green |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-69 | Minor | `src/app/(portal)/users/page.tsx:22` | AC-6, CR-33 ("role check first, before any lookup"); test adequacy | The order is right, but reading the list before `authorizePage` passes all 257 tests and the production 403 test (the data is read, not rendered). The role matrix catches a read before the role check only when an invented ID makes it fail, and `/users` has no ID. | A later edit could run a full users query for every refused request, unnoticed. | Spy on the harness's service reads and assert they are not called for a refused role in the page loop, or add an architecture check that `authorizePage` is the page's first `await`. |
| QLT-70 | Info | `src/server/views/schemas/users.ts:46`, `:60` | NFR-002; test adequacy | `userSchema` as `looseObject`, and the PATCH body as `.object`, both survive. Only the POST body's strictness is tested. | None today (the repository never selects the hash); the second layer is unpinned. | Schema tests: an extra key on `userSchema` fails; PATCH `{ email }` gives 422. |
| QLT-71 | Info | `tests/integration/users/users-database.test.ts:64` | AC-3 (race) | The real-database race covers create only. The promote and activate race through `users.update` (the adapter's error shape → `constraintOf` → `role`) is tested with the fake repository only. | The update race relies on a mapping not exercised against PostgreSQL. | An integration case with two concurrent promotions and the pre-check passed; exactly one winner. |
| QLT-72 | Info | `src/app/(portal)/users/page.tsx:15` | TD-06 | The fix is right: `loading.tsx` adds a Suspense boundary, so the page streams a 200 before `forbidden()`. It is guarded by `users-production.spec.ts` (a 403 status on `next start`; no screen text and no canary in the HTML or flight data; the same API 403 for real and invented IDs). That guard is the slowest tier only. | A `loading.tsx` added in `(portal)/` would break every refusable page; the cause is found late. | A static check in the completeness test: no `loading.tsx` in the segment of, or above, a page whose row refuses a role. ux-expert to confirm `aria-busy` as SCR-14's "Loading". |
| QLT-73 | Info | `src/components/features/users/users-screen.tsx:100` | Correctness (UI) | Activate is direct, and the other rows stay enabled. Two quick activations start overlapping `refresh()` calls, and the first can resolve last. | The list can show a stale flag until the next change or reload; the server state is right. | Apply only the latest refresh (a counter or `AbortController`), or disable the other toggles while one is busy. |
| QLT-74 | Info | — | UX questions | (1) The Edit dialog is built from the add form (no e-mail or password), but SCR-14 does not draw it. (2) The FR-098 hints are left out until 01.05; this is consistent with AC-5 and assumption A-1. (3) "The form did not open" is a page notice, following AQP-188's first-open failure pattern. | Copy and layout only. | ux-expert to draw or accept (1), confirm (3), and confirm the `aria-busy` loading state (QLT-72). |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 add, edit, list; case-insensitive e-mail; hash only | `user-service.ts`, `user-repository.ts`, `schemas/users.ts`, SCR-14 components | unit, integration, e2e | Met (QLT-70). EMAIL_TAKEN is 422 on the `email` field, matching architecture §6 (409 is for the second Admin and for your own role or flag) |
| AC-2 deactivated or re-roled user at the next request | `session.ts` reads every request; `update` raises `session_version` on deactivation | integration (the old session stays dead after re-activation) | Met |
| AC-3 one Admin (API, races, SQL) | service pre-check + `uq_users_single_active_admin` + `UserConstraintError` → 409 naming the current Admin | unit, integration (create race, direct SQL), routes | Met (QLT-71) |
| AC-4 own deactivation or role → 409; own-row control disabled with a reason | service; `users-list.tsx` | unit, routes, integration, e2e | Met |
| AC-5 reset: 204, hash, must-change, block cleared, sessions ended | service, `setPassword`, `throttle-key.ts` | unit, routes, integration | Met |
| AC-6 role first; the same 403 for real and invented IDs; SCR-26; 401 or redirect | `withRoute`, `authorizePage`, manifest rows | role matrix, `csrf.test.ts` (non-empty loops, QLT-64), `users-production.spec.ts` (TD-06) | Met (QLT-69, QLT-72) |
| AC-7 widths, 44/36 px, axe, keyboard dialogs | SCR-14 components | `users.spec.ts` | Met (on CI) |

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: re-review of rounds 2 and 3 (6ec2575..5231947)

| Field | Value |
|-------|-------|
| Commit reviewed | 5231947f4b08d586a2de615302493e8d111ceb2d |
| Scope | AQP-65's own commits 528c241, ad26ebd, 2d9c46a and 5231947 (the master merge d5eb4b6 was reviewed in PR #86); Jira 11005, 11010 and 11031; architect ruling 11008; ux-expert 11000 (ux-spec v0.14) |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 1 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-69 | Minor | **Fixed** | `tests/security/users-page-order.test.ts` spies on `userService.list`: never called for a Lead, an Engineer or a signed-out visitor; called once for the Admin. The planted swap is caught (3 tests fail) |
| QLT-70 | Info | **Fixed** | `tests/unit/users-schemas.test.ts`. A `looseObject` output schema (4 fail) and a non-strict PATCH body (1 fails) are caught |
| QLT-71 | Info | Unchanged | Suggestion only |
| QLT-72 | Info | **Fixed** | `tests/security/loading-boundaries.test.ts` (`findLoadingProblems`). A `loading.tsx` beside `/users`, or in `(portal)/`, is caught |
| QLT-73 | Info | Unchanged | Suggestion only |
| QLT-74 | Info | **Closed** | ux-expert ruled (Jira 11000); the build follows it |

**Verified**
- **Own-password reset (STD-01):**
  - 409 `CANNOT_RESET_OWN_PASSWORD`, checked against the row the database returns; removing the guard fails 8 tests.
  - The own-row Reset is disabled, and its name contains the visible "Reset password" (WCAG 2.5.3).
  - Re-enabling the button is caught by the E2E test only.
- **UUID case:** the schema lower-cases the ID, and the service compares `isSamePerson(actorId, target.id)` ignoring case, then writes by `target.id`. Each layer's planted fault is caught on its own:
  - case-sensitive compare: 1 test fails;
  - raw path ID in `update`: 3 fail;
  - raw path ID in `resetPassword`: 3 fail;
  - schema lower-casing removed: 1 fails.
- **ux-spec v0.14:**
  - Edit with no change: `onClose()`, no request and no message.
  - The shared sentence "Check your connection and try again."
  - "The confirmation did not open." for Deactivate (`dialogFailureTitle`).
  - The notice scrolls into view with `nearest` and `auto`.
  - All four are implemented correctly. The sentence and the title are tested; the other two are not (QLT-78).
- **Round 3, one width:** exactly the ruling in 11008.
  - `users-production.spec.ts`: the whole file, 5 tests.
  - `users.spec.ts`: 7 tests. Adds a person, e-mail already used, second Admin, edit name and role, own role, and both own-row tests.
  - The list, 44 px, keyboard dialog, wrong e-mail, reset and deactivate tests keep three widths.
  - `one-width-tag.test.ts` pins 34 tests in 6 files (22 + 12). A tag on the kept list test, and the tag removed from a ruled test, are both caught.

**New finding (round 2)**

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-78 | Info | `src/components/features/users/user-form-dialog.tsx:147`; `users-screen.tsx:73` | ux-spec v0.14 SCR-14 and SCR-25; test adequacy | No-change Edit (`onClose()`) and the notice scrolling into view have no test at any tier. Reverting either passes all 235 unit and security tests, and no E2E test covers them. | A regression to "was saved." with nothing saved, or to an off-screen notice, would go unnoticed. | An E2E test (one width): Save with no change closes, with no notice and no PATCH. A unit test with a spy for the scroll, or record it as a manual check. |

**Checks run (round 2)**

| Check | Result |
|-------|--------|
| `npx vitest run tests/security` plus the unit tests for `user-service`, `users-routes`, `users-schemas`, `users-texts`, `users-client` and `one-width-tag` (a `git archive` copy of 5231947) | 235 of 235 passed |
| Planted-fault probe (17 faults) | 14 caught. Survived: own-row Reset enabled (E2E-only coverage), no-change Edit and scroll into view (QLT-78) |
| Integration, E2E | Not run locally; CI green per the developer (runs 42082159315 and 42145959641) |
