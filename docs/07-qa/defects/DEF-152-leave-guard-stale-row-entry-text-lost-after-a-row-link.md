# DEF-152: on #845's branch (since b804c6f2), after a row link is pressed with the leave guard armed, 'Keep editing' shows the first row's text and the typing is gone (Product; Sev-1; on master not reproduced; Jira AQP-508, GitHub #848)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316) AC-4: typed work is not lost on leaving the estimate page; the guard asks, and 'Keep editing' keeps the person on the page with the text |
| Severity | **Sev-1 Critical on #845's branch** (test-plan scale: data loss: typed, unsaved text dropped after an explicit 'Keep editing', CI run 46117009843). **CORRECTED 2026-11-28: NOT on `master`** (not reproduced by qa-u2: E1 and E2) |
| Priority | P1; Jira Highest |
| Type | **Product** |
| Status | **Open on #845's branch, 2026-11-28.** A must-fix INSIDE #845 before merge (the coordinator's ruling). **NOT on the G8 blocking list** (not on `master`); it becomes a `master` defect only if #845 merges with it. Earlier (superseded): found on `master` by code reading, on the G8 blocking list |
| Jira / GitHub | [AQP-508](https://sankumar76.atlassian.net/browse/AQP-508) / [#848](https://github.com/sankumar76/Accucut-Quotation/issues/848) (labels bug, sev-1, ai-delivery; Jira also aiid-DEF-152, agent-qa-engineer, on-master, final-review). Linked 'relates to' AQP-506 (DEF-149). Searched first: JQL on `aiid-DEF-151`, `aiid-DEF-152`, 'stale entry': nothing; DEF-151 is unused (DL-479 note 8) |
| Found by / date | lane 1 (code reading, and the E2E of #845), 2026-11-28; logged by qa-engineer on the orchestrator's relay of the coordinator's ruling |
| Build / commit | **#845's branch, head 38859d2b (CI run 46117009843); a regression since `b804c6f2` (QLT-845-08).** On `master` 51502650 NOT reproduced (qa-u2, desktop, dev server). Earlier (superseded): 'found on `master` by code reading' |
| Environment | CI (`next dev`); invented data only |

## What the user sees
A Lead types in the second row of the parts tree after pressing its link while the leave guard is armed, then presses Back. On `master`, no warning appears and the page shows the first row: the text typed in the second row is lost silently. On #845, the warning appears, but after 'Keep editing' the form shows the first row's saved text ('Invented description, first save') and the typing is gone.

## Steps to Reproduce (as relayed; not run by QA on `master`)
1. On the Lead's review page of a Prepared estimate, edit a field in the first row and leave it so it saves (the guard arms).
2. Press another row's link in the parts tree: the guard replaces only its own history entry; the page's own entry below it still holds the first row's address (for example `row=1.1`).
3. Type into a field of the second row without saving.
4. Press Back.
5. On #845 choose 'Keep editing'.

## Expected / Actual
**Expected:** Back asks, the guard stays armed, and after 'Keep editing' the second row and its typed text are still shown. **Actual:** on `master` (by code reading) `armedFor` is cleared, Back gives NO dialog and the router renders the first row; the text is lost silently. On #845 Back asks, but after 'Keep editing' the visible form shows the first row and the typing is gone.

## Evidence
- The unit test `tests/unit/leave-guard-visible-row.test.ts` (untracked, worktree aqp-506-lane1) is RED at line 129: expected `{ row: '1', typed: 'Invented text typed in the second row' }`, got `{ row: '1.1', typed: null }`. Its fake router is built to drop the typing, so it proves the stale-entry cause, not the browser drop on its own.
- CI run 46117009843 (PR #845, head 38859d2b, failure): `leave-guard-history.spec.ts` :184 (all three widths), :176 (mobile, tablet), :196 (mobile, desktop) and :164 (mobile), each failing with the other row's saved text visible (QA read the log: 14 matches of `Received: "Invented description, first save"`).
- Root cause (lane 1): the stale page entry below the guard's replaced entry. Not a regression from #845, which only partly fixes it. A different mechanism from DEF-149's `go(-2)` count and from DEF-150's late `router.refresh()`.

## Fix and proof (proposed; the coordinator's routing)
Inside #845 before merge; the `master` part on `master` by the end of Wed 2 Dec. By outcome: after a row link pressed with the guard armed, the page's own history entry and the guard's entry both name the row shown, so Back asks, 'Keep editing' keeps the second row and its text, and the leave reaches the page before the estimate page; nothing typed in any row is lost. Test-first: the unit test above green, and #845's `leave-guard-history.spec.ts` :164, :176, :184 and :196 green at three widths on #845's run of record, with no wait, budget or time-out change beyond what DL-481 (2) accepted. QA runs the same steps once on `master` (own throwaway database, [desktop]) to confirm the `master` part when the PC allows.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Coordinator's ruling: a must-fix inside #845 | coordinator | 2026-11-28 | relayed by the orchestrator |
| Fix in #845 (and on `master`) | developer (lane 1) | | |
| QA's run on `master` of the steps | qa-engineer | | |
| Verified | qa-engineer | | |

## CORRECTION: on #845's branch, not on `master` (qa-engineer, 2026-11-28; test plan 0.3.172)
**DEF-152 CORRECTED: it is on #845's branch, not on master (28 Nov 2026 UTC; qa-engineer; 0.3.172; the orchestrator's relay of the new QA agent's run, QA read the raw output).** The second QA agent (qa-u2) ran the steps on **master 51502650** (dev server, desktop 1366x768, one run per variant, '2 passed (1.4m)'), raw output `scratchpad\qa150\def150-out-fifth.txt`: **E1** (save in row 1.1, click row 1, type, Back): the leave dialog appears, and 'Keep editing' keeps the second row open with the typed text (history length 3, 4, 4, 5, 5; URL `?row=1#row-inputs` after the click and after Keep editing; dialog true after Back, false after Keep editing); **E2** (unsaved typing in 1.1, then another row): the dialog asks on the click; after 'Leave without saving', typing in row 1 and pressing Back, the dialog asks and 'Keep editing' keeps the typed text. **So the claim for master (lane 1's code reading: `armedFor` cleared, no dialog on Back, text lost) is NOT reproduced;** it matches the round 2 reviewer and lane 1's corrected reading: **the defect is a regression on #845's branch (since `b804c6f2`, QLT-845-08), not on master.** Limits: desktop only, development server, one run per variant. **Grade unchanged for #845's branch: Sev-1** (typed, unsaved text dropped after an explicit 'Keep editing', CI run 46117009843, head `38859d2b`: `leave-guard-history.spec.ts` :184 all three widths, :176, :196 and :164); Jira priority stays Highest; **a must-fix inside #845 before merge (the coordinator's ruling); NOT on the G8 blocking list (not on `master`); it becomes a `master` defect only if #845 merges with it; QA's own run on `master` is no longer needed.** The Jira label `on-master` is removed; AQP-508 and GitHub #848 carry the corrected title and body and a comment.

## Records
Jira Bug AQP-508 and GitHub issue #848, created 2026-11-28 and cross-linked; related AQP-506 (DEF-149), AQP-507 (DEF-150), AQP-316, #845, AQP-1; test plan 0.3.171.