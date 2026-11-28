# Review Report — PR #836 (AQP-441 / DEF-085: the Engineer's form gets its data as server props, DL-469) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality, as the CLAUDE.md §9 (2) combined security-and-quality review (a critical story: Engineer cost visibility, NFR-002). Security lens first, then quality |
| Review round | 1 (everything except the tree seed, which comes later as a delta) |
| Base…branch | `master...fix/AQP-441-engineer-form-seed` (PR [#836](https://github.com/sankumar76/Accucut-Quotation/pull/836), draft), 0 behind master `46490f27` |
| Commit reviewed | **`fcab064f2260598e80dace6101007faeefeea8d8`** |
| Date | 2026-11-27 |
| Reviewed against | NFR-001, NFR-002, NFR-009; DL-469, DL-470, DL-471, DL-468 (194,000 B); ux ruling `docs/03-ux/rulings/partform-placeholder-shape-2026-11-28.md` sections 7 to 9 (PF-1 to PF-21); architect note `docs/04-architecture/lead-page-server-props-2026-11-27.md` v1.2 sections 2, 5 and 5a; prior reviews `pr-833-combined.md` (SEC-833-10, -11) and `pr-833-quality.md` |
| **Verdict** | **REQUEST CHANGES.** **0 Blocker, 0 Critical, 1 Major, 7 Minor, 3 Info.** No Blocker or Critical is open, so the §9 (2) stop does not apply. The one Major (QLT-836-01, a stale seed against a newer revision) should be fixed before merge |

## Summary

**NFR-002 holds.** I found no way for a cost, rate, price or formula, or a cost-bearing attribute, class or data, to reach the Engineer. The seed is the four route bodies, built by the routes' own strict builders (`part-form-bodies.ts`) as the same viewer. The ghost is drawn from the definition body only. The strict scan now runs on the ghost the page really hands over and on the real `PartFields` second wait, and its 23 × 11 matrix and the other mutants still all fail. SEC-833-10 and SEC-833-11 from #833 are closed.

**Authorization holds.** `getFirstPartForm` goes through the same `openForRead` / `mayOpen` gate as `getForm`. Another Engineer and an unknown estimate get the same not-found, and the option lists have no per-object check, the same as their `ALL_ROLES` routes.

**Correctness has one real gap (QLT-836-01, Major).** The seeded values come from the server render, but the revision a save sends comes from the tree, which the browser reads later. Those are two different snapshots. If the part changed in between (for example a Lead edit under DEF-131 stage 2, or a second tab), the Engineer sees older values while sending the newer revision. The server then accepts a change to a field the Engineer never saw change, and the STORY-05.08 conflict notice is skipped. On master this path fails safe: the node is read after the tree, so a mismatch is a 409. The PR's own freshness rule (the first row's body is dropped once another row has been shown) is correct and tested.

The rest is small: test pins and coverage that moved (SEC-836-01, QLT-836-03, -04), a third copy of the node assembly (QLT-836-02), stale comments (QLT-836-05), the PF-7 fallback text (QLT-836-06), and one silent reorder case in the flight helper (QLT-836-07).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-836-01) |
| Minor | 7 (SEC-836-01, QLT-836-02 to -07) |
| Info | 3 (SEC-836-02, QLT-836-08, -09) |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff | `git diff 46490f27...fcab064f` (20 files, +796 −142); full files read: `part-form.tsx`, `use-form-definition.ts`, `use-part-form.ts` (seed and revision paths), `use-parts-tree.ts` (`readAgain`, `selected`), `estimate-workspace.tsx` (render tree), `estimate-service.ts` (`openForRead`, `viewReaders`, `getNode`, `getPartForm`, `getFirstPartForm`), `part-form-bodies.ts`, `schemas/options.ts`, `part-form-ghost.tsx` (`ghostOf`), `form-client.ts` (`toPartInputs`, save request) | read |
| Unit tests of the PR, at head | `vitest run tests/unit/part-form-seed.test.ts tests/unit/estimate-page.test.ts tests/unit/part-form-ghost.test.ts tests/unit/part-form-load-states.test.ts tests/unit/flight-form.test.ts tests/unit/part-form-seeded-reads.test.ts`, run in the lane's clean worktree `.claude/worktrees/aqp-441` at `fcab064f` (no file changed) | **6 files, 133 tests pass** |
| CI of record | run 46084804910, head `fcab064f` | All green: stages 1 to 11b (unit 554 files; unit, integration, security and acceptance 730 files) and four E2E shards. **Stage 11b `/estimates/[code]` 193,122 B** (DL-468 ceiling 194,000 B); `/costs/[slNo]` 168,521 B |
| Cost-confidentiality scan (E2E) | `tests/e2e/canary-scan.spec.ts` (every Engineer page: HTML, **RSC flight payloads**, JSON, headers, chunks; a Restricted price and a key that is no field are planted in the canary part) | green in the run above. It now covers the seed in the Engineer page's flight data |
| Mutation | by reading, not by running: I did not edit the lane's worktree | see SEC-836-01 (a surviving mutant) and the NFR-002 table |
| Servers | none started | — |

