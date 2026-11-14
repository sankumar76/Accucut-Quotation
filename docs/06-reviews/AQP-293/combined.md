# Review Report — AQP-293 (STORY-03.05) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-293-calculation-record` (PR #380) |
| Commit reviewed | 562ec89 (on master 8d32a87) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker or Critical; one Major goes to 05.09 or the hardening window under §9 item 3, and is not waived) |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/380#pullrequestreview-5904330921 |

## Summary
The calculation record is safe to merge. Immutability has three layers: the runtime role holds only SELECT and INSERT (column grants are checked too); row and TRUNCATE triggers refuse every role, the owner included; and the repository has no update or delete method. The store is atomic: lock, checks, record, chunked rows and link run in one transaction, which PostgreSQL rolls back whole when the link fails after the rows are written. The `inputs_revision` check runs under the estimate row lock that every estimate writer takes, so it adds no new deadlock cycle. `linkCalculation` cannot link another estimate's calculation. E and F always come from the Material Master. No Engineer-reachable path can import the Restricted tables. Error texts hold no figure.

The one Major is about availability, not integrity. The master and configuration reads run on the plain pool, outside the transaction, while it holds the estimate lock. Under concurrent Calculates this can starve the app pool of 10 connections. The Minor findings are a vacuous unit test for the caller's-transaction path, an empty tree being accepted, database-level ownership of `current_calculation_id`, the scope of the rates in the snapshot (A-2), and no tree-consistency check.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 5 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `git diff 8d32a87 562ec89` (20 files), plus callers and callees: `transaction.ts`, `prisma-client.ts` (pool settings), `estimate-service.ts` (05.01 lock pattern), `master-repository.ts`, `customer-repository.ts`, `exchange-rate-repository.ts`, `row-outputs.ts`, `product-totals.ts`, `decimal.ts`, `eslint.config.mjs`, `prisma/seed/config/seed-config.ts` (E, F, G definitions) | Read in full |
| Context | Jira AQP-293 (ACs, Dev Context); architecture 4.2 (Calculate flow), 4.4, 4.8 (figure state, rate-diff), 5.1 (tables, departures, guards, treatments), TB-2; coding standards "SQL" | Read |
| Targeted unit tests | `npx vitest run tests/unit/calculation-record.test.ts tests/unit/estimate/figure-state.test.ts tests/unit/calculation-service.test.ts` on a scratch worktree at 562ec89 | 3 files, 101 tests passed |
| Mutation probes (scratch worktree, each restored) | P1: drop the `checkTexts` call. P3: drop the duplicate-node check. P6: ignore the caller's `tx` and always open a transaction. P7: `run` re-reads `currentConfiguration()` | P1 caught (7 failing), P3 caught (1). **P6 survived** (SQR-02). **P7 survived** (SQR-08) |
| Integration (PostgreSQL), `tsc`, build, E2E | CI run 43593337491 | 6/6 green (attempt 2; attempt 1 had a flaky failure in `tests/integration/auth/account-password.test.ts`, which this PR does not touch). Not run locally (no PostgreSQL, under 1 GB free memory) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| SQR-01 | Major | `src/server/services/calculation-service.ts:325-327` (reads at 174-200) | AC-1, architecture 4.2, NFR-010/011 | While `store` holds the estimate row lock and one pooled connection, it reads the configuration and every master on the plain client: `findCustomer`, `readExchangeRates` and one `findMaterialForCalculation` per distinct material, all at once through `Promise.all`. None of them takes `tx`. This breaks the 05.01 pattern (`findActiveCustomer(id, tx)`) and the 4.2 flow (reads inside the transaction). | App pool `max: 10`, with 25 concurrent users planned. Ten Calculates at the same moment each hold their transaction connection and wait for another one, so all fail after 5 s with `DatabaseBusyError` (503). Below that point, each Calculate needs 1 + N connections. No data loss: each failure rolls back. Calculate becomes unavailable under load. 05.09 calls the service inside its own transaction, so the problem reaches the real route. | Add `tx?` to the three master reads (better: one `findMaterialsForCalculation(ids, tx)` with `WHERE id = ANY(...)`) and to the configuration read, and pass `tx` from `store`. Test: 11 parallel stores with a pool of 10 all succeed. Fix in 05.09 at the latest. Cross-reference: reviewer-performance. |
| SQR-02 | Minor | `tests/unit/calculation-record.test.ts:219-242` | AC-1 (test adequacy) | "Opens none of its own" counts only the outer callback, and the fake runner's rollback hides nesting. Probe P6 (always open a transaction) kept all 42 tests green. No integration test passes `tx`. | The 05.09 path is untested. On PostgreSQL a nested `$transaction` would wait on its own outer lock until the 10 s timeout, or commit apart from the caller's transaction. | Use a spy that counts every `run` call (expect exactly 1). Add an integration case: store inside `db.transactions.run`, then throw, and expect nothing stored. |
| SQR-03 | Minor | `src/server/services/calculation-service.ts:230` | AC-1 ("an estimate with nodes") | `nodes: []` is accepted. The service stores an immutable record with no rows and BL `0`, and moves DRAFT to SUBMITTED. | A permanent empty record and a Submitted estimate showing 0, if 05.09's validation ever misses it. | `.min(1)` → 422 under `nodes`. Test: nothing locked, nothing stored. |
| SQR-04 | Minor | `prisma/migrations/20261114120000_calculations/migration.sql:61` | ADR-007, NFR-026, defence in depth | The FK proves only that the calculation exists. That it belongs to the same estimate is enforced only by `linkCalculation`'s `EXISTS` guard. The runtime role has UPDATE on `estimates`. | A future writer could point an estimate at another estimate's Restricted figures. No such writer exists today. | New migration: `UNIQUE (estimate_id, id)` on `calculations`, and a composite FK `(id, current_calculation_id) → calculations (estimate_id, id)` (MATCH SIMPLE skips NULL). |
| SQR-05 | Minor | `src/server/services/calculation-service.ts:195` | A-2; Dev Context ("only the entries that calculation used"); architecture 4.8 rate-diff | The snapshot keeps every rate of the customer. | 06.11's "rates changed" notice would also count Process Master items that no formula reads, and ask for a needless Recalculate. | Keep only the rates the compiled plan references, or record A-2 as a decision and have 06.11 filter by the plan. Product-owner to confirm. |
| SQR-06 | Minor | `src/server/services/calculation-service.ts:250-259` | AC-1 (full copy of the tree) | Only duplicate node IDs are refused. A `parentId` outside the set, a cycle, or two siblings with the same `sortIndex` are accepted. | A record whose tree cannot be rebuilt (`CalculationRecord.rows` relies on `parentId` and `sortIndex`), and it can never be corrected. Only a caller bug can cause it. | Check that every `parentId` is among the `nodeId`s, that `(parentId, sortIndex)` is unique, and that there are no cycles. 422 under the field. |
| SQR-07 | Info | `tests/integration/config/immutability.test.ts:258`; `tests/integration/calc/immutability.test.ts:99`; `tests/acceptance/aqp-97-config-versions.test.ts:158` | AQP-97 AC-6 (regression) | The TRUNCATE → `TRUNCATE ... CASCADE` edits **weaken nothing**: 23000 is still asserted, the integration file still pins the `config_versions` message, and the runtime role still gets 42501. `toBeInstanceOf(Error)` on the plain TRUNCATE accepts any failure. | Weaker assertion only. | Assert `code: '0A000'` (FK-referenced table, raised before triggers). Optional: assert the table name in the acceptance file's CASCADE case. |
| SQR-08 | Info | `src/server/services/calculation-service.ts:355` and `:324` | TB-2; AC-1 | `createdById` comes from the caller (it is the warning acknowledgement). Probe P7 shows the "one configuration for checks and calculation" promise has no test. | None today (no route). | 05.09 review: pass `context.user.id`. Optional: a test with a configuration fake that changes between calls. |
| SQR-09 | Info | `src/server/services/calculation-service.ts:222` | Consistency with 05.02 | `MAX_TEXT_LENGTH = 5_000` is a limit this service sets on its own. | If saves allow longer Remarks, Calculate refuses a validly saved estimate. | One shared constant for the save and store checks. |
| SQR-10 | Info (praise) | `src/server/repositories/estimate-repository.ts:145-147` | AC-6, scope item "wrong estimate" | Ownership is part of the `UPDATE`, it throws on 0 rows, the IDs are bound, and the revision is untouched. Integration-tested. | — | — |
| SQR-11 | Info | `src/server/repositories/calculation-repository.ts:148` | Coding standards SQL ("No SELECT *") | `findUnique` with `include` and no `select`. There is no `tx` on `findCalculation`. | None (every column is mapped). Approval in 06.x will want the read under the lock. | Cross-reference for reviewer-standards. Add `tx?` with the first caller. |
| SQR-12 | Info | (whole PR) | Security scope of the brief | All security scope points verified; see the notes below. | — | — |

