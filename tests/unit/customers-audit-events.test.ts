import { describe, expect, it } from 'vitest';

import { AUDIT_EVENTS, MASTER_SHAPES, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';
import { createAuditService } from '@/server/services/audit-service';

import { createFakeAuditWorld } from '../support/fake-audit';

/**
 * STORY-02.02 T2 (AC-6): the Customer Master raises the generic master events (`master.created`, `master.edited`) with `object_type` `customer`, as
 * architecture section 8 rules (AQP-142, v0.37; AC-6 was drafted as `master.customer.*`). The shape of what they keep (`{ name, contact, rates }`, contact
 * fields by name and never by value, only the rates that changed), the words the audit screen shows, and that the words are chosen by the entry's object
 * type. Names and numbers are invented (`n.37`).
 */

const CUTTING = { processItemId: '00000000-0000-4000-8000-000400000001', name: 'Cutting-Rate-per-Sec', unit: 'per second', value: '1.37' };
const OH_PROFIT = { processItemId: '00000000-0000-4000-8000-000400000013', name: 'OH Profit %', unit: '%', value: '11.00' };
const CREATED = { name: 'Invented Works', contact: ['phone', 'email'], rates: [CUTTING, OH_PROFIT] };
const ACTOR = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const OBJECT = { id: '00000000-0000-4000-8000-000800000c01', label: 'Invented Works' } as const;

const WORDS = (name: AuditEventName, before: unknown, after: unknown, objectType = 'customer') => AUDIT_EVENTS[name].describeStored(before, after, objectType);

const attempt = async (event: 'master.created' | 'master.edited', objectType: string, before: unknown, after: unknown) => {
  const world = createFakeAuditWorld();
  const service = createAuditService({ audit: world.audit });
  const error = await world.transactions
    .run((tx) => service.record(tx, { ...ACTOR, event, object: OBJECT, objectType, before, after } as Parameters<typeof service.record>[1]))
    .then(
      () => null,
      (thrown: unknown) => thrown,
    );
  return { error, kept: world.audit.committed };
};

describe('master.created / master.edited for a customer (AC-6)', () => {
  it('say the name, the contact fields that were given or changed, and each rate with its value: "Not added" to the customer, the old rates to the new ones', () => {
    expect(WORDS('master.created', null, CREATED)).toEqual({
      before: 'Not added',
      after: 'Invented Works; Contact: Phone, E-mail; Cutting-Rate-per-Sec ₹ 1.37; OH Profit % 11.00 %',
    });
    expect(WORDS('master.edited', { name: 'Invented Works', contact: [], rates: [CUTTING] }, { name: 'Renamed Works', contact: [], rates: [{ ...CUTTING, value: '2.37' }] })).toEqual({
      before: 'Invented Works; Cutting-Rate-per-Sec ₹ 1.37',
      after: 'Renamed Works; Cutting-Rate-per-Sec ₹ 2.37',
    });
  });

  it('is a master with a shape: the registry lists customer next to the other four', () => {
    expect(Object.keys(MASTER_SHAPES).sort()).toEqual(['customer', 'exchange_rate', 'material', 'process_item', 'treatment']);
  });

  it("chooses the words by the entry's object type, never by the keys: a customer state under another master's type shows a dash", () => {
    for (const objectType of ['process_item', 'material', 'treatment', 'exchange_rate']) {
      expect(WORDS('master.created', null, CREATED, objectType), objectType).toEqual(NO_DETAIL);
    }
  });

  it('gives no words for stored values that do not fit (a blank name, an unknown contact field, a value with five decimals, an extra key)', () => {
    expect(WORDS('master.created', null, { ...CREATED, name: '' })).toBeNull();
    expect(WORDS('master.created', null, { ...CREATED, contact: ['fax'] })).toBeNull();
    expect(WORDS('master.created', null, { ...CREATED, rates: [{ ...CUTTING, value: '1.23456' }] })).toBeNull();
    expect(WORDS('master.created', null, { ...CREATED, extra: true })).toBeNull();
  });
});

describe('what the writer keeps for a customer (AC-6, #218)', () => {
  it('keeps a create, an edit with no rate changed (contact fields named) and an edit that changes rates', async () => {
    for (const [event, before, after] of [
      ['master.created', null, CREATED],
      ['master.edited', { name: 'Invented Works', contact: ['address'], rates: [] }, { name: 'Invented Works', contact: ['address'], rates: [] }],
      ['master.edited', { name: 'Invented Works', contact: [], rates: [CUTTING] }, { name: 'Invented Works', contact: [], rates: [{ ...CUTTING, value: '2.37' }] }],
    ] as const) {
      const { error, kept } = await attempt(event, 'customer', before, after);
      expect(error, event).toBeNull();
      expect(kept, event).toHaveLength(1);
    }
  });

  it('refuses a contact value in place of a field name, a value that is not decimal text, and the state of another master, and keeps nothing', async () => {
    for (const bad of [
      { name: 'Invented Works', contact: ['+99 555 0142'], rates: [] },
      { name: 'Invented Works', contact: [], rates: [{ ...CUTTING, value: 'many' }] },
      { name: 'Invented Works', contact: [], rates: [{ ...CUTTING, processItemId: 'not-an-id' }] },
      { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' },
      { name: 'Invented Works' },
    ]) {
      const { error, kept } = await attempt('master.created', 'customer', null, bad);
      expect(error, JSON.stringify(bad)).toMatchObject({ reason: 'shape', where: 'after' });
      expect(kept).toEqual([]);
    }
  });

  it("refuses a customer state under another master's type, on the after side of a create", async () => {
    const { error, kept } = await attempt('master.created', 'treatment', null, CREATED);
    expect(error).toMatchObject({ reason: 'shape', where: 'after' });
    expect(kept).toEqual([]);
  });
});
