import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_REFUSED_CODE, NAME_TAKEN_CODE } from '@/lib/errors';
import { ROUND_TRIP_MESSAGE } from '@/lib/masters/process-items';
import { entryCount } from '../support/audit-database';
import { rateRef } from '../support/formula-config';
import { seedFieldAt } from '../support/seed-config';
import { ORIGIN, create, rename, idOf, firstError, db, adminId, names, rowOf, idByName, installVersion, openWorld, closeWorld, configurationWithFormula, setUserId, seenRefusals, namesUsed, loadProcessMasterRoutes, aMinusB, type Answer } from '../support/process-master-api';

/**
 * QA verification of DEF-006 (AQP-181), round 2 and 3 (QLT-15): a formula `{{rate:A}}-{{rate:B}}` stored as a `config_versions` row, and the
 * names that would change how it reads back from display form: probes (a) and (b) on add and on rename in both orders, a column letter plus
 * a hyphen, spaced operators, and the renamed rate inside the formula. The last test reads every refusal seen in this file and checks that no
 * message names a rate, a formula or a value.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadProcessMasterRoutes();
});

function probeWorld(title: string, firstName: string, secondName: string, makeFormula: (first: string, second: string) => string, run: () => void): void {
  describe(title, () => {
    beforeAll(async () => {
      await openWorld();
      const first = idOf(await create(firstName));
      const second = idOf(await create(secondName));
      await installVersion(configurationWithFormula(makeFormula(first, second)), 2);
    });
    afterAll(closeWorld);
    beforeEach(() => {
      vi.stubEnv('APP_ORIGIN', ORIGIN);
      setUserId(adminId);
    });
    run();
  });
}

const FORMULA_REFUSAL = { code: NAME_REFUSED_CODE, message: ROUND_TRIP_MESSAGE };

/** Cost-Waste-Fee reads as the formula's own two rates, so the name guard itself refuses it, before the round trip is asked. */
function expectRefusedByAnyGuard(answer: Answer): void {
  expect(answer.status).toBe(422);
  expect(answer.body?.['code']).toBe(NAME_REFUSED_CODE);
  expect(firstError(answer).field).toBe('name');
}

async function expectRoundTripRefusal(answer: Answer): Promise<void> {
  expect(answer.status).toBe(422);
  expect(answer.body?.['code']).toBe(FORMULA_REFUSAL.code);
  expect(firstError(answer)).toEqual({ field: 'name', message: FORMULA_REFUSAL.message });
}


