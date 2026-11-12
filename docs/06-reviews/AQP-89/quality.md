# Review Report — AQP-89 (STORY-01.06 12-hour session) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | **2** (DL-160 condition R), on the fix diff only. Round 1 is kept below as written |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253) |
| Commits reviewed | Round 1: c4055f7. **Round 2: `git show --cc e3cd1d4` (merge of `master` 46f56d6) and `git diff e3cd1d4 cf42f87`** (9b1df51, cf42f87) |
| Date | 2026-11-11 (round 1), 2026-11-12 UTC (round 2) |
| **Verdict** | Round 1: REQUEST CHANGES. **Round 2: APPROVE WITH COMMENTS.** 0 Blocker, 0 Critical, 0 Major; 1 Minor (QLT-11); new Info QLT-12 to QLT-14; carried Info QLT-04 to QLT-07 and QLT-09 |
| PR review | Round 1: https://github.com/sankumar76/Accucut-Quotation/pull/253#pullrequestreview-5861690717. Round 2: https://github.com/sankumar76/Accucut-Quotation/pull/253#pullrequestreview-5868016435 (COMMENT on cf42f87, single-token; label `review:quality-approved`; replies in the QLT-01, 02, 03, 08 and 09 threads) |

# Round 2 (fix head cf42f87)

## Summary

The fix push does what DL-160 asked of it, and SEC-01 is closed.

