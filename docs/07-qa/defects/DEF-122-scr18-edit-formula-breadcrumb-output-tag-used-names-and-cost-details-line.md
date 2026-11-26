# DEF-122: SCR-18 Edit a formula lacks the breadcrumb, the "Output" tag, "Formula for", the used-names list and "Shows in the cost details as" (conformance; Product; Sev-3; Jira AQP-479, GitHub #773)

| Field | Value |
|-------|-------|
| Story / AC | AQP-338 (STORY-08.02); SCR-18 Edit a formula (1366 px); the ux-expert's report, rows C-18-01. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Minor; Major for the missing "Shows in the cost details as"). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 3.** Open. |
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

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **AC check, 26 Nov: no AC fails; stays Sev-3.** AQP-338 (STORY-08.02) AC-1 names the editor, the suggestion list, the live check, the "Used by" and "Feeds" lists and the sample-row preview; the build has a "Used by" and a "Uses" list (`formula-editor-texts.ts:53-55`), and the server answer carries `feeds`. The label "Shows in the cost details as" is in no AC, FR or `ux-spec.md` text: it exists only in the SCR-18 mock-up (`docs/03-ux/screens/SCR-18.html:65`), and nothing in `src/` sets or shows such a label, so it cannot be "set elsewhere". Lane 3 last (DL-416 (5)).

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 3 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-479 and GitHub issue #773, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
