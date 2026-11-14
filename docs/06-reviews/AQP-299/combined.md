# Review Report — AQP-299 (STORY-06.01) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-299-estimate-status` (PR #383) |
| Commit reviewed | 5a24d10 (merge of master d085973 into 2bdfd63) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS**. No Blocker or Critical. One Major (SQR-01) should be fixed before merge because it is a small change, and at the latest in the first story that calls `transition`. It is not waived. |
| Deviation 1 ruling | **CONFIRMED**: a Lead or Admin may edit a SUBMITTED estimate (FR-064). The AQP-301 tests changed only as far as that rule requires. No escalation needed. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/383#pullrequestreview-5904436804 |

## Summary
The state machine is correct and its tests cover it fully. All 21 (status, event) pairs × 3 roles match AC-1, AC-5 and architecture §4.4. The role is judged before the status, so a role that may never apply an event learns nothing about the status. An `Object.hasOwn` guard stops prototype names, and both switches are exhaustive with `assertNever`.

On the server, `transition` locks the estimate row (the same `lockEstimate` statement that `setCustomer` and `storeCalculation` use, estimate before task), checks ownership (uniform 404), lets the machine decide and writes conditionally on the status it read. So two transitions queue, the second is refused by the state it finds, and the status never skips. `assertEditable(viewer, estimate)` now derives from the machine's `EDIT` event and replaces AQP-301's local check on the only server-side input write that exists (`setCustomer`), after the lock and before the same-customer no-op. Nothing can change an APPROVED estimate. No cost data or person data is added (NFR-002), and there is no new route.

