# Review Report — AQP-74 (STORY-01.07: audit service and audit screen) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master (93d3b8f)...feat/AQP-74-audit-log` (PR #97; merge state `CLEAN`) |
| Commit reviewed | 3aa50db808841ac3e706eefaee5508e93941ee4d |
| Date | 2026-11-06 |
| **Verdict** | APPROVE WITH COMMENTS (3 Minor test-code fixes requested) |

## Summary
The PR adds:
- **Table:** an append-only `audit_log` table, via migration `20261106090000_audit_log`.
- **Transaction runner:** a runner whose opaque `Transaction` handle only a repository can turn back into a client.
- **Audit service:** it validates each entry against a registry of event schemas and refuses anything secret-shaped.
- **User changes:** the five user events, each written in the same transaction as its change, with a `SELECT … FOR UPDATE` read of the "before" state.
- **Read side:** the Admin-only `/audit` page (SCR-16) and `GET /api/v1/audit`.

All the security focus areas hold:
- the raw SQL is parameterised;
- the log is immutable by grant and by trigger, and the code has no write path after insert;
- only the Admin can read it, and the role is checked before any read;
- nothing new is logged beyond name and code;
- the before and after payloads cannot hold a password, a hash or a token, and the stored JSON never leaves the server;
- the migration follows conventions;
- no pushed commit carries a secret-shaped literal.

The three Minor findings are all in test code:
- two `as` casts;
- per-file and per-test timeouts, against test strategy §10;
- one test file over 400 lines.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff 93d3b8f 3aa50db` (56 files, +4,255 / −151) | Read the migration, schema, transaction, repositories, services, route, manifest and page in full; read the screen and tests selectively |
| Commits | `git log` | 8 Conventional Commits (`feat`, `test`, `refactor`, `fix` with the `(audit)` scope), each with `[AQP-74]`. Branch `feat/AQP-74-audit-log` |
| CI | run 42179402882 | `Stages 1 to 11` green, including the Gitleaks stage |
| Raw SQL | `grep` for `Unsafe`, `$executeRaw`, `Prisma.raw` and `sql\`` over the diff | None. The one `$queryRaw` tagged template binds the ID |
| Immutability | Reading the migration, repository and route, plus `append-only.test.ts` | Grant and trigger, both tested on PostgreSQL. No update or delete path. GET only |
| Access | Manifest, `page.tsx`, `role-matrix.test.ts`, `audit-page-order.test.ts` | `ADMIN_ONLY`, role checked first, no `loading.tsx` |
| Logging | `grep` for `logger.`/`console.` in the added lines | None added. Errors go through `withRoute`'s name-and-code log (DL-093) |
| Payload secrets | `audit-events.ts`, `audit-secrets.ts`, the user-service calls, `auditPageSchema` | Strict per-event schemas plus a key and value guard. The API returns the words only |
| Secret-shaped literals | `git log -p 93d3b8f..3aa50db`, scanned for `eyJ…`, `$argon2…$v=`, `$2[aby]$NN$`, PEM headers, AWS and GitHub prefixes | Only the detection regex and the run-time-joined JWT shape. The hash shapes are invented placeholders |
| File size | `wc -l` at the head | `tests/unit/user-service.test.ts` has 432 lines (STD-03). All other files are within 400 |
| Hygiene | Reading the added lines | Two `as` casts in an integration test (STD-01). No `any`, TODO, `eslint-disable` or secret. No dependency change |
| Local lint, type-check and tests | Not run | The main folder holds another branch, and the rule is direct commands with no checkout; CI covers them |

