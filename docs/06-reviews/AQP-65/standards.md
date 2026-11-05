# Review Report — AQP-65 (STORY-01.04: Admin creates and deactivates users; one Admin) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (security included) |
| Review round | 1 |
| Base…branch | `master (975dda0)...feat/AQP-65-users` (PR #87); code diff `975dda0...6ec2575`; head d1a0109 adds only the master merge |
| Commit reviewed | 6ec2575 (review anchored on d1a01090a16e31ca13204c84e538a9b4bc86c911) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS (the G6 decision itself is held until AQP-199 merges, DL-099) |

## Summary
The Users feature conforms on authorisation, CSRF, enumeration, the one-Admin rule, password hashing and logging:
- every route is an Admin-only `withRoute` row, and the role is checked before any read;
- one fixed 403 is returned for real and invented IDs, proven on the production build;
- the unique index decides the one-Admin race;
- passwords use argon2id with a 128-character cap before hashing;
- logs carry name and code only (DL-093).

There is one Minor security finding: the Admin can reset their *own* password through the admin reset route, without the current password or a step-up.

The developer's soft-reset left no generated key material in any commit reachable from the PR head. Only invented, word-based values are present.

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
| Code diff | `git fetch origin pull/87/head` (no checkout, no merge), then `git diff 975dda0...6ec2575` | 54 files; the service, repository, schemas, routes, page, errors, `withRoute` and problem changes, security loops and E2E set-up read in full |
| Pushed history scan | `git log -p 975dda0..6ec2575` with key, secret, token, password and long-literal patterns | Only invented word-based values (`invented-throttle-key-material`, `invented-first-password-1`, `invented-secret-looking-value-77`); CI stage 2 Gitleaks green |
| Force-push history | not checked | No tool here reads the PR timeline; "never pushed" rests on the developer's statement (correction posted on the PR) |
| Dependencies | `git diff --stat -- package.json package-lock.json .github` | None changed |
| Hygiene | Reading the added lines in `src/` | No `console.*`, `eslint-disable`, `any`, assertion or secret; no new log call |
| Architecture API table | `docs/04-architecture/architecture.md` section 6, "Users" | 409 for the second-Admin and own-account cases, 422 for field faults: `EMAIL_TAKEN` 422 conforms |
| CI | run 42070657561 on 6ec2575 | Green |
| Local lint / type-check | not run | The main folder holds another branch; CI covers them |

## Security checklist
| Area | Result |
|------|--------|
| Authorisation | Admin-only manifest rows; `withRoute` checks the role before params or reads; `authorizePage('/users')` before the list is read; no `loading.tsx`, so the 403 stays a 403 (TD-06, tested on `next start`) |
| CSRF | Origin check before the session on POST and PATCH; the non-empty CSRF loop covers all three state-changing calls |
| Enumeration | One fixed 403 body for a real and an invented ID (unit, loop, production E2E with a canary person) |
| One-Admin rule | Service check names the Admin; `uq_users_single_active_admin` decides; race tested (4 concurrent creates, direct SQL) |
| Own account | Own deactivation and own role change refused by the server (409); own password reset **not** refused (STD-01) |
| Passwords | Shared argon2id hasher; at most 128 characters before hashing; never trimmed, returned or logged; reset answers 204 with no body, sets `must_change_password`, raises `session_version`, clears the account throttle key (shared `throttle-key.ts`) |
| Output | Strict `userSchema`: no hash, no session version, no `mustChangePassword`; the 409 names the current Admin to the Admin only |
| Logging | DL-093 holds: no new log calls; `UserConstraintError` messages hold no values |
| E2E set-up | `assertThrowawayDatabase` (this machine or CI only) before deactivating other Admins; parameterised SQL; invented data |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/server/services/user-service.ts:122-128` (route `src/app/api/v1/users/[id]/password-reset/route.ts`) | §5 least privilege; architecture §8 Admin guards | `resetPassword` has no own-account guard: the Admin can reset their own password with no current password and no step-up | A stolen or unattended Admin session can set a known password and keep the account | Pass `actorId`; refuse `actorId === targetId` with 409 `CANNOT_RESET_OWN_PASSWORD`; disable the action on the own row; add tests. Or record an architect decision and require step-up |
| STD-02 | Info | `src/server/services/user-service.ts:73-84` | §5; architecture §6 | One-Admin rule and `EMAIL_TAKEN` 422 reviewed: they conform | — | — |
| STD-03 | Info | `src/app/api/v1/users/[id]/route.ts:9-16` | §5, NFR-002 | Authorisation, CSRF, input and output schemas, passwords and logging reviewed: they conform | — | — |
| STD-04 | Info | `tests/e2e/support/auth.ts:93-106` | §5 | E2E Admin set-up is guarded to throwaway databases | The URL is read twice from the environment | Pass the guarded URL into the connect helper |
| STD-05 | Info | `tests/support/security-loops.ts:22-32` | Test strategy | Good practice: empty lists fail at load, skipped bodies fail, the SPEC table is the oracle | — | — |

## Notes
- Squash-merge, so the default merge commit does not reach `master`.
- Candidate convention for the architect, raised by the developer: a page that calls `forbidden()` must not have a `loading.tsx`.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-65/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #87 COMMENT review (5 inline comments plus the summary), a correction comment on the PR (force-push history not checked); label `review:standards-approved` added (other labels kept); comment on Jira AQP-65
- Open questions: none (STD-01 can be settled by a code guard or by an architect decision)
- Risks raised: STD-01 (own-password reset without step-up)
- Recommended next agent: master, for the G6 decision once AQP-199 merges (DL-099); the developer should fix STD-01