The one Major is about composability, not today's behaviour. `transition` always opens its own transaction and takes no `tx`. The stories that must run it atomically with an approval row, an audit entry or a calculation link (05.09, 06.06, 06.08, 06.12) therefore cannot use it as built: nesting deadlocks on their own lock, and calling it separately splits the atomic unit.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | `git diff d085973 5a24d10` (11 files). Callers and callees: `transaction.ts`, `estimate-repository.ts` (whole file), `calculation-service.ts` (`store`, lines 300-362), `estimate-workspace.tsx`, `app/(portal)/estimates/[code]/page.tsx`, `prisma/schema.prisma` (Estimate), grep for every status or editability check under `src/` | Read in full |
| Context | Jira AQP-299 (ACs, Dev Context) and AQP-301 (AC-5, Dev Context); PRD FR-064; architecture §4.4, §4.8, §4.10, §6 (CR-33, refusal order, endpoint table), §8 (authorisation layers, audit, TB-2); UX spec UX-07, SCR-05 Submitted, OQ-UX-11; `docs/06-reviews/AQP-293/combined.md` | Read |
| Targeted unit and security tests | `npx vitest run tests/unit/estimate/state-machine.test.ts tests/unit/estimate-transition.test.ts tests/unit/estimate-service.test.ts tests/security/engineer-import-rule.test.ts` at 5a24d10 | 4 files, 931 tests passed |
| Mutation probe | P1: `EVENT_ROLES.EDIT` also allows `ENGINEER` (restored afterwards) | **Caught**: 10 failing in 3 files. Further probes stopped, see "Issues for other roles" (worktree shared) |
| Integration (PostgreSQL), `tsc`, lint, build, E2E | CI run 43596232890 on 5a24d10 | 6 of 6 green (Stages 1 to 11, 1 to 11b, E2E shards 1 to 4). Not run locally (no PostgreSQL; low memory) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| SQR-01 | Major | `src/server/services/estimate-service.ts:146-147` | AC-4; architecture §4.10 ("Audit … in the same transaction as the change"), §8 TB-2 ("same transaction"), §4.2 | `transition` always calls `transactions.run` and takes no `tx`. `TransactionRunner` does not nest. | A consumer that calls it inside its own transaction opens a second connection, which waits on the `FOR UPDATE` lock its caller holds. It hangs until the 10 s timeout (as in AQP-293 SQR-02). Calling it before or after its own transaction lets the status commit without its approval or audit row, or the other way round. The likely workaround is 4 hand-copied versions of lock → `mayOpen` → decide → ROLE/STATE mapping → `setStatus`, so the security mapping this story centralises drifts. | `transition(viewer, estimateId, event, tx?: Transaction)`, as `storeCalculation` has: with `tx` it runs inside it, without `tx` it opens its own transaction. Tests: a runner spy expects 0 `run` calls when `tx` is passed; an integration case calls `transition(…, tx)` inside `transactions.run`, throws, and asserts that the status is unchanged. |
| SQR-02 | Minor | `src/server/services/estimate-service.ts:149-153` | Architecture §6 CR-33 and the refusal order; §8 "each layer sufficient alone" | A role refusal is `NotFoundError` for an Engineer and `ForbiddenError` for a Lead, and it is made after the 404 lookup. §6 says a role refusal is 403, before any lookup, and keeps 404 for a missing estimate or another Engineer's. | HTTP cannot reach this path, because `withRoute` refuses by manifest first, and nothing leaks. As a service rule, though, an Engineer's own estimate answers "not found" to Approve, and the order differs from §6. | Throw `ForbiddenError` for every `kind: 'ROLE'`, and update the 2 unit tests that expect 404. Or record the 404 as an assumption for the architect to rule on. |
| SQR-03 | Minor | `src/lib/estimate/state-machine.ts:86, 102` | AC-1 vs architecture §4.10 | `DRAFT/SUBMITTED + CANCEL` is refused as `NOT_APPROVED`, as AC-1 says. §4.10 lets the Admin cancel the latest approval on a DRAFT or SUBMITTED estimate, with the status unchanged. | If 06.12 calls the machine, an Admin who cancels after an unlock gets a 409, which contradicts §4.10. This is the same kind of conflict as deviation 2 (export vs §4.6), but it is not listed. | No change in this PR. PO or architect to decide before 06.12: extend AC-1 (`DRAFT/SUBMITTED + CANCEL → same status`, Admin), or have 06.12 call the machine only for an APPROVED estimate. |
| SQR-04 | Minor | `tests/integration/estimates/transition.test.ts:192-199` (and ~158) | AC-6, deviation 1 (test adequacy) | `setUpEstimate` never sets `current_calculation_id`, so "the calculation pointer stays" compares null with null. The only PostgreSQL test of a Lead changing the customer of a SUBMITTED estimate is a race that accepts either outcome. | A `setStatus` that also cleared the pointer would pass, and AC-6 depends on it (§4.8 "figures stay current"). Deviation 1 is proven only against the fake. | Point the estimate at an owner-inserted (or stored) calculation and assert that it survives UNLOCK and CANCEL. Add a deterministic integration case: Lead and Admin `setCustomer` on SUBMITTED succeed, and the revision goes up by 1. |
| SQR-05 | Minor | `src/components/features/estimate-workspace/estimate-workspace.tsx:26` (not in the diff) | AC-2 (UI half); Dev Context "the UI reads `canEditInputs`" | The page keeps AQP-301's `header.status === 'DRAFT'`. | None today: the page renders only for Engineers, for whom this equals `canEditInputs(status, 'ENGINEER')`. A copy for SCR-06 (06.02) would hide the Lead and Admin editing that FR-064 gives them. | `canEditInputs(header.status, 'ENGINEER')` now (already allow-listed), or the viewer's role once the page has it. Cheap, so do it in this PR or in 05.02. |
| SQR-06 | Info | `src/lib/estimate/state-machine.ts:22-23, 48`; `task-repository.ts:24`; `lib/tasks/queue.ts:27`; zod enums in `estimate-repository.ts:78` and `views/schemas` | Maintainability (deviations 6 and 9) | There are three 409 codes for "approved" (`ESTIMATE_APPROVED`, `ESTIMATE_APPROVED_IS_LOCKED`, `ESTIMATE_NOT_EDITABLE`), and the status union is declared in 3 types plus 4 zod enums. | Clients and E2E tests have to know several codes, and a new status needs about 7 edits. | 05.09: unify the codes. Hardening: derive from `ESTIMATE_STATUSES` (`z.enum(ESTIMATE_STATUSES)`). |
| SQR-07 | Info | `src/lib/estimate/state-machine.ts:59` (`EDIT`) | §8 audit list; OQ-UX-11 and OQ-ARCH-07 (PRD v0.7) | A Lead or Admin may now change the inputs (today the customer) of a SUBMITTED estimate with no audit entry. | Accepted product decision: "not an audit event in Release 1", and the gap is stated there. | None. Noted for the final review. |
| SQR-08 | Info (praise) | `src/server/repositories/estimate-repository.ts:147-151` | AC-4, AC-6 | `setStatus` is a conditional `updateMany` on `(id, status = from)` that answers whether it changed exactly one row. It changes only `status` (`updated_at` through `@updatedAt`) and never `inputs_revision`, the customer or the calculation pointer. No raw SQL and no new lock. | — | — |
| SQR-09 | Info | (whole PR) | Security scope of the brief | Every security scope point verified; see the notes. | — | — |

