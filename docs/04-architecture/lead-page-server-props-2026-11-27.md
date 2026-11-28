# The Lead's review page: the part form's data as server props (architecture note, 2026-11-27)

| Field | Value |
|-------|-------|
| Status | **Accepted** as the architecture's reading of PR #827 (DEF-141, Jira AQP-498, DL-455 step 1). Goes into `architecture.md` at the G8 records pass (section 4 below) |
| Author | solution-architect |
| Reviewed | PR #827 at head 90520f83 (`fix/AQP-498-lead-page-server-props`), findings ARC-827-01 to ARC-827-06; re-read at 0793b7d5 (DL-457 combined read `getPartForm`), finding ARC-827-07. **v1.3:** PR #836 at fcab064f (ARC-836-01 to -04) and PR #811 at b8934a57 (ARC-811-01 to -03), section 5e |
| Related | ADR-008 (server-side role projection), ADR-010 (route handlers, no server actions), ADR-016 (estimates first load); architecture section 6 "Style" and "One route, one schema", section 8 TB-2, section 10 layering table; `lead-admin-input-edit-2026-11-27.md` v1.2 section 6b O-1; DL-451, DL-452, DL-455; NFR-001, NFR-002, NFR-008, NFR-009 |

## 1. What changed in the loading pattern

Before #827, the Lead's and the Admin's SCR-06 drew the Engineer's `PartForm` (since #800), and the form read four answers from the browser after hydration: `GET /estimates/{id}/form`, `GET /options/materials`, `GET /estimates/{id}/nodes/{nodeId}` and `GET /options/treatments`. After #827, the server page reads the same four answers and hands them to the form as one prop, `seed` (`PartFormSeed`).

This is not a new architecture. Section 6 already says: "Server Components call services directly for first paint, through the same projections." #827 brings the Lead's page back in line with that rule. No ADR is needed: the change is cheap to reverse (drop the prop and the hooks fetch as before), and it adds no container, dependency or trust boundary.

## 2. The rules #827 sets (and every later seeded island follows)

1. **One body builder per route answer, called by both the route and the page.** `src/server/views/part-form-bodies.ts` builds each answer through the route's own strict schema. The route handler returns the builder's output, and the page passes the same output as a prop. So the prop has the route's shape, with no added field, by construction. The route contract does not change: same schema, same status codes, same generic 500 on a schema miss.
2. **The page reads through the same service methods, as the same viewer.** `getForm(viewer, id)` and `getNode(viewer, id, nodeId)` apply the service's `mayOpen` check, the one place where per-estimate access is decided (NFR-001). The option lists are `ALL_ROLES` routes with no per-object check, and the page has already passed `authorizePage`. No role check is added or copied in the page.
   **Combined reads (v1.1, DL-457).** A page may instead call one service method that answers what several route methods answer, to avoid repeating the access check and the reads. `EstimateService.getPartForm(viewer, id, nodeId)` returns `{ form, node }` with one `openForRead`, one `listNodes`, one `viewReaders` and one `lastWrittenAt`. It is allowed on three terms. (a) It lives in the service, behind the same `openForRead`, never in the page. (b) It is built from the same private steps as the methods it stands for (`partIn`, `viewsOf`, `formOf` and `visibleInputsOf` from `EstimateInputs`). (c) A unit test asserts, for every role, every estimate state and every refusal, that its output equals those methods' output as JSON. That equivalence test is what keeps the methods in step. The route methods (`getForm`, `getNode`) stay as they are.
