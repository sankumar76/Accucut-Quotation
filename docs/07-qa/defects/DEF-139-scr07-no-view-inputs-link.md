# DEF-139: SCR-07 (Cost details) has no "View inputs" link to the row's inputs on SCR-06 (DEF-131 Row V, check RO-18; the ruling's 3.1) (Product; Sev-3 proposed; Jira AQP-496, GitHub #817)

| Field | Value |
|-------|-------|
| Story / AC | DEF-131 Row V (AQP-488, #798): check RO-18; the ruling `lead-admin-edit-inputs-2026-11-27.md` 3.1. |
| Severity | **Sev-3 Medium, proposed by QA (the ux-expert's word: Major, the named control is missing); master grades.** |
| Priority | P3 (Jira Medium; labels `sev-3`, `final-review`, `demo-2026-11-30`) |
| Type | **Product** (a named part of DEF-131 Row V is missing) |
| Status | **Open (new), 2026-11-27.** Owner lane: to be set by master or the orchestrator. |
| Jira / GitHub | [AQP-496](https://sankumar76.atlassian.net/browse/AQP-496) / [#817](https://github.com/sankumar76/Accucut-Quotation/issues/817) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-139, agent-qa-engineer). Relates to DEF-131 (Row V), #800, DEF-113, AQP-1. Searched first: JQL on `aiid-DEF-139` and a GitHub search for the same words: nothing earlier. |
| Found by / date | The ux-expert's hands-on re-check pass 2 (N-7) (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); logged by qa-engineer, 2026-11-27 |
| Build / commit | Source search of master `d5e352f9` and the pull-request head of #800 (`6aa4dfbd`): `git grep` of `src` and `tests` (a source search, not a browser look; QA did not run it) |
| Environment | The ux-expert's scratch build (not CI, not the demo) |

## Steps to Reproduce
Open SCR-07 for a row as a Lead or an Admin; look in the row header for the link `View inputs`.

## Expected Result
A link `View inputs` in the row header opens `/estimates/<code>?row=<Sl. No>#row-inputs` (SCR-06 with that row selected); SCR-07's "Back to the estimate" breadcrumb unchanged; Lead and Admin only (SCR-07 already is).

## Actual Result
No `View inputs` link on SCR-07: it is not in master `d5e352f9` and `git grep` finds no occurrence in #800's head `6aa4dfbd`.

## Binding and proof (proposed)
RO-18: the link is present for each row, goes to the row's inputs with the block showing that row (RO-2's status and focus), at three widths; the existing assertions kept; axe clean; first load stated against 193,500 B; the ux-expert's hands-on check repeated. **DEF-131 Row V is not closed until this is fixed or the product-owner defers it.** The orchestrator schedules the fix as an immediate follow-up to #800.

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-496 and GitHub issue #817, created 2026-11-27 and cross-linked. Related: DEF-131 (Row V), #800, DEF-113, AQP-1; the ux-expert's pass 2 (`docs/03-ux/rulings/hands-on-recheck-2-2026-11-28.md`, records-u 775ed4fc); test plan 0.3.102.
