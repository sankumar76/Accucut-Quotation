import { describe, expect, it } from 'vitest';

import { NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { customerSide } from '../support/customer-audit-side';
import { defined } from '../support/defined';
import { createFakeAuditWorld } from '../support/fake-audit';
import { fakeCustomer } from '../support/fake-customers';
import { createFakeMasterRepository, seedRecords } from '../support/fake-masters';
import { seedConfig } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.02 T2, T3 (AC-1 to AC-4, AC-6): the rules of the Customer service over in-memory storage and the real audit service. The real storage, the
 * table lock, the constraints, the one statement of the item sync and the late failure of a transaction are tested against PostgreSQL in
 * `tests/integration/masters/customers.test.ts` and `customers-sync.test.ts`. Every name and number is invented (`n.37`).
 */

const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const FIRST_ITEM = '00000000-0000-4000-8000-000400000001';
const SECOND_ITEM = '00000000-0000-4000-8000-000400000002';

function build() {
  const world = createFakeAuditWorld();
  const records = seedRecords().map((record, index) => ({ ...record, defaultValue: `${index + 1}.37` }));
  const masters = createFakeMasterRepository(records);
  const service = createMastersService({
    masters,
    transactions: world.transactions,
    audit: createAuditService({ audit: world.audit }),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });
  return { world, masters, service };
}

const NEW_RATE = { name: 'Invented-sync-rate-per-sqin', unit: 'per sq in', defaultValue: '4.37' } as const;

describe('a Process Master item added or deleted reaches the customers (AC-4)', () => {
  it('adds the item to every customer at its default, and writes only the item\'s own entry', async () => {
    const { world, masters, service } = build();
    masters.customers.push(fakeCustomer(masters.records, 'Alpha Works'), fakeCustomer(masters.records, 'Bravo Works'));
    const entries = world.audit.committed.length;
    const item = await service.createProcessItem(CONTEXT, NEW_RATE);
    for (const customer of masters.customers) expect(customer.values.get(item.id)).toBe('4.37');
    expect(world.audit.committed.slice(entries).map((row) => [row.event, row.objectType])).toEqual([['master.created', 'process_item']]);
  });

  it('removes a deleted item from every customer, and writes only the item\'s own entry', async () => {
    const { world, masters, service } = build();
    const item = await service.createProcessItem(CONTEXT, NEW_RATE);
    masters.customers.push(fakeCustomer(masters.records, 'Alpha Works'));
    const entries = world.audit.committed.length;
    await service.deleteProcessItem(CONTEXT, item.id);
    expect(defined(masters.customers[0]).values.has(item.id)).toBe(false);
    expect(world.audit.committed.slice(entries).map((row) => [row.event, row.objectType])).toEqual([['master.deleted', 'process_item']]);
  });
});

describe('every change takes the Process Master\'s lock first (PRF-01)', () => {
  it('on a create, an edit and a reset, so a customer added while an item is added cannot miss its rate', async () => {
    const { masters, service } = build();
    const created = await service.createCustomer(CONTEXT, { name: 'Invented Works', phone: null, email: null, address: null });
    expect(masters.lockCount()).toBe(1);
    await service.updateCustomer(CONTEXT, created.id, { name: 'Renamed Works' });
    expect(masters.lockCount()).toBe(2);
    await service.resetCustomerRates(CONTEXT, created.id);
    expect(masters.lockCount()).toBe(3);
  });

  it('and reads nothing before the transaction: a refused name opens none', async () => {
    const { masters, service } = build();
    await refusal(service.createCustomer(CONTEXT, { name: '  ', phone: null, email: null, address: null }));
    expect(masters.lockCount()).toBe(0);
  });
});

describe('the audit entry of a change (AC-6)', () => {
  it('lists the rates of an edit in the order of the table on both sides, with the name and unit each had', async () => {
    const { world, masters, service } = build();
    const created = await service.createCustomer(CONTEXT, { name: 'Invented Works', phone: null, email: null, address: null });
    const entries = world.audit.committed.length;
    await service.updateCustomer(CONTEXT, created.id, {
      rates: [
        { processItemId: SECOND_ITEM, value: '9.5' },
        { processItemId: FIRST_ITEM, value: '8.25' },
      ],
    });
    const entry = defined(world.audit.committed[entries]);
    const ids = (side: unknown) => customerSide(side).rates.map((rate) => rate.processItemId);
    expect(ids(entry.before)).toEqual([FIRST_ITEM, SECOND_ITEM]);
    expect(ids(entry.after)).toEqual([FIRST_ITEM, SECOND_ITEM]);
    expect(defined(masters.customers[0]).values.get(FIRST_ITEM)).toBe('8.25');
  });

  it('is exactly one entry for a create, an edit and a reset, and none for a save or a reset that changes nothing', async () => {
    const { world, service } = build();
    const created = await service.createCustomer(CONTEXT, { name: 'Invented Works', phone: '+99 555 0142', email: null, address: null });
    await service.updateCustomer(CONTEXT, created.id, { phone: '+99 555 0142', name: 'Invented Works' });
    await service.resetCustomerRates(CONTEXT, created.id);
    await service.updateCustomer(CONTEXT, created.id, { rates: [{ processItemId: FIRST_ITEM, value: '9.5' }] });
    await service.resetCustomerRates(CONTEXT, created.id);
    expect(world.audit.committed.map((row) => row.event)).toEqual(['master.created', 'master.edited', 'master.edited']);
  });
});

describe('the name (AC-1)', () => {
  it('is refused when another customer has it ignoring letter case, on a create and on a rename, with NAME_TAKEN and the words of AC-1', async () => {
    const { service } = build();
    const first = await service.createCustomer(CONTEXT, { name: 'Invented Works', phone: null, email: null, address: null });
    const second = await service.createCustomer(CONTEXT, { name: 'Second Works', phone: null, email: null, address: null });
    for (const attempt of [
      service.createCustomer(CONTEXT, { name: 'INVENTED WORKS', phone: null, email: null, address: null }),
      service.updateCustomer(CONTEXT, second.id, { name: 'invented works' }),
    ]) {
      expect(await refusal(attempt)).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A customer with this name already exists.' }] });
    }
    expect((await service.getCustomer(first.id)).name).toBe('Invented Works');
  });

  it('answers not found for an ID that is no listed customer', async () => {
    const { service } = build();
    expect(await refusal(service.getCustomer('00000000-0000-4000-8000-0ccc00000009'))).toBeInstanceOf(NotFoundError);
    expect(await refusal(service.resetCustomerRates(CONTEXT, 'not-an-id'))).toBeInstanceOf(NotFoundError);
  });
});