<details><summary>Detailed notes</summary>

### Deviation 1 ruling (CONFIRMED)
The rule "A Lead or Admin may edit the inputs of a SUBMITTED estimate; the Engineer may not; nobody may edit an APPROVED one" is stated, and not merely implied, by:
- **PRD FR-064**, acceptance: "Engineer edit refused after SUBMITTED; Lead and Admin can edit and recalculate".
- **Architecture §4.4**: `SUBMITTED --> SUBMITTED: Edit inputs, Recalculate (Lead, Admin)`.
- **Architecture §6**: "A L; E own, while editable" on Set customer, Node, Save inputs and Reorder. "While editable" qualifies only the Engineer's own access.
- **Architecture §8**: "Lead edits to inputs are not in this list", and UX OQ-UX-11 is closed by PRD v0.7. Both presuppose that Lead edits exist.
- **This story**: AC-1 ("SUBMITTED to SUBMITTED on edit … (Lead/Admin)") and AC-2 (only the Engineer is refused).
- **AQP-301**: AC-5's 409 is for "an Engineer [who] opens … a SUBMITTED/APPROVED estimate".

The only contrary words are in AQP-301's Dev Context: "editable only while DRAFT (06.01's `assertEditable`)". That line delegates the rule to this story, so it does not override it. AQP-301's old unit test "a Lead is refused on a submitted estimate too: the state decides, not the role" went beyond its own AC-5. **No product-owner or delivery-lead decision is needed.** Recommended (non-blocking): the product-owner rewords that Dev Context line to "editable per 06.01's `assertEditable` (Engineer: DRAFT only; Lead/Admin: DRAFT or SUBMITTED)".

**The AQP-301 tests are not weakened beyond the rule.** The only assertion removed is "Lead on SUBMITTED → 409" (unit and integration), and that is the rule that changed. These are kept unchanged:
- unit `it.each(['SUBMITTED','APPROVED'])`: Engineer → 409 `ESTIMATE_NOT_EDITABLE`, httpStatus 409, customer and revision unchanged;
- integration: Engineer on SUBMITTED and APPROVED → `ConflictError`, and the row is unchanged;
- the 404 → 409 → 422 order test (Engineer on SUBMITTED);
- the uniform 404 for another Engineer's estimate.

These are strengthened: APPROVED is refused for the Lead **and** the Admin in both files (the Admin was not tested before), and `estimate-transition.test.ts` has a positive Lead SUBMITTED change (+1 revision) plus the 9-cell `canEditInputs` table.

