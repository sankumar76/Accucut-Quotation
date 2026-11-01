# ADR-009: Authentication and sessions

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-001 to 006, 080; NFR-003, 004; SPEC §2, §12; ADR-010 |

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
We will use **next-auth 4.24.15** with the credentials provider, narrowly, behind `src/server/auth/session.ts`. The session is an encrypted JWT in a `__Secure-` HttpOnly, Secure, SameSite=Lax cookie with a 12-hour lifetime (Proposed), holding only the user ID and `session_version`. `requireUser()` reads `users` on each request. Role and active flag always come from the database, and a mismatch in `session_version` ends the session. This gives server-side revocation without a sessions table, at the cost of one indexed read per request.

Passwords use argon2id through `@node-rs/argon2`. Sign-in goes through `login_throttles`: 5 consecutive failures block the key for 15 minutes (NFR-003, Proposed). An unknown e-mail takes the same path with a dummy hash, so responses do not reveal which part was wrong.

Step-up (FR-080) is a password field in the same request as the protected action, verified in the service before the write and throttled. There is no separate token to store or expire.

`package.json` carries `"overrides": { "next-auth": { "nodemailer": "$nodemailer" } }`, verified to resolve to Nodemailer 10.3.1 with 0 high advisories. The e-mail provider is never loaded, so next-auth never calls it. `--legacy-peer-deps` is not used.

## Consequences
- Positive: stable security library, immediate revocation, one code path.
- Negative / trade-offs accepted: the override must be reviewed on each next-auth update. A known e-mail can be locked out for 15 minutes by a third party, which is accepted, logged, and mitigated by a per-IP limit and an Admin reset. v4 may eventually lose support (TD-02).
- Follow-up actions (with owners): architect reviews v5 status at each release; moving is contained in `src/server/auth`.

## Verification
Tests: deactivated user refused at the next request; old password refused after change; cookie flags; 6th attempt blocked; step-up on all three actions.
