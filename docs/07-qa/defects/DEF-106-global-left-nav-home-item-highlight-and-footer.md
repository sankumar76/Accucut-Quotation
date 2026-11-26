# DEF-106: every signed-in screen: the left nav has an extra "Home" item, no active-row highlight on some pages, and no "Version 1.0 / (c) Accucut Lasers Pvt Ltd" footer (conformance; Product; Sev-4 proposed; Jira AQP-463, GitHub #757)

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02, the app shell), AQP-48 (STORY-01.02, navigation per role); every signed-in screen; the ux-expert's batch 2, item global. The mock-up and spec text quoted below. |
| Severity | **Sev-4 proposed by QA** (the ux-expert's word: Minor); **master grades.** |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** Not yet graded by master. |
| Jira / GitHub | [AQP-463](https://sankumar76.atlassian.net/browse/AQP-463) / [#757](https://github.com/sankumar76/Accucut-Quotation/issues/757) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-106, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
The left nav of the SCR mock-ups: no 'Home' item; the current page highlighted; the footer 'Version 1.0 / (c) Accucut Lasers Pvt Ltd' at the foot of the nav.

## Build (what the ux-expert saw)
An extra 'Home' item; some pages show no active-row highlight (My tasks not highlighted); the footer is missing.

## Ruling check
Filed once (the ux-expert's global item). **Moved here from DEF-100** (batch 1, item I), which listed the same three items; DEF-100 keeps the rest of its list. No ruling found.

## Proof (proposed; master and the ux-expert set it)
The screen reads as the design above at the widths named; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-463 and GitHub issue #757, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
