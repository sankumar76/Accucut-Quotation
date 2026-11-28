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

---

## Round 2: combined security and quality, at `19ced41e` (delta from `0b2ab517`)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the combined security-and-quality review of CLAUDE.md §9 item 2: the Lead's edit path, and a story that can lose data) |
| Review round | 2 |
| Head | **`19ced41e`**, master `e64cc034` (#839, DEF-148) merged in at `d2ff5611`. The net diff against master is 52 files, +2,273 −349 |
| Delta read | PR-owned commits `4d801179`, `9bcf78ee`, `1be495a3`, `b8934a57`, `3dcb5e49`, `f76e37b2`, `0eef00a9`, `6601023c`, `ff14a1b5` and `19ced41e`; the merges `e619fe48` (#835), `1631c42e` (#833) and `d2ff5611` (#839) were checked for PR-owned changes |
| Reviewed against | DL-452 (3), DL-463, DL-465 (3), DL-468, DL-472 (4), DL-475; the architect's note `lead-page-server-props-2026-11-27.md` v1.3 (rule 8, sections 5b to 5e); the UX ruling `partform-placeholder-shape-2026-11-28.md` sections 9 and 10; `pr-836-combined.md` (QLT-836-01, SEC-836-03) and `pr-839-combined.md` (QLT-839-05); STORY-05.08 AC-4 to AC-6; NFR-001, NFR-002, NFR-009, NFR-010; coding standards §1, §3, §6 |
| Date | 2026-11-27 |
| **Verdict** | **REQUEST CHANGES.** **Open: 0 Blocker, 0 Critical, 2 Major (QLT-811-01 new; PRF-811-04 narrowed to the TBT term), 4 Minor (QLT-811-02, QLT-811-03, PRF-811-05, PRF-811-06), 4 Info (QLT-811-04, QLT-811-05, PRF-811-07, PRF-811-09).** No Blocker or Critical is open, so the §9 (2) stop does not apply. **PRF-811 Majors:** PRF-811-01 fixed (round 1); **PRF-811-02 fixed** at `6601023c` (193,635 B, under DL-468's 194,000 B), to be re-read at `19ced41e`; **PRF-811-03 fixed** (the move spec; 2 px measured locally); **PRF-811-04 open**: the reads and action-delay terms are met, the TBT term is not shown |

### Summary

**The save paths are sound after the #839 merge.** Every save sends the revision of the values the form holds. I found no stale-seed path in the form itself. `use-part-form.ts` holds exactly one seed guard and no effect that follows the tree. `formSeedOf` closes ARC-811-01. Unlock and Restore remount the form. No route, role check or Engineer-reachable answer changed in the delta (NFR-001, NFR-002 unchanged).

**One new data-loss path (QLT-811-01, Major) comes from the address-following in `1be495a3`.** The island rewrites `?row=` with `history.replaceState` when it opens a row without a navigation: after an add (the new row opens), a move that renumbers the open row, a delete fallback, or a choice from the Calculate summary. While the leave guard is armed, that rewrite lands on the guard's extra history entry. The page's own entry below keeps the older `?row=`. Back then lands on an entry that the guard takes as its own (it compares the address it armed at), so it starts asking. Meanwhile Next.js restores that entry's search params and the island "follows" them to the other row. That unmounts the form that holds the typed, unsaved value. Either the dialog asks about text that is already gone, or `settle()` finds the gate clean and the guard leaves the page. Both outcomes break STORY-05.08 AC-4. I found this by reading the code; I did not reproduce it in a browser (no servers were started, as briefed). The one Back case in the PR covers only Back with no row change.

**The reserves are correct.** They are inert, `aria-hidden`, hold nothing focusable or named, and are gone once the island draws. Unit and E2E tests pin all four.

**Performance.** Reads after hydration are 0 in every state, and the action delay is better than master. The TBT term rests on two runs per side. One of master's two runs (2,100 ms, against 795 ms) came from the pass the PR body says started under CPU contention. Without it, the head is about +33 % against master. That is not "within 10 %", so PRF-811-04 stays open on that term alone (rerun, or master rules under DL-463). The server-render rise on Prepared and at 53 rows does not follow the added work: 201 rows, which carry the largest seed, are 3 % faster, and Approved, which has no island, is 29 % slower. I judge it noise, acceptable under NFR-010, with no fix before merge (PRF-811-09). The extra HTML is now measured at about 0.9 to 1.2 KB per row (PRF-811-05, follow-up).

| Severity (open after this round) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (QLT-811-01, PRF-811-04) |
| Minor | 4 (QLT-811-02, QLT-811-03, PRF-811-05, PRF-811-06) |
| Info | 4 (QLT-811-04, QLT-811-05, PRF-811-07, PRF-811-09) |

### Checks run

| Check | Source | Result |
|-------|--------|--------|
| Delta and net diff | `git diff origin/master...origin/fix/AQP-488-lead-edit-tree`; each PR-owned commit with `git show`; files read at `19ced41e` | done |
| RISK-035 (the merge of #839) | `use-part-form.ts` at head; `git diff 6601023c d2ff5611`; `git diff origin/master 19ced41e -- part-picture.tsx part-form-revision.test.ts part-form-revision-conflict.spec.ts` | **one** `given.revision === part.revision` guard; no `[part.revision]` effect; #839's three files byte-identical to master |
| CI at `6601023c` (run 46090649966) | job logs | Stages 1 to 11b pass: unit 558 files, 11,988 tests; with integration, security and acceptance 734 files, 17,869 tests (`role-matrix.test.ts` 490, `engineer-import-rule.test.ts` 1,608, the canary scan green). **Stage 11b `/estimates/[code]` 193,635 B.** E2E: shards 1 to 3 green; shard 4 red at `estimate-form-sections:149` [desktop] only (QA: the DEF-085 cold-start signature, test plan 0.3.157; not reachable from this diff by my read) |
| CI at `19ced41e` (run 46098249999) | job list | **Stages 1 to 11b: success.** Its log, including the Stage 11b figure, cannot be read until the run finishes. The four E2E shards were still running when I wrote this |
| Local tests | none | lane 2's worktree (`aqp-398`, at `19ced41e`) has untracked profiling files and is in use for the comparison on ports 3550 to 3599, so it is not clean. Per the brief, I relied on CI |

### Focus 1: data integrity on the Lead's island

| Path | Revision a save sends | Verdict |
|------|-----------------------|---------|
| Seed at mount (island's form) | `seeded.revision`, and only when `formSeed` is given (`seedKept && treeFromSeed`) and the guard passes (`editable` and `given.revision === part.revision`; `part.revision` is the seed tree's row, the same listing) | **Met** (rule 8, section 5b shape (i)) |
| Tree seed refused | `formSeedOf` gives no seed; the form reads `/nodes/{id}` and the load sets `revisionRef` (`use-part-form.ts:157`, from #839) | **Met** (ARC-811-01 fixed, test 3 in `part-form-seeded-reads.test.ts`) |
| First row opened again | `seedKept` is false after any other row is shown, so it reads | **Met** (DL-470 (3), E2E `estimate-review-row-return.spec.ts:30`) |
| First row remounted with no other row shown | a stale seed is refused by the guard: `applySaved` raised the row's revision after any save | **Met** |
| Own save, conflict re-read, picture | own answer; `reconcile`; `changed && saved.revision === revisionRef.current + ONE_WRITE` | **Met** (#839, unchanged by the merge) |
| A tree re-read (move, Try again, someone else) | not taken: no effect follows `part.revision` any more. A stale revision fails safe with a 409 and `reconcile` | **Met** |
| Unlock or Restore | the page swaps a bare fragment for a `ReviewEditShell` element, so React remounts the form with the new page's seed; `ReviewForm`'s `canEdit` only goes from true to false (`refused` is never cleared) | **Met** (SEC-836-03, pinned by structure) |
| Back, Forward and row links against the leave guard | row links: the guard takes the click when it is armed or dirty and navigates with the router, so the history stays consistent. **Rows opened without a navigation while the guard is armed: not met** | **QLT-811-01** |

### Focus 2: authorization (NFR-001, NFR-002)

No route, service, role check or body builder changed in the delta. The only server-side change is the doc comment of `part-form-bodies.ts`, which now lists the five answers (ARC-811-02). The round 1 security table stands. The tree seed is sent only where the island is drawn (`treeActionsOffered` in `review-page.tsx`). The island is still loaded only from the Lead's and Admin's branch. The new shared files (`tree-chrome.ts`, with no import; the `form-layout.ts` constants; the `parts-tree-list.tsx` slot) carry class strings and words only, no figures. The role matrix, the Engineer import rule and the canary scan were green at `6601023c`. Nothing new reaches the Engineer.

### Focus 3: the reserve blocks

| Term (section 5c (a), PF-20.3) | Code | Test | Verdict |
|---|---|---|---|
| inert, `aria-hidden`, marked `data-review-tree-reserve` | `review-tree.tsx:78, 83` | `review-tree-reserve.test.ts:37-45` (rows + 1 reserves, each `inert=""` and `aria-hidden="true"`); E2E `reserveIsInert` | **Met** |
| No focusable or named element | the toolbar reserve is an empty `div`; the foot reserve is `invisible` with a `span` (no `<button>`) | unit: no `id`, `role`, `tabindex`, `href`, no `<button`; E2E: none of `a, button, input, select, textarea, [tabindex], [id], [role]`; axe has no serious or critical finding | **Met** |
| None when the tree cannot be edited | `edit ? … : {}` | unit "reserves nothing"; E2E PF-21f (Approved) | **Met** |
| Gone when the island draws | the shell replaces `children` with the island | E2E `toHaveCount(0)` after the island's chunk is let go | **Met** |
| Sizes from shared constants, copies guarded | `tree-chrome.ts`, `PICTURE_ZONE_RESERVE(_HELD)` | `review-tree-reserve.test.ts:69-74`, `picture-zone-reserve.test.ts` | **Met** |

### Focus 4: performance (PRF-811 status, DL-463 terms)

From the PR body (lane 2, local production builds, master `46490f27` against head `6601023c`):

| Term | Master | Head | Reading |
|------|--------|------|---------|
| Reads after hydration (Draft, Prepared, Approved, 53, 201 rows) | 0 each | 0 each | **Met** |
| Action delay, hydration minus idle (DL-463 (1)'s measure): Recalculate / Approve | 82 / 76 ms | 58 / 48 ms | **Met**, better by 24 / 28 ms. The row count is not stated (assumed 1 row) |
| Lighthouse TBT, two runs | 2,100, 795 ms | 1,040, 1,071 ms | **Not shown.** The mean of two is −27 %, but master's 2,100 ms is 2.6 times its other run, and the body says master's pass began at 73 % CPU (the tail of a build). Against the clean run it is **+33 %**. No TBT at 53 or 201 rows |
| Statements per render | 81, 75, 81, 72, 102 | identical | **Met** (DL-452 (3)) |
| Server render, sequential median | 92, 67, 63, 80, 284 ms | 103, 133, 81, 113, 275 ms | **Noise, acceptable** (PRF-811-09) |
| HTML bytes | 157,160 / 158,559 / 420,925 / 1,432,182 | +3,977 / +4,006 / +52,584 (+12.5 %) / +236,448 (+16.5 %) | PRF-811-05, measured: about 0.9 to 1.2 KB per row |
| First load, Stage 11b | 193,080 B | 193,635 B (+555 B) | under 194,000 B (DL-468); 365 B left |

**Is the server-render rise acceptable?** Yes, with no fix before merge. (a) The statements are identical, so there is no added query. (b) The added server work (a `treeBody` parse and the seed in the flight data) grows with the rows, but the largest seed (201 rows) is 9 ms *faster*. Approved, which gets no tree seed and no island, rose 18 ms (+29 %), which is what one noisy pass looks like. (c) 133 ms sequential is far inside NFR-010's 500 ms at 25 users. **Is the extra 4 KB of HTML on Prepared acceptable?** Yes. It is about 2.5 % of the document, it is not counted in Stage 11b, and it compresses on the wire. The per-row growth (+236 KB uncompressed at 201 rows) is the real cost and stays a follow-up (PRF-811-05).

### Focus 5: test adequacy

| Test | Judgement |
|------|-----------|
| `estimate-review-first-paint-move.spec.ts` | **Good.** The chunks are held by routes (deterministic, no wait). It measures at every stage against the first paint (ghost, read-only form with a saved value, island, picture control), for Draft and Prepared at the three widths, a fine pointer at 768 px, a held picture, and Approved at 2 px. Reserve inertness is checked with axe. DL-465 (3) (i)'s "Enter on the notice link" is not repeated with the island; it is not part of the move check that DL-465 (C) adds to #811 (Info, under PRF-811-03) |
| Back case (`estimate-review-row-return.spec.ts:68`) | **Right for what it covers:** Back with no row change asks, "Keep editing" keeps the text and the row, and "Leave" leaves. **Missing:** Back after a row was opened without a navigation (QLT-811-01), and Back and Forward between two rows on the island, which the PR body says work (QLT-811-02) |
| Seed tests (`part-form-seeded-reads.test.ts`) | **Good.** They drive the real hooks against the invented server: revision 1 against row 2 reads; equal revisions read nothing and the save carries revision 1; a locked form keeps its seed at revision 0; a refused tree seed gives the form no seed and both read once. One comment is wrong after #839 (QLT-811-04) |
| `!editable` mount pin (`SEC-836-03`) | **Adequate as a structure pin.** It checks that the element types differ (fragment against shell), that the shell's form has `editable={false}`, and that the island's form has the literal `editable` (CRLF-tolerant since `19ced41e`). With `refused` never cleared in `ReviewForm`, no mounted form goes from locked to editable |

### Focus 6: the RISK-035 merge

Confirmed at `19ced41e`. `use-part-form.ts` holds **one** seed guard (`:102-105`, `given !== null && (!editable || given.revision === part.revision)`). #839's revision logic is intact: the load sets `revisionRef` (`:157`), `reconcile` (`:303`), the own save (`:360`) and the picture's `changed && … + ONE_WRITE` (`:486`). There is **no** tree-following effect (no `[part.revision]` dependency in the file). The guard's comment (`:101`) now states its own rule only ("the seed's revision is the row's at mount; otherwise … read"), so **QLT-839-05 is fixed on #811**. `PartTarget`'s doc and the ref comment (`:118-120`) state #839's rule. #839's `part-picture.tsx`, `part-form-revision.test.ts` and `part-form-revision-conflict.spec.ts` are identical to master.

### Prior findings

| ID | Severity | Status at `19ced41e` | Evidence |
|----|----------|----------------------|----------|
| PRF-811-01 | Major | **Fixed** (round 1) | — |
| PRF-811-02 | Major | **Fixed at `6601023c`**; re-read at `19ced41e` | 193,635 B ≤ 194,000 B (DL-468 moved the ceiling). The head's Stage 11b passed its job; the figure is still to be read from the log, against the 194,000 B ceiling (#839 came in by the merge) |
| PRF-811-03 | Major | **Fixed** | the move spec above; lane 2: +191 / +159 / +20 px before the reserve, 2 px after, every width, Draft and Prepared; green in its shard at `6601023c` |
| PRF-811-04 | Major | **Open, narrowed to the TBT term** | reads (0) and action delay (−24 / −28 ms) met. TBT not shown (above). **Close by:** five interleaved Lighthouse pairs per state, on a quiet PC, at Prepared with 1 row and with 53 rows, giving the runs and the medians; closed if the median is within 10 %. Otherwise master rules under DL-463 ("a miss … comes to master before merge"). `useDeferredValue` (my round 1 option (b)) is not needed if the term is met |
| PRF-811-05 | Minor | **Open, measured; follow-up** | +52.6 KB at 53 rows, +236 KB at 201 rows uncompressed. Pass the island only `{ id, count, figures }` (a `follow-up` issue) |
| PRF-811-06 | Minor | **Open; follow-up** | `review-form.tsx:81-89` still refreshes on each rename; not measured |
| PRF-811-07 | Info | Open | unchanged |
| PRF-811-08 | Info | **Closed** | accepted in the architect's note v1.3 section 5c (e) |
| ARC-811-01 | Minor | **Fixed** | `formSeedOf` (`review-tree-edit.ts:48-50`); `review-tree-editor.tsx:122-123`; test 3 |
| ARC-811-02 | Info | **Fixed** | `part-form-bodies.ts` lists five answers; `form-layout.ts` names `picture-zone-reserve.test.ts` |
| QLT-839-05 | Minor | **Fixed on #811** | Focus 6 |
| SEC-836-03 | Info | **Closed** | Focus 5 |

### New findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------|-------|--------|---------------|--------------------------|
| QLT-811-01 | **Major** | `src/components/features/estimate-review-edit/review-tree-editor.tsx:132-138` (following) and `:155-161` (the `replaceState` write); `src/lib/estimates/leave-guard.ts` `onPopState` | STORY-05.08 AC-4 (nothing typed is lost on leaving); DL-470 (3) | The guard arms by pushing an extra entry of the address it sees, and stays armed after the gate is clean again. Later, a row opened **without a navigation** (an add, which opens the new row, `use-parts-tree.ts:249`; a move that renumbers the open row; a delete fallback; `Summary`'s `onChoosePart`) makes the island `replaceState` the **top** (extra) entry. The page's own entry keeps the older `?row=`. Back lands on that entry, which equals `armedFor`, so the guard asks (`ask` → `gate.settle()`). Next.js's own `popstate` restores that entry's search params, and the island's following code calls `choose()` on the row the old address names. That unmounts the form holding the typed, unsaved value (`gate.forget`). By reading, not reproduced | A natural sequence: open row 1.1, edit a field and leave it (saved, guard armed), press "+" on 1.1 (1.1.1 opens), type its Description, press Back. The typed text is lost and the page shows row 1.1. Either the dialog then asks about nothing, or `settle()` finds the gate clean and `go(-2)` leaves the page without asking. After a move, the "followed" row can be a **different part** that now holds the old number | Do not unmount a dirty form to follow the address. (1) In the following block, follow only when `!reviewSaveGate.isDirty()`. Otherwise keep the open row and put its number back in the address (`window.history.replaceState(window.history.state, '', addressWithRow(window.location.href, shownSlNo))`), so the dialog decides with the row and the text on screen. (2) Make "Leave without saving" from Back still land correctly when `go(-2)` stays on this page (for example, the guard drops the gate's marks before it traverses, or the island follows a traversal the guard itself made). Keep `seenRow`'s update as it is | E2E in `estimate-review-row-return.spec.ts` at the three widths: the sequence in the Impact column, then expect the dialog with 1.1.1 open and its text kept; "Keep editing" keeps both; Back and "Leave" leaves. Plus the same with a move of the open row. A unit case for the follow rule with a dirty gate |
| QLT-811-02 | Minor | `tests/e2e/estimate-review-row-return.spec.ts:64-92`; `review-island-seed-wiring.test.ts:36-40` | DL-470 (3); test adequacy | The PR says "Back and Forward between rows work", and `1be495a3` was made for a CI failure, but the following is pinned only by a source regex. No browser case presses Back from `?row=1.1` to row 1 and Forward again on the island, clean | A regression in the following code (for example Next.js no longer syncing `replaceState` into `useSearchParams`) would pass CI | Add the clean Back and Forward case (row 1, then 1.1 by a press, then Back shows row 1 and its values, then Forward shows 1.1) to the same spec; it can share the setup with QLT-811-01's case | that case |
| QLT-811-03 | Minor | `review-tree-editor.tsx:122`; `use-parts-tree.ts` (`seeded`); `review-tree-edit.ts:48-50` | rule 8 (section 5b shape (i)); coding standards §1 (no duplication) | "The form is seeded only if the tree was" depends on two separate copies of one predicate: `formSeedOf` (estimate match and `parseTreeAnswer(seed.tree) !== null`) and the hook's own `seeded` (the same two checks). They agree today. A later change to one (for example the hook also checking `nodes.length` or the first row) would seed the form with a tree read from the server, which is the ARC-811-01 hole again. The tree is also parsed twice per mount | Latent: the ARC-811-01 lost update could come back with no red test, because test 3 calls `formSeedOf` and the hook separately with the same refused input | Have `usePartsTree` say where its tree came from (for example `fromSeed: boolean`, set once with `seeded`), and derive `formSeed` from it: `seedKept && tree.fromSeed ? firstSeed : undefined`. `formSeedOf` can then go, or stay as the hook's own check | a hook case: a seed the hook refuses gives `fromSeed` false and the island's form no seed |
| QLT-811-04 | Info | `tests/unit/part-form-seeded-reads.test.ts:154` | QLT-839-05; coding standards §8 | The comment calls the tree row "what a save is sent with". After #839 that is false: the row's revision is only the guard's check at mount | A reader learns the old rule | "the tree row (what the guard checks the seed against at mount) says 2" | — |
| QLT-811-05 | Info | `review-tree-editor.tsx:169-177` (`reading`) | DL-465 (3); section 5c | When the tree seed is refused, the island draws `PartsTreeList` with no toolbar slot and no foot while it reads `/tree`, then `TreePanel` adds both, so `#review-actions` moves on that path. It is latent (`part-form-seed.test.ts` pins that the reader accepts the builder's tree) | A late move only if the seed is refused | Optional: pass the same reserve (`renderToolbar` and the foot) in the `reading` branch | — |
| PRF-811-09 | Info | PR body, the DL-463 proof table | NFR-010; DL-452 (3) | The sequential server render rose on Prepared (67 to 133 ms) and at 53 rows (80 to 113 ms) in one pass. It does not follow the added work (201 rows: −9 ms; Approved, no island: +18 ms) | None found; within NFR-010 | Run the sequential render once more in PRF-811-04's rerun and record it. If Prepared is still more than 20 ms up, profile `treeBody`'s parse | — |

### NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-001 | **None found**; no route or check changed | — |
| NFR-002 | **None found**; nothing new reaches the Engineer | — |
| NFR-009 | **Low to medium**: first load 365 B under the ceiling; TBT not shown; HTML grows by about 1 KB per row | PRF-811-04, -05 |
| NFR-010 | **Low**: identical statements; server render within noise | PRF-811-06, -09 |
| STORY-05.08 AC-4 (unsaved work) | **Medium**: one reachable loss path | QLT-811-01 |

### Issues for other roles
- **developer (lane 2):** QLT-811-01 and its E2E case before merge; QLT-811-02 in the same spec; PRF-811-04's TBT rerun (and PRF-811-09's render in the same pass). QLT-811-03 now if cheap, else a `follow-up` issue. PRF-811-05 and PRF-811-06 as `follow-up` issues.
- **orchestrator:** read Stage 11b's `/estimates/[code]` figure from run 46098249999 against 194,000 B, and the E2E shards, before the merge.
- **master:** rule on the TBT term if the rerun misses it (DL-463).
- **qa-engineer:** QLT-811-01's sequence is a candidate regression case for the final review (unsaved text with a row opened by an add or a move, then Back).

### Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-811-combined.md` (round 2)
- Jira / GitHub updates: PR #811 COMMENT review (round 2), replies on the PRF-811 threads; Jira AQP-488 comment
- Open questions: none
- Risks raised: none new (QLT-811-01 is a finding on this PR)
- Recommended next agent: developer (lane 2) for QLT-811-01 and QLT-811-02 and the TBT rerun; then a short round 3 on the delta

---

## Round 3: combined security and quality, at `d71e62fa` (delta from `19ced41e`)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (CLAUDE.md §9 item 2) |
| Review round | 3 |
| Head | **`d71e62fa`**. Master `43b02a11` (#841: QLT-839-04 and -08 follow-ups, the `ownMove` hand-over) merged in at `9bd23771` |
| Delta read | `5726a1f6` (the QLT-811-01 to -04 fixes), `9bd23771` (the merge; its one conflict, `use-parts-tree.ts` `change()`, read with `git show --cc`), `d71e62fa` (test) |
| Date | 2026-11-28 |
| **Verdict** | **REQUEST CHANGES, held only on PRF-811-04's TBT term, pending lane 2's five interleaved pairs.** **Open: 0 Blocker, 0 Critical, 1 Major (PRF-811-04), 1 Minor (QLT-811-06, new), 5 Info (QLT-811-05, QLT-811-07, QLT-811-08, PRF-811-07, PRF-811-09).** PRF-811-05 and PRF-811-06 (Minor) are deferred to follow-up #842. **QLT-811-01 is fixed.** **PRF-811 Majors:** -01, -02 and -03 fixed; -04 open until the medians are in. **It becomes APPROVE WITH COMMENTS if:** the median TBT of the head is within 10 % of master `43b02a11`'s, and the run of record at `d71e62fa` is fully green with Stage 11b at or below 194,000 B |

### Summary

**QLT-811-01 is fixed, by construction.** `rowNamedByAddress` (`review-tree-edit.ts`) returns null while `reviewSaveGate.isDirty()`, so a dirty island never unmounts its form to follow the address. A second effect puts the open row's number back in the address, so the guard asks with the row and the text on screen. The unit table pins the rule. The two browser cases (an add, then a move that renumbers the open row, each with the guard armed, typed text, and Back twice with "Keep editing") pass at three widths on the branch. Lane 2 could not show them red without the fix, so they are regression pins, not proof of the fault.

A likely reason, which I have not verified: Next.js may not sync a `replaceState` that carries its own history state into `useSearchParams`. If so, the island's own writes never move `rowParam`, and the mismatch needs an entry that the router itself made. Either way, the rule now holds whatever Next.js does.

**The #841 merge is clean (RISK-035).** `use-part-form.ts` differs from master only by the one seed guard. `ownMoved` and its `ONE_WRITE` and `sent` checks are master's. `change()` keeps master's `onDone(answer, direct)` and the island's `onWrote` wrapper, which runs after every change that went through, direct or after the limit. `own-move-wiring.test.ts` is identical to master, and the Engineer's chain (`estimate-workspace.tsx` → `PartForm` → `PartFields`) is intact. **One gap:** the island's form is not handed `tree.ownMove`, so the Lead does not get #841's fix (QLT-811-06, Minor).

**Authorization and NFR-002 are unchanged.** The delta touches no route, service, body or role check. The new code is client logic in the island's lazy chunk and one returned boolean in `usePartsTree`.

| Severity (open after this round) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (PRF-811-04, pending the medians) |
| Minor | 1 (QLT-811-06); plus PRF-811-05 and -06 deferred to #842 |
| Info | 5 (QLT-811-05, -07, -08, PRF-811-07, -09) |

### Checks run

| Check | Source | Result |
|-------|--------|--------|
| Delta | `git show 5726a1f6`, `git show --cc 9bd23771`, `git show d71e62fa`; files at `d71e62fa` | read |
| RISK-035 after #841 | `git diff origin/master d71e62fa` for `use-part-form.ts`, `own-move-wiring.test.ts`, `part-form.tsx`, `part-fields.tsx`, `estimate-workspace.tsx`, `part-form-revision.test.ts`, `use-parts-tree.test.ts` | only the seed guard differs in `use-part-form.ts` (plus #811's earlier `byPress` line in `part-fields.tsx`); the rest are identical to master |
| CI at `19ced41e` (run 46098249999) | job log | **fully green**: unit 559 files; 735 files with the security suite; **Stage 11b `/estimates/[code]` 193,636 B**; E2E shards 1 to 4 green |
| CI at `d71e62fa` (run 46103920056) | job list | **in progress** when this was written. For the orchestrator: Stage 11b at or below 194,000 B, and the three new `estimate-review-row-return.spec.ts` cases green at three widths |
| Local runs | none | the PC is kept quiet for lane 2's TBT pairs |

### Prior findings

| ID | Severity | Status at `d71e62fa` | Evidence |
|----|----------|----------------------|----------|
| QLT-811-01 | Major | **Fixed** | `review-tree-edit.ts` `rowNamedByAddress` (null while dirty); `review-tree-editor.tsx:136` and the mend effect at `:163-168`; `review-address-follow.test.ts` (rule table); `estimate-review-row-return.spec.ts` add and move cases (regression pins, see Summary); a wiring pin in `review-island-seed-wiring.test.ts`. Keeping `seenRow` up to date means a dirty island does not follow later either, which is what DEF-149 shows on the island (QLT-811-07) |
| QLT-811-02 | Minor | **Fixed** | the clean Back and Forward case: a synced entry made with `history.pushState(null, …)`, Back shows row 1, Forward shows 1.1. The entry is synthetic (the app makes such entries by router navigation), which is enough to pin the following |
| QLT-811-03 | Minor | **Fixed** | `usePartsTree` returns `fromSeed: seeded !== null`; `formSeed = seedKept && tree.fromSeed ? firstSeed : undefined`; `formSeedOf` is gone and the tree is parsed once. Test: `fromSeed` true or false over the five seeds, and the island's pair. One assertion was loosened (QLT-811-08) |
| QLT-811-04 | Info | **Fixed** | `part-form-seeded-reads.test.ts:154` |
| QLT-811-05 | Info | Open (optional) | unchanged |
| PRF-811-02 | Major | **Fixed, confirmed** | 193,636 B at `19ced41e`. Re-read at `d71e62fa` (#841 and `fromSeed` came in; expect a few bytes) |
| PRF-811-04 | Major | **Open until lane 2's medians land** | **Closing rule:** five interleaved pairs, `d71e62fa` against master `43b02a11`, on a quiet PC, at Prepared with 1 row and with 53 rows. Give every run and the medians. Closed if the head's median TBT is within 10 % of master's at each. Otherwise it goes to master under DL-463. The other terms stay met (0 reads, action delay lower than master) |
| PRF-811-05, -06 | Minor | **Deferred** to [#842](https://github.com/sankumar76/Accucut-Quotation/issues/842) | — |
| PRF-811-07, -09 | Info | Open | unchanged |

### New findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------|-------|--------|---------------|--------------------------|
| QLT-811-06 | Minor | `src/components/features/estimate-review-edit/review-tree-editor.tsx:203-216` (`<ReviewForm>`) | QLT-839-04 (#841); STORY-05.10 AC-7a, AC-7b | #841 makes the person's own move of the open part one of the form's own saves, through `ownMove` from `usePartsTree`. The Engineer's workspace passes it (`ownMove={tree.ownMove}`, pinned by `own-move-wiring.test.ts`). The island's `ReviewForm`, whose props pass through to `PartForm` (`Omit<PartFormProps, 'review'>`), is not given it | On the Lead's island, after a move of the open part, the next save is a 409 and a re-read. It is fail-safe (no notice, no wrong write), but it costs a round trip, and a value typed without leaving its field can be lost on a page leave: the keepalive PATCH is refused 409 and the re-read does not survive the unload. That is QLT-839-04, which #841 fixed for the Engineer only | `ownMove={tree.ownMove}` on the island's `<ReviewForm>`, and one line in `review-island-seed-wiring.test.ts` (or `own-move-wiring.test.ts`) that pins it. In #811 if cheap (one prop and one pin); otherwise a follow-up | the wiring pin; optionally an island case: move the open part, then save, with exactly one PATCH and no 409 |
| QLT-811-07 | Info | `src/lib/estimates/leave-guard.ts:153-166` (`go(-2)`); DEF-149 (AQP-506, #844) | STORY-05.08 AC-4 | Asked for a view: after an add on the island, Back twice, then "Leave without saving" does not leave (lane 2; QA has not run it) | **Fail-safe:** nothing typed is lost, nothing wrong is saved, and the person is not trapped (a link, or Back again, leaves) | **Not a #811 merge condition** in my view. (a) No data is lost and no wrong write happens. (b) The fault is in the shared guard's `go(-2)` arithmetic, which needs its own test-first fix (a guard unit case with the island's history, and the E2E case DEF-149 names). (c) #811's dirty-island rule now keeps the row and the text when that `go(-2)` lands on this page, which is the safe direction. **But it is reachable only on #811's surface**, so it belongs in the hardening window before G8, not after. I would grade it **Sev-3** (an AC fails in a narrow path, fail-safe, with a workaround); master rules | DEF-149's proposed tests |
| QLT-811-08 | Info | `tests/unit/part-form-seeded-reads.test.ts:196` | DoD (tests not weakened) | `expect(loads.tree).toHaveBeenCalledTimes(1)` became `toHaveBeenCalled()`, because the new `fromSeed` checks above it also mount trees that read. The case no longer pins "the island's pair reads the tree once" | A double read on the refused-seed path would pass | `loads.tree.mockClear()` before the island's pair, and keep `toHaveBeenCalledTimes(1)` | — |

### Issues for other roles
- **developer (lane 2):** QLT-811-06 (one prop and a pin) in #811 if cheap; QLT-811-08 (one line).
- **orchestrator:** read run 46103920056: Stage 11b at or below 194,000 B, the four E2E shards, and the three new row-return cases. Send lane 2's TBT medians for the PRF-811-04 close.
- **master:** DEF-149's grade and owner. My view is in QLT-811-07: not a #811 merge condition; hardening before G8; Sev-3.
- **qa-engineer:** DEF-149's steps on the branch when the PC is free.

### Hand-off
- Status: COMPLETE (PRF-811-04's close waits for lane 2's medians, CI's for run 46103920056)
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-811-combined.md` (round 3)
- Jira / GitHub updates: PR #811 COMMENT review (round 3), replies on the QLT-811 threads; Jira AQP-488 comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: orchestrator (CI and the medians), then this reviewer for a short PRF-811-04 close

### Round 3 addendum: DL-476 (DEF-149)

- **DL-476 supersedes QLT-811-07's view.** DEF-149 is **Sev-2** and a **#811 merge condition**, with the exception in DL-476 (4). I accept both. Sev-3 on the test-plan scale covers wrong wording, state or layout, not an AC choice that does nothing, so my grade was wrong on the scale's own words. QLT-811-07 is closed as superseded. **The open count for round 3 becomes 0 Blocker, 0 Critical, 2 Major (PRF-811-04; DEF-149 under DL-476), 1 Minor (QLT-811-06), 4 Info (QLT-811-05, QLT-811-08, PRF-811-07, PRF-811-09).**
- **One point on the mechanism, for the fix (forwarded to master; it does not change the grade or the gating).** `history.replaceState` never adds an entry, so the island's `?row=` writes cannot by themselves make `go(-2)` land on the estimate page. By reading, the extra entry comes from the guard's own click path (`leave-guard.ts:138-146`). With the guard armed and the gate clean, a click on a same-page row link (`?row=` only) is taken, `armedFor` is set to null, and `router.replace` puts the new address on the guard's extra entry. The history then holds **two entries of the estimate page** (the page's own entry and the replaced one), and a later arm adds a third. `go(-2)` from the guard's next Back then lands on the page's own, earlier entry. Lane 2's add case has exactly this step (`chooseRow(page, '1')` after the save that armed the guard).
- **This path is also on master** (not verified in a browser). Master's Lead page has had the same row links and the editable form with the guard since #806 (`estimate-review.tsx:227`, `LazyReviewForm`; `review-tree.tsx:73-74`). So DEF-149 may reproduce there with no island: edit a field and leave it, click another row's link, type, Back, "Leave without saving".
- **For lane 2's fix and the proof:**
  - (a) The guard's bookkeeping must survive its own `router.replace` of its entry. A marker held in the guard's `history.state` is lost when the router replaces that entry with its own state, so a marker-only count needs care.
  - (b) DL-476 (5) (ii) ("a row chosen in the tree") must choose it **by the row link with the guard armed and the gate clean**, which is the step that makes the second entry.
  - (c) QA could run the no-island steps above on master to settle where the defect comes from. That does not change where it is fixed.