## NFR-002 and authorization (security lens)

| Focus | What I checked | Result |
|-------|----------------|--------|
| (1) Seed bodies | `readFirstPartFormBodies` → `formBody(first.form)`, `nodeBody(first.node)`; `readListBodies` → `materialOptionsBody`, `treatmentOptionsBody`. The four strict schemas name no rate (`schemas/options.ts` is a separate file from the Admin schemas on purpose). `node.inputs` is `visibleInputsOf` (an allow-list of form fields, ADR-008) | **Pass.** The same bodies the Engineer's browser already fetched from the same routes. `estimate-page.test.ts` "the Engineer's seed names no more than the Lead's" proves it is JSON-equal to the Lead's seed for the same row |
| (1) Ghost | `engineerGhostFrom(first, state)` reads `first.form` only; the parameter type is `{ form: unknown }`, so `first.part` does not type-check without changing the signature. `ghostOf` without `part` draws texts `{}` | **Pass** |
| (1) Flight payload | The seed is now inline in the Engineer's document (RSC). The canary scan reads flight payloads and plants a Restricted price and a non-field key in the canary part | **Pass** (CI green) |
| (1) The scan is strict and has mutants | `theGhostAndItsAllowedTexts` now renders **`page.props.ghost`** (the element the page hands to the workspace), so a change to what the page draws reaches the scan. SEC-833-10: the real `PartFields`, with only `usePartValues` stubbed to loading, is scanned editable and locked. The 23 values × 11 places, the 11 forms, the notice mutants and the lane's own mutants all run on the page's ghost | **Pass.** SEC-833-10 and SEC-833-11 (the unimported `engineer-ghost.tsx`) are **closed** |
| (2) No saved values | `fcab064f` takes the definition only. Test "a typed value changes nothing": plants `4242.42` in the first row, so the page's seed carries it, and the ghost is byte-identical, has no `4242`, and keeps `0 of N`. A mutant that passed `part` to `ghostOf` would change the count to `1 of N` and fail this | **Pass** |
| (3) Authorization | `getFirstPartForm` → `openForRead` → `findEstimateAccess` + `mayOpen` (an Engineer opens only their own estimates); the page reaches it only after `authorizePage` and `getWorkspace` (also `mayOpen`). The refusal test asserts the same error class and message as `getForm` for another Engineer and for an unknown estimate. The option lists take no viewer, the same as their `ALL_ROLES` routes | **Pass.** No read the role cannot already make |
| Logging | `logFault` logs `errorName` and `errorCode` only. The test plants `invented-host` in the error and asserts it is not logged | **Pass** |

## AC conformance (the DL-469 / DL-470 / DL-471 terms for this PR; AQP-441 is a Bug with no AC list of its own)

