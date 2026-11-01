# ADR-004: Field registry as an immutable versioned document

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-020, 021, 072 to 079; NFR-026; SPEC §8; ADR-005, ADR-007 |

## Context
SPEC §8.1 describes `FieldDefinition` and §8.4 requires every change to create an immutable `ConfigVersion`, a snapshot of all fields and formulas. Checkpoints are named versions. Column letters are derived from position. Release 1 only seeds and reads the configuration; Release 2 edits it.

## Decision Drivers
- FR-077: every change gives an immutable version
- FR-078: revert restores the exact earlier configuration
- FR-075: re-lettering must follow automatically
- Simplicity: R1 must not build R2's editing tables

## Considered Options
### Option A — The snapshot is the only store: one validated JSON document per version
- Pros: immutability is trivial; revert copies a document into a new version; validation runs on the whole document; one row to read and cache; no mutable state to keep in step
- Cons: no SQL over fields, and a whole document is written per change
- Cost / effort: lowest

### Option B — Mutable `field_definitions` table plus snapshots
- Pros: matches SPEC's wording; SQL over fields
- Cons: two sources of truth; a snapshot step on every write; a bug can drift the two apart
- Cost / effort: medium

## Decision
We will store the configuration only as immutable rows in `config_versions`, each holding a zod-validated document of fields and sections. A change is a pure function `(document, edit) → document`, followed by whole-document validation (syntax, references, cycles), then one insert under an advisory lock. SPEC's `FieldDefinition` remains the element type, with added properties. Formulas use stable IDs for fields and rates.

**Added at UX reconciliation (architecture sections 4.5 and 16).** The screens need more than SPEC §8.1 lists:
- `engineerVisible`: true only for inputs and F; the schema refuses it elsewhere, including I, BH and BI.
- `rollupDisplay`: BG, BJ, BK.
- `systemRole`: `sl-no`, `quantity`, `unit-price`, `total`, `approved-price`. These fields cannot be deleted, and A and BO have no editable formula. `ROLLUP` finds H through this role, so the roll-up cannot lose its quantity.
- `unit`, `hint`, `formOrder`: form display. `formOrder` differs from column position, as section 08 shows AP, AU, BM, then AJ.
- `stageId`, `group`, `options`, `displayUnit`: SCR-07 and SCR-19.
- On sections and stages: `shortName`, display mode, and `totalFieldIds` for stage headings.

A field's references include formulas, `hideWhenZero`, `visibleWhen` and stage totals, and a delete checks all four. The latest version is the highest `number`. A checkpoint points to a version. Revert inserts a copy as a new version, so history stays linear and a revert can itself be undone.

The compiled plan is cached in process by version ID. A version never changes, so the cache needs no invalidation.

## Consequences
- Positive: R1 has versioning from day one at almost no cost. FR-077 and FR-078 become small. A version is impossible to edit, with a trigger as backstop.
- Negative / trade-offs accepted: the "used by" list is computed from the document rather than queried, which is cheap at about 70 fields.
- Follow-up actions (with owners): developer writes the seed from SPEC §7, with headers, widths and formats read from the sample as structure only (no cell values).

## Verification
SPEC §14 items 6, 7 and 8. Property test: for random inserts and deletes, seeded formulas give the same results. Direct `UPDATE` on `config_versions` is refused.
