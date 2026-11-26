# DEF-125: SCR-05 number inputs have no unit add-on except kg and sec (design: mm, nos, holes, Rs / pc) (conformance; Product; Sev-3; Jira AQP-482, GitHub #776)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (form); split out of DEF-100 (the ux-expert's batch 1, item I). No numbered AC names the mm, nos or holes add-ons. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)):** an input with no unit invites a wrong-unit entry. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, split from DEF-100 at master's direction).** Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 3 (the "unit add-ons" item after DEF-092 and DEF-094). |
| Jira / GitHub | [AQP-482](https://sankumar76.atlassian.net/browse/AQP-482) / [#776](https://github.com/sankumar76/Accucut-Quotation/issues/776) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-125, agent-qa-engineer). Relates to AQP-1 and DEF-100 (AQP-457, #750). Searched first: no earlier Bug for this deviation (the unit add-ons were a line of DEF-100). |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; split and logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA read the seed and the form registry on `origin/master`, did not run the build |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
A unit beside the number input: mm on Length, Width, Thickness and Cutting Length; nos on QTY per Assy, No. of Bend, Weld and Fasteners Qty; holes on Drilling, Tapping and CSK; Rs / pc on Fasteners Cost.

## Build (what the ux-expert saw, and what QA read in the code)
A unit shows only where the seed has one: `prisma/seed/config/seed-config.ts` sets `unit` for Part Weight (`kg`, line 152) and Cutting Time (`sec`, line 156) only. **The four cost inputs (Fasteners Cost, Machining Cost, Plating Cost, Tool Cost) do have the rupee add-on** (`src/lib/estimate/form-fields.ts:54-57`), so STORY-05.04 (AQP-304) AC-2 is met.

## Ruling check
No ruling found. **Open point:** OQ-UX-07, input half, is still open in the UX spec (`ux-spec.md:1619`): "units beside inputs (mm, kg, sec) stay in the registry; the Admin confirms with the master data". The units in the mock-up are inferred from the formulas, so the unit list is a content decision (confirmed by the Admin or the delivery lead) before it is a build task. The fix is a registry (seed or configuration) change, not a component change.

## Proof (proposed; master and the ux-expert set it)
At 360, 768 and 1366 px each number input shows the confirmed unit beside it; the units come from the registry (no text hard-coded in the component); existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414 (2), DL-416 (4): Sev-3, lane 3 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-482 and GitHub issue #776, created 2026-11-26 and cross-linked. Related: AQP-1, DEF-100, AQP-303, AQP-304, AQP-388; DL-409 to DL-412, DL-414, DL-416; test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`.