## Security checklist
| Item | Result |
|------|--------|
| SQL injection | No. `$queryRaw` tagged template, `${id}::uuid` bound, UUID-checked first, rows parsed with zod |
| Audit tampering | Refused. `REVOKE UPDATE, DELETE, TRUNCATE` from `accucut_app`, and `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers for every role. No code path |
| Back-dating | Not possible. `created_at` is stamped by the database (`clock_timestamp()` at the millisecond) |
| Entry without its change, or the reverse | Not possible. One transaction for both; `append` requires `tx`; a refused entry rolls the change back |
| Authorisation | Admin only, page and API, role checked before any read (CR-33) |
| Data exposure | Restricted `before` and `after` JSON stays on the server. The answer schema is strict. The page sends only `id` and `name` of people. No e-mail address in entries (data minimisation) |
| Secrets in entries, logs or errors | None. Strict schemas plus `findSecretPath`. `AuditEntryRefusedError` names a path, never a value, and has a fixed message |
| Cursor | Unsigned by design. It names a position in a list the Admin may read in full, and it is validated (base64url JSON, strict zod, UUID, length ≤ 200) |
| Secrets in the repository | None in any pushed commit |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/integration/audit/audit-database.test.ts:216`, `:258` | No `as` casts (applied to tests) | `AUDIT_EVENTS[event as AuditEventName]` and `(change.after as { role: string }).role` | A shape change is hidden, not reported | `isAuditEventName` guard (or `AuditEventName`-typed `SCENARIOS` keys); `z.strictObject({ role: z.string() }).parse(change.after).role` |
| STD-02 | Minor | `audit-database.test.ts:73`, `:261`; `append-only.test.ts:42` | Test strategy §10 / DL-057: the database hook timeout is set once in `vitest.config.ts`, never per file; a per-test limit is not raised | Two `beforeAll(…, 120_000)` that repeat the config. One `}, 30_000)` on the concurrency test | Drifts from the single rule, and hides a lock problem behind a longer limit | Remove all three. (Info: the 60 s DB-versus-app clock bound at `:222` is a sanity check and acceptable; a `clock_timestamp()` before/after bracket would be load-free) |
| STD-03 | Minor | `tests/unit/user-service.test.ts` (block from `:305`) | At most 400 lines per file | 285 → 432 lines | Against the standard; harder to navigate | Move the audit block to `tests/unit/user-service-audit.test.ts`, sharing the fixture through `tests/support` |
| STD-04 | Info | `src/server/repositories/user-repository.ts:195-203` | §5 | Positive: the raw SQL is safe (see the security checklist) | — | — |
| STD-05 | Info | `prisma/migrations/20261106090000_audit_log/migration.sql:42-53` | §5; architecture §5.1; standards §10 SQL | Positive: immutability at every layer; names, rollback note, append-only exception, database-stamped time, FK without cascade; `schema.prisma` matches | — | — |
| STD-06 | Info | `src/server/services/user-service.ts:175-184` | §5 | Positive: payloads hold only `role`, `isActive` or `mustChangePassword` | — | For other roles: see Notes |
| STD-07 | Info | `tests/unit/audit-secrets.test.ts:14` | §5, Gitleaks | Secret-shaped literals: clean in every pushed commit. The run-time JWT join follows the `secret-scan-control` precedent | — | Keep the pattern for test inputs only |

## Notes
- **Issues for other roles (reviewer-performance, reviewer-quality), not standards findings:**
  - `resetPassword` hashes the password (argon2id, about 0.35 s and 64 MiB) inside the transaction, after locking the row with `FOR UPDATE`. A pool connection and the row lock are held for the length of the hash. This is deliberate, per the module comment.
  - In `update` (`user-service.ts:154`) and `activeAdminExists()`, `findActiveAdmin()` uses the plain client inside a transaction callback. That takes a second pool connection while the transaction holds one, so concurrent changes could wait on `maxWait` (5 s). This is unlikely at Admin volumes.
- **For product-owner:** a change of name alone records no entry. This is outside the story's five events, and the developer raised it as a question.
- **Secret literals:** the earlier local branch's JWT-shaped literal is not in any pushed commit. That claim rests on the pushed history; unpushed local commits cannot be inspected.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-74/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #97 COMMENT review (7 inline comments: 3 Minor, 4 Info, plus the summary); label `review:standards-approved` (see the hand-off in chat for its status); comment on Jira AQP-74
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision. The developer can fix STD-01 to STD-03 together. reviewer-performance and reviewer-quality should look at the STD-06 notes

---

## Round 2 — head c365f0073a67c69d53978635ab509e2796cee66c (2026-11-06)

**Scope.** This round is a full re-review of the new diff, as master ruled (Jira 11096): `ea12a6f..c365f00`, 35 files, +1,123 / −459, in two commits:
- 7167d4c `fix(audit): …`;
- c365f00 `test(audit): …`.

