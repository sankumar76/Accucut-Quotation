import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { world, db, adminId, openWorld, closeWorld, setUserId, ORIGIN } from '../support/process-master-api';
import { allRows, auditTotal, callMaterials, callOptions, createMaterial, errorsOf, GOOD, idOf, insertAsOwner, loadMaterialRoutes, rowCount, rowOf } from '../support/material-master-qa-api';

/**
 * QA acceptance, AQP-122 (STORY-02.03 Material Master), AC-1, AC-2 and AC-3 through the real routes over real PostgreSQL: the default filter
 * (`is_hidden = false`), the unique name ignoring letter case and trimmed, the number rule (0 or more, up to 2 decimals, stored as
 * Decimal(18,4)), and the specific-gravity rule that the SERVER enforces on POST and PATCH (UX-37). The oracles are the AC text, the UX spec
 * (SCR-13, v0.18) and plain SQL, not the code. Every number is invented (`n.37`) except the inputs that test the format.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

const NAME_TAKEN = 'A material with this name already exists. Names must be unique.';
const ABOVE_ZERO = 'Enter a value above 0.';
const GRAVITY_FORMAT = 'Enter a number above 0, with up to 2 decimals.';
const NUMBER = 'Enter a number, 0 or more, with up to 2 decimals.';
const NAME_REQUIRED = 'Enter the Material in Drawing.';
const CONSIDERED_REQUIRED = 'Enter the Material Considered.';
const TOO_LONG = 'Use 100 characters or fewer.';
let serial = 0;
/** A number that makes a name new within this run, in place of a random part. */
const nextSerial = (): number => (serial += 1);

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadMaterialRoutes();
});

