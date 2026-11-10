import { describe, expect, it, vi } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { createFixedClock } from '@/lib/time';
import { EXCHANGE_RATES_OBJECT_ID } from '@/lib/masters/exchange-rates';
import { createAuditService } from '@/server/services/audit-service';
import { createMastersService } from '@/server/services/masters-service';

import { createFakeAuditWorld } from '../support/fake-audit';
import { createFakeMasterRepository } from '../support/fake-masters';
import { cloneSeedConfig, seedConfig, seedFieldAt } from '../support/seed-config';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-02.04 T2 (AC-1 to AC-5): the rules of the Exchange Rate Master service over in-memory storage and the real audit service. The real
 * storage, the table lock and the constraints are tested against PostgreSQL in `tests/integration/masters/exchange-rates.test.ts`. Every name
 * and number is invented (`n.37`, ADR-014), except inputs that test the format.
 */

const CONTEXT = { actorId: '00000000-0000-4000-8000-abcdef000001', actorLabel: 'Invented Admin', requestId: 'req-0a0b0c0d' } as const;
const SAVED = { usd: '83.37', eur: '90.37' } as const;
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
const START = new Date('2026-11-09T09:40:00.000Z');

function build(document = seedConfig) {
  const world = createFakeAuditWorld();
  const masters = createFakeMasterRepository();
  const clock = createFixedClock(START);
  const currentConfiguration = vi.fn(() => Promise.resolve(document));
  const service = createMastersService({ masters, transactions: world.transactions, audit: createAuditService({ audit: world.audit }), currentConfiguration, clock });
  return { world, masters, clock, service, currentConfiguration };
}

describe('getExchangeRates (AC-1)', () => {
  it('says "not set yet" with nulls and no stamp while no rate was saved', async () => {
    const { service } = build();
    expect(await service.getExchangeRates()).toMatchObject({ usd: null, eur: null, updatedBy: null, updatedAt: null });
  });

  it('gives the stored rates, who saved them and when (an ISO instant in UTC)', async () => {
    const { service } = build();
    await service.saveExchangeRates(CONTEXT, SAVED);
    expect(await service.getExchangeRates()).toMatchObject({ usd: '83.37', eur: '90.37', updatedBy: 'Invented Admin', updatedAt: '2026-11-09T09:40:00.000Z' });
  });
});

describe('the columns of the hints come from the registry (AC-5, UX-23)', () => {
  it('names the rate column and the price column of each currency by the letters the registry has now', async () => {
    const { service } = build();
    expect((await service.getExchangeRates()).columns).toEqual({
      usd: { rate: { letter: 'BH', label: 'Exchange Rate USD' }, price: { letter: 'BJ', label: 'Unit Production Price (USD)' } },
      eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
    });
  });

  it('follows a re-lettering: move the USD rate and its price to other positions and the letters in the answer change with them', async () => {
    const moved = cloneSeedConfig();
    const rate = moved.fields.find((field) => field.key === 'exchange-rate-usd');
    const price = moved.fields.find((field) => field.key === 'unit-price-usd');
    expect(rate?.position).toBe(seedFieldAt('BH').position);
    // Positions are the letters (FR-021): BH is the 60th column, BJ the 62nd. A test registry that has two more columns before them moves both by two.
    if (rate !== undefined) rate.position += 2;
    if (price !== undefined) price.position += 2;
    const { service } = build(moved);
    const { usd, eur } = (await service.getExchangeRates()).columns;
    expect(usd.rate.letter).toBe('BJ');
    expect(usd.price.letter).toBe('BL');
    expect(eur.rate.letter).toBe('BI');
  });

  it('fails loudly, and writes nothing, when the registry has no field for a hint, rather than printing a typed letter', async () => {
    const damaged = cloneSeedConfig();
    damaged.fields = damaged.fields.filter((field) => field.key !== 'unit-price-eur');
    const { service, world, masters } = build(damaged);
    await expect(service.getExchangeRates()).rejects.toThrow('unit-price-eur');
    await expect(service.saveExchangeRates(CONTEXT, SAVED)).rejects.toThrow('unit-price-eur');
    expect(masters.exchange.usd).toBeNull();
    expect(world.audit.committed).toHaveLength(0);
  });
});