- **QLT-02 is fixed.** Two tests were added: `auth-session.test.ts`, and the `session` callback case in `auth-options.test.ts`. My DL-160 (5) re-plant of P2 (#287), the exact mutation that survived round 1, is now **red**: 1 failed / 3,025.
- **QLT-03 is fixed.** E2E test 2 now asks the real server for `/api/v1/users` with an ended cookie and checks the exact problem body. My plant E1 (#286) breaks the one link no unit test covers: the proxy stops forwarding `x-session-cookie` on API paths. With it, every Vitest stage stays **green**, and E2E test 2 is **red at all three widths**, receiving `UNAUTHORIZED` instead of `SESSION_ENDED`. The new check therefore closes the gap QLT-03 named.
- **QLT-08 / #255 is fixed.** The fix-head E2E logs hold no `[next-auth][` line and no `JWT_SESSION_ERROR` line (DL-160 (5)). The logger is wired: `warn` `NEXTAUTH_URL` appears once per server start. The developer's plants L1 to L3 are each red on the intended test.
- **SEC-01 is closed correctly.** The guard reads the same value next-auth's App Router adapter uses as `action` (`context.params.nextauth[0]`; `next-auth/next/index.js:54,64`). It compares it exactly, as next-auth's case-sensitive `switch` does. So no path, casing, encoding, query or method variant reaches the relay (table below). The test spies pino at all four levels, and the developer's plant #284 turns all four `_log` cases red.

The one Minor (QLT-11) is that the SEC-01 test drives next-auth's core through a stand-in for the adapter. So the guard and next-auth reading the same value is shown by reading the source, not by a real request. One request in an existing E2E test would pin it. It does not block.

| Severity (open after round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 (QLT-01 resolved by documentation, DL-157) |
| Minor | 1 (QLT-11, new) |
| Info | 8: QLT-12 to QLT-14 (new); QLT-04, QLT-05, QLT-06, QLT-07, QLT-09 (carried, owners named) |

## Checks run (round 2)

| Check | Command / evidence | Result |
|-------|--------------------|--------|
| Merge commit | `git show --cc e3cd1d4` (parents c4055f7, 46f56d6) | **Empty**: clean merge, no conflict hunks. `git diff c4055f7 e3cd1d4 -- <32 PR files>` = 0 lines (DL-160 (3)) |
| Fix diff | `git diff e3cd1d4 cf42f87`: 15 files, +360 / −31 | 13 in the round-1 set. **Two outside it:** `src/app/api/auth/[...nextauth]/route.ts` and the new `tests/unit/auth-log-route.test.ts` (SEC-01; named in the PR body). See "Issues for other roles" |
| PR CI at cf42f87 | run 43137162924, merge ref b9bdec6 = cf42f87 into `master` 774eff8, 5 of 5 | Green. Unit **3,026**, full Vitest **5,398**, E2E 268 + 266 + 253 = **787**, skipped 3 + 4 + 17 = **24**. Against 774eff8 (2,922 / 5,285 / 778 / 24, DL-163): **+104 / +113 / +9 / +0**. That is DL-160 (7) with n_u = 13 (I counted the `it` cases: 1 + 1 + 6 + 5), n_i = 0, e = 0. Changed-code coverage **100 %** (94 of 94) |
| Local unit run | `npx vitest run` over `auth-log-route`, `auth-options`, `auth-session`, `system-pages`, `http-problem` in the developer worktree at cf42f87 (existing `node_modules`, no install) | **126 / 126 passed** |
| next-auth log lines in E2E | `gh run view 43137162924 --log`, grep | 0 `[next-auth][` lines, 0 `JWT_SESSION_ERROR`; 3 pino `warn` `NEXTAUTH_URL` lines (one per server start) |
| Developer plants | #280 L1, #281 L2, #282 L3, #283 P2, #284 SEC-01; each one commit on cf42f87, diff read | **All red, on the intended tests only** (1 failed file of 155 each, E2E green): L1 → `auth-options` (iii) and the hostile-value case; L2 → (i); L3 → (i), (iii), (iv) and the hostile-value case; P2 → the QLT-02 case; SEC-01 → `auth-log-route` all three POST cases and GET |
| **QLT plant E1** (proxy forwards no `x-session-cookie` on an API path) | #286, run 43139690868 | **RED, E2E only.** `Stages 1 to 11b` green (no unit test sees it); `session-ended.spec.ts:53` test 2 red at mobile, tablet and desktop (also on retry): `code: "UNAUTHORIZED"`, `title: "Sign in to continue."`. `Stages 1 to 11` red only as the E2E aggregate (`RESULT_VERIFY: success`, `RESULT_E2E: failure`) |
| **QLT plant P2 re-plant** (DL-160 (5)) | #287, run 43139857014 | **RED**: 1 failed / 3,025 passed, `auth-session.test.ts` "QLT-02: …". E2E green |
| Secret scan before each push (DL-094) | `gitleaks dir` v8.30.1 (Docker) on the planted files | No leaks |
| ADR-009 amendment 2 on `master` (condition M, for QLT-01) | `git show origin/master:docs/04-architecture/adr/ADR-009-…md` | Present (Status line and §"Amendment 2") |
| Branch currency | `git rev-list --count cf42f87..origin/master` | 3 (the Dependabot squashes of DL-163; only `package.json` and `package-lock.json`, no overlap with the PR). The CI merge ref already includes 774eff8 |
| Control PRs | #286, #287 | Closed unmerged, with a result comment. Branches `control/AQP-89-qlt-r2-e2e-api` and `control/AQP-89-qlt-r2-p2` remain for the delivery lead (DL-160 (12)) |

## SEC-01 verification

**Source read:** next-auth 4.24.15 (`package.json` version), `core/index.js` (`_log` at l.285–297, gated by `authOptions.logger`, POST branch only), `next/index.js` (both adapters, the `NextAuth` dispatcher), `utils/logger.js` (`setLogger`, `proxyLogger`).

| Question | Finding |
|----------|---------|
| Does the guard depend on next-auth's action parsing? | It uses **the same value**. `NextAuth(options)` returns `(req, ctx) => ctx.params ? NextAuthRouteHandler : NextAuthApiHandler`. The route passes `context`, which always has `params`, so the App Router adapter runs, and it sets `action = (await context.params).nextauth[0]` (l.54, 64). The guard reads the same expression. Neither the core nor the adapter changes case (`grep toLowerCase` gives nothing), and the core's `switch` is exact. So the guard is equivalent to next-auth's dispatch, not a parallel parser |
| `/api/auth/_log/` (trailing slash) | `next.config.ts` has no `trailingSlash`, so Next answers 308 to `/api/auth/_log` with the method kept. Either way `params.nextauth` is `['_log']` → 404 |
| `/api/auth/_log/x` | `['_log', 'x']`: the guard checks `[0]` → 404 |
| `/api/auth/_LOG`, `/api/auth/%5Flog` | `_LOG` passes the guard, but next-auth's POST `switch` has no `_LOG` case → its 400 "not supported", nothing logged. `%5Flog`: whatever string Next gives in `params`, the guard and next-auth see the same one: either `_log` (404) or not the action |
| `?nextauth=_log` on another action | The App Router adapter takes `query` only from `req.nextUrl.searchParams` for `query` and `error`, never for `action`. `req.query.nextauth` is read only by the Pages API adapter (l.14), which never runs here: there is no `pages/` directory, and `NextAuth(` has one caller, `route.ts` |
| GET, HEAD, other methods | GET and POST share `handle` → 404. Next answers HEAD with the GET handler → 404. OPTIONS is Next's automatic answer and never reaches the handler. Other methods → 405. The core handles `_log` for POST only in any case |
| Other ways into next-auth's core | `getServerSession` runs the core with `action: "session"` only. The portal does not use `next-auth/react` (`src/lib/auth/auth-client.ts` stands in for it), so no browser beacon goes to `_log`, and the 404 breaks nothing |
| Does `logger` switch on anything else? | `authOptions.logger` is read in three places: `setLogger` (core l.58), the internal logger handed to `SessionStore` (l.121), and `_log` (l.287). Only `_log` is an endpoint. Side effect: `setLogger` lets a supplied `debug` replace the no-op that `debug: false` installs, so next-auth's debug lines now reach pino `debug` → QLT-12 (Info) |
| Is the test meaningful? | Yes, within its seam. It runs the **real** route, the **real** `buildAuthOptions` (with the real logger) and next-auth's **real** core. pino is replaced by spies at `debug`, `info`, `warn` and `error`, and `nothingWasLogged` checks all four. There are three POST bodies at three levels (including one forged as the expired-token code), GET, and a positive control (`/api/auth/csrf` still reaches next-auth and returns a token). Plant #284 (the guard matches `_log-off`) turns all four `_log` cases red. Limit: the adapter is a stand-in that derives `action` as the real one does → QLT-11 |
| Defence in depth | `LOGGABLE_VALUE` (`/^[A-Za-z0-9_.-]{1,64}$/`) replaces any code, name or error code that is not a plain identifier. So even with the route open, a forged line could not inject JSON or newlines. The hostile-value test covers it, and L1 and L3 break it |

## Round-1 findings, re-checked

| ID | Round-1 severity | Status | Evidence |
|----|------------------|--------|----------|
| QLT-01 | Major | **Resolved (documentation)** | DL-157 KEEP; ADR-009 amendment 2 is on `master`; DL-160 (1). No code change, as foreseen |
| QLT-02 | Minor | **Fixed** | `auth-session.test.ts` "QLT-02 …" (also checks `requireUser` → `SESSION_ENDED`) and `auth-options.test.ts` (`session` callback drops the user when `signedAt` is missing). P2 red twice: developer #283, my #287 |
| QLT-03 | Minor | **Fixed** | E2E test 2: `context.request.get('/api/v1/users')` with `addEndedSession(context, 'expired-token')`. It checks 401, `application/problem+json`, `private, no-store`, and an exact `toEqual` body (no extra members, so no data). E1 red only there. The browser hop (`handleSessionEnded` → SCR-01) stays unit-tested plus QA's own run (DL-160 (10)) |
| QLT-04 | Info | Open, owner ux-expert (#256), due G8 | Unchanged code; the wording question is with #256 |
| QLT-05 | Info | Open (optional) | `resolveSessionUser` now says it is test-only (STD-04). The two predicates are still ordered in one place |
| QLT-06 | Info | Open (latent) | Unchanged; only relevant if the app runs on more than one host |
| QLT-07 | Info | Open, owner ux-expert (#256), due G8 (DL-160 (9)) | Unchanged |
| QLT-08 | Info | **Fixed** (#255) | Expired `JWT_SESSION_ERROR` → `debug`, other `JWT_SESSION_ERROR` → `warn`, other codes keep their level; only code, name and error code are written. Tests (i) to (iv) use real jose errors. The E2E logs are clean |
| QLT-09 | Info | **Open, for QA at G7** | Unchanged. QA checks what it can, and the delivery lead's device session runs the real screen reader before G8 (DL-160 (10)) |
| QLT-10 | Info (praise) | Stands | `encode` now also says why a token without the three claims gets the default lifetime (it is never honoured) |

## AC conformance (round 2 delta)

| AC | Change since round 1 | Result |
|----|----------------------|--------|
| AC-1 | none | Met |
| AC-2 | `encode` comment only | Met (DL-160 (2)) |
| AC-3 | `FocusMainHeading` moved from `unauthorized.tsx` into `SystemPageCard` for `kind === 'session-ended'` (only `unauthorized.tsx` uses that kind). E2E test 1 (focus on the heading, 3 widths) is green | Met |
| AC-4 | API 401 `SESSION_ENDED` checked against the real server (E1 red) | **Met and now verified end to end on the server side**; the browser hop stays unit-tested plus QA (DL-160 (10)) |
| AC-5 | test refactor only (typed holder, STD-14) | Met |
| AC-6 | as AC-3 | Met; QLT-09 with QA |

## Findings (round 2)

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-11 | Minor | `tests/unit/auth-log-route.test.ts:41-55` | Test adequacy (SEC-01) | The test replaces next-auth's App Router adapter with a stand-in that derives `action` from `nextauth[0]` itself (l.49). The property the control rests on, that the guard and next-auth read the same value, is shown by reading `next/index.js:54,64`. No real request through Next.js routing shows it | A future next-auth release that derives `action` differently (for example from the URL) would reopen `_log` with this test still green. Next-auth bumps come in as Dependabot PRs, whose CI is the only check | Add to an existing E2E test (no new entry, e = 0), after its other steps: `const relay = await context.request.post('/api/auth/_log', { form: { level: 'error', code: 'QLT_11' } }); expect(relay.status()).toBe(404);` (optionally also `/api/auth/_log/x`). Or a follow-up issue. It does not block G6 |
| QLT-12 | Info | `src/server/auth/options.ts:133`, `:143` | Operability | Supplying `logger.debug` makes `setLogger` forward next-auth's debug lines, which `debug: false` used to silence (`utils/logger.js` l.49–52) | None today: only the code, error name and error code are written, and pino runs at `info` (`src/lib/logger.ts:77`). At `debug`, codes such as `CHUNKING_SESSION_COOKIE` would appear, with no claims | None needed. Optionally mention it in the `buildNextAuthLogger` comment |
| QLT-13 | Info | `src/components/features/system-pages/system-page.tsx:100` | Design (PRF-01 fix) | A page-level focus effect now sits inside a presentational card, keyed on one `kind` | Acceptable: the card is the whole content of every system page, and the effect is tied to the kind that needs it. The E2E focus check covers it. Byte effect → reviewer-performance | None |
| QLT-14 | Info (praise) | `src/server/auth/options.ts:93-137`; `tests/unit/auth-options.test.ts` | Correctness, test quality | The logger tests feed it the errors jose really throws (expired, wrong key, malformed), not hand-made objects. The leak test plants a token in the message, stack and extra fields, and checks every level. The identifier filter keeps the logger safe even if `_log` were reachable. The SEC-01 test has a positive control | n/a | n/a |

## Issues for other roles (round 2)

- **master:** (1) DL-160 (4) asked for the fix "in the PR's 32 files". SEC-01 adds `route.ts` and `tests/unit/auth-log-route.test.ts`, and the PR body states it. From the quality side the extension is necessary and contained. (2) DL-163 (4)(a): #253 does not yet contain 774eff8 (3 Dependabot squashes, package files only, no overlap). The CI evidence is already on a merge ref with 774eff8. Whether the merge commit is needed before G6 attempt 2 or before the squash is your ruling. (3) QLT-11: a follow-up issue, or one request in E2E with the next push, your choice.
- **qa-engineer (G7):** QLT-09 (real screen reader via the delivery lead's device session, DL-160 (10)), and the AC-4 browser hop.
- **delivery lead:** delete `control/AQP-89-qlt-r2-e2e-api` and `control/AQP-89-qlt-r2-p2` with the other AQP-89 control branches (DL-160 (12)).

# Round 1 (c4055f7), kept as written

## Summary

The server logic is correct:

- **The 12 hours.** They run from sign-in, in epoch seconds, with no calendar or time-zone dependence.
- **The token's own expiry.** It is pinned to `signedAt + 12 h` by the `jwt.encode` override. This override is load-bearing. next-auth 4.24.15 re-encodes the token in `/api/auth/session` with `maxAge: options.session.maxAge` (`core/routes/session.js` l.73–77). Since this PR sets that to 12 h + 7 days, a token without the override would live 7.5 days.
- **The sign-in time.** A client cannot move `signedAt`: the `jwt` callback ignores `trigger: "update"`.
- **Refusals inside the 12 hours.** Deactivation, role change and `session_version` still refuse (AC-5).
- **Return addresses.** Every one goes through `safeReturnPath`.

**The one Major, QLT-01, is about process.** The cookie is kept 7 days after the token dies, so SCR-26 can be shown. That contradicts ADR-009 and architecture §8 ("a cookie that lasts 12 hours from sign-in"), and no decision records the change. The developer flagged it openly. My security analysis finds no replay path and no disclosure. If the delivery lead and the architect accept it, QLT-01 closes with no code change.

**Plants.** I planted three faults of my own, each alone:

- The 12-hour boundary (P1) is caught.
- The SCR-26 return-address check (P3) is caught.
- A session with no sign-in time counted as "now" (P2) **survived every stage** (QLT-02). It is test-only today, because the `session` callback returns all three claims or none.

**QLT-03.** AC-4's chain (API → 401 `SESSION_ENDED` → the browser leaves for SCR-01) is tested link by link with mocks, but never end to end.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-01) |
| Minor | 2 (QLT-02, QLT-03) |
| Info | 7 (QLT-04 to QLT-10) |

## Checks Run

Machine limits: the disk is nearly full (about 4.5 GB free) and the worktree has no `node_modules`, so nothing ran locally (no vitest, tsc, Playwright or database). The code was read with `git show c4055f7:<file>` and `git diff b3403e3...c4055f7`, together with callers (`git grep`) and next-auth 4.24.15's source (`core/routes/session.js`, `jwt/index.js`, `core/init.js`, `next/index.js`). Executed evidence comes from CI on throwaway control PRs built from c4055f7 plus one commit each. Each PR had its diff printed in its description and was closed unmerged.

| Check | Command / evidence | Result |
|-------|--------------------|--------|
| PR CI at c4055f7 | run 43039133074 (G5 evidence) | Green, 5 of 5. Unit 3,005; full Vitest 5,337; E2E 787 passed, 24 skipped; changed-code coverage 100 % (75 of 75) |
| Developer plant control | #254, run 43039914936 | Red at stage 6, 33 tests in 7 files; three plants also run alone (developer's record). Accepted |
| **QLT plant P1**: accept at exactly 12 h (`hasSessionEnded` `>=`→`>`, `isWithinSession` `<`→`<=`) | #260, run 43053526838 | **RED**, stage 6: 4 failed / 3,009 passed. `auth-session.test.ts` "one at 12 hours is refused" and "a token 12 hours old or more has ended"; `auth-small-modules.test.ts` "refuses one at 12 hours" and "exactly 12 h is over" |
| **QLT plant P2**: `session.ts` builds claims without `signedAt`, defaulting it to now | #261, run 43053548830 | **GREEN, survived.** Every stage: unit, build, integration, full Vitest, changed-code coverage, E2E shards 1 to 3 → QLT-02 |
| **QLT plant P3**: SCR-26 "Sign in again" uses the raw `x-return-path` | #262, run 43053567955 | **RED**, stage 6: 4 failed / 3,009 passed, `system-pages.test.ts` "a recorded address that is not a page of this portal is dropped" (`https://evil.example/x`, `//evil.example/x`, `/\evil.example`, `/api/v1/me`) |
| Secret scan before the push (DL-094) | `gitleaks dir` v8.30.1 (Docker) over the three planted files | No leaks |
| Merge drift | files changed `b3403e3..origin/master` vs files in the PR | 0 of 68 overlap. Master's client fetches all go through `sendJson`, `users-client` or `audit-client`, so the session-ended handling reaches them |
| Control branches | `git push origin --delete …` | **Refused by the permission system.** `control/AQP-89-qlt-p1-boundary`, `control/AQP-89-qlt-p2-no-signedat` and `control/AQP-89-qlt-p3-scr26-return` remain for the orchestrator to delete |

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 (FR-099) | `session-token.ts` (`SESSION_HOURS`, `hasSessionEnded`, `isWithinSession`); `resolve-session-user.ts` `resolveSession` | `auth-session.test.ts` (every-minute loop; 11:59:59, 12:00:00, 12:00:01); `auth-small-modules.test.ts`; `integration/auth/session-expiry.test.ts` (PostgreSQL, controlled clock, every minute, IST midnight, cookie rewritten hourly, spans a deployment) | **Met.** P1 red |
| AC-2 | `options.ts` `jwt.encode` with `sessionSecondsLeft`; token claims `sub`, `sv`, `signedAt` | `auth-options.test.ts` (12 h at sign-in, 6 h when rewritten 6 h in, 12 h for a token with no `signedAt`); integration (decode; exp − iat = 12 h; not renewed) | **Met, with a recorded deviation.** The one check is `resolveSession`, reached through `requireUser` / `requireUserOrRedirect`; the constant is `SESSION_HOURS` (#256). See QLT-05 |
| AC-3 | `session.ts` `requireUserOrRedirect` → `unauthorized()`; `app/unauthorized.tsx`; `system-page.tsx` `session-ended`; `sign-in-again-action.tsx` | `system-pages.test.ts`; `auth-session.test.ts`; E2E tests 1 and 3 (3 widths) | **Met; depends on QLT-01.** The wording matches the AC exactly. Without the extra cookie days, the browser drops the cookie at 12 h and SCR-26 almost never shows. P3 red |
| AC-4 (negative) | `requireUser` → `UnauthorizedError` code `SESSION_ENDED`; `problem.ts` `sessionEndedProblem`; `lib/auth/session-ended.ts`; `api-client.ts`, `users-client.ts`, `audit-client.ts`; sign-in page state | `http-problem.test.ts`, `http-with-route.test.ts` (401, no-store, no data), `auth-proxy.test.ts`, `session-ended-clients.test.ts`, `sign-in-page.test.ts`; E2E test 2 renders the SCR-01 state only | **Met in code; only partly verified** (QLT-03) |
| AC-5 (negative) | `resolveSession` → `refused` (deactivated, version mismatch, user gone, future sign-in time) | `auth-session.test.ts`; integration (role change re-scopes, deactivation and version mismatch refuse at 1 h and 6 h) | **Met.** 01.01 behaviour is not weakened |
| AC-6 | `role="alert"` on SCR-26 words and the SCR-01 notice; `FocusMainHeading` | E2E `session-ended.spec.ts` at 360×800, 768×1024, 1366×768: no sideways scroll, 44 px, axe 0, alert, focus, keyboard only | **Met.** QLT-09: QA confirms with a real screen reader |

## Brief items checked

| Item | Finding |
|------|---------|
| Boundary at exactly 12 h | `>=` 12 h is ended; the test pins exactly 12:00:00 (P1 red). `signedAt` is floored, so the session lasts at most 1 s less than 12 h. Token `exp` = `signedAt + 43200` exactly |
| Clock source, time zone, skew | All epoch seconds. `resolveSession` uses `systemClock`, `options.ts` the injected clock, jose `Date.now()`: one host, one clock. A future `signedAt` is refused with zero tolerance (QLT-06, latent only if the app is scaled out) |
| Concurrent sessions, multiple tabs | Each browser's token ages independently. Parallel 401s in one tab each call `location.assign` with the same address, which is harmless. Signing in again in one tab heals the others at their next request |
| Sign-out elsewhere, Admin reset, deactivation, `session_version` bump | `refused`, so a plain redirect within 12 h, as in 01.01 (AC-5). The "second wording" (ADR-009 amendment 1) is absent from the UX spec, and none was invented (QLT-07, #256). No self-service password change exists yet, so the only writer of `signedAt` is the sign-in `jwt` callback |
| Cookie-lifetime decision: replay | Not possible. Three independent refusals: jose `exp` (15 s tolerance), `resolveSession`'s `signedAt` check, and `session_version` after a sign-out. `signedAt` cannot be changed by a client (`trigger: "update"` ignored) or re-minted without `AUTH_SECRET` |
| Cookie-lifetime decision: disclosure | Nothing readable: a JWE (dir + A256GCM), HttpOnly, Secure, SameSite=Lax. Its presence tells a later user of the same browser profile that someone used the portal within 7.5 days, which is low. Side effects: the *cookie's* expiry is renewed when `/api/auth/session` is called within 12 h (the token's is not); `JWT_SESSION_ERROR` log noise (QLT-08, #255); misleading wording after an `AUTH_SECRET` rotation (QLT-04) |
| Open redirect | Every return path goes through `safeReturnPath`: the proxy's `x-return-path` (SCR-26 link, P3 red), `signInPathAfterSessionEnded` (client) and the sign-in page again. `x-session-cookie` cannot be spoofed on proxied paths. On `/sign-in` (outside the matcher) a spoofed header changes nothing |
| Plants | P1 and P3 each catch their fault. P2 survives (QLT-02). The developer's plants (#254) are accepted |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `src/server/auth/session-token.ts:26`, `src/server/auth/options.ts:90` | ADR-009 Decision; architecture §8; AC-3 | The cookie lives 12 h + 7 days (`SESSION_ENDED_NOTICE_DAYS`), against the ADR's "cookie that lasts 12 hours from sign-in". No recorded decision | A security-relevant parameter changes outside the architecture record, and AC-3's realistic case depends on it. No replay or disclosure risk found (analysis above) | Before merge, a delivery-lead / solution-architect ruling (DL entry + ADR-009 amendment 2, via #256). Accepted: no code change. Rejected: set it to 0 and re-scope AC-3 |
| QLT-02 | Minor | `src/server/auth/session.ts:54` | Test adequacy; AC-1, AC-2 | No test gives `session.ts` a session with `userId` and `sessionVersion` but no `signedAt`. Plant P2 (`signedAt ?? now`) is green everywhere | The fail-closed property rests on an untested coupling to the `session` callback in `options.ts` | Add the `it` case below to `auth-session.test.ts`; optionally a `session`-callback case in `auth-options.test.ts` |
| QLT-03 | Minor | `tests/e2e/session-ended.spec.ts:51` | AC-4; test adequacy | No test runs the AC-4 chain against the real server: proxy header → `readSessionState` → `requireUser` → `withRoute` → 401 → client navigation. E2E test 2 opens `/sign-in?reason=session-ended` directly | A break between links (matcher, header name, mocks hiding real `next/headers`) would go unseen. A person would then get a generic failure instead of SCR-01 | Add an API-level E2E with `addEndedSession(context, 'expired-token')` (snippet below); optionally one browser case. Or QA verifies at G7 |
| QLT-04 | Info | `src/server/auth/session.ts:60` | SCR-26 wording | "Unreadable cookie" counts as ended. After an `AUTH_SECRET` rotation every signed-in person reads "Sessions last 12 hours … so you were signed out" | Untrue wording in a rare ops event; the behaviour is right | Note it in the secret-rotation runbook; ux-expert to consider in #256 |
| QLT-05 | Info | `src/server/auth/resolve-session-user.ts:51-53` | Maintainability; AC-2 "one check" | Two complementary predicates, with a load-bearing order | A future caller could combine them wrongly. P1 shows the tests pin the boundary today | Optional single classifier `'future' \| 'within' \| 'ended'` |
| QLT-06 | Info | `src/server/auth/session-token.ts:45` | Clock skew | A future `signedAt` is refused with zero tolerance | None with one container. If scaled out, a freshly signed-in person could bounce to SCR-01 | Small skew allowance if the app is ever run on more than one host |
| QLT-07 | Info | `src/server/auth/resolve-session-user.ts:55` | ADR-009 amendment 1 | No "second wording" for a sign-out elsewhere or a reset; past 12 h, "ended" is reported before a deactivation | Expected: an upstream gap, correctly not invented | ux-expert / architect via #256 |
| QLT-08 | Info | `src/server/auth/options.ts:90` | Operability (cross-ref performance) | `JWT_SESSION_ERROR` is logged at error level per request from a stale browser for up to 7.5 days | Log noise can mask real errors | Fix #255 before production if QLT-01 is accepted |
| QLT-09 | Info | `src/components/features/system-pages/system-page.tsx:106` | AC-6, NFR-018 | `role="alert"` on content present at first render is not reliably announced by every screen reader | "Announced" rests on the heading focus | QA checks with a real screen reader at G7; if silent, render the alert text after mount |
| QLT-10 | Info (praise) | `src/server/auth/options.ts:96` | AC-2 | The `jwt.encode` override closes next-auth's renewal path (the session route re-encodes with `session.maxAge`). `SessionResolution` makes the states explicit. An ended token makes no DB read. `x-session-cookie` is always the proxy's word | n/a | n/a |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01

next-auth 4.24.15, `core/routes/session.js`: l.60 `newExpires = fromDate(sessionMaxAge)` (the cookie expiry, moved out on every call), l.73–77 `jwt.encode({ …, maxAge: options.session.maxAge })`, and l.88 `logger.error("JWT_SESSION_ERROR", error)` plus `sessionStore.clean()` when decode fails. `getServerSession` in RSC mode uses a no-op `res`, so page and route requests never rewrite or clear the cookie. Only a direct call to `/api/auth/session` does.

An alternative, for the decision only: a separate, content-free "had a session" cookie would keep the session cookie at 12 h. But it would have to be cleared at sign-out, which next-auth's `signOut` event cannot do. Without that, a person who signed out deliberately would be told "Your session ended". So the PR's design is the simpler one if the ruling accepts the extra days.

### QLT-02

**Suggested** (`tests/unit/auth-session.test.ts`):
```ts
it('a session with the user and the version but no sign-in time is nobody, and with the cookie it has ended', async () => {
  const { users, id } = await repositoryWithOneUser();
  mocks.users.current = users;
  mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0 });
  expect(await getCurrentUser()).toBeNull();
  mocks.sessionCookie.current = SESSION_COOKIE_PRESENT;
  await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_UNAUTHORIZED');
});
```

### QLT-03

**Suggested** (`tests/e2e/session-ended.spec.ts`):
```ts
test('AC-4: an API call with an ended session gets 401 SESSION_ENDED, no data, no-store', async ({ context }) => {
  await addEndedSession(context, 'expired-token');
  const response = await context.request.get('/api/v1/users');
  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/problem+json');
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ code: 'SESSION_ENDED' });
});
```
A browser case: sign in, open a client screen, swap the cookie with `addEndedSession(context, 'expired-token')`, trigger the screen's fetch, and expect `/sign-in?reason=session-ended&callbackUrl=…`. Mind the RISK-023 instance budget (DL-151).

</details>

## Issues for other roles

- **delivery lead / solution-architect:** rule on QLT-01. Record it as a DL entry and an ADR-009 amendment, and update architecture §8 (#256).
- **ux-expert:** the second wording (QLT-07), and whether it covers an unreadable cookie (QLT-04). Also "Sign in again" vs the spec's "Sign in", and `role="alert"` vs the mock-up's status (#256).
- **qa-engineer (G7):** a real screen reader on SCR-26 and the SCR-01 state (QLT-09). If no test is added, an end-to-end AC-4 check (QLT-03).
- **orchestrator:** delete the remote branches `control/AQP-89-qlt-p1-boundary`, `control/AQP-89-qlt-p2-no-signedat` and `control/AQP-89-qlt-p3-scr26-return` (my delete was refused). Also note: my first label update on #253 replaced the label set and removed `review:standards-changes-requested` and `review:performance-approved` for about a minute. Both were restored at once, and the PR now carries all three review labels.
