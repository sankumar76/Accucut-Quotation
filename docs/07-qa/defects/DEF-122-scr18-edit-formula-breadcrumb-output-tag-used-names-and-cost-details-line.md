# DEF-122: SCR-18 Edit a formula lacks the breadcrumb, the "Output" tag, "Formula for", the used-names list and "Shows in the cost details as" (conformance; Product; Sev-3 proposed; Jira AQP-479, GitHub #773)

| Field | Value |
|-------|-------|
| Story / AC | AQP-338 (STORY-08.02); SCR-18 Edit a formula (1366 px); the ux-expert's report, rows C-18-01. The mock-up and spec text quoted below. |
| Severity | **Sev-3 proposed by QA** (the ux-expert's word: Minor; Major for the missing "Shows in the cost details as"); **master grades.** |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** Not yet graded by master. |
| Jira / GitHub | [AQP-479](https://sankumar76.atlassian.net/browse/AQP-479) / [#773](https://github.com/sankumar76/Accucut-Quotation/issues/773) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-122, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 3, report `docs/03-ux/rulings/conformance-check-2026-11-28.md` (records-u fa07bba3); logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data; QA did not run it |
| Environment | the ux-expert's hands-on check at the widths named |

## Design (mock-up and spec)
A breadcrumb; the card head 'Formula' with an 'Output' tag; 'Formula for AL'; the intro 'Type letters, rate names, numbers, + - * / and brackets...'; a list of used names with 'input' / 'rate'; 'Shows in the cost details as <formula>'.

## Build (what the ux-expert saw)
None of these; the label 'Formula M'; a different intro.

## Ruling check
One defect, graded at its highest item (the missing 'Shows in the cost details as' is Major for the ux-expert). No conflicting ruling found.

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
Jira Bug AQP-479 and GitHub issue #773, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