### Security scope (SQR-09), all verified
- **Allowed and refused transitions per role.** The machine's 8 allowed and 13 refused pairs match AC-1 and §4.4 exactly, apart from the documented conflicts SQR-03 (cancel, §4.10) and deviation 2 (export, §4.6). In the role table, CALCULATE is Engineer only; RECALCULATE, EDIT, APPROVE, UNLOCK and EXPORT are Lead and Admin; CANCEL is Admin only. AC-5 and the §6 rows (Calculate "E own, DRAFT"; Approve and Unlock "A L"; Cancel "A") agree. EXPORT for Lead and Admin is assumption A-1, which I agree with (the file holds costs). The state-machine test checks every cell of 21 × 3, so allowing any forbidden transition fails it (probe P1: 10 failures).
- **Ownership.** `mayOpen` runs before the machine; another Engineer's estimate, an unknown UUID and a non-UUID give the same `NotFoundError` (message and code compared in the test). A Lead and an Admin may open any estimate.
- **Shared assertEditable.** Grep finds no other server-side `!== 'DRAFT'` or status check for inputs. `setCustomer` calls `assertEditable(viewer, estimate)` after `lockEstimate` and before `findActiveCustomer` and the same-customer no-op, so the order is 404 → 409 → 422 and a repeated request on an APPROVED estimate is still a 409. The UI copy is SQR-05.
- **Row lock, inputs_revision, storeCalculation.** Every estimate writer (`setCustomer`, `transition`, `storeCalculation`) takes `SELECT … FOR UPDATE OF e FOR SHARE OF t` first, in the same order, so no new deadlock cycle is possible. A transition never touches `inputs_revision`, so a figure that was current stays current after unlock (§4.8). An input change during an approval queues: the race tests show that an input change after approval is refused, and one before it raises the revision. `storeCalculation` refuses APPROVED and moves DRAFT to SUBMITTED, otherwise keeping the status; these are the machine's Calculate/Recalculate edges (deviation 9 agreed). It does not check the role. That is acceptable because it has no route yet, and 05.09 must call `transition` for the role (SQR-01 makes that possible in one transaction). No path in this PR writes an APPROVED estimate's inputs or calculation.
- **Audit.** §8 lists approval, unlock, cancel and price events, each owned by its story (06.06, 06.08, 06.12). `transition` writes none, which is correct for this story, but those stories must write it in the same transaction as the status. That is SQR-01.
- **Error codes.** 404 is identical for not-own and missing. Each refused pair gives a 409 with a distinct `ESTIMATE_*` code and words that contain no digit (tested). `ESTIMATE_STATUS_CHANGED` 409 is a guard that cannot be reached under the lock (unit-tested through a fake that moves the status under the lock). A Lead on CANCEL gets 403. For the Engineer's 404 on a role refusal, see SQR-02.
- **NFR-002.** `state-machine.ts` imports only `assert-never` and the `RoleName` type, and `can-edit-inputs.ts` imports only those and the machine. Neither holds a figure, rate, formula or person's data. The answer is `{id, from, to}`. Allow-listing both in `engineer-import-rule.test.ts` is correct. There is no new route, page or service file, so the manifest, role matrix, strict schemas and canary scan are unchanged.

