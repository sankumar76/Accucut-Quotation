# Review Report — AQP-306 (STORY-02.07, customer half) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`: can lose data) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-306-delete-guard-2` (PR #388, the re-cut of #386 under DL-212) |
| Commit reviewed | 05c50f4 (base master 7d369e6) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS**. No Blocker, Critical or Major. Two cheap Minors (SQR-02, SQR-03) are worth fixing before the squash if convenient. If they are not fixed here, they go to the hardening window and are not waived. SQR-01 is a forward requirement for AQP-325 and AQP-329, not for this PR. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/388#pullrequestreview-5905072068 (COMMENT, 9 inline comments) |
| PR label | `review:quality-approved` |

## Summary
The customer delete is built correctly and is well tested.

- **Lock order.** The delete runs in this order:
  1. the Process Master table lock (PRF-01);
  2. the customer row `FOR UPDATE`;
  3. a plain read of the Draft and Submitted estimates, in a new READ COMMITTED snapshot;
  4. `UPDATE customers SET deleted_at`;
  5. one `master.deleted` row in the same transaction.

  The estimate writer (`setCustomer`) locks the estimate (`FOR UPDATE`), then the task (`FOR SHARE`), then the customer (`FOR SHARE ... deleted_at IS NULL`). The delete holds no estimate or task lock, and no estimate writer waits on `process_items`, so there is no cycle.
- **The race in both orders.** It is tested on PostgreSQL with a transaction held open and proof that the second request really waited on a lock (`pg_locks`).
- **Guard, soft delete and audit.** The tests would fail if the guard's status filter, the lock or the audit row broke.
- **AC-3 is absent, as intended.** There is no material route, button or manifest row.

