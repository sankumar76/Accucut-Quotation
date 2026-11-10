import { describe, expect, it, vi } from 'vitest';

import { ConflictError, FieldValidationError, NAME_RESERVED_CODE, NAME_TAKEN_CODE, NotFoundError, TREATMENT_LOCKED_CODE } from '@/lib/errors';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';
import { isReservedTreatmentName } from '@/server/services/treatment-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository } from '../support/fake-masters';
import { seedConfig } from '../support/seed-config';
import { FRESH_TREATMENTS, OTHER_TREATMENT_ID, TREATMENT_CANARIES } from '../support/treatment-canary';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.05 T2 (AC-1 to AC-4, AC-6): the rules of the Treatment / Color service over in-memory storage and the real audit service. The real
 * storage, the table lock, the constraints and the late failure of a transaction are tested against PostgreSQL in
 * `tests/integration/masters/treatments.test.ts`. Every name is invented.
 */

const ALPHA = TREATMENT_CANARIES[0];
const BETA = TREATMENT_CANARIES[1];
const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;

function build() {
  const world = createFakeAuditWorld();
  const masters = createFakeMasterRepository(undefined, [], [...FRESH_TREATMENTS, ...TREATMENT_CANARIES]);
  const service = createMastersService({
    masters,
    transactions: world.transactions,
    audit: createAuditService({ audit: world.audit }),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });
  return { world, masters, service };
}

describe('listing (AC-1, AC-5)', () => {
  it('lists "Other" first and locked, then the treatments in the order they were added', async () => {
    const { service } = build();
    expect((await service.listTreatments()).map((treatment) => [treatment.name, treatment.locked])).toEqual([
      ['Other', true],
      ['Canary-Treatment-Alpha', false],
      ['Canary-Treatment-Beta', false],
    ]);
  });

  it('lists the options as an ID and a name, "Other" included, and nothing else', async () => {
    const { service } = build();
    const options = await service.listTreatmentOptions();
    expect(options.map((option) => option.name)).toEqual(['Other', 'Canary-Treatment-Alpha', 'Canary-Treatment-Beta']);
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });
});

describe('the names the system keeps (AC-2)', () => {
  it.each(['Other', 'OTHER', 'other', ' other ', 'Not applicable', 'NOT APPLICABLE', 'not  applicable', ' Not\tapplicable ', 'Ｏｔｈｅｒ'])(
    'refuses %j with 422 NAME_RESERVED, in words that name neither entry, on an add and on a rename of a real treatment, and writes nothing',
    async (name) => {
      const { service, world, masters } = build();
      const added = await refusal(service.createTreatment(CONTEXT, { name }));
      expect(added).toBeInstanceOf(FieldValidationError);
      expect(added).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'name', message: 'That name cannot be used.' }] });
      const renamed = await refusal(service.updateTreatment(CONTEXT, ALPHA?.id ?? '', { name }));
      expect(renamed).toMatchObject({ code: NAME_RESERVED_CODE, fields: [{ field: 'name', message: 'That name cannot be used.' }] });
      expect(world.audit.committed).toHaveLength(0);
      expect(masters.treatments).toHaveLength(3);
      // An add is refused before any transaction; a rename is refused after the lookup (QLT-02), so only that one took the lock.
      expect(masters.treatmentLockCount()).toBe(1);
    },
  );

  it('does not refuse a name that only contains the words', () => {
    expect(isReservedTreatmentName('Other finish')).toBe(false);
    expect(isReservedTreatmentName('Not applicable here')).toBe(false);
    expect(isReservedTreatmentName('Another')).toBe(false);
    expect(isReservedTreatmentName('Not-applicable')).toBe(false);
  });

  it('refuses a blank name and a name over 100 characters itself, for a caller that did not go through the route', async () => {
    const { service, world } = build();
    expect(await refusal(service.createTreatment(CONTEXT, { name: '  ' }))).toMatchObject({ fields: [{ field: 'name', message: 'Enter a name.' }] });
    expect(await refusal(service.createTreatment(CONTEXT, { name: 'x'.repeat(101) }))).toMatchObject({ fields: [{ field: 'name', message: 'Use 100 characters or fewer.' }] });
    expect(world.audit.committed).toHaveLength(0);
  });
});

