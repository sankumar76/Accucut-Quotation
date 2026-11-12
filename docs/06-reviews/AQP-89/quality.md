# Review Report — AQP-89 (STORY-01.06 12-hour session) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253; PR base `master` b3403e3) |
| Commit reviewed | c4055f7 |
| Date | 2026-11-11 |
| **Verdict** | **REQUEST CHANGES**: 1 Major (QLT-01, needs a recorded decision, not code), 2 Minor, 7 Info |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/253#pullrequestreview-5861690717 (COMMENT, single-token; label `review:quality-changes-requested`) |

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
