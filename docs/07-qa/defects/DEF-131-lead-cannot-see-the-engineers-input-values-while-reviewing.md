# DEF-131: a Lead and an Admin cannot view and edit the Engineer's input values while reviewing; the delivery lead overrides DL-306 (corrected 2026-11-27: view AND edit) (Requirement change; Sev-2 proposed; Jira AQP-488, GitHub #798; fix due end of Sun 29 Nov 2026 for the demo on Mon 30 Nov)

| Field | Value |
|-------|-------|
| Story / AC | FR-064 (Must, R1): a Lead or Admin can see and correct an estimate's inputs; UX decision UD-1 ("SCR-06 reuses the same form for Lead and Admin"). **DL-306 (2026-11-22) waived the Lead or Admin edit part until after G8** (gap G8-C-FR064, listed as known in the release notes). **The delivery lead now overrides that waiver.** First relayed as read-only viewing (2026-11-27); **corrected the same day by the delivery lead: 'Lead and admin should be able to view and also EDIT the input fields'** (relayed by the orchestrator; master records it). So the whole of FR-064's 'see and correct inputs' is back in scope; the DL-306 waiver of the edit part no longer holds for the demo. Related: DEF-109 (AQP-474, #760), closed as the accepted deviation of DL-306 on 26 Nov; this Bug supersedes that closure (view and edit). |
| Severity | **Sev-2 Major, proposed by QA at the orchestrator's request; master grades (the edit part may justify a regrade).** Reason: a review path of the customer demo (Mon 30 Nov) cannot be done as the delivery lead expects, and a decision (DL-306) is being reversed. |
| Priority | P2 (Jira High). **Staging confirmed by the orchestrator, 2026-11-27: Row V (view, Stage 1) is lane 3, merge target the end of Sun 29 Nov 2026 for the rebuilt demo. Row E (edit, Stage 2) is lane 2, target Sun 29 Nov if it is safe, otherwise the end of Wed 2 Dec 2026 (the merge cut-off).** QA verifies each row on its own; the Bug closes when both are verified. |
| Type | **Requirement change (a delivery-lead override of DL-306); Product build.** Not a defect against the code as built to DL-306; filed as a Bug so it carries a severity, a lane and a proof. Master may re-type it. |
| Status | **Open (new), 2026-11-27; expected result corrected to view AND edit the same day; split into a view row (V) and an edit row (E) on 2026-11-27 after the ux-expert's ruling `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md` (records-u a50a4e1d; checks RO-1 to RO-18 and ED-1 to ED-17, mapped below).** Owners: **view lane 3, edit lane 2.** The architect's status rules (`docs/04-architecture/lead-admin-input-edit-2026-11-27.md`) are still to come and are not read by QA; Row E's ED-1, ED-7, ED-14 and ED-15 depend on them. |
| Jira / GitHub | [AQP-488](https://sankumar76.atlassian.net/browse/AQP-488) / [#798](https://github.com/sankumar76/Accucut-Quotation/issues/798) (labels bug, sev-2, ai-delivery, final-review, demo-2026-11-30; Jira also aiid-DEF-131, agent-qa-engineer). Relates to AQP-1, AQP-474 (DEF-109), FR-064, DL-306, G8-C-FR064. Searched first: JQL on `aiid-DEF-131` and 'input values'; a GitHub search: nothing. |
| Found by / date | The delivery lead, testing the demo; relayed by the orchestrator, 2026-11-27 |
| Build / commit | Production build of `master` `e3dc5b0b` (the demo build) |
| Environment | The delivery lead's demo install (production build). Not CI. |

## Steps to Reproduce
1. Sign in as a Lead (or Admin).
2. Open an estimate an Engineer has filled in and calculated (SCR-06, the cost review).
3. Look for the input values the Engineer entered, per part. They are not shown to the Lead.

## Expected Result
The delivery lead's first words: "**Lead should be able to see the input values so they can review the output fields accordingly.**", corrected to: "**Lead and admin should be able to view and also EDIT the input fields.**" A Lead **and an Admin** **views every input value the Engineer entered, per part, and can also edit those input fields**, while reviewing, so the output figures can be checked and corrected. What may be edited in each estimate status, and what an edit does to the calculated figures and the approval, is the architect's rule set (named in Status), not QA's.

## Actual Result
The Lead's review shows the calculated figures but neither the Engineer's input values nor a way to edit them (the Lead's input form is not built, DL-306). The delivery lead reports it as a gap in the demo. QA has not run it.

## Evidence
- The delivery lead's report (relayed); DL-306 and G8-C-FR064; DEF-109's closure on 26 Nov. QA ran nothing.

## Acceptance for QA to verify (mapped on 2026-11-27 to the ux-expert's ruling `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md`, records-u a50a4e1d; the architect's rules are still to come)
The ruling is the design and its checks are the acceptance. **View (Stage 1) is checked by RO-1 to RO-18, edit (Stage 2) by ED-1 to ED-17.** Each is verified on its own; DEF-131 is closed only when both rows are verified, and a stage can be verified and closed as its own row. **The developer names each test with its check ID** (`RO-n`, `ED-n`; QA's convention: tests carry the AC ID), and the E2E runs at 360, 768 and 1366 px in CI.

### Row V: Stage 1, the read-only view (lane 3; merge target the end of Sun 29 Nov 2026)
| Check | What QA verifies | How |
|-------|------------------|-----|
| RO-1, RO-2 | Rows are links; first row selected (`aria-current`); the address becomes `?row=<Sl. No>#row-inputs`; focus on the form title; one polite status `Showing the inputs of 1.4 Top cover. Read-only.` | E2E (Lead and Admin), role and status assertions |
| RO-3, RO-4, RO-5 | Every stored value equals the shown value by field ID (a seeded part with a value in every field, Treatment `Other`, chosen surface treatments, picture); `Not entered` for empty, `0` for 0, `None` for None; labels, column tags, units and order equal the Engineer's `/form` | E2E against the seeded part; a read-back by field ID |
| RO-6, RO-7, RO-8 | No edit control, no `PATCH`, no autosave request; picture shown without controls or `No picture`; surface treatments as chips or `None selected` | E2E with the network log; QA's negative probe: type into every field kind and check that nothing is sent |
| RO-9, RO-10, RO-11 | The notice words exact for DRAFT, PREPARED, APPROVED, QUOTED, Ignored (Ignored wins); the row line `This row: ...` for current, cleared and not-calculated figures, and the form holds no figure or rate; intro, hints (except QTY per Assy), messages and triangles not drawn; `n of m` counts stay | E2E at one width per state; text checks |
| RO-12 | **Engineer unchanged:** the Engineer's `/estimates/<code>` is SCR-05 as built, the island is not in the Engineer's bundle, the cost-confidentiality scan and `estimate-review-architecture.test.ts` stay green, another Engineer's `/form`, `/nodes/<id>` or the Lead's page gives the same 404 or 403 as before | CI scans (Stage 2 to 11b) plus QA's role matrix and identical-keys run on the new `?row` page and island |
| RO-13, RO-14 | Keyboard path and screen-reader names (region named by the title, `Excel column <letter>`, units as descriptions, `aria-current`) | E2E keyboard run; QA's manual screen-reader pass at the final regression (test plan section 12) |
| RO-15, RO-16 | Three widths with no sideways scroll, 1, 2, 2 or 3 columns, the tree sticky at 1366 and closed after a choice under 1024, 44 px touch targets; unknown `?row`, no rows, a failed read with **Try again**, the loading skeleton `role="status"` | E2E at three widths |
| RO-17, RO-18 | axe clean (no serious or critical) with the block open, Lead and Admin, three widths; SCR-07 `View inputs` link; "How the total is built" above the two columns | axe in E2E (`expectNoAxeViolations`) |
| QA additions | **No save path from the view** (nothing in the Lead's island can issue a write); an Admin gets the same view as a Lead; `?row=` of another estimate or an injected value opens the first row and leaks nothing; the whole of SCR-06, SCR-07 and the export unchanged; Stages 11 and 12 green on the PR | QA's probes, the PR run |

### Row E: Stage 2, editing by a Lead or an Admin (lane 2; target Sun 29 Nov 2026 if it is safe, otherwise the end of Wed 2 Dec 2026, the merge cut-off of DL-395)
| Check | What QA verifies | How |
|-------|------------------|-----|
| ED-1 | `editable` follows `canEditInputs(state, role)`: Lead and Admin edit DRAFT and PREPARED, are read-only (with the ruling's 4.2 words) in APPROVED, QUOTED and Ignored; the Engineer's rules unchanged | A unit test over every status and role, plus E2E |
| ED-2, ED-3, ED-4 | A save on leaving the field and after 30 s of autosave; the first change on current figures clears every figure (tiles `Cleared`, tree `Cleared`, Recalculate primary, Approve and Download disabled with reasons), focus stays in the field, the cleared status is announced once; a value equal after normalisation writes nothing and clears nothing | E2E; request log |
| ED-5, ED-6 | SCR-05's validation words (2 decimals, no negatives, 100 characters, the hidden-character message); Enter order, the last field to Recalculate without pressing it | E2E; the server rules unchanged (integration) |
| ED-7 | A value typed and Recalculate pressed without leaving the field: saved first, then calculated, the figures use it (**needs the shared save gate; the architect's A-4**) | E2E |
| ED-8, ED-9 | A conflict with an Engineer's save in DRAFT gives the keep-mine-or-use-newer notice and overwrites nothing; choosing another row commits a typed value first, an invalid value asks `Leave without saving?` | E2E with two sessions |
| ED-10, ED-11, ED-12 | Description renames the row after the refresh; a Lead's edit of a PREPARED estimate leaves it PREPARED, Approve enabled after Recalculate, an approved price and earlier audit untouched; a save after the estimate was approved or ignored elsewhere gets 409, the block turns read-only and the typed text stays | E2E; integration |
| ED-13, ED-16 | An Engineer sees the new value and no figure; no request an Engineer can make reaches the Lead's island or a Lead-only value; the Lead's tree has no add, delete or move control; the picture stays read-only | E2E; QA's role matrix and canary scan |
| ED-14, ED-15 | **Conditional on the architect (A-3, A-2):** one audit entry `Input change` with no rate or figure; `Last changed by` only after a Lead's or Admin's write | Per the architect's answer; if the answer is 'no', the check is dropped and the ruling's 2b stays open |
| ED-17 | axe clean at three widths with the block editable and a field error showing | axe in E2E |
| QA additions | **authZ matrix on the inputs route** (an Engineer of another estimate, an Engineer on a PREPARED estimate, a Lead, an Admin, signed-out; IDOR on estimate and part IDs): the Engineer cases refused as built, the Lead and Admin cases allowed only in DRAFT and PREPARED, a Lead's refused write in any other status changes nothing; **no input value, cost or reason in any log or error**; every server rule (validation, the quantity rule and warning) as the Engineer's; **the audit and the revision conflict** as the architect states them; the quantity warning on Recalculate unchanged | QA's probes on the route (integration) and on the demo build |

### Open points QA carries
- The architect's status rules (`docs/04-architecture/lead-admin-input-edit-2026-11-27.md`) are not in records-u yet: A-1 (statuses), A-2 (who last wrote), A-3 (audit event), A-4 (shared save gate), A-5 (a Recalculate refused for blank inputs), A-6 and A-7 of the ruling's section 6. **Row E's ED-1, ED-7, ED-14 and ED-15 depend on them;** if the architect's answer differs from the ruling's assumption, QA maps the architect's answer and says so here.
- The ruling is a design only: **nothing in it was seen running** (the ux-expert had no browser); QA's first reading is by the E2E in CI and a hand pass on the rebuilt demo.
- **Stage 3 is out** (the Material Rate / Kg (I) row, the 'This row' box, the Lead's tree actions): no check here; a Lead sees no rate or formula beside the inputs (RO-10).
- **Release notes:** the product-manager updates DL-306 and G8-C-FR064, the PRD FR-064 'waived' sentence, KG-1 and the workaround line (the ruling's 'Records' list).

## Suspected Area (leads, not findings; the design is the ux-expert's ruling, the view is lane 3's and the edit is lane 2's)
SCR-06 (`src/app/estimates/[code]/...` review page and its view model), the Lead's inputs read route (DL-303 (3): the inputs route that accepts a save from a Lead or Admin is left as built; a read of the inputs for a Lead may already exist server-side), `src/components/features/estimate-*` (the part form's read-only mode).

## Fix & Verification  _(developer / qa-engineer)_
| Row | Step | By | Date | Ref (commit / test) |
|-----|------|----|------|---------------------|
| both | Override recorded (DL-306 overridden in full: view and edit) | master | | decision log (master records it) |
| both | UX ruling | ux-expert | 2026-11-27 | `docs/03-ux/rulings/lead-admin-edit-inputs-2026-11-27.md` (records-u a50a4e1d) |
| E | Edit rules (status rules, audit, save gate) | solution-architect | | `docs/04-architecture/lead-admin-input-edit-2026-11-27.md` (to come) |
| both | Graded (type, severity, lane) | master | | |
| V | Built and tested (RO-1 to RO-18; tests named by check ID) | developer (lane 3) | | target end of Sun 29 Nov 2026 |
| V | Verified: CI run of record, then the rebuilt demo (hand pass at three widths, Lead and Admin) | qa-engineer | | |
| E | Built and tested (ED-1 to ED-17; ED-14 and ED-15 per the architect) | developer (lane 2) | | target Sun 29 Nov if safe, else end of Wed 2 Dec 2026 |
| E | Verified: CI run of record, the authZ matrix on the inputs route, then the rebuilt demo | qa-engineer | | |
| both | Release notes: DL-306, G8-C-FR064, PRD FR-064 'waived', KG-1, workaround line | product-manager | | |

## Records
Jira Bug AQP-488 and GitHub issue #798, created 2026-11-27 and cross-linked. Related: FR-064, UD-1, DL-306, G8-C-FR064, DEF-109 (AQP-474, #760), NFR-002, AQP-1; the demo of Mon 30 Nov; test plan 0.3.80.
