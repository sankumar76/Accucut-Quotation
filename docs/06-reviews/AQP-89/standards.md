# Review Report — AQP-89 (STORY-01.06: 12-hour session) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 (c4055f7); 2 (fix head cf42f87, DL-160 condition R; round 2 is at the end of this file) |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253; PR base b3403e3, master now 8ae01ef) |
| Commit reviewed | c4055f7461f0fa4d5ce116fede6c4264556b1afc |
| Date | 2026-11-11 |
| **Verdict, round 1** | **REQUEST CHANGES** (one Major, a missing decision record; no code change is required if the delivery lead approves the 7 days) |
| **Verdict, round 2** | **APPROVE WITH COMMENTS** (STD-01 to STD-07 and STD-14 closed, SEC-01 closed, four new Info items, none blocking) |

## Summary
The change is small in shape and well kept to the layering rules. The 12-hour rule lives in one constant and one check, the new browser-and-server shared module is a clean leaf, the server-only link keeps `Button` out of the client boundary, no token or secret is logged, and the return address still goes through the existing same-origin allow-list. One thing blocks: the cookie now outlives the token by 7 days (`SESSION_ENDED_NOTICE_DAYS`), which the Accepted ADR-009 and architecture section 8 contradict ("a cookie that lasts 12 hours from sign-in"), and no ruling or amendment exists yet (STD-01). The other findings are Minor or Info. The developer's four open decisions are assessed below.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 6 |

## Checks Run
Local disk was nearly full (about 4.4 GB free), so `npm ci` was not run and no tool was run locally. The tooling gates were taken from CI and checked against the diff.

