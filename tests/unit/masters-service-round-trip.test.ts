import { describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_REFUSED_CODE } from '@/lib/errors';
import type { ConfigDocument } from '@/lib/fields/schema';
import { ROUND_TRIP_MESSAGE } from '@/lib/masters/process-items';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository, seedRecords } from '../support/fake-masters';
import { configurationWithFormula, rateRef } from '../support/formula-config';
import { SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.01 (AC-2, AC-3), QLT-15 and QLT-17 of the G6 of AQP-113 (DEF-006): a rate name may not change how a formula that is already
 * stored reads back from display form. The configuration holds `{{rate:A}}-{{rate:B}}`; the two sets the quality reviewer found, which
 * the name rules alone let through, are refused at the step that breaks it, on an add and on a rename, in every order that reaches
 * it. The seed names with the seed configuration are still accepted, and a set or a formula that was already broken does not refuse
 * every later change. Every name is invented.
 */

const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const RATE = { unit: 'per kg', defaultValue: '1.37' } as const;
const id = (index: number): string => `00000000-0000-4000-8000-0ddd${String(index).padStart(8, '0')}`;

/** A service over the 15 seed rates plus `extra` (given names, IDs in order from `id(1)`), and a configuration. */
function build(extra: ReadonlyArray<string>, document: ConfigDocument = seedConfig) {
  const world = createFakeAuditWorld();
  const masters = createFakeMasterRepository([...seedRecords(), ...extra.map((name, index) => ({ id: id(index + 1), name, unit: 'per kg', defaultValue: '1.37' }))]);
  const service = createMastersService({ masters, transactions: world.transactions, audit: createAuditService({ audit: world.audit }), currentConfiguration: () => Promise.resolve(document) });
  const idOf = (name: string): string => masters.records.find((record) => record.name === name)?.id ?? '';
  return { world, masters, service, idOf };
}

type Built = ReturnType<typeof build>;
const add = (built: Built, name: string) => built.service.createProcessItem(CONTEXT, { name, ...RATE });
const rename = (built: Built, from: string, to: string) => built.service.updateProcessItem(CONTEXT, built.idOf(from), { name: to });
const names = (built: Built): string[] => built.masters.records.map((record) => record.name);

/** The formula `Cost - Waste-Fee`: rates 1 and 2 of `build(['Cost', 'Waste-Fee', ...])`. */
const COST_MINUS_WASTE_FEE = configurationWithFormula(`${rateRef(id(1))}-${rateRef(id(2))}`);

async function expectRoundTripRefusal(action: Promise<unknown>): Promise<void> {
  const error = await refusal(action);
  expect(error).toBeInstanceOf(FieldValidationError);
  expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name', message: ROUND_TRIP_MESSAGE }] });
  expect(JSON.stringify(error)).not.toMatch(/Cost|Waste|Fee/);
}

describe('set (a), a longer name hides a valid split: Cost, Waste-Fee, Cost-Waste, Cost-Waste-Fee (QLT-15)', () => {
  it('adding Cost-Waste (the guards pass; only the stored formula can tell) is refused by the round-trip check', async () => {
    const built = build(['Cost', 'Waste-Fee'], COST_MINUS_WASTE_FEE);
    await expectRoundTripRefusal(add(built, 'Cost-Waste'));
    expect(names(built)).not.toContain('Cost-Waste');
    expect(built.world.audit.appended).toEqual([]);
  });

  it('adding Cost-Waste-Fee is refused, as the first or as the second of the two', async () => {
    const first = build(['Cost', 'Waste-Fee'], COST_MINUS_WASTE_FEE);
    expect(await refusal(add(first, 'Cost-Waste-Fee'))).toMatchObject({ code: NAME_REFUSED_CODE });
    const second = build(['Cost', 'Waste-Fee'], COST_MINUS_WASTE_FEE);
    await expectRoundTripRefusal(add(second, 'Cost-Waste'));
    expect(await refusal(add(second, 'Cost-Waste-Fee'))).toMatchObject({ code: NAME_REFUSED_CODE });
    expect(names(first)).not.toContain('Cost-Waste-Fee');
    expect(names(second)).not.toEqual(expect.arrayContaining(['Cost-Waste', 'Cost-Waste-Fee']));
  });

  it('renaming a rate into either compound is refused, and the rate keeps its name', async () => {
    const built = build(['Cost', 'Waste-Fee', 'Xx1', 'Xx2'], COST_MINUS_WASTE_FEE);
    await expectRoundTripRefusal(rename(built, 'Xx1', 'Cost-Waste'));
    expect(await refusal(rename(built, 'Xx2', 'Cost-Waste-Fee'))).toMatchObject({ code: NAME_REFUSED_CODE });
    expect(names(built)).toEqual(expect.arrayContaining(['Xx1', 'Xx2']));
    expect(built.world.audit.appended).toEqual([]);
  });
});

describe('set (b), overlapping names and no compound name at all: Cost, Waste-Fee, Cost-Waste, Fee (QLT-15)', () => {
  it('Fee first (accepted: the formula still reads back), then Cost-Waste: refused at the step that breaks the formula', async () => {
    const built = build(['Cost', 'Waste-Fee'], COST_MINUS_WASTE_FEE);
    await add(built, 'Fee');
    await expectRoundTripRefusal(add(built, 'Cost-Waste'));
    expect(names(built)).toContain('Fee');
    expect(names(built)).not.toContain('Cost-Waste');
  });

  it('Cost-Waste first: refused at once (the formula could not be read back at all), and Fee is accepted afterwards', async () => {
    const built = build(['Cost', 'Waste-Fee'], COST_MINUS_WASTE_FEE);
    await expectRoundTripRefusal(add(built, 'Cost-Waste'));
    await add(built, 'Fee');
    expect(names(built)).toContain('Fee');
  });

  it('by rename: one rate becomes Fee (accepted), another becomes Cost-Waste (refused), in that order and in the other', async () => {
    const built = build(['Cost', 'Waste-Fee', 'Xx1', 'Xx2'], COST_MINUS_WASTE_FEE);
    await rename(built, 'Xx2', 'Fee');
    await expectRoundTripRefusal(rename(built, 'Xx1', 'Cost-Waste'));
    const other = build(['Cost', 'Waste-Fee', 'Xx1', 'Xx2'], COST_MINUS_WASTE_FEE);
    await expectRoundTripRefusal(rename(other, 'Xx1', 'Cost-Waste'));
    await rename(other, 'Xx2', 'Fee');
    expect(names(other)).toEqual(expect.arrayContaining(['Xx1', 'Fee']));
  });
});

describe('what the round-trip check leaves alone', () => {
  it('a name that breaks no stored formula is accepted, and so is a rename that changes only the letter case', async () => {
    const built = build(['Cost', 'Waste-Fee', 'Xx1'], COST_MINUS_WASTE_FEE);
    await add(built, 'Buffing-rate-per-sqin');
    await rename(built, 'Xx1', 'Other-rate');
    await rename(built, 'Cost', 'cost');
    expect(names(built)).toEqual(expect.arrayContaining(['Buffing-rate-per-sqin', 'Other-rate', 'cost']));
  });

  it('the 15 seed names with the seed configuration: every add and every rename is still accepted, and the stored formulas all round-trip', async () => {
    const built = build([]);
    for (const item of SEED_PROCESS_ITEMS) await rename(built, item.name, `${item.name} renamed`);
    await add(built, 'Buffing-rate-per-sqin');
    expect(names(built)).toHaveLength(16);
  });

  it('delete needs no check: a rate no formula uses is deleted whatever the names look like', async () => {
    const built = build(['Cost', 'Waste-Fee', 'Xx1'], COST_MINUS_WASTE_FEE);
    await built.service.deleteProcessItem(CONTEXT, built.idOf('Xx1'));
    expect(names(built)).not.toContain('Xx1');
  });
});

describe('only what the change itself introduces counts (QLT-17)', () => {
  it('a stored set that was already unsafe does not refuse an unrelated add or rename', async () => {
    const built = build(['Cost-Waste', 'Cost', 'Waste', 'Qq-Rr']);
    await add(built, 'Harmless-rate');
    await rename(built, 'Harmless-rate', 'Harmless-rate-2');
    expect(names(built)).toContain('Harmless-rate-2');
  });

  it('but an add that makes another name ambiguous is still refused, though the set was already unsafe', async () => {
    const built = build(['Cost-Waste', 'Cost', 'Waste', 'Qq-Rr']);
    await add(built, 'Qq');
    const error = await refusal(add(built, 'Rr'));
    expect(error).toMatchObject({ code: NAME_REFUSED_CODE, fields: [{ field: 'name' }] });
    expect(JSON.stringify(error)).not.toMatch(/Qq|Rr/);
  });

  it('a formula that did not round-trip before the change does not refuse it, and the one the change breaks still does', async () => {
    // {{Cost}}-{{Waste}} already reads back as the compound Cost-Waste; Cost-Waste is in the set before this add.
    const document = configurationWithFormula(`${rateRef(id(1))}-${rateRef(id(2))}`);
    const built = build(['Cost', 'Waste', 'Cost-Waste', 'Yy1'], document);
    await add(built, 'Harmless-rate');
    await rename(built, 'Yy1', 'Yy2');
    expect(names(built)).toEqual(expect.arrayContaining(['Harmless-rate', 'Yy2']));
  });
});