describe('saveExchangeRates (AC-2, AC-4)', () => {
  it('stores both rates with one stamp and writes exactly one master.edited entry of object type exchange_rate, with both rates before and after', async () => {
    const { service, world, masters } = build();
    const view = await service.saveExchangeRates(CONTEXT, SAVED);
    expect(view).toMatchObject({ usd: '83.37', eur: '90.37', updatedBy: 'Invented Admin', updatedAt: START.toISOString() });
    expect(masters.exchange).toMatchObject({ usd: '83.37', eur: '90.37', stamp: { updatedById: CONTEXT.actorId, updatedAt: START } });
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.committed[0]).toMatchObject({
      event: 'master.edited',
      objectType: 'exchange_rate',
      objectId: EXCHANGE_RATES_OBJECT_ID,
      objectLabel: 'Exchange rates',
      before: { usd: null, eur: null },
      after: { usd: '83.37', eur: '90.37' },
      actorId: CONTEXT.actorId,
    });
  });

  it('writes the rates to two decimals and without leading zeros, and takes the stamp from the clock it was given', async () => {
    const { service, clock, masters } = build();
    clock.advance(86_400_000);
    await service.saveExchangeRates(CONTEXT, { usd: '083.5', eur: ' 0 ' });
    expect(masters.exchange).toMatchObject({ usd: '83.50', eur: '0.00' });
    expect(masters.exchange.stamp?.updatedAt.toISOString()).toBe('2026-11-10T09:40:00.000Z');
  });

  it('records a change of one rate with both rates in the entry, and stamps the pair anew', async () => {
    const { service, world, clock } = build();
    await service.saveExchangeRates(CONTEXT, SAVED);
    clock.advance(60_000);
    const view = await service.saveExchangeRates(CONTEXT, { usd: '84.37', eur: SAVED.eur });
    expect(view.updatedAt).toBe('2026-11-09T09:41:00.000Z');
    expect(world.audit.committed).toHaveLength(2);
    expect(world.audit.committed[1]).toMatchObject({ before: { usd: '83.37', eur: '90.37' }, after: { usd: '84.37', eur: '90.37' } });
  });

  it('writes no stamp, no row and no entry for a save that changes nothing, however the same numbers are written (idempotent)', async () => {
    const { service, world, masters, clock } = build();
    const first = await service.saveExchangeRates(CONTEXT, SAVED);
    const save = vi.spyOn(masters, 'saveExchangeRates');
    clock.advance(60_000);
    expect(await service.saveExchangeRates(CONTEXT, SAVED)).toEqual(first);
    expect(await service.saveExchangeRates(CONTEXT, { usd: '083.37', eur: ' 90.37' })).toEqual(first);
    expect(save).not.toHaveBeenCalled();
    expect(world.audit.committed).toHaveLength(1);
  });

  it('takes the table lock before it reads the rows, as every master does (PRF-01)', async () => {
    const { service, masters } = build();
    const lock = vi.spyOn(masters, 'lockExchangeRates');
    const find = vi.spyOn(masters, 'findExchangeRatesForUpdate');
    await service.saveExchangeRates(CONTEXT, SAVED);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0] ?? 0);
  });

  it('reads the configuration before the transaction opens, so a read that fails writes nothing (QLT-05)', async () => {
    const { service, world, masters, currentConfiguration } = build();
    currentConfiguration.mockRejectedValueOnce(new Error('no configuration'));
    await expect(service.saveExchangeRates(CONTEXT, SAVED)).rejects.toThrow('no configuration');
    expect(masters.exchangeLockCount()).toBe(0);
    expect(masters.exchange.usd).toBeNull();
    expect(world.audit.committed).toHaveLength(0);
  });
});

describe('saveExchangeRates refuses what the rules refuse (AC-3)', () => {
  it.each([
    ['blank', ''],
    ['spaces only', '   '],
    ['negative', '-0.01'],
    ['not a number', 'abc'],
    ['three decimals', '83.371'],
    ['a sign', '+1'],
    ['more than 12 digits', '1234567890123'],
  ])('a %s value: 422 naming the field, nothing stored, no lock, no entry', async (_name, value) => {
    const { service, world, masters } = build();
    await service.saveExchangeRates(CONTEXT, SAVED);
    const locks = masters.exchangeLockCount();
    const error = await refusal(service.saveExchangeRates(CONTEXT, { usd: SAVED.usd, eur: value }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ fields: [{ field: 'eur', message: NUMBER_MESSAGE }] });
    expect(masters.exchange).toMatchObject({ usd: '83.37', eur: '90.37' });
    expect(masters.exchangeLockCount()).toBe(locks);
    expect(world.audit.committed).toHaveLength(1);
  });

  it('names both fields when both are wrong, in the order of the form', async () => {
    const { service } = build();
    expect(await refusal(service.saveExchangeRates(CONTEXT, { usd: '-1', eur: '' }))).toMatchObject({ fields: [{ field: 'usd' }, { field: 'eur' }] });
  });

  it('accepts 0 for either rate (assumption A-1)', async () => {
    const { service } = build();
    expect(await service.saveExchangeRates(CONTEXT, { usd: '0', eur: '0.00' })).toMatchObject({ usd: '0.00', eur: '0.00' });
  });
});
