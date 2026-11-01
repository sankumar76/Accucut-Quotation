# Process: As-Is to To-Be — Estimation and Quotation

| Field | Value |
|-------|-------|
| Version | 0.4 (Pass 3: the delivery lead's own-words answers applied) |
| Author | business-analyst |
| Date | 2026-11-01 (Pass 1: 2026-10-31) |

**Status of the as-is:** The inputs describe the worksheet and the target process but not how work is done today. The as-is steps below are **inferred** (ASSUMPTION-28) from the Draft v5 document and the worksheet structure and must be confirmed in the walk-through requested in Q-28. No pain-point figure is given because none was supplied (Q-24).

## 1. As-is (inferred)

| # | Step | Who | Tool | Pain point (inferred, not evidenced) |
|---|------|-----|------|--------------------------------------|
| A1 | A request for a quotation arrives with drawings and documents, held in a network folder | Admin or Lead | Network folder | No record of who asked whom, nor deadline in a system |
| A2 | The estimate is assigned to an engineer | Admin or Lead | Not known (Q-28) | Progress and lateness are not visible in one place |
| A3 | The engineer fills the Excel worksheet, one row per item, part or sub-part, columns A to BO | Engineer | Excel | Same file holds rates, formulas and results, so cost cannot be hidden from the engineer |
| A4 | Formulas calculate costs; rates, specific gravity and percentages are typed inside the formulas | Excel | Excel | Hard-coded constants in every row make rate changes error-prone |
| A5 | A lead or admin reviews the result and sets the final price | Lead or Admin | Excel | No lock, no audit of who changed what |
| A6 | The finished sheet is sent on / kept as a file | Lead or Admin | File | Versions can diverge |

## 2. To-be (from SPEC §5, §6, §8, §10)

| # | Step | Who | Change from as-is | Requirement IDs |
|---|------|-----|-------------------|-----------------|
| T1 | Assign a task: choose Engineer, enter the network folder path and an IST deadline; an e-mail goes to the Engineer (Cc assigner) when alerts are ON | Admin or Lead | Assignment is recorded, dated and visible in queues | UR-004, BR-041 |
| T2 | Open the task from the Engineer's queue; open the folder via the link or copy the path | Engineer | Work arrives in a queue sorted by deadline | UR-005, UR-006 |
| T3 | Choose the customer first | Engineer | Customer rates are selected, not typed | UR-012 |
| T4 | Build the product tree (one product per estimate) and fill the guided form, section by section, each field showing its Excel letter; enter Tool Cost with the other inputs; enter 0 for anything a part, including a parent assembly, does not need (and choose "Not applicable" in the Material and Treatment lists; confirmed) | Engineer | Guided form replaces the grid; costs are never shown; no "Not needed" switch | UR-013 to UR-021, UR-040, UR-043, BR-048 |
| T5 | Save at any time; autosave | Engineer | Work is never lost | UR-022 |
| T6 | Calculate: the portal checks every field, flags gaps, then calculates and submits for review; the Engineer sees only the standard message | Engineer | Cost is calculated on the server from masters, not typed in formulas | UR-023, BR-007, BR-015 to BR-023 |
| T7 | Review the cost details with formulas; the cost of a parent is the sum of the costs of all its children multiplied by the item quantity (confirmed as corrected); edit inputs or recalculate if needed | Lead or Admin | Formulas visible and the same for everyone; parent and child rule (confirmed; roll-up details closed, Q-32, D-12) | UR-025 to UR-027, UR-038, BR-046, BR-047 |
| T8 | Approve and lock: enter the Approved Quote Price (calculated or override); inputs become read-only; the task closes | Lead or Admin | Locked, logged price | UR-028, BR-011, BR-045 |
| T9 | Unlock when re-estimation is needed (with a reason); the task reopens; approved estimates are never affected by later changes (confirmed); recalculation uses current rates and shows a notice if they changed (confirmed) | Lead or Admin | Controlled change path | UR-029, BR-012 |
| T10 | Download the Excel export in the worksheet layout | Lead or Admin | Same layout, generated from the system | UR-030, BRQ-005 |
| T11 | If the deadline passes: the task is marked overdue, the bell count goes up, an e-mail goes at once and again each day at 11:00 AM IST | System | Late work is visible and chased | UR-008, UR-009, BR-042, BR-043 |
| T12 | Admin maintains masters, users, settings, fields and formulas, with checkpoints and a change history | Admin | Changes need no developer and are logged | UR-031 to UR-037 |

## 3. Process changes at a glance

| Aspect | As-is (inferred) | To-be |
|--------|------------------|-------|
| Who sees cost | Anyone with the file | Admin and Lead only, filtered on the server |
| Rates | Typed in formulas | Held in masters, per customer |
| Assignment and deadline | Not known | Recorded, queued, e-mailed |
| Approval | Not known | Recorded Approved Quote Price, lock, unlock with reason |
| Audit | None in the file | Who, when, before and after for key events |
| Output | The worksheet itself | Excel export replicating the worksheet |

## 4. Open points affecting the process
Answered in Pass 2 and Pass 3: Q-04 (one product per estimate), Q-05 to Q-08 (Engineer enters Tool Cost and BN divides by the total of all Tool Cost entries; enter 0 and choose "Not applicable"; approved estimates unaffected and recalculation with current rates; the cost of a parent = the sum of the costs of all children x the item quantity), Q-15 (closed), Q-29 (the date is a target for hand-over to testing and acceptance). Answered on 2026-11-01: Q-32 (roll-up details; (a) own-words confirmation requested, DL-006). Still open: Q-31 (where totals appear in the export), Q-18 (hosting details, G3), Q-34 (scope behind the completion date, G3 approval). Assumptions kept and confirmed on the orchestrator's list wording (AQP-1 comment 10441 (g), not their own words): Q-19 (edits after Calculate and return path), Q-20 (task changes), Q-25 (cut-over), Q-28 (the as-is stays inferred).
