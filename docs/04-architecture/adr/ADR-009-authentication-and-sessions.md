# ADR-009: Authentication and sessions

| Field | Value |
|-------|-------|
| Status | Accepted (G3 CONDITIONAL GO, condition 14, 2026-11-01). Revised for v0.3 (D-19) and v0.4 (PRD v0.7 FR-004, FR-006). **Amended 2026-11-04: sign-out (amendment 1, at the end; AQP-38).** The session measured from sign-in and the meaning of "symbol" **rest on ASSUMPTION-56** |
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
We will use **next-auth 4.24.15** with the credentials provider, narrowly, behind `src/server/auth/session.ts`. The session is an encrypted JWT in a `__Secure-` HttpOnly, Secure, SameSite=Lax cookie that lasts 12 hours from sign-in (D-19, ASSUMPTION-56), holding only the user ID, `session_version` and the sign-in time. `requireUser()` refuses it past 12 hours, so activity does not extend it. Version 0.2 had a rolling 12 hours of inactivity, which an open tab could extend for days. `requireUser()` reads `users` on each request. Role and active flag always come from the database, and a mismatch in `session_version` ends the session. This gives server-side revocation without a sessions table, at the cost of one indexed read per request.

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
