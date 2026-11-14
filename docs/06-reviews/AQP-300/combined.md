# Review Report — AQP-300 (STORY-06.14) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-300-step-up-2` (PR #377) |
| Commit reviewed | aef2c69 (on master 68f6bf3) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/377#pullrequestreview-5904044859 |

## Summary
`verifyStepUp` is correct and safe. It checks only the session user's password and reserves the attempt atomically before any user read or argon2 call. Ten parallel wrong attempts reach the hash check at most five times. It gives the reservation back on every fault path, uses its own HMAC `stepup` key, and answers fixed, neutral 422 and 429 bodies. Nothing secret reaches logs, bodies, throttle rows or the audit log. The tests are meaningful: three mutation probes were each caught. The findings are design and robustness items (duplication across password checks, a shared repository edge case, naming, the route-level answer for an empty password). None of them stops the merge.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 |
| Info | 7 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `git diff 68f6bf3 aef2c69` (15 files), plus callers and callees: `throttle-repository.ts`, `auth-service.ts`, `account-service.ts`, `with-route.ts`, `logger.ts`, `tests/support/fake-auth-repositories.ts` | Read in full |
| Targeted unit tests | `npx vitest run tests/unit/auth/step-up-service.test.ts tests/unit/auth/throttle-key.test.ts tests/unit/http-problem.test.ts tests/unit/user-service.test.ts` on an export of aef2c69 | 4 files, 83 tests passed |
| Mutation probes (scratch copy) | (1) `giveBack` does nothing; (2) no `clear` after a right password; (3) limit `>` changed to `>=` | Each caught: 5, 2 and 2 failing tests |
| Fix commit 601741e (Engineer import rule) | `git diff aef2c69 601741e` (test file only, +4 lines; `eslint.config.mjs` unchanged); `npx vitest run tests/security/engineer-import-rule.test.ts` on an export of 601741e | `step-up-service` classed as **blocked**, which is correct for NFR-002 / ADR-008. 762 tests passed. No new finding |
| Integration (PostgreSQL), `tsc`, build, E2E | CI | Not run locally (no PostgreSQL, under 1 GB free memory); the orchestrator tracks CI |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| SQR-01 | Info | `src/server/services/auth-service.ts:42` | AC-3, NFR-003, arch §6, ADR-009 | The developer asked whether "5 consecutive failures" meets AC-3's "5 wrong passwords in 15 minutes". **Yes.** Architecture §6 specifies 5 consecutive failures for step-up. Any 5 wrong passwords within 15 minutes block the key unless a correct password comes between them, which proves the caller already knows the secret. | None in code. The AC text and the architecture use different words. | Product-owner rewords AC-3 to "5 consecutive wrong passwords". |
| SQR-02 | Minor | `src/server/services/step-up-service.ts:72-115` | Coding standards §3 (no duplication), design | The reserve, check, give back, clear sequence is a near copy of `account-service.ts:77-104`, and sign-in has a third variant. | A security fix made in one copy can miss the others. `account-service` already lacks the clear-fault give-back that this PR adds. | Hardening: a shared `guardedCheck(throttles, key, policy, now, check) → 'locked' \| 'wrong' \| 'right'` used by step-up and change-password. |
| SQR-03 | Minor | `src/server/views/schemas/step-up.ts:11`; `tests/integration/auth/step-up.test.ts:314`; unit "same words for every wrong case" | AC-2 | Over HTTP, an empty or over-long password gets the schema's 422 `VALIDATION` field error, not `STEP_UP_FAILED`. The unit test claims the same words for those cases, but only at the service, which a real route never reaches for them. The integration test asserts only status 422. | No leak. SCR-18 consumers that compare `code` will get a different shape, so the tests promise more than the route delivers. | Choose one behaviour and test it at the route: (a) keep the validation answer, assert its code, rename the unit test and document it; or (b) drop `.min(1)` so an empty password gets the neutral 422. Product-owner to confirm AC-2's intent. |
| SQR-04 | Minor | `src/server/services/step-up-service.ts:73` (cause in `src/server/repositories/throttle-repository.ts:94`) | AC-5, NFR-003 | `releaseAttempt` lowers `failures` but leaves the `blocked_until` that the released 5th reservation set. After a fault on attempt 5, the next real 5th failure gets a block that ends 15 minutes after the fault, so it is shorter. If nobody tries before then, the run of 4 failures is lost when the block expires. | The throttle is slightly weaker after a server fault. No unfair lockout, and AC-5 holds. Shared with sign-in and change-password. | Hardening (repository): the release also clears `blocked_until` when the count drops below the limit. Test: 4 wrong, a fault on the 5th, then 1 wrong; expect the block to run 15 minutes from the last attempt. |
| SQR-05 | Minor | `src/lib/errors.ts:93,100` | Naming consistency (reviewer-standards area) | `StepUpFailed` / `StepUpLocked` lack the `Error` suffix that every other `AppError` subclass has. The names come from the story's Dev Context. | Six consumer stories will import these names; renaming costs more later. | Rename to `StepUpFailedError` / `StepUpLockedError` now or as the first commit of 06.12. |
| SQR-06 | Info | `src/server/services/step-up-service.ts:48` | AC-6 (consumers) | `StepUpCaller` is structural, so a consumer could hand-build `{ user: { id: body.x } }`. | None today. A risk in consumer stories. | Check in the 06.12 / 06.13 reviews that the call is `verifyStepUp(context, context.body.password)`. Optionally tighten the parameter type. |
| SQR-07 | Info | `src/server/services/step-up-service.ts:11` | Design (coupling) | `STEP_UP_POLICY` sits in `auth-service.ts` as the Dev Context asks, so step-up imports the sign-in service just for a constant. | Coupling between services. | Optional: move all throttle policies to `src/server/auth/throttle-policy.ts`. |
| SQR-08 | Info | `src/server/services/user-service.ts:217` | A-1 | A-1 is built correctly. The three key clears run one after another after the reset commits, so a fault in a later clear gives a 503 for a reset that did happen. This pattern existed before this PR and now covers one more key. | The Admin sees an error and retries (a new temporary password). | Optional: `Promise.allSettled` and a log entry, or document the current behaviour. |
| SQR-09 | Info | `tests/integration/auth/step-up.test.ts:177` | AC-2 (session stays valid) | `requireUser` is mocked, so the test cannot show that `session_version` is unchanged. | Low; the service does not touch it. | Assert `session_version` before and after a wrong attempt. |
| SQR-10 | Info | `src/server/http/with-route.ts:202` and `step-up-service.ts:98,102` | AC-7 | Each refusal writes two warn lines (wrapper and service). Both are free of secrets. | Log noise only. | None needed. |
| SQR-11 | Info | `docs/04-architecture/architecture.md:890` | Docs | Architecture §6 still says step-up is "not built yet". | The architecture document is out of date. | Architect rewords it after the merge (already in the developer's follow-ups). |

<details><summary>Detailed notes</summary>

### SQR-04: walk-through
The run is 4 failures, then attempt 5 reserves: `failures = 5`, and `blocked_until = t5 + 15 min` is set. A DB or hasher fault follows, and `releaseAttempt` sets `failures = 4`. `blocked_until` is unchanged. The next attempt at t6 hits the `ELSE t.failures + 1` branch: `attempts = 5`, it is allowed and checked, and `blocked_until` stays `t5 + 15 min`. If it is wrong, the block ends at `t5 + 15 min` instead of `t6 + 15 min`. If no attempt comes before `t5 + 15 min`, the next one restarts at 1.

### Security review points (all verified)
- **Identity:** `verifyStepUp(caller, password)` has no parameter that names a user. It reads only `findCredentialsById(caller.user.id)`. An inactive or missing user gets 401 with the reservation given back.
- **Order:** `reserveAttempt` (atomic `INSERT ... ON CONFLICT ... RETURNING`) runs before any user read or hash. A refused attempt does no hash work. A fault while reserving counts nothing.
- **Lock:** the 5th reservation sets the block. The 6th and later attempts are refused even with the right password, and `clear` is never reached while blocked.
- **Independence:** HMAC-SHA256 over `stepup:<lower(userId)>` with `AUTH_SECRET`, distinct from the `account`, `ip` and `password-change` kinds.
- **Side channels:** the caller is authenticated, so there is no enumeration surface. Locked and over-ceiling answers skip argon2, but they reveal nothing the caller does not already know.
- **Redaction:** `problem.ts` gives fixed words whatever message is passed in. The errors have no `cause`. The logger redacts `password` and `passwordHash`. No audit row is written.
- **AC-8:** no route added. The integration test uses an in-test manifest row with the real `withRoute`.
</details>

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `step-up-service.ts` 93-114 (clear after a match) | integration AC-1; unit AC-1 (3); mutation "no clear" caught | Pass |
| AC-2 | `errors.ts` `StepUpFailed` 422; `problem.ts` fixed words; `lib/auth/step-up.ts` | integration AC-2 (3 identical bodies, no Set-Cookie, next request passes); `http-problem.test.ts` | Pass (SQR-03, SQR-09) |
| AC-3 | reserve-first; `stepup` kind; `STEP_UP_POLICY` | integration AC-3 (block = start+15 min, refused at -1 ms, free at +15 min, 0 checks while blocked); unit AC-3 (4); mutation `>=` caught | Pass (SQR-01) |
| AC-4 | separate `stepup` key | integration AC-4 (3); unit AC-4 (3); `throttle-key.test.ts` | Pass |
| AC-5 | `reserveAttempt` first; `giveBack` on read, verify and clear faults | integration: 10 in parallel on PostgreSQL gives five 422, five 429, 5 checks; six faults leave the count at 2; unit 7 fault paths; mutation "no give-back" caught | Pass (SQR-04) |
| AC-6 | session-only identity | integration AC-6 (3); unit AC-6 (2) | Pass (SQR-06) |
| AC-7 | fixed messages; `{ userId, requestId }` log; logger redaction | integration AC-7 (3; logs, bodies, throttle table, `findSecretPath`, audit count); unit AC-7 (3) | Pass |
| AC-8 | no route added | integration AC-8 (manifest and source tree) | Pass |

## Issues for other roles
- **product-owner:** reword AC-3 to "5 consecutive wrong passwords" (SQR-01). Confirm whether an empty password should get `STEP_UP_FAILED` or a field validation error (SQR-03).
- **solution-architect:** update architecture §6 line 890 (SQR-11). Consider a shared guarded-check helper and one policy module (SQR-02, SQR-07).
- **developer (06.12 / 06.13):** call `verifyStepUp(context, context.body.password)` exactly (SQR-06). Rename the error classes before consuming them (SQR-05).
