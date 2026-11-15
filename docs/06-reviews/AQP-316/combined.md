# Review Report — AQP-316 (STORY-05.08 Save a draft and the unsaved-changes warning) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master (9de393a)...feat/AQP-316-save-draft` (PR #424) |
| Commit reviewed | **7f60444** (`7f6044492e099f54d7317bd4e287d8238ae60223`) |
| Date | 2026-11-15 |
| **Verdict** | **REQUEST CHANGES.** 1 Critical (SQR-01) **blocks the merge under §9 item 2**: a save queued before a 409 still runs after the re-read and silently overwrites the other tab's newer value. The 2 Majors are tracked as #425 and #426. Both are cheap, and I recommend fixing them in this PR, SQR-02 on the same lines as SQR-01 |
| PR review | posted on PR #424 as a COMMENT (single-token) |

## Summary
The design is sound, and most of the data-loss paths are closed well:
- **One save path.** Save draft and "Save draft and leave" call `gate.flush()`, which goes through the form's own `commit`, and then wait on the same `SaveGate.settle()` that Calculate uses. There is no second writer.
- **One answer to "is anything unsaved?"** `isDirty()` means a save in flight, or a field that shows a value the server does not hold. The guards for leaving, choosing a part and Sign out all read it.
- **The conflict plan is pure and well tested.** `part-conflict.ts` compares normalised values per field: mine, held, fresh.
- **The guards are well built.** The click guard (capture phase, modifiers, `download`, `target`, other origin, hash-only) is careful. So is the Back trick (`__NA` kept, re-armed after "Keep editing"). Sign out waits for the answer before it ends the session.
- **The server is untouched**, so CSRF, role and ownership checks apply on every save exactly as before. The revision matrix (`revision-rules.test.ts`) pins the no-op and bump rules for every writer, plus the concurrency cases.

The weak point is the client's 409 recovery when **more than one save is queued**. This happens when Save draft is pressed after reconnecting from offline, or when two fields are left quickly. A field that the re-read finds in conflict is guarded only when it is next committed. Its save that is **already in the queue** still runs, and it now carries the fresh revision, so it overwrites the other tab's value (SQR-01, reproduced). On the same path, any later successful save clears the conflict notice (SQR-02, reproduced). Separately, the extra history entry of the Back guard is pushed on the first edit and never removed, so nearly every edited session leaves one dead Back press (SQR-03).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 2 |
| Minor | 5 |
| Info | 4 |

## Checks Run
| Check | Method | Result |
|-------|--------|--------|
| Diff read | `git diff 9de393a...7f60444` (25 files). Read in full: all of `src/**` (15 files, ~1,200 diff lines), and the full head versions of `use-part-form.ts`, `leave-guard.ts`, `leave-guard.tsx`, `save-gate.ts`, `part-conflict.ts`. For the tests: titles and key assertions of every changed test, and `estimate-save.spec.ts` in full | Read |
| Callers and callees | `section-strip.tsx` (`jumpTo` calls `preventDefault`, so no hash entries), `use-lazy-component.ts` (`failed`), `portal-account-panel.tsx`, `session-ended.ts`, `hidden-inputs.ts` (hidden number is `0.00`), `form-client.ts` (`FormRule`, `PART_CHANGED_CODE`), every `router.push` / `location.assign` in `src/` | Read |
| Context | Jira AQP-316 (AC-1 to AC-8, Dev Context, Testing notes); PR body (Dev Record, A1 to A5, "Points for the reviewer" 1 to 8, Known limits); architecture §4.8 (save model, no-op rule), §6 (Save inputs), §10 rule 5 and ADR-016 (first-load rule), from `origin/docs/AQP-1-records-r`; coding standards | Read |
| Unit tests (local, head 7f60444) | Temporary detached worktree, `vitest run` on `leave-guard`, `save-gate-dirty`, `part-conflict`, `save-draft`, `calculate-bar-save`, `time-ist-time`, `overlay-imports`, `estimate-form-route` | **8 files, 120 tests passed** |
| Reproduction of SQR-01 and SQR-02 | A scratch unit test in the temporary worktree, never committed. It drives `usePartValues` with a minimal React hook harness and mocked `loadPartInputs`/`savePartInputs` | **Both reproduced** (details under each finding). The worktree was removed afterwards |
| CI | Run 43710037074 on 7f60444: 6 of 6 green. The log shows **no flaky retry for `estimate-save.spec.ts`**. The only flaky test (retried, then passed) was the existing `estimate-picture.spec.ts:169` keyboard test, on mobile and tablet | Green |
| PostgreSQL integration, Playwright, canary scan, build | CI only. No Docker, browser or `next build` locally (brief; §9 item 5) | Green in CI |
| Type-check, lint (local) | Not run. The worktree has no generated Prisma client of its own; I rely on CI stage 1–11b | Green in CI |
| JS budget `/estimates/[code]` | Not re-measured. Dev Record: 179,151 B to 180,365 B (+1,214; 19,635 B headroom, above the 10,000 B floor). Lazy loading checked by reading (security scope, row 5) | Within ADR-016 |