| Term | Implemented in | Tested by | Result |
|------|----------------|-----------|--------|
| DL-469: the Engineer's form gets the four answers as props, from the same services as the same viewer, through the routes' builders | `page.tsx:64-69`, `part-form-seed.ts:72-87` | `estimate-page.test.ts` (four bodies, reads once, never `getForm`/`getNode`, equals the Lead's), `part-form-seed.test.ts` (bodies equal the routes' answers) | **Met** (SEC-836-01: the `formBody` wiring is not pinned) |
| Architect rule 2 (combined read): in the service, behind `openForRead`, from the same private steps, with an equivalence test for every role, state and refusal | `estimate-service.ts:459-468` | `part-form-seed.test.ts:240-294` (3 roles × 4 states × ignored, several rows, no rows, refusals) | **Met, except** the frozen-registry branch (QLT-836-03), and a third copy of the node assembly (QLT-836-02) |
| A fault gives no seed and the form reads from the server | `part-form-seed.ts:80-86`, `engineerGhostFrom` null path | `estimate-page.test.ts` (fault and no rows), `part-form-seed.test.ts` (no rows, fault, log), `part-form-load-states.test.ts` DL-470 (1) (d) | **Met** |
| Freshness: the first row's body is used for its first showing only | `part-form.tsx:66-68, 135` | `part-form-load-states.test.ts:161-188` | **Met** for "another row was shown". **Not met** for a newer revision between render and tree read (**QLT-836-01**) |
| DL-470 (1): the failed and slow `/form` E2E cases move to a component-level test with only the network stubbed | `tests/unit/part-form-load-states.test.ts` | itself, as mapped in the PR body | **Met.** Inspecting the returned element (no DOM library) is acceptable: it asserts the same notice, title, body words, button, status role and name, and the read count after "Try again". Adding a DOM library would need an ADR and is not needed for these assertions |
| DL-470 (2) (iii): the choice cases change the form body the page carries, loudly | `tests/e2e/support/flight-form.ts`, `estimate-form-choice.spec.ts:78-90` | `tests/unit/flight-form.test.ts` (8), and the E2E itself polls `__flightFormRewrite === 'rewrote'` and asserts the card and field are drawn | **Met** (QLT-836-07: one silent reorder case) |
| PF-6: the Engineer's ghost is server-drawn, with no first-load JS | `engineer-ghost.tsx` (no `'use client'`, no `@/server/` import, no read) | `part-form-ghost.test.ts` PF-6; Stage 11b +42 B (the 3-line latch in `PartForm`) | **Met** |
| PF-7: the ghost, not "Choose a part…", while the tree is unread | `estimate-workspace.tsx:197` `treeUnread`, `part-form.tsx:83` | `part-form-ghost.test.ts` PF-7, `partform-placeholder.spec.ts` (whole load) | **Met** when a ghost exists. Fallback text in QLT-836-06 |
| PF-14f / PF-15: the form area within 24 px over the whole load | `partform-placeholder.spec.ts:199-229` | itself (green at three widths in CI) | **Met** for the first wait. The second-wait swap is no longer measured (QLT-836-04) |
| DL-471 tests changed | see the next table | | **Justified**; one pin dropped (SEC-836-01) |

## The three changed DL-471 tests (focus 5)

