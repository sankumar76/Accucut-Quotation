# DEF-040: `estimate-tree.spec.ts:103` [desktop] flaky: after Alt+ArrowUp the live region never says "Part renumbered to 1" (expect toHaveCount(1) received 0 after 15 s; passed on retry; seen once, PR #464)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.02 (AQP-302) AC-2 (arrow keys, Home, End and Alt with arrows; the screen says what changed) |
| Severity | Sev-3 Moderate, **provisional**; raise to Sev-2 if a snapshot shows the tree moved but no announcement |
| Priority | P3 |
| Type | Undecided: Product (move dropped or announcement missing) or Test; not shown to be a product fault |
| Status | **Open** (Jira To Do; a diagnostic PR #472 merged as `5c4a21a6`; fix not merged; **occurrence of 2026-11-23 recorded below, DL-334 (6); question to master on DL-234 (3)(iii) open**). Hardening window; DL-275 A11 asks for a fix or a written acceptance at G8 |
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

**For master (2026-11-23, DEF-040).** DL-234 (3)(iii), the Sev-2 list set for AQP-343, reads: "the move answered with an error, or not at all, and no Notice shows, or `busy` stays set so that later moves are dropped without feedback"; it "does not raise it on its own: an ok answer after more than 15 s on the loaded `next dev` runner, with the announcement then shown". This diagnostic shows a move sent, **no answer for the whole 22 s watch, no Notice**, and the tree unmoved. Read as written, that is item (iii) ("not at all, and no Notice shows"), not the carve-out (there was no ok answer and no announcement). DL-334 (6) quotes only the (i) form ("tree moved, no announcement"). QA has **not** re-graded and has **not** decided: whether DL-234 (3)(iii) applies to this diagnostic (Sev-2, a G8 blocker under "no open Sev-2") or whether a server that did not answer within the watch is the carve-out's "loaded runner" tail is master's ruling. Until then DEF-040 stays Sev-3 (provisional) as filed, and Jira AQP-343 and GitHub #468 are unchanged except for the comment recording this occurrence.