describe('the Material Master over the API (AC-1, AC-2, AC-3)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  describe('AC-1: the list and the default filter', () => {
    it('[AQP-122 AC-1] starts empty (the table is created empty, ADR-014); a created material is listed with the five fields, as decimal text, no extra key, never cached', async () => {
      const empty = await callMaterials('GET', null);
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ materials: [] });
      const made = await createMaterial('Qa1-Listed-Sheet', { pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' });
      expect(made.status).toBe(201);
      const list = await callMaterials('GET', null);
      expect(list.body).toEqual({
        materials: [{ id: idOf(made), materialInDrawing: 'Qa1-Listed-Sheet', materialConsidered: GOOD.materialConsidered, pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' }],
      });
      expect(list.headers.get('cache-control')).toMatch(/no-store/);
      expect(list.headers.get('cache-control')).toMatch(/private/);
    });

    it('[AQP-122 AC-1] lists in the order the materials were added', async () => {
      for (const name of ['Qa1-Order-C', 'Qa1-Order-A', 'Qa1-Order-B']) await createMaterial(name);
      const names = ((await callMaterials('GET', null)).body?.['materials'] as Array<{ materialInDrawing: string }>).map((row) => row.materialInDrawing);
      expect(names.filter((name) => name.startsWith('Qa1-Order-'))).toEqual(['Qa1-Order-C', 'Qa1-Order-A', 'Qa1-Order-B']);
    });

    it('[AQP-122 AC-1] the default filter: a hidden row and a deleted row are never listed, offered as an option, or reachable by ID (404); nothing changes and no entry is written', async () => {
      const hidden = await insertAsOwner({ name: 'Qa1-Hidden-Row', considered: null, hidden: true });
      const deleted = await insertAsOwner({ name: 'Qa1-Deleted-Row', considered: 'Invented deleted', deleted: true });
      const visible = idOf(await createMaterial('Qa1-Visible-Row'));
      const entries = await auditTotal();
      const listed = JSON.stringify((await callMaterials('GET', null)).body);
      const offered = JSON.stringify((await callOptions()).body);
      for (const text of [listed, offered]) {
        expect(text).toContain(visible);
        expect(text).not.toContain(hidden);
        expect(text).not.toContain(deleted);
        expect(text).not.toContain('Qa1-Hidden-Row');
        expect(text).not.toContain('Qa1-Deleted-Row');
      }
      const attempts = [await callMaterials('PATCH', hidden, { pricePerKg: '1.00' }), await callMaterials('PATCH', deleted, { pricePerKg: '1.00' }), await callMaterials('PATCH', hidden, { materialInDrawing: 'Qa1-Renamed' })];
      expect(attempts.map((attempt) => attempt.status)).toEqual([404, 404, 404]);
      expect((await rowOf(hidden))?.price_per_kg).toBe('0.0000');
      expect((await rowOf(deleted))?.price_per_kg).toBe('0.0000');
      expect(await auditTotal()).toBe(entries);
      expect((await allRows()).length).toBeGreaterThanOrEqual(3);
    });

    it('[AQP-122 AC-1] a hidden or deleted name still holds the name (the unique index covers every row): adding it is refused as taken, and nothing is stored', async () => {
      await insertAsOwner({ name: 'Qa1-Held-Name', considered: 'Invented held', hidden: false, deleted: true });
      const before = await rowCount();
      const again = await createMaterial('qa1-held-name');
      expect(again.status).toBe(422);
      expect(errorsOf(again)).toEqual([`materialInDrawing: ${NAME_TAKEN}`]);
      expect(await rowCount()).toBe(before);
    });
  });

  describe('AC-2: names are unique ignoring letter case, and trimmed', () => {
    it.each([
      ['the same name', 'Qa2-Name-Sheet'],
      ['all capitals', 'QA2-NAME-SHEET'],
      ['all lower case', 'qa2-name-sheet'],
      ['mixed case', 'qA2-nAmE-sHeEt'],
      ['spaces around it', '   Qa2-Name-Sheet   '],
      ['spaces and another case', '  QA2-name-SHEET '],
      ['a tab and a line break around it', '\tQa2-Name-Sheet\n'],
    ])('[AQP-122 AC-2] %s is refused 422 on the name field with the SCR-13 sentence, and nothing is stored', async (_label, typed) => {
      await createMaterial('Qa2-Name-Sheet');
      const count = await rowCount();
      const entries = await auditTotal();
      const refused = await createMaterial(typed);
      expect(refused.status).toBe(422);
      expect(refused.body?.['code']).toBe('NAME_TAKEN');
      expect(errorsOf(refused)).toEqual([`materialInDrawing: ${NAME_TAKEN}`]);
      expect(await rowCount()).toBe(count);
      expect(await auditTotal()).toBe(entries);
    });

    it('[AQP-122 AC-2] the name is stored trimmed, and a name that differs by more than case or spaces is a different material', async () => {
      const spaced = await createMaterial('  Qa2-Trimmed-Name  ');
      expect(spaced.status).toBe(201);
      expect(spaced.body?.['materialInDrawing']).toBe('Qa2-Trimmed-Name');
      expect((await rowOf(idOf(spaced)))?.material_in_drawing).toBe('Qa2-Trimmed-Name');
      expect((await createMaterial('Qa2-Trimmed-Name 2')).status).toBe(201);
      expect((await createMaterial('Qa2-Trimmed Name')).status).toBe(201);
    });

    it('[AQP-122 AC-2] Material Considered is trimmed too, and it need not be unique', async () => {
      const first = await createMaterial('Qa2-Considered-One', { materialConsidered: '  Invented shared  ' });
      expect(first.body?.['materialConsidered']).toBe('Invented shared');
      expect((await createMaterial('Qa2-Considered-Two', { materialConsidered: 'Invented shared' })).status).toBe(201);
    });

    it('[AQP-122 AC-2] an edit onto another material\'s name (any case, with spaces) is refused; a change of the letter case of its own name is accepted and stored', async () => {
      const first = idOf(await createMaterial('Qa2-Rename-First'));
      const second = idOf(await createMaterial('Qa2-Rename-Second'));
      for (const typed of ['Qa2-Rename-First', 'QA2-RENAME-FIRST', ' qa2-rename-first ']) {
        const refused = await callMaterials('PATCH', second, { materialInDrawing: typed });
        expect(refused.status).toBe(422);
        expect(errorsOf(refused)).toEqual([`materialInDrawing: ${NAME_TAKEN}`]);
      }
      expect((await rowOf(second))?.material_in_drawing).toBe('Qa2-Rename-Second');
      const recased = await callMaterials('PATCH', first, { materialInDrawing: 'QA2-RENAME-FIRST' });
      expect(recased.status).toBe(200);
      expect((await rowOf(first))?.material_in_drawing).toBe('QA2-RENAME-FIRST');
    });

    it('[AQP-122 AC-2] four requests at once for one name in four letter cases: exactly one 201, three 422 name taken, no 500, one row', async () => {
      const answers = await Promise.all(['Qa2-Race-Sheet', 'QA2-RACE-SHEET', 'qa2-race-sheet', ' Qa2-Race-SHEET '].map((name) => createMaterial(name)));
      expect(answers.map((answer) => answer.status).sort()).toEqual([201, 422, 422, 422]);
      for (const refused of answers.filter((answer) => answer.status === 422)) expect(errorsOf(refused)).toEqual([`materialInDrawing: ${NAME_TAKEN}`]);
      const { rows } = await db.owner.query('SELECT 1 FROM materials WHERE lower(material_in_drawing) = $1', ['qa2-race-sheet']);
      expect(rows).toHaveLength(1);
    });

    it('[AQP-122 AC-2] the database enforces the same: the runtime role cannot store a name that differs only by case (the backstop of the race)', async () => {
      await createMaterial('Qa2-Backstop-Sheet');
      await expect(db.prisma.$executeRaw`INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('QA2-BACKSTOP-SHEET', 'x', 1)`).rejects.toThrow();
    });
  });

  describe('AC-2 and AC-3: the name and Material Considered', () => {
    it.each([
      ['empty', '', NAME_REQUIRED],
      ['spaces only', '    ', NAME_REQUIRED],
      ['a tab and a line break only', '\t\n', NAME_REQUIRED],
      ['101 characters', 'N'.repeat(101), TOO_LONG],
      ['101 characters after trimming', ` ${'N'.repeat(101)} `, TOO_LONG],
    ])('[AQP-122 AC-3] a Material in Drawing that is %s is refused 422 naming materialInDrawing; nothing is stored', async (_label, typed, message) => {
      const count = await rowCount();
      const entries = await auditTotal();
      const refused = await createMaterial(typed);
      expect(refused.status).toBe(422);
      expect(errorsOf(refused)).toEqual([`materialInDrawing: ${message}`]);
      expect(await rowCount()).toBe(count);
      expect(await auditTotal()).toBe(entries);
    });

    it('[AQP-122 AC-2] a Material in Drawing of exactly 100 characters is accepted (BVA), and a name of 100 characters with spaces round it too', async () => {
      expect((await createMaterial('N'.repeat(100))).status).toBe(201);
      expect((await createMaterial(` ${'M'.repeat(100)} `)).status).toBe(201);
    });

    it.each([
      ['empty', '', CONSIDERED_REQUIRED],
      ['spaces only', '   ', CONSIDERED_REQUIRED],
      ['101 characters', 'C'.repeat(101), TOO_LONG],
    ])('[AQP-122 AC-3] a Material Considered that is %s is refused 422 naming materialConsidered', async (_label, typed, message) => {
      const refused = await createMaterial('Qa3-Considered-Refusal', { materialConsidered: typed });
      expect(refused.status).toBe(422);
      expect(errorsOf(refused)).toEqual([`materialConsidered: ${message}`]);
      expect((await allRows()).some((row) => row.material_in_drawing === 'Qa3-Considered-Refusal')).toBe(false);
    });

    it('[AQP-122 AC-2] names with markup, quotes, SQL words and accents are stored and returned as plain text', async () => {
      for (const name of ['Qa2-<b>bold</b>', 'Qa2-"quoted"', "Qa2-'; DROP TABLE materials; --", 'Qa2-Café ₹ 100%']) {
        const made = await createMaterial(name);
        expect(made.status).toBe(201);
        expect(made.body?.['materialInDrawing']).toBe(name);
      }
      expect(await rowCount()).toBeGreaterThan(4);
    });
  });

  describe('AC-2: Price per kg and Material-Scrap-Rate (per kg) are numbers of 0 or more, up to 2 decimals, stored as Decimal(18,4)', () => {
    it.each(['pricePerKg', 'scrapRate'] as const)('[AQP-122 AC-2] %s accepts the valid shapes and returns them with two decimals', async (field) => {
      const cases: Array<[string, string, string]> = [
        ['0', '0.00', '0.0000'],
        ['0.0', '0.00', '0.0000'],
        ['0.5', '0.50', '0.5000'],
        ['0.01', '0.01', '0.0100'],
        ['12.34', '12.34', '12.3400'],
        ['003.37', '3.37', '3.3700'],
        [' 2.5 ', '2.50', '2.5000'],
        ['10', '10.00', '10.0000'],
        ['999999999999.99', '999999999999.99', '999999999999.9900'],
      ];
      for (const [index, [typed, shown, stored]] of cases.entries()) {
        const made = await createMaterial(`Qa2-${field}-${index}`, { [field]: typed });
        expect(made.status, typed).toBe(201);
        expect(made.body?.[field], typed).toBe(shown);
        const column = field === 'pricePerKg' ? 'price_per_kg' : 'scrap_rate';
        expect((await rowOf(idOf(made)))?.[column], typed).toBe(stored);
      }
    });

    it.each(['pricePerKg', 'scrapRate'] as const)('[AQP-122 AC-2, AC-3] %s refuses a negative, three decimals, no number, a JSON number and 13 digits: 422 naming the field with the SCR-13 sentence, nothing stored', async (field) => {
      const bad: unknown[] = ['-1', '-0', '-0.01', '1.005', '58.123', '1.', '.5', '1e3', '1,000', '1234567890123', 'abc', '', '  ', 'NaN', 'Infinity', '+5', '0x10', 5, 0, null, true, [], {}];
      const count = await rowCount();
      const entries = await auditTotal();
      for (const typed of bad) {
        const refused = await createMaterial('Qa2-Number-Refusal', { [field]: typed });
        expect(refused.status, JSON.stringify(typed)).toBe(422);
        expect(errorsOf(refused), JSON.stringify(typed)).toEqual([`${field}: ${NUMBER}`]);
      }
      expect(await rowCount()).toBe(count);
      expect(await auditTotal()).toBe(entries);
    });

    it('[AQP-122 AC-2] the three number columns are numeric(18,4) in the database', async () => {
      const { rows } = await db.owner.query<{ column_name: string; numeric_precision: number; numeric_scale: number }>(
        "SELECT column_name, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'materials' AND column_name IN ('price_per_kg','specific_gravity','scrap_rate') ORDER BY column_name",
      );
      expect(rows).toEqual([
        { column_name: 'price_per_kg', numeric_precision: 18, numeric_scale: 4 },
        { column_name: 'scrap_rate', numeric_precision: 18, numeric_scale: 4 },
        { column_name: 'specific_gravity', numeric_precision: 18, numeric_scale: 4 },
      ]);
    });

    it('[AQP-122 AC-2] a PATCH applies the same rule to each number; a refused edit leaves the material as it was', async () => {
      const id = idOf(await createMaterial('Qa2-Patch-Numbers'));
      const before = await rowOf(id);
      for (const field of ['pricePerKg', 'scrapRate']) {
        for (const typed of ['-1', '1.005', 'abc', '', 5]) {
          const refused = await callMaterials('PATCH', id, { [field]: typed });
          expect(refused.status, `${field} ${JSON.stringify(typed)}`).toBe(422);
          expect(errorsOf(refused)).toEqual([`${field}: ${NUMBER}`]);
        }
      }
      expect(await rowOf(id)).toEqual(before);
      const good = await callMaterials('PATCH', id, { pricePerKg: '0', scrapRate: '0.00' });
      expect(good.status).toBe(200);
      expect(good.body).toMatchObject({ pricePerKg: '0.00', scrapRate: '0.00', specificGravity: '7.37' });
    });
  });

  describe('AC-2 and AC-3 (UX-37): the SERVER refuses a specific gravity of 0 or below, on POST and PATCH', () => {
    const ZERO_OR_BELOW = ['0', '0.0', '0.00', '00', '000.00', '-1', '-0.5', '-0.01', '-0', '-0.00', '+0', '+0.00'];
    const BAD_SHAPE = ['0.001', '7.371', '1e3', '', '  ', 'abc', '.5', '5.', '1,5', 'NaN', 'Infinity', '0x1'];

    it.each(ZERO_OR_BELOW)('[AQP-122 AC-2 UX-37] POST with specific gravity "%s": 422 on specificGravity, "Enter a value above 0.", nothing stored, no entry', async (typed) => {
      const count = await rowCount();
      const entries = await auditTotal();
      const refused = await createMaterial('Qa2-Zero-Gravity', { specificGravity: typed });
      expect(refused.status).toBe(422);
      expect(errorsOf(refused)).toEqual([`specificGravity: ${ABOVE_ZERO}`]);
      expect(await rowCount()).toBe(count);
      expect(await auditTotal()).toBe(entries);
    });

    it.each(ZERO_OR_BELOW)('[AQP-122 AC-2 UX-37] PATCH with specific gravity "%s": 422 on specificGravity, the material keeps 7.37, no entry', async (typed) => {
      const id = idOf(await createMaterial(`Qa2-Patch-Gravity-${typed.replace(/[^0-9a-z]/g, '_')}-${nextSerial()}`));
      const entries = await auditTotal();
      const refused = await callMaterials('PATCH', id, { specificGravity: typed });
      expect(refused.status).toBe(422);
      expect(errorsOf(refused)).toEqual([`specificGravity: ${ABOVE_ZERO}`]);
      expect((await rowOf(id))?.specific_gravity).toBe('7.3700');
      expect(await auditTotal()).toBe(entries);
    });

    it.each(BAD_SHAPE)('[AQP-122 AC-3] POST and PATCH with specific gravity "%s" (no number of up to 2 decimals) are refused with the shape sentence', async (typed) => {
      const id = idOf(await createMaterial(`Qa3-Shape-${nextSerial()}`));
      for (const refused of [await createMaterial('Qa3-Shape-Never', { specificGravity: typed }), await callMaterials('PATCH', id, { specificGravity: typed })]) {
        expect(refused.status, typed).toBe(422);
        expect(errorsOf(refused)).toEqual([`specificGravity: ${GRAVITY_FORMAT}`]);
      }
      expect((await rowOf(id))?.specific_gravity).toBe('7.3700');
    });

    it('[AQP-122 AC-2 UX-37] a JSON number or null is refused too, on POST and on PATCH (gravity is decimal text, never a float)', async () => {
      const id = idOf(await createMaterial('Qa2-Json-Gravity'));
      for (const typed of [7.37, 0, -1, null, true]) {
        expect((await createMaterial('Qa2-Json-Never', { specificGravity: typed })).status, String(typed)).toBe(422);
        expect((await callMaterials('PATCH', id, { specificGravity: typed })).status, String(typed)).toBe(422);
      }
    });

    it.each([
      ['0.01', '0.01', '0.0100'],
      ['0.1', '0.10', '0.1000'],
      ['1', '1.00', '1.0000'],
      ['7.37', '7.37', '7.3700'],
      ['007.37', '7.37', '7.3700'],
      ['19.30', '19.30', '19.3000'],
      ['999999999999.99', '999999999999.99', '999999999999.9900'],
    ])('[AQP-122 AC-2 BVA] specific gravity "%s" is accepted by POST and by PATCH and stored as Decimal(18,4)', async (typed, shown, stored) => {
      const made = await createMaterial(`Qa2-Gravity-${typed}`, { specificGravity: typed });
      expect(made.status).toBe(201);
      expect(made.body?.['specificGravity']).toBe(shown);
      const id = idOf(made);
      expect((await rowOf(id))?.specific_gravity).toBe(stored);
      const other = idOf(await createMaterial(`Qa2-Gravity-Patch-${typed}`));
      const patched = await callMaterials('PATCH', other, { specificGravity: typed });
      expect(patched.status).toBe(200);
      expect((await rowOf(other))?.specific_gravity).toBe(stored);
    });

    it('[AQP-122 AC-2 UX-37] the service refuses 0 or below by itself, without the route schema: createMaterial and updateMaterial throw a field error and store nothing', async () => {
      const service = world.service;
      if (service === null) throw new Error('no service');
      const context = { actorId: adminId, actorLabel: 'Invented Admin', requestId: 'req-qa-122' };
      const count = await rowCount();
      await expect(service.createMaterial(context, { materialInDrawing: 'Qa2-Direct', materialConsidered: 'x', pricePerKg: '1.00', specificGravity: '0', scrapRate: '1.00' })).rejects.toMatchObject({
        fields: [{ field: 'specificGravity', message: ABOVE_ZERO }],
      });
      const id = idOf(await createMaterial('Qa2-Direct-Edit'));
      await expect(service.updateMaterial(context, id, { specificGravity: '-3' })).rejects.toMatchObject({ fields: [{ field: 'specificGravity', message: ABOVE_ZERO }] });
      expect(await rowCount()).toBe(count + 1);
      expect((await rowOf(id))?.specific_gravity).toBe('7.3700');
    });

    it('[AQP-122 AC-2 UX-37] the database refuses 0 for a listed row too, even for the owner (the CHECK is the third wall); the hidden row is the one exemption', async () => {
      await expect(db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Qa2-Check-Zero', 'x', 0)")).rejects.toThrow(/ck_materials_specific_gravity_above_zero/);
      await expect(db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity, price_per_kg) VALUES ('Qa2-Check-Price', 'x', 1, -1)")).rejects.toThrow(/ck_materials_price_per_kg_not_negative/);
      await expect(db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity, scrap_rate) VALUES ('Qa2-Check-Scrap', 'x', 1, -1)")).rejects.toThrow(/ck_materials_scrap_rate_not_negative/);
      await expect(db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('   ', 'x', 1)")).rejects.toThrow(/ck_materials_material_in_drawing_not_blank/);
      await expect(db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Qa2-Check-Considered', '  ', 1)")).rejects.toThrow(/ck_materials_material_considered_not_blank/);
      const hidden = await insertAsOwner({ name: 'Qa2-Check-Hidden', considered: null, hidden: true });
      expect((await rowOf(hidden))?.specific_gravity).toBe('0.0000');
    });
  });
});