### Assumptions A-1 to A-4 and deviations 2 to 9
- **A-1 / deviation 2** (EXPORT only for Lead and Admin, and only in APPROVED): agreed for this story. The conflict with §4.6 is correctly raised as a follow-up for the export story.
- **A-2 / deviation 3** (EDIT is an event of SUBMITTED only; editing a DRAFT is `canEditInputs`): agreed. `canEditInputs` is derived from the machine, so the two cannot drift (tested).
- **A-3 / deviation 4** (role before status): agreed. It keeps the status from a role that may not act.
- **A-4 / deviation 5** (ownership in the service): agreed.
- **Deviations 6 to 9**: agreed. Deviation 6's duplicated type is SQR-06; deviation 8's audit is SQR-01's consequence; deviation 9's codes are SQR-06.
</details>

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `state-machine.ts` (`decideTransition`, `followOn` with exhaustive switches and `assertNever`, `TRANSITION_REFUSALS`); `estimate-service.transition` maps STATE to 409 with the named code | `state-machine.test.ts` (21 pairs × 3 roles, refusal table, unknown status and event); `estimate-transition.test.ts` (11 refused pairs: code, words, no side effect); integration (8 allowed, 7 refused, row unchanged) | Pass (SQR-03 conflict with §4.10 for follow-up) |
| AC-2 | `can-edit-inputs.ts`; `assertEditable(viewer, estimate)` in `setCustomer` after the lock; the Engineer page still uses `status === 'DRAFT'` | 9-cell `canEditInputs` table; `assertEditable` tables; `setCustomer` unit and integration (Engineer SUBMITTED/APPROVED → 409, unchanged) | Pass (SQR-05: UI uses a local equivalent) |
| AC-3 | `RECALCULATE` from DRAFT → SUBMITTED for Lead and Admin; completeness checks deferred to 05.09 as the AC says | state-machine AC-3; transition unit test; integration (`DRAFT + RECALCULATE` by Lead) | Pass |
| AC-4 | `lockEstimate` `FOR UPDATE`, then decide, then conditional `setStatus`, in one transaction | unit with a lock-serialising fake (5 races, rollback, changed-status guard); integration on PostgreSQL (two Calculates, two approvals, unlock vs cancel, approve vs customer change, Recalculate vs approve) | Pass (SQR-01: not composable into callers' transactions) |
| AC-5 | `EVENT_ROLES`; `mayOpen` in the service; ROLE → 404 (Engineer) or 403 (Lead/Admin) | role table test; unit (Engineer non-Calculate → 404 in every status; Lead CANCEL → 403 in every status, the same answer whatever the status); integration | Pass (SQR-02 on the 404 vs 403 choice) |
| AC-6 | `UNLOCK` and `CANCEL` → DRAFT through `setStatus`, which writes the status only | unit (whole row equal apart from the status); integration (revision, customer, pointer) | Pass (SQR-04: pointer check vacuous) |

**Test result:** 931 of 931 targeted unit and security tests passed locally. CI run 43596232890: 6 of 6 green.

## Issues for other roles
- **developer (this PR, recommended) or the first consumer (05.09 / 06.06):** SQR-01 (`tx?` on `transition` with the two tests). Cheap now: SQR-05 (`canEditInputs` in `estimate-workspace.tsx`) and SQR-04 (non-null pointer in the AC-6 integration test; deterministic Lead SUBMITTED edit).
- **developer (hardening window):** SQR-02 (or architect ruling), SQR-06.
- **product-owner / solution-architect (before 06.12):** SQR-03, the Admin cancel on DRAFT or SUBMITTED (§4.10) vs AC-1. Also, optionally, reword AQP-301's Dev Context line "editable only while DRAFT" (deviation 1 ruling).
- **developer (05.09):** call `transition` for role and ownership in the same transaction as `storeCalculation`, and unify `ESTIMATE_APPROVED` / `ESTIMATE_APPROVED_IS_LOCKED` (deviation 9).
- **orchestrator:** (1) This report could not be written to `docs\06-reviews\AQP-299\combined.md` in the main checkout: this agent was confined to its worktree. Copy it there from the scratchpad. (2) The review worktree `C:\Users\sanku\Documents\Accucut - Quotation App\.claude\worktrees\agent-a5978ee47b3cddc7d` had **uncommitted changes from another session** during this review (task-queue files: `task-repository.ts`, `task-service.ts`, `views/task-queue.ts`, `lib/tasks/queue*.ts`, new `lib/tasks/overdue.ts`, `tests/unit/tasks/`, and others). I did not touch them. I stopped mutation probes after P1 to avoid interfering, and left the worktree on `feat/AQP-299-estimate-status` at 5a24d10. Please check which agent owns those changes before removing the worktree. No scratch worktree was created.