3. **The seed is plain data, typed `unknown` on the client, and read by the client's own response readers** (`parseForm`, `parseMaterials`, `parsePartInputs`, `parseTreatmentOptions`). A body a reader refuses is treated as no seed, and the hook fetches.
4. **The seed names what it is for** (`estimateId`, `partId`). A hook uses it only when both match. Otherwise it fetches.
5. **A seed is the start of a mounted island, not its life.** Each hook reads the seed once per mount (`useState` initialiser). Every later read (Try again, read again, a 409, a part the seed does not name) goes to the route, as before. A new set of props after `router.refresh()` does not reset a mounted form, so nothing typed is lost.
6. **A fault in a seed read is not a page fault.** The page logs the kind of fault only (no cause, no estimate), passes no seed, and the form fetches as it did before #827.
7. ~~**The Engineer's path is unchanged.**~~ **Superseded by DL-469 (v1.3, 2026-11-27).** The Engineer's branch of `page.tsx` may seed its `PartForm` on rules 1 to 6 and rule 8, through one combined read, `EstimateService.getFirstPartForm(viewer, id)` (the first row in `getTree`'s order, which is the row the workspace shows until another is chosen). DL-469 (a) to (g) are the terms: the same Engineer-safe bodies with no field added, the canary scan over the flight payload, the Engineer import rule and the role matrix green. The Lead's review code (`review-page.tsx` and below) is still loaded on the Lead's and the Admin's branch only. The Engineer's branch imports only `part-form-seed.ts` and the server ghost `engineer-ghost.tsx`.
8. **(v1.3) Values and the revision a save sends are one snapshot.** This rule applies to every page seed. A seed's part body is used only when its `revision` equals the revision the form will send, and that revision must come from the same snapshot: from a tree seed of the same listing, or, before any tree is read, from the seed's own part body. Otherwise the form reads the part from the route. If the form still shows a seed's values and has not saved, and a read then changes the revision it would send (for example a tree read that lands later; this form's own save does not count), the form reads the part again before it sends. A tree seed is whole or nothing: it is the tree of the same listing as the part body, or it is not used. Section 5b explains how this applies to the Engineer and to the Lead.

## 3. Readings

| Question | Reading |
|---|---|
| Layering (section 10) | Conforms. The body builders are projections and schemas, so they belong in `server/views`. `src/app` reaches data through services (`composition`) and views only. No repository and no `lib/formula` is imported. The fault policy in `part-form-seed.ts` is presentation, like `markerOf` in `review-page.tsx`, not business logic |
| NFR-002: can a cost reach an Engineer? | **No path.** The Engineer gets no seed. And the four bodies are the Engineer-reachable shapes (section 6, "One route, one schema"), which the strict-schema test and the canary scan already hold to no rate, cost or formula. So even a seed sent to an Engineer would carry nothing Restricted. TB-2's RSC-props threat is unchanged |
| Classification of `part-form-seed.ts` | It holds nothing Restricted: the form definition, material and treatment IDs and names, and a part's typed inputs (**Confidential**). Its comment calls it "Restricted with the review". It is loaded with the review, but no test enforces that, and none needs to, for NFR-002. ARC-827-01 asks for the wording to say "loaded with the review, holds no Restricted data", or for the AC-5 test to name it |
| Freshness | The seed is the render's snapshot, the same moment as the figures on the page. This is **more** consistent than before, when the inputs were read later than the figures. A back or forward navigation may restore an older payload from the client router cache. The figures and the inputs are then old together, and any write is still checked by its revision (409, then a fresh read). Freshness after an action is as before: `router.refresh()` re-renders the server parts, and a mounted form keeps its state |
| Server time | `readPartBody` runs after the first `Promise.all`, because the row's ID comes from `costs.nodes`. That is one serial service call per render. It is the performance lens's to weigh against DL-455's statement proof (ARC-827-05) |
| First load (ADR-016) | No new client module. `use-form-definition.ts` already imported `form-client`. The seed type is type-only. `TreatmentSeedContext` lives in a module that was already in the lazy part-form chunk |

## 4. Line for `architecture.md` at the G8 records pass

Add to section 6, after "Style":