describe('QLT-15 probes through the API, with the formula stored as a configuration version', () => {
  probeWorld('probe (a): Cost, Waste-Fee, Cost-Waste, Cost-Waste-Fee; stored Cost-Waste-Fee as {{Cost}}-{{Waste-Fee}}, ADD, compound first', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15a] Cost-Waste is refused at the step that breaks the formula, then Cost-Waste-Fee is refused; no row and no entry', async () => {
      const entries = await entryCount(db);
      await expectRoundTripRefusal(await create('Cost-Waste'));
      expectRefusedByAnyGuard(await create('Cost-Waste-Fee'));
      expect(await names()).not.toContain('Cost-Waste');
      expect(await names()).not.toContain('Cost-Waste-Fee');
      expect(await entryCount(db)).toBe(entries);
    });
  });

  probeWorld('probe (a), the other order: the long compound first', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15a] Cost-Waste-Fee is refused, then Cost-Waste is refused', async () => {
      expectRefusedByAnyGuard(await create('Cost-Waste-Fee'));
      await expectRoundTripRefusal(await create('Cost-Waste'));
      expect(await names()).not.toContain('Cost-Waste');
    });
  });

  probeWorld('probe (a) by rename', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15a] a spare rate renamed into Cost-Waste, then into Cost-Waste-Fee, is refused both times and keeps its name; no entry', async () => {
      const spare = idOf(await create('Zz-Spare-A'));
      const entries = await entryCount(db);
      await expectRoundTripRefusal(await rename(spare, 'Cost-Waste'));
      expectRefusedByAnyGuard(await rename(spare, 'Cost-Waste-Fee'));
      expect((await rowOf(spare))?.name).toBe('Zz-Spare-A');
      expect(await entryCount(db)).toBe(entries);
    });

    it('[AQP-113 DEF-006 QLT-15a] a harmless rename of the same spare rate is accepted', async () => {
      const spare = await idByName('Zz-Spare-A');
      expect((await rename(spare, 'Zz-Spare-A2')).status).toBe(200);
    });
  });

  probeWorld('probe (b): Cost, Waste-Fee, Cost-Waste, Fee; stored {{Cost}}-{{Waste-Fee}}, ADD, Fee first', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15b] Fee is accepted (it breaks nothing alone), then Cost-Waste is refused at the step that breaks the formula; no row, no entry', async () => {
      expect((await create('Fee')).status).toBe(201);
      const entries = await entryCount(db);
      await expectRoundTripRefusal(await create('Cost-Waste'));
      expect(await names()).not.toContain('Cost-Waste');
      expect(await entryCount(db)).toBe(entries);
    });
  });

  probeWorld('probe (b), the other order: Cost-Waste first', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15b] Cost-Waste is refused first, then Fee is accepted', async () => {
      await expectRoundTripRefusal(await create('Cost-Waste'));
      expect((await create('Fee')).status).toBe(201);
    });
  });

  probeWorld('probe (b) by rename, both orders', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15b] a spare renamed to Fee is accepted and a second spare renamed to Cost-Waste is refused', async () => {
      const one = idOf(await create('Zz-Spare-B1'));
      const two = idOf(await create('Zz-Spare-B2'));
      expect((await rename(one, 'Fee')).status).toBe(200);
      await expectRoundTripRefusal(await rename(two, 'Cost-Waste'));
      expect((await rowOf(two))?.name).toBe('Zz-Spare-B2');
    });

    it('[AQP-113 DEF-006 QLT-15b] the other order: Cost-Waste first is refused, then Fee is accepted (a third spare)', async () => {
      const three = idOf(await create('Zz-Spare-B3'));
      const four = idOf(await create('Zz-Spare-B4'));
      await expectRoundTripRefusal(await rename(three, 'Cost-Waste'));
      expect((await rename(four, 'Fee2')).status).toBe(200);
    });
  });

  describe('a column letter plus a hyphen: stored {{field AL}}-{{rate Waste-Fee}}', () => {
    let waste: string;
    beforeAll(async () => {
      await openWorld();
      waste = idOf(await create('Waste-Fee'));
      const letterAl = seedFieldAt('AL');
      await installVersion(configurationWithFormula(`{{f:${letterAl.id}}}-${rateRef(waste)}`), 2);
    });
    afterAll(closeWorld);
    beforeEach(() => {
      vi.stubEnv('APP_ORIGIN', ORIGIN);
      setUserId(adminId);
    });

    it('[AQP-113 DEF-006 QLT-15] the name guards alone pass AL-Waste, but the round trip refuses it: on add (without a rate Fee), and on rename', async () => {
      await expectRoundTripRefusal(await create('AL-Waste'));
      const spare = idOf(await create('Zz-Spare-C'));
      await expectRoundTripRefusal(await rename(spare, 'AL-Waste'));
    });

    it('[AQP-113 DEF-006 QLT-15] with a rate Fee present, AL-Waste is still refused; Fee itself is accepted', async () => {
      expect((await create('Fee')).status).toBe(201);
      await expectRoundTripRefusal(await create('AL-Waste'));
    });
  });

  probeWorld('spaces round the operator: stored {{Cost}} - {{Waste-Fee}}', 'Cost', 'Waste-Fee', (a, b) => `${rateRef(a)} - ${rateRef(b)}`, () => {
    it('[AQP-113 DEF-006 QLT-15] Cost - Waste is refused, and a harmless name is accepted', async () => {
      await expectRoundTripRefusal(await create('Cost - Waste'));
      expect((await create('Harmless-Rate')).status).toBe(201);
    });
  });

  probeWorld('the renamed rate is inside the formula: stored {{X}}-{{Fee}}, Waste-Fee exists', 'Xq', 'Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15] renaming Xq to Waste would make the formula read as Waste-Fee: refused, with no name in the message', async () => {
      expect((await create('Waste-Fee')).status).toBe(201);
      const xq = await idByName('Xq');
      const refused = await rename(xq, 'Waste');
      expect(refused.status).toBe(422);
      expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
      expect((await rowOf(xq))?.name).toBe('Xq');
    });
  });

  probeWorld('the control: the seed configuration and no stored formula that the names could break', 'Cost', 'Waste-Fee', aMinusB, () => {
    it('[AQP-113 DEF-006 QLT-15] a name that touches no stored formula is accepted as before; renaming a rate the stored formula uses to a safe name is accepted', async () => {
      expect((await create('Fee-Only-Rate')).status).toBe(201);
      const cost = await idByName('Cost');
      expect((await rename(cost, 'Cost2')).status).toBe(200);
    });
  });
});

describe('no refusal message names a rate or a formula', () => {
  it('[AQP-113 DEF-006 QLT-15] across every 422 this file saw, the message is one of the fixed sentences or a guard sentence, and holds no rate name, no formula text and no value', () => {
    const nameRefusals = seenRefusals.filter((refusal) => refusal.status === 422 && refusal.body?.['code'] === NAME_REFUSED_CODE);
    const takenRefusals = seenRefusals.filter((refusal) => refusal.status === 422 && refusal.body?.['code'] === NAME_TAKEN_CODE);
    // The probes above refuse a dozen names or more, so an empty list would mean the test read nothing.
    expect(nameRefusals.length).toBeGreaterThan(10);
    // Names of this file's own, longer than three characters and not common words of the sentences themselves.
    const sentenceWords = /\b(name|rate|formula|reads|change|existing|cannot|used|would|this|already|exists|with|another|word|make|ends|part)\b/gi;
    const tokensToLookFor = [...namesUsed].filter((name) => name.length > 3 && !/^(cost|waste|fee)$/i.test(name));
    const messages = new Set<string>();
    for (const refusal of [...nameRefusals, ...takenRefusals]) {
      const errors = (refusal.body?.['errors'] ?? []) as Array<{ field: string; message: string }>;
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
      const message = errors[0]?.message ?? '';
      messages.add(message);
      expect(refusal.text).not.toMatch(/\{\{|rate:|f:[0-9a-f]{8}/);
      for (const name of tokensToLookFor) expect(message.includes(name), `"${message}" names ${name}`).toBe(false);
      // The title and the rest of the body are the fixed sentence of any validation failure.
      expect(refusal.body?.['title']).toBe('Check the values and try again.');
      // Also the short invented words used for probes, as whole words, outside the sentence's own vocabulary.
      const stripped = message.replace(sentenceWords, '');
      for (const probe of ['Cost', 'Waste', 'Fee', 'Pa', 'Qb', 'Alpha', 'Beta', 'Gamma', 'Delta']) expect(stripped.includes(probe), `"${message}" names ${probe}`).toBe(false);
    }
    expect(messages).toContain(ROUND_TRIP_MESSAGE);
  });

  it('[AQP-113 DEF-006 QLT-15] the round-trip sentence is exactly the one the master ruled', () => {
    expect(ROUND_TRIP_MESSAGE).toBe('This name would change how an existing formula reads, so it cannot be used.');
  });
});