Both carry `[AQP-74]`. The merge ea12a6f brings in AQP-208 (#96), which was reviewed under AQP-208. `git show --cc` shows that it resolved no conflicts.

CI run 42204813440 is green: `Stages 1 to 11b`, both shards and the fan-in `Stages 1 to 11`.

The developer's lint commit, from the architect's ruling in 11102 (`no-img-element` off and `next/image` banned), **had not landed when I fetched** the head. Master checks it at G6.

**Verdict: APPROVE WITH COMMENTS.**

### Previous findings
| ID | Status | Evidence |
|----|--------|----------|
| STD-01 (Minor) | **Fixed** | No `as` type assertion in the audit and user-service tests, support files or audit E2E specs (`as const` excepted). The new lock test reads roles with `z.strictObject(...).parse` |
| STD-02 (Minor) | **Fixed** | The per-file `beforeAll(…, 120_000)` in `audit-database` and `append-only` is removed, and so is the per-test `30_000`. The concurrency check moved to `audit-lock.test.ts`. It waits for an observed lock wait in `pg_locks`, polling every 25 ms with a 10 s deadline so the test fails rather than hangs. That is not a speed assertion, so it is acceptable. The 60 s clock sanity bound stays (Info, accepted) |
| STD-03 (Minor) | **Fixed** | `user-service.test.ts` has 264 lines, and the new `user-service-audit.test.ts` has 253; they share `tests/support/user-service-fixture.ts`. The largest changed file is `tests/e2e/audit.spec.ts` at 381 |
| STD-04 to STD-07 (Info) | Still hold | Raw SQL unchanged. Immutability (grant and triggers) unchanged. Payload guard extended to `user.renamed`. No secret-shaped literal in the new commits (scanned `git log -p ea12a6f..c365f00`) |
| Round-1 note, hash inside the lock | **Addressed** | `resetPassword` now checks existence and the own-account rule outside the transaction, hashes, and then opens the transaction. No lock or pool connection is held during argon2id. Re-reading inside the transaction with `FOR UPDATE` keeps the "before" correct |

### Focus areas
| Item | Result |
|------|--------|
| `actor_label` source | **Server-only.** All three user routes pass `user.name` from `withRoute`'s `requireUser()`, which reads `users` on every request (`resolve-session-user.ts`). The session cookie carries only three values, and the name is never copied into it. The strict body schemas have no such field, so no client input can set it. The service refuses an empty label or one over 200 characters |
| Server-rendered people list | **Correct.** `auditPeople()` builds `{ id, name }` only, sorted by name and then ID, with deactivated people included. It runs on the server after `authorizePage('/audit')`, on an Admin-only page. Unit test: no e-mail address, role or flag, and the input is not mutated. `audit-page-order.test.ts` has been extended |
| `user.renamed` payloads | **No secrets.** `{ name }` before and after, as `z.strictObject` with `min(1)`. A name is not a secret and is already the entry's label. `findSecretPath` still runs on them |
| Migration change | **Acceptable before merge.** It adds `actor_label TEXT NOT NULL` to the *unmerged* migration `20261106090000_audit_log`. Editing a migration in place is fine only because it has never reached `master` or a shared database (CI databases are throwaway). Once merged it must never be edited again. The table is new, so `NOT NULL` without a default is safe. `schema.prisma` matches. The E2E canary insert binds `actor_label` as `$2::text` |
| `<img>` in BrandLockup | **No security or standards defect.** The literal `src` is the logo in `public/`, with `alt`, fixed `width` and `height` (no layout shift), and `fetchPriority="high"`. The reason, PRF-01 (+18.8 KB of `next/image` client code with `unoptimized` images), is documented in the component. The ESLint `no-img-element` *warning* passes CI because the lint step has no `--max-warnings 0`. The architect's ruling (11102: rule off repo-wide, `next/image` banned through `no-restricted-imports` as an error) settles it once the commit lands; see STD-10 |

### New findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-08 | Info | `src/server/services/audit-service.ts` (`actorLabel` check), routes `users/**` | §5 | Positive: `actor_label` is server-sourced, bounded and stored as written. The rest of the round-2 source is consistent | — | Never edit migration `20261106090000` after merge |
| STD-09 | Info | `src/server/services/audit-events.ts` (`user.renamed`), `src/server/views/audit-people.ts` | §5, data minimisation | Positive: rename payload and people list. Edge: `findSecretPath` judges *values*, so a name typed in the exact shape of a PHC hash or a JWT would make the rename's entry refused and the change roll back with a 500. It is practically impossible for a real name and fails closed | A confusing error in a contrived case only | None needed. Optionally, reviewer-quality may prefer a 422 on the name field |
| STD-10 | Info | `src/components/shared/brand-lockup.tsx:25` | Lint hygiene | Until the 11102 lint commit lands, `npx eslint .` reports a standing `no-img-element` warning. Warnings do not fail CI, so warnings like this accumulate unnoticed | Lint noise | Land the ruled config change (rule off, `next/image` banned as an error). Consider `--max-warnings 0` in CI later (architect's call) |

Round 2 counts: 0 Blocker · 0 Critical · 0 Major · 0 Minor · 3 Info (new).

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-74/standards.md` (main folder, uncommitted; Round 2 appended)
- Jira / GitHub updates: PR #97 round-2 COMMENT review; replies on STD-01, STD-02 and STD-03 (Fixed, resolved); label `review:standards-approved` kept, other labels untouched; comment on Jira AQP-74
- Open questions: none
- Risks raised: none
- Recommended next agent: master, for the G6 decision, including a check of the lint-config commit once it lands (11102)