## AC conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 Save draft with blanks, "Draft saved at 10:42 IST." (`role="status"`), "Last saved" updates | `save-bar.tsx` (`useSaveDraft`, `SaveDraftNotice` live region), `save-draft.ts`, `time.ts` `formatIstTime`, `calculate-bar.tsx` | `save-draft.test.ts`, `calculate-bar-save.test.ts`, `time-ist-time.test.ts`, E2E "AC-1, AC-2" | **Met.** SQR-08 (the line goes stale after later edits) |
| AC-2 A no-op save is no change (`1.50`/`1.5`, whitespace), 200 with the node | Server unchanged (`estimate-inputs`); client sends no duplicate (`onItsWayRef`, the held comparison in `commit`) | `revision-rules.test.ts`, `estimate-form-route.test.ts`, E2E (no request on an unchanged press) | **Met** |
| AC-3 One bump per real change in any writer; changed-and-back is two | Server unchanged | `revision-rules.test.ts` (inputs, Remarks, customer, tree, picture) | **Met** |
| AC-4 Link, Back, tab close, Sign out ask "Leave without saving?" with the two buttons; nothing when clean | `save-gate.ts` (`isDirty`, `subscribe`), `leave-guard.ts`, `leave-guard.tsx`, `leave-dialog.tsx`, `leave-registry.ts`, `estimate-workspace.tsx` (`guarded`), `portal-account-panel.tsx` | `leave-guard.test.ts`, `save-gate-dirty.test.ts`, E2E link / Back / Sign out / part / tab close | **Met.** SQR-03 (dead Back press after any edit), SQR-05 (no guard if its chunk fails) |
| AC-5 A failed save (409, 422, network) keeps the typing and says what to do; for 409 the newer values are offered | `use-part-form.ts` (`explain`, `reconcile`, `resolveConflict`), `part-conflict.ts`, `part-fields.tsx` | `part-conflict.test.ts`, E2E "AC-5" (offline Save draft) and three two-tab tests | **Partly met.** The single-save path is correct. With queued saves, SQR-01 (silent overwrite) and SQR-02 (the offer disappears) |
| AC-6 Two tabs: the second gets 409, no value is lost silently | Server (revision check) + the same client code | `revision-rules.test.ts` (parallel saves), E2E two tabs | **Not met on the queued-save path** (SQR-01). Met for one save at a time |
| AC-7 Only the bump rule is owed | Server unchanged | `revision-rules.test.ts` | **Met** |
| AC-8 360/768/1366, safe choice focused, keyboard, axe 0 | `leave-dialog.tsx` (Radix AlertDialog; Cancel "Keep editing" focused; Escape guarded while saving; focus returned to where it was) | E2E axe on the dialog and the conflict notice, 44 px targets, no sideways scroll, at three widths | **Met** |

