# Review Report — AQP-38 (STORY-01.01) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (re-review of the fix round `4d9b2e2..ea8dc6b`; round 1 below is kept for the record) |
| Base…branch | `master...feat/AQP-38-sign-in-sign-out` (PR #58) |
| Commit reviewed | round 2: ea8dc6b97dc0bbd5b1ccc86f14a20a40828a156c · round 1: 4d9b2e2e0b3432976b790cda937f8608a15de957 |
| Date | 2026-11-04 |
| **Verdict** | **Round 2: APPROVE WITH COMMENTS** (no Blocker, Critical, Major or Minor open) · round 1: REQUEST CHANGES |

## Round 2 — re-review of 4d9b2e2..ea8dc6b

**Summary.** All round 1 findings are resolved. QLT-32 is fixed with one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` reservation per key, taken before the hash check. My probe now gives 5 password checks and 45 `locked` for 50 parallel wrong attempts (previously 50 and 0). QLT-33 and QLT-34 are fixed, and QLT-35's lost count is closed by the in-statement restart. I checked the new reservation semantics (block expiry, window boundary, give-back floor, address successes) and found two Info points.

| Severity (new, round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

**Checks run (round 2).**

| Check | Command | Result |
|-------|---------|--------|
| Unit tests (scratch copy of ea8dc6b via `git archive`; no working tree touched) | `npx vitest run tests/unit/probe-38.test.ts tests/unit/auth-service.test.ts tests/unit/auth-service-concurrency.test.ts tests/unit/auth-locked-response.test.ts` | 49 of 49 passed |
| QLT-32 probe re-run | 50 parallel wrong attempts on one account | **5 password checks, 45 `locked`**; the right password afterwards is `locked` |
| QLT-33 probe re-run | hasher whose first `hash` fails | first unknown e-mail throws; the second answers `invalid` |
| Edge probe: address | 29 failures, then correct, correct, wrong, wrong, correct, then 15 minutes later correct (one address) | signed-in, signed-in, invalid, locked, locked, signed-in |
| Edge probe: account fault | 4 wrong, a fault, wrong, right | invalid ×4, threw, invalid, **locked** (the count is right after the give-back) |
| Integration and E2E | not run locally (no database settings; `.env` not read) | CI run 41845931376, stages 1 to 12: success |

**Previous findings.**

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-32 | Major | **Fixed** | Reservation before the check; `auth-service-concurrency.test.ts`; `throttle-reservation.test.ts` (50 parallel reservations get 1 to 50 on PostgreSQL) |
| QLT-33 | Minor | **Fixed** | Rejected dummy hash is forgotten; a faulted attempt gives back both places |
| QLT-34 | Minor | **Fixed** | `withSignInStatus`: `unavailable` gives 503, `locked` gives 429; handler test with `DatabaseBusyError` |
| QLT-35 | Info | Lost count **fixed**; fixed window **accepted**; `unknown` counter moved to **#59** | |
| QLT-36 | Info | **Conforms** | Sign-out is compare-and-increment on the token's version (ADR-009 amendment 1) |

**New findings (round 2).**

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-37 | Info | `src/server/repositories/throttle-repository.ts:92-96` | AC-3 | A give-back decrements the row's **current** run or window. A release after a restart (the window rolled over during a verify, or a block ended during a fault) lowers the new run. A fault at the 5th leaves `blocked_until` timed from the faulted attempt. During a block the count keeps rising. | Bounded by the attempts in flight; needs a success, an account refusal or a fault; does not reopen QLT-32. | Document it, or release only `WHERE window_started_at = <the run reserved>`. |
| QLT-38 | Info | `src/server/repositories/throttle-repository.ts:71-77` | AC-3, NFR-003 (STD-12 cross-reference) | The block is set when the limit-th attempt is **reserved**. For an address, a later success leaves `blocked_until` in place. Refusal is on the **count**, so an office address keeps signing people in (probe), and the leftover only delays the window restart. | None; correct behaviour that is easy to misread. | One sentence in the header for the NFR-003 owner. |

**Semantics checked.** `failures` counts reserved attempts; the address is reserved first; an account refusal gives the address back; a success clears the account and gives the address back; a fault gives back both. A block in force is neither shortened nor extended, and the first attempt after its end restarts at 1. An address window restarts only when unblocked; an account restarts only at a block's end or a success. The give-back floor is `GREATEST(…, 0)`. The fake's `reserve` copies the SQL `CASE` logic, and the SQL itself is tested on PostgreSQL.

---

## Round 1 — review of 4d9b2e2 (kept for the record)

## Summary
The slice is well built. The sign-in rules sit in a pure service behind interfaces, and time comes from a controlled clock. The AC-2 "same timing" is proved by counting hash checks, not with a stopwatch. Role, active flag and `session_version` are read from the database on every request, and the return-path rule checks the resolved URL. The one Major (QLT-32) is that the lock-out is check-then-act: parallel attempts all read "not blocked" before any failure is recorded, so a burst gets one password check per request. I reproduced this with the PR's own service. Two Minors: a failed dummy hash is cached, which lets unknown e-mails be told apart (QLT-33), and a busy database during sign-in answers 401 instead of R4's 503 (QLT-34). The pending architect ruling on sign-out and `session_version` does not block this review (QLT-36).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 2 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Unit tests (scratch copy of 4d9b2e2 via `git archive`; no working tree touched) | `npx vitest run tests/unit/auth-service.test.ts` | 24 passed |
| Probe 1: concurrency (scratch test, not in the PR) | 50 wrong attempts for one account with `Promise.all`, using the PR's `createAuthService`, fakes and counting hasher | 50 password checks, 0 `locked`; the account is blocked only afterwards |
| Probe 2: dummy hash (scratch test) | hasher whose first `hash` rejects | first and every later unknown e-mail throws (`unavailable`) |
| Code read in full | auth service, user and throttle repositories, `options.ts`, `locked-response.ts`, auth route, `session.ts`, `session-token.ts`, `resolve-session-user.ts`, `client-address.ts`, `return-path.ts`, `proxy.ts` | see Findings |
| Integration and E2E | not run locally (no database settings; `.env` not read) | CI on 4d9b2e2 green: 2,007 unit and integration tests, changed-code coverage 95.0 %, 125 E2E passed |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-32 | Major | `src/server/services/auth-service.ts:112-127` | AC-3, NFR-003 | The block is read before the hash check and the failure is recorded after it. Parallel attempts all pass the check; reproduced with 50 checks and 0 `locked`. The per-address limit has the same shape. | The brute-force limit becomes "one burst per 15 minutes" instead of 5 guesses. | Reserve the attempt atomically before hashing (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) and decide on the returned count; clear the account key on success. Add a parallel unit test and an integration test. |
| QLT-33 | Minor | `src/server/services/auth-service.ts:86-91` | AC-2 | `dummyHash ??= hasher.hash(...)` caches a rejected promise, so every later unknown e-mail answers `unavailable` while known e-mails answer `invalid`. | Account enumeration until restart, after one hash failure (e.g. out of memory). | Clear the cached promise on rejection, or build the dummy hash at start-up. Add a test with a hasher that fails once. |
| QLT-34 | Minor | `src/server/auth/options.ts:65-80`; `src/server/auth/locked-response.ts` | Architecture ruling R4 | A `DatabaseBusyError` during sign-in becomes `unavailable` with status 401, the same status as a wrong password. | Monitors and clients cannot tell "retry later" from "wrong password"; R4's 503 does not hold on the sign-in route. | Map a 401 with `error=unavailable` to 503 (optionally `Retry-After`). Add a handler test expecting 503. |
| QLT-35 | Info | `src/server/services/auth-service.ts:93-104`, line 64 | AC-3 | `restartWindow` can lose a count when two failures race. The address window is fixed, not sliding. All attempts without `X-Forwarded-For` share one `unknown` counter. | Small timing effects. A missing header would let anyone lock out every sign-in for 15 minutes. | Fold into the atomic statement of QLT-32; note the fixed window; add the shared-counter risk to #59. |
| QLT-36 | Info | `src/server/auth/options.ts:130-145` | AC-4, ADR-009 | Sign-out raises `session_version` (ends every session). The atomic increment is correct; a failure is logged and the cookie is still cleared (tested). The architect's ruling is pending. | None as built. | If the ruling is cookie-only: one line and one test, as the PR states. |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 role's home at `/queue` | sign-in page and form, `queue/page.tsx`, `roles.ts` | E2E, `sign-in-handler.test.ts` | Met |
| AC-2 one message, same status and work, e-mail kept, focus on notice | `auth-service.ts`, form | `auth-service.test.ts` (counts hash checks), handler, E2E | Met (QLT-33) |
| AC-3 lock-out 5 / 15 min; unknown e-mail same; correct password refused; 30 per address | `auth-service.ts`, `throttle-repository.ts`, 429 mapping | unit with fixed clock, handler, E2E | **Met sequentially; bypassed by concurrency (QLT-32)** |
| AC-4 sign-out, redirect, `private, no-store`, back button | `options.ts`, `proxy.ts`, auth client | handler, proxy unit, E2E | Met |
| AC-5 cookie flags; token = id, version, sign-in time; role and active from DB | `options.ts`, `session-token.ts`, `resolve-session-user.ts`, `session.ts` | handler, `auth-session.test.ts` (including the 12 h edge) | Met |
| AC-6 open redirect refused | `return-path.ts` | 17 hostile forms, E2E | Met |
| AC-7 bootstrap Admin | `scripts/bootstrap-admin.ts`, service | real script against PostgreSQL | Met |
| AC-8 SCR-01 at 3 widths, axe, keyboard | page, form, `password-input.tsx` | `sign-in.spec.ts` (CI stage 12) | Met |

**Subtasks:** AQP-49 to AQP-56 (T1 to T8) map one-to-one to the rows above; all are Done in Jira and have code and tests in this PR.

**Error paths:** wrong password, unknown e-mail and deactivated account are correct. Throttling is correct sequentially (QLT-32). A busy database gives the wrong status (QLT-34). An expired session is correct (refused at exactly 12 h from sign-in, not sliding). A `session_version` mismatch, deactivation or role change is correct at the next request.

**Concurrency:** `session_version` uses an atomic increment, which is correct. The throttle upsert is atomic and tested; the decision around it is not (QLT-32, QLT-35).

## Previous Findings (re-review only)
n/a (first quality review of this PR).
