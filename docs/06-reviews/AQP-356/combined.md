# Combined security-and-quality review: AQP-356 (STORY-01.09 "Admin hand-over")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/508 |
| Head reviewed | `7e87c21e58bd86f38c7ac46f6243103cbe220d33` on `feat/AQP-356-admin-handover` (base 230bd77). `master` has since moved to d12b6e0 (#504); the orchestrator updates the branch before the merge (SQR-07) |
| CI | Run 44374315334 on 7e87c21e: **all green** ("Stages 1 to 11", "Stages 1 to 11b", E2E shards 1 to 4) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`: a password step-up, and the one change that moves the single Admin role (FR-006, FR-004, FR-011; NFR-001, NFR-004, NFR-007; CONSTRAINT-04; architecture §5.1, §6 "Hand over Admin", §8) |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-18 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 2 · Info 6 |

## How I read it

- **The whole diff**, `git diff 230bd77...7e87c21e`: 35 files. I read every product file in full at the head:
  - Server: `admin-handover-service.ts`, the route, `schemas/users.ts` (`adminHandoverBodySchema` reuses `stepUpPasswordSchema`), `user-repository.ts` (`handOverAdmin`, and `findAccountForUpdate`, which it relies on), `user-service.ts` (the new edit guard, and `resetPassword`, which the developer flags), `audit-events.ts`, `composition.ts`, `route-manifest.ts`.
  - Client: `hand-over.ts`, `users-client.ts` (`handOverAdminRole`), `hand-over-dialog.tsx`, `hand-over-texts.ts`, `users-screen.tsx`, `users-dialogs.tsx`.
- **Callers, callees and guards:**
  - `resolve-session-user.ts`: the role, the active flag and `session_version` are read from `users` on **every** request, never from the cookie.
  - `with-route.ts`: the role check against the manifest.
  - Every writer of `users.role` or `users.is_active` in `src/` (grep): `UserRepository.update`, which only `UserService.update` calls, and the new `handOverAdmin`. Nothing else writes either column.
  - Every row lock on `users`: `findAccountForUpdate` (`FOR UPDATE`, user-service and hand-over), and `task-repository.ts:198` (the Engineer, `FOR SHARE`).
  - The FK `fk_audit_log_actor_id` (`20261106090000_audit_log/migration.sql:39`) and `uq_users_single_active_admin` (`20261104100000_users_and_login_throttles/migration.sql:50`).
- **Jira AQP-356:** AC-1 to AC-10, Dev Context, Testing notes and decision D-h. **Architecture v0.55** (records branch): §6 row line 953, §7 NFR-004 row line 1014, §8 "Row lock" line 1115, A-33 line 1942, and "First Admin" line 1062.
- **Tests I ran at the head** (read-only worktree `aqp-356`, `npx vitest run … --maxWorkers=1`). The files: `tests/unit/users` (incl. `admin-handover-service`, `hand-over`, `user-service-admin-guard`), `admin-handover-route`, `audit-events`, and `security/role-matrix`, `csrf`, `strict-schema`, `engineer-import-rule`, `engineer-refused-before-lookup`. **16 files, 2274 tests passed.** The worktree stayed clean.
- **Not run locally:** the PostgreSQL integration file `tests/integration/users/admin-handover.test.ts` (no database is running on this PC), Playwright and the build. For those I rely on CI run 44374315334 and on reading the tests line by line.

## Security and data-integrity scope: results

| # | Check | Result |
|---|---|---|
| 1 | **Step-up in the same request, before the lock, on its own throttle key** (AC-2, NFR-004) | **Verified.** `handOver` calls `verifyStepUp({ user: { id: context.actorId }, requestId }, password)` as its first statement (`admin-handover-service.ts:68`), before the self check and before `transactions.run`. The person is the session's (`route.ts`: `user.id`); the strict body is `{password}` only, so nothing can name whose password is checked. The step-up's own `stepup` throttle key is reused, apart from sign-in. Proven by: the unit test (`admin-handover-service.test.ts:76`, no transaction opened and no row read before the check); the route test (`:151`, five wrong, then 429 even with the right password; `:160`, a wrong password with an unknown ID is 422, not 404); and integration AC-2 (`:263`, the sign-in is not blocked) |
| 2 | **The password in no log, audit row, response or error** (AC-9) | **Verified.** The password is read in one call. The answer is 204 with `output: z.undefined()`. The audit shapes are strict (`adminState` = `{adminId, adminName}`), so a `password` key is refused. The dialog empties the field once the answer is in (`hand-over-dialog.tsx:112`). Proven by: the route test (`:260`, every response body and log call, after a good hand-over, a wrong password, a block and every refusal; `:279`, the step-up log has the person and the request ID only); integration (`:304` audit rows, `:453` errors); E2E (no response holds it) |
| 3 | **Atomic swap, never zero or two active Admins** (AC-3, AC-7, CONSTRAINT-04) | **Verified.** One transaction. `handOverAdmin` runs down first (`WHERE id = admin AND role = 'ADMIN' AND is_active`), then up (`WHERE id = target AND role <> 'ADMIN' AND is_active`), each with `session_version + 1`. A zero-row match returns false, and the service throws, so the transaction rolls back. The index sees one Admin before the first statement and one after the second; between them only this transaction sees zero, and READ COMMITTED readers see the committed state. Proven by integration: `:213` (a second connection samples the count throughout 12 swaps; only `1` is ever seen) and `:241` (up-before-down by direct SQL fails on the index) |
| 4 | **Lock order and deadlock risk** | **Ascending ID order verified; one gap: SQR-02.** Both rows are locked `FOR UPDATE`, lower ID first, whoever is the caller (`:76-78`). `inAscendingOrder` compares lower-case UUID text, which sorts like PostgreSQL's `uuid` (byte order). Two hand-overs, or a hand-over and an edit that arrives later, queue without a cycle (integration `:347`, `:372`, `:385`). **But** the rule "ascending ID order" does not cover the implicit lock that every audit insert takes on its actor's `users` row (the FK check's `FOR KEY SHARE`, which `FOR UPDATE` blocks). So an Admin's edit or reset of the target, already holding the target's row when the hand-over starts, deadlocks with it whenever the Admin's ID sorts lower (SQR-02). PostgreSQL breaks the cycle, and one of the two is rolled back whole: no data harm |
| 5 | **Sessions of both people end** (AC-3) | **Verified.** Both `session_version`s are raised in the swap statements. Every request re-reads the account (`resolveSession`), so the old Admin's cookie is refused at their next request. Integration `:174` proves that the old claims resolve to `null`, that re-sign-in gives a Lead, and that the new Admin signs in and resolves as Admin. No password and no `must_change_password` is touched (`:143` unit, `:174` integration) |
| 6 | **Admin only** (AC-6, NFR-001) | **Verified.** The manifest row is `ADMIN_ONLY` (`route-manifest.ts:147`), with `spec-access`, `role-matrix`, `csrf`, `strict-schema` and `engineer-refused-before-lookup` rows. The recipe uses an unknown ID, so no scan ever moves the role. `withRoute` gives Lead and Engineer 403 before the ID or password is looked at, and a signed-out caller 401 (route test `:237`, `:250`; E2E AC-6). In the service, the locked row is re-checked: not the active Admin gives 403 (`:84`) |
| 7 | **Exactly one hand-over under concurrency; rollback on a late failure** (AC-7, AC-8) | **Verified.** Integration `:347` holds the first hand-over open (`createHoldingRunner`) until `pg_locks` shows the second waiting, then the second is 403 (one swap, one entry). `:372` runs four at once: exactly one wins and the rest are 403. `:429` injects a fault after the last step, and `:443` a refused audit entry: roles, both session counters and the log are unchanged, and the same hand-over then works |
| 8 | **One audit entry, in the transaction** (AC-4, FR-011, D-h) | **Verified.** `user.admin_handed_over` is wired with strict before/after; the actor is the old Admin and the object the new one; there is no `user.role_changed` (integration `:273`). The entry is written in the swap's `tx`, so a failed transaction leaves none. `audit-database.test.ts` points at the integration file |
| 9 | **Refusal order** (AC-5) | **Verified.** 401, 403 (`withRoute`), 422 (ID, body), step-up 422/429, 409 `CANNOT_HAND_OVER_TO_SELF` (case-insensitive), then under the locks 403, 404 and 409 `HAND_OVER_TARGET_INACTIVE`. Every refusal leaves `storedWorld` and the entry count unchanged (integration `:318-344`) |
| 10 | **NFR-002** | **Holds.** `admin-handover-service` is classified in `engineer-import-rule.test.ts`. The route answers nothing. An Engineer who becomes Admin (D-h) sees costs only after signing in again, because their sessions end with the swap |

## The three points the developer raised

### (1) The edit guard in `UserService.update`: correct and complete

`user-service.ts:162`: under the target's row lock, an edit that would leave the **active Admin** not an active Admin is refused with 409 `ADMIN_CANNOT_BE_REMOVED`.

- **Needed.** Without it, a stale request of the old Admin (it passed `withRoute` before the hand-over committed, then waited on the row lock) would run after the commit on the **new** Admin. It would deactivate or demote them and leave **zero** Admins. The index only forbids two. Such an outcome has no serial order that explains it: had the edit run first, the hand-over would have refused an inactive target. So a guard is the right fix, not just tidiness.
- **Correct.** The check reads the **locked** row (`target`), so it sees the committed hand-over. It sits after the own-account rules, so the Admin's own edits keep their codes (`CANNOT_CHANGE_OWN_ROLE`, `CANNOT_DEACTIVATE_OWN_ACCOUNT`). A rename of the Admin is still allowed.
- **Behaviour-preserving.** Before this story only the Admin could call `update`, and could not edit themself, so no real request could reach the new branch.
- **Complete.** `UserRepository.update` (via `UserService.update`) and `handOverAdmin` are the only writers of `role` and `is_active` in `src/`. The other direction (a stale edit that makes someone else Admin, or activates an old Admin) is the one-Admin rule's, through the check and the index (integration `:407`).
- **Proven** against PostgreSQL with a real overlap: integration `:385`, both edits wait in `pg_locks`, then 409, and the new Admin is intact. The unit cases are `user-service-admin-guard.test.ts`.

### (2) The `resetPassword` window: Minor, follow-up (SQR-01)

**Can the old Admin still act as Admin after the hand-over?**

- **With their session: no.** `session_version` is raised in the swap. The role, the active flag and the version are re-read on every request, so the next request with the old cookie is refused, and signing in again gives a Lead.
- **With a request already in flight: yes, for one request.** Any Admin-only request that passed `withRoute` before the commit finishes with the authority it had when it started. `resetPassword` widens the window: it hashes for about 350 ms **before** its transaction, and under the lock it re-checks neither the caller's role nor the target's. So an in-flight reset of the new Admin's password lands after the hand-over. It sets a temporary password the old Admin knows, ends the new Admin's sessions, sets `must_change_password` and clears their throttles.

**Why Minor, not Critical or Major.** For every Admin-only action except the edit fixed in (1), an in-flight request has the same effect as if it had arrived a moment **before** the hand-over, which the old Admin was allowed to do:

- A reset of X's password, then a hand-over to X, is a legitimate sequence that ends in exactly the same state: X is the Admin with a temporary password the old Admin knows.
- So the race gives the old Admin no capability they did not already have. The single-Admin rule still holds, and the audit log records the reset, by the old Admin, after the hand-over entry.
- A stolen session cannot use the window on its own, because the hand-over itself needs the Admin's password.
- What the race does produce is an odd record: a password reset of the Admin, by someone who was a Lead when it committed. The real effect is a lock-out of the new Admin, recoverable only through the old Admin or an operator.

That is worth closing, but it is not a merge blocker under §9.

**A cheaper fix than the developer's "role re-check in every Admin-only service":** mirror the edit guard in `resetPassword`. Under the lock, refuse when the target is the active Admin, with 409 and a new code such as `ADMIN_PASSWORD_NOT_RESET_HERE`. The Admin's own password is changed on the account page (STORY-01.05), and the own-reset is already refused. So before the hand-over nobody could ever reset the active Admin's password, and the guard is behaviour-preserving. It is about four lines plus an overlap test copied from integration `:385`. The general re-check stays a design question for the end review: every other Admin-only action can be ordered before the hand-over, as above.

**Follow-up issue: #509** (with SQR-02). The developer may fold the four-line guard into this PR if they wish; it is not a condition of merge.

### (3) The evidence: sufficient

The commit path is proven where it can be proven honestly, against real PostgreSQL:

- the swap, and the order down-then-up (by direct SQL);
- the sessions, through `resolveSessionUser`, the function `withRoute` uses;
- the one entry;
- a sampled "never 0 or 2";
- the lock wait seen in `pg_locks`;
- four at once;
- two late failures.

The real server is driven by E2E for every refusal, including a real 409 **after** the password passed, which proves the route, the composition and the step-up are wired. The one 204 is stubbed, so the browser's move to sign-in is proven but not a real commit through HTTP. Committing a hand-over in the shared E2E world would make the shared Admin a Lead under four workers, so the developer's reason holds. The residual gap is small (SQR-05). It suits the end-of-project full review: one serial E2E project with its own throwaway Admin, or a manual check in QA's regression.

**#502** (re-registering the Windows JEA endpoint at a hand-over) is rightly out of scope. Nothing in this PR touches it, and the issue stays open with the architect.

## AC conformance

| AC | Code | Test(s) | Result |
|---|---|---|---|
| AC-1 Dialog: other active people of any role, never self or deactivated; warning; password hint; cancel safe | `hand-over-dialog.tsx`, `hand-over-texts.ts` (hint word for word), `handOverCandidates`, `users-screen.tsx` | `unit/users/hand-over.test.ts`; E2E "AC-1, AC-10" at 3 widths | **Met** (words other than the hint go to the ux-expert, SQR-04) |
| AC-2 `verifyStepUp` in the request, before the transaction, own key; 422 / 429; nothing changes; choice kept | service `:68`; dialog keeps `chosenId` on 422/429 | unit `:76`, `:88`; route `:142`, `:151`, `:160`; integration `:253`, `:263`; E2E "AC-2" | **Met** (the 422 title is the shared step-up sentence and the dialog adds "Try again.", SQR-04) |
| AC-3 One transaction, ascending locks, down then up, exactly one Admin, both sessions end, 204, browser to sign-in | service, `handOverAdmin`, route, `goToSignIn` | unit `:108-143`; route AC-3; integration `:174-249`; E2E AC-3 (204 stubbed) | **Met** (deadlock gap: SQR-02) |
| AC-4 One `user.admin_handed_over` entry, same transaction, both people, no secret, SCR-16 words; registry `wired` | `audit-events.ts`, service | unit `:151-185`; route `:127`; integration `:273-316`; `audit-events.test.ts` | **Met** |
| AC-5 409 self, 409 inactive, 404, 422; lower case and case-insensitive; order 401, 403, 422, step-up, lookups | route schema, service | unit `:188-250`; route `:166-233`; integration `:318-344`; E2E AC-5 | **Met** |
| AC-6 Lead 403, Engineer 403, signed out 401, before reading; manifest Admin only; role matrix 0 differences | manifest row, `withRoute` | route `:237`, `:250`; security suite; E2E AC-6 | **Met** |
| AC-7 Never more than one Admin; second request refused; nothing half done; direct-SQL check holds | locks, re-check under lock, edit guard | integration `:347`, `:372`, `:385`, `:407`, `:241` | **Met** (stale reset: SQR-01, not an AC-7 breach: the Admin count never leaves 1) |
| AC-8 Fault after the first change: both roles, no entry, no session change | one transaction | integration `:429`, `:443`; unit `:175`, `:244` | **Met** |
| AC-9 No password or hash anywhere; a refusal logs the person and request ID only | see check 2 | route `:260`, `:279`; integration `:304`, `:453`; unit `:253` | **Met** |
| AC-10 360/768/1366, keyboard, focus trap and return, errors announced, axe 0 | AlertDialog, `FormField`, `PasswordInput` | E2E "AC-1, AC-10" and "AC-2" at 3 widths, CI green | **Met** |

## Findings

| ID | Severity | Where | Issue and why | Fix |
|---|---|---|---|---|
| SQR-01 | **Minor** | `src/server/services/user-service.ts:190-216` (`resetPassword`: the hash at `:202` is outside the transaction; under the lock at `:204` no check of the target's role) | **A request of the old Admin that was in flight at the hand-over resets the new Admin's password after it** (developer's point 2; analysis above). The single-Admin rule holds, and the old Admin gains nothing they could not have done a moment before (reset X, then hand over to X). But the record shows a Lead resetting the Admin, and the new Admin is locked out until someone gives them the temporary password. **Why:** an authority checked at the start of a request is used after the role moved; the 350 ms hash widens the window. | In the transaction, after `findAccountForUpdate`: `if (target.role === 'ADMIN' && target.isActive) throw new ConflictError(…, { code: 'ADMIN_PASSWORD_NOT_RESET_HERE' })`. This is behaviour-preserving: only the Admin could reset, and their own reset is already refused. **Test:** copy integration `:385`. Hold a hand-over open, start `userService.resetPassword(by(admin), lead.id, …)`, wait in `pg_locks`, release, then expect 409, the new Admin's hash unchanged and no `user.password_reset` entry. **Follow-up #509.** |
| SQR-02 | **Minor** | `src/server/services/admin-handover-service.ts:76-78` with `user-repository.ts:223` (`FOR UPDATE`); the claim at `admin-handover-service.ts:25-26` ("never wait on each other in a circle"); architecture §8 line 1115 | **The ascending-ID rule does not prevent every deadlock.** Every audit insert takes `FOR KEY SHARE` on its actor's `users` row (the FK check of `fk_audit_log_actor_id`), and `FOR UPDATE` blocks that. Take the Admin A, with A's ID lower than X's. A's edit, reset or task assignment of X has locked X and not yet written its entry when A's hand-over to X starts. The hand-over locks A, then waits for X. The edit's audit insert waits for A. PostgreSQL detects the cycle after `deadlock_timeout` (1 s) and aborts one of them with 40P01, a 500, rolled back whole. **Why:** rare and self-inflicted (the one Admin, two requests about the same person within milliseconds), with no data harm. But a step-up action then fails with a generic error, and the code comment and the architecture promise more than holds. Reasoned from PostgreSQL's FK locking; **not reproduced** (no local database). | Lock both rows with **`FOR NO KEY UPDATE`**, which still serialises every writer and reader `FOR SHARE` but lets FK checks through. Do it in the hand-over, or in `findAccountForUpdate` for every caller, since nothing ever changes `users.id`. Correct the comment. **Test:** on the owner connection, `BEGIN; SELECT … FROM users WHERE id = X FOR UPDATE`, with X chosen above A. Start the hand-over A to X and wait in `pg_locks`. Then `INSERT INTO audit_log (…actor_id = A…)` on the owner connection: today it deadlocks, and after the fix it inserts, the owner commits and the hand-over lands. **Follow-up #509.** **solution-architect:** add the FK caveat to §8 "Row lock" (SQR-03). |
| SQR-03 | Info | Architecture §8 line 1115; §7 NFR-004 row line 1014; §6 row line 953; A-33 | **The architecture text lags the build.** §8 says ascending order means "two changes cannot deadlock": true for explicit locks only (SQR-02). NFR-004 says the hand-over calls the check in `user-service`; it is `admin-handover-service.ts` (decision 1 of the Dev Record, which the story allows). §6 lists 403, 409 and 422; the route also answers 401, 404, 429 `STEP_UP_LOCKED`, and the 409 codes `CANNOT_HAND_OVER_TO_SELF` and `HAND_OVER_TARGET_INACTIVE`. The edit guard adds 409 `ADMIN_CANNOT_BE_REMOVED` to PATCH `/users/{id}`. | **solution-architect:** update the four places; and say whether `FOR NO KEY UPDATE` becomes the rule for audited changes of a referenced row. |
| SQR-04 | Info | `src/lib/users/hand-over.ts:25`; `hand-over-texts.ts`; `audit-events.ts` `describe` | **Words.** AC-2 gives the 422 as "That password is not correct. Try again."; the server's title stays the shared step-up sentence (no "Try again."), and the dialog shows the AC's sentence under the field (Dev Record decision 5). This is right: changing the shared sentence would change four other actions. The title, warning, "New Admin", "Hand over", the 409 sentences and "Admin was … / Admin is now …" are the developer's proposal, as AC-1 and AC-4 allow. | **ux-expert:** rule on the proposed words at the end review. **product-owner:** note AC-2's sentence as the dialog's. |
| SQR-05 | Info | `tests/e2e/admin-handover.spec.ts:244` (the 204 stubbed) | **No test commits a hand-over over HTTP.** That would show the old cookie refused at its next request and the new Admin reaching an Admin route after signing in again. The integration test proves both through `resolveSessionUser`, which `withRoute` uses, so the gap is the wiring of one success path. The reason (the shared E2E Admin) is sound. | **qa-engineer**, at the end-of-project regression: one serial E2E project with its own throwaway Admin and target, or a manual check. Not a merge condition. |
| SQR-06 | Info | the other Admin-only services (every route with `ADMIN_ONLY`) | **The general window.** Any Admin-only request in flight at the hand-over finishes with the old authority. For every one of them except the edit (fixed) and the reset (SQR-01), the outcome is the same as if it had run just before the hand-over, which the old Admin was allowed to do. A general "re-check the caller's role under lock" would touch every service for no change in what can happen. | none now; recorded in #509 for the end review to confirm. |
| SQR-07 | Info | branch versus `master` | **The merged result has not been through CI.** `master` is at d12b6e0 (#504); this head is based on 230bd77. | **orchestrator:** update the branch and merge only on a green run of the updated head. |
| SQR-08 | Info (praise) | whole change | **A careful change of the most sensitive row in the portal.** The step-up comes first, and the person is the session's. Down-then-up is backed by the index, and both statements match only the locked state. There is a re-check under the lock, one transaction with one entry, and real overlap tests seen in `pg_locks` and in a sampling watcher. The developer found the zero-Admin race that the hand-over newly creates and closed it with a behaviour-preserving guard, and flagged the remaining window honestly instead of hiding it. | none |

## Test run

`npx vitest run tests/unit/users tests/unit/admin-handover-route.test.ts tests/unit/audit-events.test.ts tests/security/{role-matrix,csrf,strict-schema,engineer-import-rule,engineer-refused-before-lookup}.test.ts --maxWorkers=1` at 7e87c21e: **16 files, 2274 tests passed** (262 s). `git status` in the worktree was clean afterwards. The integration and E2E files are green in CI run 44374315334.

## Verdict

**APPROVE WITH COMMENTS.** There are no Blocker, Critical or Major findings, and all ten ACs are met.

- **Step-up:** in the same request, before the transaction and its locks, on its own key. The password is in no log, audit row, response or error.
- **The swap:** atomic, down then up under the index. No other session ever sees zero or two Admins, and both sessions end.
- **Authorisation:** Admin only at the manifest, with a re-check on the locked row in the service.
- **Concurrency and rollback:** exactly one hand-over under concurrency, and nothing kept after a late failure.
- **The edit guard (point 1):** correct, complete and needed.
- **The reset window (point 2):** Minor. It goes to follow-up #509 with a four-line, behaviour-preserving fix. The new deadlock note (SQR-02) goes there too.
- **The evidence (point 3):** sufficient.
- **Before the merge:** the updated head must be green (SQR-07).
