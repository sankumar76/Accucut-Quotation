# The Lead's review page: the part form's data as server props (architecture note, 2026-11-27)

| Field | Value |
|-------|-------|
| Status | **Accepted** as the architecture's reading of PR #827 (DEF-141, Jira AQP-498, DL-455 step 1). Goes into `architecture.md` at the G8 records pass (section 4 below) |
| Author | solution-architect |
| Reviewed | PR #827 at head 90520f83 (`fix/AQP-498-lead-page-server-props`), findings ARC-827-01 to ARC-827-06; re-read at 0793b7d5 (DL-457 combined read `getPartForm`), finding ARC-827-07 |
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
7. **The Engineer's path is unchanged.** `page.tsx`'s Engineer branch builds no seed and calls no new service. The seed code is reached only through `review-page.tsx`, which `page.tsx` loads by dynamic `import()` on the Lead's and the Admin's branch.

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

> **Seeded client islands (PR #827, DEF-141).** When a server page draws a client component that would otherwise fetch from `/api/v1` after hydration, the page may hand it the route's answer as a prop. The answer is built by the same body builder the route calls (`src/server/views/*-bodies.ts`), from the same service method, as the same viewer, so the prop has the route's shape and access check. The client reads it with its own response reader, uses it once per mount and only when it names the same estimate (and part or row), and fetches otherwise. Every read after the first, and every write, goes to the route. A fault in a seed read gives no seed. The Engineer's pages are unchanged unless an ADR says otherwise.

Add a row to the section 10 layering table: "A route answer that a page also hands to a client island is built by one function in `src/server/views`, which both call. | Review; the island's unit test compares the prop with the route's JSON."

## 5. #811's tree-edit island (DL-455 step 2): the pattern applies, on these terms

DL-455 step 2 has #811's island reuse the server-drawn data and get `/tree` as page props. This **supersedes the cost line of `lead-admin-input-edit-2026-11-27.md` v1.2 section 6b O-1** ("one extra `GET /tree` when the island first mounts"). The rest of O-1 stands.

1. **`usePartsTree` stays the island's only source for rows and tree writes.** Its seed is the full `GET /tree` body (`partsTreeSchema`), built by a `treeBody()` builder that the `/tree` route also calls. The seed is **never** derived from `costs.nodes`: a move and a delete need each row's `revision` and the subtree fingerprint as the tree read gives them (O-1).
2. **The row check:** the tree seed names its `estimateId`. `usePartsTree` uses it once per mount, only when it matches. Every write, every 409 "changed under you" and every Try again reads the route.
3. **No second `/form` or `/materials`:** the island uses the form seed from #827. **v1.1: the tree comes from the same combined read.** `getPartForm` already lists the nodes and builds `viewsOf(records, readers)`, which is exactly what `getTree` answers. So #811 extends that combined read to return `{ form, node, tree }` (the name may widen, for example to `getReviewInputs`), with the tree as `getTree` builds it. It adds no third access check, listing or `viewReaders`. The page passes the tree through `treeBody()`, and the equivalence test gains `tree` equal to `getTree`, as JSON, for every role and state. The tree body must still be the full `/tree` answer (item 1), not `costs.nodes`.
4. **The part form's revision comes from the tree hook's row**, replacing the `revision: 0` placeholder at `estimate-review.tsx:207`. Before #811, the Lead's form is read-only, so the placeholder is harmless. Once the Lead edits, a save must send the revision of the same snapshot as the values.
5. **After a tree write**, the once-only `router.refresh()` (current to cleared, lead-admin note 6a A-7) re-renders the figures, and the mounted island keeps its own, newer rows. The figure line is joined by node `id` and must show "Cleared" for a row that the costs do not hold yet.
6. **Body builder module:** either rename `part-form-bodies.ts` to a general name, or add `tree-bodies.ts` beside it. The rule is one builder per route answer, not one file.
7. **Per-row growth (DL-455 (7) (c)):** with the tree as props, the payload holds the rows twice (the tree body and `costs.nodes`), which is linear in the number of rows. There are no reads per row. #811's proof at 50 or more rows shows both.

## 5a. Server-drawn placeholders (v1.2, DEF-145, ux ruling `partform-placeholder-shape-2026-11-28.md`)

- **Budget.** CI stage 11b counts only first-load **JavaScript**: the script files each page names from `.next/static`, gzip level 9 (`scripts/check-js-budget.ts`). The document's HTML and the RSC payload are not counted. A ghost made only of markup costs nothing against stage 11b. It does add HTML, and it still counts toward NFR-009's LCP and TBT (Lighthouse), so it stays plain markup with no client component.
- **Engineer's workspace (SCR-05).** The layering allows the Engineer's branch of `page.tsx` to read `getEstimateService().getForm(viewer, id)` and pass it through `formBody()`. It may then render a **server component** ghost from that body and hand it to `EstimateWorkspace`, and on to `PartForm`, as a `ReactNode` prop, the same way `cards` (`TaskCards`) is handed in today. This follows section 6: Server Components call services for first paint, through the same projection. The form body is the one no-cost schema (NFR-002). Terms:
  - The ghost file has no `'use client'` and no hooks, and imports no Restricted module.
  - A fault in the read gives no ghost, and the existing skeleton is shown.
  - The ghost is only a placeholder. It holds no control and no state, and the client form replaces it.
  - On the Engineer's page this adds one `getForm` read per render, while `useFormDefinition` still reads `/form` after hydration. That double read is accepted for the ghost alone. **Seeding the Engineer's form** with the same body would remove it, but it changes the Engineer's path, which DL-455 (3) (a) kept unchanged for DEF-141. So it is master's decision, and it is not part of DEF-145.

## 6. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-27 | First version, from the architecture review of PR #827 at 90520f83 |
| 1.1 | 2026-11-27 | Re-read at 0793b7d5 (DL-457). Section 2 rule 2 gains "Combined reads": allowed in the service, from shared private steps, with a JSON equivalence test. Section 5 item 3: #811's tree comes from the same combined read (`{ form, node, tree }`), not a third access check. ARC-827-07 (Minor): `getNode` and `getPartForm` repeat the node assembly, so share a private `partDetailOf` |
| 1.2 | 2026-11-28 | Section 5a: server-drawn placeholders (DEF-145). Stage 11b counts JavaScript only. The Engineer's page may hand `PartForm` a server-rendered ghost built from `getForm` through `formBody`, like `cards`. Seeding the Engineer's form is master's decision |
