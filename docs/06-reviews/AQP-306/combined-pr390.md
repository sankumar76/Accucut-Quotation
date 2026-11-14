# Review Report — AQP-306 (STORY-02.07, AC-3 material half and the #388 fixes) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`: can lose data) |
| Review round | 1 (second PR of the story; the customer half was #388, reviewed in `combined.md`) |
| Base…branch | `master...feat/AQP-306-material-guard` (PR #390) |
| Commit reviewed | a0e7521 (branch cut from ba059dd). The merge commit 88b2770 (master fdb0b7d, #389) was **not** reviewed, as the orchestrator asked |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS**. No Blocker, Critical or Major. The squash only needs the CI on the merge head 88b2770 to be green; it was in progress at review time |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/390#pullrequestreview-5905383753 (COMMENT, 7 inline comments) |
| PR label | `review:quality-approved` |

## Summary
The material delete mirrors the customer delete that was reviewed and merged in #388:

- the `materials` table lock, then the row `FOR UPDATE`;
- a plain fresh-snapshot read of the Draft and Submitted estimates whose parts hold the material;
- a soft `UPDATE` that excludes the hidden and system rows;
- one `master.deleted` row in the same transaction.

The guard fails closed: a non-UUID ID throws, and a missing table gives a 500. The race with a writer of a part's material is tested on PostgreSQL in both orders. The #388 fixes are in and verified: SQR-02 for both guards, SQR-03 (the confirmation cannot close in flight, with an E2E test), the SQR-06 wording and the SQR-08 nit. The shared `useMasterDelete` hook replaces the customer-only hook, so both screens use one delete flow.

The only finding at Minor is cross-PR (SQR-11). AC-5 depends on every writer of Material in Drawing taking the material `FOR SHARE` after the estimate lock. #391 (AQP-303) already does this, through its own equivalent method, so the two PRs must settle on one method and #391 must test its real save against this delete.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get` and `get_commits`; `get_commit` a0e7521 `full_patch` (26 files); `get_file_contents` at a0e7521 for `material-repository.ts` and `api-client.ts` | Read in full: every changed file under `src/`, the integration test, the E2E specs and the test-support changes. Read to test-name level, with the guard-failure case read in full: `materials-delete-routes.test.ts` |
| Cross-PR | #391 `get_files` (head 3058848): `material-repository.ts`, `estimate-inputs.ts`, `estimate-node-repository.ts` | `saveInputs` order is `lockForChange` (estimate `FOR UPDATE`, task `FOR SHARE`), then `findMaterialOption` (`FOR SHARE ... deleted_at IS NULL`, hidden row allowed), then `UPDATE estimate_nodes`. It stores `inputs[<E field id>] = "<lower-case uuid>"` |
| Context | Orchestrator brief and follow-up (AQP-325 AC-10 order; #391 context); Jira AQP-306 ACs; architecture §4.9 (hidden and system rows), §5.1 (A-13), §6; `combined.md` (#388 findings) | Read |
| CI | Orchestrator: a0e7521 6 of 6 green. `get_check_runs` on head 88b2770: 5 jobs in progress at 15:24 | **Not verified by me for a0e7521**; the merge-head run must be green before the squash. Nothing was run locally |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-3 material: soft delete, one audit row; refused 409 with the estimates while a Draft or Submitted part uses it; hidden "Not applicable" → 404 | `masters-service.ts` `removeMaterial`; `material-repository.ts` `findOpenEstimatesOfMaterial`, `softDeleteMaterial`; `DELETE /api/v1/materials/[id]` (204) | Integration (soft delete, list, options, 404 for PATCH, one entry with `before`, second delete, unknown and non-ID 404, hidden 404 and kept, late failure, four input shapes × Draft and Submitted, counted once, 12 → 10 + 12 with Approved excluded, allowed once the part is cleared); route test (204, 409 body, 10 + count, no Restricted numbers, guard error → 500, 403/403/401, 404/422); E2E (confirm, Keep, delete, options, refused dialog) | Met |
| AC-4 Approved only: allowed; it keeps its values | `status IN ('DRAFT','SUBMITTED')` | Integration (Approved part `inputs` and status unchanged; `findMaterialForCalculation` returns null after delete) | Met. Unlock or Cancel later: SQR-01 forward (AQP-325, AQP-329) |
| AC-5 delete and a writer serialise; never both succeed | Row `FOR UPDATE`, then the read (delete); `lockMaterialForUse` `FOR SHARE` after the estimate lock (writer contract) | Integration, both orders with a held transaction and lock-wait proof; `lockMaterialForUse` cases; two deletes at once | Met against the contract writer. The real writer is #391: **SQR-11** |
| AC-6 Lead 403, Engineer 403, signed out 401; manifest and role matrix | Manifest `['PATCH','DELETE']` ADMIN_ONLY; disposable recipe material | Route test; role matrix and recipes (292, reported) | Met |
| AC-7 SCR-13 Delete in the sticky Actions column; texts; keyboard; axe; no horizontal scroll | `material-list.tsx` (`actionButtons={2}`, table and cards), `material-delete-dialogs.tsx`, `use-master-delete.ts`, `materials-panel.tsx` | E2E at 3 widths (axe, overflow, focus, Keep); existing `masters-table-actions.spec` | Met (wording A-4 for the ux-expert) |
| AC-8 material name after delete | Indexes not partial (A-2) | Integration (422 `NAME_TAKEN`) | Met as worded; the product decision is still SQR-04 |
| #388 SQR-02 | Both guards throw on a non-UUID | Integration (both repositories), route (guard error → 500, nothing deleted) | **Verified** |
| #388 SQR-03 | `onOpenChange` ignores close while `submitting`; Keep disabled | E2E with a held DELETE (customers; the component is shared) | **Verified** |

## Findings
| ID | Severity | File:line (a0e7521) | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|---------------------|-----------------|-------|--------|---------------|--------------------------|
| SQR-11 | Minor (cross-PR; owner AQP-303 / #391) | `src/server/repositories/material-repository.ts:105` (`lockMaterialForUse`); #391 `material-repository.ts` `findMaterialOption`, `estimate-inputs.ts` `readValue` | AC-5; A-13 | AC-5 depends on a contract no writer on master implements yet. #391 implements it with a second, equivalent method. Once both merge, two methods state one lock contract, both PRs edit `material-repository.ts` (a conflict), and the AC-5 test here exercises only a hand-written writer | If either method drifts (a plain read, or a lost `deleted_at` filter), the delete stops serialising with part saves and no test notices. A Draft could then hold a deleted material, and Calculate would 404 | In #391: keep one method (`lockMaterialForUse`, or `findMaterialOption` as the documented contract); resolve the conflict; add a PostgreSQL race test of the real `saveInputs` against `deleteMaterial`, both orders, and retire the hand-written writer; lock several materials in ascending ID if a save ever names more than one (AQP-325 AC-10) | That race test |
| SQR-12 | Info | `material-repository.ts:235` | Guard design (orchestrator question) | The guard is a text search of `"<uuid>"` in `lower(inputs::text)`. **Acceptable.** It cannot miss #391's stored value (a lower-case UUID string). Inside free text, `jsonb::text` escapes quotes, so a typed UUID does not match; only a whole string value or a key equal to the UUID can over-match, and keys are field-ID UUIDs. Cost: every part of every open estimate is cast to text per delete, under the row `FOR UPDATE` and the table lock (part saves are not blocked unless they name this material) | A conservative 409 at worst; a rare Admin action | Hardening, after #391: `n.inputs ->> <E field id> = $id` (exact, indexable); keep the fail-closed rule | Existing shape tests plus an exact-key test |
| SQR-13 | Info | `tests/support/fake-masters.ts:131` | Test fidelity | The fake `lockMaterialForUse` finds only listed materials; the real one also finds the hidden "Not applicable" row | Unit tests for 05.03 or 02.06 that name "Not applicable" diverge from PostgreSQL | Return true for the hidden row once the fake has it, or document the gap | n/a |
| SQR-14 | Info | `master-delete-dialogs.tsx:139` | UX after the SQR-03 fix | `sendJson` has no client timeout, so a stalled network keeps the uncloseable modal up (the server side is bounded by statement and pool timeouts) | Only a reload gets out | Optional `signal: AbortSignal.timeout(30_000)` on the delete call; the outcome becomes `failed` and the dialog can close | Unit test with a never-resolving fetch and fake timers |
| SQR-15 | Info | `material-texts.ts:70`; `material-list.tsx` header; `material-texts.ts` `FAILED_WRITE_BODY` | Cross-reference to reviewer-standards | `=(query` spacing; "112 px (, STORY-02.07 AC-7)"; the shared sentence is duplicated in `material-texts.ts` and `customer-texts.ts` | Cosmetic | Format the file; fix the comment; move the sentence to `master-texts.ts` | n/a |
| SQR-16 | Info | `masters-service.ts:228` | Lock order (brief) | Verified: the delete takes the table lock, then one material row `FOR UPDATE`, then nothing else. Writers lock estimate, then task, then (customer), then materials in ascending ID. No cycle is possible | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| Admin-only route | Manifest `['PATCH','DELETE']` ADMIN_ONLY; `withRoute` does the origin check, then session, then role before params; 403/403/401 tested; disposable recipe material kept apart from the scan canaries |
| Soft delete | `UPDATE ... SET deleted_at` with `deleted_at IS NULL AND is_hidden = false AND is_system = false`; the runtime role has no DELETE. `findMaterialForUpdate` excludes hidden rows, so the hidden row is a 404 (tested). Lists, options, PATCH and `findMaterialForCalculation` exclude deleted rows |
| Guard | Draft and Submitted only (Approved excluded, tested); counted once per estimate; first 10 by code plus the total; fails closed on a non-UUID (throws) and on a missing table (500, nothing written, route test) |
| Locks and race | Both orders on PostgreSQL with lock-wait proof. No cycle with estimate → task → customer → materials ascending. #391's `saveInputs` follows the same contract (SQR-11 for consolidation and a real-writer test) |
| Audit | One `master.deleted` row (`object_type` `material`) in the same `tx`; `before` holds the material's fields (Restricted numbers; the audit log is Admin-only, as for create and edit); `after` null; none on 409, 404 or a late failure |
| NFR-002 | The 409 carries code, status, count and the name in `title`; price, gravity and scrap rate absent (route test) |
| What Approved keeps | Part `inputs` and status untouched; calculation snapshot and resolved text are JSONB. Unlock or Cancel of an estimate with a deleted material is SQR-01 (AQP-325, AQP-329) |
| Dialog reuse | `MasterDeleteDialog`, `MasterInUseDialog` and `useMasterDelete` are shared by SCR-12 and SCR-13; SQR-03 fixed once for both |

## Issues for other roles
- **developer of AQP-303 (#391):** SQR-11.
  - Keep one material-lock method, with the contract `FOR SHARE ... deleted_at IS NULL`, hidden row allowed, after the estimate lock, same transaction.
  - Resolve the `material-repository.ts` conflict with #390.
  - Add a PostgreSQL race test of the real `saveInputs` against `deleteMaterial`, both orders, and retire the hand-written writer in `material-delete.test.ts`.
  - If a save ever names more than one material, lock them in ascending ID after the customer (AQP-325 AC-10).
  - Optional, later: SQR-12's exact-key query once the E field is fixed.
- **scrum-master and product-owner:** SQR-01 also covers materials in AQP-325 and AQP-329 (AC-10 as recorded covers the order).
- **product-manager:** SQR-04 decision for both masters (partial indexes, or their own 422 words).
- **orchestrator:** squash #390 only after the 88b2770 CI is green. SQR-13 to SQR-15 go to the hardening window.
