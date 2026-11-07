import { describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_REFUSED_CODE, NAME_TAKEN_CODE, NotFoundError, ProcessItemInUseError } from '@/lib/errors';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { defined } from '../support/defined';
import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository, type FakeMasterRepository } from '../support/fake-masters';
import { cloneSeedConfig, SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.01 T2 (AC-2 to AC-5): the rules of the Process Master service over in-memory storage and the real audit service. The
 * real storage, the table lock and the constraints are tested against PostgreSQL in `tests/integration/masters`. Every name and
 * number is invented (`n.37`, ADR-014); the formulas are the seed's, which hold no value.
 */

const CUTTING = defined(SEED_PROCESS_ITEMS[0]);
const PLATING = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Plating-rate-per-sqin'));
const FOAM = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Foam Cost'));
const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;

function build(document = seedConfig) {
  const world = createFakeAuditWorld();
  const masters: FakeMasterRepository = createFakeMasterRepository();
  const service = createMastersService({
    masters,
    transactions: world.transactions,
    audit: createAuditService({ audit: world.audit }),
    currentConfiguration: () => Promise.resolve(document),
  });
  return { world, masters, service };
}

const entryEvents = (world: ReturnType<typeof build>['world']) => world.audit.committed.map((row) => row.event);

describe('AC-1: the list', () => {
  it('lists the 15 seed items in SPEC order with the letters of the formulas that use them, derived from the registry', async () => {
    const { service } = build();
    const items = await service.listProcessItems();
    expect(items.map((item) => item.name)).toEqual(SEED_PROCESS_ITEMS.map((item) => item.name));
    expect(items.find((item) => item.id === CUTTING.id)?.usedBy).toEqual([{ letter: 'AL', label: 'Cutting Cost' }]);
    expect(items.find((item) => item.id === PLATING.id)?.usedBy).toEqual([]);
    expect(items.every((item) => item.defaultValue === '0.00')).toBe(true);
  });

  it('follows the registry: when a field is inserted before the formula, the letter moves with it', async () => {
    const document = cloneSeedConfig();
    const first = defined(document.fields[0]);
    const inserted = document.fields.map((field) => ({ ...field, position: field.position + 1 }));
    const { service } = build({ ...document, fields: [{ ...first, id: '00000000-0000-4000-8000-0eee00000001', key: 'inserted-field', position: 1 }, ...inserted] });
    expect((await service.listProcessItems()).find((item) => item.id === CUTTING.id)?.usedBy).toEqual([{ letter: 'AM', label: 'Cutting Cost' }]);
  });
});

describe('AC-2: adding a rate', () => {
  it('adds the rate with its unit and default, normalised to two decimals, and records one master.created entry (AC-5)', async () => {
    const { service, world } = build();
    const created = await service.createProcessItem(CONTEXT, { name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.5' });
    expect(created).toEqual({ id: expect.any(String), name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.50', usedBy: [] });
    expect(world.audit.appended).toHaveLength(1);
    expect(world.audit.appended[0]).toMatchObject({
      event: 'master.created',
      objectType: 'process_item',
      objectId: created.id,
      objectLabel: 'Buffing-rate-per-sqin',
      actorId: CONTEXT.actorId,
      actorLabel: 'Invented Admin',
      requestId: 'req-0a0b0c0d',
      before: null,
      after: { name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.50' },
    });
  });

  it('takes the table lock before it looks at the other names, so the name is judged against the set it joins', async () => {
    const { service, masters } = build();
    await service.createProcessItem(CONTEXT, { name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' });
    expect(masters.lockCount()).toBe(1);
  });

  it.each([
    ['the same letters', 'foam cost'],
    ['capitals', 'FOAM COST'],
    ['the same name', 'Foam Cost'],
  ])('refuses a name that differs only in letter case (%s): "A rate with this name already exists." and nothing is recorded', async (_what, name) => {
    const { service, world, masters } = build();
    const error = await refusal(service.createProcessItem(CONTEXT, { name, unit: '%', defaultValue: '1.37' }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A rate with this name already exists.' }] });
    expect(masters.records).toHaveLength(15);
    expect(world.audit.appended).toEqual([]);
  });

  it.each(['AL', 'A', 'ZZ', 'A-B', '5', 'SUM', 'Material-Scrap-Rate'])('refuses %j, because letters move (a name must not read as a column letter or an operand)', async (name) => {
    const { service, world } = build();
    const error = await refusal(service.createProcessItem(CONTEXT, { name, unit: 'per kg', defaultValue: '1.37' }));
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(world.audit.appended).toEqual([]);
  });

  it('DEF-006: refuses a name that reads as two other rates and a minus sign, and one that reads as a column, a minus sign and a rate', async () => {
    const { service, masters, world } = build();
    for (const name of ['Foam Cost-Transport %', 'AB-Foam Cost', 'Foam Cost Foam Cost']) {
      const error = await refusal(service.createProcessItem(CONTEXT, { name, unit: 'per kg', defaultValue: '1.37' }));
      expect(error, name).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    }
    expect(masters.records).toHaveLength(15);
    expect(world.audit.appended).toEqual([]);
  });

  it('turns the database\'s refusal of a name that a racing request took into the same words', async () => {
    const { service, masters, world } = build();
    // The check passes against the names it read, and then the database refuses the insert: another request got there first.
    const realCreate = masters.createProcessItem.bind(masters);
    let first = true;
    masters.createProcessItem = async (item, tx) => {
      if (first) {
        first = false;
        masters.records.push({ id: '00000000-0000-4000-8000-0aaa00000001', name: item.name.toUpperCase(), unit: 'per kg', defaultValue: '1.00' });
      }
      return realCreate(item, tx);
    };
    const error = await refusal(service.createProcessItem(CONTEXT, { name: 'Racing Rate', unit: 'per kg', defaultValue: '1.37' }));
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(world.audit.appended).toEqual([]);
  });
});

describe('AC-3: changing a rate', () => {
  it('renames it, keeps its ID (so every formula keeps working), and records one master.edited entry with before and after (AC-5)', async () => {
    const { service, world } = build();
    const updated = await service.updateProcessItem(CONTEXT, FOAM.id, { name: 'Foam-Cost-per-sqft' });
    expect(updated).toMatchObject({ id: FOAM.id, name: 'Foam-Cost-per-sqft', usedBy: [{ letter: 'AW', label: 'Foam Cost' }] });
    expect(world.audit.appended).toHaveLength(1);
    expect(world.audit.appended[0]).toMatchObject({
      event: 'master.edited',
      objectType: 'process_item',
      objectId: FOAM.id,
      objectLabel: 'Foam-Cost-per-sqft',
      before: { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '0.00' },
      after: { name: 'Foam-Cost-per-sqft', unit: 'per sq ft', defaultValue: '0.00' },
    });
  });

  it('changes name, unit and default in one save and writes exactly one entry, not one for each', async () => {
    const { service, world } = build();
    await service.updateProcessItem(CONTEXT, FOAM.id, { name: 'Foam Cost 2', unit: 'per kg', defaultValue: '21.5' });
    expect(entryEvents(world)).toEqual(['master.edited']);
    expect(world.audit.appended[0]?.after).toEqual({ name: 'Foam Cost 2', unit: 'per kg', defaultValue: '21.50' });
  });

  it('allows a change of letter case to the rate\'s own name, and judges a name only when it changes', async () => {
    const { service } = build();
    expect((await service.updateProcessItem(CONTEXT, FOAM.id, { name: 'foam cost' })).name).toBe('foam cost');
    // Its unit changes while its name is left alone: the name is not judged again.
    expect((await service.updateProcessItem(CONTEXT, FOAM.id, { unit: 'per kg' })).unit).toBe('per kg');
  });

  it('refuses a name another rate has, ignoring letter case, and a name that reads as other rates; nothing is recorded', async () => {
    const { service, world, masters } = build();
    expect(await refusal(service.updateProcessItem(CONTEXT, FOAM.id, { name: 'transport %' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await refusal(service.updateProcessItem(CONTEXT, FOAM.id, { name: 'BB' }))).toMatchObject({ code: NAME_REFUSED_CODE });
    expect(masters.records.find((record) => record.id === FOAM.id)?.name).toBe('Foam Cost');
    expect(world.audit.appended).toEqual([]);
  });

  it('writes nothing for a save that sets every value to what it already is (spaces around the number and a different spelling of it)', async () => {
    const { service, world } = build();
    await service.updateProcessItem(CONTEXT, FOAM.id, { defaultValue: '12.5' });
    const before = world.audit.appended.length;
    const same = await service.updateProcessItem(CONTEXT, FOAM.id, { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '12.50' });
    expect(same.defaultValue).toBe('12.50');
    expect(world.audit.appended).toHaveLength(before);
  });

  it('says not found for a rate that does not exist, and records nothing', async () => {
    const { service, world } = build();
    const error = await refusal(service.updateProcessItem(CONTEXT, '00000000-0000-4000-8000-0bbb00000009', { unit: 'per kg' }));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(world.audit.appended).toEqual([]);
  });
});

describe('AC-4: deleting a rate', () => {
  it('refuses a rate a formula uses with a 409 that lists the formula (letter and label), and changes and records nothing', async () => {
    const { service, world, masters } = build();
    const error = await refusal(service.deleteProcessItem(CONTEXT, CUTTING.id));
    expect(error).toBeInstanceOf(ProcessItemInUseError);
    expect(error).toMatchObject({
      httpStatus: 409,
      code: 'PROCESS_ITEM_IN_USE',
      message: 'Cutting-Rate-per-Sec cannot be deleted while a formula uses it',
      usedBy: [{ letter: 'AL', label: 'Cutting Cost' }],
    });
    expect(masters.records.some((record) => record.id === CUTTING.id)).toBe(true);
    expect(world.audit.appended).toEqual([]);
  });

  it('lists every formula that uses the rate when two do', async () => {
    const document = cloneSeedConfig();
    const fields = document.fields.map((field) =>
      field.kind === 'output' && field.formula !== null && (field.key === 'bending-cost' || field.label === 'Bending Cost')
        ? { ...field, formula: `${field.formula} + {{rate:${CUTTING.id}}}` }
        : field,
    );
    const { service } = build({ ...document, fields });
    const error = await refusal(service.deleteProcessItem(CONTEXT, CUTTING.id));
    expect((error as ProcessItemInUseError).usedBy.map((use) => use.letter)).toEqual(['AL', 'AM']);
  });

  it('deletes a rate no formula uses and records one master.deleted entry with its last state', async () => {
    const { service, world, masters } = build();
    await service.updateProcessItem(CONTEXT, PLATING.id, { defaultValue: '1.37' });
    await service.deleteProcessItem(CONTEXT, PLATING.id);
    expect(masters.records.some((record) => record.id === PLATING.id)).toBe(false);
    const last = defined(world.audit.appended.at(-1));
    expect(last).toMatchObject({
      event: 'master.deleted',
      objectType: 'process_item',
      objectId: PLATING.id,
      objectLabel: 'Plating-rate-per-sqin',
      before: { name: 'Plating-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' },
      after: null,
    });
  });

  it('says not found for a rate that does not exist', async () => {
    const { service } = build();
    expect(await refusal(service.deleteProcessItem(CONTEXT, '00000000-0000-4000-8000-0bbb00000009'))).toBeInstanceOf(NotFoundError);
  });

  it('refuses to delete when the registry cannot be read (no version): a rate is never deleted on a guess', async () => {
    const world = createFakeAuditWorld();
    const masters = createFakeMasterRepository();
    const service = createMastersService({
      masters,
      transactions: world.transactions,
      audit: createAuditService({ audit: world.audit }),
      currentConfiguration: () => Promise.reject(new Error('No configuration version exists.')),
    });
    await expect(service.deleteProcessItem(CONTEXT, PLATING.id)).rejects.toThrow('No configuration version exists.');
    expect(masters.records).toHaveLength(15);
  });
});
