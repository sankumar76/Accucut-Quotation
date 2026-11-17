# Combined security-and-quality review: AQP-323 (STORY-06.06 "Approve and lock")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/448 |
| Head reviewed | `9c5303233a1ed9f4a1a0417284bfeadcbfc9a6dd` (merge base `master` a82569c) |
| CI | Run 43918780916, 6 of 6 required checks green (orchestrator's brief and the PR body). Stage 11b: `/estimates/[code]` 181,414 of 200,000 B (+519) |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2), label `critical-review`: the story writes approvals, locks estimates and adds a migration (FR-062, FR-064, NFR-001, NFR-002, NFR-007, NFR-026) |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-16 |
| **Verdict** | **APPROVE WITH COMMENTS** |
| Counts | Blocker 0 · Critical 0 · Major 0 · Minor 5 · Info 6 |

## How I read it

- The whole diff (52 files, +2,533 / -267). I read every `src/` file in full at the head: the migration, `schema.prisma`, `approval-service.ts`, `approval-repository.ts`, the approve route, `estimates.ts` and `costs.ts` (schemas), `estimate-review-service.ts`, `audit-events.ts`, `approve-price.ts`, `approve-client.ts`, the `estimate-approve/` folder, and the changes to `review-actions.tsx`, `estimate-review.tsx`, `figure-tiles.tsx` and `estimate-workspace.tsx`. I also read the PR description, including the points for the reviewer, A-1 to A-6 and the Stage 11b figures.
- Callers and callees: `estimate-service.ts` `applyTransition` (lines 239-258, the re-entrant lock and `setStatus`), `api-client.ts` `sendJson` (it never throws), `money.ts` `toTwoPlaces`, `decimal.ts` (34 significant digits), `with-route.ts` (same-origin check at line 200), `route-manifest.ts:281` (`ADMIN_AND_LEAD`), and `deploy/db/create-roles.psql:58-61` (default privileges). I also read `forbid_immutable_change` (config_versions migration) and the earlier `REVOKE` pattern of every migration.
- Tests: `approve.test.ts`, `grants.test.ts`, the guard integration outline, `approval-helpers.ts`, the canary journey, `approve.spec.ts` (outline), the architecture, overlay and import-rule test changes, and `fake-calculations.ts`. I compared the lock-wait helper with the four existing ones (`customer-delete.test.ts:103`, `material-race.test.ts:84`, `treatments-serialisation.test.ts:42`, `audit-lock.test.ts:27`).
- Jira AQP-323: AC-1 to AC-9, Dev Context, the AQP-322 hand-over items 1 to 9, and the testing notes. Architecture v0.49: §4.8 "Approval" (line 610), §4.10 "Unlock and the earlier price" (line 612) and the cancel/remove table (lines 659-672), §5.1 `approvals` (line 725), the naming of act columns (line 743), and §6 row "Approve" (line 965). UX spec v0.30 on `docs/AQP-1-records-s`: SCR-06 "Approved (Lead)" (line 701), SCR-05 "Approved" (line 651), SCR-08 (line 766), "Figures recalculated while open" (line 771), and SCR-16 (line 1084). The combined reviews of AQP-321 and AQP-322.
- **Tests I ran at the head** in a detached scratch worktree, with `node_modules` linked from the main checkout:
  - `vitest run` on 12 unit and security files (`approve-route`, `approve-client`, `approval/guard`, `audit-events`, `costs-schema`, `estimate-review-service`, `estimate-review-screen`, `estimate-review-architecture`, `overlay-imports`, `audit-service`, `canary-scan-gate`, `engineer-import-rule`): **12 files, 1,579 tests passed**.
  - `role-matrix`, `strict-schema`, `csrf`: **3 files, 533 passed**.
  - `engineer-refused-before-lookup`, `route-recipes`, `manifest-completeness`: **3 files, 105 passed**.
- **Not run, as briefed:** Playwright, `next build`, Docker, and the PostgreSQL integration tests (`approve`, `grants`, `guard`). For those I rely on CI run 43918780916.

## Security and data-integrity scope: results

| # | Check | Result |
|---|---|---|
| 1a | Guard, transition, insert and audit in one transaction under the row lock | **Verified.** `approval-service.ts:132-154`: `lockEstimate` then `findFigureBasis(…, tx)` then `assertApprovable` (write-free, first) then `findCalculatedTotal(…, tx)` then `workflow.transition(…, 'APPROVE', tx)` (`applyTransition` locks again on the same transaction, which is re-entrant, and decides again) then `insertApproval(…, tx)` then `audit.record(tx, …)`. Everything is inside the one `transactions.run`, with no second transaction. Hand-over item 1 (SQR-05) is met. |
| 1b | All or nothing | **Verified.** A throw anywhere rolls back. Integration tests cover an audit write that fails (`approve.test.ts:127`) and an insert that fails after the status moved (`:144`), and both compare `storedOf` before and after. The fake runner now counts records when a transaction starts, not when it is asked for (`fake-calculations.ts`). This is a real fix, and it is why the unit AC-6 test can be trusted. |
| 1c | Races | **Verified in design.** A save that holds the lock makes the approval a 409 `TOTALS_OUT_OF_DATE` with no row and no entry (`approve.test.ts:162`). A holder that changes nothing lets the approval through afterwards (`:183`). Approve against Recalculate has both outcomes asserted (`:199`) and discriminates: without the lock the stale calculation would be approved and the Recalculate would succeed, which fails both branches. In two approvals at once, the loser gets the machine's 409 `ESTIMATE_ALREADY_APPROVED` and exactly one row and one entry exist (`:222`). The partial unique index `uq_approvals_one_live_per_estimate` is the backstop. **But the lock-wait helper is not scoped to its database** (SQR-01): under parallel test files it can report another file's wait, and the first lock test then passes with or without the lock. |
| 2a | Constraints, FKs, indexes, NOT NULLs | **Verified.** Every approve column is NOT NULL, and the act columns are nullable as AC-3 asks. There are six FKs with no cascade (`estimates` and `calculations` have no runtime DELETE, so NO ACTION never bites). The CHECKs are: price and BL not negative, reason at most 500 and only on an override, and each act's `by` and `at` together. Indexes: `(estimate_id, approved_at DESC)` serves `findLatestApproval`, plus `calculation_id` and the live-row partial unique index. The columns match architecture §5.1 line 725 one for one, and the act-column names follow line 743. The lack of `created_at` and `updated_at` is documented. |
| 2b | Grants | **Least privilege verified.** `REVOKE UPDATE, DELETE, TRUNCATE` from `accucut_app`, then `GRANT SELECT, INSERT` and `UPDATE (8 act columns)`. This matches AC-3 and the earlier pattern of every migration. `accucut_backup` holds `pg_read_all_data` only, so it is read-only and can do nothing here. `grants.test.ts` checks `has_table_privilege` and `has_column_privilege` exactly, and refuses every approve-column UPDATE, DELETE and TRUNCATE as the runtime role (42501) and as the owner (trigger). **The act columns are not write-once** (SQR-02). |
| 2c | Safe on existing data; rollback | **Verified.** The migration is additive: one new table, and the previous image never touches it. The rollback note is present. A small addition is suggested in SQR-10. |
| 3 | Immutability of the approval and the price | **Verified at both levels.** At the API level, the repository has no update method, and no route changes a price. At the database level, column grants stop the runtime role, and `trg_approvals_forbid_core_change` stops every role, the owner included. DELETE and TRUNCATE are refused by `forbid_immutable_change`. The approved state is locked: AC-4 `approve.test.ts:243` tries all 10 writers (save by Lead and by Engineer, add, move or delete a part, the customer, add or remove a picture, Calculate, Recalculate). Each is a 409 and the stored rows stay equal. |
| 4a | Role | **Verified.** The manifest row is `ADMIN_AND_LEAD`, so `withRoute` refuses an Engineer with the fixed 403 before the body and parameters are read. `assertMayApprove` runs first again in the service and is closed by `assertNever`. The role matrix and `engineer-refused-before-lookup` pass, as do `approve.test.ts:276` and the canary journey (Engineer 403 on `/approve` and `/costs`). |
| 4b | CSRF | **Verified.** POST is state-changing, so `withRoute` checks same-origin first (`with-route.ts:200`). `csrf.test.ts` runs over the manifest and is green. |
| 4c | Strict schema and price | **Verified.** `approveBodySchema` is strict. `calculationId` is `z.uuid()`. `price` matches `^\d{1,12}(?:\.\d{1,2})?$`, which means ASCII digits only, no sign, no grouping, at most 12 whole digits, so it fits `DECIMAL(18,2)`. `reason` is at most 500. The service turns the price into paise with `toTwoPlaces` (BigInt, so leading zeros are dropped). **The server never trusts a total from the client**: the client sends only `calculationId` and `price`, and the server reads BL itself under the lock (`findCalculatedTotal`) and rejects a stale `calculationId`. The answer is `approveAnswerSchema` (strict `{status, approvedPrice, approvedAt}`), so there is no total, no ID and no master value. `z.never()` is gone (hand-over item 2). |
| 5 | NFR-002 | **Verified.** The Engineer side has no import path: `approval-repository` is on the Engineer import-rule blocked list, and the architecture test pins `estimate-approve/` to the review's two importers. The Engineer workspace shows only fixed words (`APPROVED_LOCKED_*`). The `/costs` answer gains `approval` and `calculationId` for Lead and Admin only, and the review service refuses an Engineer before any read, the approvals read included. The canary journey covers the new responses: the Lead's answer and page hold the price (a control that shows the scan reads something real), and the Engineer's page, `/form`, `/tree`, `/tasks`, `/costs` (403) and `/approve` (403) hold no price form and no figure of the record. The recipe in `route-calls.ts` is unchanged (hand-over item 6). |
| 6 | Audit content | **Acceptable.** `after = {approvedPrice, calculatedTotal, approver}` is strict, and there is no key for a rate or a formula. The log is Admin-only (architecture §5.3, §4.10 line 659). The approver's name repeats `actor_label`, which architecture v0.27 already allows. It holds no secret and no contact data. The entry's words are not in the UX spec (SQR-06). |
| 7 | Lazy loading and the overlay rule | **Verified.** The button imports the dialog's props as a type only and loads the dialog with a bare `import('./approve-dialog')` through `useFirstOpen`. The words and the request code arrive with the dialog. `overlay-imports.test.ts` and `estimate-review-architecture.test.ts` pin this, and both are green. The first-load cost is +519 B, with 18,586 B of headroom left (ADR-016 floor 10,000). |
| 8 | Test quality and #443 | **Good.** Every concurrent call is wrapped in `refusalOf` before `Promise.all`. Each writer in AC-4 is asserted with `rejects` under its own name. The AC-9 test carries the required name `AQP-321 AC-4`. Tests map to the ACs (see the table below), and the race tests discriminate except for SQR-01. |

## AC conformance

| AC | Code | Test(s) | Result |
|---|---|---|---|
| AC-1 Dialog, BO pre-filled with BL, validation and info words | `approve-dialog.tsx`, `approve-price.ts` (`prefillPrice`, `PRICE_MESSAGE`), `approve-texts.ts` (`PRICE_INFO`), `review-actions.tsx` (`approveOffer`) | `approve-client.test.ts`, `estimate-review-screen.test.ts`, E2E `approve.spec.ts:63-98` | **Met.** The words match AC-1 exactly. The pre-fill is BL rounded to 2 places (A-2, accepted; see SQR-03 for 06.07). |
| AC-2 One transaction: row, status, one audit entry | `approval-service.ts:132-154`, `approval-repository.ts:217-229`, `audit-events.ts` `approval.approved` | `approve.test.ts:68-158`, `approve-route.test.ts`, `audit-events.test.ts` | **Met.** Every listed column, the status move and one entry with price, BL and approver. The task closes because its state is derived from the status. |
| AC-3 Migration, runtime role INSERT, SELECT and column UPDATE | migration lines 15-117 | `grants.test.ts` (runtime role and owner) | **Met** (SQR-02 suggests write-once act columns). |
| AC-4 Locked: every writer 409, read-only, Engineer sees "Approved and locked." and no price | Existing `assertEditable` and state machine; `estimate-workspace.tsx:130-135` | `approve.test.ts:243-273`, canary journey, `approve.spec.ts:135` | **Met.** |
| AC-5 SCR-06 approved: notice, BO tile, sentences, Unlock replaces Approve | `estimate-review.tsx` (`ApprovedNotice`), `figure-tiles.tsx`, `review-actions.tsx` | `estimate-review-screen.test.ts` (AC-5), `approve.spec.ts:135` | **Met.** Unlock is shown disabled with a reason until 06.08 (A-3, accepted). Download is unaffected. |
| AC-6 Two at once: one wins, the other 409, exactly one row | Row lock, state machine, partial unique index | `approve.test.ts:222`, `approve-route.test.ts` (AC-6), `grants.test.ts:112` (backstop) | **Met.** |
| AC-7 Engineer 403, signed-out 401 | Manifest and `withRoute`, `assertMayApprove` | `approve-route.test.ts`, role matrix, `approve.test.ts:276`, canary | **Met.** |
| AC-8 Dialog at 360, 768 and 1366: keyboard, focus, axe, "Approving" | `approve-dialog.tsx` (Radix `Dialog`, `inFlightRef` blocks dismissal) | `approve.spec.ts:100-132` on the three-width projects (CI) | **Met** (checked in CI, not run by me). |
| AC-9 BO from the approvals row, not from the figure state; BL cleared | `approval-repository.ts:231-240`, `estimate-review-service.ts` (`approvals.findLatestApproval`), `costs.ts` `approval` | `approve.test.ts:284` (named `AQP-321 AC-4`), `:302`, `:312`, `estimate-review-service.test.ts` | **Met.** "Latest not removed" matches architecture line 612. |

## Findings

### SQR-01 · Minor: the lock-wait helper counts waits in every database, so a lock test can pass without the lock

- **Where:** `tests/support/approval-helpers.ts:87`, which is used by `approve.test.ts:172` and `:190` and by `guard.test.ts:128`.
- **Issue:** `SELECT count(*) FROM pg_locks WHERE NOT granted` counts every waiting lock in the PostgreSQL cluster. The four helpers that already exist limit the count to `current_database()`: `customer-delete.test.ts:106`, `material-race.test.ts:87`, `treatments-serialisation.test.ts:45` and `audit-lock.test.ts:31`. This one drops that limit. Vitest runs integration files in parallel, each against its own throwaway database on the same server, and several of those files create lock waits on purpose.
- **Impact:** A wait from another file can end the poll before the approval has asked for the lock. The holder then commits first, the approval reads the new revision, and the approval is refused. So `approve.test.ts:162` passes whether or not `approve` takes the lock, which is the same class of fault as SQR-02 of AQP-321 and AQP-322. The tests do not fail at random; they can pass when they should not.
- **Fix:** This is one line, and cheap to fix in this PR. Use the same scope as the other helpers:
  ```sql
  SELECT count(*)::int AS n FROM pg_locks l
  WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())
  ```
  A stricter option counts only waits on `estimates` (`l.relation = 'estimates'::regclass OR l.locktype IN ('tuple','transactionid')`).
- **Test that would catch it:** A unit-level check that `untilALockWaits` in a database with no waiting session times out while another database has a waiting session. Or simply align the query with the four existing helpers and add a comment that points to them.

### SQR-02 · Minor: the unlock, cancel and remove columns can be rewritten or cleared after they are set

- **Where:** `prisma/migrations/20261116120000_approvals/migration.sql:86-105` (and the column `GRANT` at `:82`).
- **Issue:** The trigger protects the approve columns only. The runtime role may change the eight act columns at any time and in any direction. Three examples: `unlocked_at` can be set back to NULL, which makes an unlocked row live again; `unlocked_by` or `cancel_reason` can be rewritten after the act; and `removed_at` can be cleared, which brings a removed price back as BO through `findLatestApproval`. The CHECKs only pair each `by` with its `at`.
- **Impact:** Today nothing writes these columns. But the approvals row is the record of who unlocked, cancelled or removed (NFR-007, architecture §4.10 lines 659-672). A fault in 06.08, 06.12 or 06.13 could quietly rewrite that history, or bring back a price the Admin removed, and the database would allow it. This is the same "even by a fault in the service" argument the migration makes for `approved_price`.
- **Fix:** This is cheap now and costs a new migration after merge. Make each act write-once in the same trigger:
  ```sql
  IF (OLD."unlocked_at" IS NOT NULL AND (NEW."unlocked_at", NEW."unlocked_by", NEW."unlock_reason") IS DISTINCT FROM (OLD."unlocked_at", OLD."unlocked_by", OLD."unlock_reason"))
     OR (OLD."cancelled_at" IS NOT NULL AND (NEW."cancelled_at", NEW."cancelled_by", NEW."cancel_reason") IS DISTINCT FROM (OLD."cancelled_at", OLD."cancelled_by", OLD."cancel_reason"))
     OR (OLD."removed_at" IS NOT NULL AND (NEW."removed_at", NEW."removed_by") IS DISTINCT FROM (OLD."removed_at", OLD."removed_by")) THEN
      RAISE EXCEPTION 'An unlock, cancel or remove of an approval cannot be changed.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  ```
  Before writing it, check the order 06.12 expects: a cancel on a row that was already unlocked, as in UX "Cancel approval on a Draft or Submitted estimate", is a first write of the cancel columns, so it stays allowed.
- **Test that would catch it:** In `grants.test.ts`, as the runtime role and as the owner, setting `unlocked_at` back to NULL, and changing `unlock_reason` once set, are both refused, and the table stays unchanged.

### SQR-03 · Minor: BL is rounded twice (four places in the column, then two for the price), which will disagree with the pre-fill in 06.07

- **Where:** `prisma/migrations/20261116120000_approvals/migration.sql:20` (`calculated_bl DECIMAL(18,4)`), `approval-service.ts:141,145,151`, and `approve-price.ts:166` (`prefillPrice`).
- **Issue:** BL is computed to 34 significant digits (`src/lib/decimal.ts:15`), so it often has more than four decimals. The column rounds it to four places. The dialog's pre-fill (A-2) rounds the full value to two places. The audit entry keeps the full text. Rounding twice gives a different answer from rounding once. For example, BL `100.00495` is stored as `100.0050`, which rounds to `100.01`. The pre-fill is `100.00`.
- **Impact:** No harm today, because the override is not computed. In 06.07, if the override is judged against the stored `calculated_bl` (the obvious place), a Lead who leaves the pre-filled price unchanged will be recorded as an override in such cases, or the reverse. Once recorded, it cannot be corrected (the trigger). The approvals row and the audit entry also disagree in the last digits.
- **Fix:** Choose one rounding and keep it in one place. Either store the BL text unrounded (`NUMERIC` without a scale), or store `toTwoPlaces(BL)` as the record and say so. Then decide in the service, once, `isOverride = approvedPrice !== toTwoPlaces(fullBl)` and hand that to 06.07. This is cheap now, because the column type is free to change before the migration ships. If you keep `(18,4)`, add an explicit 06.07 hand-over: "compare with `toTwoPlaces` of the calculation's own `totalPrice`, never with `approvals.calculated_bl`".
- **Test that would catch it:** A unit test for the comparison 06.07 will use, with BL `100.00495`, expecting the pre-fill `100.00` to count as not an override.

### SQR-04 · Minor: the dialog says a different price "is recorded as an override", but `is_override` is always false and can never be corrected

- **Where:** `approval-service.ts:145` (no `isOverride`), and `approve-texts.ts` `PRICE_INFO` (the AC-1 words). This relates to A-1.
- **Issue:** The story sets the scope: the override is 06.07's. But the approve columns are immutable. Any approval saved at a changed price before 06.07 ships keeps `is_override = false` for good and has no `approval.price_overridden` entry. Meanwhile the dialog tells the Lead the opposite.
- **Impact:** No harm while nothing is deployed. If a release ever contains 06.06 without 06.07, the approval record and the audit trail would wrongly show that price changes were not overrides (NFR-007), and nothing could repair it.
- **Fix:** Either (a) record a release-order condition: 06.07 (AQP-324) must merge before G8, the same as AQP-327, with the orchestrator logging it; or (b), the cheap option, set `isOverride` now from the comparison in SQR-03 and leave the reason and the override audit entry to 06.07. I recommend (a) as the minimum and (b) if the developer touches SQR-03 anyway.
- **Test that would catch it:** For (b), an integration test that approves at `1.50` against a BL of 1,000 and expects `is_override = true`.

### SQR-05 · Minor: a Draft with current figures still says "Approving is not available yet."

- **Where:** `src/components/features/estimate-review/review-actions.tsx:95` (`APPROVE_NOT_YET_REASON`), pinned by `estimate-review-screen.test.ts:293-297`.
- **Issue:** The sentence was true while approving did not exist (06.05). From this PR on, approving exists. For a Draft with current figures (for example a Lead opening an estimate the Engineer has not submitted, and later a Draft after an unlock in 06.08), the true reason is that the estimate is not submitted.
- **Impact:** A Lead reads that the feature is missing and may report a defect, when the Engineer only needs to submit. UX-03 requires a reason, and the reason should be true.
- **Fix:** Ask the ux-expert for a sentence for "not submitted", together with the A-4 words. Then replace the constant and the test. Cheap once the words exist; it need not hold the merge.
- **Test that would catch it:** The existing test at `:293`, with the new words.

### SQR-06 · Info: the words of the `approval.approved` audit entry are not in the spec

- `src/server/services/audit-events.ts:383`: "Not approved" becomes "Approved at ₹ …, the calculated total was ₹ …, by …". SCR-16 (ux-spec line 1084) gives words for the override, cancel and remove entries only, and these words are not listed with A-4. Ask the ux-expert to confirm them along with A-4. The content is fine for NFR-002, because the log is Admin-only.

### SQR-07 · Info: `approved_at` is the start of the transaction, before the lock wait

- `migration.sql:24` uses `DEFAULT CURRENT_TIMESTAMP`, which is the start of the transaction. An approval that waited on the lock records a time earlier than its real commit, and it can come before the time of the transaction it waited for. This is harmless today. For 06.08's "latest row", consider `clock_timestamp()` or setting the time in the insert.

### SQR-08 · Info: a negative or unusual BL would end in a 500, not a stated refusal

- `calculated_bl >= 0` (CHECK) and the audit `rupeesText` (`^\d+(\.\d+)?$`) both reject a negative BL. `decimalTextOrNull` allows a sign. If a calculation can ever produce a negative total, the approval fails as a 500 and the dialog says "We could not confirm the approval", which is untrue. If BL can never be negative, a one-line comment saying so is enough. Otherwise refuse it in the guard with a 409.

### SQR-09 · Info: rulings on the assumptions

- **A-1** (reason accepted, not kept): **accepted**, inside the story's scope. See SQR-04 for the release condition.
- **A-2** (pre-fill = BL rounded to 2 places): **accepted.** 06.07 must compare with the same single rounding (SQR-03).
- **A-3** (Unlock shown disabled until 06.08): **accepted.** It follows the 06.05 precedent, and the button is disabled with a reason.
- **A-4** (two invented sentences): **accepted for now.** Both are honest, and neither claims what was saved. The ux-expert should rule on them, together with SQR-05 and SQR-06.
- **A-5** (AC words for the Approved notice): **accepted.** AC-5 governs. The difference and the reason on the BO tile (SCR-06 line 701) arrive with 06.07.
- **A-6** (new `estimate-approve/` folder): **accepted.** The architecture test is extended rather than weakened, and it pins the importers and the lazy import. The solution-architect should add the folder to the source tree in architecture §10.

### SQR-10 · Info: rollback note

- `migration.sql:4-5`: add `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261116120000_approvals';`, so that a later deploy applies the migration again after a rollback.

### SQR-11 · Info: praise

- The write follows the hand-over exactly: one transaction, the guard first and write-free, the transition decided again under the same lock, and the audit entry inside. The failure-injection tests prove all-or-nothing on real PostgreSQL.
- The fix to the fake transaction runner (counting when a transaction starts, not when it is asked for) closes a real hole that would have made the unit AC-6 test lie.
- The grants test checks the exact privilege sets with `has_column_privilege`, not one refused statement, so a later widening of the default privileges cannot get through unnoticed.

## Majors to GitHub issues

None. There are no Major findings, so no `tech-debt` issue is opened. SQR-01 to SQR-03 are each cheap to fix in this PR. I recommend the developer fixes them before merge, because the migration is cheapest to change before it ships. They do not block the merge.

## Issues for other roles

- **ux-expert:** rule on the A-4 words, give a sentence for "not submitted" (SQR-05), and confirm the words of the `approval.approved` audit entry (SQR-06).
- **solution-architect:** add `src/components/features/estimate-approve/` to the source tree (§10). State in §5.1 whether the act columns are write-once (SQR-02), and state the precision rule for `calculated_bl` (SQR-03).
- **orchestrator / scrum-master:** record the release-order condition that 06.07 (AQP-324) merges before G8 (SQR-04). Add the SQR-03 comparison rule to the 06.07 hand-over.

> Addendum 1 copied from the scratchpad on the delivery lead's standing rule, 2026-11-16 (DL-226). Source: scratchpad/AQP-323/combined-addendum-1.md, text unchanged.

## Addendum 1: re-review of 9c530323 to 8207e3e2 (2026-11-16)

(Append to docs/06-reviews/AQP-323/combined.md, before "Worktree created by this review". The direct write to the main checkout was refused: this agent was isolated in its own worktree.)

**Scope:** commit `8207e3e2` only (9 files, +125 / -16). CI run 43923961530: 6 of 6 green (orchestrator's report). **Verdict: APPROVE WITH COMMENTS. No Blocker, Critical or Major is open.** Counts after the addendum: Blocker 0 · Critical 0 · Major 0 · Minor 3 open (SQR-04, SQR-05, SQR-12 new); SQR-01 to SQR-03 fixed · Info 6.

| Finding | Result | Evidence |
|---|---|---|
| SQR-01 | **Fixed** | `approval-helpers.ts:87-91` now counts only `pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`, the scope the four existing helpers use. |
| SQR-02 | **Fixed**, with one gap (SQR-12) | `forbid_approval_core_change` refuses a change of any of the eight act columns once that column is non-null. It is a BEFORE UPDATE row trigger, so it applies to every role, and the runtime role cannot disable it. Going from NULL to a value is allowed per column, so the first write of 06.08 (unlock), 06.12 (cancel, including after an unlock) and 06.13 (remove) all pass. Writing the same value again is allowed. The new tests in `grants.test.ts:143-198` can fail: without the clause, the runtime role's column UPDATE is granted and would succeed; clearing a `by` or `at` would otherwise be the CHECK's 23514, not the expected 23000 and trigger message; the owner cases fail for the same reasons. |
| SQR-03 | **Fixed** | `calculated_bl DECIMAL(18,2)` holds `toTwoPlaces(BL)` (`approval-service.ts:145-155`), and the audit entry and pre-fill agree. **No information is lost:** the full-precision BL stays in the immutable `calculations` row the approval points to by FK (runtime DELETE and UPDATE revoked, plus `forbid_immutable_change`). So 06.07 (compare at 2 places) and 07.03 (export from the approved calculation) still have it. The tests can fail: the unit cases `12.34495 → 12.34` and `0.00495 → 0.00` are where rounding twice differs, and the old code inserted the raw text; the integration test now asserts `toBe` exactly. |
| SQR-04 | Not fixed, by design | The release condition stands: 06.07 (AQP-324) merges before G8. |

**SQR-12 · Minor (new):** the write-once rule is per column, so a reason that was NULL when the act was written (`unlock_reason`, `cancel_reason`) can still be filled in later by any role (`migration.sql:106-118`).

- *Fix:* freeze the whole act once its `_at` is set, comparing the `(by, at, reason)` tuple. Then add a test that sets an act with a NULL reason and fills the reason in afterwards.
- This is cheap now. It does not block the merge, but if it is not done here it must be done before 06.08 writes unlocks.

**Checks I ran at 8207e3e2:** vitest on `tests/unit/approval/guard.test.ts`, `approve-route.test.ts`, `audit-events.test.ts` and `tests/security/strict-schema.test.ts`: **4 files, 169 passed**. I did not run the integration tests (`grants`, `approve`); for those I rely on CI.

**For the solution-architect:** §5.1 should state that `calculated_bl` is BL rounded to paise, half away from zero, and that the act columns are write-once.


## Worktree created by this review

- `C:\Users\sanku\AppData\Local\Temp\claude\859e50c63dd2e28b\f8facd72-e7cc-4f45-9a83-c1cba182f3b1\scratchpad\wt-aqp323` (detached at 9c530323, with a `node_modules` junction to the main checkout). No developer worktree was touched.
