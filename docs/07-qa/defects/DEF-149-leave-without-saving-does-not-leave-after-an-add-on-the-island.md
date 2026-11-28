# DEF-149: after an add on the Lead's editable island (#811), Back twice then 'Leave without saving' does not leave: `history.go(-2)` in `leave-guard.ts` lands on the same estimate page (Product; Sev-2 confirmed, a #811 merge condition; Jira AQP-506, GitHub #844)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316), the unsaved-changes warning and its 'Leave without saving' (AC-4: typing is not lost on leaving the estimate page); #811 (AQP-488), the Lead's editable tree |
| Severity | **Sev-2 Major, CONFIRMED by master (DL-476 (A)) on STORY-05.08 AC-4**: an AC choice does nothing in a reachable path (an AC fails with a workaround). Not Sev-1 (nothing is lost, the guard fails safe); Sev-3 is not available (it covers wording, state and layout). Not provisional on its reading; QA confirms the reproduction from the red case |
| Priority | P2; a #811 merge condition (DL-476) |
| Type | **Product** (found by lane 2; QA read the guard's code; the steps are lane 2's and have not been run by QA) |
| Status | **Open, 2026-11-28. DL-476: Sev-2 confirmed; a #811 MERGE CONDITION (lane 2 fixes it in #811, test-first, six cases); pre-ruled exception: if it is the only item outstanding at the end of Tue 1 Dec, #811 may squash without it and the fix follows in lane 2's own PR by the end of Wed 2 Dec; ON THE G8 BLOCKING LIST.** |
| Jira / GitHub | [AQP-506](https://sankumar76.atlassian.net/browse/AQP-506) / [#844](https://github.com/sankumar76/Accucut-Quotation/issues/844) (labels bug, sev-2, ai-delivery; Jira also aiid-DEF-149, agent-qa-engineer, product). Searched first: JQL on `aiid-DEF-149`, 'leave-guard' and 'Leave without saving': nothing |
| Found by / date | lane 2, 2026-11-28, while fixing #811 (relayed by the orchestrator); logged by qa-engineer |
| Build / commit | **#811's branch `fix/AQP-488-lead-edit-tree` at `d71e62fa`.** Lane 2 reports it happens with #811's fix on and off. **It cannot be reproduced on `master` today: the editable island exists only on #811** |
| Environment | any browser with history; invented data |

## Steps to Reproduce (lane 2's; not yet run by QA)
1. On the Lead's review page with the editable island (#811), add a part: the new row opens and the island rewrites `?row=` on the guard's extra history entry.
2. Type into a field without saving.
3. Press Back: the guard asks.
4. Press Back again.
5. Choose 'Leave without saving'.

## Expected / Actual
**Expected:** the person leaves the page, as on any other path. **Actual:** the page does not leave: `history.go(-2)` lands on the same estimate page (`?row=1.2`) instead of the queue. **Data loss:** none; no text is lost, the person stays on the page.

## Suspected Area (QA's code read, not a finding of cause)
`src/lib/estimates/leave-guard.ts` lines 153 to 166: after the guard's Back the leave goes `history.go(-2)`, which assumes the history is [the page before, the page's own entry, the guard's extra entry]. An add on the island writes a new `?row=` address into the history, so two steps back reach the page's own earlier address, not the page before it.

## Fix and proof (proposed; not yet authorised)
Owner proposed by the orchestrator: lane 2 after #811, unless master rules it a #811 merge condition (the reviewer is giving a view). Test-first: a unit case of the guard with a history that has had an add (the leave must reach the page before the page's own first address) and an E2E case at 360, 768 and 1366 px on the island (add, type, Back, Back, Leave without saving: the page is left). No wait, budget or time-out change (DL-404). QA reads the PR run and the first `master` push after the squash.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling (grade, owner, whether a #811 merge condition) | master | 2026-11-28 | DL-476 (records-u 93921f26) |
| Fix PR (test-first) | developer (lane 2) | | |
| Verified | qa-engineer | | |

## DL-476 applied (qa-engineer, 2026-11-28; test plan 0.3.161)
**DL-476 applied to DEF-149 (28 Nov 2026 UTC; master's ruling relayed by the orchestrator; records-u 93921f26; qa-engineer; 0.3.161; no test run by QA).** **(A) Grade: Sev-2 Product, CONFIRMED on STORY-05.08 AC-4** (the AC names the Back button and the AlertDialog with 'Leave without saving' and 'Save draft and leave'; in this path neither choice leaves; a portal link or a further Back is the workaround; Sev-3 is not available because it covers wording, state and layout, not a failed AC choice; not Sev-1 because nothing is lost and the guard fails safe). **No longer provisional on its reading; QA confirms the reproduction from the red case of (C).** **(B) It is a #811 MERGE CONDITION:** the fix goes in #811, by lane 2, test-first, covered by #811's combined review round 3 as a delta (the guard protects typed work, so it is section 9 (2) ground). **Master's cause reading** (code read; QA has not run it): `leave-guard.ts` is the same on `master` and on #811 at d71e62fa; on a Back from its own entry, `onPopState` asks and its `proceed` runs `history.go(-2)` (lines 153 to 166), assuming the history is [the page before, the page's own entry, the guard's entry]; **#811 introduces what breaks that: the island writes `?row=` with `history.replaceState` (`review-tree-editor.tsx:160`, `:167`), and `master` has no such write (the Lead's rows are links, the Engineer page does not write `?row=`). So #811 introduces the defect; it is not on `master` and not caused by QLT-811-01's fix.** **A SECOND FINDING (master's): both dialog choices run the same `proceed` (`leave-guard.tsx:45`), so 'Save draft and leave' also stays on the page in this path.** **(C) Fix shape (by outcome):** from the guard's Back, both dialog choices reach the page before the estimate page, whatever `?row=` rewrites the island made while the page was open; no `history.go(-n)` with an assumed count (either the guard counts the entries it owns from its own marker in `history.state`, or the island's address rewrites go through the guard's handle so `armedFor` follows the address); an address rewrite never adds a history entry; the Engineer page's guard behaviour is unchanged. **Proof, test-first, all red before the fix where the fault applies and green after:** (1) a guard unit case with a history that has had an add; (2) an E2E case at 360, 768 and 1366 px on the island: add, type, Back, Back, 'Leave without saving': the page is left; **(3) the same steps with 'Save draft and leave' (saved, and left);** **(4) two adds, then a row chosen in the tree, before the Back;** **(5) 'Keep editing' after an add keeps the person on the page with the text and the guard armed, and a later Back asks again;** **(6) the guard's existing unit cases and the Engineer page's leave E2E cases stay green, unchanged.** No wait, budget or time-out change (DL-404). **QA reads #811's run of record (or the fix PR's run, under (D)) for these six, and the first `master` push after the squash.** **(D) Pre-ruled exception:** if at the end of Tue 1 Dec #811 is otherwise ready (the TBT pairs read, review round 3 approved, a fully green run of record at 0 behind, every DL-465 and DL-468 term met) and this fix is the ONLY item outstanding, the orchestrator may squash #811 without it; the fix then goes in lane 2's own PR from `master`, with the combined review, **merged by the end of Wed 2 Dec**; the orchestrator records which branch was used. **(E) Human question at G8, if the fix is not on `master` by the end of Wed 2 Dec:** A, G8 waits until the fix merges and the final regression covers it (the date moves past about 6 Dec); B, release with the delivery lead's written acceptance and a line in the Lead's user notes ('after adding a part, use a portal link to leave'); master would recommend B only if the six cases show that nothing is lost on every path, and A otherwise. **The blocking-list row stays.**

## Records
Jira Bug AQP-506 and GitHub issue #844, created 2026-11-28 and cross-linked; related AQP-316 (STORY-05.08), AQP-488, #811, AQP-1; test plan 0.3.160.