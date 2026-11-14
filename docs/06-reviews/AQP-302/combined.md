# Review Report — AQP-302 (STORY-05.02) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-302-parts-tree` (PR #384) |
| Commit reviewed | 4db9939 (origin/master 38fe29f merged in) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS**. No Blocker or Critical. There are two Majors (SQR-01, SQR-02), and I recommend fixing both before the squash because both are small. SQR-01 is the data-loss guard this story is labelled for. If they are not fixed here, they go to the hardening window and are not waived. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/384#pullrequestreview-5904576214 |
| PR label | `review:quality-approved` |

## Summary
The parts tree is well built.

- **Tree rules.** The rules are pure, iterative code (`lib/estimate/tree.ts`), checked against an independent nested-list oracle over generated trees and against the 500-node builder.
- **Every write** (add, move and delete; PUT `/nodes/{id}` and POST `/tree/move` share one service method) is one transaction with this order:
  1. `lockEstimate` FOR UPDATE;
  2. a uniform 404 (`mayOpen`);
  3. the **shared** `assertEditable` from STORY-06.01;
  4. the part 404;
  5. the stale-revision or count 409, with the fresh tree;
  6. the 422 under `parentId`.

  `inputs_revision` rises in the same transaction. It does not rise on a refusal or on a move that changes nothing.
- **Defence in depth.**
  - Every `UPDATE` and `DELETE` carries `estimate_id = $id` and throws on a row-count mismatch.
  - A trigger refuses a parent in another estimate.
  - CHECKs refuse a part that is its own parent, a negative place, a revision below 1 and inputs that are not an object.
  - Delete removes the subtree in one statement. The FKs have no cascade, so the service names every row it removes.
- **NFR-002.** One strict schema for every role. The 409 `tree` member is rebuilt field by field. `GET /nodes/{id}` inputs fail closed. The repository is blocked for Engineer views. Manifest, spec-access, role matrix, refused-before-lookup and canary recipes are all updated.

The two Majors:

