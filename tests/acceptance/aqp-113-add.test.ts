import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_REFUSED_CODE, NAME_TAKEN_CODE } from '@/lib/errors';
import { NAME_TAKEN_MESSAGE, PROCESS_UNITS } from '@/lib/masters/process-items';
import { ORIGIN, call, NEW, create, idOf, firstError, adminId, names, rowOf, openWorld, closeWorld, setUserId, loadProcessMasterRoutes } from '../support/process-master-api';

/**
 * QA acceptance, AQP-113 (STORY-02.01) AC-2: add a rate through `POST /api/v1/process-items`: units, default-value and name boundaries,
 * uniqueness ignoring letter case, column letters, operators and odd names.
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

describe('the Process master over the API: add a rate (AC-2)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });
  describe('AC-2: add a rate', () => {
    it('[AQP-113 AC-2] adds a rate: 201, the stored decimal text, a new ID, empty usedBy; a value typed with fewer decimals is stored with two', async () => {
      const answer = await create('Qa2-Added-Rate', { defaultValue: '5' });
      expect(answer.status).toBe(201);
      expect(answer.body).toMatchObject({ name: 'Qa2-Added-Rate', unit: 'per kg', defaultValue: '5.00', usedBy: [] });
      expect(await rowOf(idOf(answer))).toMatchObject({ name: 'Qa2-Added-Rate', unit: 'per kg' });
    });

    it.each(PROCESS_UNITS.map((unit) => [unit]))('[AQP-113 AC-2] accepts the unit "%s"', async (unit) => {
      const answer = await create(`Qa2-Unit-${unit.replace(/[^a-z]/gi, '')}-Rate`, { unit });
      expect(answer.status).toBe(201);
      expect(answer.body?.['unit']).toBe(unit);
    });

    it.each([
      ['0', '0.00'],
      ['0.00', '0.00'],
      ['0.5', '0.50'],
      ['12.34', '12.34'],
      ['003.37', '3.37'],
      [' 2.5 ', '2.50'],
      ['999999999999.99', '999999999999.99'],
    ])('[AQP-113 AC-2] default value %j is accepted and stored as %j (boundary: 0 and 12 digits)', async (typed, stored) => {
      const answer = await create(`Qa2-Value-${stored.replace('.', 'p')}-${typed.trim().length}${typed.startsWith(' ') ? 'S' : 'N'}-Rate`, { defaultValue: typed });
      expect(answer.status).toBe(201);
      expect(answer.body?.['defaultValue']).toBe(stored);
    });

    it.each([
      ['-1', 'a negative number'],
      ['-0', 'a sign'],
      ['1.005', 'three decimals'],
      ['1.', 'a trailing point'],
      ['.5', 'no digit before the point'],
      ['1e3', 'an exponent'],
      ['1,000', 'a thousands separator'],
      ['1000000000000', '13 digits before the point'],
      ['abc', 'letters'],
      ['', 'nothing'],
      ['NaN', 'NaN'],
      ['Infinity', 'Infinity'],
      ['+5', 'a plus sign'],
      ['0x10', 'hexadecimal'],
    ])('[AQP-113 AC-2] refuses the default value %j (%s) with 422 and the UX words, and stores nothing', async (typed) => {
      const before = await names();
      const answer = await create(`Qa2-Bad-Value-${before.length}`, { defaultValue: typed });
      expect(answer.status).toBe(422);
      expect(firstError(answer)).toEqual({ field: 'defaultValue', message: 'Enter a number, 0 or more, with up to 2 decimals.' });
      expect(await names()).toEqual(before);
    });

    it('[AQP-113 AC-2] refuses a default value sent as a JSON number (a rate is decimal text, never a floating-point value)', async () => {
      const answer = await call('POST', null, { name: 'Qa2-Json-Number', unit: 'per kg', defaultValue: 1.37 });
      expect(answer.status).toBe(422);
      expect(firstError(answer).field).toBe('defaultValue');
    });

    it('[AQP-113 AC-2] name length: 100 characters accepted, 101 refused; empty and spaces-only refused with "Enter a name."', async () => {
      const hundred = `Q${'a'.repeat(99)}`;
      expect((await create(hundred)).status).toBe(201);
      const tooLong = await create(`${hundred}a`);
      expect(tooLong.status).toBe(422);
      expect(firstError(tooLong)).toEqual({ field: 'name', message: 'Use 100 characters or fewer.' });
      for (const blank of ['', '   ']) {
        const answer = await call('POST', null, { name: blank, ...NEW });
        expect(answer.status).toBe(422);
        expect(firstError(answer)).toEqual({ field: 'name', message: 'Enter a name.' });
      }
    });

    it('[AQP-113 AC-2] the unit must be one of the list: "Choose a unit."; a missing unit and an unknown unit are refused', async () => {
      for (const unit of ['per metre', '', 'PER KG', 5]) {
        const answer = await call('POST', null, { name: 'Qa2-Bad-Unit', unit, defaultValue: '1.00' });
        expect(answer.status, JSON.stringify(unit)).toBe(422);
        expect(firstError(answer)).toEqual({ field: 'unit', message: 'Choose a unit.' });
      }
      const missing = await call('POST', null, { name: 'Qa2-Missing-Unit', defaultValue: '1.00' });
      expect(missing.status).toBe(422);
    });

    it('[AQP-113 AC-2] a body with an extra key, a missing value, a non-object body and invalid JSON are refused (422, 422, 422, 400)', async () => {
      expect((await call('POST', null, { name: 'Qa2-Extra', ...NEW, id: '00000000-0000-4000-8000-000000000001' })).status).toBe(422);
      expect((await call('POST', null, { name: 'Qa2-No-Value', unit: 'per kg' })).status).toBe(422);
      expect((await call('POST', null, ['x'])).status).toBe(422);
      expect((await call('POST', null, undefined, { rawBody: '{not json' })).status).toBe(400);
      expect(await names()).not.toContain('Qa2-Extra');
    });

    it('[AQP-113 AC-2] the name is unique ignoring letter case and surrounding spaces: 422 NAME_TAKEN with the UX words, for a new name and for a seed name', async () => {
      await create('Qa2-Unique-Rate');
      for (const again of ['Qa2-Unique-Rate', 'QA2-UNIQUE-RATE', 'qa2-unique-rate', '  Qa2-Unique-Rate  ', 'CUTTING-RATE-PER-SEC', 'foam cost']) {
        const answer = await create(again);
        expect(answer.status, again).toBe(422);
        expect(answer.body?.['code']).toBe(NAME_TAKEN_CODE);
        expect(firstError(answer)).toEqual({ field: 'name', message: NAME_TAKEN_MESSAGE });
      }
    });

    it.each(['A', 'B', 'Z', 'AA', 'AB', 'AL', 'BO', 'ZZZ', 'XFD'])(
      '[AQP-113 AC-2] refuses the column letter %s as a rate name (RATE_NAME_REFUSED, the name field)',
      async (letters) => {
        const answer = await create(letters);
        expect(answer.status).toBe(422);
        expect(answer.body?.['code']).toBe(NAME_REFUSED_CODE);
        expect(firstError(answer).field).toBe('name');
        expect(await names()).not.toContain(letters);
      },
    );

    it.each(['5', '1.5', 'SUM', 'IF', 'ROUND', 'Cost + Waste', 'A-B', 'A B', '{{rate:00000000-0000-4000-8000-000400000001}}', 'x(y)', 'ExchangeRate-USD', 'Qa2 a/b', 'Qa2 a*b', 'Qa2-<b>bold</b>-Rate'])(
      '[AQP-113 AC-2] refuses %j: it would read as a number, a function, an operator, an operand or a reference',
      async (candidate) => {
        const answer = await create(candidate);
        expect(answer.status, candidate).toBe(422);
        expect([NAME_REFUSED_CODE, NAME_TAKEN_CODE]).toContain(answer.body?.['code']);
      },
    );

    it('[AQP-113 AC-2] odd but harmless names are stored as text: quotes, SQL words, HTML, accents, a % ending (parameterised, nothing runs)', async () => {
      for (const odd of ["Qa2-O'Brien-Rate", 'Qa2-x; DROP TABLE process_items;--', 'Qa2-&lt;script&gt;-Rate', 'Qa2-"quoted"-Rate', 'Qa2-Rate-\u00e9-Ünï', 'Qa2 Share %']) {
        const answer = await create(odd);
        expect(answer.status, odd).toBe(201);
        expect(answer.body?.['name']).toBe(odd);
      }
      expect(await names()).toContain('Plating-rate-per-sqin');
    });
  });
});