> **Seeded client islands (PR #827, DEF-141).** When a server page draws a client component that would otherwise fetch from `/api/v1` after hydration, the page may hand it the route's answer as a prop. The answer is built by the same body builder the route calls (`src/server/views/*-bodies.ts`), from the same service method, as the same viewer, so the prop has the route's shape and access check. The client reads it with its own response reader, uses it once per mount and only when it names the same estimate (and part or row) **and its revision is the one the save will send** (rule 8), and fetches otherwise. Every read after the first, and every write, goes to the route. A fault in a seed read gives no seed. The Engineer's workspace is seeded the same way, by one combined read of the tree's first row (DL-469).

Add a row to the section 10 layering table: "A route answer that a page also hands to a client island is built by one function in `src/server/views`, which both call. | Review; the island's unit test compares the prop with the route's JSON."

## 5. #811's tree-edit island (DL-455 step 2): the pattern applies, on these terms

DL-455 step 2 has #811's island reuse the server-drawn data and get `/tree` as page props. This **supersedes the cost line of `lead-admin-input-edit-2026-11-27.md` v1.2 section 6b O-1** ("one extra `GET /tree` when the island first mounts"). The rest of O-1 stands.

1. **`usePartsTree` stays the island's only source for rows and tree writes.** Its seed is the full `GET /tree` body (`partsTreeSchema`), built by a `treeBody()` builder that the `/tree` route also calls. The seed is **never** derived from `costs.nodes`: a move and a delete need each row's `revision` and the subtree fingerprint as the tree read gives them (O-1).
2. **The row check:** the tree seed names its `estimateId`. `usePartsTree` uses it once per mount, only when it matches. Every write, every 409 "changed under you" and every Try again reads the route.
3. **No second `/form` or `/materials`:** the island uses the form seed from #827. **v1.1: the tree comes from the same combined read.** `getPartForm` already lists the nodes and builds `viewsOf(records, readers)`, which is exactly what `getTree` answers. So #811 extends that combined read to return `{ form, node, tree }` (the name may widen, for example to `getReviewInputs`), with the tree as `getTree` builds it. It adds no third access check, listing or `viewReaders`. The page passes the tree through `treeBody()`, and the equivalence test gains `tree` equal to `getTree`, as JSON, for every role and state. The tree body must still be the full `/tree` answer (item 1), not `costs.nodes`.
4. **The part form's revision comes from the tree hook's row**, replacing the `revision: 0` placeholder at `estimate-review.tsx:207`. Before #811, the Lead's form is read-only, so the placeholder is harmless. Once the Lead edits, a save must send the revision of the same snapshot as the values.
5. **After a tree write**, the once-only `router.refresh()` (current to cleared, lead-admin note 6a A-7) re-renders the figures, and the mounted island keeps its own, newer rows. The figure line is joined by node `id` and must show "Cleared" for a row that the costs do not hold yet.
6. **Body builder module:** either rename `part-form-bodies.ts` to a general name, or add `tree-bodies.ts` beside it. The rule is one builder per route answer, not one file. **(v1.3: relaxed. The module may keep its name, see section 5d item 1.)**
7. **Per-row growth (DL-455 (7) (c)):** with the tree as props, the payload holds the rows twice (the tree body and `costs.nodes`), which is linear in the number of rows. There are no reads per row. #811's proof at 50 or more rows shows both.

## 5a. Server-drawn placeholders (v1.2, DEF-145, ux ruling `partform-placeholder-shape-2026-11-28.md`)

- **Budget.** CI stage 11b counts only first-load **JavaScript**: the script files each page names from `.next/static`, gzip level 9 (`scripts/check-js-budget.ts`). The document's HTML and the RSC payload are not counted. A ghost made only of markup costs nothing against stage 11b. It does add HTML, and it still counts toward NFR-009's LCP and TBT (Lighthouse), so it stays plain markup with no client component.
- **Engineer's workspace (SCR-05).** The layering allows the Engineer's branch of `page.tsx` to read `getEstimateService().getForm(viewer, id)` and pass it through `formBody()`. It may then render a **server component** ghost from that body and hand it to `EstimateWorkspace`, and on to `PartForm`, as a `ReactNode` prop, the same way `cards` (`TaskCards`) is handed in today. This follows section 6: Server Components call services for first paint, through the same projection. The form body is the one no-cost schema (NFR-002). Terms:
  - The ghost file has no `'use client'` and no hooks, and imports no Restricted module.
  - A fault in the read gives no ghost, and the existing skeleton is shown.
  - The ghost is only a placeholder. It holds no control and no state, and the client form replaces it.
  - ~~On the Engineer's page this adds one `getForm` read per render, while `useFormDefinition` still reads `/form` after hydration. That double read is accepted for the ghost alone. Seeding the Engineer's form with the same body would remove it, but it changes the Engineer's path, which DL-455 (3) (a) kept unchanged for DEF-141. So it is master's decision, and it is not part of DEF-145.~~ **Superseded by DL-469 (v1.3).** Master decided this: the Engineer's form is seeded (#836). The ghost is drawn from the seed's form body (`engineerGhostFrom`), so the page makes one combined read (`getFirstPartForm`) and no separate `getForm`, and the double read no longer exists. The ghost still takes the definition only, never the part's values (PF-3, PF-15).

## 5b. Rule 8 for each seed (v1.3, 2026-11-27, QLT-836-01)

| Seed | When the form mounts | What rule 8 asks |
|---|---|---|
| **Engineer (#836)** | Only after the tree is known. `part` is `null` while the tree is unread, so the ghost shows (PF-7) | A check when the form mounts is enough: in `usePartValues`, accept the seed only when `parsed.revision === part.revision`, otherwise read. When the tree seed (section 5d) is accepted, the two revisions are equal by construction, because they come from one `listNodes`. When the tree seed is refused, the tree is read later and the check reads the part fresh. **Keep the check after the tree seed lands** |
| **Lead's island (#811)** | Can mount **before** the tree is read: the rows are `pageItems`, and the first row's revision is `selectedRevision`, which is the seed's own | When the tree seed is accepted, the rows and the part body are one listing, so this conforms. When it is refused, the form mounts with the seed's values and the seed's revision. The check at mount then passes, and the later `/tree` read moves `part.revision` (and `revisionRef`) to the newer revision under the older values. Either of two shapes conforms. **(i), preferred because it is local to #811:** the island hands its form the seed only when `usePartsTree` started from the tree seed. **(ii)** the shared hook reads the part again when `part.revision` changes from outside while it holds seeded values and has not saved |
| Lead, stage 2 (server-drawn form) | `editable={false}` | No save, so rule 8 is not engaged |

**Tests.** (1) The seed's part body has `revision: 5` and the row has `revision: 6`: the part is read once and the server's values are shown. (2) The revisions are equal: no read. (3) Lead: the tree seed is refused, so the island's form gets no seed (shape i), or it reads once when the tree lands (shape ii).

## 5c. The Lead's first paint has three stages (v1.3, ux ruling section 9, second correction)

| Stage | What the page shows | Where it comes from | What it reserves |
|---|---|---|---|
| 1 | The **ghost** in the form's block, until the fields chunk arrives | A server element built from `seed.form` and `seed.part` (`ghostOf`, `editable` follows the page, the picture box knows whether a picture is held) | The tree: PF-20 (below) |
| 2 | The **read-only form with the saved values** (`editable={false}`, seeded, `stored: ready` at once), until the island's code arrives | The same seed | **PF-19:** a least height on `#row-inputs` for `[data-picture-zone]`: `PICTURE_ZONE_RESERVE` when the box is empty, `_HELD` when a picture is held. The tree: PF-20 |
| 3 | **The island** (`ReviewEditShell` swaps in `ReviewTreeEditor`) | `usePartsTree` starts from the tree seed. `ReviewForm` is editable and gets the same seed (under rule 8) and the same ghost | None. The reserves are gone |

**Architecture terms.**
- (a) Every reserve is server-drawn markup with no JavaScript. It is `inert`, `aria-hidden`, marked `data-review-tree-reserve`, and has no control (PF-20.3).
- (b) Sizes come from the shared constants in `form-layout.ts`. Where a string cannot be imported without changing the first-load modules, a copy is allowed only with a unit test that reads both and fails when they differ. `tree-chrome.ts` holds `TREE_FOOT` and `TOOLBAR_RESERVE`; `review-tree-reserve.test.ts` and `picture-zone-reserve.test.ts` are those tests.
- (c) `#review-actions` moves 8 px or less at **each** step (PF-21a).
- (d) Named for the G8 list: a long picture file name wraps, so the held height can be exceeded. Server-drawn values at stage 1 are a post-G8 item.
- (e) **PRF-811-08 is accepted.** The island, a client file, may import the review's frame, row and words (`importers = [REVIEW_PAGE, TREE_EDITOR]`, pinned by `estimate-review-architecture.test.ts`). These carry layout and words but no value. The values arrive as props from a branch that only a Lead or an Admin reaches. A third importer needs this note amended.

## 5d. One `treeBody()`, and how #836's tree seed builds on #811 (v1.3, DL-469 (4))

1. **One builder.** `treeBody()` is in `src/server/views/part-form-bodies.ts` (#811). `GET /tree`, the Lead's page and the Engineer's page all call it. Item 6 of section 5 is relaxed: the module may keep its name, because the rule is one builder per answer. Its doc comment must list the five answers.
2. **#836 takes #811 by a merge** (DL-442, DL-469 (f)). If #811 is not on `master` by the end of Mon 30 Nov, lane 3 builds `treeBody`, `partDetailOf` and the hook's `seed` option **to #811's exact signatures**, and lane 2 takes lane 3's copy. Never two copies.
3. **`getFirstPartForm` returns `{ form, node, tree }`** from one `openForRead`, one `listNodes`, one `viewReaders` and one `lastWrittenAt`. `tree` is `viewsOf(records, readers)`, and `node` is #811's `partDetailOf` of `tree[0]`, so there is no third copy of the node assembly (QLT-836-02). This gives one tree query and no read per row (DL-469 (4) (i)).
4. The page passes the tree through the same `treeBody`. `FirstRowBodies` gains `tree` from `PartFormBodies`.
5. The Engineer's `usePartsTree` takes it through #811's `seed` option and `parseTreeAnswer`. There is no second option and no second reader.
6. **Where a tree seed is sent.** The Engineer's seed carries the tree **in every state**, because the workspace reads `/tree` in every state. The Lead's seed carries it only where the island is drawn (`treeActionsOffered`).
7. **Equivalence test.** The test gains `tree` equal to `getTree`, as JSON, for the Engineer's role × state × ignored grid **and the frozen-registry case** (QLT-836-03).
8. The proof (DL-469 (d)) and Stage 11b at 194,000 B or below (DL-468) are read on the final shape only.

## 5e. Conformance at the reviewed heads (v1.3)

| ID | PR | Severity | Finding | Fix |
|---|---|---|---|---|
| ARC-836-01 | #836 at fcab064f | **Major** | Rule 8 is not met (the same finding as QLT-836-01). The seeded values are from the render, and the revision is from the later `/tree` read | The check in `usePartValues` described in section 5b, plus tests 1 and 2 |
| ARC-836-02 | #836 | Minor | Nothing pins rule 1 for `formBody` in `readFirstPartFormBodies` (the same finding as SEC-836-01) | The behavioural test in the review |
| ARC-836-03 | #836 | Minor | `getFirstPartForm` is a third copy of the node assembly, and its frozen-registry case is untested (QLT-836-02, -03) | Section 5d items 3 and 7, in the tree-seed delta |
| ARC-836-04 | #836 | Info | Stage 11b reads 193,122 B on #836 alone. The figure that counts is the one after #811 and the delta | DL-468 (2): read before the squash |
| ARC-811-01 | #811 at b8934a57 | Minor | Rule 8 has a gap on the fallback path (a refused tree seed; section 5b). The path is latent: `part-form-seed.test.ts` asserts that the reader accepts the builder's tree. But it would be a silent lost update | Shape (i) in section 5b, plus test 3 |
| ARC-811-02 | #811 | Info | Two comments are wrong. The doc comment of `part-form-bodies.ts` still says "four answers". `form-layout.ts` names `form-layout.test.ts`, but the test is `picture-zone-reserve.test.ts` | Correct both comments |
| ARC-811-03 | #811 | Info | The PRF-811-08 rule change is accepted (section 5c (e)) | None |

Everything else conforms. For #836: rules 1 to 6, the new rule 7 and section 5a. For #811: section 5 items 1 to 5 and the new item 6, PF-19, PF-20 and the three stages of section 5c. The performance terms (PRF-811-02 to -04, DL-463, DL-469 (d)) belong to the performance lens and are not graded here.

## 6. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-27 | First version, from the architecture review of PR #827 at 90520f83 |
| 1.1 | 2026-11-27 | Re-read at 0793b7d5 (DL-457). Section 2 rule 2 gains "Combined reads": allowed in the service, from shared private steps, with a JSON equivalence test. Section 5 item 3: #811's tree comes from the same combined read (`{ form, node, tree }`), not a third access check. ARC-827-07 (Minor): `getNode` and `getPartForm` repeat the node assembly, so share a private `partDetailOf` |
| 1.2 | 2026-11-28 | Section 5a: server-drawn placeholders (DEF-145). Stage 11b counts JavaScript only. The Engineer's page may hand `PartForm` a server-rendered ghost built from `getForm` through `formBody`, like `cards`. Seeding the Engineer's form is master's decision |
| 1.3 | 2026-11-27 | DL-469 supersedes section 2 rule 7 and the last term of section 5a: the Engineer's form is seeded by `getFirstPartForm`, and the ghost comes from the seed. New rule 8: values and the revision a save sends are one snapshot (QLT-836-01), with how it applies to each seed (section 5b). The Lead's three-stage first paint and the PF-19 and PF-20 reserves (section 5c). PRF-811-08 accepted. One `treeBody()`, and #836's tree seed built on #811 (section 5d). Conformance of #836 at fcab064f and #811 at b8934a57 (section 5e). The section 4 line gains the revision term and the Engineer's seed |