<details><summary>Detailed notes</summary>

### SQR-01: why the pool can deadlock itself
`TransactionRunner.run` takes one pool connection for the whole callback. Inside it, `lockEstimate` holds the row, and `readMasters` issues `findCustomer`, `readExchangeRates` and N material reads through `db` (the plain client). Each read needs another connection. `pg` waits `connectionTimeoutMillis` (5 s) for one, then fails. When every one of the 10 connections is held by a Calculate transaction that is waiting for a master read, none can finish. The transaction `maxWait` (5 s) and the statement timeout do not help, because the stall is in the client pool, not in PostgreSQL. Reading masters outside the transaction does not change their consistency: under READ COMMITTED a master can change between statements either way, and the snapshot is built from the very values used. The problem is availability only.

### Security scope (SQR-12), all verified
- **Immutability.** Migration section 2: `REVOKE UPDATE, DELETE, TRUNCATE` plus `GRANT SELECT, INSERT` for `accucut_app`, on both tables. Section 3: `BEFORE UPDATE OR DELETE` row triggers and `BEFORE TRUNCATE` statement triggers with the shared `forbid_immutable_change`. `immutability.test.ts` covers the table and column privileges, 11 runtime statements (42501), 7 owner statements plus TRUNCATE CASCADE (23000), table unchanged after each, no echoed value, and estimate DELETE refused (23503). Upsert and MERGE are not listed, but they need the UPDATE privilege (refused) and fire the UPDATE trigger. Remaining path: owner DDL (`DROP TRIGGER`) through a migration only, the same stance as `audit_log` (ARCH-R8).
- **Atomicity and chunking.** `insertCalculation` and `linkCalculation` require `tx`. Chunks of 1,000 rows × 9 parameters stay well under 65,535. The integration test stores 1,001 nodes. The link failure after the rows are inserted is rolled back on PostgreSQL. That test would fail if the insert ignored `tx`.
- **Lock ordering.** `lockEstimate` (`FOR UPDATE OF e FOR SHARE OF t`) is the same statement 05.01's customer change uses, so every estimate writer locks the estimate first. The store then adds only FK `FOR KEY SHARE` locks on `config_versions`, `users` and its own estimate row. No writer that holds those rows `FOR UPDATE` then locks an estimate, so there is no cycle. The race test proves the lock: without it, the insert's FK `KEY SHARE` would wait on the changer's `FOR UPDATE`, then store a stale revision, and the test would fail.
- **Stale revision.** It is compared against the value read under the lock and gives 409 `INPUTS_CHANGED` before any write. The record stores the locked value.
- **Caller words.** E and F are written from `findMaterialForCalculation` and spread last. `checkTexts` refuses E, F (kind `auto`), number fields, flag fields, outputs, image fields and unknown IDs. G follows architecture 5.1: the node's `text` is what the calculation copies.
- **`master_snapshot`.** Customer `{id, name}`, rates, only the materials used (in order of first use), and exchange rates (null if never set). All values are decimal text. `Decimal` is configured with `toExpNeg/toExpPos = ±9e15`, so there is never an exponent form. Rate scope: SQR-05.
- **No Engineer-reachable read.** `eslint.config.mjs` is an allow-list (`ENGINEER_ALLOWED_REPOSITORIES = user-repository, database-errors, transaction`), so `calculation-repository` is refused. The security test moved it from "future" to "blocked". There is no route, page or response, and `findCalculation` has no caller. `storeCalculation` returns `{id, createdAt}`. `figure-state.ts` holds only counts.
- **Error messages.** These are fixed texts (`ESTIMATE_APPROVED`, `CUSTOMER_NOT_CHOSEN`, `INPUTS_CHANGED`, not found, not valid). Field problems name paths, never values. A link failure is a plain Error (500) with fixed words.
- **Migration.** Additive. The rollback note's order (drop the estimates FK, then rows, then calculations) is correct, and the note correctly says that after the first record only a backup can restore. The FK on `estimates.current_calculation_id` validates against NULLs only (nothing writes the column). Deployment order: `migrate deploy`, then the new image; the previous image never touches the new tables. `ADD CONSTRAINT` on `estimates` takes a short SHARE ROW EXCLUSIVE lock on a small table.

