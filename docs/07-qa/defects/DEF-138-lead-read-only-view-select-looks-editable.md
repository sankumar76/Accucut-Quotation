# DEF-138: The Lead's read-only view (SCR-06): a read-only drop-down (Treatment / Color) is drawn white with a chevron, unlike the shaded dashed read-only boxes beside it, so it looks editable (conformance; Product; Sev-4 proposed; Jira AQP-495, GitHub #816)

| Field | Value |
|-------|-------|
| Story / AC | DEF-131 Row V (AQP-488, #798), Stage 1, the Lead's read-only view of an Engineer's inputs (#800); the ruling `lead-admin-edit-inputs-2026-11-27.md` 1 and 3.2. |
| Severity | **Sev-4 Low, proposed by QA (the ux-expert's word: Minor); master grades.** |
| Priority | P4 (Jira Low; labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance with the ruling's read-only look) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
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
