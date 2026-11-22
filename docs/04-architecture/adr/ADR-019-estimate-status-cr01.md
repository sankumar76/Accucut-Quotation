# ADR-019: Estimate status for CR-01: Prepared by renaming, Quoted as a value, Ignored as a layer

| Field | Value |
|-------|-------|
| Status | Proposed (2026-11-22), for `master` to log |
| Date | 2026-11-22 |
| Deciders | solution-architect (+ Santhosh, delivery lead) |
| Related | CR-01 item 7 (UX spec 0.34 section 0.9 rows 7 and 7c); FR-038, FR-064, FR-102; NFR-001, NFR-002, NFR-007; ADR-007, ADR-008; architecture sections 4.4 and 4.12 |

## Context

CR-01 item 7 changes the estimate status from Draft, Submitted, Approved to **Draft → Prepared → Approved → Quoted, plus Ignored**:
- Prepared replaces Submitted, with the same meaning.
- Quoted follows Approved when a Lead or Admin presses "Mark as quoted".
- A Lead or Admin can set **Ignored** from any status before Quoted. Remarks are required, and **Restore** puts the estimate back with its previous status. Both actions are logged.

`estimates.status` is a PostgreSQL enum, `estimate_status`, with the values `DRAFT`, `SUBMITTED` and `APPROVED`. The pure state machine `src/lib/estimate/state-machine.ts` decides every transition, and the task's Open or Closed is derived from the status and never stored. At `master` de4799ae, 42 source files and about 106 test files name `SUBMITTED`, some of them in raw SQL. `approval.cancelled` audit entries already hold `status: 'SUBMITTED'`, and the audit log is immutable. Several rules hold because "APPROVED ⇔ a live approval": the lock, the customer-delete guard (BR-053) and the approval price shown. No production database exists before G8 (A-CR01-A1).

## Decision Drivers

- No data loss for existing Submitted rows, and no window where a row has no valid status.
- Restore must return exactly the previous status (UX row 7), whatever happened before.
- Keep the approval invariants, which ADR-007 and section 4.10 build on, simple and true.
- Monday's confirmations (A-CR01-1 to A-CR01-3) must be cheap to apply either way.
- Fast track (CLAUDE.md section 9): the smallest change that the combined review can check.

## Considered Options

### Option A: rename in place, QUOTED as a value, Ignored as a layer (chosen)
`ALTER TYPE estimate_status RENAME VALUE 'SUBMITTED' TO 'PREPARED'`, and `ADD VALUE 'QUOTED'` in a migration file of its own. Ignored is three nullable columns (`ignored_at`, `ignored_by`, `ignore_remarks`) over an unchanged status. The status shown is derived by `displayStatusOf`.
- Pros:
  - The rename rewrites no row and is instant. Every Submitted row is Prepared at the commit, and nothing can be lost.
  - Restore is correct by construction: the status underneath never changed.
  - The approval invariants stay "status APPROVED or QUOTED ⇔ a live approval". An ignored Approved estimate keeps its approval untouched.
- Cons:
  - "Is it ignored" is a second column, so every status query must also look at `ignored_at`. One function (`displayStatusOf`) and the queue's tab filters carry that.
  - PostgreSQL cannot drop an enum value, so a rollback leaves `QUOTED` unused.
- Cost / effort: 7A 1.5 d, 7B 1 d.

### Option B: IGNORED as a fifth enum value, with a `previous_status` column
- Pros: one column answers "what status is shown". It matches the UX wording "status".
- Cons:
  - Restore depends on a second column being right. Every check of "locked" or "approved" must also handle IGNORED-over-APPROVED, which breaks "APPROVED ⇔ a live approval".
  - The customer-delete guard and the figure rules each need a new case.
  - It needs the ADD VALUE in its own file, like Option A.
- Cost / effort: about 1 d more than A, and more surface for the combined review.

### Option C: a new enum type, with the data moved
Create `estimate_status_v2`, copy the rows across, then drop the old type.
- Pros: a clean type, with no leftover value after a rollback.
- Cons: every row is rewritten, `estimates` is locked for the swap, the default and the index are re-created, and the migration is longer and riskier, for no gain over RENAME VALUE.
- Cost / effort: about 0.5 d more than A for the migration alone.

## Decision

We take **Option A**:
- **Prepared:** rename `SUBMITTED` to `PREPARED` in place.
- **Quoted:** add `QUOTED` as a status value, with `quoted_at` and `quoted_by` on `estimates`. Unlock and Cancel clear them.
- **Ignored:** model it as a layer of three columns over the status, with CHECKs (all or none; never over QUOTED).
- **Transitions:** the state machine takes `{ status, ignored }` and gains `MARK_QUOTED`, `IGNORE` and `RESTORE`, for Lead and Admin only.
- **Monday's answers:** A-CR01-1 is two cells of the state machine, A-CR01-3 is the absence of an `UNMARK_QUOTED` event, and A-CR01-2 is one queue predicate.

## Consequences

- Positive: no row is rewritten and Restore cannot lose a status. The approval rules keep one simple invariant, `isLocked(status)` = APPROVED or QUOTED. Each Monday answer is a small, local change.
- Negative / trade-offs accepted:
  - Two columns describe what a person sees, joined by one pure function.
  - The legacy audit read must turn `SUBMITTED` into `PREPARED` (`z.preprocess` on the read schema only).
  - The error codes are renamed: `ESTIMATE_NOT_SUBMITTED` becomes `ESTIMATE_NOT_PREPARED`, and `ESTIMATE_ALREADY_SUBMITTED` becomes `ESTIMATE_ALREADY_PREPARED`.
  - A rollback leaves `QUOTED` in the type.
- Follow-up actions (with owners):
  - developer (7A, 7B): the migrations as section 4.12 b lists them, with the `prisma migrate diff` check empty.
  - developer (7B): grep for `'APPROVED'` in `src/` as part of the definition of done.
  - product-manager: FR-064 and FR-102 wording.
  - product-owner: the ACs that name Submitted.

## Verification

- Unit tests of the full transition table, including every ignored pair and the A-CR01 cells.
- An integration test: a Submitted row from before 7A reads as Prepared after the migration, and a legacy `approval.cancelled` entry still reads.
- An integration test: Restore returns each of DRAFT, PREPARED and APPROVED.
- E2E of the four queue tabs at three widths.
- The combined review of 7A and 7B (CLAUDE.md section 9 item 2).
