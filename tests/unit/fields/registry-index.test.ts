import { describe, expect, it } from 'vitest';

import {
  findFieldById,
  findFieldByKey,
  findSystemField,
  referenceContext,
} from '@/lib/fields/registry';

import { defined } from '../../support/defined';
import { cloneSeedConfig, SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * PRF-04: the lookups the formula engine and the export call per row are built once per document and
 * answered from maps. A document is immutable (a stored version, or the frozen seed), so the index is
 * never stale.
 */

describe('registry lookups are indexed once per document (PRF-04)', () => {
  it('the reference context reuses the same field ID list for the same document', () => {
    const first = referenceContext(seedConfig, SEED_PROCESS_ITEMS);
    const second = referenceContext(seedConfig, SEED_PROCESS_ITEMS);
    expect(second.fieldIds).toBe(first.fieldIds);
    expect(first.fieldIds).toHaveLength(67);
  });

  it('answers by id, by key and by role from the same index, with the document\'s own objects', () => {
    const quantity = seedFieldAt('H');
    expect(findFieldById(seedConfig, quantity.id)).toBe(quantity);
    expect(findFieldByKey(seedConfig, quantity.key)).toBe(quantity);
    expect(findSystemField(seedConfig, 'quantity')).toBe(quantity);
  });

  it('keeps one index per document: a copy with a renamed key is answered from its own fields', () => {
    const copy = cloneSeedConfig();
    // Index the original first, so a shared (wrong) index would still say "qty-per-assy".
    expect(findFieldByKey(seedConfig, 'qty-per-assy')).toBeDefined();
    defined(copy.fields.find((field) => field.key === 'qty-per-assy')).key = 'order-count';
    expect(findFieldByKey(copy, 'order-count')).toBeDefined();
    expect(findFieldByKey(copy, 'qty-per-assy')).toBeUndefined();
    expect(findFieldByKey(seedConfig, 'qty-per-assy')).toBeDefined();
  });

  it('is fast enough for a per-row loop: 67,500 lookups of the last field', () => {
    const last = seedFieldAt('BO');
    const started = performance.now();
    for (let call = 0; call < 67_500; call += 1) findFieldById(seedConfig, last.id);
    // Linear scans took about 125 ms for this loop; map lookups take a few milliseconds. The bound is loose.
    expect(performance.now() - started).toBeLessThan(100);
  });
});