## Security scope (critical-review)
| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | CSRF and role checks still apply on every save | **Yes** | No file under `src/app/**` or `src/server/**` changed. Every write still goes through `savePartInputs` (unchanged) to `PATCH .../inputs` behind the existing `withRoute` origin, session and role checks. Save draft only re-runs `commit` |
| 2 | Nothing about costs, rates or formulas reaches an Engineer (NFR-002) | **Yes** | No new route, projection or import of `row-outputs`, `row-calculator` or `product-totals`. The conflict notice shows only the Engineer's own input values, read by the existing `GET` of the part's inputs. The new words (`save-texts.ts`) hold no figure. The ESLint allow-list and the canary scan are untouched and green in CI |
| 3 | No sensitive data in storage or logs | **Yes** | No `localStorage`, `sessionStorage`, IndexedDB or `console` in the diff. The module-level registry holds only a callback |
| 4 | Stale write never silently overwrites newer data | **No, on one path** | SQR-01. The server's revision rule holds. The client defeats it by sending a conflicting field's already-queued save with the revision it has just re-read |
| 5 | New UI that should be lazy is lazy (ADR-016) | **Yes** | `leave-guard.tsx` (with `leave-dialog.tsx`, the AlertDialog) loads through `useLazyComponent`. `save-bar.tsx` is inside the lazy `calculate-bar.tsx`. `use-part-form.ts` and `part-conflict.ts` are inside the lazy `part-fields.tsx`. The first-load file imports only the type `LeaveGuardProps`. `overlay-imports.test.ts` lists the dialog and the guard, and passes locally. +1,214 B is within the rule |

## Findings

### SQR-01 · Critical — a save already queued for a field that the 409 re-read puts in conflict still runs, with the fresh revision, and overwrites the other tab
- **Where:** `src/components/features/estimate-workspace/use-part-form.ts:217-218` (`send` reads `revisionRef.current` at run time and never checks `conflictRef`). The queue is built at `:258` and the guard is only at `:242` (in `commit`, at enqueue time). `reconcile` sets the fresh revision at `:192` and marks the conflict at `:205`.
- **Issue:** `conflictRef` blocks *new* commits of a conflicting field, but not a send that was queued before the 409 came back. Sequence: fields A and B are queued (Save draft after reconnecting sends every failed field at once, or two fields are left within one round trip). A's send gets 409. `reconcile` re-reads, finds that the other tab changed B, marks B as a conflict, and sets `revisionRef` to the new revision. Then B's queued `send` runs, carries the new revision, gets 200, and **replaces the other tab's value**. The screen still shows the conflict message for B ("newer value is 9.00") while the server holds the typed 3.00. Choosing "Use the newer values" then shows 9.00 but sends nothing, so screen and server disagree.
- **Evidence (reproduced at 7f60444):** the hook harness with held `{a:1.00, b:1.00}`, the other tab at `{b:9.00}` (revision 2), and A and B both committed. Recorded PATCH for B: `[{"revision":3,"values":{"b":"3.00"}}]`. Problem states: `conflict(b, newer 9.00) -> null -> null`.
- **Impact:** a silent overwrite of another person's or tab's newer input. This is exactly what AC-5/AC-6 and the architecture's revision rule forbid, and the figures computed later are built on the overwritten value. It happens to an Engineer who edits offline, or on a slow link, while the part is open elsewhere. That is the "reconnecting after offline" and "two tabs" paths of the brief.
- **Fix:** check the conflict when the send *runs*, not only when it is queued:
  ```ts
  async function send(fieldId: string, value: string, refreshed = 0): Promise<void> {
    // A field that a re-read found changed somewhere else waits for the person's choice, even if its save was queued before.
    if (conflictRef.current.has(fieldId)) return;
    const outcome = await savePartInputs(...);
  ```
  `syncWatchers` and the resend loop go through `send`, so they are covered too. The `.finally` at `:258` already clears `onItsWayRef`.
- **Test that catches it:** a unit test of `usePartValues` (a small hook harness, or the queue logic pulled into a pure module). Fields A and B are committed together, A's save answers 409, and the re-read shows B changed. Expect no PATCH naming `b` after the 409. Add an E2E variant: two tabs, both saves aborted, Save draft once the route is restored, and the first tab's value survives.

### SQR-02 · Major — a successful save clears the conflict notice while a field is still in conflict (#425)
- **Where:** `use-part-form.ts:233` (`setProblem(null)` in `send`), reached from the resend loop at `:207-214` right after `:206` set the conflict, and from any later queued save.
- **Issue:** when a 409 plan has a conflict and also a resend, which is the case of PR point 8 (typing in the next field when the 409 returns), the resend's success sets the problem to `null`. The field keeps `conflictRef`, its message and its unsaved mark, but "Keep what I typed" and "Use the newer values" are gone.
- **Evidence (reproduced):** A saved, C typed and not left, the other tab changed A. Problem states: `conflict(a) -> null`, and `gate.isDirty()` stays `true`.
- **Impact:** AC-5's offer disappears. Leaving the field and Save draft send nothing, Save draft keeps saying "The draft was not saved", and the leave guard always prompts. The only way out is to retype the field. No data is lost.
- **Fix:** `setProblem((current) => (current?.kind === 'conflict' && conflictRef.current.size > 0 ? current : null));`. Cheap; **fix in this PR** together with SQR-01.
- **Test:** the same harness: expect the last problem to still be `conflict` for A after C's resend.