### Assumptions A-1 to A-5
- **A-1** (no FK on node, parent or image): agreed; it matches the story and the integration test.
- **A-2** (all customer rates): reasonable, but it differs from the Dev Context wording; see SQR-05.
- **A-3** (`totalPrice`, `pricePerToolCost`, `toolCostTotal` as decimal text or null): agreed; it matches architecture 5.1 ("BL, BN and `toolCostTotal`").
- **A-4** (node request; E and F never from the caller): agreed. G as words matches architecture 5.1.
- **A-5** (409 on APPROVED, no customer, or stale revision; DRAFT → SUBMITTED): agreed, consistent with architecture 4.4 and 4.8. The customer is the estimate's own, read under the lock.
</details>

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | migration (tables, CHECKs); `calculation-repository.insertCalculation`; `calculation-service.storeCalculation`; `estimate-repository.lockEstimate` / `linkCalculation` | unit AC-1 (header, rows, resolved E/F/G, status, link, refusals); integration AC-1 (header and rows, read-back, 1,001 nodes, rollback after rows, FK failure rolls back, 4 refusals, lock race, two concurrent stores); probes P1 and P3 caught | Pass (SQR-01, SQR-02, SQR-03, SQR-06) |
| AC-2 | snapshot built from the values read; E/F words resolved at store time; G copied | unit AC-2; integration AC-2 (rate, price, scrap, exchange rate, rename, approval → record equal; next Calculate uses the new masters, earlier record unchanged) | Pass |
| AC-3 | migration sections 2 and 3 | `immutability.test.ts` (grants, column grants, runtime 42501, owner 23000, unchanged tables) | Pass |
| AC-4 | allow-list in `eslint.config.mjs`; `calculation-repository` classed as blocked | `tests/security/engineer-import-rule.test.ts` (CI) | Pass |
| AC-5 | every store inserts; `warnings` column default `[]` | unit AC-5; integration AC-5 (two records, link to the newest, `[]`) | Pass |
| AC-6 | `fk_estimates_current_calculation_id` | integration AC-6 (23503; another estimate's calculation refused by the repository) | Pass (SQR-04) |

## Issues for other roles
- **developer (05.09):** fix SQR-01 (pass `tx` through the master and configuration reads, batch the material read). Add SQR-02's test with the first real caller. Pass `context.user.id` as `createdById` (SQR-08).
- **developer (hardening window):** SQR-03, SQR-04 (new migration), SQR-06, SQR-07.
- **product-owner:** confirm A-2: the snapshot holds all customer rates, or only those the plan uses (SQR-05).
- **developer (05.02):** share one text-length bound with this service (SQR-09).
- **reviewer-standards / reviewer-performance (final review):** SQR-11 (`include` without `select`); the per-material read fan-out (SQR-01).
- **orchestrator:** remove the scratch worktree after this review: `git worktree remove --force` on `C:\Users\sanku\AppData\Local\Temp\claude\859e50c63dd2e28b\f8facd72-e7cc-4f45-9a83-c1cba182f3b1\scratchpad\wt-aqp293`. Its `node_modules` and `src\generated` are junctions to the main checkout; remove them with `rmdir` first so the targets are not touched.
