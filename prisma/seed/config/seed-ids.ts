/**
 * The 15 seed Process Master items of SPEC section 4.1 (D-38), with fixed IDs.
 *
 * Held once, here, so that the seed formulas can store `{{rate:<id>}}` before the `process_items` table
 * exists (architecture section 5.6, assumption A-1 of stories 03.01 and 02.01). Story 02.01's migration
 * inserts these 15 rows with these IDs and a default value of 0; a test there compares the rows with this
 * file. The IDs are opaque: nothing may be read into their digits.
 *
 * Names and units are structure and may be committed. **No rate value belongs in this file or anywhere in
 * the repository** (ADR-014): the Admin types the values in at first use.
 */

export interface SeedProcessItem {
  readonly id: string;
  /** The name a formula shows, exactly as SPEC section 4.1 spells it. */
  readonly name: string;
  readonly unit: string;
}

export const SEED_PROCESS_ITEMS: ReadonlyArray<SeedProcessItem> = [
  { id: '00000000-0000-4000-8000-000400000001', name: 'Cutting-Rate-per-Sec', unit: 'per second' },
  { id: '00000000-0000-4000-8000-000400000002', name: 'Bending-Rate-per-stroke', unit: 'per stroke' },
  { id: '00000000-0000-4000-8000-000400000003', name: 'Drilling-Tapping-Rate', unit: 'per hole' },
  { id: '00000000-0000-4000-8000-000400000004', name: 'Welding-rate-per-kg', unit: 'per kg' },
  { id: '00000000-0000-4000-8000-000400000005', name: 'Dip-Galvanizing-Cost-per-kg', unit: 'per kg' },
  { id: '00000000-0000-4000-8000-000400000006', name: 'Primer-rate-per-sqft', unit: 'per sq ft' },
  { id: '00000000-0000-4000-8000-000400000007', name: 'Shot-Blasting-rate-per-kg', unit: 'per kg' },
  { id: '00000000-0000-4000-8000-000400000008', name: 'Polishing-rate-per-sqin', unit: 'per sq in' },
  // Data only: no seed formula uses it (Plating Cost, AU, stays typed in; D-40, Q-42).
  { id: '00000000-0000-4000-8000-000400000009', name: 'Plating-rate-per-sqin', unit: 'per sq in' },
  { id: '00000000-0000-4000-8000-000400000010', name: 'Powder-rate-per-sqft', unit: 'per sq ft' },
  { id: '00000000-0000-4000-8000-000400000011', name: 'Foam Cost', unit: 'per sq ft' },
  { id: '00000000-0000-4000-8000-000400000012', name: 'Soft-Anodize-rate-per-sqin', unit: 'per sq in' },
  { id: '00000000-0000-4000-8000-000400000013', name: 'OH Profit %', unit: '%' },
  { id: '00000000-0000-4000-8000-000400000014', name: 'Transport %', unit: '%' },
  { id: '00000000-0000-4000-8000-000400000015', name: 'Inspection & Packing %', unit: '%' },
];
