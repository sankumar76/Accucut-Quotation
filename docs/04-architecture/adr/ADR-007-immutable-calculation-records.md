# ADR-007: Immutable calculation records

| Field | Value |
|-------|-------|
| Status | Proposed. Revised for v0.3 (D-18, D-20) |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-031, 061, 062, 063, 065, 068, 100, 101, 103; NFR-007, 026; D-07, D-18, D-20; Q-37; ADR-004, ADR-012 |

## Context
An approved estimate must keep the fields, formulas, rates, master values and results it was approved with, whatever changes later (AQP-8). Each calculation must record the configuration version and every master value used. Recalculation after an unlock uses current values and shows a notice. Export is allowed at any status.

## Decision Drivers
- FR-065, NFR-026: screen and export of an approved estimate never change
- FR-031: full record per calculation
- FR-063: detect what changed since approval
- Consistency: a screen or export must never mix inputs from one moment with results from another

## Considered Options
### Option A — Each calculation writes an immutable record: a header plus a full copy of the tree as calculated
- Pros: approved views read one record and need nothing live; export is consistent by construction; comparing snapshots gives the notices directly
- Cons: storage grows with each recalculation (about 1 to 2 KB per node)
- Cost / effort: low

### Option B — Store only the latest results on the nodes, plus a rate snapshot
- Pros: less storage
- Cons: results and inputs can be out of step; history is lost; the "pinned" guarantee would rest on never touching rows
- Cost / effort: low now, high in defects

### Option C — Temporal history tables for masters, and reconstruct at read time
- Pros: elegant
- Cons: every master read becomes time-travel, and a bug changes an approved price silently
- Cost / effort: high

## Decision
Every Calculate and Recalculate inserts one `calculations` row (configuration version, `inputs_revision`, `master_snapshot`, product values, item totals) and one `calculation_rows` row per node (tree position, Sl. No, inputs, image reference, `outputs`, `rollup`), in one transaction under the estimate row lock. Triggers refuse `UPDATE` and `DELETE`, and the runtime role has no such grants. `master_snapshot` holds only the rates, materials and exchange rates used, with their names at that time.

`approvals` references the calculation that was approved. Approved screens and exports read that record and never read live masters. Approval requires the caller's `calculationId` to be current, so a Lead cannot approve figures that changed under them.

**Added at UX reconciliation.** `calculation_rows.inputs` holds resolved display text for E, F and G, not IDs. Without this, renaming a material or treatment (SCR-13) would change an approved estimate's screen and export. A price is an override only if it differs from BL rounded to 2 decimals (A-12). SCR-08 pre-fills the rounded value while BL holds more digits, so an exact comparison would record a false override whenever a Lead accepts the pre-filled price. After an unlock the estimate stays linked to its last calculation, so SCR-06 can show those figures until a recalculation or an input change (UX-04).

**Added for v0.3: cleared totals (D-20).** "Clear the total cost when any input is updated" sits against this ADR: a record cannot be changed, and an approved one must survive. So clearing is a rule on reading, not a write. `lib/estimate/figure-state.ts` compares `estimates.inputs_revision` with the calculation's, and gives `none`, `current` or `out-of-date`. Any real input change bumps the revision, in its own transaction: values including Remarks, the customer, images, and adding, deleting, moving or reordering a part. A save with no real change does not, so autosave cannot clear a total. While `out-of-date`, the server withholds BL, BN, the price pre-fill, the Tool Cost total, item totals and every Σ figure, because T(item) is a share of BL and with one item it is BL. A row's own values stay, marked (ASSUMPTION-55, Q-37). Approval is refused with 409 under the row lock. Considered and rejected: nulling `current_calculation_id`, which loses the row costs ASSUMPTION-55 keeps and the figures an unlock shows; and a client-side hide, which is not a clear.

**Added for v0.3: reason and current price.** `approvals.override_reason` is optional (D-18) and copied to the audit row. The price approved before an unlock stays in its `approvals` row. Only a row with `unlocked_at` null is the current price.

## Consequences
- Positive: the guarantee rests on a database rule, not on code never making a mistake. Unlock notices are a plain diff.
- Negative / trade-offs accepted: no pruning (TD-03) until Q-26 gives a policy. Images referenced by a record are never deleted.
- Follow-up actions (with owners): review growth once real volumes exist.

## Verification
Regression test: approve, then change a process rate, a material price, an exchange rate and a formula; screen values and export values are identical. Direct `UPDATE` on `calculation_rows` is refused. Every kind of input change clears the figures, and a repeated save does not (`test-strategy.md` section 9).
