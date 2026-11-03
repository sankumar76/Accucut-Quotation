/**
 * Seed configuration: the SPEC section 7 field registry. Structure only (headers, formulas, widths and
 * formats), never master data. Committed, because its formulas are already public in the SPEC
 * (ADR-014, ASSUMPTION-46). The registry is `seed-config.ts`; the fixed IDs of the 15 seed Process Master
 * items are `seed-ids.ts`.
 */
export { SEED_VERSION_REASON, seedConfig } from './seed-config';
export { SEED_PROCESS_ITEMS, type SeedProcessItem } from './seed-ids';
