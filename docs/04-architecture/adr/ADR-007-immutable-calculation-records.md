# ADR-007: Immutable calculation records

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-031, 061, 062, 063, 065, 068; NFR-007, 026; D-07; ADR-004 |

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

`approvals` references the calculation that was approved. Approved screens and exports read that record and never read live masters. Staleness is `estimates.inputs_revision <> calculations.inputs_revision`. Approval requires the caller's `calculationId` to be current, so a Lead cannot approve figures that changed under them.

## Consequences
- Positive: the guarantee rests on a database rule, not on code never making a mistake. Unlock notices are a plain diff.
- Negative / trade-offs accepted: no pruning (TD-03) until Q-26 gives a policy. Images referenced by a record are never deleted.
- Follow-up actions (with owners): review growth once real volumes exist.

## Verification
Regression test: approve, then change a process rate, a material price, an exchange rate and a formula; screen values and export values are identical. Direct `UPDATE` on `calculation_rows` is refused.
