# Review Report — PR #811 (AQP-488 / DEF-131 stage 2T, FR-116: a Lead or an Admin adds, moves and deletes parts on SCR-06) — Combined security and quality, performance lens

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (the combined security-and-quality review of CLAUDE.md §9 item 2, required for a story that can lose data and touches the approval page; DL-452 (D), DL-455 step 2, DL-463 (3), DL-465 (C)) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-488-lead-edit-tree` (PR [#811](https://github.com/sankumar76/Accucut-Quotation/pull/811)), master `7aa23c44` (#806 squashed). The net diff is 47 files, +2,454 −260; the merge base is master, so #806 is not in it |
| Commits reviewed | `3ff9f7ae` (the head when the review began), then the delta to **`0b2ab517`**: `f201f43d` (the `pinned-form.test.ts` count, PRF-811-01), `1f21da38` (a comment), `48e34edc` (a merge of #806's squash `60ca5a08`) and `0b2ab517` (a test) |
| Date | 2026-11-27 |
| GitHub review | [pullrequestreview-6088055507](https://github.com/sankumar76/Accucut-Quotation/pull/811#pullrequestreview-6088055507) (COMMENT, REVIEW_IDENTITY single-token), 8 inline comments; follow-up [pullrequestreview-6088275563](https://github.com/sankumar76/Accucut-Quotation/pull/811#pullrequestreview-6088275563) at `0b2ab517` |
| Reviewed against | DL-452, DL-455 (step 2), DL-457, DL-461, DL-463, DL-465; the PRD NFR-001, NFR-002, NFR-009, NFR-010; the UX ruling `lead-admin-edit-inputs-2026-11-27` (tree terms ED-18 to ED-37); the architect's notes `lead-admin-input-edit` v1.2 and `lead-page-server-props` v1.1 (as cited in the PR) |
| **Verdict (at `3ff9f7ae`, held at `0b2ab517`)** | **REQUEST CHANGES.** At `3ff9f7ae`: 0 Blocker, 0 Critical, 4 Major, 2 Minor, 2 Info. **At `0b2ab517`: 0 Blocker, 0 Critical, 3 Major (PRF-811-02, -03, -04), 2 Minor, 2 Info; PRF-811-01 is fixed.** The §9 stop does not apply, but #811 is a critical story and three conditions that master set are open: PRF-811-02 (first load **193,516 B, 16 B over** the ceiling), PRF-811-03 (DL-465's move check, gated on #832), PRF-811-04 (DL-463's TBT and action-delay terms at more than one row). The proof table is not in the PR body yet, and the E2E shards were running |

## Summary

The write side is sound and unchanged. #811 adds no write route: add, move and delete go through the existing routes and services, where role, state, revision, fingerprint and audit are enforced on the server (NFR-001) and covered by master's tests. I found no way for an Engineer to receive a figure (NFR-002), no unaudited write, and no unsafe delete or move. The seed's tree is the same body as `GET /tree` for every role and state, by test.

The risks are on the performance and delivery side. One is now measured (the first load is 16 B over the ceiling); the others are unmeasured rather than shown. The island is a client swap that replaces the server-drawn columns after hydration, and its work grows with the number of rows, which #806 and #827 did not. The proof the PR needs (DL-463) was measured, for #827 and #806, on a one-part estimate. CI was red at Stage 6 on a test that counted a registry read that the PR itself removed (fixed in `f201f43d`); at `0b2ab517` the stages pass and Stage 11b reads 193,516 B.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 4 (PRF-811-01, -02, -03, -04) |
| Minor | 2 (PRF-811-05, -06) |
| Info | 2 (PRF-811-07, -08) |

## Checks Run

| Check | Source | Result |
|-------|--------|--------|
| Net diff, server, hooks, island, shell, tests | `git diff origin/master FETCH_HEAD` (3,646 lines), files read at the head | done |
| Write paths | `estimate-service.ts` `addPart`, `moveNode`, `deleteNode`, `lockForChange`, `assertEditable`; `can-edit-inputs.ts`; `tree-actions.ts`; `input-change-audit.ts`; `audit-events.ts`; `route-manifest.ts:258-260` | read |
| Governance | DL-452, DL-455, DL-457, DL-461, DL-463, DL-465; PR body | read |
| CI at `3ff9f7ae` (run 45996342056) | job log | **Stages 1 to 11b failed at Stage 6**: `tests/unit/estimate/pinned-form.test.ts:98`, 1 failed of 11,913 (554 of 555 files passed). Stage 11b did not run |
| CI at `0b2ab517` (run 45999127596) | job log | **Stages 1 to 11b passed**: unit 555 files, 11,914 tests; unit, integration, security and acceptance 731 files, 17,795 tests. **Stage 11b: `/estimates/[code]` 193,516 B** (the job's limit is 200,000 B; the ruled ceiling is 193,500 B: **16 B over**). E2E shards 1 to 4 running when I wrote this |
| Local runs | none | my worktree has no install; heavy suites stay in CI (§9 (5)). Figures marked "estimate" are from reading the code |

## Security lens: the tree-edit write paths (NFR-001, NFR-002)

| Check | Result | Evidence |
|-------|--------|----------|
| New write routes | **None** | add, move and delete use `POST /nodes`, `PUT` and `DELETE /nodes/{id}` and `POST /tree/move` (`route-manifest.ts:258-260`, `ALL_ROLES`, the service decides); the diff changes only `GET /tree` (now `treeBody`) |
| Role and state, server-side | **Held by master's code, unchanged** | every write: `lockForChange` then `assertEditable` after the row lock. Ignored: its own 409. `canEditInputs(state, role)`: Draft for whoever may open it; Prepared for Lead and Admin (the state machine's `EDIT`); nobody on Approved, Quoted or ignored (`ESTIMATE_NOT_EDITABLE`). Another Engineer: 404 (`mayOpen`). The island offers its buttons by `treeActionsOffered`, which is `canEditInputs`, and the server asks again |
| Role-matrix | **No new row needed; existing coverage stands** | no route added or changed in what it answers. I did not see the security step run at this head (Stage 6 stopped the job) |
| Audit, no personal data | **Met** | `traceFor` is null only for an Engineer; a Lead or Admin write with no audit context throws (fail closed). Each of add, move, delete writes one `estimate.part_added`, `part_moved`, `part_deleted` in the write's own transaction (`recordMany`). Payloads are strict objects: row number, kind, actor role, row names cut to a length; **no input value** (`input-change-audit.ts`). Covered by `input-audit.test.ts` and `input-change-events.test.ts` |
| Cost confidentiality | **Met** | `seed.tree` is `treeBody`, the strict `partsTreeSchema` (id, parent, number, name, kind, completeness, revision; no figure). The figures the island joins come from the page's `nodes`, which only a Lead or an Admin receives: `EstimateReview` is loaded by `page.tsx` on that branch alone, and the shell is imported by that one file (pinned by the architecture test) |
| Delete safety | **Safe** | a delete is refused when the part's revision, the row count or the subtree fingerprint changed (409 with the fresh tree); the dialog names the rows and focuses "Keep it"; E2E ED-26 deletes after a second request added a child, checks that nothing went and that the next delete names 2 rows |
| Move, cycles | **Safe** | a move is only among siblings of one parent (`MOVE_ACROSS_PARENTS`), so a cycle or a move into another estimate cannot be asked; a stale revision gives `TreeChangedError` |
| Concurrent edits | **Handled** | add under a parent deleted elsewhere: 404 (`partIn`); the open row deleted elsewhere: the fallback line (ED-27, tested); the Engineer saves first in a Draft: the conflict notice with two choices (ED-8, tested) |
| Seed tree equals `getTree` for every role and state | **Met** | `part-form-seed.test.ts` compares `getPartForm.tree` with `getTree` over the role × status × ignored grid and the frozen-registry case; `estimate-page.test.ts` compares the seed's tree with `GET /tree` for LEAD and ADMIN and checks that an Approved estimate's seed has no tree |
| `getNode` changed | **Same answer, one registry read fewer** | `partDetailOf` builds the values and the row name with `readers.document` (the document `configurationFor` returns) instead of asking for it again; the Engineer-reachable `GET /nodes/{id}` is affected; this is what PRF-811-01 is about |
| Tests not weakened; person ledger +0 (DL-422); no case after `users.spec.ts` | **Met** | the read-only drop-down case (AQP-496) moved intact to `estimate-review-tree.spec.ts`, now on an ignored estimate with a guard that a drop-down has two options; `estimate-review.spec.ts` replaces "read-only" assertions with the editable ones (a feature change) and removes none of the others; `ignore-restore.spec.ts` keeps every assertion in two serial cases plus observe-only timing; the new specs make no person (`createDisposableUser` absent) and sort before `users.spec.ts`; no wait, budget or time-out is changed |
| Reads after hydration | **Designed to be 0** | `usePartsTree` (new seed option), `ReviewForm` and the form hooks start from the seed; only a row chosen after that, Try again and a conflict read. To be shown by the proof |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-811-01 | Major | `estimate-service.ts:445`; `tests/unit/estimate/pinned-form.test.ts:98` | §9 (1), DL-436 | `getNode` reads the registry once now (was twice); the test counted three. Stage 6 red, so no Stage 11b. The change is on an Engineer-reachable method and the PR body does not say so | no merge on red; first-load unknown | **Fixed in `f201f43d`** as suggested: the list is two, the comment says why, the version is still pinned; plus a new case for the combined read (one registry read; equal to the three). Confirm green |
| PRF-811-02 | Major (**measured at `0b2ab517`: 193,516 B, 16 B over the 193,500 B ceiling**) | `tree-panel.tsx:62`; `use-parts-tree.ts` | NFR-009; PRD ceiling 193,500 B | `TreePanel` and `use-parts-tree.ts` are shared with the Engineer's workspace, so the PR's additions there (about 55 lines, the `review`, `calculating` and `seed` options, `selectedId`) and the shell count in `/estimates/[code]`'s first load. The PR body: 193,182 B at `ebb2951d`, 318 B of room shared with #806 | master at `7aa23c44` reads 192,815 B, so #806 and #811 together add 701 B (my estimate for #811 alone was 250 to 450 B); CI prints PASS because its own limit is 200,000 B | Master rules on the 16 B (PRD v0.65, FR-116 AC-8: growth past the ceiling comes to master before merge), or the PR trims a few dozen bytes: the review-only branches of `TreePanel` (`review?.renderRow`, the `review` legends, `calculating` with `describedBy`) and the `onDone` wrapper in `use-parts-tree.ts`, both in the route's first load. The PR body's 'room' sentence needs the new figure |
| PRF-811-03 | Major | `estimate-review.tsx:237` | DL-465 (C); DEF-145 (#832) | DL-465 gates #811 on #832 (not on `master`) and adds a term: with the island on the page, the top of `#review-actions` moves ≤ 8 px when the island replaces the server-drawn columns, Draft and Prepared, 360, 768 and 1366 px. The shell is built for an equal first paint (same notice words, same frame, rows drawn before the tree is read), but no test here reads the position of `#review-actions` | a shift above the approval actions is the Sev-3 defect of DL-465 | After #832 is on `master`, take it in by a merge, extend its regression (route-delayed island chunk; position before and after; Enter on the notice link) to Draft and Prepared with the island, and report the measured shift in the PR body |
| PRF-811-04 | Major | `review-edit-shell.tsx:19` | DL-463 (3); NFR-009 | The swap is one synchronous render of the whole island in the first-press window: the server-drawn children (the read-only `PartForm` has already mounted and fetched its fields chunk) are dropped; the island mounts the Engineer's `TreePanel` (a row, a figure line and a toolbar of three controls per row), `Autosave` and `LeaveGuard`. The cost is per row, which #806 and #827 did not have | DL-463 holds #811 to TBT within 10 % and the action delay within +20 ms of post-#806 master. The profile used one-part trees; at 53 and 201 rows (HTML 0.44 and 1.38 MB) I expect the long task to be several times the 1-row one (estimate; the Engineer's own tree is the same code; 4× CPU throttling multiplies it) | (a) the proof gives TBT and the action delay at hydration at 1, 53 and 201 rows, interleaved with post-#806 master; (b) make the swap interruptible: `const ready = useDeferredValue(Editor)` in the shell, so the read-only page stays visible and live until the island is ready (also lowers TBT; only #811's files change); (c) confirm with one `longtask` trace |
| PRF-811-05 | Minor | `estimate-review.tsx:243` | NFR-009 | The costs rows reach the browser twice for an editable estimate (the server-drawn tree and Build table, and the island's `nodes` prop), and the seed's tree is a third copy of the row skeleton; the island's `joinRows` needs only `{ id, count, figures }` | estimate 0.3 to 0.6 KB of flight data per row uncompressed: about 60 to 120 KB at 201 rows on a 1.38 MB document, re-sent on each refresh | None to merge. The proof gives HTML bytes at 53 and 201 rows and the RSC bytes of a refresh; follow-up: pass the island only `{ id, count, figures }` |
| PRF-811-06 | Minor | `review-form.tsx:87` | NFR-010 | Each rename saved (`onNamed`) and each "changed elsewhere" (`onChanged`) asks the page to be drawn again 300 ms after the last, though the island already holds the new label (`tree.applyLabel`) | each is a full server render (120 statements on a Prepared load; a 0.44 MB document at 53 rows); a Lead naming 30 parts one after another can trigger up to 30; the quiet window joins only renders closer than 300 ms | None to merge. Server time and RSC bytes of one refresh at 53 and 201 rows in the proof; if large, a 1 s quiet window, or refresh only while the Build table is on screen |
| PRF-811-07 | Info | `review-tree-editor.tsx:121` | NFR-009 | `renderRow` and `costOf` are new on every render and `TreeRow` is not memoised: every island state change (a press, `busy`, an announcement, the calculating store) renders all rows. Typing does not (the form's state is below) | O(n) per press; probably tens of ms at 201 rows; not measured | If the 201-row proof shows a slow press: `memo(TreeRow)` and `costOf` once per `pageById` |
| PRF-811-08 | Info | `review-tree-editor.tsx:29`; `estimate-review-architecture.test.ts` | NFR-002; architecture | The rule "no review code reaches the Engineer" was rewritten so a client file (the island) may import the review's row, frame and words: the folder rule now has one exception (`importers` is `[REVIEW_PAGE, TREE_EDITOR]`) | the chunk carries words and layout, no value, and its data arrives as props; it is named in no Engineer page (the shell is imported only by `estimate-review.tsx`, which `page.tsx` loads for Lead and Admin); a chunk is a public static file once its name is known. Not a breach of NFR-002 (values) | None; the solution-architect confirms the rule change belongs in the architecture note |

## DL-463's #811 terms (to be read when the proof lands)

| Term | What I expect and ask |
|------|-----------------------|
| DL-452 (3): statements within 10 % of post-#806 master | the PR adds no query per render (`getPartForm` already listed the tree; `treeBody` is a parse) and `getNode` loses one: expect equal or better |
| 0 reads after hydration | the island and form start from the seed; also list every request after hydration with start and end, at Draft and Prepared, 1, 53 and 201 rows |
| action delay within +20 ms | at 1, 53 and 201 rows, Recalculate and approve, median of 10, at hydration and idle, same pass as post-#806 master (PRF-811-04) |
| median TBT within 10 % | at 1, 53 and 201 rows, same method as the profile; the runs overlapped in #827's proof (fix 669 to 1087 ms, master 600 to 1188 ms), so give the runs, not only the median |
| DL-465 move check with the island | after #832 (PRF-811-03) |
| first load at or under 193,500 B | Stage 11b at a green head (PRF-811-02) |

## NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-001 roles on the server | **None found**; no new write route, writes enforced by master's services | — |
| NFR-002 no cost to an Engineer | **None found** | PRF-811-08 (rule wording) |
| NFR-009 LCP, TBT, 200 KB JS and the 193,500 B ceiling | **Medium to high, unmeasured**: the swap's cost grows with rows; the first-load room is small | PRF-811-02, -04, -05, -07 |
| NFR-010 page data within 500 ms at 25 users | **Low to medium**: no added query per render; refresh cost per rename | PRF-811-06 |

## Issues for other roles
- **solution-architect:** PRF-811-08 (the architecture rule), and whether the island's swap with a per-row cost changes the data-loading note (v1.1).
- **ux-expert:** DL-465 (3) sets the placeholder's shape; the island's first paint must match it (PRF-811-03).
- **qa-engineer:** the observe-only `[AQP-488 restore timing]` lines in `ignore-restore.spec.ts` are production figures only from `estimate-review-production.spec.ts`; the proof needs rows.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-811-combined.md`
- Jira / GitHub updates: PR #811 COMMENT review 6088055507; Jira AQP-488 comment
- Open questions: none
- Risks raised: none new (the cumulative page cost is RISK/G8 note of DL-463 (C))
- Recommended next agent: developer (lane 2) for the proof at 1, 53 and 201 rows, PRF-811-02 and PRF-811-03; then master

## Delta and CI addendum (`3ff9f7ae` to `0b2ab517`)
- `f201f43d`: **PRF-811-01 fixed.** `pinned-form.test.ts` expects the registry version twice (the form, then the part), with the reason in the comment and the version still pinned; and a new case: `getPartForm` asks for the version once and equals `getForm`, `getNode` and `getTree` as JSON. Nothing weakened.
- `1f21da38` a comment; `48e34edc` a merge of #806 squash, with no PR-owned file changed by it; `0b2ab517` a test: every drop-down in the read-only case gets every check and the two-options guard is an assertion on the set (as on `master`; stricter than the previous filter).
- **CI at `0b2ab517`:** Stages 1 to 11b pass (unit 555 files, 11,914 tests; 731 files, 17,795 tests with the security suite). **Stage 11b `/estimates/[code]` 193,516 B**, 16 B over the 193,500 B ceiling; `master` at `7aa23c44` reads 192,815 B. E2E shards running when I wrote this.
- Open: PRF-811-02, -03, -04 (Major), -05, -06 (Minor), -07, -08 (Info). The proof table is not in the PR body yet.
