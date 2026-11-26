# DEF-117: SCR-15 Settings and SCR-23 Your account (and SCR-01, see DEF-102): the centred column of about 480 px is left aligned or full width; SCR-15 layout and intro text; SCR-23 reveal-password buttons (conformance; Product; Sev-4 proposed; Jira AQP-472, GitHub #768)

| Field | Value |
|-------|-------|
| Story / AC | AQP-307 and AQP-349 (SCR-15), AQP-81 (SCR-23), AQP-38 (SCR-01); SCR-15 Settings, SCR-23 Your account (and SCR-01); the ux-expert's batch 2, item AB, AE, AF. The mock-up and spec text quoted below. |
| Severity | **Sev-4 proposed by QA** (the ux-expert's word: Minor); **master grades.** |
| Priority | P4 (Jira Low) (labels `sev-4`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 2).** Not yet graded by master. |
| Jira / GitHub | [AQP-472](https://sankumar76.atlassian.net/browse/AQP-472) / [#768](https://github.com/sankumar76/Accucut-Quotation/issues/768) (labels bug, sev-4, ai-delivery, final-review, conformance; Jira also aiid-DEF-117, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 2, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data (the ux-expert's file `qa-batch-2.md`); QA did not run it |
| Environment | the ux-expert's hands-on check at 1366 px (360 and 768 px by text diff and page heights) |

## Design (mock-up and spec)
[AF] the content columns of SCR-01, SCR-15 and SCR-23 centred, about 480 px; [AB] SCR-15: one centred card of about 480 px with the toggle at the right of 'E-mail alerts: ON'; [AE] SCR-23: no reveal-password buttons; the card centred.

## Build (what the ux-expert saw)
[AF] left aligned or full width (SCR-01's part is DEF-102); [AB] SCR-15 is two wide, left-aligned cards (E-mail alerts, Backups) with the extra intro sentence 'Nothing on this page starts, restores or deletes a backup.'; [AE] reveal-password buttons beside the three password fields and the card left aligned.

## Ruling check
One fix for the shared centred column; **the E-mail OFF wording is accepted**, not counted.

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
Jira Bug AQP-472 and GitHub issue #768, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-093 to DEF-105 (batch 1); DL-409 to DL-412; test plan 0.3.66. Source: the ux-expert's conformance check (DL-411), batch 2, read from `qa-batch-2.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
