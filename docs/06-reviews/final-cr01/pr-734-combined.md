# Review Report — PR #734 (AQP-367, STORY-05.10 AC-7 and AC-7a to AC-7f; QLT-F-05 / #687: autosave on hide and on leaving) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: anything that can lose or corrupt data, here autosave) |
| Review round | 1, 2 (`de145e58`) and 3 (`fe6ef49f`); see "Previous Findings" |
| Base…branch | `master...fix/AQP-367-autosave-on-hide` (PR [#734](https://github.com/sankumar76/Accucut-Quotation/pull/734)), 0 behind `master` 6bf10f7d |
| Commit reviewed | `9ceb8134` (round 1); `de145e58` (round 2, run 45663723703); **`fe6ef49f` (round 3, 0 behind `master` 6bf10f7d, run 45668308795 green)** |
| Date | 2026-11-25 |
| Reviewed against | Jira AQP-367 (AC-7 amended, AC-7a to AC-7f, A-3; PO validation of the amendment 2026-11-25); DL-403 and DL-404 (records-u 859ebf26), DL-370 (5), DL-375, DL-386, DL-388 (D), DL-397 (2)(d); `docs/standards/coding-standards.md`; precedent `pr-715-combined.md` |
| **Verdict (final, round 3, `fe6ef49f`)** | **APPROVE WITH COMMENTS.** No Blocker, Critical, Major or Minor remains open. QLT-734-09 is closed: the one-line removal of `test.setTimeout(60_000)` was confirmed, and the new case reads 13.8, 20.0 and 20.4 s at the default 30 s. 3 Info remain (SEC-734-01, SEC-734-02, QLT-734-08), and QLT-734-01 is deferred to #735 after G8 |
| Verdict (round 2, `de145e58`) | **REQUEST CHANGES (one line in a test).** The product code is approved with comments. QLT-734-02, -04, -05 and -07 are fixed, and -03 and -06 are closed by the PO's rulings A-5 and A-4. **QLT-734-09 is only partly fixed:** the original case is back to `master`, but the new case `estimate-autosave-leave.spec.ts:17` sets `test.setTimeout(60_000)`. The project default is 30 s, and DL-404 (1)(b) asks for "the default 30 s budget". The fix is to delete that line; the case reads 18.5 to 22.8 s. (Round 1 at `9ceb8134`: REQUEST CHANGES, tests only.) |

## Summary

The change adds **when** to save, not a new way to save. One listener set in `useAutosave` (document `visibilitychange`, window `pagehide`) asks the gate for `flush('leave')`. Each part form then sends its unsaved text through the same `autosaveField` → `queueSave` → `send` path as the 30-second tick. That is the same `PATCH …/nodes/{nodeId}/inputs`, session cookie, origin check, server validation and part-revision check. The one difference is `keepalive: true` on the request, and only while the body is at most 60,000 bytes. No route, schema or dependency is added.

The data-safety argument holds. The server's revision check is strict (`estimate-inputs.ts:211`, `part.revision !== request.revision` → 409 `PART_CHANGED`). The form already sends one save at a time and carries the revision forward, and the leave save joins that queue. So a leave save can never overwrite a newer version: at worst it is refused, and a refused save on a page that is gone changes nothing. Duplicates are prevented by the existing `onItsWayRef` / `settledValue` rules. A conflict that is waiting pauses `leave` as it pauses `auto`.

I accept the stated deviation from AC-7b ("a save already in flight is not waited for"), and I explain why under point (1). As DL-404 (5)(b) asks, I grade the several-fields gap **Minor** (QLT-734-01). One batched keepalive save **does fit** the existing save API, so under DL-404 (5) it is a follow-up for after G8, not a change in this PR. The one Major is in the tests: the case's timeout was raised from 60 s to 90 s (QLT-734-09). DL-370 (5) forbids that, and DL-404 (1) has already ordered the split. The two stated limits are real but narrow. Neither is a regression: before this PR nothing at all was sent on leaving, and every case still left open is still guarded by the warning on leaving (FR-053).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (tests only: QLT-734-09) |
| Minor | 5 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 734`; files read in full at `9ceb8134` (`git show origin/fix/AQP-367-autosave-on-hide:…`): `use-autosave.ts`, `use-part-form.ts`, `form-client.ts`, `save-gate.ts`, `api-client.ts` (`sendJson`), the save route, `with-route.ts` / `origin-check.ts`, `estimate-inputs.ts` (revision check), `schemas/form.ts`, `autosave.tsx`, `estimate-workspace.tsx` | 9 files, matching the PR list. No server, route, schema or migration change |
| Unit tests at head | `npx vitest run` over `estimate-autosave.test.ts`, `estimate-autosave-part.test.ts`, `form-client.test.ts` and the two other importers of `part-server.ts` (`use-part-values.test.ts`, `fasteners-none-requests.test.ts`), in the developer's worktree `aqp-398` at `9ceb8134`, read-only | **5 files, 140 tests passed** (1.4 s) |
| CI run of record | `gh run view 45657457945` | **success** at `9ceb8134`: Stages 1 to 11, 1 to 11b, E2E shards 1 to 4. Merge state CLEAN, 0 behind `master` 6bf10f7d |
| E2E autosave case at three widths | shard logs | `estimate-autosave.spec.ts:78` passed on attempt 1: [mobile] 40.6 s (shard 1), [tablet] 42.2 s (shard 2), [desktop] 1.0 min (shard 3) |
| DEF-085 signature (DL-403 (g)) | shard 4 log | **3 flaky, all [desktop], shard 4**: `estimate-form-sections.spec.ts:64`, `estimate-form-choice.spec.ts:88` and `:126`. Each is `waitForForm` (`part-form.ts:97`), `form[data-part-form]` not visible in 15 s, at about 20 s. Each passed on retry. This is the DEF-085 signature, not a test of this change, and none failed on both attempts: nothing goes to master under (g) |
| First load (DL-403 (e)) | Stage 11b log | `PASS /estimates/[code] gzip 191,570`, so **+54 B** on 191,516, and **38 B under** the 191,608 B ceiling. Confirmed in the log. Attribution of the 54 B is the performance reviewer's and PM's call (cross-reference) |
| DL-386 / DL-388 (D) / DL-370 (5) statement | PR body | Present: no case added, removed or renamed; the autosave case moves from :47 to :78 with the same shard positions; no case after `users.spec.ts`; net person-making calls 0 |
| Test-first, DL-403 (c) | PR test files | Unit tests cover: hidden with a pending change, hidden with none, `pagehide`, a change already in flight, a repeat event, `pageshow`, Calculate in flight, read-only, unmount and remount, a failure, and a 409. The E2E dispatches `visibilitychange` → hidden and `pagehide` with the clock not moved, and checks the stored value after a reload, with no time wait on the positive checks (see QLT-734-05 for the negative checks) |
| Importers of `tests/support/part-server.ts` | `git grep part-server origin/fix/AQP-367-autosave-on-hide` | 3 unit files only (`estimate-autosave-part`, `use-part-values`, `fasteners-none-requests`). **No E2E importer**, so DL-375 is not engaged (QLT-734-08) |
| Secrets, cost data | diff read | none. The request body is one field value and a revision. The response is the part's inputs (no cost). No log line |
| Lint, type-check, integration, E2E locally | not run locally | CI is the record (§9 item 5: heavy tests in CI) |

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Why (impact) | Fix |
|----|----------|-----------|-----------|-------|--------------|-----|
| QLT-734-01 | Minor | `src/components/features/estimate-workspace/use-part-form.ts:452-456` (with `queueSave` `:354-368`) | AC-7b ("the pending changes are sent … by a request that completes although the page is going away") | **On a real unload only the first of several unsaved fields is certain.** `sendAgain('leave')` queues one request per field, each waiting for the one before (each needs the revision the one before made). After `pagehide` no JavaScript runs, so the second `then` is never reached. The server already accepts several values in one save (`saveInputsBodySchema`, up to `MAX_VALUES_PER_SAVE` = 64). | The reach is narrow. Fields are committed on blur and choices on change, so un-queued unsaved text is normally only the focused field. Several at once needs an earlier save that failed (the AC-5 status is already showing), and that failure usually means the leave save fails too. The warning on leaving fires **before** `pagehide` and still guards the rest. It is not a regression: nothing was sent on leaving before. | **Graded Minor (DL-404 (5)(b)). A batched save fits the API:** `PATCH …/inputs` takes `{ revision, values }`, where `values` is a record of up to 64 field ids (`MAX_VALUES_PER_SAVE`, `schemas/form.ts:19`). There is one part revision per request, and the service checks it once for the whole set. So all of a part's unsaved fields can go in one request, and no server change is needed. **So under DL-404 (5) this is an after-G8 follow-up (GitHub `follow-up` issue), not a change in this PR.** Design for the follow-up: in `leave` mode, gather every field that `autosaveField` would send into one `{ revision, values: {…} }` save, so one keepalive request carries them all. Keep the per-field `onItsWayRef` and ticket bookkeeping, and split the request if its body is over `KEEPALIVE_BODY_LIMIT_BYTES` (values can be up to 2,000 characters each). **Test:** part-hook test with `a` and `b` dirty, `flush('leave')`; expect `partServer.sent` to have length 1 with both values and `keepalive` `[true]`. Raise a `follow-up` GitHub issue if master agrees |
| QLT-734-02 | Minor | `use-part-form.ts:104`, `:450`, `:457-462`; read at `:311` | Correctness (shared mutable state) | **`leavingRef` is one shared boolean, reset by the first leave's queue.** Leave 1 sets it and attaches `done` to queue Q1. If leave 2 queues more saves before Q1 settles, Q1's `done` sets it to `false` while leave 2's saves still wait, so they go **without** keepalive. `send` reads the flag when it runs, not when the save was queued. | Almost no effect today. The case needs a hide, then a return to the tab, typing, and a close within one round trip. On a real unload the queued `then` never runs anyway. But the next person to touch this would expect the flag to belong to the save. | Count instead of a flag: `leavingRef.current += 1` and `done = () => { leavingRef.current -= 1; }`, with `send` passing `leavingRef.current > 0`. Or carry `keepalive` on each queued save (`queueSave(field, value, automatic, leaving)`). **Test:** hold the first leave save, fire a second `flush('leave')` with a new text, release, and expect `partServer.keepalive` to be `[true, true]` |
| QLT-734-03 | Minor | `src/components/features/estimate-workspace/use-autosave.ts:66-71` | AC-7a (hide: no race with Calculate) vs AC-7b (leave: not waited for) | **A `pagehide` while Calculate is in flight sends nothing.** `sendAtOnce` records `hiddenWhileBlocked` and returns, and on an unload nothing comes back for it. The form stays editable during Calculate (`estimate-workspace.tsx:188` passes `editable` whatever `calculation.busy` is), so text typed during a Calculate (about a second) and then a close straight away is not sent. | Very narrow, and the warning on leaving guards it. AC-7a's "no second save beside a Calculate" is written for the hide. AC-7b, for the leave, says nothing about Calculate. | **No change before merge.** PO and master to say whether a leave during Calculate should send. If yes, send on `pagehide` (`event.persisted === false`) even when blocked, after checking that the server's Calculate treats a concurrent `inputs_revision` bump as it does today (figures cleared, FR-100). **Test:** hook test with `isBlocked: () => true`, `leave()`, and expect `modes` to be `['leave']` |
| QLT-734-04 | Minor | `use-autosave.ts:51`, `:75` | Design consistency, testability | **The new code reads `documentIsHidden()` directly, not the injected `isHidden` option** that the tick uses (`hidden.current()`, `:58`). So "is the tab hidden" now has two sources: a caller or test that injects `isHidden` steers the tick but not the hide path, and the tests have to stub the global `document`. | No production effect, because the only caller uses the default. It is a trap for the next test or caller. | Use `hidden.current()` at `:51` and `:75`. **Test:** the existing hook tests pass unchanged, because the default is `documentIsHidden` |
| QLT-734-05 | Minor | `tests/e2e/estimate-autosave.spec.ts:152`, `:165` (helper `:75`) | DL-403 (c) "without any time-based wait"; coding standards (deterministic tests) | **The two new negative checks (hide then pagehide sends once; a hide with nothing unsaved sends nothing) rest on `settleSilently`, `page.waitForTimeout(300)`.** The positive checks wait for the real save response and a reload, so DL-403 (c)'s stated subject ("the stored values changed … without any time-based wait") is met. A "nothing more was sent" check needs some bound, and the helper was already in the case. | A slow runner could let a late duplicate through after 300 ms (a false pass, not a flake). The unit tests pin the same rules deterministically. | **Master to read (c) for the negative checks.** Either accept it, since the unit level is the proof, or make it deterministic: after the step, run a known request through the same `fetch` recorder (for example the form's GET) and assert the recorded saves in order. **When:** with any other change to this PR, otherwise the hardening window |
| QLT-734-06 | Info | `use-part-form.ts:354-368`, `:447-463`; PR body "Known limits" | AC-7b, AC-7c, AC-7e | **Deviation from AC-7b accepted (point 1).** "Not waited for" cannot be met literally and safely. A request sent beside the save in flight carries the same revision. Whichever arrives second is refused 409 (`estimate-inputs.ts:211`), and on a page that is gone nothing can reconcile it. So bypassing would add no saved data, only a refusal. Queueing gives the leave save the revision the earlier save made, which is the only way it can succeed. The AC's own guard ("the version check still decides, nothing is overwritten silently") holds either way. | The only cost is the close-within-one-round-trip case (text typed after a blur whose save is still on its way). The leave save is then queued and not sent, and the warning on leaving guards it. The save in flight is a normal request: its client side is cancelled on unload, but by then the server has the small body and finishes it. | **Issue for the PO:** change AC-7b's sentence to "a save already in flight is not bypassed: the leave save is queued behind it, so it carries the right revision; the version check decides and nothing is overwritten silently". |
| QLT-734-07 | Info | `tests/e2e/estimate-autosave.spec.ts:78`, `:140-176` | Traceability (§6 rule 3) | The case title still says "AC-1 to AC-5, AC-9", but it now also proves AC-7a to AC-7c (named only in the file comment). The E2E's "hide then pagehide is one request" step covers only the case where the hide save has already been answered. The case where it is still on its way is unit-only (`estimate-autosave-part.test.ts`, `holdNextSave`). A real tab close is not exercised (stated: it raises the browser's prompt). | Reports and greps by AC ID miss the E2E proof of AC-7. The rest is a stated, acceptable split | Optional: add "AC-7a to AC-7c" to the title. Renaming changes no shard position (positions follow file and line). Otherwise none |
| QLT-734-09 | **Major** | `tests/e2e/estimate-autosave.spec.ts:24` (`test.setTimeout(60_000)` → `90_000`) | DL-370 (5) binding (no raised test budget); DL-403 (f); DL-404 (1) | **The case's budget is raised by 50 % to fit the new steps.** The case now reads 1.0 min [desktop] under a 90 s budget. | A raised timeout hides the next slow path and is the change DL-370 (5) forbids. Master refused it in DL-404 (1). | **Already ordered by DL-404 (1); the developer is on it.** Put the original case back exactly as on `master` (60 s). Move the hide and leave checks into separate cases at the default budget, each under 25 s on attempt 1 in CI, with no time wait, and with the DL-386 / DL-388 (D) statement for the new cases. **Re-check on the new head:** this finding, QLT-734-05 and QLT-734-07 |
| QLT-734-08 | Info | `tests/support/part-server.ts:20-21`, `:40`, `:91-93`, `:101-103` | DL-375 (shared `tests/support/**` used by E2E) | **Point (6): no effect on other specs.** The change is additive: a `keepalive` array, reset in `reset()`, and two optional parameters on `save` with defaults. Its only importers are 3 **unit** files, and all of them pass at head. No E2E spec imports it, so DL-375's binding is **not** engaged. Master accepted it in DL-404 (4) | none | none |
| SEC-734-01 | Info | `src/lib/estimates/form-client.ts:203-213`; `src/lib/api-client.ts:72-74`; `src/server/http/origin-check.ts:15-17`; route `…/inputs/route.ts` | NFR-003 (CSRF), authorisation, NFR-002 | **Point (3): mechanism and auth are sound.** `fetch(…, { keepalive: true })` is the same request: same method (`PATCH`), `Content-Type: application/json`, body and `credentials: 'same-origin'` (from `sendJson`). A same-origin PATCH carries `Origin` and `Sec-Fetch-Site: same-origin`, so `isSameOriginRequest` passes. It goes through `withRoute`: session, then 404 for an estimate that is not the Engineer's, `assertEditable`, the strict body schema and the revision. It is the right choice over `sendBeacon` (POST only, no JSON `Content-Type` without a new route). **Size bound:** counted in UTF-8 bytes, keepalive only up to 60,000 B, otherwise an ordinary request (no throw). The saves run one at a time, so the shared 64 KiB in-flight quota is never pooled. Note: the PR body says a value is limited to 200 characters. The server's cap is `MAX_TYPED_VALUE_LENGTH` = 2,000 characters (`schemas/form.ts:26`), so at most about 8 KB per one-field body. The conclusion holds. Browsers without keepalive (Firefox before 133) ignore it, and the save is then an ordinary request: same outcome as before this PR | No new attack surface, no cost value in request or response | none. PR body wording: "200" could read "at most 2,000 characters (server cap)" |
| SEC-734-02 | Info | `src/lib/api-client.ts:80-81` | STORY-01.06 AC-4 | A hide save answered `401 SESSION_ENDED` now runs `handleSessionEnded` while the tab is hidden (navigation to SCR-01 with a return link). Before, nothing was sent while hidden, so this happened only once the person was back. | Same result as before. A session that has ended cannot store the text either way, and the person comes back to the sign-in page with the return link | none |

## Security notes (the §9 item 2 focus in the brief)

- **No silent overwrite (point 5).** Every leave save carries `revisionRef.current` at send time. A newer version elsewhere gives 409 `PART_CHANGED`. On a live page `reconcile` re-reads the part, applies `planAfterNewerPart`, and shows a conflict rather than overwriting. On a page that is gone, nothing more happens and the server keeps the newer version. Next open reads the server's state (`loadPartInputs` on mount). While a conflict waits, `sendAgain` returns early for `leave` as for `auto` (`:448`), so a hide cannot send any field, not even another one (unit "AC-7e … even for another field").
- **Duplicates and lifecycle (point 4).**
  - **Hide then pagehide:** if the hide save is still on its way, `autosaveField` compares against `settledValue` (the value on its way) and `queueSave` against `onItsWayRef`, so it is not queued again. If the hide save has been answered, the gate is clean and `sendAtOnce` returns.
  - **bfcache restore:** there is no `pageshow` listener, so a restore sends nothing. A frozen keepalive answer, or a failure, settles on resume through the normal `explain` / `trail` path (AC-7d), and the next tick resends.
  - **Unmount:** the listeners are removed in the effect cleanup with `[gate, enabled]` deps. `enabled` turning false (SUBMITTED, APPROVED, ignored) removes them (unit tests for unmount, remount and read-only).
- **Nothing new to protect.** No route, no log line, no cost field (NFR-002 untouched). The body is one field id (UUID) and its text.

## Reviewer-specific tables

### AC conformance (AC → code → test)

| AC | Code | Test(s) | Result |
|----|------|---------|--------|
| AC-7 (tick does nothing while hidden; timer cleared) | `use-autosave.ts:55-62` (unchanged) | `estimate-autosave.test.ts` "AC-7: the tick itself still does nothing while the tab is hidden" and the existing AC-7 block | Met |
| AC-7a (hide: at once, same save, no focus move, Last saved follows; no race with a save or Calculate, sent once when it ends) | `use-autosave.ts:46-53`, `:64-85`; `use-part-form.ts:447-463` | hook: "asks … at once", "becoming visible asks for nothing", "a Calculate in flight is not raced", "a save in flight is not skipped"; part: "AC-7a, AC-7b", "AC-7a, AC-4", "a save in flight is not raced"; E2E `:140-156` (focus kept, no alert, value after reload) | Met |
| AC-7b (leave: request survives unload; same checks; in flight not waited for) | `form-client.ts:209-213`; `use-part-form.ts:311`; `use-autosave.ts:79` | `form-client.test.ts` keepalive block (4); hook "AC-7b: … pagehide"; E2E `:168-176` (keepalive recorded, value after reload) | **Met in substance.** Deviation on "not waited for" accepted (QLT-734-06). Several fields: first certain on unload (QLT-734-01, Minor). A real close is not exercised (QLT-734-07) |
| AC-7c (no duplicate: hide then pagehide, nothing changed, equal after normalisation, bfcache) | `queueSave` `:357`; `autosaveField` `:379`; no `pageshow` listener | part: "a hide followed by a leave sends the same text once" (held in flight), "equal … after normalisation"; hook: "pageshow asks for nothing"; E2E `:150-153` | Met (E2E negative check uses a 300 ms wait, QLT-734-05) |
| AC-7d (failed hide save kept; one status; resent by next tick) | `explain` `:207-213` (`trail.fail`); tick | part "AC-7d: a failed save on hide …"; hook "AC-7d: … the next tick once the tab is visible asks again" | Met (next tick, as AC-7d allows) |
| AC-7e (conflict: never overwrite; paused; refused hide keeps typing and shows the conflict) | `sendAgain` `:448`; `send` `:312-314`; `reconcile` | part "AC-7e: a hide save refused … (409)", "while a conflict waits … a hide sends nothing, even for another field" | Met |
| AC-7f (nothing sent: not editable, nothing unsaved, rule refuses; one listener set, removed; no second send after remount) | `use-autosave.ts:65`, `:67`; `autosaveField` `:376-378` | hook: "nothing is listened to when the person may not edit", "one set of listeners … none left after it unmounts", "no second send after a remount", "asks nothing when nothing is unsaved"; part: "a text the rule refuses", "may not edit", "nothing unsaved"; E2E `:158-166` | Met |
| AC-8, AC-9 (unchanged) | — | existing unit tests; E2E at 360, 768 and 1366 px green on attempt 1 | Met (no regression) |

### The three points the brief asked me to judge

1. **Queueing the leave save behind a save in flight: safe, and meets AC-7b, AC-7c and AC-7e in substance.** The server's check is a strict equality on the part's revision. A parallel request would carry a revision that one of the two requests is bound to break. On a page that is gone, the refused one cannot be reconciled. So "not waiting" saves nothing more and only adds a refusal. Queueing is the only order in which the second save can succeed. Nothing is ever overwritten, because the version check decides every request. The residual case (a close within one round trip of a blur) is guarded by the warning on leaving. The AC wording should follow the code (QLT-734-06, issue for the PO).
2. **Several dirty fields: graded Minor. A batched keepalive save fits the API, so it is an after-G8 follow-up (DL-404 (5)).** Un-queued unsaved text is normally only the focused field. Several at once needs an earlier failure, which usually means this save fails too. The beforeunload warning (FR-053) fires before `pagehide` and still guards the rest. The PR does strictly better than before. Batching the leave save into one multi-value request is the right follow-up (QLT-734-01). The server already accepts it (`values` up to 64 fields, one revision per request), so no API change is needed.
3. **`tests/support/part-server.ts`: no effect on other specs, and DL-375 is not engaged.** The change is additive with defaults, and it is imported only by 3 unit files, all green at head. No E2E spec imports it. Master accepted it in DL-404 (4) (QLT-734-08).

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-734-01 | `use-part-form.ts:452-456` | part hook: two dirty fields, `flush('leave')` gives **one** request with both values |
| QLT-734-02 | `use-part-form.ts:104`, `:457-462` | part hook: overlapping leaves, both saves `keepalive: true` |
| QLT-734-03 | `use-autosave.ts:66-71` | hook: `pagehide` with `isBlocked` true gives `['leave']` (if the PO wants it) |
| QLT-734-04 | `use-autosave.ts:51`, `:75` | hook: inject `isHidden: () => true` with a visible fake document; a `visibilitychange` sends |
| QLT-734-05 | `estimate-autosave.spec.ts:152`, `:165` | ordered `fetch` recorder with a known follow-up request in place of the 300 ms wait |
| QLT-734-09 | `estimate-autosave.spec.ts:24` | `git diff origin/master -- tests/e2e/estimate-autosave.spec.ts` shows no budget change; the new cases read under 25 s on attempt 1 |

## Issues for other roles

- **product-owner:** reword AC-7b's "a save already in flight is not waited for" (QLT-734-06). Decide whether a leave during Calculate should send (QLT-734-03).
- **master:** read DL-403 (c) for the two negative E2E checks (QLT-734-05). There is nothing under DL-375 (QLT-734-08) and nothing under DL-403 (g): DEF-085 appeared 3 times as flaky, retry passed, no both-attempts failure.
- **developer (optional, cheap, this PR or hardening):** QLT-734-02 (counter) and QLT-734-04 (`hidden.current()`). Neither moves first-load bytes in any material way. Headroom is 38 B, so check Stage 11b if either is done.
- **reviewer-performance / product-manager:** the +54 B on `/estimates/[code]` (191,570, 38 B under the ceiling) is not yet attributed to a file (PR body). This is noted here, not judged.
- **orchestrator:** the after-G8 `follow-up` GitHub issue for QLT-734-01 (one batched leave save) is opened by this review (DL-404 (5)): [#735](https://github.com/sankumar76/Accucut-Quotation/issues/735).
- **developer:** QLT-734-09 (DL-404 (1), in progress). I re-check the test changes on the new head.

## Previous Findings (re-review only)

### Round 2: head `de145e58` (2026-11-25)

**Scope:** `git diff 9ceb8134 de145e58` only. That is 6 files: `use-autosave.ts` (+2/−2), `use-part-form.ts` (+6/−5), the new `tests/e2e/estimate-autosave-leave.spec.ts` (+81), `tests/e2e/estimate-autosave.spec.ts` (back to `master`), and two unit files (+30). The developer's answers are in PR comment 7169918158.

**Checks:**
- **Unit tests at the head:** `npx vitest run` over the same 5 files (`aqp-398`, read-only) passed: **5 files, 142 tests**.
- **Run 45663723703:** `success` at `de145e58`, 0 behind 6bf10f7d. The PR body reports 0 flaky.
- **Original spec:** `git diff origin/master origin/fix/AQP-367-autosave-on-hide -- tests/e2e/estimate-autosave.spec.ts` is **empty**.
- **Default test budget:** `playwright.config.ts` sets no top-level `timeout`, so a test gets Playwright's default **30 s** (the config comments say "a test's 30 s"; "never widen a timeout").
- **Jira AQP-367:** A-4 and A-5 are present, and AC-7b, AC-7c, AC-7d and AC-7f were revised by the PO.

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| QLT-734-01 | Minor | **Deferred after G8 (DL-404 (5))**, #735 | No change expected in this PR. AC-7b (2) and A-4 now state the limit |
| QLT-734-02 | Minor | **Fixed** | `leavingRef` is now a count (`use-part-form.ts:105`, `+= 1` / `-= 1`, `> 0` at send). Each increment has exactly one `done`, so it cannot go negative. New unit test "overlapping leaves …" expects `keepalive` `[true, true]` |
| QLT-734-03 | Minor | **Closed by PO ruling A-5** | AC-7b (3) and AC-7f state the limit: a leave during Calculate sends nothing, and the warning on leaving is the guard. Revisit after G8 |
| QLT-734-04 | Minor | **Fixed** | `use-autosave.ts:51` and `:75` use `hidden.current()`. New unit test "'is the tab hidden' has one source" |
| QLT-734-05 | Minor | **Fixed** | No timed wait is left in the new spec. The duplicate check (`:63-66`) waits on a real answered request (`GET /api/v1/options/materials`, 200) after `pagehide`, then reads the recorder. This is sound: a save queued by `pagehide` calls `fetch` (recorded at call time) in the microtasks of that `evaluate`, before the barrier request starts. "Nothing unsaved sends nothing" is now unit-only (hook and part tests), which I accept |
| QLT-734-06 | Info | **Closed by PO ruling A-4** | AC-7b now reads "not bypassed: later text for that part is queued behind it" |
| QLT-734-07 | Info | **Fixed** | The new case's title names "AC-7a to AC-7c". The original title is unchanged, as on `master` |
| QLT-734-09 | **Major** | **Partly fixed, still open** | (a) Original case exactly as on `master`, 60 s: **done.** (b) The new case `estimate-autosave-leave.spec.ts:17` sets **`test.setTimeout(60_000)`**. DL-404 (1)(b) asks for "new, separate cases at the **default 30 s budget**, each reading attempt 1 under 25 s". The PR body calls 60 s "the default", but it is not: the config default is 30 s, and 60 s is a per-file opt-in copied from `estimate-autosave.spec.ts` and `estimate-save.spec.ts`. Attempt-1 readings of 19.0, 18.5 and 22.8 s are under 25 s, so the case fits 30 s with margin. **Fix:** delete line 17 (keep `useFreshAddress`). **Test:** the next CI run reads each width under 25 s at 30 s. If master reads "default" as the 60 s that these form specs use, master can close this instead. DL-370 (5)'s words point the other way |
| SEC-734-01, SEC-734-02, QLT-734-08 | Info | Unchanged | No source change touches them. `part-server.ts` is unchanged since round 1 (accepted, DL-404 (4)) |

**New in round 2:**
- The new case adds one person-making call per project (`openForm`). The PR body's DL-386 / DL-388 (D) statement from `--list --shard` is present: +0 before `users.spec.ts:58` in its own shard, no case after `users.spec.ts` of its own project, and shard-balance guard passing. I did not re-run `--list` (master's check).
- No other findings. The barrier GET is an Engineer-readable options route, not a cost route (NFR-002).

**Round 2 counts (open):** Blocker 0, Critical 0, **Major 1** (QLT-734-09, one line), Minor 0, Info 3 (SEC-734-01, SEC-734-02, QLT-734-08). Deferred: QLT-734-01 (#735).

### Round 3: head `fe6ef49f` (2026-11-25)

**Scope:** `git diff de145e58 fe6ef49f` only. It is one file, `tests/e2e/estimate-autosave-leave.spec.ts`: `test.setTimeout(60_000)` is removed from `beforeEach` (`useFreshAddress` stays), and the file comment is reworded to say the case keeps the project default. Nothing else changed.

**Checks:** `gh run view 45668308795`: **success** at `fe6ef49f`, 0 behind 6bf10f7d. All six jobs are green.

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| QLT-734-09 | Major | **Fixed (closed)** | The one-line diff is confirmed. The new case `estimate-autosave-leave.spec.ts:49` passed on attempt 1 at the project default of 30 s: **[mobile] 13.8 s** (shard 1), **[tablet] 20.0 s** (shard 2), **[desktop] 20.4 s** (shard 3). All are under DL-404 (1)(b)'s 25 s line. `estimate-autosave.spec.ts` is still identical to `master` |

**Flaky in the run:** one, `users.spec.ts:58` [desktop], shard 4. Attempt 1 failed at 32.3 s and the retry passed at 30.0 s (DEF-053's case, not touched by this PR). It is not in the new case's shard (shard 3 for [desktop]), and it is not the DEF-085 signature. Recording it against DEF-053 is for QA or master.

**Final counts (open):** Blocker 0, Critical 0, Major 0, Minor 0, Info 3 (SEC-734-01, SEC-734-02, QLT-734-08).
- Deferred: QLT-734-01 (#735, after G8).
- Closed by PO ruling: QLT-734-03 (A-5) and QLT-734-06 (A-4).

## Hand-off

- Status: COMPLETE
- **Verdict (final, round 3, `fe6ef49f`): APPROVE WITH COMMENTS.** Open: Blocker 0, Critical 0, Major 0, Minor 0, Info 3. QLT-734-09 is closed (run 45668308795: 13.8, 20.0 and 20.4 s at 30 s)
- Verdict (round 2, `de145e58`): **REQUEST CHANGES (one line).** Open: Blocker 0, Critical 0, Major 1 (QLT-734-09: `estimate-autosave-leave.spec.ts:17` `test.setTimeout(60_000)` against DL-404 (1)(b)'s default 30 s), Minor 0, Info 3. QLT-734-02, -04, -05 and -07 are fixed; -03 and -06 are closed by PO rulings A-5 and A-4; -01 is deferred to #735
- Verdict (round 1, `9ceb8134`): REQUEST CHANGES (tests only). Blocker 0, Critical 0, Major 1, Minor 5, Info 5
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-734-combined.md` (records-u)
- Jira / GitHub updates: PR #734 reviews for rounds 1, 2 and 3 (COMMENT, single-token) with inline comments; label now `review:quality-approved` (was `review:quality-changes-requested`); follow-up issue #735 for QLT-734-01; hand-off comments on Jira AQP-367
- Open questions: none
- Risks raised: none new (QLT-734-01 residual guarded by FR-053)
- Recommended next agent: master. DL-403 (d) is met (0 Blocker, 0 Critical, 0 Major open). Master decides the merge under DL-361 / DL-404 (7) on run 45668308795 at 0 behind, by the end of Wed 2 Dec
