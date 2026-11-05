# Review Report: AQP-48 (STORY-01.02), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-48-role-enforcement-nav` (PR #79); code diff only (the docs-only master merge #78 was not reviewed) |
| Commit reviewed | 5208f6eeac30c1be6798fd1452a00d479ef8f751 |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The route manifest is one table that feeds four readers: `withRoute` (API), `authorizePage` (pages), the menu and `GET /api/v1/me`. A role can therefore never be allowed in one place and refused in another.

Role checks are deny-by-default and run before any lookup. The role matrix compares against a separately written SPEC table, not against the manifest, so a wrong row fails the test. The completeness test can fail on its own planted faults.

The stale-session return address goes only through `safeReturnPath`; no open redirect was found. BR-003 holds at the route level and in `/me`.

One Minor finding: no test covers the `experimental.authInterrupts` flag that makes `forbidden()` render SCR-26 with a 403. Deleting the flag passes every test (QLT-62).

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
| Code reading | `git diff origin/master...origin/pr-79` (46 files); story AQP-48 ACs; ux-spec SCR-26 | see Findings |
| Unit and security tests (a `git archive` copy of 5208f6e; no working tree touched) | `npx vitest run tests/security` and 10 unit files (`http-*`, `auth-proxy`, `auth-session`, `me-view`, `system-pages`, `return-path`) | 250 of 250 passed |
| Planted-fault probe | 20 single-line edits to `with-route`, `origin-check`, the manifest, `problem`, `page-access`, `session`, `proxy`, `navigation`, `me-view`, `system-page` and `next.config` | 19 caught; `authInterrupts` removal not caught (QLT-62). The first form of the output-schema fault was equivalent (it fails closed with a 500); its corrected form was caught |
| `tests/acceptance/aqp-27-scaffold.test.ts` | — | Not usable in the scratch copy (needs the git repository); left out of the probe |
| E2E | not run locally | `navigation.spec.ts` read; CI is the evidence |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-62 | Minor | `next.config.ts:40` | AC-4, AC-8; test adequacy | `forbidden()` throws "experimental and only allowed … when `experimental.authInterrupts` is enabled" without the flag (`next/dist/client/components/forbidden.js:27`). All unit and security tests mock `forbidden`. No implemented page refuses a role, so no e2e test reaches `(portal)/forbidden.tsx`. Removing the flag passes all 253 tests. | A refused page would show the `error.tsx` 500 card instead of SCR-26 "no access" with a 403. It fails closed (no leak), but no test notices until the first restricted page ships. | Now: assert `experimental.authInterrupts === true` in `tests/unit/next-config.test.ts`. With the first page that refuses a role: an e2e test for status 403 and the SCR-26 card. |
| QLT-63 | Info | `tests/support/route-files.ts:110` | AC-1, AC-3 | Pages must call `authorizePage('<own pattern>')`, but API files only need `withRoute(`; the `route:` literal is not tied to the file's path, and `withRoute` takes its roles from that literal. | Today the role matrix catches a mislabelled route at run time only when the two rows' roles differ, and with an indirect message. | Also require `route: '<pattern>'` (and, ideally, a matching `method`) in `apiProblems`. |
| QLT-64 | Info | `tests/security/role-matrix.test.ts:190`; `tests/security/csrf.test.ts` per-route loops | AC-4, AC-5 | `/api/v1/me` allows every role and nothing changes state yet, so the "same 403 for an invented and a real ID" loop and the CSRF per-route loops have nothing to iterate over. The behaviour is covered by the fake-row unit tests and the CSRF control route. | The first Lead-only or state-changing API story could pass these loops without exercising them. | Fail the loop when it is empty while a refused (or state-changing) implemented API row exists. |
| QLT-65 | Info | `src/components/features/system-pages/system-page.tsx:29` | AC-8 (developer question) | "Go to your tasks" is role-neutral, as AC-8 and UX-22 require (identical card for every role). `SCR-26.html` and `generator/s3.cjs:248-249` say "Go to my tasks", and for an Admin or a Lead the destination is titled "Task queue". | Copy only. | ux-expert to confirm or change the wording in SCR-26. |
| QLT-66 | Info | `src/components/features/system-pages/system-page.tsx:33` | AC-8 | The page reference is `req-<render digest>` (decimal); the API reference is `req-` plus 8 hex digits from `problem.ts`. Both meet `req-…` but come from different sources. | Support staff need to know which log field to search. | A line in the README operations notes, or a distinct prefix for page errors. |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 `withRoute` (session, role, origin, zod, problem+json with a request ID, no-store) | `with-route.ts`, `problem.ts`, `origin-check.ts` | `http-with-route.test.ts`, `http-problem.test.ts`, completeness test | Met |
| AC-2 manifest = SPEC §3/§9, 0 differences | `route-manifest.ts` | `role-matrix.test.ts` (separate SPEC table), `http-route-manifest.test.ts` | Met |
| AC-3 every route file has a row and uses `withRoute` or `authorizePage` | `tests/support/route-files.ts` | `manifest-completeness.test.ts` with planted faults | Met (QLT-63) |
| AC-4 role first, fixed 403, 401, same-origin return, SCR-26 | `with-route.ts`, `page-access.ts`, `session.ts`, `proxy.ts`, `(portal)/forbidden.tsx` | role matrix, `auth-session`, `auth-proxy`, e2e (401 and the return address) | Met (QLT-62, QLT-64) |
| AC-5 CSRF on state-changing routes; no Server Actions | `origin-check.ts`, `with-route.ts` | `csrf.test.ts` (control route, lint rule), unit | Met (QLT-64) |
| AC-6 header and role navigation from the manifest | `navigation.ts`, `portal-frame-props.tsx` | `http-navigation.test.ts`, e2e (Lead, Engineer) | Met |
| AC-7 `GET /api/v1/me`, strict, no cost | `me/route.ts`, `me-view.ts`, `schemas/me.ts` | `me-view.test.ts`, e2e | Met |
| AC-8 SCR-26: one action, `req-` reference, identical "no access" | `system-page.tsx`, `forbidden.tsx`, `not-found.tsx`, `error.tsx` | `system-pages.test.ts`, e2e (not found; card variants) | Met (QLT-65, QLT-66) |
| AC-9 widths, 44 px, axe, keyboard | frame and system pages | `navigation.spec.ts` | Met (on CI) |

