# Review Report — AQP-298 (STORY-04.02) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (focused security-and-quality check of the security-guard changes; story not labelled `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-298-task-queues` (PR #381) |
| Commit reviewed | b397cdc (base 8d32a87) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/381#pullrequestreview-5904333687 |

## Summary
Method enforcement is correct. `withRoute` resolves its row with `findRoute(route, method)`, and the new manifest test makes `kind method path` unique. So an Engineer's `POST /api/v1/tasks` still resolves to the Lead/Admin row and gets the fixed 403 before the body is read. A POST cannot use the GET row's roles unless a handler declares the wrong method, and the role matrix catches that (mutation probe: 5 failures). No security loop skips a case: all of them iterate every row and method. The import-rule entry (`task-queue-cursor`) is a **block**, not an allow. The Engineer list gains `/api/v1/tasks`, which AC-2 requires, and only for GET. The GET answer is cut to the Engineer's own tasks from the session role and parsed with a strict schema that has no cost field. One narrow test-oracle weakening exists: an unlisted method on a path with method keys is expected to be open to all roles (SQR-01). It is cheap to fix and has no effect on today's code.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `git diff 8d32a87 b397cdc` for the in-scope files; plus `with-route.ts`, `route-files.ts`, `engineer-refused-before-lookup.test.ts`, `canary-scan.ts` consumers, `task-service.ts`, `task-repository.ts`, `task-queue-cursor.ts`, `eslint.config.mjs` rule globs | Read |
| Targeted tests | `npx vitest run tests/security tests/unit/http-route-manifest.test.ts` on a scratch worktree at b397cdc | 15 files, 1348 passed |
| Mutation probe (scratch copy) | `POST` export declared with `method: 'GET'` | Caught: 5 failures (role matrix ×4, refused-before-lookup ×1); reverted |
| Integration (PostgreSQL), `tsc`, build, E2E, canary e2e | CI run 43594022009 | 6 of 6 green (per orchestrator); not run locally (low memory) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| SQR-01 | Minor | `tests/security/role-matrix.test.ts:63` | NFR-001, BR-003 (test oracle) | `expectedRoles` falls back to `SPEC_ACCESS[path] ?? ROLES`. `/api/v1/tasks` has only method keys, so an unlisted method (for example `PUT` added to the GET row) is expected to be open to all roles. The path-set check (line 169) strips the method prefix and still passes. | An accidental Engineer-reachable write on this path would pass the role matrix without anyone making a SPEC decision. No impact today. | If any key for the path is method-qualified, require the exact `${method} ${path}` key and throw otherwise. |
| SQR-02 | Minor | `tests/security/role-matrix.test.ts:175` | NFR-001 (test oracle) | The "0 differences" check compares each row only for `row.methods[0]`. | A multi-method row with a method key for a later method is not compared for that method. | `flatMap` over `row.methods`. |
| SQR-03 | Minor | `src/server/http/route-manifest.ts:229` (cause `with-route.ts:158`) | NFR-001, defence in depth | The row is chosen by the declared `options.method`, not by `request.method` or the export name. Now that one path has two role sets, a mis-declared method would pick the other row's roles. | Caught by the tests today (probe: 5 failures). The runtime has no check of its own. | In `run()`, refuse a request whose method differs from the declared one (HEAD maps to GET). Can wait for hardening. |
| SQR-04 | Info | `src/server/views/schemas/tasks.ts:89` | NFR-002, AC-2, AC-8 | Verified: strict answer, no cost, rate or formula field; scope from the session role (`scopeOf`); strict query cannot widen it; the cursor stays inside the scope; a scope ID that is not a UUID is refused. The Engineer receives their own name, `assignedByName` and the customer name, all allowed. The queue view and schema are not under the `engineer-*` ESLint rule, so the guard is the strict schema plus the canary scans, which pick up the route from the manifest. | None. | Optional: make the canary seed give the Engineer at least one task, so the scan reads a non-empty `tasks` array. |
| SQR-05 | Info | `src/server/http/route-manifest.ts:20-21,226-228`; `tests/support/spec-access.ts:43` | Maintainability | Clear comments explain why the path has two rows. The uniqueness test pins the only duplicate path. | Positive: the pattern is easy to follow. | None. |

## Reviewer-specific tables
**Guarantee check (the brief's question)**

| Change | Weakens a guarantee? | Evidence |
|--------|----------------------|----------|
| Two manifest rows for `/api/v1/tasks` | No | `findRoute` keys on path and method; `kind method path` unique; duplicate path pinned to `api /api/v1/tasks` |
| "One row per path" became "one row per path and method" | No (still exact) | Duplicate list must equal exactly `['api /api/v1/tasks']` |
| Method-qualified SPEC keys / `expectedRoles` | Narrowly (oracle) | SQR-01, SQR-02 |
| `refusedRoleCalls` passes the method | No | Still iterates every row × method × role; non-empty guard kept; `POST … as ENGINEER` present |
| `engineer-import-rule` entry | No (stricter) | `task-queue-cursor` added to `blocked` |
| `ENGINEER_ROUTES` + `/api/v1/tasks` | No (AC-2 requires it) | Only the GET row allows ENGINEER |
| `fake-tasks` queue reads | No | Test double; scope filter mirrors the SQL |
| Canary scan coverage | Gained | Engineer API rows from the manifest now include `GET /api/v1/tasks` |

## Issues for other roles
- **developer (this PR or hardening):** SQR-01 and SQR-02 (a few lines in `role-matrix.test.ts`). SQR-03 in `with-route.ts` during hardening.
- **qa-engineer (final review):** confirm the e2e canary scan reads a non-empty Engineer queue (SQR-04).
