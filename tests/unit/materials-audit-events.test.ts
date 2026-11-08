import { describe, expect, it } from 'vitest';

import { AUDIT_EVENTS, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';
import { createAuditService } from '@/server/services/audit-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.03 T2 (AC-5): the Material Master raises the generic master events (`master.created`, `master.edited`) with `object_type`
 * `material`, as architecture section 8 rules (AQP-74); AC-5's `master.material.*` is read with that ruling. One test for the shape of what
 * they keep, the words the audit screen shows, and what `object_type` they may carry. Names and numbers are invented (`n.37`), except inputs that test the format.
 */

const SHEET = {
  materialInDrawing: 'Invented-sheet-grade-A',
  materialConsidered: 'Invented steel',
  pricePerKg: '58.37',
  specificGravity: '7.37',
  scrapRate: '22.37',
};
const FOAM_RATE = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' };
const ACTOR = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const OBJECT = { id: '00000000-0000-4000-8000-000500000c01', label: 'Invented-sheet-grade-A' } as const;

const wordsOf = (name: AuditEventName, before: unknown, after: unknown, objectType = 'material') => AUDIT_EVENTS[name].describeStored(before, after, objectType);

describe('master.created / master.edited for a material (AC-5)', () => {
  it('say what was added and edited in one line of words: names, then each number with its label', () => {
    const line = 'Invented-sheet-grade-A, Invented steel, Price per kg ₹ 58.37, Specific gravity 7.37, Material-Scrap-Rate (per kg) ₹ 22.37';
    expect(wordsOf('master.created', null, SHEET)).toEqual({ before: 'Not added', after: line });
    expect(wordsOf('master.edited', SHEET, { ...SHEET, scrapRate: '23.37' })).toEqual({
      before: line,
      after: 'Invented-sheet-grade-A, Invented steel, Price per kg ₹ 58.37, Specific gravity 7.37, Material-Scrap-Rate (per kg) ₹ 23.37',
    });
  });

  it('still says a rate in the words of the Process Master: the two shapes share no key', () => {
    expect(wordsOf('master.created', null, FOAM_RATE, 'process_item')).toEqual({ before: 'Not added', after: 'Foam Cost, ₹ per sq ft, 21.37' });
    expect(wordsOf('master.deleted', FOAM_RATE, null, 'process_item')).toEqual({ before: 'Foam Cost, ₹ per sq ft, 21.37', after: 'Deleted' });
  });

  it('chooses the words by the entry\'s object type, never by the keys (STD-05): a state under the other master\'s type, or under an unknown one, shows a dash', () => {
    // A material described as a rate, and a rate described as a material, are not described at all.
    expect(wordsOf('master.created', null, SHEET, 'process_item')).toEqual(NO_DETAIL);
    expect(wordsOf('master.edited', SHEET, SHEET, 'process_item')).toEqual(NO_DETAIL);
    expect(wordsOf('master.created', null, FOAM_RATE, 'material')).toEqual(NO_DETAIL);
    expect(wordsOf('master.deleted', SHEET, null, 'master')).toEqual(NO_DETAIL);
    expect(wordsOf('master.deleted', SHEET, null, 'customer')).toEqual(NO_DETAIL);
    // The same state under its own type is described.
    expect(wordsOf('master.deleted', SHEET, null)?.after).toBe('Deleted');
  });

  it('gives no words for stored values that do not fit (a missing field, an extra key, a number of the wrong shape)', () => {
    const withoutScrap = Object.fromEntries(Object.entries(SHEET).filter(([field]) => field !== 'scrapRate'));
    expect(wordsOf('master.created', null, withoutScrap)).toBeNull();
    expect(wordsOf('master.created', null, { ...SHEET, passwordHash: '$argon2id$x' })).toBeNull();
    expect(wordsOf('master.edited', SHEET, { ...SHEET, pricePerKg: 'dear' })).toBeNull();
    expect(wordsOf('master.edited', SHEET, { ...SHEET, ...FOAM_RATE })).toBeNull();
  });
});

describe('the audit service keeps a material entry with its own object type', () => {
  it('stores object_type material when the caller names it, and the whole material as the after value', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    await world.transactions.run((tx) =>
      service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: SHEET, objectType: 'material' }),
    );
    expect(world.audit.committed.map((row) => [row.event, row.objectType, row.objectLabel, row.after])).toEqual([
      ['master.created', 'material', 'Invented-sheet-grade-A', SHEET],
    ]);
  });

  it('shows a material entry in the words of a material and a rate entry in the words of a rate, each by its own object type (STD-05)', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    await world.transactions.run(async (tx) => {
      await service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: SHEET, objectType: 'material' });
      await service.record(tx, { ...ACTOR, event: 'master.created', object: { id: OBJECT.id, label: 'Foam Cost' }, before: null, after: FOAM_RATE, objectType: 'process_item' });
    });
    const page = await service.list({ limit: 10 });
    expect(page.entries.map((entry) => [entry.objectLabel, entry.change.after])).toEqual([
      ['Foam Cost', 'Foam Cost, ₹ per sq ft, 21.37'],
      ['Invented-sheet-grade-A', 'Invented-sheet-grade-A, Invented steel, Price per kg ₹ 58.37, Specific gravity 7.37, Material-Scrap-Rate (per kg) ₹ 22.37'],
    ]);
  });

  it('refuses a material whose numbers do not fit, and keeps nothing', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(
      world.transactions.run((tx) =>
        service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: { ...SHEET, pricePerKg: 'dear' }, objectType: 'material' }),
      ),
    );
    expect(error).toMatchObject({ reason: 'shape' });
    expect(world.audit.committed).toHaveLength(0);
  });
});