### SQR-03 · Major — the Back guard's extra history entry outlives every edited session (#426)
- **Where:** `src/lib/estimates/leave-guard.ts:121-125` (`arm` runs on the first dirty change and is never undone), `:134-135` (a clean click is left to Next's `Link`, which pushes), `src/components/features/estimate-workspace/leave-guard.tsx:70` (`router.push` for "Leave").
- **Issue:** the entry is armed on the first keystroke, and it stays after the save makes the page clean. Leaving by any in-portal link then pushes on top of it: `[prev, estimate, estimate(extra), next]`.
- **Impact:** in nearly every session where anything was typed, Back from the next page takes one extra press. The second press moves between two entries of the same address, so nothing happens on screen. The PR lists this as a known limit, but it applies to normal navigation, not only to the unsaved case. It is not a trap: a further press goes on.
- **Fix:** while `armedFor !== null`, intercept a leaving click even when the page is clean, and navigate with `router.replace(href)`, so the extra entry is overwritten. Use `replace` in the link `proceed` too, and optionally `location.replace` for Sign out when armed. About 10 lines plus fake-history unit cases. **Cheap enough for this PR.**
- **Test:** unit: armed, then clean, then a link click calls `replace`, not `push`. E2E: after an edit and a link, one Back returns to the estimate and a second Back leaves it.

### SQR-04 · Minor — `reconcile` unmarks the field that triggered it even when the plan skipped it
- **Where:** `use-part-form.ts:195` (`clearError(fieldId)` runs unconditionally). `part-conflict.ts:58` skips a field whose text the rule cannot read.
- **Issue:** if the person went back to the field and typed something invalid before the 409 returned, the plan leaves it alone (correct), but `:195` clears its message and its unsaved mark.
- **Impact:** the leave guard and Save draft treat it as saved, so the invalid typed text can be lost with no prompt. A narrow window.
- **Fix:** `mark(fieldId, differsFromHeld(field, textsRef.current[fieldId] ?? ''))` in place of the unconditional clear, or clear only fields that are in `resend` or `adopt`, or unchanged.

### SQR-05 · Minor — if the guard's chunk fails to load, the page runs with no leave protection and says nothing
- **Where:** `src/components/features/estimate-workspace/estimate-workspace.tsx:73,105` (`guard.failed` is never read). `leave-registry.ts:31` answers yes when no guard is registered.
- **Issue:** every other lazy part of this page shows its failure notice (SQR-06 of AQP-317). The guard just stays absent. Then link, Back, tab close, Sign out and part change all lose typing silently. The window between the form's chunk and the guard's chunk arriving is the same, only smaller.
- **Fix:** when `guard.failed`, show the existing failure notice with "Try again" (`guard.retry`). Or put a ~10-line `beforeunload` fallback that reads `saves.isDirty()` in the first load (a few hundred bytes; headroom allows it).

### SQR-06 · Minor — the 409 plan ignores visibility
- **Where:** `src/lib/estimates/part-conflict.ts:55-56`.
- **Issue:** a watcher hidden by `visibleWhen` keeps its typed text while hidden (`syncWatchers`). After a 409 it is planned as "changed by me" and re-sent, or offered as a conflict under a field nobody can see. This contradicts `sendAgain`'s rule at `use-part-form.ts:312` ("A field the registry hides is left alone"). The server zeroes a hidden number (`hidden-inputs.ts`), so a resend is a harmless no-op. A conflict on a hidden field can only be resolved with the buttons, which SQR-02 can remove.
- **Fix:** pass the visibility predicate (`fieldVisibility(fields, typed)`) into `planAfterNewerPart` and skip hidden fields. Add one case to `part-conflict.test.ts`.

### SQR-07 · Minor — fixed sleeps prove "nothing was sent"
- **Where:** `tests/e2e/estimate-save.spec.ts:88`, `:303` (`waitForTimeout(400)`).
- **Issue:** test strategy §1 principle 4 ("Tests are deterministic. No sleeps"; also coding standards §6, "Tests are deterministic"). A fixed wait for a negative check can pass falsely when a stray request is slower than 400 ms. It does not cause false failures, so it is not flaky, but it is weak.
- **Fix:** the preceding assertions already wait for the draft line or alert, which is set after `settle()`. A send queued by the press would already have been counted, so the sleeps can be removed. Or assert on `countSaves` after a positive sync point. This overlaps with reviewer-standards; I list it once here.

### SQR-08 · Minor — "Draft saved at HH:MM IST." stays on screen after later edits
- **Where:** `src/components/features/estimate-workspace/save-bar.tsx:28,39`.
- **Issue:** the outcome is kept until the next press. When the person types again, the bar still says the draft was saved while a field is unsaved.
- **Impact:** a small UX risk. The leave guard still protects the typing.
- **Fix:** subscribe to `gate` in `useSaveDraft` and reset the outcome to `none` when `isDirty()` turns true.

### SQR-09 · Info — the E2E fold: no hidden flakiness found
The fold puts several steps in each test with `test.setTimeout(60_000)`. This widens the 30 s default, which `playwright.config.ts:69` says never to do ("never widen a timeout"). The same 60 s precedent exists in `estimate-picture.spec.ts:27`. With `retries: 1`, a flaky test could hide, but the run 43710037074 log shows **no retry for `estimate-save.spec.ts`** at any width. The only flaky test was the existing `estimate-picture.spec.ts:169` keyboard test. A cost of folding: the first failing step hides the later ones. No change asked. The solution-architect may want to record the 60 s exception in test strategy §10.

### SQR-10 · Info — Sign out lets full loads through for 5 s
`leave-guard.ts:177-181`: after the person chooses to sign out, `beforeunload` is off for `FULL_LOAD_GRACE_MS`. If the sign-out request fails, a tab close inside those 5 s is not prompted. This is acceptable: the person has just chosen to leave. Noted so it is a decision.

### SQR-11 · Info — good: one save path, one dirty answer, pure conflict plan
`save-draft.ts` and `gate.flush()` reuse `commit`, with no second writer (A5). `isDirty` comes from the same facts Calculate waits on. `planAfterNewerPart` is pure and fully unit-tested, including normalised equality (`1.5`/`1.50`) and defaults (`None`). The leave dialog is a Radix AlertDialog with a role, a label (its title), a description, focus on "Keep editing", Escape held while saving, and focus returned to where the person was (`onCloseAutoFocus`). `leavingLinkOf` handles modifier keys, `download`, `target`, other origins and hash-only links.

### SQR-12 · Info — test gap behind SQR-01 and SQR-02
The queue and reconcile logic of `usePartValues` is covered only by E2E (three two-tab tests, each with one save in flight). No unit test drives it, because the unit environment is `node` with no DOM library. A small hook harness, like the one used to reproduce SQR-01 and SQR-02, or pulling the queue and reconcile step into a pure module would let these paths be tested quickly.

## Issues for other roles
- **developer:** fix SQR-01 (blocking) and SQR-02 (same lines); SQR-03 recommended in this PR; Minors at your discretion or in the hardening window.
- **solution-architect:** consider recording the 60 s E2E limit exception for the long folded specs in test strategy §10 (SQR-09).
- **orchestrator:** do not merge until SQR-01 is fixed and re-reviewed; on merge, decide whether #425 and #426 close with this PR or stay for the hardening window.

## Hand-off
- Status: COMPLETE
- Verdict: **REQUEST CHANGES.** 1 Critical (SQR-01) blocks the merge under CLAUDE.md §9 item 2
- Counts: Blocker 0 · Critical 1 · Major 2 · Minor 5 · Info 4
- Artefacts written/updated: `docs/06-reviews/AQP-316/combined.md` (written in the main checkout on `docs/AQP-1-records-r`; not committed)
- Jira / GitHub updates: PR #424 review (COMMENT, inline SQR-01 to SQR-08), label `review:quality-changes-requested`; issues #425 (SQR-02) and #426 (SQR-03), `tech-debt`, `ai-delivery`; Jira AQP-316 hand-off comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer — fix SQR-01 and SQR-02 in `use-part-form.ts` (two small guards plus a hook-level test), ideally SQR-03; then reviewer-quality re-reviews the new diff only
