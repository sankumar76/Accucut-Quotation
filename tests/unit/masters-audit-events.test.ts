import { describe, expect, it } from 'vitest';

import { AUDIT_EVENTS, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';
import { createAuditService } from '@/server/services/audit-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.01 T2 (AC-5): the three events of the Process Master, one test each as the registry requires of a wired event: the shape
 * of what they keep, the words the audit screen shows for them, and what `object_type` the generic master events may carry. Names and
 * numbers are invented (`n.37`).
 */

const FOAM = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' };
const PERCENT = { name: 'OH Profit %', unit: '%', defaultValue: '11.37' };
const ACTOR = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const OBJECT = { id: '00000000-0000-4000-8000-000400000011', label: 'Foam Cost' } as const;

const wordsOf = (name: AuditEventName, before: unknown, after: unknown) => AUDIT_EVENTS[name].describeStored(before, after);

describe('master.created / master.edited / master.deleted (AC-5)', () => {
  it('are wired, in the "Master data edit" category, and belong to the generic master subject', () => {
    for (const name of ['master.created', 'master.edited', 'master.deleted'] as const) {
      expect(AUDIT_EVENTS[name]).toMatchObject({ status: 'wired', category: 'master_data', objectType: 'master' });
    }
  });

  it('says what was added, edited and deleted in one line of words: name, unit and value', () => {
    expect(wordsOf('master.created', null, FOAM)).toEqual({ before: 'Not added', after: 'Foam Cost, ₹ per sq ft, 21.37' });
    expect(wordsOf('master.edited', FOAM, { ...FOAM, defaultValue: '22.37' })).toEqual({
      before: 'Foam Cost, ₹ per sq ft, 21.37',
      after: 'Foam Cost, ₹ per sq ft, 22.37',
    });
    expect(wordsOf('master.deleted', FOAM, null)).toEqual({ before: 'Foam Cost, ₹ per sq ft, 21.37', after: 'Deleted' });
  });

  it('writes a percentage rate with a percent sign and a unit of "%"', () => {
    expect(wordsOf('master.edited', PERCENT, { ...PERCENT, defaultValue: '12.37' })).toEqual({ before: 'OH Profit %, %, 11.37 %', after: 'OH Profit %, %, 12.37 %' });
  });

  it('gives no words for stored values that do not fit (an older shape, a damaged row), and the screen shows a dash', () => {
    expect(wordsOf('master.created', FOAM, FOAM)).toBeNull();
    expect(wordsOf('master.edited', { name: 'Foam Cost' }, FOAM)).toBeNull();
    expect(wordsOf('master.edited', FOAM, { ...FOAM, defaultValue: 'many' })).toBeNull();
    expect(wordsOf('master.deleted', FOAM, FOAM)).toBeNull();
    expect(NO_DETAIL).toEqual({ before: '—', after: '—' });
  });

  it('names its fields, so a secret has no place to go: an extra key on any side makes the values not fit', () => {
    const withHash = { ...FOAM, passwordHash: '$argon2id$x' };
    expect(wordsOf('master.created', null, withHash)).toBeNull();
    expect(wordsOf('master.edited', withHash, FOAM)).toBeNull();
    expect(wordsOf('master.edited', FOAM, withHash)).toBeNull();
    expect(wordsOf('master.deleted', withHash, null)).toBeNull();
  });
});

describe('the object type of a master event (architecture section 8, AQP-74 ruling)', () => {
  const record = async (object: { objectType?: string }) => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    await world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: FOAM, ...object }));
    return world;
  };

  it('is the master the caller names, for a generic master event', async () => {
    const world = await record({ objectType: 'process_item' });
    expect(world.audit.committed.map((row) => row.objectType)).toEqual(['process_item']);
  });

  it('is "master" when the caller names none', async () => {
    const world = await record({});
    expect(world.audit.committed.map((row) => row.objectType)).toEqual(['master']);
  });

  it.each(['', 'Process Item', 'process-item', 'PROCESS_ITEM', '_item', 'x'.repeat(41), 'item1'])('refuses %j, which is not lower snake case', async (objectType) => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'master.created', object: OBJECT, before: null, after: FOAM, objectType })));
    expect(error).toMatchObject({ reason: 'shape', where: 'objectType' });
    expect(world.audit.committed).toEqual([]);
  });

  it('is refused for an event that has a subject of its own', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    const error = await refusal(
      world.transactions.run((tx) => service.record(tx, { ...ACTOR, event: 'user.created', object: OBJECT, before: null, after: { role: 'ENGINEER', isActive: true }, objectType: 'process_item' })),
    );
    expect(error).toMatchObject({ reason: 'shape', where: 'objectType' });
  });
});
