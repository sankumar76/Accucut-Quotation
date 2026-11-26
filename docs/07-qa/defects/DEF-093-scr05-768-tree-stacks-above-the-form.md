# DEF-093: SCR-05 at 768 px: the parts tree stacks full-width above the form under "Hide parts tree"; the design is a collapsible left panel beside the form (conformance; closed as designed; Jira AQP-450, GitHub #743)

| Field | Value |
|-------|-------|
| Story / AC | AQP-302, AQP-388 (CR-01 item 1), AQP-426; SCR-05 (768 px); the ux-expert's batch 1, item A. The mock-up and spec text quoted below. |
| Severity | **Not a defect (master, DL-414 (2) / DL-416 (2)); closed.** QA had proposed Sev-3. |
| Priority | none (closed) |
| Type | **Not a defect** (as designed) |
| Status | **Closed 2026-11-26 (qa-engineer), as designed (24 Nov item-15 ruling, built as AQP-426 AC-11).** |
| Jira / GitHub | [AQP-450](https://sankumar76.atlassian.net/browse/AQP-450) / [#743](https://github.com/sankumar76/Accucut-Quotation/issues/743) (labels bug, sev-3, closed; ai-delivery, final-review, conformance; Jira also aiid-DEF-093, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Spec SCR-05 Responsive: '768: tree is a collapsible left panel, 2 columns'; the mock-up at 768 shows the panel beside the form.

## Build (what the ux-expert saw)
The tree stacks full width above the form under a 'Hide parts tree' bar; the form is one column.

## Ruling check
**Closed as designed, 2026-11-26 (master, DL-414 (2)).** The ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md` (item 15) says "Below 1024 px (tablet 768 to 1023: the tree is the stacked, openable panel above the form ...)". It was built as AQP-426 AC-11 and is newer than the SCR-05 mock-up (AQP-426: "where the mock-up and the ruling differ, the ruling wins"). QA's "no ruling found" was wrong and is corrected. The mock-up follows in the G8-C-UX05 hand-over. If the ux-expert now wants a side panel at 768 px, that is a design change near the freeze and goes to the delivery lead.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414 (2): not a defect, as designed |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | 2026-11-26 | Closed: as designed (24 Nov item-15 ruling, built as AQP-426 AC-11). |

## Records
Jira Bug AQP-450 and GitHub issue #743, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
