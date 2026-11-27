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

## Hand-off
- Status: COMPLETE
- GitHub: PR review [6082714446](https://github.com/sankumar76/Accucut-Quotation/pull/806#pullrequestreview-6082714446) (COMMENT, 5 inline comments, at `a701377e`); label `review:quality-changes-requested`
- Verdict at `a701377e`: REQUEST CHANGES (Blocker 0, Critical 0, Major 1, Minor 3, Info 5); no §9 stop. Before merge: QLT-806-03 (a unit test) and a fully green run of record.
- Recommended next agent: developer (QLT-806-03, then -06), then a short re-review of the new diff, then orchestrator: merge on a fully green run of record.
- **Round 2 (`fabe1d09`):** APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 2, Info 6). QLT-806-03 and -06 are fixed and mutation-checked. Condition: the run of record 45929518610 fully green, with Stage 11b at or under 193,500 B.
