import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { WorkingMismatchError } from '@/lib/estimate/cost-working';
import { createCostDetailsService } from '@/server/services/cost-details-service';
import { nodeCostsSchema } from '@/server/views/schemas/node-costs';

import { defined } from '../support/defined';
import {
  COST_CALCULATED_AT,
  COST_CALCULATION_REVISION,
  COST_CONFIGURATION_NUMBER,
  COST_ESTIMATE_ID,
  COST_FIRST_NODE_ID,
  COST_SECOND_NODE_ID,
  createCostWorld,
} from '../support/cost-details-world';
import { seedFieldAt } from '../support/seed-config';

/**
 * STORY-06.03 AC-1, AC-3, AC-5, AC-7 and AC-8 (FR-058, FR-100; NFR-002; architecture sections 4.8, 4.9 and 6 "Cost details"): the cost details service over an in-memory calculation record made by the real row
 * calculator, with every read counted, so a test can say what was **not** read. The working itself is `tests/unit/estimate/cost-working.test.ts`; the route and the strict schema are
 * `cost-details-route.test.ts` and `node-costs-schema.test.ts`. Every name, ID and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000ad314', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e9142', role: 'ENGINEER' } as const;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

describe('AC-1: a current calculation gives the six stages of the row asked for, and of no other', () => {
  it.each([LEAD, ADMIN])('as $role: the row, the time, the version of the calculation, the letters, the count and six stages', async (viewer) => {
    const world = createCostWorld();
    const costs = await world.service.getNodeCosts(viewer, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(costs.state).toBe('current');
    expect(costs.row).toEqual({ nodeId: COST_FIRST_NODE_ID, slNo: '1', name: 'Invented Bracket', kindLabel: 'Main Assembly' });
    expect(costs.details).toMatchObject({
      calculatedAt: COST_CALCULATED_AT.toISOString(),
      // The version the calculation was made with (9), not the one in force now (10).
      configurationNumber: COST_CONFIGURATION_NUMBER,
      letters: { count: 'H', unitPrice: 'BG' },
      count: '3',
      notApplicable: false,
      hiddenLineCount: 2,
    });
    expect(costs.details?.stages.map((stage) => stage.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('works out the row from its own stored record: the AK line is the hand-worked figure with its working', async () => {
    const costs = await createCostWorld().service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    const ak = defined(costs.details?.stages[1]?.lines.find((line) => line.letter === 'AK'));
    expect(ak).toMatchObject({ formula: '(M * I) - (O * Material-Scrap-Rate)', working: '(0.3140 × 60) - (0.1140 × 25)', value: '15.99' });
  });

  it('reads only the row asked for: the second part is its own row, named by its Part No., and the first part\'s working is not read for it', async () => {
    const world = createCostWorld();
    const costs = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_SECOND_NODE_ID);
    expect(costs.row).toEqual({ nodeId: COST_SECOND_NODE_ID, slNo: '2', name: 'INV-0002', kindLabel: 'Main Assembly' });
    expect(world.reads.working.calls).toEqual([[expect.any(String), COST_SECOND_NODE_ID]]);
  });

  it('one row\'s working holds no figure of another row: the two rows differ, and each answer is its own', async () => {
    const world = createCostWorld({ second: { row: { H: '1', AP: '50' }, material: 'not-applicable' } });
    const first = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    const second = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_SECOND_NODE_ID);
    expect(first.details?.notApplicable).toBe(false);
    expect(second.details?.notApplicable).toBe(true);
    expect(JSON.stringify(first)).not.toContain('"50"');
    expect(JSON.stringify(second)).not.toContain('451.39');
  });

  it('the answer is exactly what the strict schema allows (it is parsed before it leaves)', async () => {
    const costs = await createCostWorld().service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(nodeCostsSchema.parse(costs)).toEqual(costs);
  });

  it('holds no customer name, no rate that no formula of the row uses, and no master record', async () => {
    const text = JSON.stringify(await createCostWorld().service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID));
    expect(text).not.toContain('Invented Customer');
    expect(text).not.toContain('Plating-rate-per-sqin');
    expect(text).not.toContain('materialConsidered');
    expect(text).not.toContain('masterSnapshot');
  });

  it('asks for a row by its Sl. No as well, which is how the page names it, and gives the same answer', async () => {
    const world = createCostWorld();
    expect(await world.service.getNodeCostsBySlNo(LEAD, COST_ESTIMATE_ID, '2')).toEqual(await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_SECOND_NODE_ID));
  });

  it('a part under another is found by its dotted Sl. No', async () => {
    const world = createCostWorld();
    world.nodes.push({ id: '00000000-0000-4000-8000-000000000003', parentId: COST_FIRST_NODE_ID, sortIndex: 0, nodeKind: 'PART', revision: 1, imageId: null, inputs: {} });
    world.rows.set('00000000-0000-4000-8000-000000000003', defined(world.rows.get(COST_FIRST_NODE_ID)));
    expect((await world.service.getNodeCostsBySlNo(LEAD, COST_ESTIMATE_ID, '1.1')).row.slNo).toBe('1.1');
  });
});

describe('AC-3, AC-5: the flags and the "Not applicable" material, as the service passes them on', () => {
  it('a row with nothing selected holds the seven treatment lines as hidden, still calculated, in the answer', async () => {
    const world = createCostWorld({ first: { row: { H: '1', AP: '10' } } });
    const costs = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(costs.details?.hiddenLineCount).toBe(7);
    const hidden = costs.details?.stages.flatMap((stage) => stage.lines).filter((line) => line.hidden) ?? [];
    expect(hidden.map((line) => [line.letter, line.value])).toEqual(['AQ', 'AR', 'AS', 'AT', 'AV', 'AW', 'AX'].map((letter) => [letter, '0']));
  });

  it('a "Not applicable" row: no material rate, 0 for M, O and AK with no worked line, and no Material- operand and no price of a material anywhere in the answer', async () => {
    const world = createCostWorld({ first: { material: 'not-applicable' } });
    const costs = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    const lines = costs.details?.stages.flatMap((stage) => stage.lines) ?? [];
    const line = (letter: string) => defined(lines.find((candidate) => candidate.letter === letter));
    expect(costs.details?.notApplicable).toBe(true);
    expect(line('I')).toMatchObject({ value: null, blank: true });
    for (const letter of ['M', 'O', 'AK']) expect(line(letter), letter).toMatchObject({ value: '0', working: null });
    expect(lines.flatMap((candidate) => (candidate.working === null ? [] : [candidate.working])).join(' ')).not.toContain('Material-');
  });
});

describe('AC-7 (FR-100): figures only while current; nothing calculated is even read otherwise', () => {
  it('NONE: no calculation is linked. The answer is the row and the state, the working is never read, and the name comes from the version in force now', async () => {
    const world = createCostWorld({ calculated: false });
    const costs = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(costs).toEqual({ state: 'none', row: { nodeId: COST_FIRST_NODE_ID, slNo: '1', name: 'Invented Bracket', kindLabel: 'Main Assembly' }, details: null });
    expect(world.reads.working.calls).toEqual([]);
    expect(world.reads.currentVersion.calls).toHaveLength(1);
    expect(world.reads.versionById.calls).toEqual([]);
  });

  it('OUT OF DATE: an input changed since. The working of the record is not read and not in the answer in any form, and the row header stays', async () => {
    const world = createCostWorld({ inputsRevision: COST_CALCULATION_REVISION + 1 });
    const costs = await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(costs).toEqual({ state: 'out-of-date', row: { nodeId: COST_FIRST_NODE_ID, slNo: '1', name: 'Invented Bracket', kindLabel: 'Main Assembly' }, details: null });
    expect(world.reads.working.calls).toEqual([]);
    const text = JSON.stringify(costs);
    for (const leaked of ['451.39', '15.99', 'Material-Scrap-Rate', 'Cutting-Rate', '0.3140', 'stages', 'formula']) expect(text, leaked).not.toContain(leaked);
  });

  it('a calculation that is somehow ahead of its estimate is out of date, never current', async () => {
    const world = createCostWorld({ inputsRevision: COST_CALCULATION_REVISION - 1 });
    expect((await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).state).toBe('out-of-date');
    expect(world.reads.working.calls).toEqual([]);
  });

  it('CURRENT: the working is read once, for the one row, by the ID of the linked calculation', async () => {
    const world = createCostWorld();
    await world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
    expect(world.reads.working.calls).toHaveLength(1);
    expect(world.reads.basis.calls).toEqual([[COST_ESTIMATE_ID]]);
    expect(world.reads.versionById.calls).toHaveLength(1);
  });

  it('a current calculation with no row for the part is a fault in the data, in plain words, and never a half-drawn answer', async () => {
    const world = createCostWorld();
    world.rows.delete(COST_FIRST_NODE_ID);
    await expect(world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).rejects.toThrow('The calculation linked to the estimate holds no row for one of its parts.');
  });

  it('a record whose figures cannot be reproduced is a fault (a plain error), never a working printed beside a figure it does not give', async () => {
    const world = createCostWorld();
    const stored = defined(world.rows.get(COST_FIRST_NODE_ID));
    world.rows.set(COST_FIRST_NODE_ID, { ...stored, outputs: { ...stored.outputs, [seedFieldAt('AK').id]: '999' } });
    await expect(world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).rejects.toBeInstanceOf(WorkingMismatchError);
  });
});

describe('AC-8: an Engineer is refused before anything is read, and a part of another estimate is not found', () => {
  it.each([[COST_ESTIMATE_ID, COST_FIRST_NODE_ID], [UNKNOWN_ID, UNKNOWN_ID], ['not-an-id', 'not-an-id']])('refuses an Engineer asking for %s / %s with no read at all', async (estimateId, nodeId) => {
    const world = createCostWorld();
    await expect(world.service.getNodeCosts(ENGINEER, estimateId, nodeId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(world.service.getNodeCostsBySlNo(ENGINEER, estimateId, '1')).rejects.toBeInstanceOf(ForbiddenError);
    for (const log of Object.values(world.reads)) expect(log.calls).toEqual([]);
  });

  it('the roles let through are exactly the Lead and the Admin, by name', async () => {
    const allowed: string[] = [];
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      const world = createCostWorld();
      const outcome = await world.service.getNodeCosts({ id: ENGINEER.id, role }, COST_ESTIMATE_ID, COST_FIRST_NODE_ID).then(
        () => 'allowed',
        () => 'refused',
      );
      if (outcome === 'allowed') allowed.push(role);
    }
    expect(allowed).toEqual(['ADMIN', 'LEAD']);
  });

  it('a role that is none of the three (a fourth, added later) is refused before anything is read', async () => {
    const world = createCostWorld();
    const fourth = { id: ENGINEER.id, role: 'INVENTED_VIEWER' } as unknown as Parameters<typeof world.service.getNodeCosts>[0];
    await expect(world.service.getNodeCosts(fourth, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).rejects.toThrow('Unhandled role.');
    for (const log of Object.values(world.reads)) expect(log.calls).toEqual([]);
  });

  it('an estimate that does not exist is a 404 for a Lead, and reads no part and no working', async () => {
    const world = createCostWorld();
    await expect(world.service.getNodeCosts(LEAD, UNKNOWN_ID, COST_FIRST_NODE_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(world.reads.nodes.calls).toEqual([]);
    expect(world.reads.working.calls).toEqual([]);
  });

  it('a part that is not in this estimate (another estimate\'s, an unknown one, an ID that is no UUID) is the same 404, and no working is read for it', async () => {
    const world = createCostWorld();
    for (const nodeId of [UNKNOWN_ID, 'not-an-id', '']) await expect(world.service.getNodeCosts(LEAD, COST_ESTIMATE_ID, nodeId), nodeId).rejects.toBeInstanceOf(NotFoundError);
    await expect(world.service.getNodeCostsBySlNo(LEAD, COST_ESTIMATE_ID, '9.9')).rejects.toBeInstanceOf(NotFoundError);
    expect(world.reads.working.calls).toEqual([]);
  });

  it('is refused for an Engineer by the service itself even when built with no other guard in front (the second guard)', async () => {
    const world = createCostWorld();
    const service = createCostDetailsService(world.dependencies);
    await expect(service.getNodeCosts(ENGINEER, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
  });
});

describe('a configuration version without the field of the count is a fault in the data, said in plain words', () => {
  it('names the field it needs', async () => {
    const world = createCostWorld();
    const version = await world.dependencies.configuration.byId('00000000-0000-4000-8000-0000000c0f21');
    const withoutCount = {
      ...world.dependencies,
      configuration: { ...world.dependencies.configuration, byId: () => Promise.resolve({ ...version, document: { ...version.document, fields: version.document.fields.map((field) => (field.systemRole === 'quantity' ? { ...field, systemRole: null } : field)) } }) },
    };
    await expect(createCostDetailsService(withoutCount).getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID)).rejects.toThrow('The configuration version has no field for the count of a part.');
  });
});
