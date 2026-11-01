# ADR-005: Custom formula engine on decimal.js

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-022, 023, 026, 027, 028; NFR-008, 025; CONSTRAINT-02; ADR-004, ADR-006 |

## Context
SPEC §2 and §8.2 require a custom tokenizer, parser and evaluator with no `eval`, and exact arithmetic. Operands include column letters, rate names with spaces and `%`, `Material-*`, exchange-rate names and numbers.

## Decision Drivers
- CONSTRAINT-02: no `eval` or `new Function`
- Coding standards: no floats for money; pure functions; at least 95 % coverage on `lib/formula/**`
- NFR-008: 500 nodes in under 2 s
- FR-026: a division by zero never stops a calculation
- Formula text must never reach a client bundle (NFR-002)

## Considered Options
### Option A — Hand-written tokenizer and Pratt parser, tree-walking evaluator over decimal.js
- Pros: small; exact control over names with spaces and `%`, errors with positions, `null` semantics, stable IDs; no dependency beyond decimal.js
- Cons: code to own and test
- Cost / effort: included in EPIC-03

### Option B — A general-purpose expression library (for example mathjs, hot-formula-parser)
- Pros: less parser code
- Cons: wide feature surface to sandbox, and floats by default in some; custom names, internal form and `ROLLUP` would still need work; SPEC asks for a custom engine
- Cost / effort: similar, with more risk

## Decision
We will write the engine in `src/lib/formula/`, as pure, `server-only` code. Decimal is configured once in `lib/decimal.ts`: precision 34, half-up rounding, which matches Excel's rounding of a displayed value. The value type is `Decimal | null`; `null` means divide by zero and spreads through operators, `SUM` and `ROLLUP` (A-07). Rate names ending in ` %` are divided by 100 in the resolver, in one place (FR-028). Evaluation order comes from a topological sort, row-scope fields first and then product-scope fields. A row-scope formula that refers to a product-scope field is refused.

Functions: `SUM`, `MIN`, `MAX`, `ROUND`, `IF`, plus the new `ROLLUP(column)`, valid only in product scope (ADR-006).

## Consequences
- Positive: no dynamic execution path exists; errors are precise enough for SCR-18's messages.
- Negative / trade-offs accepted: Excel works in 15-digit doubles, so a value can differ from Excel beyond the fifteenth digit. The acceptance test compares to 2 decimals (SPEC §14.2).
- Follow-up actions (with owners): product-manager adds `ROLLUP` to FR-022 and SPEC §8.2 as text alignment.

**Feasibility (Evidence, 2026-11-01).** Tree-walking over decimal.js at precision 34, shaped like the seed (45 outputs of 3 operators each), took p95 136 to 153 ms for 500 nodes over 20 runs on an Intel i7-10510U with Node 24. It leaves over 1.8 s of the NFR-008 budget for database work. The real parser and I/O are not included, and the target host differs.

## Verification
Unit tests per operator and function; coverage thresholds; code search for `eval`; timed 500-node test (NFR-008).