The findings are four Minors and six Infos. The most important is SQR-01, a forward requirement. Unlock and Cancel approval move APPROVED back to DRAFT while locking only the estimate. Once they exist, they can produce an open estimate with a deleted customer and race this delete. Their stories (AQP-325, AQP-329) need an acceptance criterion for it.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get` and `get_files` (30 files); `get_file_contents` at 05c50f4 | Read in full: every changed file under `src/`, the integration, route and client tests, the E2E spec and the support changes. Also read at head: `customer-repository.ts`, `customer-service.ts`, `estimate-repository.ts`, `estimate-service.ts`, `calculation-service.ts`, `task-repository.ts`, `state-machine.ts`, `with-route.ts`, `materials/[id]/route.ts`, `treatment-delete-dialog.tsx`, and the route manifest |
| Context | Jira AQP-306 (ACs 1 to 8, A-1, the scrum-master clarification); PR body (Dev Record, A-2 to A-4, reviewer points, re-cut hunks); architecture §5.1 (A-13), §6 (Customers row), §8 audit notes; ux-spec SCR-12 and `screens/SCR-12.html`; `docs/06-reviews/AQP-302/combined.md`; Jira search for the Unlock and Cancel stories (AQP-325, AQP-329: Ready for Dev) | Read |
| Unit, integration, security, lint, `tsc`, build, E2E | CI run 43605905979 on 05c50f4 (`get_check_runs`) | 6 of 6 green: Stages 1 to 11, Stages 1 to 11b, E2E shards 1 to 4. **Not run locally**: worktrees are shared and the brief said not to run anything locally |
| Mutation reasoning | By reading the tests against the code | Removing the `FOR UPDATE` or moving the estimates read before it fails the AC-5 test "choice first" (the delete would succeed). Adding APPROVED to the filter fails the 12-estimate test (the total would be 13) and the AC-4 test. Dropping or duplicating the audit row fails the entry-count tests. Writing the audit row outside `tx` fails the late-failure test |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 soft delete; leaves the list and the options; one `master.deleted` in the same transaction; rate rows kept | `customer-service.ts` `remove`; `customer-repository.ts` `softDeleteCustomer`; `DELETE /api/v1/customers/[id]` (204) | Integration (`deleted_at`, 15 rate rows, list, options, 404 by ID, one entry, late failure); route test (204, no body, options as an Engineer); E2E | Met |
| AC-2 Draft or Submitted: 409 naming the estimates (first 10, then "and N more"); nothing changes | `findOpenEstimatesOfCustomer` (count over all, `LIMIT 10`); `MasterInUseError`; `problem.ts` `estimates` and `estimateTotal`; `MasterInUseDialog` | Integration (DRAFT, SUBMITTED, 12 estimates with an APPROVED one and another customer's, the estimate moved away); route test (409 body, 13 → 10 + 13); client test; E2E (one estimate) | Met. Fails open on a non-UUID: **SQR-02**. Render of "and N more": **SQR-09** |
| AC-3 material | Not in this PR (A-1) | n/a | Deliberately absent and verified: `materials/[id]/route.ts` exports PATCH only, the manifest row is `['PATCH']`, and nothing changed on the material list or service |
| AC-4 Approved only: allowed; the estimates keep their values | `status IN ('DRAFT','SUBMITTED')`; `findWorkspaceByCode` and the queue join customers with no deleted filter; calculation `master_snapshot` and resolved text are JSONB | Integration (delete allowed, `customer_id` kept, `getWorkspace` names it) | Met. Unlock or Cancel later: **SQR-01** (forward) |
| AC-5 the delete and a choice of the same customer serialise; never both succeed | Customer `FOR UPDATE`, then the read (delete); estimate, then task, then customer `FOR SHARE ... deleted_at IS NULL` (choice) | Integration, both orders with `createHoldingRunner` and a `pg_locks` wait proof; two deletes at once (one wins, one 404, one entry) | Met |
| AC-6 Lead 403, Engineer 403, signed out 401; manifest and role matrix | Manifest `['PATCH','DELETE']` ADMIN_ONLY; `withRoute` (origin, then session, then role, then params) | Route test; role matrix; strict schema; recipe with a disposable customer; E2E 401 | Met |
| AC-7 Delete in the sticky Actions column; refused-state texts; keyboard; axe; no horizontal scroll at 360, 768 and 1366 | `customer-list.tsx` (`actionButtons={2}`, table and cards); `master-delete-dialogs.tsx`; `customer-delete-dialogs.tsx`; `use-customer-delete.ts` (lazy, focus return) | E2E at three widths (axe, overflow, Escape, Keep, focus); `masters-table-actions.spec` | Met. Wording is A-4 and a title difference from the mock-up (**SQR-07**). Closable in flight: **SQR-03** |
| AC-8 name of a deleted record | Unique indexes not partial (A-2): the name stays taken | Integration (422 `NAME_TAKEN`, case-insensitive; another name is fine) | Met as worded (the AC names materials; the customer is tested). Usability: **SQR-04** |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Minor (forward; owner AQP-325 and AQP-329) | `src/server/services/customer-service.ts:263`; `src/lib/estimate/state-machine.ts` (UNLOCK and CANCEL: APPROVED → DRAFT); `estimate-service.ts` `applyTransition` | A-13; BR-053; AC-4 and AC-5 intent | The guard relies on Approved never becoming open again. Unlock and Cancel lock only the estimate row. (a) An Approved estimate whose customer was deleted becomes a DRAFT with a deleted customer. (b) A delete can read an estimate as APPROVED while an unlock commits it as DRAFT, and neither waits for the other | Not reachable today: there is no transition route yet. When it is, an open estimate holds a deleted customer. No data is lost (the name is shown through a LEFT JOIN and the snapshot is JSONB), but Calculate gives a 404 "The customer or the material was not found." with no clue why | In AQP-325 and AQP-329, under the estimate lock, read the customer with `FOR SHARE ... AND deleted_at IS NULL` (lock order: estimate, task, customer, so no cycle with this delete). If the customer is gone, either refuse with 409 `CUSTOMER_DELETED` or clear `customer_id`, bump `inputs_revision` and require a new choice. Calculate should give a specific 409. Do the same for materials with AC-3. Any future writer of `estimates.customer_id` goes through `findActiveCustomer`: the FK checks only that the row exists, not `deleted_at` | PostgreSQL test of unlock against delete in both orders (`createHoldingRunner`), and unlock of an estimate whose customer was deleted |
| SQR-02 | Minor | `src/server/repositories/customer-repository.ts:260` | Fail-safe guard; scrum-master note on A-1 ("never treat a missing table as unused") | `if (!isUuid(customerId)) return { total: 0, estimates: [] }`: an unexpected ID means "not in use, delete allowed" | Unreachable now (`before.id` comes from the database), but the material guard and later callers inherit a fail-open default on a data-loss path | Throw `new Error(...)` (a programming fault, so a 500) instead of returning 0. Same in the material repository | A repository call with `'not-an-id'` rejects |
| SQR-03 | Minor | `src/components/features/masters/master-delete-dialogs.tsx:134` (`onOpenChange`), `:114` (Keep) | UX correctness; the file's own comment ("closes when the server has answered") | Keep and Escape close the confirmation while the request is out. A late 409 then opens "cannot be deleted yet" uninvited. A late failure leaves `failed` set, so the next confirmation (maybe for another customer) opens with the red failure notice. A late 204 runs `forgetRow` and closes a confirmation opened since for another customer. Inherited from `TreatmentDeleteDialog` | A confusing state after a destructive action. No data is wrong (the server decides; the list is read again) | While `submitting`, ignore `onOpenChange(false)` and disable `AlertDialogCancel`, or ignore an outcome whose `target.id` is not the current target | Component test with a deferred `remove`: Escape keeps the dialog open; a late 409 shows the refusal once; no stale failure notice |
| SQR-04 | Minor (product decision) | `src/server/repositories/customer-repository.ts:29` (A-2) | AC-8; recoverability | The name of a deleted customer stays taken, and there is no restore. A customer deleted by mistake cannot be recreated under its name. The Admin gets 422 "name taken" for a customer they cannot see | Needs a database fix to recover; confusing message | PM or architect decides: a partial unique index (`WHERE deleted_at IS NULL`), or keep it and give the 422 its own words ("A deleted customer has this name. Choose another name."). Track the PR's follow-up as a GitHub issue; the same choice applies to materials | The AC-8 integration test flips or gains the message |
| SQR-05 | Info | `src/components/features/masters/master-delete-dialogs.tsx:132` | Reuse | `MasterDeleteDialog` is `TreatmentDeleteDialog` with the in-use path added, so the in-flight and failure logic exists twice | SQR-03 must be fixed in both | Hardening (optional): make `inUseCode` and `onBlocked` optional and make the Treatment dialog a wrapper | n/a |
| SQR-06 | Info | `src/lib/errors.ts:203` | NFR-002; architecture §5.1 (customers are Confidential) | The 409 `title` carries the customer's name. The PR says the body is "only a task code, a status and a count" | Acceptable: the route is Admin only, the Admin already sees the name, `withRoute` logs status and code only, and there is no contact detail or rate | Correct the PR wording. For materials the name is `material_in_drawing`, which is not a figure | Existing route test asserts the full body |
| SQR-07 | Info | `master-delete-dialogs.tsx:154` | ux-spec SCR-12 mock-up; A-4 | The mock-up shows code, task title and status; the build shows code and status (AC-2's wording) | Mock-up difference only | ux-expert rules on it with A-4 | n/a |
| SQR-08 | Info | `customer-service.ts:260`; `customer-repository.ts` comment on `createCustomerMethods` | Cross-reference to reviewer-performance and reviewer-standards | The delete takes the Process Master table lock (SHARE ROW EXCLUSIVE) though it writes no rate row. No deadlock (estimate writers only take ACCESS SHARE on `process_items`), but customer and Process Master changes queue behind a delete waiting on a customer row. The "nine customer methods" comment is stale (there are now eleven) | Negligible | Keep (PRF-01 consistency) or drop the lock for delete; fix the comment | n/a |
| SQR-09 | Info | `master-delete-dialogs.tsx:161` | AC-2 test adequacy | "and N more" and the plural lead are tested in the words and on the server, but no component or E2E test renders a refusal with more than ten estimates | A regression in the rendering would pass | One component test: 10 named and a total of 12 give 10 links, "and 2 more", and "12 open estimates use this customer:" | That test |
| SQR-10 | Info | n/a | Praise | Lock first, then a fresh-snapshot read; both race orders proven with a real lock wait; a late-failure audit test; canary absence checks for contact and rates; a disposable recipe customer so the security scan keeps its canary; AC-3 kept out cleanly | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| Locks and deadlock | Delete: `process_items` SHARE ROW EXCLUSIVE, then customer `FOR UPDATE`, then a plain read, then `UPDATE`, then the audit insert. `setCustomer`: estimate `FOR UPDATE`, task `FOR SHARE`, then customer `FOR SHARE`. Calculate: estimate lock, then plain reads. Assign and queue: no customer lock. No transaction holds a customer lock and then waits on `process_items`, an estimate or a task, so **no cycle**. The `setCustomer` FK check (`FOR KEY SHARE`) is already covered by its `FOR SHARE` |
| Race, both orders (AC-5) | Choice first: the delete waits, then its fresh snapshot sees the estimate and it answers 409. Delete first: the choice's `FOR SHARE` re-checks the new row version, fails `deleted_at IS NULL`, and answers 422; the estimate keeps no customer. Both are tested, plus two deletes at once |
| In-use query (AC-4) | `e.status IN ('DRAFT','SUBMITTED')`; APPROVED excluded and tested. APPROVED keeps `customer_id`; the name is shown through LEFT JOINs (workspace, queue); the calculation snapshot and resolved text are JSONB |
| Soft delete and read paths | `UPDATE deleted_at` only (no runtime DELETE grant). Filtered: `listCustomers`, `listCustomerOptions`, `findCustomer` (edit page, Calculate), `findCustomerForUpdate` (edit, reset, delete), `findActiveCustomer` (estimate choice: 422). Not filtered on purpose: `findWorkspaceByCode`, queue (names for existing estimates) |
| Name uniqueness (A-2, AC-8) | The indexes are not partial, so the name stays taken; tested. Usability: SQR-04 |
| Audit | One `master.deleted` row (`object_type` `customer`) with the same `tx`. None on 409, 404 or a late failure. `before` = name, contact **field names**, rates (as on create); `after` null. Phone canary absent; no secrets |
| 409 body (NFR-002) | `estimates[{code,status}]` (max 10), `estimateTotal`, and the name in `title` (SQR-06). No contact detail, no rate (asserted) |
| Access | Manifest `DELETE` ADMIN_ONLY; `withRoute` does the origin (CSRF) check, then session, then role before the ID is parsed; 403, 403, 401 tested; role matrix, strict schema and recipes green; `estimate-use` blocked for Engineer views |
| AC-3 not deletable | Verified: no material DELETE handler, manifest row, button or service method in the diff |
| Developer's flagged gap (Unlock to DRAFT) | SQR-01: Minor here (not reachable); owner AQP-325 (Unlock) and AQP-329 (Cancel approval), both Ready for Dev; same need for materials |

## Issues for other roles
- **scrum-master and product-owner:** add the SQR-01 AC to AQP-325 and AQP-329 (customer `FOR SHARE` under the estimate lock; refuse or clear a deleted customer; Calculate gives a specific 409; materials too). Consider a `follow-up` GitHub issue so it is tracked.
- **product-manager and solution-architect:** SQR-04 (a partial unique index or its own 422 words) for customers and materials.
- **ux-expert:** A-4 wording and SQR-07 (task title in the refusal list).
- **developer (optional before the squash):** SQR-02 and SQR-03. In the material PR, avoid the fail-open default.
- **orchestrator:** decide on SQR-02 and SQR-03, then squash. SQR-03 to SQR-09 otherwise go to the hardening window.
