# DEF-120: status words: an Engineer on a reloaded Prepared estimate sees only "This estimate can no longer be changed." (SCR-05)) (conformance; Product; Sev-4; Jira AQP-477, GitHub #771)

| Field | Value |
|-------|-------|
| Story / AC | AQP-299 (STORY-06.01), AQP-319; SCR-05 (Engineer); the ux-expert's report, row C-05-15 (row C-06-06 was trimmed, see Ruling check). The mock-up and spec text quoted below. |
| Severity | **Sev-4, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-4 (the ux-expert's word: Minor). |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 3).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-4; no lane before the freeze (first update, DL-417).** Open. |
| Jira / GitHub | [AQP-477](https://sankumar76.atlassian.net/browse/AQP-477) / [#771](https://github.com/sankumar76/Accucut-Quotation/issues/771) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-120, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 3, report `docs/03-ux/rulings/conformance-check-2026-11-28.md` (records-u fa07bba3); logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data; QA did not run it |
| Environment | the ux-expert's hands-on check at the widths named |

## Design (mock-up and spec)
Prepared (Engineer): the notice 'Prepared. Your inputs are now read-only. A Lead or Admin reviews them. If something has to change, ask them.'

## Build (what the ux-expert saw)
On reload only 'This estimate can no longer be changed.' (the Prepared notice shows only right after the press).

## Ruling check
Copy-only, grouped. No conflicting ruling found.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **Trimmed 2026-11-26 (master, DL-418 (3)):** the second item (C-06-06, the Approved badge reads "Approved and locked") is removed: AQP-296 AC-1 and AQP-297 AC-6 were amended to exactly that wording (DL-216 (2), option A). The Prepared sentence on SCR-05 stays, Sev-4.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-4, no lane before the freeze (first update, DL-417) |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-477 and GitHub issue #771, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-119 (batches 1 and 2); DL-409 to DL-412; test plan 0.3.67; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance report (DL-411), batch 3; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
