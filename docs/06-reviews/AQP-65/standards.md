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

---

## Round 2 — head 5231947f4b08d586a2de615302493e8d111ceb2d (2026-11-06)

**Scope.** Round 2 covers the PR's own commits since round 1 (6ec2575):
- 528c241: own reset, QLT-69/70/72 and UX v0.14;
- ad26ebd: ID letter case;
- 2d9c46a: the accessible name;
- 5231947: the `@one-width` tags (round 3).

The merges d1a0109 and 0a8a6f0 bring in master work that has already been reviewed (#85, #86, #90). Their only conflict resolution is in `tests/e2e/auth.setup.ts` (0a8a6f0). It is correct: master's warm-up loop and this PR's Admin set-up step are both kept.

The developer's notes are in Jira 11005, 11010 and 11031. CI `Stages 1 to 11` is green (run 42145959641).

**Verdict: APPROVE WITH COMMENTS.**

| Item | Result |
|------|--------|
| STD-01 (Minor, security) | **Fixed.** `resetPassword(actorId, targetId, password)` loads the row and refuses with `ConflictError` 409 `CANNOT_RESET_OWN_PASSWORD` when `isSamePerson(actorId, target.id)` (`user-service.ts:138`), before any hash is made. The route passes `user.id`. Reset is disabled on the own row (`users-list.tsx:83-86`). Tests cover the unit, route (status, code, no echo, row unchanged), integration (hash, `session_version` and `must_change_password` unchanged) and E2E levels. Thread resolved |
| ID letter case (automated security review) | **Complete.** Two layers: `userIdParamsSchema` lower-cases the ID after `z.uuid`, and all three self-guards compare the actor with the ID the database returned, ignoring case. Writes use `target.id`. Either layer alone closes the bypass. Tests cover upper case, mixed case and an upper-case caller in the service; upper case in the routes and on real PostgreSQL; and upper case in the schema (mixed case there is a no-op, see STD-06). The fake repository's IDs now contain hex letters and are compared as uuid compares them |
| Other ID routes | **None affected.** The only dynamic API routes are `users/[id]` and `users/[id]/password-reset`, and both use this schema. The other ID comparisons in `src/` do not decide authorisation: the client-side `own` and `busyUserId` checks use server-issued IDs, and the field-document checks in `lib/fields` and `lib/formula` compare IDs within one stored JSON document. `session.userId` comes from the database |
| Disabled own-row Reset name | **Acceptable.** "Reset password is not available for your own account. Use Change password in the account menu" starts with the visible text (WCAG 2.5.3), says why, is a named constant, and is tested by prefix. It is not yet recorded in ux-spec SCR-14 (STD-08) |
| `users-schemas.test.ts` | Conforms (strict in and out, no casts, invented data), apart from STD-06 |
| `loading-boundaries.test.ts` and `tests/support/loading-boundaries.ts` | Good. A pure function, planted-fault cases prove the guard can fail, the empty scan is guarded, and the relative imports follow the `tests/support` convention |
| `users-page-order.test.ts` | Good. `list` is a spy: it is never called for a Lead, an Engineer or a signed-out visitor, and called once for the Admin. `importOriginal<typeof import('react')>()` is a generic, not a cast. Set-up is in hooks, with no timeout or wall-clock check |
| `@one-width` (5231947) | Matches the architect's ruling (Jira 11004 and 11008). All 5 tests of `users-production.spec.ts` and 7 of `users.spec.ts` are tagged, and the tests that read layout keep three widths. The allow-list now has 6 files and pins 34 tests by title |

### New findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-06 | Minor | `tests/unit/users-schemas.test.ts:75` | Test strategy (a test must be able to fail) | `PERSON.id` contains no letter a to f, so `.replace(/[a-f]/g, …)` changes nothing and the "whatever case" line would pass without the transform | Mixed case is not proven at the schema layer. The all-capitals line on `:76` does cover the transform | Use a mixed-case ID that contains hex letters, and assert `mixed !== id` first |
| STD-07 | Info | `src/server/services/user-service.ts:64-71` | §5 | The case fix is complete and has two layers. Good practice | — | — |
| STD-08 | Info | `src/components/features/users/users-list.tsx:25` | Traceability | The disabled-Reset accessible name and the 409 `CANNOT_RESET_OWN_PASSWORD` are not recorded in ux-spec SCR-14 or in architecture §6 (Users row) | The spec and the code drift apart | ux-expert: record the wording, and confirm "Change password in the account menu" exists when this ships (story 01.05). solution-architect: add the own-reset 409 to §6 |

### Previous findings
| ID | Status |
|----|--------|
| STD-01 | Fixed, thread resolved |
| STD-02, STD-03, STD-05 | Info notes of conformance; nothing to fix |
| STD-04 | Still open (Info). `tests/e2e/support/auth.ts` is unchanged, and the guarded URL is still read twice |

Round 2 counts: 0 Blocker · 0 Critical · 0 Major · 1 Minor · 2 Info.

**Correction recorded on the PR (issuecomment-6675327670).** My GitHub review summary said the merges touched no AQP-65 file beyond `one-width-tag.test.ts`, and I had not checked that. In fact the only conflict resolution is in `tests/e2e/auth.setup.ts`, and it is correct.

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-65/standards.md` (main folder, uncommitted; Round 2 appended)
- Jira / GitHub updates: PR #87 round-2 COMMENT review (3 inline comments plus the summary); STD-01 reply (Fixed, resolved); correction comment; label `review:standards-approved` kept, other labels untouched; comment on Jira AQP-65
- Open questions: none
- Risks raised: none. The STD-01 risk from round 1 is closed by the fix
- Recommended next agent: master, for the G6 decision. Optionally, the developer can fix STD-06 (a one-line test change). ux-expert and solution-architect can record STD-08
