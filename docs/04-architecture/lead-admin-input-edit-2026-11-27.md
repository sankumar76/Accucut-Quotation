# Lead and Admin: view and edit an estimate's inputs (design note, 2026-11-27)

| Field | Value |
|-------|-------|
| Owner | solution-architect |
| Status | **Proposed** (design only, no product code). Master reads it before the edit stage's PR is ready (DL-432 (2)). |
| Drives | DEF-131 (Jira AQP-488, GitHub #798); FR-115 (view) and FR-116 (edit), PRD 0.62; FR-064; DL-432 (DL-306 overridden); NFR-001, NFR-002, NFR-007, NFR-009 |
| Evidence | Code read on `origin/master` a6eb9809 (27 Nov): `src/lib/estimate/state-machine.ts`, `can-edit-inputs.ts`, `src/server/services/estimate-service.ts`, `estimate-inputs.ts`, `unlock-service.ts`, `step-up-service.ts`, `audit-events.ts`, `audit-service.ts`, `src/app/api/v1/estimates/[id]/{form,tree,nodes/[nodeId],nodes/[nodeId]/inputs}/route.ts`, `src/server/http/route-manifest.ts`, `src/app/(portal)/estimates/[code]/page.tsx`, `review-page.tsx`, `components/features/estimate-workspace/{part-form,estimate-workspace}.tsx`; architecture section 4.8 |
| UX reference | The ux-expert's ruling (`docs/03-ux/rulings/lead-read-only-inputs-2026-11-27.md` or `lead-admin-edit-inputs-2026-11-27.md`). It was not on any branch when this note was written. This note sets the server and status rules, and the UX ruling sets the screen. Where they differ, the difference goes to the product-manager before the build (FR-116 ED-AC-10). |

## 0. The answer in brief

- **Most of the server side is already built.** A Lead and an Admin can already read any estimate's form and part values through the existing routes, which are the same ones the Engineer uses. The part save route (`PATCH .../inputs`) already accepts their saves on a Draft or Prepared estimate, with the status check, the row lock, the per-part revision and the clearing of figures all correct. **What is missing is the screen and the audit trail.** Today a Lead or Admin save writes **no audit entry**, so an untraced edit path is open on `master` (section 5, R-1).
- **Stage 1 (view)** needs no new route and no server change. It is a lazily loaded, read-only use of the Engineer's `PartForm` on SCR-06. **About 6.5 h.** It fits the end of Sun 29 Nov.
- **Stage 2 (edit)** is the same form with `editable` taken from the shared rule. It adds one audit event written in the save's transaction, and closes the two other untraced paths. **About 12 h, plus about 3.5 h of combined review and fixes.** With one lane it cannot be safely merged by the end of Sun 29 Nov. With a second lane starting today, it can make Sunday **only through two gates** (section 6): the review starts by Sun 12:00, and the PR is green and has no open Blocker or Critical by Sun 20:00. Otherwise it merges by the end of Tue 1 Dec, with Wed 2 Dec as the hard cut-off (PRD 0.62 staging, DL-432 option A). The ux-expert's open points A-1 to A-7 are answered in section 6a.

**Status rules in five lines**
1. **Draft** (not ignored): a Lead or Admin may edit any input field of any part. The status stays Draft.
2. **Prepared** (formerly Submitted): a Lead or Admin may edit directly, with nothing needed first: no unlock and no step-up. The figures clear at once, and approval is refused until a Recalculate. The status stays Prepared.
3. **Approved or Quoted**: refused (409 `ESTIMATE_APPROVED_IS_LOCKED`). The Lead or Admin first uses the existing Unlock, which needs a reason but no step-up, as built. The estimate goes back to Draft, and rule 1 applies.
4. **Ignored** (whatever the status underneath): refused (409 `ESTIMATE_IGNORED`). Restore first.
5. **Every** Lead or Admin change writes one audit entry in the same transaction, and the write fails if the entry fails. That covers an input value, a picture, and a part added, moved or deleted (v1.1: the delivery lead widened the scope to the parts tree). The Engineer's rights and screens do not change.

> **v1.1 (2026-11-27, later): the delivery lead's two answers, relayed by the orchestrator.** (1) **Staging A:** the view merges by the end of Sun 29 Nov. The edit merges by the end of Wed 2 Dec, target Tue 1 Dec, so section 6's Sunday gates for the edit are withdrawn. (2) **"Also the parts tree":** a Lead and an Admin add, move and delete rows like an Engineer. **This reverses v1.0's 403 on tree structure writes.** Those writes stay allowed, as built, and gain audit entries (section 3.9). Where v1.0 text says "403" for the tree, section 3.9 governs.

## 1. What exists on `master` today (verified in code)

| Question (lane 2, 27 Nov) | Answer from the code |
|---|---|
| Can a Lead or Admin **read** the form and a part's inputs? | **Yes.** `GET /api/v1/estimates/{id}/form`, `GET .../tree` and `GET .../nodes/{nodeId}` are `ALL_ROLES` in the route manifest (`route-manifest.ts:260,263`). The service's `mayOpen` lets a Lead or Admin open any estimate (an Engineer only their own, otherwise 404, CR-33). Each route uses **one schema for every role** (`formResponseSchema`, `partsTreeSchema`, `nodeDetailSchema`), with no rate, cost or formula (ADR-008). |
| Can a Lead or Admin **save** (autosave PATCH)? | **Yes, on Draft and Prepared.** `PATCH .../nodes/{nodeId}/inputs` is `ALL_ROLES` (`route-manifest.ts:264`). `saveInputs` locks the estimate row, then runs `assertEditable`, which uses `canEditInputs` and the state machine's `EDIT` event (Lead and Admin on Prepared). Then it checks the part's `revision` (409 `PART_CHANGED`), validates (422), and writes only on a real change. That write raises both the part revision and `estimates.inputs_revision`, so the figures go `out-of-date` (section 4.8). Approved, Quoted and Ignored estimates are refused with 409. |
| Are status, revision and figures handled correctly for a Lead or Admin? | **Yes.** It is the same code path as the Engineer's, with the role decided by `canEditInputs`. The approval guard (`TOTALS_OUT_OF_DATE`, `calculationId` must match) already stops approval of a stale figure. |
| Does a Lead or Admin save leave an **audit trail**? | **No.** `estimate-inputs.ts` `saveInputs` calls no `audit.record`, and `audit-events.ts` has no input event. The Engineer's saves are not audited either, which is by design (they are the author). For a Lead or Admin it is a gap: **an untraced edit is possible today through a direct API call** (no screen reaches it). |
| Other untraced Lead or Admin writes? | **Yes.** Add, move and delete part (`POST .../nodes`, `POST .../tree/move`, `PUT`/`DELETE .../nodes/{nodeId}`) and the picture (`PUT`/`DELETE .../image`) are also open to a Lead or Admin on Draft and Prepared, with no audit. `tests/integration/estimates/image.test.ts:265` asserts it. This is DL-303 (3), "left as built". Only the customer change is audited (`estimate.customer_changed`). |
| Is the edit stage mainly UI plus tighter checks? | **Yes.** UI, one audit event, and closing two side paths. No route contract, schema or migration changes. |

## 2. Stage 1: view (FR-115, DEF-131)

**Server read.** Use the reads the Engineer's form already uses: `GET .../form` (the sections and fields, built from the estimate's own configuration version, so an Approved estimate shows the fields it was approved with) and `GET .../nodes/{nodeId}` (the part's stored values and revision). The part list comes from the review's own tree (SCR-06), whose node IDs are the same. **No new route, no new view model, no new service method.**

**Role check on the server**, in order:
1. The page: `authorizePage('/estimates/[code]')`, then the `switch (user.role)` in `page.tsx`. Lead and Admin get `renderReview` (Restricted, loaded with a dynamic `import()`). The Engineer branch is unchanged.
2. Each read: `withRoute` checks the session and the manifest roles (401, then 403). The service's `mayOpen` gives a Lead or Admin any estimate and an Engineer only their own (404, CR-33).

**Screen (ux-expert's design rules).**
- Build a client `LeadPartInputs` panel in `components/features/estimate-review/`, the Restricted folder. It composes the **existing** `PartForm` with `editable={false}`, with no-op `onSaved` and `onChanged` and an empty `SaveGate`. Fields hidden by a rule (Fasteners Qty and Cost) follow the Engineer's form. If the UX ruling requires them shown, that is a form change and goes to the product-manager first.
- **Load it lazily** (ADR-016, AQP-188): the panel is fetched by a bare `import()` when the Lead first opens a part's inputs, through the shared first-open loader. Nothing is statically imported into SCR-06's first load.
- Import direction: Restricted `estimate-review` may import the shared `estimate-workspace` form. The reverse stays forbidden (`tests/security/engineer-import-rule.test.ts`).

**NFR-002 (no change for the Engineer).** No route, schema, manifest row or Engineer component changes, and the form and node answers are already identical by role. The Engineer's request still loads no review code, because the panel lives behind the Lead and Admin branch. Proof: the role matrix, the identical-keys test and the canary scan run unchanged and pass, and `engineer-import-rule` stays green with the new file in the Restricted folder.

## 3. Stage 2: edit (FR-116)

### 3.1 Status rules (decided)

| State | Lead or Admin edit | What is needed first | After a real change |
|---|---|---|---|
| Draft (not ignored) | **Allowed** | Nothing | Status stays Draft. `inputs_revision` +1. Figures are already `none`, or go `out-of-date`. |
| Prepared (Submitted) | **Allowed** (`EDIT`, Prepared to Prepared) | **Nothing**: no unlock, no step-up, no reason | Status stays Prepared. Figures `out-of-date`. Approval refused (`TOTALS_OUT_OF_DATE`) until the Lead or Admin presses **Recalculate** (existing, `RECALCULATE`). Export refused until then (FR-070). |
| Approved, Quoted | **Refused** 409 `ESTIMATE_APPROVED_IS_LOCKED` | The existing **Unlock**: a reason of 1 to 500 characters, audited as `approval.unlocked`. **There is no step-up on Unlock as built**, and none is added. Unlock moves the estimate to Draft, and the Draft row then applies. | Unchanged as built: the approved price (BO) stays, labelled "approved earlier", until a new approval or the Admin's removal (section 4.8). |
| Ignored (any status) | **Refused** 409 `ESTIMATE_IGNORED` | The existing **Restore** | n/a |

**Why there is no step-up and no "send back" step on Prepared.** An edit changes no price and approves nothing. Every change is audited (3.4), and the figures clear by rule, so the change cannot reach a quote without a fresh Recalculate and a separate, audited approval. Step-up is kept for acts that destroy or override a recorded decision (cancel an approval, remove a price, edit a formula, hand over the Admin; ADR-009). Requiring an unlock on Prepared would be wrong anyway: Unlock is defined only from Approved and Quoted (`NOT_APPROVED` otherwise).

**No new rule code.** `canEditInputs(state, role)` and `decideTransition(..., 'EDIT', ...)` already encode this table. The screen asks `canEditInputs` with the viewer's real role (`'LEAD'` or `'ADMIN'`), unlike the workspace's hard-coded `'ENGINEER'` (`estimate-workspace.tsx:92`). The server asks it again under the row lock (`assertEditable`), and only the server's answer counts.

### 3.2 The save route: reused, contract unchanged

The edit uses `PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs` **with the same body, answer, refusal order and per-part revision**. It also uses the same client hooks (`useAutosave`, `SaveGate`, the 30-second autosave and save on leaving a field, `part-conflict.ts`, the leave guard). No second save route and no Lead-only body field. The role always comes from the session, never from the request.

**Service changes (stage 2, server):**
1. **Audit in `saveInputs`.** After the conditional write (`nodes.saveInputs`) and inside the same transaction: if `viewer.role !== 'ENGINEER'`, call `audit.record(tx, { event: 'estimate.inputs_changed', ... })`. `createEstimateInputs` receives `audit`, as `setCustomer` already does. A service built without `audit` refuses a Lead or Admin save rather than write it silently. A save with no real change writes no entry. An audit refusal rolls back the whole save.
2. **The picture** (`image-service.ts`, add, replace, remove): a Lead or Admin change writes the same event, with the Part Model field and the value `Picture added`, `Picture replaced` or `Picture removed`. It never holds bytes or a file name.
3. **Tree structure writes** (`addPart`, `moveNode`, `deleteNode`): **superseded by section 3.9 (v1.1, DL-435). Do not build a 403.** The writes stay allowed for a Lead or Admin, as built, and each one is audited. The v1.0 text below is kept struck through for the record only.
   ~~**refused for a Lead or Admin** with 403, checked on the role before anything is read (refusal order 401, 403, then 404; section 6). This matches PRD 0.62 ("the tree's structure actions stay waived") and closes the untraced path at no audit cost. The existing tests that assert a Lead or Admin tree write are changed to assert the 403. This is a deliberate rule change recorded here, not a weakening (see section 7). If the delivery lead later widens FR-116 to structure, the 403 is replaced by an audited write.~~
4. **Customer change**: unchanged (already audited, Lead and Admin only).

### 3.3 Figures and Recalculate

As for an Engineer's edit (section 4.8, "Cleared figures"). A real change raises `inputs_revision` in the save's transaction. Every figure read goes through `figure-state.ts`, so BL, BN, Tool Cost, row outputs, reconciliation and the export clear on the server. Quantity warnings hide, and BO stays. **On the screen:** after the first real save the review re-reads its figures (`router.refresh()`, or the review's own figure read), so the tiles show "cleared, Recalculate" rather than stale values. The existing Recalculate button then runs (`RECALCULATE`: Prepared to Prepared, Draft to Prepared, A-08), and approval follows as built.

### 3.4 Audit trail: `estimate.inputs_changed` (new, wired)

| Item | Value |
|---|---|
| Event | `estimate.inputs_changed`, `objectType: 'estimate'`, object ID the estimate, label the task code |
| Category | New `input_change`, label "Input change" (`src/lib/audit/categories.ts`), so the Admin can filter it. Customer changes stay under "Task change". |
| Who | `actorId` and `actorLabel` from `AuditContext` (the session). **The role at the time** is stored in `after.actorRole` (`'LEAD'` or `'ADMIN'`), because audit rows carry no role column and a person's role can change later. |
| When, request | The audit row's own `created_at` and `request_id` |
| `before` | `{ part: { slNo, name }, fields: [{ letter, label, value }] }`, **only the fields that changed** in this save, with their stored value before (null = blank) |
| `after` | `{ actorRole, part: { slNo, name }, fields: [{ letter, label, value }] }`, with the same fields and their new values |
| Value text | The display text, frozen at the time: a number as normalised text, a text as typed, a material as its **name** (not its ID), a choice as its option, a treatment as its text, a flag as `Yes` or `No`, a picture as in 3.2 (2). A field hidden and zeroed by a rule in the same save counts as a changed field. |
| Never in it | Any calculated value, rate, formula or price (NFR-002, NFR-007). The zod schemas allow no key for one, and `audit-secrets.ts` applies as usual. |
| Visible to | The Admin only (`/audit` is `ADMIN_ONLY`, as now). Never the Engineer. |
| Volume | One row per real save by a Lead or Admin (autosave saves on leaving a field and every 30 s, and a no-op writes nothing). |
| Engineer saves | **Not audited** (unchanged; PRD ED-AC-6 PROPOSED). The Engineer is the author, and Calculate records the state it used. |
| Static check | The AQP-237 audit check (`audit.record` called in the function that owns `tx`, within 3 helper steps) must count the new call sites. The pinned "at least 15" stays true. |

### 3.5 Concurrency with the Engineer (and a second Lead)

- **Same part, Draft:** both may save. The estimate row lock serialises the writes, and the per-part `revision` makes the second a 409 `PART_CHANGED`. The client reloads that part and shows the existing conflict message (`part-conflict.ts`), so **nothing is overwritten silently** (ED-AC-5). The loser re-types after seeing the new value.
- **Different parts, Draft:** both saves succeed. Each side sees the other's values when it next reads that part.
- **Prepared:** the Engineer cannot save (refused 409, form read-only), so only Leads and Admins contend, by the same rule.
- **Edit against Calculate, Approve, Unlock or Ignore:** all take the same row lock. An edit that lands first makes a following approval fail (`TOTALS_OUT_OF_DATE`, or the `calculationId` mismatch). An approval or ignore that lands first makes the edit fail (409). A status never skips a step.

### 3.6 Task assignment and queue

An edit changes **no status**, so the task stays in its tab: Draft and Prepared are both Open. The task stays assigned to its Engineer, with no reassignment and no mail (e-mail is off at go-live anyway). The queue, the bell and `task-status.ts` are unchanged. The Engineer sees the new values the next time the part is read. No notice to the Engineer is built (not requested). That is a possible later item.

### 3.7 Approval and step-up

- Approval: unchanged code. An edit on Prepared forces Recalculate before approval, through the existing server guard.
- Step-up: unchanged. No step-up for an edit, and none added to Unlock.
- The price override, cancel and remove-price flows are unchanged.
- An edit on a Draft that still carries an earlier approval (after an Unlock) leaves BO "approved earlier". The Admin may still cancel or remove it as built.

### 3.8 Nothing may let a Lead or Admin change inputs without a trace (forbidden)

| Path | Rule after stage 2 |
|---|---|
| `PATCH .../inputs` by a Lead or Admin | Audited in the same transaction. If the audit entry fails, the save fails. |
| Picture add, replace or remove by a Lead or Admin | Audited, the same event |
| Add, move or delete part by a Lead or Admin | ~~**403**, nothing read or written~~ **Allowed, and audited in the same transaction** (`estimate.part_added`, `part_moved`, `part_deleted`): see section 3.9 (v1.1, DL-435). Do not build a 403. |
| Customer change | Audited (as built) |
| A body field naming a role, an actor or "skip audit" | None exists. Strict zod bodies refuse unknown keys. |
| A service built without `audit` | Refuses a Lead or Admin save |
| Direct database edits, scripts, import | None exists for inputs. Any later one must use `saveInputs`. |

### 3.9 The parts tree for a Lead or Admin (v1.1; replaces 3.2 item 3 and the tree row of 3.8)

**Statuses.** These are the same rules as the inputs (3.1), because every tree write already goes through `lockForChange`, which runs `assertEditable` under the row lock. Draft and Prepared (not ignored) are allowed. Approved and Quoted give 409 `ESTIMATE_APPROVED_IS_LOCKED`, so the Lead unlocks first. Ignored gives 409 `ESTIMATE_IGNORED`, so they restore first. No server rule changes. The 2,000-part limit (`TREE_FULL`) and the kind rules (`NODE_KIND_NOT_ALLOWED`, `MOVE_ACROSS_PARENTS`) are unchanged.

**Audit events** (new and wired; category `input_change`, "Input change"; written only when `viewer.role !== 'ENGINEER'`, in the write's own transaction, after the write and before commit. If the entry fails, the write fails. A write that changes nothing writes no entry. Object: the estimate, labelled with the task code. `after.actorRole` holds `'LEAD'` or `'ADMIN'`.)

| Event | `before` | `after` | Words on SCR-16 |
|---|---|---|---|
| `estimate.part_added` | `{}` | `{ actorRole, part: { slNo, kind }, parent: { slNo, name } \| null }` | "Added Sub-Assembly 1.4 under 1 Frame" |
| `estimate.part_moved` | `{ part: { slNo, name, kind } }` | `{ actorRole, part: { slNo, name, kind } }` (the Sl. No after the move) | "Moved 1.4 Top cover to 1.2" |
| `estimate.part_deleted` | `{ part: { slNo, name, kind }, rows: <count>, list: [{ slNo, name, kind }] }`, where `list` holds at most 100 rows in reading order, with `truncated: true` beyond | `{ actorRole }` | "Deleted 1.4 Top cover and 3 rows under it" |
| Picture | `estimate.inputs_changed`, field Part Model (3.2 (2)) | | "1.4 Top cover: Part Model, Picture replaced" |

- The input **values** of deleted rows are not copied into the log. The log stays bounded, and the same goes for an Engineer's delete. For an estimate that was calculated, the last calculation record still holds its copy of the tree (section 4.8), so the deleted values are recoverable from it.
- A batch delete writes **one** entry (the root row and its count), never one per row.
- Names are the `partNameOf` text at the time, which can be empty for a new row, and kinds are the stored node kinds (ADR-020). **The kind words come from the product's own names in `src/lib/estimate/node-kinds.ts` (`Main Assembly`, `Sub-Assembly`, `Part`, `Fastener`), never typed again in the event file**, so SCR-16, the ux ruling ("Delete 1.1 Sub-Assembly?") and the E2E tests use the same spelling.

**Concurrency with an Engineer at the same moment** (all as built; nothing new):
- Every tree write and every input save takes the **estimate row lock**, so they run one at a time, and `inputs_revision` rises once per write or not at all.
- **Move** checks the part's `revision`. If it changed, the answer is 409 with the fresh tree.
- **Delete** checks the part's `revision`, the **count** the person was shown, and the **subtree fingerprint**. If the Engineer typed into, added under or moved a row inside it since, nothing is deleted, and the answer is 409 with the fresh tree. The Lead sees the dialog's existing conflict words and the tree reloads.
- **Add** has no revision check: it goes last under its parent, both adds succeed, and the Sl. No values are read from the layout each time.
- If the Engineer saves a part that a Lead has just deleted, the answer is 404, and the workspace reads the tree again (the existing handling).
- Two Leads: the same rules apply.

**Figures and approval.** Every add, move and delete already raises `inputs_revision` (section 4.8; a move clears too, A-29), so the figures clear and approval is refused (`TOTALS_OUT_OF_DATE`) until Recalculate. A new row with blank required inputs makes Recalculate answer 422 `CALCULATE_BLOCKED`, naming it (6a A-5), so the Lead fills it first. The status stays as it is. The approved price (BO) is untouched. There is no step-up: the delete's existing confirmation dialog, with its row count, is the safeguard, and the audit entry is the trace.

**Screen.** Reuse the Engineer's tree actions: the add menu, row actions, move handle and menu, drag reorder, and the delete dialog from `components/features/estimate-workspace/`. Do not write a second copy. They are fetched lazily (first-open loader) only when the estimate is editable for this Lead or Admin. Whether SCR-06 shows them on its own review tree or swaps in the Engineer's tree while editing is the ux-expert's call. Either way the server rules above hold. Any tree write ends with the same once-only refresh from current to cleared (6a A-7).

**Tests to add** (replacing v1.0's 403 tests): integration, per event: one row with the right `before`, `after` and `actorRole`; no row for an Engineer; no row for a no-op move; rollback on audit failure. Lead delete against an Engineer's save in the same subtree gives 409, with nothing deleted. Approved, Quoted or Ignored gives 409 with no row. E2E at three widths with axe: a Lead adds a row, fills it and recalculates, then moves a row and deletes a row with the dialog. The ledger stays at +0 (the review spec's existing people). Unit: describe texts and the cap of 100 rows on `list`. Keep `image.test.ts:265` and the tree tests that assert a Lead may write, and add the audit assertions to them.

## 4. Security: server-side checks and tests

**Checks, in order, on every Lead or Admin input write:** session (401). Manifest role (403). Estimate exists and `mayOpen` (404). Row lock, then `assertEditable` (409 `ESTIMATE_IGNORED` or `ESTIMATE_NOT_EDITABLE` / `ESTIMATE_APPROVED_IS_LOCKED`). Part in the estimate (404). Part `revision` (409 `PART_CHANGED`). Field validation (422: a field must be on the form, a person-typed input and not Restricted). Conditional write. Audit entry. Commit.

**Tests (test-first; the developer names them by AC in the PR):**

| Level | Stage | Cases |
|---|---|---|
| Unit | 2 | `canEditInputs` table: role x status x ignored, 3 x 4 x 2, unchanged and pinned. The audit diff builder: only changed fields, material name, null for blank, a rule-zeroed field included. The event schemas refuse unknown keys and any figure key. `describe` text. The category list has the new entry. |
| Unit | 1 | The panel renders `PartForm` with `editable={false}` and no save control. The review imports the panel only through `import()` (source scan, the ADR-016 pattern). |
| Integration (real DB) | 2 | Lead and Admin save on Draft and on Prepared: exactly one `estimate.inputs_changed` row with `actorId`, `actorRole` and before and after of the changed fields only. A no-op save gives no row and no revision. Approved, Quoted and Ignored give 409 with no write and no row. Engineer save gives no row (unchanged). A forced audit failure rolls back the save (part revision and `inputs_revision` unchanged). A stale revision gives 409. An edit on Prepared makes the figure state `out-of-date`, approve gives 409 `TOTALS_OUT_OF_DATE`, then Recalculate and approve pass. ~~A Lead or Admin add, move or delete part gives 403 with nothing written (replacing the old "may" cases).~~ Tree writes by a Lead or Admin: the tests of section 3.9 (v1.1). A Lead picture change gives one audit row. Concurrency: Lead and Engineer save the same part at once, exactly one wins, and the other gets 409. |
| Security | 1 and 2 | The role matrix and identical-keys test for `/form`, `/tree` and `/nodes/{id}` are unchanged. The canary scan shows no figure on any Engineer-reachable answer or page. `engineer-import-rule` passes with the new file in the Restricted folder. **New:** an Engineer's PATCH on a Prepared estimate is still 409, and an Engineer's tree writes on their own Draft are still allowed and write no audit entry. The audit read as a Lead gives 403 (Admin only). |
| E2E (Playwright, 360, 768 and 1366 px, axe with the panel open) | 1 | The Lead and the Admin open a calculated estimate, choose a part, and see every input read-only with values equal to the Engineer's. The Engineer's SCR-05 is unchanged. |
| E2E | 2 | The Lead edits one field on a Prepared estimate: it is saved, the tiles show cleared, Recalculate restores them, and approve works. On an Approved estimate the inputs are read-only. |
| E2E person ledger | 1 and 2 | **+0 new person-making calls before `users.spec.ts:58`** (DL-422). Each new case reuses the Lead, Admin and Engineer its review spec already makes, or a person its shard already makes for that spec. The PR body states "+0 (DL-422)". If +0 cannot be reached, it goes to master before merge. |

## 5. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | **Today on `master`:** a Lead or Admin can change inputs, add, move or delete parts, and change pictures on Draft and Prepared estimates through direct API calls, **with no audit entry**. No screen reaches these paths. | Closed by stage 2 (3.2, 3.8). Until then, exposure is limited to signed-in Leads and Admins crafting requests. Stage 1 adds no new write. GitHub issue (architecture) raised with this note. |
| R-2 | `/estimates/[code]` first load: ceiling 192,500 B (DL-424). The last figure was 192,017 B, so **about 483 B of headroom**, shared first come, first served. | `PartForm` and its hooks are already in the route's client graph (the Engineer's branch), so reuse adds little. The panel is a lazy `import()`. **Expected growth: stage 1 +100 to 400 B, stage 2 +0 to 200 B.** Both together may come close to the ceiling. Each PR states its Stage 11b figure. If a PR would cross 192,500 B, it first moves something out (ADR-016), or comes to master and the product-manager before merge. |
| R-3 | Stage 2 is a critical story (§9 item 2) with one lane. CI and the combined review take time, and the freeze is Thu 3 Dec. | Staging (section 6). Stage 2's server half (audit for inputs, picture and tree; section 3.9) can merge before the UI if the UI slips. It is useful on its own because it closes R-1. |
| R-4 | A Lead and an Engineer on the same Draft part: the second gets a conflict and must re-type. | This is the existing behaviour, with a message. No lost update. Accepted. |
| R-5 | The UX ruling may want rule-hidden fields shown, or a layout `PartForm` cannot give. | That difference goes to the product-manager before the build (ED-AC-10). A second form copy is rejected (ED-AC-8). |

## 6. Effort, and the date

| Stage | Work | Developer-hours |
|---|---|---|
| **1 view** | Panel and review wiring (choose a part on SCR-06, lazy `PartForm` read-only) 3 h; tests (unit, E2E at three widths, axe, ledger +0) 2 h; Stage 11b measurement and a trim if needed 1 h; CI round 0.5 h | **6.5 h** (plus about 0.5 h for a reviewer's look at the role check; FR-115 is not a critical story) |
| **2 edit** | Audit event, diff builder and `saveInputs` wiring 2.5 h; picture audit 1 h; ~~tree 403 and test changes 1 h;~~ (removed in v1.1; section 6.1 governs); UI (`editable` from `canEditInputs` with the real role, autosave, `SaveGate`, leave guard, conflict message, figure refresh) 3 h; unit 1 h, integration 2 h, E2E 1.5 h | **12 h** |
| Review (stage 2) | Combined security-and-quality review 2 h; fixes 1.5 h | **3.5 h** |

**Date.** With **one lane** doing both, stage 1 (about 7 h with CI) plus stage 2 and its review (about 15.5 h) do not fit safely in Fri 27 to Sun 29 Nov. **With two lanes in parallel** (the orchestrator's plan of 27 Nov: lane 3 builds the view now, lane 2 builds the edit as soon as this note lands), each lane carries one stage:
- **View (lane 3):** merged by Sat 28 Nov, at the latest the end of Sun 29 Nov. **Committed.**
- **Edit (lane 2), conditional target of the end of Sun 29 Nov.** Server half first (audit event, picture audit, ~~tree 403s~~ tree audit per section 3.9, integration tests) as its own PR, merged by the end of Sat 28 Nov. It is useful alone, because it closes R-1. The UI PR is rebased on the view, ready for the combined review by **Sun 29 Nov 12:00**. It merges on Sunday only if the review finds no open Blocker or Critical and CI is green by **Sun 29 Nov 20:00**. **If either gate is missed, the edit UI does not merge for the demo.** It then merges by the end of Tue 1 Dec, with Wed 2 Dec as the hard cut-off (DL-432 option A). The demo then shows the view, plus the audited server edit path with no screen.
- Lane 2 and lane 3 both touch SCR-06's review components and the first-load headroom (R-2). The view merges first, and the edit rebases on it. Only one PR on the route at a time states the Stage 11b figure against the ceiling.
- The freeze on Thu 3 Dec is not at risk unless the combined review finds a Blocker late on Wed 2 Dec.

### 6.1 Effort and date after v1.1 (governs over the stage 2 rows and the date text above)

| Stage 2 part | Work | Hours |
|---|---|---|
| 2a Inputs edit | v1.0's 12 h minus the tree 403 (1 h) | 11 h |
| 2b Parts tree | Three audit events, their schemas and wiring in `addPart`, `moveNode` and `deleteNode` 2.5 h; unit 0.5 h; integration 2 h; SCR-06 tree actions reused, lazy, editable-gated 5.5 h; E2E at three widths with axe 2 h; Stage 11b measure and any trim 0.5 h | 13 h |
| Review | Combined review 2.5 h (one, covering both) plus fixes 2 h | 4.5 h |
| **Stage 2 total** | | **28.5 h** (was 15.5 h) |

Stage 1 (view) is unchanged at 6.5 h, on lane 3, merged by the end of Sun 29 Nov.

**Can the full edit scope (inputs and tree) be safely merged by the end of Wed 2 Dec with one lane (lane 2)? Yes, but only if lane 2 does nothing else from now until then.** That is about 28.5 h against about 4.5 lane-days (Fri 27 evening to Wed 2 Dec), leaving about one day of margin for CI rounds and review turnaround. If lane 2 also keeps its other items (DL-416 (5): the DEF-103 queue Sev-2, DEF-096, DEF-121), **the answer is no.** Three PRs, in this order:
1. **Server (audit for inputs, picture and the tree), about 8.5 h.** Merged by the end of Sun 29 Nov. It closes R-1 by itself.
2. **Inputs edit UI (2a), about 6 h of UI and tests.** Merged by the end of Tue 1 Dec, after the combined review (which covers 1 and 2).
3. **Tree UI on SCR-06 (2b screen part), about 7.5 h.** Merged by the end of Wed 2 Dec. **This is the part at risk.** It also competes for the about 483 B of first-load headroom (R-2) after the view and the inputs edit.

**If PR 3 misses Wed 2 Dec,** the server already allows a Lead's tree writes, audited, but no screen offers them. Nothing is untraced or unsafe. It would ship in the first update.

**The one question for the delivery lead (proposed):** "Lane 2 can deliver the input edit by Tue 1 Dec and the parts-tree edit by Wed 2 Dec only if it drops everything else, including the queue fix DEF-103 (a must-fix before G8). That fix would then move to lane 1 or lane 3. Do you want (A) lane 2 dedicated to the edit, with its other items moved to another lane (recommended), or (B) the input edit by Tue 1 Dec and the parts-tree edit in the first update after go-live?"

## 6a. Answers to the ux-expert's open points (ruling `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md`, a50a4e1d)

| Point | Answer |
|---|---|
| A-1 Which statuses allow an edit | Section 3.1. Draft and Prepared, not ignored. Approved and Quoted need Unlock first, and Ignored needs Restore first. This agrees with the ruling's 4.1. |
| A-2 Does the part read carry who last wrote a value, and when | **No.** `estimate_nodes` has no writer column, and the node answer carries only ID, revision, completeness, inputs and picture. Adding one is a migration plus a schema change on a route every role reads. Not worth it before the freeze. **Decision: drop the "Last changed by" line (ED-15 falls away).** The audit entry (A-3) is the record of who changed what. It is the Admin's alone and is never read into the form. |
| A-3 Is a Lead's or Admin's change audited, and as which event | **Yes:** `estimate.inputs_changed`, a new SCR-16 category **"Input change"** (section 3.4). Object column: the task code. Before to after: the part ("1.4 Top cover"), then per field "Length 450 to 480". A blank shows as `Not entered`. The actor's role is stored with the entry. The Engineer's saves are not logged. The ux-spec's SCR-16 event list gains the kind, and the product-manager confirms it (ED-AC-6). |
| A-4 A shared save gate for Inputs and Recalculate | **Yes.** It is one client context at the review's root holding a `SaveGate` (`src/lib/estimates/save-gate.ts`, the same type the Engineer's Calculate waits on). The inputs island registers its saves in it. Recalculate awaits it (flush, then send), as the Engineer's Calculate does (ED-7). The server does not depend on it: Recalculate runs under the estimate row lock, so a save that commits after it simply clears the figures again. The gate is for correctness of what the Lead sees, not for safety. The fallback (Recalculate disabled while saving) is acceptable only if the context cannot be built. |
| A-5 What a Recalculate refused for blank inputs returns | The **same answer as Calculate**: 422 `CALCULATE_BLOCKED`, listing each part (`nodeId`, `slNo`, name) and its missing fields (`fieldId`, label), with nothing written (`calculation-service.ts`; the client type is `BlockedPartView` in `src/lib/estimates/calculate-missing.ts`). The ruling's 4.3 item 4 can name the parts and fields and open them on their rows from it. No server change is needed. |
| A-6 Any status event beyond `EDIT` on Prepared | **None.** `EDIT` is Prepared to Prepared and only gates the write (`canEditInputs`). Nothing is written to `status`. The estimate stays Prepared, and a Lead's Recalculate on a Draft sets Prepared, as built (A-08). |
| A-7 `router.refresh()` after a cleared-figure save | **Acceptable, with a narrower rule.** Refresh **once, when the figure state goes from current to cleared** (the first real save after a calculation). Later saves change no figure on the page, so they do not refresh. After Recalculate the page refreshes as built. That is at most one extra review read per edit session. It is within NFR-008 and lighter than debounced per-burst reads. |
| Assumptions in the ruling's 4.5 | **Confirmed:** no step-up for an input edit; the status stays Prepared after an edit; approval is blocked until Recalculate (`TOTALS_OUT_OF_DATE`, server-side); an edit never touches an approved price. |

### 6b. Answers to the ux-expert's open points in ruling rev 2 (v1.2)

| Point | Answer |
|---|---|
| O-1 Can `usePartsTree` serve the review island? | **Yes, and it should be the island's only source for rows and tree writes.** `usePartsTree(estimateId, onServerIgnored)` reads `GET /tree` (`ALL_ROLES`, one schema, no figure). It holds each row's `id`, `parentId`, `slNo`, `label`, `nodeKind`, `completeness` and `revision`. It also builds the delete guard (count and subtree fingerprint) and handles the 409 "changed under you" with the fresh tree, so a Lead's move and delete get the same protection as the Engineer's. The review's second line (the row's figures) is **joined by node `id`** from the page's `costs`, never stored in the hook. **Do not seed the tree writes from the page's review nodes:** a move and a delete need the revision and fingerprint as the tree read gives them, and a second source could disagree. The page's nodes may be the first paint only, until the hook's read arrives. After any tree write, every figure is cleared on the server, so the joined second line shows `Cleared` until Recalculate and its refresh. The hook lives in the shared `estimate-workspace` folder and imports nothing Restricted, so a Restricted island may import it, not the other way round. It is already in the route's client graph through the Engineer's workspace, so reuse adds next to nothing to the first load (R-2). Cost: one extra `GET /tree` when the island first mounts, which is acceptable under NFR-008. |
| O-3 Tree controls unavailable while a Recalculate runs | **Keep it.** Safety does not need it: Recalculate holds the estimate row lock, so a tree write waits for it, then lands and clears the new figures again. For the person's sake it is right. Recalculate does **not** block the whole page, so the island must say why its controls are inactive. Carry the flag in the same client context as the shared `SaveGate` (6a A-4), as `calculating`, which the Recalculate button sets for the life of its request. Add, move, delete and the inputs show the ruling's reason `Calculating. This takes a moment.` while it is true. No server change. |

## 7. Issues for other roles

- **orchestrator:** asks the delivery lead DL-432's staging question (A: view by Sunday, edit by Tue 1 Dec, cut-off Wed 2 Dec). Recommended: A.
- **master:** (1) *Withdrawn in v1.1:* the tree 403 is not built. The writes stay allowed, as DL-303 (3) left them, and are now audited (3.9). The product-manager lifts PRD 0.62's tree waiver. (2) The brief said Unlock has a step-up: **it does not, as built**, and this note adds none.
- **product-manager:** PRD 0.62 ED-AC-7 says "the edit route accepts a save only from a Lead or Admin". The same route also takes the Engineer's own Draft saves (FR-064). Suggested wording: "a Lead's or Admin's save is accepted only through the role's rules in this note, and an Engineer's rights are unchanged". ED-AC-6: the event is `estimate.inputs_changed`, and Engineer saves stay unaudited.
- **ux-expert:** the panel must reuse `PartForm`. Rule-hidden fields follow the Engineer's form unless you rule otherwise. After a save on Prepared, the tiles must visibly show "cleared, Recalculate".
- **qa-engineer:** DEF-131's QA acceptance #2 ("no PUT from that screen") holds for stage 1 only. Stage 2 adds the PATCH by design.

## Change log
| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-27 | First issue, for DEF-131 and DL-432 |
| 1.1 | 2026-11-27 | The delivery lead's answers: staging A (edit by Wed 2 Dec, Sunday gates withdrawn) and "also the parts tree". The tree 403 is reversed. Section 3.9 adds `estimate.part_added`, `part_moved` and `part_deleted`, with the tree's concurrency, figures and approval. Section 6.1: stage 2 is 28.5 h. Wed 2 Dec holds only with lane 2 dedicated. Master's item (1) in section 7 is withdrawn. |
| 1.2 | 2026-11-27 | DL-435 clean-up: the stale "403" text in section 3.2 item 3 and section 3.8's tree row is struck through, with pointers to section 3.9. The same goes for the leftover 403 lines in section 4 (checks, integration and security tests), R-3, and the v1.0 effort and date text (section 6.1 governs). "Sub-Assembly" is spelled as the product names it, and the kind words come from `node-kinds.ts`. Section 6b answers the ux-expert's O-1 (`usePartsTree` serves the review island; figures joined by node ID) and O-3 (tree controls inactive during Recalculate, through the shared context's `calculating` flag). |
