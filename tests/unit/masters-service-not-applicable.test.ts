import { describe, expect, it, vi } from 'vitest';

import { FieldValidationError, NAME_RESERVED_CODE, NotFoundError } from '@/lib/errors';
import { NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID } from '@/lib/masters/system-entries';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { defined } from '../support/defined';
import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository } from '../support/fake-masters';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { seedConfig } from '../support/seed-config';
import { FRESH_TREATMENTS, TREATMENT_CANARIES } from '../support/treatment-canary';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.06 (AC-4, AC-5, AC-6) at service level, over in-memory storage and the real audit service: the hidden "Not applicable" entries are offered
 * last in the two option lists and nowhere else, and the name is reserved for a material and for a treatment in any letter case or spacing, with a
 * sentence that names no entry. The real default filter, the trigger and the migration are tested against PostgreSQL in
 * `tests/integration/masters/not-applicable-*.test.ts`. Every name and number is invented (`n.37`, ADR-014).
 */

const ALPHA = defined(MATERIAL_CANARIES[0]);
const TREATMENT_ALPHA = defined(TREATMENT_CANARIES[0]);
const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const NEW_MATERIAL = {
  materialInDrawing: 'Invented-bar-grade-B',
  materialConsidered: 'Invented bronze',
  pricePerKg: '310.37',
  specificGravity: '8.37',
  scrapRate: '120.37',
} as const;
/** Spellings that all mean the one reserved name: letter case, spacing, a tab and full-width letters (compatibility forms). */
const RESERVED_SPELLINGS = ['Not applicable', 'NOT APPLICABLE', 'not applicable', ' not  applicable ', 'Not\tapplicable', 'Ｎｏｔ ａｐｐｌｉｃａｂｌｅ'];
const RESERVED_MESSAGE = 'That name cannot be used.';

function build() {
  const world = createFakeAuditWorld();
  const masters = createFakeMasterRepository(undefined, MATERIAL_CANARIES, [...FRESH_TREATMENTS, ...TREATMENT_CANARIES]);
  const service = createMastersService({
    masters,
    transactions: world.transactions,
    audit: createAuditService({ audit: world.audit }),
    currentConfiguration: vi.fn(() => Promise.resolve(seedConfig)),
  });
  return { world, masters, service };
}

describe('AC-5: the options offer "Not applicable" last, and no Admin list holds it', () => {
  it('materials: the listed materials in the order they were added, then the hidden entry with no Material Considered', async () => {
    const { service } = build();
    const options = await service.listMaterialOptions();
    expect(options.slice(0, -1).map((option) => option.name)).toEqual(MATERIAL_CANARIES.map((material) => material.materialInDrawing));
    expect(options.at(-1)).toEqual({ id: NOT_APPLICABLE_MATERIAL_ID, name: NOT_APPLICABLE_NAME, materialConsidered: null });
    expect((await service.listMaterials()).map((material) => material.id)).not.toContain(NOT_APPLICABLE_MATERIAL_ID);
  });

  it('treatments: "Other" first, then the others, then the hidden entry, with an ID and a name and nothing else', async () => {
    const { service } = build();
    const options = await service.listTreatmentOptions();
    expect(options.map((option) => option.name)).toEqual(['Other', ...TREATMENT_CANARIES.map((treatment) => treatment.name), NOT_APPLICABLE_NAME]);
    expect(options.at(-1)).toEqual({ id: NOT_APPLICABLE_TREATMENT_ID, name: NOT_APPLICABLE_NAME });
    expect((await service.listTreatments()).map((treatment) => treatment.id)).not.toContain(NOT_APPLICABLE_TREATMENT_ID);
  });

  it('still offers the listed entries when the hidden row is missing: the form never fails for it', async () => {
    const { service, masters } = build();
    vi.spyOn(masters, 'findNotApplicableMaterialOption').mockResolvedValue(null);
    vi.spyOn(masters, 'findNotApplicableTreatmentOption').mockResolvedValue(null);
    expect((await service.listMaterialOptions()).map((option) => option.id)).toEqual(MATERIAL_CANARIES.map((material) => material.id));
    expect((await service.listTreatmentOptions()).map((option) => option.name)).not.toContain(NOT_APPLICABLE_NAME);
  });
});

describe('AC-6: a material cannot be named "Not applicable"', () => {
  it.each(RESERVED_SPELLINGS)('refuses %j on an add with 422 NAME_RESERVED, in words that name no entry, before any transaction opens, and writes nothing', async (name) => {
    const { service, world, masters } = build();
    const error = await refusal(service.createMaterial(CONTEXT, { ...NEW_MATERIAL, materialInDrawing: name }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'materialInDrawing', message: RESERVED_MESSAGE }] });
    expect(JSON.stringify(error)).not.toMatch(/applicable/i);
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.materials).toHaveLength(MATERIAL_CANARIES.length);
    expect(masters.materialLockCount()).toBe(0);
  });

  it.each(RESERVED_SPELLINGS)('refuses %j on a rename of a real material with 422 NAME_RESERVED, and changes nothing', async (name) => {
    const { service, world, masters } = build();
    const error = await refusal(service.updateMaterial(CONTEXT, ALPHA.id, { materialInDrawing: name }));
    expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'materialInDrawing', message: RESERVED_MESSAGE }] });
    expect(JSON.stringify(error)).not.toMatch(/applicable/i);
    expect(world.audit.committed).toHaveLength(0);
    expect(masters.materials.find((material) => material.id === ALPHA.id)?.materialInDrawing).toBe(ALPHA.materialInDrawing);
  });

  it('answers 404 for an unknown ID whatever the new name is, so a reserved name confirms nothing (the order of refusals, architecture section 8)', async () => {
    const { service } = build();
    expect(await refusal(service.updateMaterial(CONTEXT, '00000000-0000-4000-8000-0ccc00000009', { materialInDrawing: 'Not applicable' }))).toBeInstanceOf(NotFoundError);
  });

  it('does not refuse a name that only contains the words, or a different word', async () => {
    const { service } = build();
    for (const name of ['Not applicable here', 'Not-applicable', 'Inapplicable', 'Not applicablé']) {
      expect((await service.createMaterial(CONTEXT, { ...NEW_MATERIAL, materialInDrawing: name })).materialInDrawing).toBe(name);
    }
  });

  it('a change that does not name the Material in Drawing is not judged by the reserved name', async () => {
    const { service } = build();
    expect((await service.updateMaterial(CONTEXT, ALPHA.id, { scrapRate: '1.37' })).scrapRate).toBe('1.37');
  });
});

describe('AC-6: a treatment cannot be named "Not applicable" either (STORY-02.05 AC-2 already refuses it; held here with the material)', () => {
  it.each(RESERVED_SPELLINGS)('refuses %j on an add and on a rename with 422 NAME_RESERVED, in words that name no entry', async (name) => {
    const { service, world } = build();
    const added = await refusal(service.createTreatment(CONTEXT, { name }));
    const renamed = await refusal(service.updateTreatment(CONTEXT, TREATMENT_ALPHA.id, { name }));
    for (const error of [added, renamed]) {
      expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'name', message: RESERVED_MESSAGE }] });
      expect(JSON.stringify(error)).not.toMatch(/applicable/i);
    }
    expect(world.audit.committed).toHaveLength(0);
  });
});
