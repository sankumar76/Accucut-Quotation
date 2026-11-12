# ADR-009: Authentication and sessions

| Field | Value |
|-------|-------|
| Status | Accepted (G3 CONDITIONAL GO, condition 14, 2026-11-01). Revised for v0.3 (D-19) and v0.4 (PRD v0.7 FR-004, FR-006). **Amended 2026-11-04: sign-out (amendment 1, at the end; AQP-38). Amended 2026-11-11: the cookie outlives the token by 7 days so an ended session can be named (amendment 2, at the end; AQP-89, delivery-lead ruling KEEP). Amended 2026-11-12: after a person's own password change, the change route issues the fresh cookie, and `signedAt` is the time of the last proof of the password (amendment 3, at the end; AQP-81, DL-191 (6)).** The session measured from sign-in and the meaning of "symbol" **rest on ASSUMPTION-56** |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-001 to 006, 080, 098, 099; NFR-003, 004; SPEC §2, §12, §18 D-19; BR-049, BR-050; ASSUMPTION-56; ADR-010 |

## Context
SPEC §2 and `CLAUDE.md` name Auth.js with a credentials provider, email and password, session-based. Three facts checked on 2026-11-01 shape the choice.

- `next-auth` `latest` on npm is **4.24.15**. Auth.js v5 is still **5.0.0-beta.32**, with no stable release and no published timeline (npm dist-tags; GitHub discussion #13382).
- v4 declares a peer range that includes Next.js 16.
- Both lines declare an optional peer on old `nodemailer` ranges (`^7`; `^7 || ^8` for v5). Nodemailer 7.0.13 has high-severity advisories, and the listed ones are all fixed by 10.1.4 (`npm audit`). npm refuses to mix them without an explicit override (verified ERESOLVE).

Whether Auth.js supports database sessions with the credentials provider could not be confirmed in its documentation. Third-party guides use JWT with it.

## Decision Drivers
- NFR-003: hashed passwords, secure cookies, CSRF protection, rate limiting
- FR-004: a deactivated user must lose access at once
- A proven, stable release over a pre-release in a security component
- Small surface, because only credentials sign-in is needed

## Considered Options
### Option A — next-auth 4.24 with JWT session, role and status read from the database on every request
- Pros: stable, tagged `latest`, peers allow Next.js 16; revocation through `session_version`
- Cons: older API (`getServerSession`); may need migration later
- Cost / effort: low

### Option B — Auth.js v5 beta, pinned
- Pros: newer API, `auth()` helper
- Cons: a pre-release at the security boundary; the same nodemailer conflict; the Next.js 16 `proxy` rename is newer than its documented pattern
- Cost / effort: low now, uncertain later

### Option C — Hand-written sessions
- Pros: real server sessions, no dependency
- Cons: leaves the stated stack; writing session handling ourselves is what the library exists to avoid
- Cost / effort: medium

## Decision
We will use **next-auth 4.24.15** with the credentials provider, narrowly, behind `src/server/auth/session.ts`. The session is an encrypted JWT in a `__Secure-` HttpOnly, Secure, SameSite=Lax cookie. The token lasts 12 hours from sign-in (D-19, ASSUMPTION-56) and holds only the user ID, `session_version` and the sign-in time. *(Amendment 2: the cookie that carries it stays 7 days longer, and adds no access.)* The server refuses the token at 12 hours, so activity does not extend it. *(As built in STORY-01.01 and STORY-01.06: the one check is `resolveSession` in `src/server/auth/resolve-session-user.ts`, over `SESSION_HOURS` in `session-token.ts`; `requireUser()` and `requireUserOrRedirect()` in `session.ts` reach it.)* Version 0.2 had a rolling 12 hours of inactivity, which an open tab could extend for days. Each request reads `users`. Role and active flag always come from the database, and a mismatch in `session_version` ends the session. This gives server-side revocation without a sessions table, at the cost of one indexed read per request.

Passwords use argon2id through `@node-rs/argon2`. Sign-in goes through `login_throttles`: 5 consecutive failures block the key for 15 minutes (NFR-003, Proposed). An unknown e-mail takes the same path with a dummy hash, so responses do not reveal which part was wrong.

Step-up (FR-080) is a password field in the same request as the protected action, verified in the service before the write and throttled. There is no separate token to store or expire.

**Added at UX reconciliation.**
- A wrong step-up password returns 422 with `STEP_UP_FAILED`, not 401, so the client shows SCR-18's message rather than treating it as a lost session. Step-up has its own throttle key, so a slip in a dialog cannot lock an Admin out of signing in.
- Sign-in returns a separate `locked` code for SCR-01's message, and an Admin password reset clears the block, as that message promises.
- The return address after sign-in is accepted only as a same-origin relative path.
- Admin hand-over takes the step-up too (PRD v0.7 FR-006, NFR-004, a product-manager decision closing OQ-ARCH-08 and OQ-UX-17). Earlier versions of this ADR left it out.
- A password the Admin sets or resets is temporary (PRD v0.7 FR-004, closing OQ-UX-15). It sets `must_change_password`, as `bootstrap:admin` does, so that user reaches only SCR-23 until they choose their own.
- The password rule is decided (D-19, BR-049): 10 to 128 characters, at least one number and one symbol, not the user's e-mail, not a common password. Any non-alphanumeric character counts as a symbol (ASSUMPTION-56). It is one zod schema, `src/lib/auth/password-rule.ts`, applied wherever a password is set, including `bootstrap:admin`, and never at sign-in. Because a composition rule produces `Password1!`, the common-password check also runs on the password with digits and symbols stripped from both ends.
- The Admin cannot change their own role or deactivate themselves; the server refuses both.

`package.json` carries `"overrides": { "next-auth": { "nodemailer": "$nodemailer" } }`, verified to resolve to Nodemailer 10.3.1 with 0 high advisories. The e-mail provider is never loaded, so next-auth never calls it. `--legacy-peer-deps` is not used.

## Consequences
- Positive: stable security library, immediate revocation, one code path.
- Negative / trade-offs accepted: the override must be reviewed on each next-auth update. A known e-mail can be locked out for 15 minutes by a third party, which is accepted, logged, and mitigated by a per-IP limit and an Admin reset. v4 may eventually lose support (TD-02).
- Follow-up actions (with owners): architect reviews v5 status at each release; moving is contained in `src/server/auth`.

## Verification
Tests: deactivated user refused at the next request; old password refused after change; cookie flags; 6th attempt blocked; step-up on all four actions (three until FR-006 is built); every part of the password rule at each entry point; an Admin-set password leads to SCR-23 and no other page; a session used constantly still ends 12 hours after sign-in.


## Amendment 1 — Sign-out ends every session of the person (2026-11-04)

| Field | Value |
|-------|-------|
| Status | Accepted by the solution-architect for G6 of AQP-38. It answers G4 condition 6 (sign-out and `session_version`); `master` records whether the condition is met |
| Trigger | PR #58 (AQP-38, STORY-01.01), head `4d9b2e2`, Dev Record decision 1. The developer found no design for sign-out, and none existed: this ADR said how a session is revoked, not what sign-out does |
| Related | FR-001, FR-002, FR-004, FR-006, FR-099; NFR-003; BR-050; architecture section 8 and A-37; UX spec section 2 (Engineer row), SCR-26 |

### Context
A JWT session is held by nobody at the server. Clearing the cookie removes it from one browser only, and any copy of the token stays valid until 12 hours after sign-in (FR-099).

What the requirements say:
- FR-001: "sign-out ends the session".
- FR-099 and BR-050: a session lasts 12 hours, counted from sign-in.
- NFR-003: secure HttpOnly cookies.
- No business rule covers sign-out. BR-049 and BR-050 are the password rule and the session length.

Where people sign in: an Engineer works at a desktop workstation and also on a phone or tablet on the shop floor (UX spec section 2). Shared office PCs are not stated in the SPEC, PRD or UX spec (A-37).

### Options
**A. Sign-out raises `session_version` (as built in PR #58).**
- Pros: the token is dead at the server, which is what OWASP ASVS 4.0 V3.3.1 asks of a logout. A copied cookie stops working. Signing out on a phone ends a session left open on a shared PC, the only way to do that short of changing the password. No new table: it is the mechanism FR-002, FR-004 and FR-006 already use.
- Cons: signing out on one device sends that person's other devices to the sign-in page at their next request.

**B. Clear the cookie only.**
- Pros: the narrowest reading of FR-001; other devices carry on.
- Cons: a copied token works for up to 12 hours after sign-out. A forgotten session on a shared PC can be ended only by a password change, which nobody will think of. It does not meet ASVS V3.3.1.

**C. Revoke one session (a `revoked_sessions` table keyed by a token ID, rows kept 12 hours).**
- Pros: precise.
- Cons: a new table, a second lookup on every request and a clean-up job, about 2 to 3 h (estimate). Not justified for a portal of a few tens of users.

### Decision
**Option A.** Sign-out clears the cookie and raises `session_version`, so it ends every session of that person. Two rules go with it:

1. **Raise only a current version (compare and increment).** The raise applies only when the version in the token equals the stored one: `UPDATE users SET session_version = session_version + 1 WHERE id = $1 AND session_version = $2`, which is a Prisma `updateMany` with both values in `where`. A token that has already ended, through an earlier sign-out, a password change or an Admin reset, then changes nothing. Without this rule, anyone holding an old copied token could sign the person out on every device, again and again, for up to 12 hours. next-auth's sign-out checks the token's signature and expiry, not its version. **Required in PR #58 before G6 closes, with one test.**
2. **A failed raise still signs this browser out.** The cookie is cleared, and the failure is logged without detail (as built; review finding STD-07). While the database is down no session works anyway, because every request reads `users`.

The other events that end every session are unchanged: password change (FR-002), Admin reset and deactivation (FR-004), and the hand-over (FR-006).

### Consequences
- Positive: a signed-out token is dead everywhere, and a forgotten session can be ended from another device.
- Negative, accepted: signing out on one device ends the person's other sessions. Autosave keeps saved work. A sign-in at the same moment as a sign-out elsewhere can be ended at once, and the person signs in again.
- **For the ux-expert (SCR-26, AQP-89):** SCR-26 says "Sessions last 12 hours from the time you sign in, so you were signed out". That is wrong for a session ended by a sign-out elsewhere or by a password change. The server can tell the two apart: the sign-in time is within 12 hours and the version no longer matches. A second wording is needed before AQP-89 reaches G5. A hint under "Sign out" in the account menu ("Signs you out on all your devices") is the ux-expert's choice.
- If the delivery lead finds sign-out on every device disruptive, the fallback is option C, not B.

### Verification
- Sign-out raises the version by one, and a copied cookie is refused afterwards (in PR #58).
- A sign-out request with a bad CSRF token changes nothing (in PR #58).
- **New:** a sign-out with a token whose version is out of date leaves the stored version unchanged, and the person's current session still works.


## Amendment 2 — The cookie outlives the token by 7 days, so an ended session can be named (2026-11-11)

| Field | Value |
|-------|-------|
| Status | Accepted. The delivery lead ruled **KEEP** on 2026-11-11 (in chat, recorded on Jira AQP-89; `master` records it in the decision log, DL-157 expected). It closes G6 findings STD-01 and QLT-01 of AQP-89 by documentation, with no code change |
| Trigger | PR #253 (AQP-89, STORY-01.06), head `c4055f7`. `SESSION_ENDED_NOTICE_DAYS = 7` in `src/server/auth/session-token.ts:26`, used as the cookie's `maxAge` in `src/server/auth/options.ts:90`. The Decision above said the cookie "lasts 12 hours from sign-in", and nothing recorded the change |
| Related | FR-099, BR-050, NFR-003; STORY-01.06 AC-2, AC-3, AC-4; SCR-26, SCR-01; architecture section 8 and A-23; review findings STD-01, STD-05, STD-08, STD-10, QLT-01, QLT-04, QLT-06, QLT-07, QLT-08, PRF-02; GitHub #255, #256 |

### Context
STORY-01.06 AC-3 asks that a person whose session ended sees SCR-26 "Session ended", not a plain sign-in page. A browser deletes a cookie when its `maxAge` runs out. A request with no cookie looks exactly like a visit from someone who never signed in. With a cookie of 12 hours, SCR-26 could appear only in the last moment of a session. The realistic case, an open tab used again the next morning or after a weekend, would never see it.

As built on `c4055f7`, three lifetimes are set apart:

| What | Where | Lifetime |
|------|-------|----------|
| The token's `exp` claim | `jwt.maxAge` and the custom `jwt.encode` in `options.ts`, through `sessionSecondsLeft` | Sign-in time plus `SESSION_HOURS` (12). A rewrite later in the session keeps the same end (AC-2) |
| The server's own check | `resolveSession` in `resolve-session-user.ts`, through `hasSessionEnded` and `isWithinSession` in `session-token.ts` | Sign-in time plus 12 hours, from the `signedAt` claim, whatever the cookie or `exp` says |
| The cookie | `session.maxAge` = `SESSION_COOKIE_MAX_AGE_SECONDS` | 12 hours plus `SESSION_ENDED_NOTICE_DAYS` (7 days) from when it was written |

A request whose cookie is present but whose token cannot be read counts as "ended". `proxy.ts` sets the `x-session-cookie` header on every request it handles, and `session.ts` uses that header to tell this case apart from "signed out". A page then calls `unauthorized()` and shows SCR-26, and an API route answers 401 `SESSION_ENDED`.

### Options
**A. Keep the cookie 7 days longer than the token (as built).**
- Pros: SCR-26 shows for the case it exists for. It is one constant, and setting it to 0 reverses it. Cookie flags and token contents do not change.
- Cons: next-auth logs a dead token at error level on each request for up to about 7.5 days (see Consequences). The cookie's presence is visible to a later user of the same browser profile.

**B. A 12-hour cookie (the constant set to 0).**
- Pros: matches this ADR's original text. No extra log lines.
- Cons: SCR-26 almost never shows, so AC-3 would have to be re-scoped by the product owner.

**C. A separate, content-free "had a session" cookie next to a 12-hour session cookie.**
- Pros: the session cookie stays at 12 hours.
- Cons: another cookie to set, clear and test. next-auth's `signOut` event cannot clear a second cookie. Without that, a person who signed out on purpose would later read "Your session ended", which is untrue.

### Decision
**Option A, as built: `SESSION_ENDED_NOTICE_DAYS = 7`.** The token and the server check stay at 12 hours from sign-in. Only the cookie lives longer, so the portal can say the session ended.

**Why this has no replay or disclosure risk**
- **No added access.** The cookie carries the token, and the token is dead. `resolveSession` refuses any `signedAt` 12 hours old or more, exactly and without reading the database. The token's own `exp` is set to the same instant, and next-auth stops decoding it 15 seconds later (its `jose` clock tolerance), so two independent checks agree. Keeping, copying or replaying the cookie gives nothing that the token did not already lose at 12 hours. Signing in again writes a new cookie in its place.
- **No added disclosure.** The value is still a JWE (`dir` with A256GCM, keyed from `AUTH_SECRET`), so nobody without the secret can read it. The flags are unchanged: `__Secure-` prefix, HttpOnly, Secure, SameSite=Lax. What the cookie still holds is the user ID, `session_version` and the sign-in time, nothing more. The one new fact is that the cookie exists: a later user of the same browser profile can learn that someone used the portal in the last 7.5 days or so. That is low, and an OS account per person removes it.
- **Sign-out is unchanged.** It still clears the cookie (`maxAge` 0, tested) and raises `session_version` (amendment 1), so a person who signs out on purpose never sees SCR-26.
- **The limit of the extension.** next-auth moves the *cookie's* expiry to "now plus `session.maxAge`" whenever `/api/auth/session` is called directly. The *token's* expiry does not move. The app does not load `next-auth/react` (`src/lib/auth/auth-client.ts` stands in for it), so only a script can make that call. Once the token is dead, the same route fails to decode it and clears the cookie. So the cookie lasts at most about 12 hours plus 7 days after the last such call inside the 12 hours, which is about 7.5 days after sign-in.

### Consequences
- **Log noise (QLT-08, PRF-02, STD-05): GitHub #255.** For each request that carries a dead cookie, next-auth decrypts the token, finds `exp` passed and writes `[next-auth][error][JWT_SESSION_ERROR]` with a stack. This can go on for up to about 7.5 days per browser. The cost is about 0.2 to 0.5 ms of CPU and 1 to 2 KB of log per request (PRF-02, an estimate). It stops quickly in practice: the first 401 or SCR-26 sends the person to sign in, and signing in replaces the cookie. The cost is not CPU. It is an `error` line for a routine event, which can hide real errors and would page anyone who alerts on `error`. **#255 must be fixed before production:** a next-auth `logger` in `buildAuthOptions` sends `JWT_SESSION_ERROR` to pino at `debug`, with name and code only, and leaves other codes at their level. `master` assigns its owner and due point (consolidated review, STD-05).
- **After an `AUTH_SECRET` rotation (QLT-04).** Every cookie in every browser becomes unreadable. Because the cookie is present, each person is told their session *ended*, with SCR-26's words "Sessions last 12 hours from the time you sign in". That reason is untrue in this case. Signing everyone out is the right behaviour; only the reason given is wrong. Accepted: rotation is a rare, planned operation. The secret-rotation runbook says that everyone will see "Session ended" and must sign in again (architecture section 8). Whether SCR-26 needs neutral words for this case is the ux-expert's call in #256.
- **No clock-skew tolerance (QLT-06).** A `signedAt` in the future is refused (`refused`, sent to sign in), with no allowance. On one `app` container there is one clock, so this cannot happen. If the app is ever run on more than one host, a person who has just signed in could be bounced to SCR-01 by a host whose clock is behind. Before any scale-out, add a small allowance to `isWithinSession` (for example 60 seconds, with NTP on every host), recorded as a further amendment. Not built now.
- **Order of states past 12 hours (QLT-07).** "Ended" is decided before the database read. A deactivated person whose token is 12 hours old or more therefore sees SCR-26, then the usual single sign-in error. This reveals nothing about the account.
- **Amendment 1's "second wording" is still owed (STD-08, QLT-07).** Amendment 1 asked the ux-expert for SCR-26 words for a session ended inside its 12 hours, by a sign-out elsewhere or a password change, "before AQP-89 reaches G5". It does not exist in ux-spec v0.22. The build correctly did not invent it: such a token is `refused`, and the person goes to the sign-in page with no explanation, as before AQP-89. **This amendment does not supply the wording.** It remains owed by the **ux-expert through GitHub #256**. `master` records a waiver or a needed-by date. When the wording exists, the server already tells the case apart: the token is within 12 hours and its version does not match.
- **Reversal is one line.** Setting `SESSION_ENDED_NOTICE_DAYS` to 0 returns to option B. AC-3 would then be re-scoped.

### Verification (tests on `c4055f7`)
- The constant is 7, and the cookie lifetime is the token's 12 hours plus 7 days: `tests/unit/auth-small-modules.test.ts`.
- `session.maxAge` is the cookie lifetime and `jwt.maxAge` is 12 hours. A token written later in the session keeps its 12-hour end: `tests/unit/auth-options.test.ts`.
- The cookie written at sign-in expires 12 hours plus 7 days later, a token rewritten 6 hours in keeps only the 6 hours left, and the session is refused at 12 hours: `tests/integration/auth/session-expiry.test.ts`.
- A browser with an expired token, and one with a sign-in 12 hours old or more, sees SCR-26 at three widths: `tests/e2e/session-ended.spec.ts`.
- Sign-out still clears the cookie: `tests/integration/auth/sign-in-handler.test.ts`, `tests/acceptance/aqp-38-sign-in.test.ts`.
- Owed by #255: a unit test that `JWT_SESSION_ERROR` is logged at `debug`, not `error`.

## Amendment 3 — After an own password change, the route issues the fresh cookie (2026-11-12)

| Field | Value |
|-------|-------|
| Status | Accepted. Recorded by the solution-architect on master's routing (DL-191 (6), open question 4). reviewer-quality accepted the design at G6 attempt 1 (QLT-07, Info). Documentation only, with no code change |
| Trigger | PR #341 (AQP-81, STORY-01.05), read at `c4517e6`: `src/server/auth/session-cookie.ts` and `src/app/api/v1/account/password/route.ts:21-24`. Story assumption A-3 said the browser that made the change keeps its session through next-auth's `update`. The build does not use `update` |
| Related | FR-002, FR-099, NFR-003; STORY-01.05 AC-3, AC-6; architecture section 8 (v0.42); amendment 1 (the raise of `session_version`); amendment 2 (the three lifetimes) |

### Context
A password change raises `session_version` (amendment 1), which refuses every token issued before it, including the one in the browser that made the change. That browser needs a new token at the new version. Assumption A-3 expected next-auth's `update`. `update` is a client call that makes the server rewrite the token from what the client sends. This app's `jwt` callback builds a token only at sign-in, from three server-held values.

### Options
- **A: next-auth `update`.** Pros: the library's own path. Cons: the `jwt` callback must then accept a rewrite requested by a client. That adds a second way to set the token's claims and widens what a cookie can be made to say.
- **B: the change route issues the cookie (chosen).** Pros: the same three claims (`sub`, `sv`, `signedAt`), the same `encode` and `AUTH_SECRET`, and the same name and attributes (`sessionCookieName`). The cookie is set only on a 204, so a refusal sets none. Nothing the client sends reaches the token. Cons: the module repeats next-auth's cookie name, which a library change could break. The E2E change test catches that, because the browser stays signed in only if `getServerSession` reads the cookie.

### Decision
**B.** **`signedAt` is the time of the last proof of the password: a sign-in, or the person's own change.** After a change it is the time of the change, so the 12 hours of amendment 2 restart there. The token's `exp` is set to the same instant (`SESSION_MAX_AGE_SECONDS`), and the cookie's lifetime is the token's 12 hours plus 7 days, as at sign-in. A-3 is replaced.

### Consequences
- **The restart adds no access an attacker lacks.** The change needs the current password, and it is throttled on its own key (5 wrong, 15 minutes; AC-6). It is the same proof as a sign-in. Someone who holds a stolen cookie but not the password cannot extend the session.
- **"12 hours from sign-in"** in the Decision, in amendment 2 and in architecture A-23 means 12 hours from `signedAt`. SCR-26's words stay true, because a change counts as signing in again.
- **The Admin's reset is unchanged.** It raises `session_version` and issues no cookie, so the person signs in again with the temporary password (FR-004).
- **The cookie name has one more reader.** If next-auth's cookie naming changes, `session-cookie.ts` must change with it. Check this at any upgrade or change of the auth library.

### Verification (tests on `c4517e6`)
- The cookie decodes with the right secret to exactly `sub`, `sv` at the new version, and `signedAt`. Another secret cannot read it. A refusal sets no cookie: `tests/unit/auth-session-cookie.test.ts` and `tests/unit/account-route.test.ts`.
- The browser that made the change stays signed in (`/api/v1/me` 200 after a reload), and another device gets 401: `tests/e2e/account.spec.ts` (the change test) and `tests/integration/auth/account-password.test.ts`.
