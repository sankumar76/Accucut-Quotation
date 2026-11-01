# ADR-003: PostgreSQL and Prisma, with JSONB for configurable values

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-020, 027, 074, 075; NFR-008, 026; ADR-004, ADR-007, ADR-008 |

## Context
PostgreSQL and Prisma are fixed by the stack. The open question is how to store per-node values, when the Admin can insert and delete fields at run time (FR-074) and every estimate stays readable under its own configuration (FR-065). A node has about 67 columns today.

## Decision Drivers
- FR-074: adding a field must not need a schema migration, and the Admin has no developer
- NFR-026: older estimates remain exact
- NFR-008: 500 nodes load and save in well under 2 s
- FR-027: full precision; no floats
- No query filters on individual field values are required by any FR

## Considered Options
### Option A — JSONB document per node, keyed by stable field ID, values as decimal strings
- Pros: new fields need no migration; a node loads in one row; old keys survive a field delete; exact decimal strings
- Cons: no column-level types or foreign keys inside the document, so validation lives in the application; a corrupt key is not caught by the database
- Cost / effort: low

### Option B — Entity-attribute-value table
- Pros: relational; can index by field
- Cons: about 67 rows per node, so 33,500 rows per 500-node estimate read and written on each save or calculation; awkward pivoting; values still need a generic type
- Cost / effort: medium, and slower

### Option C — One wide table with a column per field
- Pros: real types and constraints
- Cons: the Admin's insert becomes DDL at run time, which needs rights the runtime must not have, and history breaks
- Cost / effort: high and unsafe

## Decision
We will use normalised tables for everything with a fixed shape (users, masters, tasks, approvals) and JSONB for configurable per-node values: `estimate_nodes.inputs`, and `calculation_rows.inputs`, `outputs` and `rollup`. Values are decimal strings at 34 significant digits. Zod schemas check documents at the repository boundary. Master values stay `Decimal(18,4)`.

Prisma 7 needs the `prisma-client` generator, a required `output` path, `prisma.config.ts` and `@prisma/adapter-pg`. Partial indexes, triggers and grants are hand-written SQL in migrations. `prisma` must be pinned exactly, because its npm `latest` tag points at a release candidate (Evidence, npm, 2026-11-01).

## Consequences
- Positive: field insert is a configuration change, not a migration. One indexed read loads a tree.
- Negative / trade-offs accepted: integrity inside JSONB is the application's job. Reporting across field values would need extraction; none is required today.
- Follow-up actions (with owners): master rules on the `Decimal(18,4)` standard against FR-027 (architecture section 16); developer adds repository-level schema parsing.

## Verification
Timed 500-node load and save. Round-trip test of decimal strings. A field insert test that runs no migration.
