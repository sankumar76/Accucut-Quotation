# ADR-018: A validated batch append for the audit log (`AuditService.recordMany`)

| Field | Value |
|-------|-------|
| Status | Accepted (2026-11-21, solution-architect, hardening window, CLAUDE.md section 9 item 3; for `master` to log) |
| Date | 2026-11-21 |
| Deciders | solution-architect |
| Related | NFR-010 (500 ms per save), NFR-011 (500 customers), NFR-007 (audit log), FR-014, FR-011; STORY-02.08 (AQP-365) AC-9; ADR-010; architecture section 6 "The two checks as built" (AQP-237) and section 8 "Customers" (ruling v0.56, AQP-365 OQ-2); GitHub [#568](https://github.com/sankumar76/Accucut-Quotation/issues/568) (AQP-365 SQR-01, final performance review PRF-F-05); DL-276, DL-283 |

## Context

STORY-02.08 propagates a changed Process Master default to the customers in two steps. Each step runs in one transaction, which takes the Process Master table lock first. The two steps are the save (`masters-service.ts:344`) and Save choices (`default-propagation-service.ts:151`).

Each step writes one `master.edited` audit entry per customer whose rate changed. It does so through `audit.record` in a loop, which is one `INSERT` per entry. The v0.56 ruling (AQP-365 OQ-2) chose the loop and estimated 0.3 to 0.6 s at 500 customers. That ruling also named the remedy if the story's measurement was over 500 ms: a validated batch append (`recordMany`), with the section 6 static checks extended to see it.

**Measured** (`tests/integration/masters/process-propagation-volume.test.ts`, local Docker, AQP-365 combined review SQR-01): **1.5 to 1.8 s** at 500 customers, about 3 ms per entry, for each step. The table lock is held throughout. That is over the 500 ms trigger and over NFR-010's 500 ms per save. While the lock is held, every customer save and every rate change waits behind it.

There is no data risk. A very large count reaches the 10 s `statement_timeout` and rolls back whole.

**What the code allows** (`master` 0f69aa20):
- `AuditService.record` (`audit-service.ts`) checks one entry: the event, the object type, the label lengths, the zod `before` and `after` shapes, and the secret scan. It then calls `AuditRepository.append`, a Prisma `create`.
- The static check (`tests/support/audit-transaction-check.ts`) recognises a write by the member name `record` (`AUDIT_RECORD_METHOD`) on a receiver typed `AuditService`.
- `tests/security/config-history-confidentiality.test.ts:118` pins the service's keys as `['list', 'record']`.
- `audit_log.id` is a random UUID. `created_at` is `clock_timestamp()` cut to milliseconds. The list reads in `(created_at DESC, id DESC)` order.

## Decision Drivers

- **NFR-010.** A save answers in 500 ms; the propagation save is a save.
- **The lock.** Each step must hold the Process Master lock as briefly as possible (PRF-01), because every customer save serialises behind it.
- **NFR-007 and STORY-01.07.** Every entry is validated, nothing unvalidated reaches the append-only table, and every entry commits or rolls back with its change.
- **The guards keep their reach** (the AQP-328 rule): a write must not pass a static check only because it moved out of what the check scans.
- **Small and late.** It is a hardening fix in the last week before G8.

## Considered Options

### Option A: `AuditService.recordMany`, a validated batch through the service, with the static check extended (chosen)

- Pros:
  - Every entry is checked by the same code as `record`.
  - One `INSERT` per 1,000 entries, so one at 500 customers. The cost is about one round trip, not 500.
  - The static check sees it as it sees `record`.
  - The two loop sites change by one line each.
- Cons:
  - One more method on the service.
  - The check, its case files and one security pin change.
  - Entries of one batch can share a millisecond (see Decision 4).
- Cost / effort: about 3 to 4 hours, with the tests.

### Option B: one batched INSERT written in the audit repository and called from the propagation code

This is the performance reviewer's "cheaper alternative".

- Pros: the same single statement as A.
- Cons:
  - Called from the propagation code, the repository write leaves the service, which holds the only validation.
  - It would either duplicate the checks or skip them.
  - It would also leave the static check's reach: the check looks for `AuditService` writes, so an unchecked transaction would pass it. This is the AQP-328 "moved out of the scan set" case.
- **Merged into A:** the batched INSERT is exactly A's repository half. What B adds, a path that goes round the service, is rejected.
- Cost / effort: about the same as A, with the validation gap.

### Option C: an NFR-010 exception for propagation saves (product-manager)

- Pros: no code change.
- Cons:
  - It keeps a 1.5 to 1.8 s table lock that blocks every customer save at the planning volume, and it grows linearly with the customers.
  - The fix is small and was named in advance.
  - A scope exception is the wrong tool for a known, cheap fix.
- Cost / effort: a PRD change and a delivery-lead decision.

## Decision

Option A.

1. **`AuditService.recordMany(tx, entries)`** takes a read-only array of entries, each of any event the registry knows (`AuditEntryInput<AuditEventName>`).
   - **One check for both methods.** The body of today's `record`, up to the row it builds, moves into one internal function, `checkedRow(entry): NewAuditRow`, used by both `record` and `recordMany`. The two cannot drift.
   - **All checked before anything is written.** If any entry is refused, `AuditEntryRefusedError` is thrown, nothing is appended, and the caller's change rolls back with it, as with `record`.
   - **An empty array writes nothing and sends no query.**
   - **The caller's transaction is required**, as for `record`.
2. **`AuditRepository.appendMany(rows, tx)`** is one multi-row `INSERT INTO audit_log (actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id) VALUES …`, in the caller's transaction.
   - It is a tagged template with `Prisma.join`, raw SQL in the repository only (section 10). JSON columns are cast `::jsonb`, and `id` and `created_at` take their defaults.
   - It sends **at most 1,000 rows per statement** (9,000 bind parameters, well under PostgreSQL's 65,535). Larger arrays go in consecutive statements of the same transaction.
   - `append` stays as it is.
3. **Where it is used.**
   - The two propagation sites, `masters-service.ts:344` and `default-propagation-service.ts:151`, change from the loop to `await audit.recordMany(tx, customerRateEntries(...))`.
   - The rate's own entry stays a separate `record`, written first.
   - No other call site changes. From now on, a write of a variable number of entries that can exceed about 50 uses `recordMany`. A fixed one or two stays `record`.
4. **Order.** Write order is kept: the rate's entry is written before the batch, and the batch rows go in array order. Rows of one statement can share a `created_at` millisecond, and the list then orders them by `id`, which is random. This was always true of any two entries in the same millisecond, and the cursor stays correct because `id` is unique. Entries of one step share their `request_id`, which is how a reader groups them. **No test may assert the display order of entries inside one request.** A test asserts the set of entries with that `request_id` instead.
5. **The static check (section 6) is extended in the same pull request.**
   - `tests/support/audit-transaction-check.ts`: `AUDIT_RECORD_METHOD` becomes a set, `AUDIT_WRITE_METHODS = new Set(['record', 'recordMany'])`. Every rule applies to both names unchanged: transaction ownership along the chain, awaited, returned or an arrow body, `MAX_HELPER_STEPS` = 3, and the refused forms (`.call`, `.bind`, an `any` receiver).
   - The cases files gain one passing case (`recordMany` in a `.run(` callback). They gain two failing cases: `recordMany` with a handle the function does not own, and a `recordMany` that is not awaited.
   - The AC-4 count pin ("at least 15") counts `record` and `recordMany` together.
   - `tests/security/config-history-confidentiality.test.ts:118` expects `['list', 'record', 'recordMany']`.
6. **The target.**
   - **Each step at 500 customers in 500 ms or less, measured as the median of 5 runs of the volume test on the developer's machine, and reported in the pull request.**
   - Per DL-057, it is reported and not asserted; the test keeps its 30 s absurd-time line.
   - **Asserted, and independent of the machine:** a propagation step makes exactly **one** call to `appendMany` for up to 1,000 changed customers, and no `append` call for the customer entries. This is a unit test with a recording repository.
   - If the median is still over 500 ms, the developer reports the split (the update, the entries, the rest) to the architect before the merge. The next step is then the update's statement, or option C. Neither is pre-approved.

## Consequences

- Positive:
  - At 500 customers, about 500 round trips become one, which is expected to bring each step from 1.5 to 1.8 s to well under 0.5 s and cut the lock time by the same amount.
  - No entry escapes validation, and the guard keeps its reach.
- Negative / trade-offs accepted:
  - A second write method on the audit service.
  - Entries of one request may share a millisecond.
  - Three test-support files and one pin change.
- Follow-up actions (with owners):
  1. Developer, on #568, in lane 1 after DEF-055 (DL-276 ruling 5): Decisions 1 to 5, with these tests.
     - **Unit tests:** `recordMany` refuses a batch whose second entry has a bad `after` and appends nothing. An empty array sends no query. A secret in one entry refuses the batch. The single `appendMany` call per step.
     - **Integration tests:** 500 entries written with one `request_id` and the correct set of objects; a refused entry rolls back the rate change; 1,001 rows written in two statements, all present.
     - **The static check's new cases**, plus the volume test's median of 5 in the pull request.
  2. The other SQR items of #568 (SQR-02 to SQR-04) are Minor and may ride along. SQR-02, "before" from `RETURNING`, is recommended, since the same lines change.
  3. reviewer-performance may re-grade PRF-F-05 on the pull request's figure.

## Verification

- The volume test's median of 5 for each step is 500 ms or less at 500 customers, recorded in the pull request.
- The unit test pins one `appendMany` call per step.
- The static check passes with `recordMany` at both sites, and fails on its new failing cases.
- The full regression stays green.
- The Audit screen shows the propagation's entries for one request.
- Review date: at G8, with #568.
