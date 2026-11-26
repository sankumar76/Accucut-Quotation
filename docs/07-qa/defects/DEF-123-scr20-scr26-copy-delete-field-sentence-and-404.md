# DEF-123: copy: the SCR-20 delete-field sentence stops before "(AY becomes AX, and so on)" and the SCR-26 404 lacks "Use the menu to find what you need." (conformance; Product; Sev-4 proposed; Jira AQP-480, GitHub #774)

| Field | Value |
|-------|-------|
| Story / AC | AQP-359 (STORY-08.04); the 404 page has no single story (AQP-1, AQP-48); SCR-20 Delete a field and SCR-26 404 (desktop); the ux-expert's report, rows C-20-01, C-26-01. The mock-up and spec text quoted below. |
| Severity | **Sev-4 proposed by QA** (the ux-expert's word: Minor); **master grades.** |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** Not yet graded by master. |
| Jira / GitHub | [AQP-480](https://sankumar76.atlassian.net/browse/AQP-480) / [#774](https://github.com/sankumar76/Accucut-Quotation/issues/774) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-123, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 3, report `docs/03-ux/rulings/conformance-check-2026-11-28.md` (records-u fa07bba3); logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data; QA did not run it |
| Environment | the ux-expert's hands-on check at the widths named |

## Design (mock-up and spec)
[C-20-01] '... moves every later field one letter to the left (AY becomes AX, and so on).' [C-26-01] 404: 'The link may be old or mistyped. Use the menu to find what you need.'

## Build (what the ux-expert saw)
[C-20-01] The sentence stops before the bracket. [C-26-01] 'The link may be old or mistyped.' (the button 'Go to the task queue' is right for a Lead or Admin).

## Ruling check
Copy-only, grouped. No conflicting ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-480 and GitHub issue #774, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