| Check | Command / source | Result |
|-------|------------------|--------|
| Lint, format | CI run 43039133074, `Stages 1 to 11b` and `Stages 1 to 11` (stage 4, `eslint .`; ESLint is the formatter, no separate format check) | green on c4055f7 |
| Type-check | same run, stage 5 (`tsc --noEmit`) | green |
| Build | same run, stage 9 (`next build`) | green |
| Tests | same run: 5 of 5 checks green, including E2E shards 1 to 3 (per the Dev Record: unit 3,005, full 5,337, E2E 787) | green; counts not re-derived by me |
| Secrets (manual) | read the full `src` diff and a `grep` over the `tests` diff for secret, password, key, token and e-mail patterns | only invented values: `E2E_AUTH_SECRET` (the existing invented string, moved into one constant) and an invented key in `session-expiry.test.ts`; nothing real |
| gitleaks / Semgrep | not re-run (needs Docker and disk); the Dev Record states `gitleaks dir` over 32 paths: clean | not verified by me |
| Plant control | PR #254, run 43039914936 red at stage 6 (33 tests), as stated in the brief | not re-run; consistent with the Dev Record |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `src/server/auth/session-token.ts:26` (also `options.ts:90`) | Coding Standards §8 (ADR for significant decisions), §5; ADR-009 line 42; architecture §8 line 997, A-23 | The cookie lives `SESSION_ENDED_NOTICE_DAYS = 7` days longer than the token. ADR-009 (Accepted) and section 8 say the cookie "lasts 12 hours from sign-in". No ADR amendment, decision-log entry or delivery-lead ruling records the change. | The Accepted design and the code disagree on a security-relevant property (cookie lifetime). The code is sound: the token is refused at 12 h whatever the cookie says, and the constant is named and explained. | The delivery lead rules on the 7 days. If kept: solution-architect adds ADR-009 amendment 2 and updates section 8 and A-23 in a docs PR that merges first (CLAUDE.md section 8). If not: delete the constant (one line); SCR-26 then shows only for a token that is still readable. |
| STD-02 | Minor | `src/server/http/problem.ts:57`; `src/components/features/system-pages/system-page.tsx:29` | Coding Standards §2, §1 | `SESSION_ENDED_TITLE` is exported from two modules with two different words ('Your session ended. Sign in again.' and 'Your session ended'). | An import picks the wrong one; the two drift apart. | Rename the problem one `SESSION_ENDED_PROBLEM_TITLE`. |
| STD-03 | Minor | `src/lib/auth/session-ended.ts:43`; `src/lib/audit/audit-client.ts:71` | Coding Standards §1 (no magic numbers) | Literal `401` in two places in `src/lib`. The names `UNAUTHORIZED_STATUS` (`with-route.ts:88`) and `STATUS_UNAUTHORIZED` (`problem.ts:71`) exist but are private to `src/server`, which `lib` cannot import. | Third and fourth copy of one status. | `export const HTTP_UNAUTHORIZED = 401;` in `session-ended.ts`; use it in both places. |
| STD-04 | Minor | `src/server/auth/resolve-session-user.ts:66` | Coding Standards §10 / checklist 11 (dead code) | `resolveSessionUser` has no production caller now (`session.ts` calls `resolveSession`); five test files still import it. | A second public entry point beside "the one check" invites use of the lossy `null` form. | Doc line "kept for tests that need only the user; production uses `resolveSession`", or move the tests to `resolveSession` and delete it in a follow-up. |
| STD-05 | Minor | `src/server/auth/options.ts:90` | Coding Standards §4 (log levels) | Because the dead-token cookie is kept 7 days, next-auth logs `JWT_SESSION_ERROR` at error level on each request carrying it (the Dev Record's #255). No token or secret is in this PR's logging. | Error-level lines that nobody can act on will bury real errors. | next-auth's `logger` option can map that code to `debug`/`warn`; or keep #255 as the fix and have master label it `tech-debt` with an owner before G7. Not blocking by itself. |
| STD-06 | Minor | `src/server/auth/session.ts:37`; `src/lib/auth/session-ended.ts:38` | Coding Standards §5, §8 | The `x-session-cookie` header is called "the proxy's word", but the proxy matcher excludes `/sign-in`, `/api/auth/*` and static paths, where the browser's own header passes through. Harmless today (the only caller there is `getCurrentUser()`, where "ended" and "signed-out" both give `null`). | A future public page that calls `requireUserOrRedirect` would take a forged header and show SCR-26 (wording only, no access). | Add one sentence to both comments naming the matcher as the condition for trusting the header. |
| STD-07 | Minor | `src/server/auth/options.ts:98` | Coding Standards §8 (comments say why), §1 (fail fast) | The `: SESSION_MAX_AGE_SECONDS` fallback in `encode` gives a token that fails the schema a fresh 12 hours, with no comment. It is safe (such a token has no `signedAt`, so `resolveSession` returns `unreadable`), but the reason is not written. | A later reader sees "renew on the unhappy path". | One line: "A token without the three claims is never honoured (`resolveSession`: unreadable), so the default lifetime grants nothing." |
| STD-14 | Minor | `tests/unit/auth-session.test.ts:270` (also `auth-session.test.ts:30`, `tests/unit/http-problem.test.ts:67`, `tests/unit/system-pages.test.ts:29`) | Coding Standards §10 (no `as` casts to silence the compiler; validate external data) | Four new `as` casts in tests: `mocks.users.current as FakeUserRepository`, `(await response.json()) as object`, and two `null as string \| null` initialisers (one has a precedent on master). | A cast hides a wrong shape until it fails at run time with a poor message. | Narrow with `instanceof` and throw; parse the body with zod (`z.record(z.string(), z.unknown())`); give the hoisted mocks a typed interface instead of a cast. |
| STD-08 | Info | ADR-009 amendment 1 (line 111); architecture line 26; `session.ts` (`refused` path) | ADR-009; Coding Standards §8 | The second SCR-26 wording (sign-out elsewhere, password change) was due "before AQP-89 reaches G5" (ux-expert). It does not exist in ux-spec v0.22. The developer correctly did not invent it; those people get the plain sign-in redirect as before. | The ADR's own condition is unmet and G5 has passed; no regression in behaviour. | Not a code defect. Master to record the waiver or the date in the gate log; confirm #256 names the ux-expert as owner with a needed-by date. |
| STD-09 | Info | `system-page.tsx:29-31`; `src/app/unauthorized.tsx`; `sign-in/page.tsx` | AC-3, AC-6; ux-spec lines 513 and 1052 | "Sign in again" (AC) against "Sign in" (spec), and `role="alert"` on the SCR-01 notice (AC) against `status` (mock-up). The AC wording wins, as the Dev Record says; the words of the title, text and notice match ux-spec lines 513 and 1052 exactly. `Notice` already took a `role` override, so no new component was needed (good reuse). | None. | Accepted. #256 should carry both to the ux-expert so ux-spec v0.23 and `SCR-26.html` / `SCR-01.html` agree with the build. |
| STD-10 | Info | Jira AQP-89 Dev Context; architecture lines 286, 997 and A-23 (line 1730); ADR-009 line 42 | Coding Standards §8 (documentation) | Stale statements: `requireUser()` is "the one place" (it is `resolveSession`), `SESSION_LIFETIME_HOURS` (it is `SESSION_HOURS`), `system-pages/session-ended.tsx` (does not exist), "one check in `session.ts`" (it is in `resolve-session-user.ts`). The developer listed them and left design documents to their owners. | The architecture text will mislead the next change to sessions. | Confirm #256 lists each of these places, including the Session helper row (line 286) and A-23, not only section 8 and ADR-009. |
| STD-11 | Info | `src/lib/auth/session-ended.ts:127-132` | Architecture section 10 (`lib` is "pure code: no I/O") | `goToSessionEndedSignIn` touches `window.location` inside `src/lib`. The ESLint rule bans only imports from `next/*`, `server` and Prisma, and `lib` already holds browser clients (`api-client.ts`, `audit-client.ts`, `users-client.ts`). No violation. | None. | When the architecture is next revised, describe the `lib` browser clients so the "pure" label is accurate. |
| STD-12 | Info | `tests/e2e/session-ended.spec.ts`; `tests/unit/*`; `tests/integration/auth/session-expiry.test.ts` | Coding Standards §6 | Titles carry AC IDs in the `describe` and follow the project's sentence style, not `should_…` (consistent with the existing suite). Data is invented; clock is controlled; no sleeps. The E2E tests 1 and 3 hold several checks each, against "one behaviour per test", on purpose: RISK-023 prices every E2E instance, and the spec header says so. `auth-session-ended.test.ts` first `describe` (line 20) has no AC ID. | None. | Accepted. Optionally add the AC ID to that `describe`. |
| STD-13 | Info | PR #253 | Coding Standards §9; CLAUDE.md §7.3 | Branch `feat/AQP-89-twelve-hour-session`, three Conventional Commits each with `[AQP-89]`, PR title `AQP-89: STORY-01.06: 12-hour session`, 32 files all in scope, nothing generated or secret. The branch is 2 commits behind master (c6b9074 docs, 8ae01ef #235 masters screens; neither touches auth), and the remote branch `control/AQP-89-plants` was left behind. | Housekeeping only. | Orchestrator: update-branch before merge (CI must re-run on the result) and delete `control/AQP-89-plants`. |

<details><summary>Detailed notes and the four decisions to check</summary>

### Decision 1: `SESSION_ENDED_NOTICE_DAYS` (STD-01)
A browser deletes an expired cookie, and a request with no cookie cannot be told from a stranger's, so without a longer cookie SCR-26 could show only in the last second of the session. The mechanism is correct and conservative: `hasSessionEnded` and `isWithinSession` refuse the token at 12 hours independent of the cookie, and `jwt.encode` caps the token's own expiry at sign-in plus 12 hours. Cookie flags (HttpOnly, Secure, SameSite=Lax, the `__Secure-` prefix) are untouched; only `maxAge` changes. The finding is only that the decision is unrecorded while the Accepted ADR says otherwise. It is the delivery lead's call (per the brief). Standards position: either outcome is fine once it is written down.

### Decision 2: the second wording (STD-08)
Right call not to invent copy. Behaviour for a deactivated user, a role change and a `session_version` mismatch is unchanged and tested (AC-5). The `refused` state is kept distinct from `ended` precisely so the wrong words are never shown.

### Decisions 3 and 4 (STD-09, STD-10)
Where the AC and the UX spec differ, the AC is the contract. The developer recorded each difference. The stale Dev Context is correctly handled by describing it in the PR, not by editing the story.

### Layering, error handling, logging, security hygiene (no finding)
- `app/unauthorized.tsx` is thin: it reads the proxy's return-address header and renders. No business logic in `app` or `components`.
- `lib/auth/session-ended.ts` imports only `./return-path`; `server/http/problem.ts` and `server/auth/*` import from `lib`, never the other way. Direction is inward.
- `SignInAgainAction` is `server-only`, keeping `Button` and `next/link` out of the client error boundary (PRF-01), the same pattern as `home-action.tsx`.
- `UnauthorizedError('Your session ended.', { code })` carries a fixed message; `problemFromAppError` replaces it with fixed words, so no detail leaks. The 401 stays at `debug` in `with-route.ts:184`.
- The open-redirect rule is reused (`safeReturnPath`, `signInPathFor`), the `reason` query value is matched against one exact string, and no new dependency was added (`next-auth/jwt` is part of the pinned next-auth).
- Function and file sizes: all new functions are under 40 lines; `session.ts` is 97 lines; the largest test file is 362 lines (limit 400). Line widths follow the existing code (up to about 150 characters in untouched files); no formatter rule exists.
- No `any`, no non-null assertions, no `console`, no TODO, no commented-out code in the diff. `src` has no `as` casts; the four in tests are STD-14.
</details>

## Previous Findings (re-review only)
Round 1 had no earlier findings. The round 2 verification of each finding above is in the next section.

---

# Round 2 — re-review of the fix push (DL-160 condition R)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 |
| Scope | `c4055f7..cf42f87`, read as `e3cd1d4..cf42f87` (see "Merge commit") |
| Commits reviewed | `9b1df51` (round-2 findings, #255 logger), `cf42f87` (SEC-01 route guard, PRF-01 code fix) |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
Every standards finding from round 1 is fixed or closed by record, and SEC-01 is closed correctly. The route guard answers 404 for `_log` on both exported methods before next-auth is built, it reads the same `context.params.nextauth[0]` that next-auth itself uses to choose the action, and the test fails if the guard is removed. `logger` is read in only two places in next-auth 4.24.15 (`setLogger`, and the `_log` case), so no other action is newly enabled. The logger writes only an identifier-shaped code, error name and error code, and maps levels as DL-160 (4) says. Lint and type-check pass at the fix head. The four new findings are all Info.

| Severity | New in round 2 | Carried from round 1 (open) |
|----------|----------------|------------------------------|
| Blocker | 0 | 0 |
| Critical | 0 | 0 |
| Major | 0 | 0 (STD-01 closed by DL-157) |
| Minor | 0 | 0 (STD-02 to STD-07, STD-14 fixed) |
| Info | 4 (STD-15 to STD-18) | 6 (STD-08 to STD-13, no action by the developer; owners as in round 1) |

## Checks Run (round 2)
| Check | Command / source | Result |
|-------|------------------|--------|
| Lint | `node_modules/.bin/eslint` over the 13 changed paths (`route.ts`, `unauthorized.tsx`, `system-pages/`, `audit-client.ts`, `session-ended.ts`, `server/auth/`, `problem.ts`, the five changed unit tests, `auth-log-route.test.ts`, `session-ended.spec.ts`), run in the existing worktree `agent-ab71d2b482fac159e`, whose HEAD is `cf42f87` (checked) | exit 0, no output |
| Type-check | `node_modules/.bin/tsc --noEmit` in the same worktree | exit 0 |
| Format | ESLint is the formatter in this project (no separate format check) | covered by the lint run |
| CI | PR #253 check runs on `cf42f87`, run 43137162924: Stages 1 to 11, 1 to 11b, E2E shards 1 to 3 | 5 of 5 `success` (read from the check-runs API; counts not re-derived by me) |
| Unit tests | not run by me (outside the read-only command list); taken from CI | green in CI |
| Secrets | read the full fix diff; `grep` for `console.`, `TODO`, `FIXME`, `eslint-disable`, `@ts-` in the added lines | none found. Invented values only: `invented-log-route-test-key-material`, `invented-other-key-material`, and a fake token string in `auth-options.test.ts` that starts with the public base64 of `{"alg":"dir","enc":"A256GCM"}` (a header, not a secret; CI gitleaks passed) |
| gitleaks / Semgrep | not re-run locally (the gitleaks stage ran in CI and is green) | not verified by me beyond CI |
| Plant control | #284 (log guard removed) red per the brief | not re-run; consistent with the test (see SEC-01) |

## Merge commit
`git show --cc e3cd1d4` prints the header and nothing else: no conflict resolution, no hunk of its own. None of the 32 PR files is touched between `c4055f7` and `e3cd1d4` (`git diff --name-only c4055f7 e3cd1d4` against the PR file list `b3403e3..c4055f7` has no common path). So `e3cd1d4..cf42f87` is exactly the fix diff: 15 files, 360 insertions, 31 deletions. 13 are among the original 32; the other two are `src/app/api/auth/[...nextauth]/route.ts` and `tests/unit/auth-log-route.test.ts`, which are the SEC-01 files the brief allows.

## SEC-01 — the `_log` relay (Major, security, added after G6): **Fixed**
`src/app/api/auth/[...nextauth]/route.ts:21-25`.

| Question | Answer, with evidence |
|----------|-----------------------|
| Is `_log` blocked for every exported method? | The module exports exactly two names: `export { handle as GET, handle as POST }` (line 30). Both are the one `handle`, whose first statement is the guard, so GET and POST are blocked by the same line. next-auth itself serves `_log` only as a POST case (`core/index.js:285`); GET would not have reached it, and is blocked anyway. A method that is not exported is not run by this module at all (Next.js answers it, by its own rules, without calling next-auth), so no other method can reach `_log`. The test covers three POST bodies and one GET. |
| Can the check and the use disagree on the action? | No. The guard reads `(await context.params).nextauth[0]`. next-auth's App Router adapter reads the action from the same value (`next/index.js:54` and `:64`, `action: nextauth?.[0]`). `/api/auth/_log/anything` has `nextauth[0] === '_log'`, so it is blocked too. A different case (`_LOG`) is not an action in next-auth's `switch` (it is case-sensitive), so it is not a bypass. |
| Does the guard run before anything that could log or build options? | Yes. It is the first statement of `handle`, before `getAuthOptions()` and `NextAuth(...)`, so the options and the logger are not even built for that request. |
| Is any other next-auth action newly enabled by `logger`? | No. In 4.24.15 `authOptions.logger` is read in two places: `core/index.js:58` (`setLogger(authOptions.logger, authOptions.debug)`) and the `_log` case (`:285-297`). Nothing else branches on it. |
| Does the logger write only a name and a code? | Yes. `buildNextAuthLogger` (`options.ts:118-136`) builds fields from `loggable(code)` and `failureOf(metadata)`, which picks only `name` and `code` of the failure and passes each through `LOGGABLE_VALUE = /^[A-Za-z0-9_.-]{1,64}$/` (`options.ts:93-103`). A value that is not an identifier becomes `unknown` or is dropped. `warn(code)` ignores its metadata entirely. The message, stack, token and claims are never read. Tests (iv) and the hostile-value test pin this, with a message and stack that contain the planted text. This is defence in depth: with the route closed, the only caller of the logger is next-auth's own code. |
| Is the level mapping the one DL-160 (4) rules? | Yes. An expired token (`ERR_JWT_EXPIRED`) under `JWT_SESSION_ERROR` goes to `debug` (`:124-125`). Any other `JWT_SESSION_ERROR` goes to `warn` (`:126-127`). Every other `error` code stays at `error` (`:122-123`), every `warn` at `warn` (`:130-131`), every `debug` at `debug` (`:133-134`), and none is dropped. Tests (i), (ii), (iii) use the real jose errors from `decode`, not hand-made ones. The default next-auth logger replaced here is the only place where `formatError` (which would drop `code`) runs, so the custom `error(code, metadata)` receives the raw error with its `code`. I read `utils/logger.js` to confirm that. |
| Is the test an honest test? | Yes. The real `route.ts` and the real `buildAuthOptions` run; only the adapter is replaced by next-auth's own `AuthHandler` (the same technique as `tests/integration/auth/sign-in-handler.test.ts` and two others, which also import `node_modules/next-auth/core/index.js` by relative path). If the guard line is removed, the stand-in forwards `_log` to the real core, which calls the logger, and `nothingWasLogged()` fails; GET would also change from 404. A fourth case proves the other routes still reach next-auth. Names are descriptive sentences in the project's existing style, one behaviour per test, invented data. |

**Standards check of the new code**: `LOG_RELAY_ACTION` and `NOT_FOUND_STATUS` are named constants (§1); the doc comment says why the route is closed and cites the finding (§8); a one-line guard with no business logic in the route (§3); no `any`, no cast, no non-null assertion (§10); the `Response` carries no body, so nothing leaks (§5). The route file is 30 lines.

## Re-verification of the round 1 findings
Replies were posted in the original threads (see the PR review). Status:

| ID | Round 1 | Round 2 | Evidence at `cf42f87` |
|----|---------|---------|-----------------------|
| STD-01 | Major | **Fixed (resolved by documentation)** | DL-157 (KEEP), ADR-009 `Amendment 2` (line 120 on `origin/master` 774eff8), architecture v0.39 on `origin/master`. No code change was due. The closure holds because those records are on `master`, which the merge commit `e3cd1d4` brought in. |
| STD-02 | Minor | **Fixed** | `problem.ts:57` is now `SESSION_ENDED_PROBLEM_TITLE`, used at `:91`. `git grep` finds no other use of the old name from `problem.ts`; `system-page.tsx:30` keeps `SESSION_ENDED_TITLE` for the page. The E2E spec uses its own two constants with the two different words. |
| STD-03 | Minor | **Fixed** | `session-ended.ts:16` exports `HTTP_UNAUTHORIZED = 401`, used at `:49` and `audit-client.ts:71`. One literal 401 remains in `src/lib/errors.ts:48`, which this PR did not touch (see STD-18); it is not part of the finding. |
| STD-04 | Minor | **Fixed** | `resolve-session-user.ts:66` "Kept for tests that need only the user; production uses `resolveSession`." |
| STD-05 | Minor | **Fixed** | The #255 `logger` (`options.ts:143`) with the DL-160 (4) levels and the tests above. It brought SEC-01 with it, now closed. |
| STD-06 | Minor | **Fixed** | `session.ts:37-38` and `session-ended.ts:41-42` name the proxy matcher as the condition for trusting `x-session-cookie`. |
| STD-07 | Minor | **Fixed** | `options.ts:155` carries the line asked for, in nearly the same words. |
| STD-14 | Minor | **Fixed** | `http-problem.test.ts` parses the body with `z.record(z.string(), z.unknown())`; `system-pages.test.ts` and the `sessionCookie` holder in `auth-session.test.ts` use typed objects; the `FakeUserRepository` cast is gone (the test keeps the `users` it created). Two `as` expressions remain in `auth-session.test.ts` (`undefined as unknown`, `null as string \| null` for `returnPath`); both are on `master` (lines 21 and 22) and were not part of the finding. |
| STD-08 | Info | Waived | DL-160 (9): waived for AQP-89's gates, owner ux-expert via #256, needed by G8. Not a code matter. |
| STD-09 | Info | Accepted | DL-160 (9) sends it to #256. |
| STD-10 | Info | Fixed | Done in architecture v0.39 (DL-160 (1): checked by grep). |
| STD-11 | Info | Fixed | Done in architecture v0.39 (section 10). |
| STD-12 | Info | Accepted | Round 2 follows the same style. E2E test 2 now holds an API check and the SCR-01 checks together, as DL-160 (4) asked ("preferably inside E2E test 2"), to avoid a fourth E2E instance (RISK-023). |
| STD-13 | Info | Open, housekeeping | Branch update done (merge commit `e3cd1d4`). Deleting the `control/AQP-89-*` branches is the delivery lead's task before G8 (DL-160 (12)). |

## New findings (round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-15 | Info | `docs/04-architecture/architecture.md:908` (section 6 route table, `/api/auth/*` row); ADR-009 | Coding Standards §8 (documentation, ADR for significant decisions) | `buildAuthOptions` now sets next-auth's `logger`, which makes `POST /api/auth/_log` live unless the route closes it. That is a security invariant, and today it is written only in the route's comment and pinned by `auth-log-route.test.ts`. Neither the route table row nor ADR-009 mentions it. | A later change that replaces the route handler or moves to another auth library could drop the guard. The test would fail, but the reason lives only in code. | Solution-architect: one sentence in section 6 or section 8 ("`/api/auth/_log` is answered 404 by the route; next-auth's `logger` option would otherwise enable it, SEC-01") at the next architecture revision, or under #256. Not a merge condition. |
| STD-16 | Info | `src/server/auth/options.ts:118-136` (and next-auth `utils/logger.js` `setLogger`) | Coding Standards §4 (log levels) | next-auth's `setLogger` keeps its debug logger a no-op only when no `logger.debug` is supplied. Supplying `debug` therefore turns on next-auth's debug calls although `authOptions.debug` is unset. Today that is harmless: those calls are OAuth-only (`GET_AUTHORIZATION_URL`, `PROFILE_DATA`, `OAUTH_CALLBACK_RESPONSE`, `CREATE_*`) and the portal uses the credentials provider alone; the function writes only code, name and error code; and the shared pino logger runs at `info` (`src/lib/logger.ts:77`), so `debug` lines are not written at all. | If an OAuth provider is added, the debug calls start to run (cheaply) and only a lower log level would show them. Because of the field allow-list, no token or profile data could be written. | None needed. A one-line note in the comment above `buildNextAuthLogger` that `debug` is supplied so that the expired-token line has a place to go, and is dropped by the `info` level. Praise: the allow-list design makes this safe by construction. |
| STD-17 | Info | commits `9b1df51`, `cf42f87`, `e3cd1d4` | Coding Standards §9 (one logical change per commit; Conventional Commits with story ID) | `9b1df51` bundles about ten findings (STD-02/03/04/06/07/14, QLT-02, QLT-03, #255). `cf42f87` bundles two changes (SEC-01 route guard, PRF-01 chunk fix). The merge commit message `Merge branch 'master' into feat/AQP-89-twelve-hour-session` has no `[AQP-89]`. Both fix commits have valid `fix(auth): ...` subjects, the key, and the session trailer; the branch name `feat/AQP-89-twelve-hour-session` is correct; no generated file, secret or unrelated file is committed. | None in practice: the PR is squash-merged (CLAUDE.md §8), so this history never reaches `master`, and DL-160 (4) asked for "one fix push". | None. For a later round, one commit per concern makes a bisect through the PR easier. |
| STD-18 | Info | `src/app/api/auth/[...nextauth]/route.ts:19-20`; `src/lib/errors.ts:48` | Coding Standards §8 (comments say what is true), §1 (no magic numbers) | The comment says "Any method gets the same plain 404". Only GET and POST are exported, so those are the methods the guard sees; any other is answered by Next.js without reaching this module. Separately, `src/lib/errors.ts:48` still holds a literal `401` beside the new `HTTP_UNAUTHORIZED` (not part of this PR). | The comment is slightly wider than the code. The literal is a fifth copy of one status. | In the comment: "Both exported methods get the same plain 404." Optionally, `UnauthorizedError` imports `HTTP_UNAUTHORIZED` in a later clean-up. |

## PRF-01 code fix (cross-reference, reviewer-performance's lane)
Standards view only. `FocusMainHeading` moved from `unauthorized.tsx` into `SystemPageCard`, shown only for `kind === 'session-ended'` (`system-page.tsx:100`). The `unauthorized.tsx` doc comment says why (PRF-01). The only render of that kind is `unauthorized.tsx`; the design-system page and the other system pages do not use `session-ended`, so no other page gets the focus move. The import points inward (feature component to shared component), and the unit and E2E tests of the card and of the focus are unchanged and green. The size claim is for reviewer-performance to read.

## Review IDs in comments
New comments cite review IDs (`SEC-01`, `PRF-01`, `STD-14`, `QLT-03`, and "issue 255"). The repository already does this widely (for example `STD-19` in `options.ts:74` and `PRF-01` in `masters-service.ts:181`), so it is consistent and I raise no finding.

## Hand-off (round 2)
Verdict: APPROVE WITH COMMENTS. Counts for round 2: Blocker 0, Critical 0, Major 0, Minor 0, Info 4 (STD-15 to STD-18). Round 1 items: STD-01 closed by record, STD-02 to STD-07 and STD-14 fixed, SEC-01 fixed. Standards position for condition R: met.