1. **The delete guard checks the count of parts, not which parts.** It also checks only the target's revision. A sub-part can be moved in while another is moved out, or deleted and replaced, and from 05.03 on a sub-part can be typed into. In each case the confirm deletes something the person never saw.
2. **Nothing limits the number of parts per estimate.** Every write returns the whole tree, and the Sl. No grows with depth, so an Engineer can make every request on their own draft arbitrarily expensive.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 5 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get_files` (51 files) and `get_file_contents` at 4db9939 | Read in full: every changed file under `src/` (service read in full at head), the migration and schema, the service, integration and route tests, and the security-test changes. Read to test-name level: tree, tree-moves, tree-client and the e2e spec |
| Context | Jira AQP-302 (ACs, Dev Context); architecture §4.8, §5.1 (`estimate_nodes`), §6 (Tree, Node, Reorder), §8 concurrency; UX SCR-05 states, interactions, responsive and accessibility; `docs/06-reviews/AQP-293/combined.md`, `AQP-299/combined.md`; `tests/security/engineer-import-rule.test.ts` at head | Read |
| Unit, integration, lint, `tsc`, build, E2E | CI run 43599999923 on 4db9939 (`get_check_runs`) | 6 of 6 green: Stages 1 to 11, 1 to 11b, E2E shards 1 to 4. **Not run locally**: worktrees are shared and the brief said to skip local runs. Note: "Stages 1 to 11" took 7 s (13:35:37 to 13:35:44) against about 4 min for 11b. The orchestrator should confirm it is a gate alias, not a skipped stage |
| Mutation evidence | Developer's plants (revision check, count check, editable check, `inputs_revision` bump, cycle check), reported in the PR | Each caught by 1 to 3 service tests (reported, not re-run) |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 add item / sub-part / beside; empty inputs; Sl. No derived; unlimited depth | `addPart`, `placeForAdd`, `tree.ts` `buildTree` (iterative) | `tree.test.ts` (200-deep chain), service, route, integration, e2e | Met. The server does not require a customer (A-3; the UI gates it) |
| AC-2 renumber after add, move up/down, reparent, delete; announced | `insertNode`, `moveNode`, `removeNodes`, `changedPlacements`; `use-parts-tree` announcements | Generated trees against a nested oracle (5 seeds × 150 steps), the 500-node builder, service, integration, e2e | Met |
| AC-3 AlertDialog names the count; cancel changes nothing; one transaction | `deleteNode` (one `deleteMany`), `DeletePartDialog`, `partsRemoved` | Service (0, 1 and many descendants; wrong count; failed transaction), integration, e2e (Cancel, Escape) | Met. Guard gap: **SQR-01** |
| AC-4 no move under self or a descendant (422); a move changes no input | `movableParent`, `canMove`, `descendantIds` | tree, service, route, integration | Met. Test gap: **SQR-06** |
| AC-5 `inputs_revision` in the same transaction | `finishChange`, `moveNode` → `bumpInputsRevision` | Exactly +1 per change; none on a refusal or a no-op; rollback (fake and PostgreSQL) | Met |
| AC-6 stale node revision → 409 with the tree; the first stands | `TreeChangedError`; `problem.ts` `tree` member | Service, route, integration (two concurrent moves), e2e | Met for the moved part. Siblings: **SQR-03** |
| AC-7 SUBMITTED/APPROVED → 409; stranger → 404 like missing; signed out → 401 | `lockForChange` (`mayOpen` then shared `assertEditable`); `withRoute` | Service, route (stranger = unknown = malformed), role matrix, integration (Lead edits SUBMITTED, APPROVED refused) | Met |
| AC-8 one schema for every role, no figures; 500 nodes under 1 s | `schemas/tree.ts` (strict); `GET /tree` | Route (six keys × three roles), strict-schema, canary scan, unit and integration 500 nodes < 1 s | Met. No ceiling: **SQR-02** |
| AC-9 `tree`/`treeitem`/`aria-level`/`aria-selected`; arrows; Enter opens; Alt+arrows; Sheet on phones; axe 0; no overflow | `tree-panel.tsx`, `tree-node.tsx`, `parts-tree-area.tsx`, `use-viewport.ts` | e2e at 360, 768 and 1366 (CI) | Met, except that "Enter opens" waits for 05.03's `onOpen` (**SQR-11**, accepted deviation) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Major | `src/server/services/estimate-service.ts:339-341` | AC-3 data-loss guard; PR claim "a part added below, or typed into, since then is not deleted unseen" | The delete compares `doomed.length` with `parts`, and the **target's** revision with `revision`. It does not compare *which* parts would go or *their* revisions. (a) Membership: a Lead moves sub-part A out of 1.2 and moves B, with its inputs, in (or deletes A and adds C). The count is unchanged, and 1.2's revision is unchanged because a move bumps only the moved part. (b) From 05.03 on, a sub-part typed into bumps only its own revision. | Irreversible deletion of parts or typed values that the person was never shown. It needs only two people editing one draft (FR-064 and A-1 allow Lead or Admin with the Engineer), or the Engineer in two tabs once autosave exists | Keep `parts`. Add `subtree` = sha256 of the sorted `id:revision` of the part and every descendant, joined by ",": computed in the browser (`crypto.subtle.digest`) from the tree shown in the dialog, and on the server (`node:crypto`) from `before`. Mismatch → 409 `TREE_CHANGED` with the tree. Add it to `deleteNodeQuerySchema` (`^[0-9a-f]{64}$`) and the canary recipe | Service: "same count, different member → 409, nothing deleted"; "a descendant's revision changed → 409". One integration case |
| SQR-02 | Major | `src/server/services/estimate-service.ts:301-306` (`addPart`) | Input size limits; NFR-008 and NFR-011 (sized at 500 nodes); resource exhaustion | No ceiling on parts per estimate. Every add, move and delete reads and returns the whole tree. In a chain N deep the Sl. No of part k is about 2k characters, so one answer is about N² bytes (3,000 parts give about 9 MB per answer, rebuilt on every add). `deleteNodes` binds every ID in one `IN (...)` | A signed-in Engineer can make every request on their own draft cost seconds of CPU and megabytes of memory and transfer. Calculate and the export are measured only at 500 nodes | `MAX_PARTS_PER_ESTIMATE` (for example 2,000, four times the sizing; log an OQ for the architect or PM to confirm), checked on `before.length` in `addPart` under the lock → 409/422 with a plain message. AC-1's unlimited depth is kept | Unit tests at the limit and at limit − 1; one route test |
| SQR-03 | Minor | `src/server/services/estimate-service.ts:318-321`; `src/lib/estimates/tree-moves.ts:14` | AC-6 intent | A move is validated by the moved part's revision only. Siblings that shift keep their revision (A-5). Move up or down is sent as an absolute `index` computed from the last tree the browser saw, so after someone else reorders the siblings it lands in a place the person did not ask for, with no 409 | No input is lost and the move can be undone, but the screen reports a move the person did not intend | Send `fromParentId` and `fromIndex` (or the sibling it passes), and answer 409 `TREE_CHANGED` when the part is no longer there | Move B so that A shifts, then send A's "up" from the old tree → 409, nothing written |
| SQR-04 | Minor | `estimate-service.ts:34`; `app/api/v1/estimates/[id]/nodes/route.ts:7`; `nodes/[nodeId]/route.ts:7-8`; `tree/move/route.ts:7-8`; `server/http/route-manifest.ts:236` | Maintainability; FR-064 and A-1 | The comments say writes are for a draft only, and that a Lead or Admin may change "any draft". The code (correctly) uses `assertEditable`, so a Lead or Admin may also change a SUBMITTED estimate | Misleads the next change and invites a "fix" that breaks FR-064 | Reword as "while editable by this person (`assertEditable`)". Comments only | n/a |
| SQR-05 | Minor | `tests/security/strict-schema.test.ts:162` | NFR-002 guard strength | `if (recipe.status >= 300) return;` is general. Any future route whose recipe is a refusal skips the planted-key check of its success schema | A later route could lose the NFR-002 planted-key check unnoticed | Allow the skip only for an explicit list with reasons, or plant into `responseSchema` without a live answer for those rows. Add a meta-assertion that every recipe with status ≥ 300 is on the list | The meta-assertion itself |
| SQR-06 | Minor | `tests/unit/estimate-tree-service.test.ts:232`; `tests/integration/estimates/tree.test.ts` | AC-4 test adequacy | A cross-estimate parent is tested only with a nonexistent ID (`MISSING`). No move under a **real** part of another estimate is tested at the service or integration level. The trigger is covered by raw SQL only | A regression to a global parent lookup would be stopped by the trigger as a 500, not as the 422 in AC-4, and no test would notice | `moveNode(..., { parentId: FOREIGN_NODE })` → `FieldValidationError` under `parentId`, nothing written, in unit and integration tests. Add the SQR-01 cases | That test |
| SQR-07 | Minor | `prisma/migrations/20261114130000_estimate_nodes/migration.sql:43` | Integrity in depth | Only the service keeps sibling places unique, under the lock. `buildTree` breaks ties by ID, so a duplicate would be ordered silently. Cycles are also prevented only by the service, and `buildTree` silently hides unreachable rows | A future writer (05.03's form, a data fix) could corrupt the order without anyone noticing | Hardening window: `UNIQUE NULLS NOT DISTINCT (estimate_id, parent_id, sort_index) DEFERRABLE INITIALLY DEFERRED`. It must be deferred because the insert comes before the siblings shift. Check that the combination works on PostgreSQL 17 | Two raw inserts with the same place, committed → refused |
| SQR-08 | Info | `src/app/api/v1/estimates/[id]/nodes/route.ts` | Idempotency | `POST /nodes` has no idempotency key. A retried request adds a second empty part. The UI ignores a second press while a change is in flight | Cosmetic: an empty, deletable part | Optional, later: an `Idempotency-Key` header | n/a |
| SQR-09 | Info | `src/server/views/schemas/tree.ts` (`nodeDetailSchema`) | Forward note for 05.03 | `inputs` is a strict empty object, so `GET /nodes/{id}` answers 500 as soon as any input is stored. This is intended (fails closed) | 05.03 must name the fields in this schema and update `estimate-tree-route.test.ts` | n/a | Existing route test |
| SQR-10 | Info | n/a (AQP-293 A-1) | Forward note for 06.x | `calculation_rows` keep the node IDs of deleted parts (no FK). The tree change bumps `inputs_revision`, so those figures are correctly `out-of-date` | `/nodes/{nodeId}/costs` and the export must treat a missing node as gone and read figures only while `current` | n/a | In those stories |
| SQR-11 | Info | `src/components/features/estimate-workspace/tree-panel.tsx` | AC-9 "Enter opens" | Enter only selects until 05.03 passes `onOpen`. Accepted deviation: the form does not exist yet | none now | 05.03 wires `onOpen` and adds the e2e check | 05.03 e2e |
| SQR-12 | Info | n/a | Praise | Iterative tree code checked against an independent oracle. Lock-first ordering with the shared `assertEditable`. `estimate_id` on every write with count checks. The trigger plus CHECKs. A 409 tree member rebuilt field by field. PostgreSQL concurrency tests (two moves, ten adds) and rollback tests. Real mutation plants | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| Parent in the same estimate | Service: the lookup is among this estimate's rows only. DB trigger on INSERT and on UPDATE OF `parent_id`, `estimate_id`. Integration test with raw SQL |
| No cycles | `canMove` (`descendantIds`) under the lock. CHECK for own parent. No DB cycle guard (SQR-07 note) |
| Depth | Unlimited per AC-1. Iterative code, no stack risk. Response size: SQR-02 |
| Sibling places unique and gap-free after move and delete | Rewritten as 0..n-1 on every change (`layoutOf`). Tested in unit and integration. Not DB-enforced (SQR-07) |
| Delete cascade | No FK cascade. The service names the whole subtree and deletes it in one statement. The FK is checked at statement end. Nothing is orphaned |
| Row lock, `assertEditable`, `inputs_revision` in the same transaction | Yes, for add, move and delete. No bump on a refusal or a no-op. Rollback tested |
| Concurrent edits | Serialised by the estimate row lock. Same-part revision 409. Lead edits SUBMITTED via the shared rule (FR-064). Gaps: SQR-01 and SQR-03 |
| Uniform 404 | Stranger, unknown and malformed ID give the same 404 (route test compares bodies apart from the request ID). A node of another estimate → 404 |
| Strict schemas and limits | Body, query and params strict. ID ≤ 100 characters, integers ≤ 2^31−1. No name field yet (05.03). No node ceiling (SQR-02) |
| NFR-002 | One schema for every role, no figure. `estimate-node-repository` blocked for Engineer views. Manifest, spec-access, role matrix, refused-before-lookup, canary recipes (DELETE as a 409 recipe, see SQR-05) |
| Migration | Additive. Rollback note. `idx_estimate_nodes_estimate_id` + `idx_estimate_nodes_parent_id`. FKs NO ACTION. Grants: runtime DELETE yes, TRUNCATE no |
| `calculation_rows` interaction | No FK by design. Revision bump makes figures out-of-date (SQR-10) |

## Issues for other roles
- **solution-architect / product-manager:** confirm a maximum number of parts per estimate for SQR-02 (proposed 2,000; architecture §5.1 and NFR-008/011 are sized for 500).
- **orchestrator:** the CI check "Stages 1 to 11" took 7 s on run 43599999923. Confirm it is a gate alias.
- **developer (05.03):** SQR-09 (name the fields in `nodeDetailSchema`), SQR-11 (`onOpen`). SQR-01 (b) becomes reachable as soon as sub-parts can be typed into.