describe('one canonical form of a name (QLT-01)', () => {
  it('stores a name with its spaces collapsed and trimmed, and a full-width spelling folded', async () => {
    const { service, masters } = build();
    const spaced = await service.createTreatment(CONTEXT, { name: '  Invented   powder\tcoat ' });
    const wide = await service.createTreatment(CONTEXT, { name: 'Ｉｎｖｅｎｔｅｄ matt' });
    expect([spaced.name, wide.name]).toEqual(['Invented powder coat', 'Invented matt']);
    expect(masters.treatments.map((treatment) => treatment.name)).toEqual(expect.arrayContaining(['Invented powder coat', 'Invented matt']));
  });

  it.each(['Invented  powder coat', 'INVENTED POWDER  COAT', 'Ｉｎｖｅｎｔｅｄ ｐｏｗｄｅｒ ｃｏａｔ'])(
    'refuses %j as the name an earlier treatment already has, with NAME_TAKEN, on an add and on a rename',
    async (name) => {
      const { service, world } = build();
      await service.createTreatment(CONTEXT, { name: 'Invented powder coat' });
      const entries = world.audit.committed.length;
      expect(await refusal(service.createTreatment(CONTEXT, { name }))).toMatchObject({ code: NAME_TAKEN_CODE });
      expect(await refusal(service.updateTreatment(CONTEXT, BETA?.id ?? '', { name }))).toMatchObject({ code: NAME_TAKEN_CODE });
      expect(world.audit.committed).toHaveLength(entries);
    },
  );

  it('counts a rename to the same name with other spacing as no change: no update and no entry', async () => {
    const { service, world, masters } = build();
    const created = await service.createTreatment(CONTEXT, { name: 'Invented powder coat' });
    const rename = vi.spyOn(masters, 'renameTreatment');
    const entries = world.audit.committed.length;
    expect((await service.updateTreatment(CONTEXT, created.id, { name: ' Invented  powder   coat ' })).name).toBe('Invented powder coat');
    expect(rename).not.toHaveBeenCalled();
    expect(world.audit.committed).toHaveLength(entries);
  });
});

describe('the resource answers before the name does (QLT-02)', () => {
  it.each(['Other', 'OTHER', 'Not applicable', 'Invented new name'])('a rename of the locked "Other" to %j is 409 TREATMENT_LOCKED, never 422', async (name) => {
    const { service, world } = build();
    expect(await refusal(service.updateTreatment(CONTEXT, OTHER_TREATMENT_ID, { name }))).toMatchObject({ code: TREATMENT_LOCKED_CODE, httpStatus: 409 });
    expect(world.audit.committed).toHaveLength(0);
  });

  it.each(['Other', 'Not applicable'])('a rename of an unknown ID to %j is 404, never 422', async (name) => {
    const { service } = build();
    expect(await refusal(service.updateTreatment(CONTEXT, '00000000-0000-4000-8000-00000000dead', { name }))).toBeInstanceOf(NotFoundError);
  });

  it('a rename of a real treatment to a name the system keeps is still 422 NAME_RESERVED, after the lock, and writes nothing', async () => {
    const { service, world, masters } = build();
    expect(await refusal(service.updateTreatment(CONTEXT, ALPHA?.id ?? '', { name: 'other' }))).toMatchObject({ code: NAME_RESERVED_CODE });
    expect(masters.treatmentLockCount()).toBe(1);
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.treatments.find((treatment) => treatment.id === ALPHA?.id)?.name).toBe('Canary-Treatment-Alpha');
  });
});

describe('createTreatment (AC-2, AC-6)', () => {
  it('adds the treatment, trimmed, in one transaction with exactly one master.created entry of object type treatment', async () => {
    const { service, world, masters } = build();
    const created = await service.createTreatment(CONTEXT, { name: '  Invented anodised  ' });
    expect(created).toEqual({ id: expect.any(String), name: 'Invented anodised', locked: false });
    expect(masters.treatments.map((treatment) => treatment.id)).toContain(created.id);
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.created',
      objectType: 'treatment',
      objectId: created.id,
      objectLabel: 'Invented anodised',
      actorId: CONTEXT.actorId,
      actorLabel: CONTEXT.actorLabel,
      before: null,
      after: { name: 'Invented anodised' },
    });
  });

  it('takes the table lock before anything is written', async () => {
    const { service, masters } = build();
    const lock = vi.spyOn(masters, 'lockTreatments');
    const create = vi.spyOn(masters, 'createTreatment');
    await service.createTreatment(CONTEXT, { name: 'Invented anodised' });
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0] ?? 0);
  });

  it('refuses a name another treatment has, ignoring letter case, in the words of AC-2, and writes nothing', async () => {
    const { service, world, masters } = build();
    const error = await refusal(service.createTreatment(CONTEXT, { name: 'CANARY-treatment-alpha' }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A treatment with this name already exists.' }] });
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.treatments).toHaveLength(3);
  });
});

