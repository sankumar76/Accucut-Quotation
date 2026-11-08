import { describe, expect, it, vi } from 'vitest';

import { FieldValidationError, NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository } from '../support/fake-masters';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { seedConfig } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.03 T2 (AC-2, AC-3, AC-5): the rules of the Material Master service over in-memory storage and the real audit service. The real
 * storage, the table lock and the constraints are tested against PostgreSQL in `tests/integration/masters/materials.test.ts`. Every name and
 * number is invented (`n.37`, ADR-014), except inputs that test the format.
 */

const ALPHA = MATERIAL_CANARIES[0];
const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const NEW_MATERIAL = {
  materialInDrawing: 'Invented-bar-grade-B',
  materialConsidered: 'Invented bronze',
  pricePerKg: '310.37',
  specificGravity: '8.37',
  scrapRate: '120.37',
} as const;

function build() {
  const world = createFakeAuditWorld();
  const masters = createFakeMasterRepository(undefined, MATERIAL_CANARIES);
  const currentConfiguration = vi.fn(() => Promise.resolve(seedConfig));
  const service = createMastersService({ masters, transactions: world.transactions, audit: createAuditService({ audit: world.audit }), currentConfiguration });
  return { world, masters, service, currentConfiguration };
}

describe('listing (AC-1, AC-4)', () => {
  it('lists the materials in the order they were added, with their numbers', async () => {
    const { service } = build();
    expect((await service.listMaterials()).map((material) => material.materialInDrawing)).toEqual(MATERIAL_CANARIES.map((material) => material.materialInDrawing));
  });

  it('lists the options as ID, name and Material Considered, and nothing else', async () => {
    const { service } = build();
    for (const option of await service.listMaterialOptions()) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
  });
});

describe('createMaterial (AC-2, AC-5)', () => {
  it('adds the material with every number to two decimals, in one transaction with exactly one master.created entry of object type material', async () => {
    const { service, world, masters } = build();
    const created = await service.createMaterial(CONTEXT, NEW_MATERIAL);
    expect(created).toMatchObject({ materialInDrawing: 'Invented-bar-grade-B', pricePerKg: '310.37', specificGravity: '8.37', scrapRate: '120.37' });
    expect(masters.materials.map((material) => material.id)).toContain(created.id);
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.created',
      objectType: 'material',
      objectId: created.id,
      objectLabel: 'Invented-bar-grade-B',
      actorId: CONTEXT.actorId,
      actorLabel: CONTEXT.actorLabel,
      before: null,
      after: { materialInDrawing: 'Invented-bar-grade-B', materialConsidered: 'Invented bronze', pricePerKg: '310.37', specificGravity: '8.37', scrapRate: '120.37' },
    });
  });

  it('takes the table lock before anything else, and reads no configuration (no check of a material needs one)', async () => {
    const { service, masters, currentConfiguration } = build();
    const lock = vi.spyOn(masters, 'lockMaterials');
    const create = vi.spyOn(masters, 'createMaterial');
    await service.createMaterial(CONTEXT, NEW_MATERIAL);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0] ?? 0);
    expect(currentConfiguration).not.toHaveBeenCalled();
  });

  it('refuses a name another material has, ignoring letter case, with the 422 of AC-2, and writes nothing', async () => {
    const { service, world, masters } = build();
    const error = await refusal(service.createMaterial(CONTEXT, { ...NEW_MATERIAL, materialInDrawing: 'CANARY-material-alpha' }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({
      code: NAME_TAKEN_CODE,
      fields: [{ field: 'materialInDrawing', message: 'A material with this name already exists. Names must be unique.' }],
    });
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.materials).toHaveLength(MATERIAL_CANARIES.length);
  });

  it.each(['0', '0.00', '-1', '-0.01'])('refuses a specific gravity of %s itself, for a caller that did not go through the route (UX-37)', async (specificGravity) => {
    const { service, world, masters } = build();
    const error = await refusal(service.createMaterial(CONTEXT, { ...NEW_MATERIAL, specificGravity }));
    expect(error).toMatchObject({ fields: [{ field: 'specificGravity', message: 'Enter a value above 0.' }] });
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.materials).toHaveLength(MATERIAL_CANARIES.length);
    expect(masters.materialLockCount()).toBe(0);
  });
});

describe('updateMaterial (AC-2, AC-3, AC-5)', () => {
  const id = ALPHA?.id ?? '';

  it('changes the fields given and writes exactly one master.edited entry with the material before and after', async () => {
    const { service, world } = build();
    const updated = await service.updateMaterial(CONTEXT, id, { scrapRate: '700.37', specificGravity: '8.37' });
    expect(updated).toMatchObject({ scrapRate: '700.37', specificGravity: '8.37', pricePerKg: ALPHA?.pricePerKg });
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.edited',
      objectType: 'material',
      objectId: id,
      before: { scrapRate: ALPHA?.scrapRate, specificGravity: ALPHA?.specificGravity },
      after: { scrapRate: '700.37', specificGravity: '8.37' },
    });
  });

  it('takes the table lock before the row lock, as PRF-01 fixed it', async () => {
    const { service, masters } = build();
    const lock = vi.spyOn(masters, 'lockMaterials');
    const find = vi.spyOn(masters, 'findMaterialForUpdate');
    await service.updateMaterial(CONTEXT, id, { scrapRate: '700.37' });
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0] ?? 0);
  });

  it('writes no entry and no update for a save that changes nothing', async () => {
    const { service, world, masters } = build();
    const update = vi.spyOn(masters, 'updateMaterial');
    const same = await service.updateMaterial(CONTEXT, id, { specificGravity: '737.37', materialConsidered: ALPHA?.materialConsidered ?? '' });
    expect(same.id).toBe(id);
    expect(update).not.toHaveBeenCalled();
    expect(world.audit.committed).toHaveLength(0);
  });

  it('refuses a specific gravity of 0 or below itself, and leaves the material as it was', async () => {
    const { service, world, masters } = build();
    const error = await refusal(service.updateMaterial(CONTEXT, id, { specificGravity: '0' }));
    expect(error).toMatchObject({ fields: [{ field: 'specificGravity', message: 'Enter a value above 0.' }] });
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.materials[0]?.specificGravity).toBe(ALPHA?.specificGravity);
  });

  it('refuses a rename onto another material (any letter case), and allows a change of its own letter case', async () => {
    const { service, world } = build();
    const error = await refusal(service.updateMaterial(CONTEXT, id, { materialInDrawing: 'canary-material-beta' }));
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'materialInDrawing' }] });
    expect(world.audit.committed).toHaveLength(0);
    await service.updateMaterial(CONTEXT, id, { materialInDrawing: 'canary-material-alpha' });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['master.edited']);
  });

  it('answers not found for an unknown ID, and writes nothing', async () => {
    const { service, world } = build();
    const error = await refusal(service.updateMaterial(CONTEXT, '00000000-0000-4000-8000-00000000dead', { scrapRate: '1.37' }));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(world.audit.committed).toHaveLength(0);
  });
});
