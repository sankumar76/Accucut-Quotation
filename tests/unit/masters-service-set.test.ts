import { describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_REFUSED_CODE, NAME_TAKEN_CODE } from '@/lib/errors';
import type { ConfigDocument } from '@/lib/fields/schema';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository, seedRecords } from '../support/fake-masters';
import { seedConfig } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.01 (AC-2, AC-3, AC-5), G6 conditions QLT-01, QLT-03 and QLT-05: the Process master judges the whole set of names that a
 * change would leave, whatever the order of the changes (DEF-006), takes the table lock first in every change, and reads the
 * configuration before it writes anything. The real storage is tested in `tests/integration/masters`. Every name is invented.
 */

const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const NEW_RATE = { unit: 'per kg', defaultValue: '1.37' } as const;

/** A service over the 15 seed rates plus `extraNames`, and a configuration that can be made to fail. */
function build(extraNames: ReadonlyArray<string> = [], currentConfiguration: () => Promise<ConfigDocument> = () => Promise.resolve(seedConfig)) {
  const world = createFakeAuditWorld();
  const extra = extraNames.map((name, index) => ({ id: `00000000-0000-4000-8000-0ccc${String(index).padStart(8, '0')}`, name, unit: 'per kg', defaultValue: '1.37' }));
  const masters = createFakeMasterRepository([...seedRecords(), ...extra]);
  const service = createMastersService({ masters, transactions: world.transactions, audit: createAuditService({ audit: world.audit }), currentConfiguration });
  const idOf = (name: string): string => masters.records.find((record) => record.name === name)?.id ?? '';
  return { world, masters, service, idOf };
}

type Built = ReturnType<typeof build>;
const add = (built: Built, name: string) => built.service.createProcessItem(CONTEXT, { name, ...NEW_RATE });
const names = (built: Built): string[] => built.masters.records.map((record) => record.name);

describe('adding rates one after another (QLT-01)', () => {
  it('forward order: the parts first and then the compound: the compound is refused, in the words that name no rate', async () => {
    const built = build();
    await add(built, 'Cost');
    await add(built, 'Waste');
    const error = await refusal(add(built, 'Cost-Waste'));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(JSON.stringify(error)).not.toMatch(/Cost|Waste/);
    expect(names(built)).not.toContain('Cost-Waste');
  });

  it('reverse order: the compound first, then one part (accepted), then the other part: refused, because the compound would read as the two', async () => {
    const built = build();
    await add(built, 'Cost-Waste');
    await add(built, 'Cost');
    const error = await refusal(add(built, 'Waste'));
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(JSON.stringify(error)).not.toMatch(/Cost|Waste/);
    expect(names(built)).toEqual(expect.arrayContaining(['Cost-Waste', 'Cost']));
    expect(names(built)).not.toContain('Waste');
  });

  it('writes no entry for a refused addition, and exactly one for each accepted one', async () => {
    const built = build();
    await add(built, 'Cost-Waste');
    await add(built, 'Cost');
    await refusal(add(built, 'Waste'));
    expect(built.world.audit.committed.map((row) => row.event)).toEqual(['master.created', 'master.created']);
  });

  it('refuses the same compound whichever part is last: Waste first, then Cost', async () => {
    const built = build(['Cost-Waste']);
    await add(built, 'Waste');
    expect(await refusal(add(built, 'Cost'))).toMatchObject({ code: NAME_REFUSED_CODE });
  });

  it('accepts a name that merely contains another rate in a longer word, and leaves the 15 seed names a safe set', async () => {
    const built = build();
    await add(built, 'Cost');
    await add(built, 'Costly');
    await add(built, 'Cost-Handling');
    expect(names(built)).toEqual(expect.arrayContaining(['Cost', 'Costly', 'Cost-Handling']));
  });

  it('still names the other problems in their own words: a column letter, an operand name, a wrong shape, a name taken', async () => {
    const built = build(['Cost']);
    for (const name of ['AL', 'Material-Scrap-Rate', 'Rate (old)', 'Rate,2']) {
      expect(await refusal(add(built, name)), name).toMatchObject({ code: NAME_REFUSED_CODE });
    }
    expect(await refusal(add(built, 'COST'))).toMatchObject({ code: NAME_TAKEN_CODE });
  });
});

