# DEF-097: SCR-05 form head reads "Parts and inputs / Part 1" with a full-width red bar; the design has an eyebrow, "1.1 . Base frame" and a short black bar "23 of 24 inputs complete" (conformance; Product; Sev-3; Jira AQP-454, GitHub #747)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304 (the part form), AQP-388; SCR-05 (all widths); the ux-expert's batch 1, item E. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major). |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 1.** Open. |
| Jira / GitHub | [AQP-454](https://sankumar76.atlassian.net/browse/AQP-454) / [#747](https://github.com/sankumar76/Accucut-Quotation/issues/747) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-097, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Eyebrow 'SUB-ASSEMBLY . LEVEL 2, UNDER 1 CONTROL CABINET ASSEMBLY'; title '1.1 . Base frame'; a short black bar '23 of 24 inputs complete'.

## Build (what the ux-expert saw)
Head 'Parts and inputs' / 'Part 1' and a full-width red bar '21 of 21 inputs complete'.

## Ruling check
The 'Part 1' name is DEF-089 (lane 1); the eyebrow and the bar are separate and belong here.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** Same PR as DEF-098 (the form), DL-416 (5).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 1 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-454 and GitHub issue #747, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
