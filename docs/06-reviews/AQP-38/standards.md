# Review Report — AQP-38 (STORY-01.01 Sign in and sign out) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (security included) |
| Review round | 2 (re-review of the fix round `4d9b2e2..ea8dc6b`); round 1 kept below |
| Base…branch | `master...feat/AQP-38-sign-in-sign-out` (PR #58) |
| Commit reviewed | round 1: 4d9b2e2e0b3432976b790cda937f8608a15de957 · round 2: ea8dc6b97dc0bbd5b1ccc86f14a20a40828a156c |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS (round 2: all three Minors fixed; the new code has Info only) |

## Round 2 (fix round 4d9b2e2..ea8dc6b)

### Summary
STD-01, STD-02 and STD-03 are fixed. The atomic throttle reservation (QLT-32) is raw SQL written as Prisma tagged templates: every value is a bound, explicitly cast parameter, with no `$queryRawUnsafe`, no concatenation and no interpolated identifier. The new migration follows the conventions. Sign-out now uses compare-and-increment. The new code has four Info items and nothing at Minor or above.

| Severity (new code) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 4 |

### Checks run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Fix-round diff | `git fetch origin feat/AQP-38-sign-in-sign-out`, then `git diff 4d9b2e2 ea8dc6b` (no branch switched) | 20 files read; source and migration in full |
| CI | run 41845931376 | Green, stages 1 to 12 |
| Debug and secret scan | Reading the added lines | No `console.*`, TODO, `any`, `eslint-disable`, assertion or secret |
| Commit | `git log` | One Conventional Commit with `[AQP-38]` |

### Previous findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Minor | Fixed | Rejected dummy hash forgotten; test with a hasher that fails once. The lazy hash is accepted |
| STD-02 | Minor | Fixed | Migration `20261104120000_login_throttles_created_at`: header, additive, rollback note (`DROP COLUMN`), `timestamptz(6)` default; Prisma field mapped. Natural PK accepted (DL-072), cited in the migration and the schema |
| STD-03 | Minor | Fixed | `loadOriginEnv()` (validated by `isOrigin`); in production a missing or malformed value throws, with no Host fallback; development and tests fall back; tested with a hostile Host header |
| STD-04 | Info | Open | Moved to #59 |
| STD-05 | Info | Open | Moved to #59 |
| STD-06 | Info | Open | Information only |
| STD-07 | Info | Partly met | Compare-and-increment in place; the stable-code suggestion stands |
| STD-08 | Info | Open | Information only |
| STD-09 | Info | n/a | Good practice |

### New findings (round 2)
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-10 | Info | `src/server/repositories/throttle-repository.ts:57-79, 94` | §5 parameterised queries | Raw SQL review: no finding. Tagged templates, every value bound and cast, no unsafe API or concatenation; `keyHash` is a hex HMAC; repository layer only; `RETURNING` names its columns; `updated_at` set explicitly; atomicity proven on PostgreSQL | None | Add a comment saying why it is raw and that every value must stay a template parameter |
| STD-11 | Info | `src/server/repositories/throttle-repository.ts:87` | §10 typed errors | `throw new Error(...)` on an unreachable path | Log carries no stable code (safe: the client sees only `unavailable`) | Throw an `AppError` with a code |
| STD-12 | Info | `src/server/repositories/throttle-repository.ts:74-77` | Cross-reference to reviewer-quality | The address block set by attempt 30 stays when that attempt's password is correct (`releaseAttempt` lowers the count only) | Strict, not a weakness: an office could be blocked after a successful 30th attempt | Owner or reviewer-quality to decide; optionally clear a block set by the released reservation |
| STD-13 | Info | `src/server/repositories/user-repository.ts:105-111` | §5 | Sign-out compare-and-increment in one statement, expected version from the validated token | Conforms | None |

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-38/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #58 COMMENT re-review (4 inline comments); STD-01/02/03 threads replied to and resolved; label `review:standards-approved` kept (labels re-read; no write needed); hand-off comment on Jira AQP-38
- Open questions: none
- Risks raised: none new
- Recommended next agent: master, for the G6 decision; reviewer-quality to note STD-12

---

## Round 1 (4d9b2e2)

## Summary
The sign-in and sign-out implementation is carefully built and its security controls conform:
- Auth.js is used narrowly. Role and active flag are read from the database on every request, and `session_version` plus a 12-hour limit end sessions.
- Passwords are hashed with argon2id.
- Failed sign-ins are throttled with keyed hashes, and the CSRF token works with the fetch client.
- The cookie flags, the open-redirect guard and the logging (nothing secret) are tested.

There are three Minor findings. The most important is STD-01: a cached failed dummy hash would let unknown e-mails be told apart from known ones. The others are a table-convention gap in `login_throttles` and an unvalidated setting read in `src/proxy.ts`.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Full diff | GitHub `pull_request_read` (61 files, every patch read) | Read in full |
| Lint / type-check / build / tests / E2E | CI on 4d9b2e2 | Green on all stages (E2E against the production build and a real database) |
| Local lint / type-check | not run | The main folder holds another branch, so the review was done through GitHub only |
| Secret / debug scan | Reading the added lines | No secret (test and E2E passwords are invented; `.env.example` unchanged); no `console.*`, TODO, `any`, `eslint-disable` or assertion in `src/` |
| Dependencies | `package.json` / lockfile | Not in the diff; no dependency added |

## Security checklist
| Area | Result |
|------|--------|
| Auth.js setup | Credentials provider and JWT session behind `session.ts`. Role and active flag from the database per request; `session_version` and the 12 h limit in `resolveSessionUser`; a token dated in the future is refused |
| argon2id | 64 MiB / t=3 / p=1, PHC string; verify failure answers "no match"; algorithm by library default (STD-06); host tuning in #59 |
| Login throttling | 5 consecutive failures per account key, 30 per address in 15 minutes, 15-minute block. Atomic upsert, keyed hashes, unknown e-mails throttled too, blocked before the password check. Notes: STD-01, STD-04, STD-05 |
| Generic failure (AC-2) | One code, one hash check per attempt; the only gap is STD-01 |
| Cookies | `__Secure-`, HttpOnly, Secure, SameSite=Lax, 12 h; the token holds `sub`, `sv` and `signedAt` only |
| CSRF (fetch client) | next-auth double-submit token on sign-in and sign-out; the bad-CSRF test proves sign-out changes nothing without it |
| Input size caps | E-mail 320 and password 1,024 characters before argon2; the request body cap belongs in the reverse proxy (STD-05) |
| Open redirect | Input and resolved URL both checked (STD-09) |
| Logging | Error name and code only, fixed sentences, no secret, address, e-mail or hash |
| Database | No DELETE or TRUNCATE on `users` for the runtime role; lower-case CHECK; one active Admin; foreign key with no cascade |
| Follow-ups #59 / #60 | X-Forwarded-For trust, argon2 cost and clearing old rows are correctly deferred; STD-05 adds items for #59, STD-02 helps #60 |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/server/services/auth-service.ts:86-91` | §4, §5; AC-2 | `dummyHash ??= hasher.hash(...)` caches a rejected promise forever | After one failed dummy hash, unknown e-mails answer `unavailable` and known ones `invalid`: an enumeration oracle until restart | Reset `dummyHash` on rejection, or compute it once at start-up; add a test with a hasher whose first `hash` rejects |
| STD-02 | Minor | `prisma/migrations/20261104100000_users_and_login_throttles/migration.sql:30-38` | §10 SQL (PK `id` UUID; `created_at` and `updated_at`) | `login_throttles` has a text natural key and no `created_at`; the DL-052 exception covers immutable tables only | An unrecorded deviation; #60 clean-up will want a creation time | New migration adding `created_at`; either an `id` PK with `uq_login_throttles_key_hash`, or record the natural-key deviation |
| STD-03 | Minor | `src/proxy.ts:40` | §3, §5 | Reads `process.env.APP_ORIGIN` directly, with a fallback to `request.url` | A missing setting silently lets the Host header decide the redirect origin; a malformed one throws on every request | Validated accessor through `src/lib/env.ts`; any fallback only in development |
| STD-04 | Info | `src/server/services/auth-service.ts:66-69` | Crypto hygiene | `AUTH_SECRET` keys the throttle HMAC as well as the cookie encryption | One key, two purposes; rotating the secret resets the counters | HKDF purpose key (`accucut/login-throttle/v1`) or a separate secret |
| STD-05 | Info | `src/server/auth/client-address.ts:21-28` | §5 | Trusts the last X-Forwarded-For entry; missing header shares one `unknown` counter; no body cap | Limit can be bypassed if the app port is reachable; sign-in can be blocked for everyone if the header disappears | Publish only the proxy; check the header arrives; cap the body for `/api/auth/*` in the proxy (for #59) |
| STD-06 | Info | `src/server/auth/password-hasher.ts:15-36` | §5 explicitness | argon2id comes from the library default | Fragile if the library default changes (the test does pin it) | `algorithm: Algorithm.Argon2id`, or a comment naming the default and the pinning test |
| STD-07 | Info | `src/server/auth/options.ts:133-144` | §4 | If revocation fails at sign-out it is logged and the cookie is still cleared | A copied cookie stays valid up to 12 h | Give it a stable code for alerting; follow the architect's ruling (not blocked on it) |
| STD-08 | Info | `src/lib/auth/roles.ts:6` | §1 | `RoleName` and `UserRole` (plus the Prisma enum) are the same union, defined separately | Drift if a role is added in one place | One `USER_ROLES` constant in `lib`, imported by the repository; test against the enum |
| STD-09 | Info | `src/lib/auth/return-path.ts:39-54` | §5 | Good practice: open redirect, CSRF, cookie and proxy controls conform | — | Keep page- and route-level `requireUser` on every data-reading page or route (the layout is not a route-handler guard) |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hasher.hash(DUMMY_PASSWORD);
  return dummyHash;
}
```
**Suggested**
```ts
function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hasher.hash(DUMMY_PASSWORD).catch((error: unknown) => {
    dummyHash = undefined;
    throw error;
  });
  return dummyHash;
}
```
</details>

## Reviewer-specific tables
Security checklist above.

## Previous Findings (re-review only)
First round.

## Notes
- The architect's rulings on sign-out with `session_version`, and on the `/design-system` production check (Dev Record decision 6), are pending on Jira AQP-38. This review does not block on them: either outcome is a small change.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-38/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #58 COMMENT review (9 inline comments) and label `review:standards-approved`; hand-off comment on Jira AQP-38
- Open questions: none
- Risks raised: none new; items for #59 in STD-05
- Recommended next agent: master, for the G6 decision; the developer should take STD-01 to STD-03 (small)
