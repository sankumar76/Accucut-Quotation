# DEF-131: a Lead cannot see the Engineer's input values while reviewing; the delivery lead overrides DL-306 for read-only viewing (Requirement change; Sev-2 proposed; Jira AQP-488, GitHub #798; fix due end of Sun 29 Nov 2026 for the demo on Mon 30 Nov)

| Field | Value |
|-------|-------|
| Story / AC | FR-064 (Must, R1): a Lead or Admin can see and correct an estimate's inputs; UX decision UD-1 ("SCR-06 reuses the same form for Lead and Admin"). **DL-306 (2026-11-22) waived the Lead or Admin edit part until after G8** (gap G8-C-FR064, listed as known in the release notes). **The delivery lead now overrides that waiver for read-only viewing only** (relayed by the orchestrator, 2026-11-27; master records it). Editing by a Lead or Admin stays waived. Related: DEF-109 (AQP-474, #760), closed as the accepted deviation of DL-306 on 26 Nov; this Bug supersedes that closure for the read-only part. |
| Severity | **Sev-2 Major, proposed by QA at the orchestrator's request; master grades.** Reason: a review path of the customer demo (Mon 30 Nov) cannot be done as the delivery lead expects, and a decision (DL-306) is being reversed in part. |
| Priority | P2 (Jira High); **fixed and verified by the end of Sun 29 Nov 2026**. |
| Type | **Requirement change (a delivery-lead override of DL-306); Product build.** Not a defect against the code as built to DL-306; filed as a Bug so it carries a severity, a lane and a proof. Master may re-type it. |
| Status | **Open (new), 2026-11-27.** Owner: **lane 2**. The ux-expert's ruling is due today as `docs/03-ux/rulings/lead-read-only-inputs-2026-11-27.md` (not read by QA when this was filed). |
| Jira / GitHub | [AQP-488](https://sankumar76.atlassian.net/browse/AQP-488) / [#798](https://github.com/sankumar76/Accucut-Quotation/issues/798) (labels bug, sev-2, ai-delivery, final-review, demo-2026-11-30; Jira also aiid-DEF-131, agent-qa-engineer). Relates to AQP-1, AQP-474 (DEF-109), FR-064, DL-306, G8-C-FR064. Searched first: JQL on `aiid-DEF-131` and 'input values'; a GitHub search: nothing. |
| Found by / date | The delivery lead, testing the demo; relayed by the orchestrator, 2026-11-27 |
| Build / commit | Production build of `master` `e3dc5b0b` (the demo build) |
| Environment | The delivery lead's demo install (production build). Not CI. |

## Steps to Reproduce
1. Sign in as a Lead (or Admin).
2. Open an estimate an Engineer has filled in and calculated (SCR-06, the cost review).
3. Look for the input values the Engineer entered, per part. They are not shown to the Lead.

## Expected Result
The delivery lead's words: "**Lead should be able to see the input values so they can review the output fields accordingly.**" A Lead **and an Admin** sees **every input value the Engineer entered, per part, read-only**, while reviewing, so the output figures can be checked against them.

## Actual Result
The Lead's review shows the calculated figures but not the Engineer's input values (the Lead's input form is not built, DL-306). The delivery lead reports it as a gap in the demo. QA has not run it.

## Evidence
- The delivery lead's report (relayed); DL-306 and G8-C-FR064; DEF-109's closure on 26 Nov. QA ran nothing.

## Acceptance for QA to verify (proposed; the ux-expert's ruling and master's record set the binding)
1. **Who sees it:** a Lead and an Admin see every input the Engineer entered for each part, read-only; the values match what the Engineer saved (read back from the same estimate). **An Engineer's own screens do not change**, and an Engineer gains no cost data (NFR-002): the role matrix, the identical-keys test and the canary scan run on any new route or view model.
2. **Read-only:** no field is editable and no save path is reachable from the Lead's view (no input, no autosave, no `PUT` from that screen); the Lead's existing actions (Unlock, Recalculate, approval, the price override) are unchanged.
3. **Every part, every field:** each part's inputs, including any field the Engineer left blank (shown as such) and fields hidden by a rule on the Engineer's form (for example Qty and Cost while Fasteners is 'None'); the part tree order and Sl. No agree with the review.
4. **Screen quality (the ux-expert's ruling sets the design):** three widths (360, 768, 1366 px) with no sideways scroll, axe clean, keyboard reachable, 44 px targets on touch, the UX spec's words.
5. **Regression:** the rest of SCR-06 (tiles, tree, 'How the total is built', approval dialog, export) unchanged; the whole Stage 12 and Stage 11 green on the PR.
6. **Record:** DEF-109 and G8-C-FR064 text in the release notes are updated by the product-manager (a Lead's read-only view is now built; editing stays waived).

## Suspected Area (leads, not findings; the design is the ux-expert's and the build is lane 2's)
SCR-06 (`src/app/estimates/[code]/...` review page and its view model), the Lead's inputs read route (DL-303 (3): the inputs route that accepts a save from a Lead or Admin is left as built; a read of the inputs for a Lead may already exist server-side), `src/components/features/estimate-*` (the part form's read-only mode).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Override recorded (DL-306 for read-only viewing) | master | | |
| UX ruling | ux-expert | | `docs/03-ux/rulings/lead-read-only-inputs-2026-11-27.md` |
| Graded (type, severity, lane) | master | | |
| Built and tested | developer (lane 2) | | |
| Verified on the rebuilt demo | qa-engineer | | |

## Records
Jira Bug AQP-488 and GitHub issue #798, created 2026-11-27 and cross-linked. Related: FR-064, UD-1, DL-306, G8-C-FR064, DEF-109 (AQP-474, #760), NFR-002, AQP-1; the demo of Mon 30 Nov; test plan 0.3.78.