**Focus-area notes.** The order in `withRoute` is origin → session → role → parse → handler → strict output. A signed-out cross-site POST therefore gets 403 `ORIGIN_REFUSED`, not 401; this is intentional and tested. The proxy always overwrites `x-return-path`, and `requireUserOrRedirect` reads it only through `signInPathFor`. A deactivation or a role change takes effect at the next request (role matrix).

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: G6 condition (DL-093), 5208f6e..561f48e

| Field | Value |
|-------|-------|
| Commit reviewed | 561f48eba8d80fbef474e747db86fb7001bca811 |
| Scope | My own items QLT-62 and QLT-65, plus a correctness check of the new diff (18 files) |
| CI | 42019269128 green |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 0 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-62 | Minor | **Fixed** | `tests/unit/next-config.test.ts` asserts `experimental.authInterrupts === true`; the planted fault (flag removed) is now caught. An e2e test for the 403 is still due with the first page that refuses a role |
| QLT-65 | Info | **Fixed** | `homeActionLabel` (`src/lib/auth/roles.ts`) matches ux-spec v0.12 SCR-26: Engineer "Go to my tasks", Lead/Admin "Go to the task queue", role unknown "Go to the task list"; every label links to `/queue`; "Go to your tasks" is not used. The label takes only the viewer's role (`readViewerRole()` takes no input, and the card takes no address), covered by a unit test and by an e2e test comparing two addresses (UX-22) |
| QLT-63, QLT-64, QLT-66 | Info | Unchanged | Not in scope for this round |

**Regression check (no issues found)**
- `src/server/auth/viewer-role.ts` only picks the button's words, and a read failure falls back to the neutral label, not a 500. Next.js control-flow errors are rethrown (`unstable_rethrow`). The log holds only the error name and code.
- `HomeAction` is now in a server-only module, so `app/error.tsx` no longer imports `Button` or `next/link`. A subset test holds the retry classes to the shared secondary variant.
- `withRoute` logs `errorName`, `errorCode` and schema field names instead of `err`; the response bodies are unchanged.
- The security tests hold the session clock at `SESSION_NOW`, and a new test checks the 12-hour boundary in both directions.
- The route and page guards are unchanged.

**Checks run (round 2)**

| Check | Result |
|-------|--------|
| `npx vitest run tests/security` plus the unit tests for `http-with-route`, `next-config`, `system-pages`, `viewer-role`, `http-page-access` and `auth-session` (scratch copy of 561f48e) | 184 of 184 passed |
| Planted-fault probe (9 faults) | 9 caught: the flag removed; each label swapped; the null label set back to "your tasks"; the rethrow replaced by a throw; the warning given the message; the route log given `err`; a retry class changed; the home link's address changed |
| E2E | Not run locally; CI green |