describe('renaming rates one after another (QLT-01)', () => {
  it('the first rename that makes a part is accepted and the second is refused, and the refused rate keeps its name', async () => {
    const built = build(['Alpha', 'Beta', 'Gamma-Delta']);
    await built.service.updateProcessItem(CONTEXT, built.idOf('Alpha'), { name: 'Gamma' });
    const error = await refusal(built.service.updateProcessItem(CONTEXT, built.idOf('Beta'), { name: 'Delta' }));
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(JSON.stringify(error)).not.toMatch(/Gamma|Delta/);
    expect(names(built)).toEqual(expect.arrayContaining(['Gamma', 'Beta', 'Gamma-Delta']));
    expect(names(built)).not.toContain('Delta');
    expect(built.world.audit.committed.map((row) => row.event)).toEqual(['master.edited']);
  });

  it('the same in the other order: Delta first (accepted), then Gamma (refused)', async () => {
    const built = build(['Alpha', 'Beta', 'Gamma-Delta']);
    await built.service.updateProcessItem(CONTEXT, built.idOf('Beta'), { name: 'Delta' });
    expect(await refusal(built.service.updateProcessItem(CONTEXT, built.idOf('Alpha'), { name: 'Gamma' }))).toMatchObject({ code: NAME_REFUSED_CODE });
  });

  it('renaming the compound itself away from the parts is accepted, and so is renaming a part once the compound is gone', async () => {
    const built = build(['Cost', 'Cost-Waste']);
    await built.service.updateProcessItem(CONTEXT, built.idOf('Cost-Waste'), { name: 'Cost-Handling' });
    await built.service.updateProcessItem(CONTEXT, built.idOf('Cost'), { name: 'Waste' });
    expect(names(built)).toEqual(expect.arrayContaining(['Cost-Handling', 'Waste']));
  });

  it('a rename that changes only the letter case passes, and so does a save that leaves the name alone', async () => {
    const built = build(['Cost', 'Waste']);
    const costId = built.idOf('Cost');
    await built.service.updateProcessItem(CONTEXT, costId, { name: 'cost' });
    await built.service.updateProcessItem(CONTEXT, costId, { unit: 'per hole' });
    expect(names(built)).toContain('cost');
  });

  it('refuses a rename into the compound of two other rates (the new name reads as them)', async () => {
    const built = build(['Cost', 'Waste', 'Other']);
    expect(await refusal(built.service.updateProcessItem(CONTEXT, built.idOf('Other'), { name: 'Cost-Waste' }))).toMatchObject({ code: NAME_REFUSED_CODE });
  });
});

describe('the table lock and the order of reading (QLT-03, QLT-05)', () => {
  it('delete takes the table lock first, as create and update do, so no two changes can wait for each other', async () => {
    const built = build();
    const plating = built.idOf('Plating-rate-per-sqin');
    await built.service.updateProcessItem(CONTEXT, plating, { defaultValue: '2.37' });
    expect(built.masters.lockCount()).toBe(1);
    await built.service.deleteProcessItem(CONTEXT, plating);
    expect(built.masters.lockCount()).toBe(2);
  });

  it('a configuration that cannot be read stops create, update and delete before anything is written or recorded', async () => {
    const failing = build([], () => Promise.reject(new Error('The configuration cannot be read.')));
    const plating = failing.idOf('Plating-rate-per-sqin');
    await expect(add(failing, 'Buffing-rate-per-sqin')).rejects.toThrow('cannot be read');
    await expect(failing.service.updateProcessItem(CONTEXT, plating, { defaultValue: '2.37' })).rejects.toThrow('cannot be read');
    await expect(failing.service.deleteProcessItem(CONTEXT, plating)).rejects.toThrow('cannot be read');
    expect(failing.masters.records).toHaveLength(15);
    expect(failing.masters.records.find((record) => record.id === plating)?.defaultValue).toBe('0.00');
    expect(failing.masters.lockCount()).toBe(0);
    expect(failing.world.audit.appended).toEqual([]);
  });
});
