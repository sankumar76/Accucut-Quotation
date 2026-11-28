# DEF-149: after an add on the Lead's editable island (#811), Back twice then 'Leave without saving' does not leave: `history.go(-2)` in `leave-guard.ts` lands on the same estimate page (Product; Sev-2 provisional; Jira AQP-506, GitHub #844)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316), the unsaved-changes warning and its 'Leave without saving' (AC-4: typing is not lost on leaving the estimate page); #811 (AQP-488), the Lead's editable tree |
| Severity | **Sev-2 Major, provisional**, on the test-plan scale (an AC fails with a workaround): 'Leave without saving' does not leave in one path. The person is never trapped (a portal link or another Back still leaves) and nothing is lost; the path is narrow; **master may weigh Sev-3** |
| Priority | P2 |
| Type | **Product** (found by lane 2; QA read the guard's code; the steps are lane 2's and have not been run by QA) |
| Status | **Open, 2026-11-28.** Master has not ruled grade, owner or whether it is a #811 merge condition |
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
| Master's ruling (grade, owner, whether a #811 merge condition) | master | | |
| Fix PR (test-first) | developer (lane 2) | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-506 and GitHub issue #844, created 2026-11-28 and cross-linked; related AQP-316 (STORY-05.08), AQP-488, #811, AQP-1; test plan 0.3.160.