# DEF-138: The Lead's read-only view (SCR-06): a read-only drop-down (Treatment / Color) is drawn white with a chevron, unlike the shaded dashed read-only boxes beside it, so it looks editable (conformance; Product; Sev-4 proposed; Jira AQP-495, GitHub #816)

| Field | Value |
|-------|-------|
| Story / AC | DEF-131 Row V (AQP-488, #798), Stage 1, the Lead's read-only view of an Engineer's inputs (#800); the ruling `lead-admin-edit-inputs-2026-11-27.md` 1 and 3.2. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance with the ruling's read-only look) |
| Status | **Open (new), 2026-11-27.** **Graded by master 2026-11-27 (DL-446, records-u 1cb3fcbc): Sev-4, with a check:** on the merged build (master `2e11c44d`, #800 in) the Lead's read-only drop-down must not be openable or changeable on screen; if it can be opened or changed, even without saving, it becomes Sev-3 and goes with DEF-139 to lane 3. Otherwise lane 3's polish PR if cheap, else one G8 line for the delivery lead's acceptance. **Check status (QA, 2026-11-27): source read only, on-screen check pending** (see the section below). Owner lane: lane 3 for the polish PR, else the G8 acceptance line. |
| Jira / GitHub | [AQP-495](https://sankumar76.atlassian.net/browse/AQP-495) / [#816](https://github.com/sankumar76/Accucut-Quotation/issues/816) (labels bug, sev-4, ai-delivery, final-review; Jira also aiid-DEF-138, agent-qa-engineer). Relates to DEF-131 (Row V), AQP-1. Searched first: JQL on `aiid-DEF-138` and a GitHub search for the same words: nothing earlier. |
| Found by / date | The ux-expert's hands-on re-check pass 2 (N-6) (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); logged by qa-engineer, 2026-11-27 |
| Build / commit | The pull-request head of #800 (`6aa4dfbd`, which contains master `d5e352f9`; not merged when checked), a throwaway database with invented estimates, scripted Playwright (QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
As a Lead open SCR-06 for a Draft or Prepared estimate with a part that has a Treatment or Color choice; read the field's look beside the other read-only boxes.

## Expected Result
Every read-only field, selects included, has the shaded dashed look and no chevron that suggests a menu; it still takes focus and does not open (RO-6).

## Actual Result
The read-only drop-down (Treatment / Color) is drawn white with a chevron, so it looks editable. Screenshot `w1366\ro-chosen-row.png`. (The same pass saw a nine-digit total wrap the rupee sign onto its own line in the BL tile at 768, data-dependent with an invented 9-digit total: noted, not filed.)

## Binding and proof (proposed)
A read-only select drawn as the other read-only fields at three widths; RO-6 kept (no change, no request); axe clean; first load stated against 193,500 B; the ux-expert's hands-on check repeated. **Risk:** #800 and #812 both change `part-fields.tsx`; the fix must be read against both once both are on master.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-495 and GitHub issue #816, created 2026-11-27 and cross-linked. Related: DEF-131 (Row V), AQP-1; the ux-expert's pass 2 (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); test plan 0.3.102.

## DL-446 check: can the read-only drop-down be opened or changed on the merged build? (qa-engineer, 2026-11-27)
**Source read of `origin/master` `2e11c44d`** (`src/components/features/estimate-workspace/read-only-select.ts`; unit test `tests/unit/read-only-select.test.ts`; `aria-readonly` asserted in `estimate-review.spec.ts`). A read-only select gets `aria-readonly`, an `onMouseDown` that calls `preventDefault()` and focuses the control (so a mouse press does not open the list), and an `onKeyDown` that prevents every key that opens or moves the value (arrows, Home, End, PageUp, PageDown, Space, Enter, F4, Alt+Up/Down, any single character); the value is controlled, so a change that got through is put back. **What this does not show:** it is source, not the screen. It cannot prove (a) that a **touch** tap on a phone or tablet does not open the native list (a tap is not always a `mousedown` with a cancellable default on every browser), (b) that the drawn list is not opened by a browser-specific path (an assistive-technology action, a label click), or (c) that nothing changes on screen without a save. **QA has not run the on-screen check:** it needs a built merged app, a database and a browser, which is the heavy work CLAUDE.md section 9 item 5 keeps in CI, and the demo build is not this commit. **Proposed:** the ux-expert's scripted pass 3 (the same rig as pass 2, no Playwright MCP, no passwords printed) opens the Lead's read-only Treatment and Color drop-downs at 360 and 768 (touch) and 1366 (mouse and keyboard) and reports whether the list opens or the value changes; or lane 3's polish PR carries an E2E case. **Until then DEF-138 stays Sev-4 provisional; if the list opens or the value changes, it is Sev-3 and goes with DEF-139 to lane 3.**
