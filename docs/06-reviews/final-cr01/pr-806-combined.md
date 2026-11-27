# Review Report — PR #806 (AQP-488 / DEF-131 Stage 2, FR-116: a Lead or an Admin corrects a part's inputs on SCR-06) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: editing writes the inputs a price rests on; NFR-002) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-488-lead-edit-inputs` (PR [#806](https://github.com/sankumar76/Accucut-Quotation/pull/806), draft), **0 behind** master `2e11c44d` (#800 squashed) |
| Commits reviewed | `a691e69e` (the rebuilt branch), then **`a701377e`** (`6995a42b`: ED-7 and ED-8 as short cases, `estimate-cleared.spec.ts` back to master's; `a701377e`: the fixes of QLT-806-01 and -02). The verdict is given at `a701377e` |
| Date | 2026-11-30 |
| Reviewed against | Jira AQP-488; UX ruling `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md` (ED-1 to ED-17; ED-18 onwards are the tree edit, not this PR); architect's note `docs/04-architecture/lead-admin-input-edit-2026-11-27.md` v1.2 (`55d90dc5`); QA's DEF-131 Row E; PRD v0.65 (first-load ceiling 193,500 B); DL-422, DL-438, DL-442; `docs/standards/coding-standards.md` §1, §3, §4, §5, §6 |
| **Verdict (at `a701377e`)** | **REQUEST CHANGES** (one Major, QLT-806-03: the new approved and not-editable 409 branch has no test, and the PR body's reason for that is inaccurate). **No Blocker or Critical open**, so the §9 item 2 stop does not apply. Two conditions before merge: QLT-806-03 (a unit test, no browser needed), and the run of record 45928301287 fully green (see "Run of record") |

## Summary

**History: sound.** `a691e69e` is a merge whose first parent `52fb32d5` is one feature commit on master `2e11c44d`, and its tree is exactly `52fb32d5`'s. So the `merge -s ours` second parent carries the old stacked history and changes no file. `6995a42b` and `a701377e` touch only three test files. A squash applies exactly the tree diff against master: **19 files, +666/−60** at `a701377e`. GitHub's own file list (`gh pr diff 806`, 109 files) still counts from the old merge base, so the git tree diff is the one to read.

**#800: one line had been reverted, now fixed.** In the rebuilt branch, `estimate-review.spec.ts:125` had #800's strict row-line regex back, undoing `f554460d` (QLT-806-02). `a701377e` restores master's line. Every other late #800 fix survives: the array-shaped RO-3 read, the `#part-form-title` locator, `lead-warning.spec.ts`'s counts of 3, and the architecture guards.

**Security: holds.**

- **No server change.** The inputs `PATCH`, the image route and the services are master's. Every input write runs `assertEditable` after the row lock (`estimate-service.ts:170-180`):
  - an ignored estimate gets its own 409;
  - otherwise `canEditInputs` (Draft for everyone who may open the estimate; Prepared by the state machine for the role; never Approved, Quoted or ignored) or the 409 `ESTIMATE_NOT_EDITABLE`.
  So **no new write path opens to an Engineer**, whose rights are what they were.
- **The audit (#805)** is on master: Lead and Admin input and picture writes write `estimate.inputs_changed`, covered by `input-audit.test.ts` and `image.test.ts` with Lead and Admin viewers.
- **Status rule (point 1):** `editable` is `canEditInputs` with the viewer's real role, decided on the server (`estimate-review.tsx`, `review-page.tsx`) and asked again by the server on each write.
- **NFR-002:** the server hands the form ids, the rows mapped to name and kind, `editable`, and `review` (`notice`, `showing`, `figuresCurrent`: two strings and a boolean). No figure and no function. The Engineer's form is unchanged: `onLocked` and `onWrote` are `review`-only, and the notice logic for `review === undefined` is the same. The architecture guard now also covers `review-form.tsx` and `lazy-review-form.tsx`, and pins the shell to a type-only import plus a bare `import()`.

**Saving and Recalculate (point 2): as designed.**

- The `PATCH` is reused unchanged.
- One module-level `reviewSaveGate` is shared by the form and `press()`. `press()` flushes it and waits for it to settle, and refuses with words while a field shows a value that could not be saved.
- The singleton is safe across navigation: `usePartValues` calls `gate.forget(partId)` on unmount, and its `offerFlush` registration unsubscribes.
- Figures are cleared by the server's `inputs_revision`.
- The page refreshes once, when they go from current to cleared (`createClearedRefresh`: after a Recalculate it asks again), plus a debounced refresh after a rename, a conflict or a refusal.

**Conflicts (point 3):**

- ED-8's conflict notice is shown in the browser.
- The ignored 409 turns the block read-only (ED-12, browser).
- The approved and not-editable 409s are handled by a new branch (`LOCKED_CODES` → `onLocked`) that **no test reaches** (QLT-806-03).

**Tests (point 7):**

- ED-1 (a unit test over every status, role and ignored flag), ED-2, ED-3, ED-7, ED-8, ED-12 (ignored half) and ED-17 are covered.
- **+0 persons.** The two changed specs keep 4 = 4 and 13 = 13 person-making calls. The new `estimate-review-tree.spec.ts` makes tasks through `POST /api/v1/tasks` and uses the existing Lead and E2E Engineer. It sorts before `users.spec.ts`, and nothing is added after it.
- Gaps: ED-9, ED-16 and the read-only browser check are judged below.

**First load (point 8):** Stage 11b at `a691e69e` is **192,747 B**: +205 B against master (192,542 B) and 753 B under the 193,500 B ceiling. `src` is unchanged since, so the run of record should read the same.

| Severity | Count (open at `a701377e`) |
|----------|-------|
| Blocker | 0 (QLT-806-01 fixed in `a701377e`) |
| Critical | 0 |
| Major | 1 (QLT-806-03; QLT-806-02 fixed in `a701377e`) |
| Minor | 3 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| History | `git log --format='%h %p'`; `git rev-parse a691e69e^{tree}` against `52fb32d5^{tree}`; `52fb32d5^` | First parent `52fb32d5` = one commit on `2e11c44d` (master); the merge's tree equals it; 0 behind |
| Diff | `git diff origin/master a701377e` (19 files); `git diff a691e69e a701377e` (3 test files) | Read in full: `review-page.tsx`, `estimate-review.tsx`, `review-texts.ts`, `lazy-review-form.tsx`, `review-form.tsx`, `part-fields.tsx`, `use-part-form.ts`, `review-look*.ts`, `cleared-refresh.ts`, `review-save-gate.ts`, `recalculate-client.ts`, and the test files |
| #800 lost or reverted | grep master against the head for #800's late E2E lines; diff of every #800 file | One revert (the row-line regex, QLT-806-02), fixed in `a701377e`; nothing else lost |
| Server rules on master | `can-edit-inputs.ts`; `estimate-service.ts:150-180` (`assertEditable`); the `nodes/[nodeId]` and `inputs` routes | As in the Summary; the routes are unchanged by this PR |
| The route's `inputs` shape | `nodes/[nodeId]/route.ts:22` (`inputEntriesOf`) | A list of `{ fieldId, value }`: this is the basis of QLT-806-01 |
| Unit and security tests at `a691e69e` | 30 files (review-edit-wiring, review-save-gate, review-inputs-block, review-look, architecture, screen, overlay-imports, part-form-lazy, source-conventions, security, and every unit file naming `PartForm`, `usePartValues`, `recalculate-client`, `save-gate`, `EstimateReview` or `canEditInputs`) in a temporary scratchpad worktree, since removed | **29 files, 1,036 passed.** `estimate-node-kinds-service.test.ts` cannot load there: it needs the generated Prisma client (`src/generated`, built by CI's `prisma generate`), and master fails the same way in that worktree. Not a regression; CI's to run. `src` is unchanged since, so these hold at `a701377e` |
| Stage 11b | run 45926770972 (job 140269793873) at `a691e69e`; master run 45925520372 (job 140265813467) | `/estimates/[code]` **192,747 B** against master **192,542 B**: +205 B, 753 B under 193,500 B |
| The cancelled run (45926770972) | E2E shard logs | Cancelled by the next push before Playwright printed its failure report. On desktop, `estimate-review.spec.ts:102` (AC-2), `:189` (Admin) and `:201` (AC-6) failed both attempts, and `estimate-tree-names.spec.ts:327` once; on mobile, `unlock.spec.ts:204`. **On mobile the same AC-2 case passed**, so the row-line regex (width-independent) does not explain the desktop failures. With no error text, the cause is unknown: see "Run of record" |
| DL-422 | person-making calls in the changed specs, master against head; the new spec read in full | +0 |

## Findings

| ID | Severity | File:line | Rule / check | Issue | Why (impact) | Fix |
|----|----------|-----------|--------------|-------|--------------|-----|
| QLT-806-01 | **Blocker → Fixed in `a701377e`** | `tests/e2e/estimate-cleared.spec.ts:103` (at `a691e69e`) | §6; ED-7 | The ED-7 step read `GET /nodes/{id}` as `inputs: Record<string, string>` and asserted that `Object.values(held)` contains `'111.50'`. The route returns a list of `{ fieldId, value }` (`inputEntriesOf`; #800's `7778a2aa` had already fixed the same read), so the assertion could not pass. | A certain red E2E | Done: ED-7 is now a short case in `estimate-review-tree.spec.ts` that reads the list and checks field H's value as a number |
| QLT-806-02 | **Major → Fixed in `a701377e`** | `tests/e2e/estimate-review.spec.ts:125` | the brief ("nothing of #800 reverted") | The rebuilt branch put back #800's strict row-line regex, undoing `f554460d` (which accepts `—` for `$` and `€`) | A revert of a merged fix | Done: master's line is restored |
| QLT-806-03 | **Major** | `src/components/features/estimate-workspace/use-part-form.ts:217`; `review-form.tsx` (`refuse('locked')`) | ED-12; §6 (each new branch tested) | **The approved and not-editable 409 branch has no test.** The ignored half of ED-12 is proven in the browser, but it goes through the **existing** `onServerIgnored`, not the new `onLocked`. The PR body says the approved and not-editable 409s "go through the same `onLocked` path", which they do not. So the one new branch of this PR's conflict handling — `LOCKED_CODES`, the `mark(fieldId, false)`, `onLocked()`, and the island's turn to `FORM_LOCKED` with `Autosave` and `LeaveGuard` removed — is reached by no unit, integration or E2E test. | The server still refuses the write, so no data is at risk. But if the branch is wrong (for example a code renamed in `state-machine.ts` or `estimate-service.ts`), a Lead whose estimate was approved elsewhere would keep typing into a form that silently fails each save, with only the "could not save" status. That is the case ED-12 exists for | **Before merge** (a unit test, no browser and no approve flow needed): drive `usePartValues` with a fake save answering `{ status: 'refused', httpStatus: 409, code: 'ESTIMATE_NOT_EDITABLE' }`, and again with `'ESTIMATE_APPROVED_IS_LOCKED'`. Assert `onLocked` is called once, the field is not marked unsaved, and nothing is re-sent. Then render `ReviewForm` with `onLocked` fired and assert the notice is `FORM_LOCKED` and `Autosave` / `LeaveGuard` are gone. Also pin `LOCKED_CODES` against the two exported code constants, so a rename fails the test. Correct the PR body's sentence |
| QLT-806-04 | Minor | `tests/e2e/estimate-review*.spec.ts` (absent) | ED-9 | **ED-9 (choosing another row commits the typed value first; an invalid value asks "Leave without saving?") has no test on the review.** The PR body says the Engineer's tests cover it. That is only partly so: on SCR-05, choosing another part goes through the workspace's registered `guardedTree.select`, while on SCR-06 it is a `next/link` click that `LeaveGuard`'s link listener must catch. The listener does handle links (`leave-guard.tsx`), so the behaviour is very likely right. | A different way in than the one the Engineer's tests prove | **Acceptable for merge as stated**, with one browser case in the hardening window: type an invalid value, press another row, and expect `Leave without saving?`; type a valid one, press another row, and expect a `PATCH` before the navigation |
| QLT-806-05 | Minor | `tests/e2e/estimate-review.spec.ts:128` | RO-6 (#800) | **The read-only block lost its browser check.** The Lead's calculated case, which asserted that the block of a read-only estimate has no buttons, sends nothing when typed into and is `aria-readonly`, is now (rightly) the editable case. No E2E now shows an Approved or Quoted block read-only and silent. The read-only path is #800's plain `PartForm`, still unit-tested. | A regression in the read-only path would be caught only by unit tests | **Acceptable for merge**; in the hardening window, add the three assertions to an existing approved case (for example in `approve.spec.ts` after Approve and lock) |
| QLT-806-06 | Minor | `src/app/(portal)/estimates/[code]/review-page.tsx:64` | §1 and §4 (no silently swallowed error) | `revisionOf` catches **every** error and returns 0 with no log. A failed read (the database down, a bug) is indistinguishable from a deleted part. The Lead's first save is then sent with revision 0 and meets the conflict notice ("This part was changed somewhere else"), which is untrue in that case. | Misleading words, and a fault hidden from the logs | Catch `NotFoundError` only and return 0, and let anything else reach the page's error handling; or at least `logger.warn` it with the request ID |
| QLT-806-07 | Info | `src/components/features/estimate-workspace/lazy-review-form.tsx:26` | §1 (no magic strings) | The shell writes `We could not load the form`, `Check your connection and try again.`, `Try again` and `Loading the form` inline, duplicating `estimate-texts.ts`'s constants, so that the shell pulls in no texts module (stated in its comment) | They can drift from the form's own words | A unit test asserting the shell's strings equal `FORM_LOAD_FAILED_TITLE`, `TRY_AGAIN` and `FORM_LOADING` |
| QLT-806-08 | Info | `tests/e2e/estimate-review-tree.spec.ts:72`, `:102` | §6 | ED-7 asserts "the last response is the calculate, after at least one save", but not ED-7's "the new figures use it": the Draft has missing inputs, so the Recalculate is probably refused, and `review-save-gate.test.ts` covers the order. ED-8 asserts the notice and both choices, but not ED-8's "nothing is overwritten silently" (that the Engineer's `5` is still held) | Two halves of the two checks are not in the browser | ED-8: `GET /nodes/{id}` after the notice and expect field H = 5. ED-7: optional |
| SEC-806-01 | Info | as in the Summary | points 1, 5, 6 | Status rule on the server; no server change; no new Engineer write path; no figure or function reaches the form; the Engineer's form is unchanged; the guard covers the new client files | — | — |
| SEC-806-02 | Info | branch history | the brief | `merge -s ours` verified: the squash applies exactly the 19-file tree diff. Read that diff, not GitHub's 109-file list | — | — |
| SEC-806-03 | Info | `src/lib/estimates/review-save-gate.ts` | design | The module-level gate outlives a page, but every form forgets its marks and its flush registration on unmount (`use-part-form.ts:146`, `:497`), so nothing stale reaches another estimate's Recalculate | — | — |

### The three gaps asked about: fix before merge, or acceptable as stated?

| Gap | Ruling |
|-----|--------|
| ED-12, approved and not-editable 409 | **Fix before merge** (QLT-806-03, Major). It is the only new conflict branch of the PR; a unit test needs no browser; and the PR body's reason ("the same `onLocked` path") is inaccurate |
| ED-9, leave guard | **Acceptable as stated for merge** (QLT-806-04, Minor). `LeaveGuard`'s link listener is reused unchanged. Add one browser case in the hardening window, because the way in (a link) differs from SCR-05's |
| ED-16, picture controls | **Acceptable as stated.** The control is the Engineer's own `PictureSlot`, switched by `editable`. The server rule (`assertEditable` in the image route) and the Lead and Admin picture writes and their audit are tested on master (`tests/integration/estimates/image.test.ts` with Lead and Admin viewers; `input-audit.test.ts`). A browser look is a hardening-window item, not a merge condition |

## Run of record

Run 45928301287 (CI, at `a701377e`) was queued when this review was published. **It must be fully green before merge.** In particular `estimate-review.spec.ts` AC-2, the Admin case and AC-6 on desktop, which failed both attempts in the cancelled run 45926770972 for a cause the cancelled log does not show. Mobile passed the same AC-2, so that cause is not the regex fixed in `a701377e`. If they fail again, their error text decides whether it is this PR's code (for example the editable form's refresh or autosave on a desktop layout) or the test. Stage 11b should read 192,747 B again (`src` is unchanged).

## Security notes (the brief's points)

| Point | Result | Evidence |
|-------|--------|----------|
| 1. Status rules: Draft and Prepared only; Approved, Quoted, Ignored 409; block read-only | **Yes** (server and UI); the approved and not-editable UI branch is untested (QLT-806-03) | `canEditInputs`; `assertEditable`; ED-1 unit over every status, role and ignored flag |
| 2. Saving: `PATCH` unchanged; one gate flushed before Recalculate; cleared until Recalculate; one refresh on current → cleared | **Yes** | `press()`; `reviewSaveGate`; `createClearedRefresh`; `review-save-gate.test.ts`; ED-2, ED-3, ED-7 E2E |
| 3. Conflicts: ED-8 notice; 409s for ignored, approved, not editable | **ED-8 yes; ignored yes; approved and not editable untested** (QLT-806-03) | `estimate-review-tree.spec.ts` ED-8; `estimate-review.spec.ts` ED-12 |
| 4. Audit `estimate.inputs_changed` | **Yes** (master, #805) | `input-audit.test.ts`; `image.test.ts` |
| 5. NFR-002 | **Yes** | SEC-806-01 |
| 6. No new Engineer write path | **Yes** | no server change; `assertEditable` unchanged |
| 7. Tests: ED coverage, the new spec's ED-7 and ED-8, +0 persons, nothing weakened | **Mostly** | ED-7 and ED-8 present (QLT-806-08); +0; the converted read-only assertions follow the design change (QLT-806-05); gaps QLT-806-03 and -04 |
| 8. First load ≤ 193,500 B | **Yes**: 192,747 B (+205 B) | Stage 11b at `a691e69e`; `src` unchanged at `a701377e` |
| 9. Quality | Findings QLT-806-03 to -08 | — |

## Reviewer-specific tables

### ED conformance (ED-1 to ED-17 → code → test)

| ED | Code | Test(s) | Status |
|----|------|---------|--------|
| ED-1 `editable` follows `canEditInputs` | `estimate-review.tsx`, `review-page.tsx` | `review-edit-wiring.test.ts` (every status × role × ignored) | Met |
| ED-2 a save, the line, autosave | the Engineer's form, `Autosave` in `ReviewForm` | E2E AC-2 (`PATCH` 200) | Met |
| ED-3 the first change clears, one announcement, focus kept | `createClearedRefresh`, `SAVED_CLEARED_LINE` | `review-save-gate.test.ts`; E2E AC-2 | Met |
| ED-4, ED-5, ED-6 | the Engineer's form | the Engineer's tests; ED-17 E2E for the error words | Met by reuse |
| ED-7 save before Recalculate | `press()` + `reviewSaveGate` | unit; E2E `estimate-review-tree.spec.ts` | Met (QLT-806-08) |
| ED-8 conflict notice | the Engineer's conflict handling | E2E `estimate-review-tree.spec.ts` | Met (QLT-806-08) |
| ED-9 another row commits first; invalid asks | `LeaveGuard` (link listener) | none on the review | **Untested** (QLT-806-04), acceptable as stated |
| ED-10, ED-11, ED-13 | refresh on rename; server state machine; the Engineer's reads | the Engineer's and master's tests | Met by reuse |
| ED-12 a 409 turns the block read-only | `onServerIgnored` (ignored); `LOCKED_CODES` → `onLocked` (approved, not editable) | E2E ignored only | **Half untested** (QLT-806-03) |
| ED-14 audit | master (#805) | `input-audit.test.ts` | Met |
| ED-15 | withdrawn | — | — |
| ED-16 picture controls for Lead and Admin | `PictureSlot` with `editable`; image route `assertEditable` (master) | `image.test.ts` (Lead, Admin); `input-audit.test.ts` | Met on the server; no browser check (acceptable) |
| ED-17 axe with an error showing | — | E2E AC-6 | Met |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-806-03 | `use-part-form.ts:217`; `review-form.tsx` | unit: 409 `ESTIMATE_NOT_EDITABLE` / `ESTIMATE_APPROVED_IS_LOCKED` → `onLocked` once, no unsaved mark, no re-send; `ReviewForm` shows `FORM_LOCKED` without `Autosave` / `LeaveGuard`; `LOCKED_CODES` pinned to the exported constants |
| QLT-806-04 | `leave-guard.tsx` via the tree links | E2E: invalid value + another row → `Leave without saving?`; a valid value → `PATCH` before the navigation |
| QLT-806-05 | read-only `PartForm` | E2E on an approved estimate: no button, no non-GET request, `aria-readonly` |
| QLT-806-06 | `review-page.tsx:64` | unit: a failing `getNode` other than `NotFoundError` is not turned into 0 silently |
| QLT-806-07, -08 | as listed | as listed |

## Issues for other roles

- **developer (lane 2):**
  - **QLT-806-03 before merge** (a unit test; correct the PR body's ED-12 sentence).
  - QLT-806-06 is preferred in this PR (a few lines).
  - QLT-806-04 and QLT-806-05 go to the hardening window.
  - If the run of record repeats the desktop failures, read their error text first.
- **orchestrator:** merge only on a fully green run of record (45928301287 or later), with Stage 11b stated in the PR body (192,747 B expected).
- **qa-engineer:** record ED-9 and ED-16 (browser) and the read-only block check as hardening-window items against DEF-131 Row E.

## Previous Findings (re-review only)

n/a (round 1; QLT-806-01 and -02 were raised to the orchestrator at `a691e69e` before publication and are fixed in `a701377e`).

## Round 2 (re-review of `a701377e..fabe1d09`, 2026-11-30) — APPROVE WITH COMMENTS, on the condition of a fully green run of record

**Scope.**
- One commit, `fabe1d09`. Source: `review-page.tsx` (the `catch` in `revisionOf`) and `review-form.tsx` (`reviewNotice` extracted, the same logic). Tests: `part-server.ts` (`lockNextSave`), `use-part-values.test.ts`, `review-form-notice.test.ts`, `review-page-revision.test.ts`.
- The branch is 0 behind master.
- PR review [6082793517](https://github.com/sankumar76/Accucut-Quotation/pull/806#pullrequestreview-6082793517); a reply in each of the five round-1 threads; label `review:quality-approved`.

**Checks run.**
- The 3 new or changed test files at `fabe1d09`, in a temporary scratchpad worktree (since removed, and not modified when removed): **45 passed**.
- **Mutation 1:** `revisionOf` back to `return 0` for every error. `review-page-revision.test.ts` **fails 2 of 4**.
- **Mutation 2:** the `LOCKED_CODES` branch disabled (`if (false && …)`). `use-part-values.test.ts` **fails 2 of 38**, both 409 cases.
- The new tests fail without the code, so they are real.

| Finding | Round-2 status | Evidence |
|---------|----------------|----------|
| QLT-806-03 (Major) | **Fixed** | Both codes are covered (`ESTIMATE_APPROVED_IS_LOCKED`, `ESTIMATE_NOT_EDITABLE`): `onLocked` is called once, the typed text stays (`2.00`), there is no problem and no error, the gate is not dirty, nothing is stored, and after the page turns the block read-only (`editable` false) no second save is sent. The Engineer's form, without `onLocked`, keeps the ordinary refused save (gate dirty). `reviewNotice('locked', …)` gives `FORM_LOCKED` ("This estimate can no longer be changed."). The PR body's ED-12 sentence is corrected. Mutation 2 caught |
| QLT-806-06 (Minor) | **Fixed** | 0 only for `NotFoundError`; any other fault is rethrown. It reaches `src/app/(portal)/estimates/[code]/error.tsx`, which renders the existing `RouteLoadError` with `ESTIMATE_LOAD_ERROR_HEADER`, `ESTIMATE_LOAD_ERROR_TITLE` and `ESTIMATE_LOAD_ERROR_BODY`. Mutation 1 caught |
| QLT-806-04, -05 (Minor) | Open, hardening window | as ruled in round 1 |
| QLT-806-07, -08; SEC-806-01 to -03 (Info) | Stand | — |
| QLT-806-09 (new, Info) | Open | `LOCKED_CODES` is not pinned to the exported code constants: the test and the hook use the same literals, so a server-side rename would pass both. `ReviewForm` dropping `Autosave` and `LeaveGuard` once refused is not rendered in a test. Both are cheap; neither holds the merge |

**Condition (stands).** The run of record 45929518610 (queued at publication) must be fully green. If `estimate-review.spec.ts:102` (AC-2), `:189` (the Admin case) or `:201` (AC-6) fail on desktop again, their error text decides whether the cause is this PR. Stage 11b is expected at 192,747 B: `src` changed only in a server-side `catch` and in the lazily loaded `review-form.tsx`.

**Open after round 2:** Blocker 0, Critical 0, Major 0, Minor 2 (QLT-806-04, -05), Info 6 (QLT-806-07, -08, -09; SEC-806-01 to -03). **Verdict at `fabe1d09`: APPROVE WITH COMMENTS**, on the condition above.

## Round 3 (delta review of `fabe1d09..a5cb4f10`, without master's `1b30b17f` content, 2026-11-27) — APPROVE WITH COMMENTS; the run of record is red only on a master defect

**Scope.**
- `53736200` changes two product lines (`review-form.tsx` `refuse()`, `recalculate-client.ts` `press()`) and the AC-2 Admin case.
- `0e1a227d` merges master `1b30b17f` (#818). Its resolution moves #818's AQP-496 read-only drop-down loop into a new short case of `estimate-review-tree.spec.ts`.
- `a5cb4f10` changes AC-6's expectation to `'12.50'`.
- **The resolution kept master intact.** The merged tree differs from master in exactly the same 23 files as before (the 19 of round 1 plus the 4 test files of round 2), so #818's content is untouched.

**Why the fabe1d09 run of record (45929518610) failed, and what this delta does about it.** Read from the run's Playwright report:

| Case | Error at `fabe1d09` | Cause | At `a5cb4f10` (run 45943506004) |
|------|---------------------|-------|------|
| `estimate-review.spec.ts:189` (Admin), 3 widths | expected `Read-only.`, got the editable block | a stale expectation: under FR-116 and UD-1 an Admin edits a Prepared estimate as a Lead does (`canEditInputs`; ED-1's unit test covers Admin) | **passes at 3 widths** |
| `estimate-review.spec.ts:201`/`:204` (AC-6, ED-12), 3 widths | `toHaveValue('12.5')` received `""` | `refuse()` called `router.refresh()`, and the server then drew the plain read-only form in place of `ReviewForm`, losing the typed text | after `53736200`: `"12.50"` against `'12.5'` (run 45940199415); after `a5cb4f10`: **passes at 3 widths** |
| `lead-warning.spec.ts:249`, desktop | `waitForResponse` timed out on "Recalculate anyway" | `press()` flushed a clean gate | **passes at 3 widths** |
| `estimate-tree-names.spec.ts:327` (TS-9), desktop | the hover toolbar's `Add under 1.1` is never visible and stable | see below: a master defect | **failed both attempts** |

**The four points.**

1. **`refuse()` without `router.refresh()` (ED-12): sound. Info: QLT-806-10.**
   - The block turns read-only **in place**: `refused` set, so `canEdit` is false, `editable` is false, the fields are `aria-readonly`, and `Autosave` and `LeaveGuard` are unmounted. The typed text stays on screen as ED-12 requires.
   - **Stale state:** until the next read, the head, status badge, tiles and action bar show the state from before the refusal. For example, Approve still offered on an estimate someone approved, or an ignored one without the Ignored notice. Every action from that stale state is refused by the server (Approve, Recalculate, Ignore, Cancel approval all re-check under the lock), so no write follows.
   - **Audit:** a refused write writes no audit entry (one transaction).
   - **NFR-002:** untouched; this is the Lead's and the Admin's page.
   - **Data loss:** none. The typed text was never stored, and it is shown, not dropped.
   - **True state:** any navigation, a row choice (a server render) or a reload shows it, and the server then draws the plain read-only form.
   - **QLT-806-10 (Info):** the locked notice could say so, for example `This estimate can no longer be changed. Reload the page to see its current state.`, or the review could keep `LazyReviewForm` mounted for every Lead and Admin block, so that a refresh keeps the typed text. Optional; UX wording is the ux-expert's.
2. **`press()` flushes only a dirty gate: safe.**
   - `isDirty()` is true while a save is in flight or any field is marked unsaved, and `setText` marks a field **as soon as it is typed into** (`use-part-form.ts:202`; `save-gate.ts`: "a field is marked as soon as it is typed into").
   - So the cases that need a flush are all dirty: a value typed and not left, a save on its way (the press's click blurs the field and queues its save before `press()` runs), and a value the rule refused.
   - There is no debounce between typing and marking. A clean gate means the form shows what the server holds, so the flush was a no-op save, which is what stalled `lead-warning:249`.
   - This matches master's own rule in `use-autosave.ts:51`, `:58`, `:67`.
3. **AC-2 Admin case: correct, not weakened.** It now asserts the field is enabled, not `aria-readonly`, and that the block says no "Read-only". These are positive assertions of FR-116 and UD-1 (Admin equals Lead).
4. **The moved AQP-496 loop: the same check, on a truly read-only block.**
   - It is byte-for-byte #818's loop: tap by touch; click plus Space, Enter, the arrows, Alt+Down and `a` by mouse; the value kept, `aria-readonly`, no `:open`, no `change` event, nothing sent.
   - Its `writes` collector is **stricter**: every non-GET request, where master's counted only `/api/v1/`.
   - Master's loop has no `CSS.supports` or two-option guard, so there is none to carry.
   - It runs on an **ignored** estimate, where `canEditInputs` is false, so the block is the plain read-only `PartForm`.
   - Its task is made through `POST /api/v1/tasks` with the existing Lead, so **+0 persons** (DL-422). The file sorts before `users.spec.ts`, so nothing is added after it (DL-388).
   - The loop is gone from `estimate-review.spec.ts`, where the Lead's block is now editable.

**AC-6's `'12.50'` (`a5cb4f10`): correct, not weakened.**
- The number box shows a value it was left with in two decimals. That is the form's existing on-leave formatting, and the new unit test pins the same (`'2'` is shown as `'2.00'` after the refused save).
- It is the **typed** value: the part's stored Length is empty, which is what the fabe1d09 run showed (`""`) when the refresh replaced the form.
- The assertion stays exact.

**The Stage 6 unit failure at `0e1a227d` (`tests/unit/export-perf-support.test.ts:22`): chance, and unrelated to #806.**
- `incompressiblePicture` (`tests/support/builders/export-pictures.ts`) fills about 199,000 bytes with `randomFillSync` on every run.
- The server's check rejects a picture holding any of `<script`, `<svg`, `<html`, `<iframe`, `<!doctype`, `<?xml`, matched case-insensitively (`src/lib/images/signature.ts:48`, `:88`).
- The shortest, `<svg`, gives (1/256) × (2/256)³ ≈ 1.9 × 10⁻⁹ per position, so about **3.7 × 10⁻⁴ per run** (roughly 1 in 2,700). The longer markers add almost nothing.
- Neither file is in #806's diff, and the same test passed at `a5cb4f10` (542 files, 11,733 tests).
- Lane 2's tech-debt #821 is the right place. A seeded buffer, or one regenerated until it holds no marker, removes it.

**TS-9 (`estimate-tree-names.spec.ts:327`, desktop): a master defect, not #806.**
- The case runs on the **Engineer's** SCR-05 (`signInAsNewEngineer`). Nothing in #806 reaches that page: the gate, `ReviewForm`, `cleared-refresh` and the Recalculate client are review-only, and the new `onWrote` wrapper in `part-fields.tsx` is called, never used as an effect dependency (`use-part-form.ts:337`, `:466`).
- On master, the same case on desktop **failed** in run 45925520372 (`2e11c44d`, #800's squash) and was **flaky** in run 45922731756 (`7753cdff`). It passed in run 45939075231 (`1b30b17f`). Tablet and mobile pass throughout.
- It hovers row 1.1 "where the cases before it left it", so it depends on scroll and timing.
- On #806: failed once at `a691e69e` (cancelled run), failed at `fabe1d09`, flaky at `0e1a227d`, and **failed both attempts at `a5cb4f10`**, the only failure of run 45943506004.
- **Recommendation:** record it as a master defect (QA), and let master or the delivery lead decide how the run of record treats it (a re-run, or a ruled exception as for DEF-053). It is not a #806 finding.

**Run 45943506004 at `a5cb4f10`.**
- Stages 1 to 11b **success**; Stage 11b: **`/estimates/[code]` 192,758 B**, at or under 193,500 B (`fabe1d09` measured 192,746 B).
- E2E shards 1 to 3 green: `approve.spec.ts:312` on tablet was flaky and passed on retry.
- Shard 4: only TS-9 on desktop.
- `estimate-review.spec.ts:189` and `:204`, and `lead-warning.spec.ts:249`, **pass at all three widths**.

**Condition before merge, new.** master has moved to `73143e7e` (#819, the approval dialog), which changes `estimate-review.tsx` and `estimate-review-architecture.test.ts`, both on #806's NFR-002 boundary. #806 is 1 behind. After lane 2 merges it in:
- a short `git show --cc` check of those two files;
- the run of record at 0 behind, green except for whatever master and the delivery lead rule for TS-9, with Stage 11b at or under 193,500 B.

PR review [6083908499](https://github.com/sankumar76/Accucut-Quotation/pull/806#pullrequestreview-6083908499) (COMMENT, 1 inline comment, at `a5cb4f10`); label stays `review:quality-approved`.

**Open after round 3:** Blocker 0, Critical 0, Major 0, Minor 2 (QLT-806-04, -05), Info 7 (QLT-806-07 to -10; SEC-806-01 to -03). **Verdict at `a5cb4f10`: APPROVE WITH COMMENTS.**

## Round 4 (delta review of `a5cb4f10..b6c40208`: the two merge resolutions, 2026-11-27) — APPROVE WITH COMMENTS; the two proof misses are for master's reading

**Scope.**
- `dd9abb30` merges master `635e7f7a` (#827, DEF-141's server props, with the review page's part-form seed). `b6c40208` merges master `7aa23c44` (#813, SCR-05's task card).
- No separate commit: the round-4 code is the resolution of `dd9abb30`. `b6c40208` has no conflict in #806's files.
- The branch is **0 behind**. The tree differs from master in 24 files: round 3's 23 plus `tests/unit/estimate-page.test.ts`.
- Reviewed with `git show --cc dd9abb30` and `git show --cc b6c40208`, the full merged files, the PR body's DEF-141 step-2 proof, and DL-452 (3), DL-457 (3) and DL-461 (records-u).

**Checks run.**
- 16 test files at `b6c40208` in a temporary scratchpad worktree, since removed, and not modified when removed: **790 passed**. They cover `estimate-page`, `review-page-revision`, `use-part-values`, `review-form-notice`, `review-edit-wiring`, `review-save-gate`, `review-inputs-block`, `review-look-part-fields`, the architecture and screen tests, `overlay-imports`, `source-conventions`, the security tests, and every file naming `part-form-seed`, `getPartForm` or `PartFormSeed`.
- **Mutation:** with `revisionOfSeed` made to return `undefined`, both "no second read" cases of `estimate-page.test.ts` (Lead and Admin) **fail**.
- **CI run 45994834413 at `b6c40208`: fully green.**
  - Stages 1 to 11 and 1 to 11b succeed; 551 unit files and 11,848 tests pass.
  - The four E2E shards pass 585, 596, 586 and 584 cases, with **0 failed and 0 flaky**. TS-9 also passed this time.
  - **Stage 11b: `/estimates/[code]` 193,012 B**: at or under the 193,500 B ceiling (PRD v0.65), 488 B to spare, and **+197 B** against master `7aa23c44` (192,815 B, run 45991786275).
  - The run before, 45991786275 at `dd9abb30`, was also fully green.

**(a) The merge resolutions: correct.**
- **`usePartValues`** takes both sides: #806's `onLocked` and #827's `seed`. A seed for this estimate and part starts the form `ready`, with its values and no read. `part-fields.tsx` passes `seed` beside #806's `onLocked` and `onWrote` wrapper.
- **`estimate-review.tsx`** takes both props (`selectedRevision`, `seed`). `formProps` now carries `seed`, so the editable form, through `LazyReviewForm` to `ReviewForm` to `PartForm`, also starts from it.
- **`review-page.tsx`** keeps #827's parallel reads (`getCosts`, the download marker, the two option lists) and its one `readPartFormBodies` for the row shown. #806's revision now comes from that answer.
- **The E2E spec** carries master's stronger checks into the moved case; see (c).
- **The security lens holds.**
  - The seed is read on the server through master's `getPartForm` with the viewer's access check. It carries the form definition, the typed inputs and the option lists: no figure. The Engineer's page does not draw this review.
  - Who may edit is unchanged: `canEditInputs` on the server (Draft and Prepared, Lead and Admin, never ignored), asked again by `assertEditable` on every write.
  - No new endpoint, and no role check changed.

**(b) The revision read: correct, with no second service call.**
- `revisionOfSeed` reads `revision` from the part answer the seed carries (`review-page.tsx:89`). `revisionOf`, the separate `getNode`, runs only when there is no seed or the answer has no revision.
- `revisionOf` still returns 0 only for `NotFoundError` and rethrows any other fault to the route's error boundary (QLT-806-06).
- `estimate-page.test.ts` pins it, for Lead and Admin: `getPartForm` once, `getNode` never, and `selectedRevision` equal to the part's revision. With no seed (`getPartForm` failing), `getNode` is called once, and a fault there is rethrown, not turned into 0.
- Using the one answer also removes the window in which two separate reads of the part could disagree.

**(c) The read-only drop-down case: master's stronger checks are carried, with one narrowing (QLT-806-11, Minor).**
- Carried: `CSS.supports('selector(:open)')` asked first, the value kept, `aria-readonly`, the dashed border (`border-top-style: dashed`), `:open` false, no `change` event, and nothing sent. The writes collector stays the stricter one (every non-GET request).
- **Narrowed:** master asserts that **every** enabled drop-down has two or more options (`toBeGreaterThanOrEqual(2)` inside the loop), so a one-option drop-down fails the test. The moved case **skips** drop-downs with fewer than two options and requires only that one with two or more exists (`estimate-review-tree.spec.ts:122`). A skipped drop-down then gets no `:open`, `aria-readonly` or dashed-border check, although opening its list would still break the read-only promise. Only the "no change" check is meaningless for a one-option list.
- *Fix:* run the read-only checks (`aria-readonly`, the dashed border, `:open`, the value kept) on **every** enabled drop-down, and apply the two-option requirement to the set, not as a filter. Or keep master's assertion and give the fixture's lists two options each. No new case, no person.

**Performance read of the DEF-141 step-2 proof** (the PR body, against DL-457 (3) as completed by DL-461 (B); local production builds of master `635e7f7a` and `dd9abb30`, two interleaved passes, medians).

| Term | Figure | Read |
|------|--------|------|
| (ii') statements per render and per load, at or below master's | Identical at every state and size (Prepared 105 / 120; Draft 78 / 108; Approved 81 / 96; 53 and 201 rows 102 / 117) | **Met**. The round-1 revision read (a second `getNode`) is gone |
| Round trips beyond those named | none | **Met** |
| (iii) form-data reads after hydration | 0 at every state and size | **Met** |
| (v') reads in flight at hydration | 0 in every trial | **Met** |
| Server time of `GET /estimates/[code]` | Prepared 108 → 83 ms, Draft 81 → 109 (one pass at 143), Approved 68 → 63, 53 rows 125 → 104, 201 rows 204 → 217 | **No signal.** With identical statements the server does the same work; the mixed signs are the laptop's spread |
| (v') action delay at hydration minus idle, at most master + 20 ms | Recalculate +65 against master's +37 (**+28**); Approve +60 against +34 (**+26**) | **Not met, by 6 to 8 ms.** Per pass: Recalculate +37 and +19, Approve +33 and +19, so one pass is inside the band in each. Master's own Approve baseline moves from 14 to 54 ms between passes. At 1 s after hydration both actions equal idle |
| (iv') TBT median, at or below master's | 742 ms against 636 (**+106 ms, +17 %**); TTI +248 ms; 4 runs each, one at 1,337 ms in #806's | **Not met** |

**What the misses are.**
- Both are the same, small, real cost: **main-thread work in the hydration window**, not data loading.
- On an editable page `LazyReviewForm` asks for its chunk as soon as it mounts (`useLazyComponent(loadForm, true)`, `lazy-review-form.tsx:22`). It then evaluates and mounts `ReviewForm` with `Autosave` and `LeaveGuard` while hydration is finishing.
- Under Lighthouse's 4× CPU the +106 ms of TBT is about 25 to 30 ms of real CPU time.
- Nothing is queued on the server, and nothing is read: the DEF-141 fault (browser reads after hydration, and actions queued behind them) is **absent**.
- It is the cost of FR-116's edit island itself, as DL-461 (B) found the Approve residue on #827 to be. One difference matters for master's reading: on #827, (iv') TBT was **below** master's, and DL-461 judged the residue by that. Here TBT is **above** master's.
- Under DL-457 (3) (iv'), "any gap left … is judged only by NFR-009 on the reference machine (DL-455 (7) (b))".

**My read for master.**
- No code fault, and no merge blocker from this review.
- The two misses can be accepted **provisionally as FR-116's cost**, graded by NFR-009 on the reference machine in the final review, as DL-461 (C) did for #827's server time.
- If master wants the cost lower before G8, the cheapest lever is when the chunk is asked for. Start the import at idle (`requestIdleCallback`), or on the first pointer or focus inside `#row-inputs`, and keep the seeded read-only `PartForm` on screen until then, so the values show at once and editing arrives a moment later. That is the kind of deferral DL-461 (B) put after G8 for #827, because it adds a path in which the form is briefly not editable. The same reasoning applies here, so I would log it as the same follow-up, not as a condition.

**New in round 4**

| ID | Severity | File:line | Note |
|----|----------|-----------|------|
| QLT-806-11 | Minor | `tests/e2e/estimate-review-tree.spec.ts:122` | The two-option guard became a filter: one-option drop-downs are skipped, so they get no `:open`, `aria-readonly` or dashed-border check. Fix as in (c). Hardening window, or this PR if quick |
| PRF-806-01 | Info (for master) | `src/components/features/estimate-workspace/lazy-review-form.tsx:22` | (v') +26 / +28 ms over the band and (iv') TBT +17 %: the edit island's hydration work, with 0 reads and identical statements. For master's reading under DL-457 (3) and DL-461; my recommendation is above |

PR review [6088096555](https://github.com/sankumar76/Accucut-Quotation/pull/806#pullrequestreview-6088096555) (COMMENT, 2 inline comments, at `b6c40208`); label stays `review:quality-approved`.

**Open after round 4:** Blocker 0, Critical 0, Major 0, Minor 3 (QLT-806-04, -05, -11), Info 8 (QLT-806-07 to -10; SEC-806-01 to -03; PRF-806-01). **Verdict at `b6c40208`: APPROVE WITH COMMENTS.** The run of record is fully green with Stage 11b at 193,012 B. The proof's two misses go to master.

## Hand-off
- Status: COMPLETE
- GitHub: PR review [6082714446](https://github.com/sankumar76/Accucut-Quotation/pull/806#pullrequestreview-6082714446) (COMMENT, 5 inline comments, at `a701377e`); label `review:quality-changes-requested`
- Verdict at `a701377e`: REQUEST CHANGES (Blocker 0, Critical 0, Major 1, Minor 3, Info 5); no §9 stop. Before merge: QLT-806-03 (a unit test) and a fully green run of record.
- Recommended next agent: developer (QLT-806-03, then -06), then a short re-review of the new diff, then orchestrator: merge on a fully green run of record.
- **Round 2 (`fabe1d09`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 2, Info 6). QLT-806-03 and -06 are fixed and mutation-checked. Condition: the run of record 45929518610 fully green, with Stage 11b at or under 193,500 B.
- **Round 3 (`a5cb4f10`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 2, Info 7). Stage 11b is 192,758 B. Run 45943506004 is red only on TS-9 (desktop), a master defect. Before merge: merge in #819, a `--cc` check of `estimate-review.tsx` and the architecture test, and the run of record at 0 behind.
- **Round 4 (`b6c40208`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 3, Info 8). Run 45994834413 is fully green; Stage 11b is 193,012 B (+197 B). The (v') +26 / +28 ms and TBT +17 % misses are the edit island's hydration work, for master's reading (PRF-806-01).
