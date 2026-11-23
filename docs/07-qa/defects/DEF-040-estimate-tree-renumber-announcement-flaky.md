# DEF-040: `estimate-tree.spec.ts:103` [desktop] flaky: after Alt+ArrowUp the live region never says "Part renumbered to 1" (expect toHaveCount(1) received 0 after 15 s; passed on retry; seen once, PR #464)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.02 (AQP-302) AC-2 (arrow keys, Home, End and Alt with arrows; the screen says what changed) |
| Severity | **Sev-2 Major, PROVISIONAL, from 2026-11-23 (master, DL-338): DL-234 (3)(iii) is met as written by the occurrence on `master` push 45125449394 (a move sent, no answer in the 22 s watch, no Notice, no announcement). A G8 blocker while it stands (G8 mandatory item "no open Sev-1/Sev-2"); it is on the blocking-defect list.** Earlier (superseded): Sev-3 Moderate, provisional; raise to Sev-2 if a snapshot shows the tree moved but no announcement (form (i) only; DL-338 corrects DL-334 (6), which read only form (i)) |
| Priority | **P2 (Jira High, label `sev-2`, GitHub `sev-2`)** from 2026-11-23. Step 1 is the developer's code-facts note, first task in the lane that takes 3D AQP-406, before any 3D code (DL-338 (4)). Due by the freeze (about 3 Dec); if still provisional then, to the delivery lead with options before the G8 recommendation. Earlier: P3 |
| Type | **Undecided** (DL-338): Product (client or server) or Test; outcomes M1, M2 and M3 below decide it. Not shown to be a product fault |
| Status | **Open, provisional Sev-2 (DL-338, 2026-11-23).** The note (step 1) is pending; no fix. A diagnostic PR #472 merged as `5c4a21a6`; the diagnostic stays until DEF-040 closes. **DL-275 A11 ("fixed, or accepted in writing by master at G8") is SUSPENDED while the Sev-2 stands**: it is replaced by outcomes M1 to M3, and it applies again only if M1 releases the grade to Sev-3. Occurrence of 2026-11-23 and DL-338 recorded below |
| Jira / GitHub | [AQP-343](https://sankumar76.atlassian.net/browse/AQP-343) / [#468](https://github.com/sankumar76/Accucut-Quotation/issues/468) |
| Found by / date | qa-engineer, 2026-11-17; PR #464 head `6097dff` |
| Environment | CI run 44087410883, job `Stage 12: E2E (shard 4 of 4)`, project desktop, dev server; no trace kept (first attempt) |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-343, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Not reproduced. Spec lines 127 to 138: tree 1, 1.1, 2; walk focus; press Alt+ArrowUp on part 2; expect text "Part renumbered to 1" (a `role="status"` sr-only paragraph in `tree-panel.tsx`, filled by `use-parts-tree.ts` `move()` after the server answered ok).

## Expected Result
The live region reads "Part renumbered to 1" (one element) and the tree reads 1, 2, 2.1.

## Actual Result
First attempt 28.7 s: `toHaveCount(1)` received 0 after the full 15 s (clean assertion failure, not a 30 s timeout or a reset); retry passed in 17.0 s. 1 in 11 runs.

## Suspected Area
`tree-panel.tsx` (Alt+Arrow branch), `use-parts-tree.ts` (`move`, `change`, the `busy` gate: it returns silently when busy); test side `estimate-tree.spec.ts:127-138` (no wait that the selected part is focused and nothing is in flight).

## Fix & Verification  _(developer / qa-engineer)_
Deciding evidence: the `error-context.md` or a trace of a failed first attempt (danger notice, unchanged tree, or moved tree with an empty region), the dev-server status of the move request, or a `--repeat-each` loop in CI.

## Occurrence 2026-11-23: `estimate-tree.spec.ts:282` [desktop], the first diagnostic to name the step (qa-engineer; DL-334 (C); read from the Stage 12 job log, ANSI stripped; no re-run, no ruling)

**Where.** `master` push run **45125449394** (head 06d5d56a, #642's squash), Stage 12 shard 4 of 4, job **137528621762** (desktop; `1 flaky, 528 passed (12.3m)`, `success`). Case "AC-1, AC-2: adding, moving and renumbering > AC-1, AC-2: the "+" of a row and "Add main assembly" add rows and number them 1, 1.1, 1.2, 2; Move up renumbers and says so" (`estimate-tree.spec.ts:282`; the file's earlier occurrences were at :67 and :103, now :282 after later changes). Attempt 1 **27.9 s** (inside the 30 s budget): `expect(getByText('Part renumbered to 1.1')).toHaveCount(1)` received **0** after the 15 s timeout (33 polls), at `expectRenumbered` (spec :214, called from :301). Retry passed in **24.1 s**. The run is red because of another case (DEF-072); this one was flaky.

**The diagnostic (`[AQP-343 renumber diagnostic]`, attached as `renumber-diagnostic`; the log prints it in full once):**
```
desktop | AC-1, AC-2: the "+" of a row and "Add main assembly" add rows and number them 1, 1.1, 1.2, 2; Move up renumbers and says so | attempt 1 | toHaveCount(1) failed for "Part renumbered to 1.1" | watch ran 22069 ms
  elements with the announcement's words: 0 (the wait needs exactly 1)
  tree as rendered (4): 1 (closed) | 1.1 (closed) | 1.2 (open) | 2 (closed)
  live regions: status "" | sr-only status "Part 2 added" | status "Last saved 23 Nov 2026, 12:14 IST. Auto-save every 30 s." | sr-only status "" | sr-only status "" | status ""
  danger notices (role=alert): none visible
  move controls: Move up: aria-disabled=no, disabled=false ; Move down: aria-disabled=true, disabled=false
  other actions: Add main assembly: aria-disabled=no, disabled=true
  focus: <button> "Move up"
  move requests (1):
    move request #1: POST /api/v1/estimates/<estimate id>/tree/move sent +7058 ms: no answer after 15011 ms; body {"nodeId":"...","revision":1,"parentId":"<estimate id>","index":0}
  page errors: none
```
**Reading (facts, QA does not decide the type).** The move request **was sent** (so not a dropped click, and not DL-234 (3)(ii)); the server **did not answer it within the 15 s of the wait** (the watch ran 22,069 ms = 7,058 + 15,011: no answer for the whole watch); the tree as rendered **did not move** (1, 1.1, 1.2, 2: part 2 still last); **no danger notice** and **no page error**; "Move up" was enabled and focused; the live region held "Part 2 added" from the earlier add, not the renumber announcement. This is the first occurrence whose diagnostic names the step: the move request, not the announcement.

**Master's ruling (DL-334 (6), recorded).** An occurrence of DEF-040 by signature (the announcement absent after the 15 s expect, inside the budget; not the time-out mode). It is **not** DEF-040's Sev-2 condition as master reads it ("tree moved, no announcement"). **The type stays undecided, and DL-275 A11 is unchanged** (DEF-040 is fixed, or accepted in writing by master at G8). Lead, not a finding (DL-334 (6)): in the same minute (06:43:56Z to 06:44:11Z) the approve notice on another runner (DEF-073) was waiting on an answer, and #632's Stage 11 stall came at about 06:45:52Z on a third runner; no shared cause is shown and the other shards in that window had no failures. Same run's other facts: shard 4 `528 passed`; the same case passed at mobile (32.7 s) and tablet (39.0 s) in shards 1 and 2 on this run (both readings are over 30 s; QA did not look at why the case is allowed that long).

**For master (2026-11-23, DEF-040; answered by DL-338, see below).** DL-234 (3)(iii), the Sev-2 list set for AQP-343, reads: "the move answered with an error, or not at all, and no Notice shows, or `busy` stays set so that later moves are dropped without feedback"; it "does not raise it on its own: an ok answer after more than 15 s on the loaded `next dev` runner, with the announcement then shown". This diagnostic shows a move sent, **no answer for the whole 22 s watch, no Notice**, and the tree unmoved. Read as written, that is item (iii) ("not at all, and no Notice shows"), not the carve-out (there was no ok answer and no announcement). DL-334 (6) quotes only the (i) form ("tree moved, no announcement"). QA has **not** re-graded and has **not** decided: whether DL-234 (3)(iii) applies to this diagnostic (Sev-2, a G8 blocker under "no open Sev-2") or whether a server that did not answer within the watch is the carve-out's "loaded runner" tail is master's ruling. Until then DEF-040 stays Sev-3 (provisional) as filed, and Jira AQP-343 and GitHub #468 are unchanged except for the comment recording this occurrence.

## DL-338 (master, 2026-11-23): provisional Sev-2, type undecided, a G8 blocker; the outcomes M1 to M3 (QA's record and the changes QA made; no ruling made here)

**Answer to the question to master above.** "No (not decided by QA)" is replaced by master's ruling: **DL-234 (3)(iii) is met as written.** (iii) raises AQP-343 to Sev-2 on "the move answered with an error, or not at all, and no Notice shows, or `busy` stays set so that later moves are dropped without feedback"; its carve-out ("an ok answer after more than 15 s on the loaded `next dev` runner, with the announcement then shown") needs an ok answer and the announcement, and neither was seen in the 22,069 ms watch. Whether the server would have answered later is not in the log; the slow answers on other runners in the same minute (DL-334 (6)) are a lead, not evidence that clears it. A provisional grade set in advance is released only by the reading the rule names (DL-165, DL-284, DL-329 (2)). The diagnostic also shows "Move up" enabled while "Add main assembly" was disabled during the open request: whether a second press in that state is dropped silently is (iii)'s second form, and the note answers it. **DL-334 (6) is corrected:** it quoted only form (i); the rest of it stands (an occurrence by signature, not the time-out mode, not counted on RISK-031 trigger (b)).

**Changes QA made on 2026-11-23 (DL-338 (3)):** this file (Severity, Priority, Type, Status; this section); **Jira AQP-343** priority Medium to High and label `sev-3` to `sev-2` (labels now `agent-qa-engineer`, `ai-delivery`, `aiid-DEF-040`, `sev-2`); **GitHub #468** `sev-3` to `sev-2`; **test plan section 7 and 7.1** (DEF-040 is on the blocking list; DEF-033, DEF-036, DEF-043, DEF-018 keep the A11 row).

**Step 1: the developer's code-facts note (DL-338 (4)).** No code change; posted on AQP-343 and #468; every item by file:line on `master`: (i) the client path of a move from the button or key press to the announcement (`use-parts-tree.ts` `move()` and the `busy` gate; what the UI shows while a move is open; which controls are disabled; what a press during `busy` does: dropped, queued or refused with feedback); (ii) whether the move `fetch` has a time limit or abort, and what the UI shows if the request never answers or fails (Notice text, focus); (iii) the server path of `POST /tree/move` from `withRoute` to the answer: every query, transaction and lock (a revision check, `FOR UPDATE`, a transaction shared with the autosave PATCH) and anything that can wait; (iv) for the 23 Nov attempt, the requests in flight on that worker around +7,058 ms (the "Part 2 added" add, the autosave). **Where:** the first task in the lane that takes 3D AQP-406, by the developer who will build 3D, **before any 3D code**; time-boxed at about one hour; it takes no lane promised to a CR-01 story (DL-337 (6)).

**Outcomes, set in advance (DL-338 (5)).**

| Outcome | The note finds | Then |
|---|---|---|
| **M1, released** | The server path has no wait that a single move can hold (no lock or wait beyond its own short transaction). The client bounds an unanswered move or shows the in-flight state, and a press during `busy` is refused with feedback or not offered | The 23 Nov reading is the loaded development server, as in the carve-out. **QA returns DEF-040 to Sev-3 (provisional) the same day**; it leaves the blocking list; DL-275 A11 applies again |
| **M2, Sev-2, type Product (client)** | An unanswered or failed move leaves the person with no Notice and no in-flight sign without limit, or a press during `busy` is dropped silently while the control shows as enabled | A product fix in the client, with every renumber assertion kept and a test that pins the new behaviour (a stubbed move that never answers, then the stated feedback). **Blocks G8 until QA verifies it** |
| **M3, Sev-2, type Product (server)** | A lock or wait on the server path can hold a move behind another request of the same estimate (for example the autosave) | **To master at once with the note;** master rules on the fix and on whether it is a section 9 item 2 area (data loss) |

Under M2 or M3, master re-rules the order against 3D: the fix is a separate PR, ahead of 3D's merge in the same lane, so that 3D is built on the corrected move path. If that moves the G8 forecast outside 5 to 8 Dec (DL-307), it goes to the delivery lead with options (arbitration rule 4).

**Binding on 3D AQP-406 meanwhile (DL-338 (6)).** The `[AQP-343 renumber diagnostic]` and every "Part renumbered to" assertion in `estimate-tree.spec.ts` stay. 3D's PR body states how it changes items (i) and (ii) of the note. A DEF-040 signature on 3D's run of record (any attempt) comes to master before 3D merges.

**Proof to close DEF-040, any outcome (DL-338 (7)).** **No DEF-040 signature** (the announcement absent after the 15 s expect, with the diagnostic) **on the fix PR's run of record (if there is one) and on the first two `master` pushes after it, at three widths.** The diagnostic stays until DEF-040 closes. Any later occurrence comes to master with its diagnostic. QA greps every Stage 12 log for `[AQP-343 renumber diagnostic]` (DL-234 D4).

**Owners and date (DL-338 (8)).** Developer (the note), then master (the outcome), then qa-engineer (the grade). Due by the freeze (about 3 Dec); if still provisional then, to the delivery lead with options before the G8 recommendation. **Pre-G8 list:** DEF-040 moves from "DL-275 A11, fix or written acceptance" to the blocking-defect list as provisional Sev-2 (the orchestrator copies it).