| # | Test | Change | Justified? | Coverage |
|---|------|--------|------------|----------|
| 1 | `estimate-page.test.ts` "DL-469, DL-471: … draws its first-wait ghost from the bodies of its seed" | `not.toContain('data-part-ghost')` → `toContain`; "no `getForm` read" kept | **Yes.** DL-469 reverses "no ghost". The "no extra read" intent is kept, and is strengthened by the new "reads once" test (`getFirstPartForm` ×1, each option list ×1, `getForm` and `getNode` ×0) | Not weakened |
| 2 | `part-form-ghost.test.ts` "PF-6, DEF-085: the page hands the ghost down as an element …" | dropped: `engineer-ghost.tsx` contains `formBody(` and `getForm(`; page has no `engineerGhost`/`getForm`. Added: the ghost file has no `getForm` and no `@/server/`; the page calls `engineerGhostFrom(` and `readFirstPartFormBodies(` and still has no `getForm` | **Yes** for the read moving into the combined read | **One pin lost:** "the definition goes through the route's strict builder" was pinned by `formBody(` in the ghost file. It now lives in `readFirstPartFormBodies`, where neither a source pin nor a behavioural test holds it → **SEC-836-01** |
| 3 | `part-form-ghost.test.ts` "PF-6, DL-455 (3)(a): the Engineer's form is not seeded" | → the page hands `seed={seed}` and `ghost={ghost}` | **Yes** (DL-469 reverses DL-455 (3)(a)) | Not weakened; it is a source pin, and the behaviour is held by the `estimate-page.test.ts` seed tests |
| (4th, not in the PR body's list) | `partform-placeholder.spec.ts` Engineer case | second-wait measurement (held `/nodes/{id}`) and the `main` bottom bound → first-wait measurement (held `/tree`), form-area bound only | Partly: the first wait is now the one that matters for row 1, and the `main` bottom cannot be read with the tree held | **The second-wait swap is no longer measured** → **QLT-836-04** |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-836-01 | **Major** | `src/components/features/estimate-workspace/part-form.tsx:135`; `use-part-form.ts:98` (seed accepted on `partId` only), `:114` (`revisionRef = part.revision`, from the tree); `page.tsx:68-69` | Architect note §5 item 4 ("a save must send the revision of the same snapshot as the values"); STORY-05.08 AC-5, AC-6 (the 409 conflict path); data integrity, §9 (2) | The seeded part body is read at server render (T0). The revision a save sends is `part.revision` from the tree, which the browser reads after hydration (T1 > T0). If the part changes between T0 and T1 (a Lead's or Admin's input edit, DEF-131 stage 2, or the Engineer's other tab), `usePartValues` shows the T0 values but sends the T1 revision. The seed's own `revision` is parsed and ignored. A save of field X is then accepted (no 409) over a value of X the Engineer never saw, and the STORY-05.08 AC-5/AC-6 conflict path never runs. Master fails safe: the node is read after the tree, so a mismatch is a 409 | A silent lost update, plus a form showing values that are not on the server, for one or more fields. Narrow window (render to tree read, longer on slow devices), but it bypasses the optimistic-concurrency check the form relies on | In `usePartValues`, accept the seed only when its revision is the tree row's: `const parsed = …parsePartInputs(seed.part); return parsed !== null && parsed.revision === part.revision ? parsed : null;`. On a mismatch, read from the server. This adds 0 B to the first load (the lazy chunk) and is harmless for the Lead (whose `part.revision` comes from the seed). Keep it after the tree seed lands: the tree seed from the same listing closes the window only when it is accepted, and a refused tree seed falls back to `/tree`. **Test:** `part-form-seeded-reads.test.ts`: seed body `revision: 5`, `part.revision: 6` → `loadPartInputs` called once and the shown values are the server's. Plus the same with equal revisions → no read |
| SEC-836-01 | Minor | `src/app/(portal)/estimates/[code]/part-form-seed.ts:82` | NFR-002; architect rule 1 (one builder per answer); DL-471 test change #2 | Nothing pins that the Engineer's seed form goes through `formBody`. The JSON-equality test with `GET /form` passes with or without it, because the service's `EstimateForm` has the same keys today. The mutant `form: first.form` compiles (the field is `unknown`) and survives the unit suite. Test change #2 removed the only pin (`formBody(` in `engineer-ghost.tsx`). `nodeBody` is held by JSON equality, because it reshapes `inputs` | Defence in depth: a later field added to `EstimateForm` for the Lead (a formula text, say) would reach the Engineer's flight payload if the call were dropped. Today the code is right, and the canary scan catches only values it plants | Behavioural test: stub `getFirstPartForm` to answer a form with an extra top-level `rate` and an extra key in a field. Assert that `readFirstPartFormBodies(...)` is `null` (the strict schema refused it) or that its JSON has no `rate`. The same one-liner for the Lead's `readPartFormBodies` |
| QLT-836-02 | Minor | `src/server/services/estimate-service.ts:459-468` | Architect note v1.1 ARC-827-07; coding standards (no duplication) | `getFirstPartForm` is a third copy of the node assembly (`{ ...view, inputs: visibleInputsOf(...), picture: await pictureOf(...) }` and `formOf`), after `getNode` and `getPartForm`. ARC-827-07 already asked for a shared `partDetailOf` | The equivalence test keeps the copies in step today. A change to one copy, such as a new allow-listed attribute, has to be made three times | A private `partFormOf(id, records, readers, written, view)` used by `getPartForm` and `getFirstPartForm` (and `partDetailOf` inside it for `getNode`). The equivalence tests stay as they are |
| QLT-836-03 | Minor | `tests/unit/part-form-seed.test.ts:243` | Architect rule 2 (c) ("every estimate state"); FR-065, FR-077 (frozen registry) | The grid sets `status = 'APPROVED'`, but with no `configVersionId`, so `configurationFor` takes the current registry. The frozen-registry branch, which an Engineer opening an approved estimate goes through, is tested for `getPartForm` (PRF-827-09, line 189) but not for `getFirstPartForm` | An approved estimate's Engineer seed could drift from `getForm` without a test going red | Add `getFirstPartForm` to the frozen-registry case at line 189: `asJson(first.form)` equals `asJson(form)`, and contains `'Frozen invented label'` |
| QLT-836-04 | Minor | `tests/e2e/partform-placeholder.spec.ts:199-229` | PF-14f, PF-15; DL-465 (3) (ii); focus 5 | The case that measured the **second wait** (ghost from `PartFields`, then the form, with `/nodes/{id}` held, plus the `main` bottom) became a first-wait case. The second wait still happens on every row other than the seeded one, and its height is no longer measured anywhere. The PR body does not list this as a changed master test | A later change to `PartFields`' wait could move the form area by more than 24 px on every row choice with nothing going red | Keep the new case. Add a step after it (or a second case): add a row with the "+" request (as `estimate-first-load.spec.ts` case 3 does), hold its `/nodes/{id}`, choose it, measure `[data-form-area]` before and after release, and assert ≤ `ENGINEER_MOVE_AT_MOST_PX`. List the change in the PR body |
| QLT-836-05 | Minor | `src/lib/estimates/part-form-seed.ts:8`; `tests/e2e/partform-placeholder.spec.ts:226`; PR body | Coding standards (comments state intent truthfully); records | (a) The seed type's doc names `use-seed-of-first-part.ts`, which does not exist (it was inlined into `PartForm`). (b) The E2E comment says the ghost is "the form's shape for this part (its saved values, the first row's)", which contradicts `fcab064f` (definition only). (c) The PR body still describes `useSeedOfFirstPart` and a new `use-seed-of-first-part.test.ts`, which does not exist; the test is `part-form-load-states.test.ts:161-188` | (b) misstates the NFR-002 / PF-3 rule the ghost now follows, next to the check that relies on it | (a) point at `part-form.tsx` (`left`). (b) "a new part's shape (defaults), as PF-15 rules". (c) update the Tests and "What this PR does" lines of the body |
| QLT-836-06 | Minor | `src/app/(portal)/estimates/[code]/engineer-ghost.tsx:16`, which leads to `part-form.tsx:83` | PF-7 | With no ghost (a fault, or no rows) and the tree unread, `PartForm` shows `FORM_NO_PART` ("Choose a part in the tree…"), the untrue text PF-7 rules out for that window. The line is master's, but #836 is where PF-7 lands, and this is now the only path that still shows it | The fault path keeps the third swap and the untrue words | `if (part === null) return treeUnread ? (ghost ?? <the three-bar status>) : <FORM_NO_PART>` (reuse the existing bar markup from lines 107-113). One unit case: `treeUnread: true`, no ghost → a `role=status` named "Loading the form", and no "Choose a part" |
| QLT-836-07 | Minor | `tests/e2e/support/flight-form.ts:86-93` | Focus 6 (loud, never silently wrong) | The hook joins **all** `[1, text]` chunks into the first one, which moves later text ahead of any non-text chunk between them (for example a `[3, base64]` binary row). React's flight stream is ordered, so that would reorder the stream rather than fail loudly. The unit test only puts `[3]` after the texts | Low today (this page sends no binary rows), but it is the one case where the helper would corrupt rather than throw | Before joining, check that the text chunks are contiguous between the first and last text chunk; otherwise set `__flightFormRewrite` to an error and hand the chunks on unchanged. Add a unit case `[0], [1,a], [3,b], [1,c]` that expects the error |
| SEC-836-02 | Info | `page.tsx:64-69`, `engineer-ghost.tsx`, `estimate-page.test.ts:316-366` | NFR-002, NFR-001 | Good practice: one combined read behind the service's own gate; the Engineer's seed is proved equal to the Lead's; the ghost takes the definition by type; the scan runs on the real page prop and the real `PartFields`; the 4242.42 plant has a mutant-killing count assertion | — | — |
| QLT-836-08 | Info | `tests/e2e/support/flight-form.ts:116-118` | Focus 6 | The hook holds every flight chunk until `DOMContentLoaded`, so in the three choice cases hydration cannot start early. It also does not `$$`-escape a card string starting with `$`, and it applies to hard loads only (a soft navigation's RSC fetch is not rewritten). None of this affects the current cases. Worth one sentence in the helper's doc so a later case does not rely on early-hydration timing or on a `$` label | — | Document it |
| QLT-836-09 | Info | `tests/e2e/estimate-form-sections.spec.ts:65-68` | DL-469 proof | `watchFormDataReads` is asserted right after `openForm`. A late read (for example treatments when a card mounts) would be missed | — | Assert `formDataReads` is empty again at the end of the case. The #827-method proof (item 3 of "Still to do") covers it for the merged shape |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-836-01: the sequence

1. T0: the server renders the Engineer's page; `getFirstPartForm` reads row 1 at revision 5, values V5. The seed carries `{ revision: 5, inputs: V5 }`.
2. A Lead saves field X on row 1, so the server is at revision 6, X = L.
3. T1: after hydration `usePartsTree` reads `/tree`, and row 1 comes back with revision 6. `EstimateWorkspace` hands `PartForm` `part = { id, slNo, revision: 6 }`.
4. `PartFields` mounts. `usePartValues` takes the seed (`seed.partId === part.id`), shows V5 (X = old), `heldRef = V5`, `revisionRef = 6`.
5. The Engineer types X = E. `PATCH …/inputs { revision: 6, values: { X: E } }` is **200**. The Lead's L is overwritten without the conflict notice.

**Current** (`use-part-form.ts:98`)
```ts
const [seeded] = useState(() => (seed !== undefined && seed.estimateId === estimateId && seed.partId === part.id ? parsePartInputs(seed.part) : null));
```
**Suggested**
```ts
const [seeded] = useState(() => {
  if (seed === undefined || seed.estimateId !== estimateId || seed.partId !== part.id) return null;
  const parsed = parsePartInputs(seed.part);
  // The values and the revision a save sends must be one snapshot (architect note section 5 item 4): a seed older than the tree's row is read again.
  return parsed !== null && parsed.revision === part.revision ? parsed : null;
});
```

### SEC-836-01: the surviving mutant
```ts
// part-form-seed.ts:82, mutant: compiles (form is unknown) and passes every unit test today
return { partId: first.node.id, form: first.form, part: nodeBody(first.node) };
```
Test:
```ts
const leaky = { estimates: { getFirstPartForm: async () => ({ form: { sections: [], lastSavedAt: null, rate: '1.00' }, node }) } };
const first = await readFirstPartFormBodies(leaky as never, viewer, id);
expect(JSON.stringify(first)).not.toContain('rate');
```
</details>

## Previous findings handed to #836

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| SEC-833-10 | Info | **Fixed** | The scan renders the page's own `ghost` prop and the real `PartFields` second wait (`estimate-page.test.ts:316-366`) |
| SEC-833-11 | Info | **Fixed** | `engineer-ghost.tsx` is imported by `page.tsx` |
| QLT-833-22 | Info | **Fixed** (with QLT-836-06 left on the fault path) | The first wait is the ghost; PF-7 restored |

## Issues for other roles

- **solution-architect:** `lead-page-server-props-2026-11-27.md` §2 rule 7 ("the Engineer's path is unchanged") and §5a's last term ("seeding the Engineer's form … is master's decision") are superseded by DL-469. A v1.3 line should record the Engineer's combined read, and the revision rule of QLT-836-01 as a general term: "a seed's part body is used only when its revision equals the row the form saves against".
- **developer (lane 3):** the tree-seed delta. `getFirstPartForm` → `{ form, node, tree }` from the **one** `listNodes` keeps the node's and the tree row's revisions in one snapshot. It does not remove the need for the QLT-836-01 guard (the fallback to `/tree`).

## Hand-off
- Status: COMPLETE (for everything except the tree seed, which will be reviewed as a delta)
- Verdict: REQUEST CHANGES; 0 Blocker, 0 Critical, 1 Major, 7 Minor, 3 Info
- Next: developer (lane 3) to fix QLT-836-01, then the Minors; re-review together with the tree-seed delta