describe('updateTreatment, a rename (AC-2, AC-3, AC-6)', () => {
  const id = ALPHA?.id ?? '';

  it('renames and writes exactly one master.edited entry with the name before and after', async () => {
    const { service, world } = build();
    const updated = await service.updateTreatment(CONTEXT, id, { name: ' Invented hard coat ' });
    expect(updated).toEqual({ id, name: 'Invented hard coat', locked: false });
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.edited',
      objectType: 'treatment',
      objectId: id,
      objectLabel: 'Invented hard coat',
      before: { name: 'Canary-Treatment-Alpha' },
      after: { name: 'Invented hard coat' },
    });
  });

  it('takes the table lock before the row lock, as PRF-01 fixed it', async () => {
    const { service, masters } = build();
    const lock = vi.spyOn(masters, 'lockTreatments');
    const find = vi.spyOn(masters, 'findTreatmentForUpdate');
    await service.updateTreatment(CONTEXT, id, { name: 'Invented hard coat' });
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0] ?? 0);
  });

  it('writes no entry and no update for a rename that changes nothing', async () => {
    const { service, world, masters } = build();
    const rename = vi.spyOn(masters, 'renameTreatment');
    const same = await service.updateTreatment(CONTEXT, id, { name: 'Canary-Treatment-Alpha' });
    expect(same.id).toBe(id);
    expect(rename).not.toHaveBeenCalled();
    expect(world.audit.committed).toHaveLength(0);
  });

  it('refuses a rename onto another treatment (any letter case), and allows a change of its own letter case', async () => {
    const { service, world } = build();
    const error = await refusal(service.updateTreatment(CONTEXT, id, { name: BETA?.name.toUpperCase() ?? '' }));
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A treatment with this name already exists.' }] });
    expect(world.audit.committed).toHaveLength(0);
    await service.updateTreatment(CONTEXT, id, { name: 'canary-treatment-alpha' });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['master.edited']);
  });

  it('answers not found for an unknown ID, and writes nothing', async () => {
    const { service, world } = build();
    const error = await refusal(service.updateTreatment(CONTEXT, '00000000-0000-4000-8000-00000000dead', { name: 'Invented hard coat' }));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(world.audit.committed).toHaveLength(0);
  });
});

describe('the locked "Other" entry (AC-3), in the service and not only on the screen', () => {
  it('refuses a rename with 409 TREATMENT_LOCKED, changes nothing and writes no entry', async () => {
    const { service, world, masters } = build();
    const error = await refusal(service.updateTreatment(CONTEXT, OTHER_TREATMENT_ID, { name: 'Invented renamed other' }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: TREATMENT_LOCKED_CODE, httpStatus: 409 });
    expect(masters.treatments.find((treatment) => treatment.id === OTHER_TREATMENT_ID)).toEqual({ id: OTHER_TREATMENT_ID, name: 'Other', locked: true });
    expect(world.audit.committed).toHaveLength(0);
  });

  it('refuses a delete the same way', async () => {
    const { service, world, masters } = build();
    const remove = vi.spyOn(masters, 'deleteTreatment');
    const error = await refusal(service.deleteTreatment(CONTEXT, OTHER_TREATMENT_ID));
    expect(error).toMatchObject({ code: TREATMENT_LOCKED_CODE, httpStatus: 409 });
    expect(remove).not.toHaveBeenCalled();
    expect(masters.treatments.map((treatment) => treatment.id)).toContain(OTHER_TREATMENT_ID);
    expect(world.audit.committed).toHaveLength(0);
  });

  it('refuses a rename that changes nothing as well: the entry is locked whatever the body says', async () => {
    const { service } = build();
    expect(await refusal(service.updateTreatment(CONTEXT, OTHER_TREATMENT_ID, {}))).toMatchObject({ code: TREATMENT_LOCKED_CODE });
  });
});

describe('deleteTreatment (AC-4, AC-6)', () => {
  const id = ALPHA?.id ?? '';

  it('removes the treatment from the list and writes exactly one master.deleted entry with the name before and nothing after', async () => {
    const { service, world, masters } = build();
    await service.deleteTreatment(CONTEXT, id);
    expect(masters.treatments.map((treatment) => treatment.id)).not.toContain(id);
    expect((await service.listTreatments()).map((treatment) => treatment.name)).toEqual(['Other', 'Canary-Treatment-Beta']);
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.deleted',
      objectType: 'treatment',
      objectId: id,
      objectLabel: 'Canary-Treatment-Alpha',
      before: { name: 'Canary-Treatment-Alpha' },
      after: null,
    });
  });

  it('takes the table lock before the row lock', async () => {
    const { service, masters } = build();
    const lock = vi.spyOn(masters, 'lockTreatments');
    const find = vi.spyOn(masters, 'findTreatmentForUpdate');
    await service.deleteTreatment(CONTEXT, id);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0] ?? 0);
  });

  it('answers not found for an unknown ID and for one deleted already, and writes nothing', async () => {
    const { service, world } = build();
    expect(await refusal(service.deleteTreatment(CONTEXT, '00000000-0000-4000-8000-00000000dead'))).toBeInstanceOf(NotFoundError);
    await service.deleteTreatment(CONTEXT, id);
    expect(await refusal(service.deleteTreatment(CONTEXT, id))).toBeInstanceOf(NotFoundError);
    expect(world.audit.committed).toHaveLength(1);
  });
});
