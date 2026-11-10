import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createLateFailingRunner } from '../support/late-failure-runner';
import { world, db, adminId, leadId, engineerId, openWorld, closeWorld, setUserId, ORIGIN, FOREIGN_ORIGIN } from '../support/process-master-api';
import type { Answer } from '../support/process-master-api';

/**
 * QA acceptance, AQP-123 (STORY-02.04 Exchange Rate Master), AC-1 to AC-6, through the real route handlers (`GET` and `PUT /api/v1/exchange-rates`),
 * the real service, the real audit service and the real session code, over a throwaway PostgreSQL 17. The oracles are written here from the
 * acceptance criteria (AC-4 on the amended text, Jira AQP-1 11304), ux-spec v0.21 and architecture v0.33 section 8, not imported from the code: the
 * fixed object ID is a literal, the IST arithmetic is done by hand, and the stored rows and the audit entries are read with plain SQL. All numbers are
 * invented (`n.37`, ADR-014); none is a real rate. Techniques: equivalence partitions and boundary values for the rate text, a decision table for who may
 * call, state analysis for first save, repeat save and change, and error guessing for odd bodies, a stale clock and parallel saves.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

/** Architecture v0.33 section 8: the pair is one audited object with this fixed ID. Written out, so a change of the constant fails here. */
const FIXED_OBJECT_ID = '00000000-0000-4000-8000-000600000001';
const URL = `${ORIGIN}/api/v1/exchange-rates`;
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';

type Handler = (request: Request) => Promise<Response>;
let routes!: Record<'GET' | 'PUT', Handler>;

async function answerOf(response: Response): Promise<Answer> {
  const text = await response.text();
  let body: Record<string, unknown> | null = null;
  try {
    const value: unknown = text === '' ? null : JSON.parse(text);
    body = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body, text, requestId: response.headers.get('x-request-id'), headers: response.headers };
}

function getRates(origin: string | null = ORIGIN): Promise<Answer> {
  return routes.GET(new Request(URL, { method: 'GET', headers: origin === null ? {} : { origin } })).then(answerOf);
}

function putRates(body: unknown, options: { readonly origin?: string | null; readonly raw?: string } = {}): Promise<Answer> {
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) };
  return routes.PUT(new Request(URL, { method: 'PUT', headers, body: options.raw ?? JSON.stringify(body) })).then(answerOf);
}

interface Row {
  readonly currency: string;
  readonly inr_value: string;
  readonly updated_by: string;
  readonly updated_at: Date;
}
const stored = async (): Promise<Row[]> =>
  (await db.owner.query<Row>('SELECT currency, inr_value::text, updated_by::text, updated_at FROM exchange_rates ORDER BY currency')).rows;
const storedText = async (): Promise<string> => JSON.stringify((await stored()).map((row) => [row.currency, row.inr_value, row.updated_by, row.updated_at.toISOString()]));

interface Entry {
  readonly event: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly actor_id: string;
  readonly request_id: string;
  readonly before: unknown;
  readonly after: unknown;
}
/** The audit log is append-only and shared by the file, so a test reads only the entries made after its own start. */
let since = '1970-01-01T00:00:00Z';
const entries = async (): Promise<Entry[]> =>
  (
    await db.owner.query<Entry>(
      "SELECT event, object_type, object_id::text, object_label, actor_id::text, request_id, before, after FROM audit_log WHERE object_type = 'exchange_rate' AND created_at > $1::timestamptz ORDER BY created_at, id",
      [since],
    )
  ).rows;

/** The IST date and time of an instant, worked out by hand (UTC + 5 h 30 min) in the form "09 Nov 2026, 23:59". */
function istByHand(instant: Date): string {
  const shifted = new Date(instant.getTime() + (5 * 60 + 30) * 60_000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(shifted.getUTCDate())} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}, ${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`;
}

let now = new Date('2026-11-10T06:00:00.000Z');
const tick = (): Date => {
  now = new Date(now.getTime() + 1_000);
  return now;
};

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  routes = (await import('@/app/api/v1/exchange-rates/route')) as unknown as typeof routes;
  await openWorld();
});
afterAll(closeWorld);

beforeEach(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  setUserId(adminId);
  await db.owner.query('DELETE FROM exchange_rates');
  since = (await db.owner.query<{ now: string }>("SELECT (clock_timestamp() + interval '1 millisecond')::text AS now")).rows[0]?.now ?? since;
  world.service = db.buildMastersService({ clock: { now: tick } });
});

describe('AQP-123 AC-1: the tab shows the stored values, or "not set yet", with the stamp', () => {
  it('[AQP-123 AC-1] with nothing saved: both values null, no stamp, and the four columns named by the registry (BH, BI, BJ, BK); never cached', async () => {
    const answer = await getRates();
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({
      usd: null,
      eur: null,
      updatedBy: null,
      updatedAt: null,
      columns: {
        usd: { rate: { letter: 'BH', label: 'Exchange Rate USD' }, price: { letter: 'BJ', label: 'Unit Production Price (USD)' } },
        eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
      },
    });
    expect(answer.headers.get('cache-control')).toContain('no-store');
  });

  it('[AQP-123 AC-1] after a save: the values with two decimals, the saver\'s name, the instant in UTC (ISO, Z), and the same instant is stored in UTC', async () => {
    const saved = await putRates({ usd: '83.37', eur: '90.5' });
    expect(saved.status).toBe(200);
    const read = await getRates();
    expect(read.body).toMatchObject({ usd: '83.37', eur: '90.50', updatedBy: 'Invented Admin' });
    expect(read.body?.['updatedAt']).toMatch(/^2026-11-10T06:00:0\dZ$|^2026-11-10T06:00:0\d\.000Z$/);
    const rows = await stored();
    expect(rows.map((row) => row.updated_at.toISOString())).toEqual([String(read.body?.['updatedAt']), String(read.body?.['updatedAt'])]);
  });

  it.each([
    ['23:59:59 IST is still 9 Nov', '2026-11-09T18:29:59.000Z', '09 Nov 2026, 23:59'],
    ['00:00:00 IST is 10 Nov', '2026-11-09T18:30:00.000Z', '10 Nov 2026, 00:00'],
    ['a year end', '2026-12-31T20:00:00.000Z', '01 Jan 2027, 01:30'],
  ])('[AQP-123 AC-1] the stamp is stored in UTC and is one IST time across midnight: %s', async (_name, utc, expected) => {
    world.service = db.buildMastersService({ clock: { now: () => new Date(utc) } });
    await putRates({ usd: '81.37', eur: '88.37' });
    const { updatedAt } = (await getRates()).body as { updatedAt: string };
    expect(updatedAt).toBe(utc);
    expect(istByHand(new Date(updatedAt))).toBe(expected);
    const { formatIst } = await import('@/lib/time');
    expect(formatIst(new Date(updatedAt))).toContain(expected);
  });
});

describe('AQP-123 AC-2 and AC-3: both rates saved together; values of 0 or more with up to 2 decimals', () => {
  const VALID: ReadonlyArray<readonly [string, string]> = [
    ['0', '0.00'],
    ['0.00', '0.00'],
    ['0.01', '0.01'],
    ['83', '83.00'],
    ['83.3', '83.30'],
    ['83.37', '83.37'],
    ['083.50', '83.50'],
    ['0000.5', '0.50'],
    ['999999999999.99', '999999999999.99'],
    [' 83.37 ', '83.37'],
  ];
  it.each(VALID)('[AQP-123 AC-2] %j is accepted and stored as %s (EP, BVA: zero, one cent, twelve digits)', async (typed, kept) => {
    const answer = await putRates({ usd: typed, eur: '88.37' });
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ usd: kept, eur: '88.37' });
    expect((await stored()).find((row) => row.currency === 'USD')?.inr_value).toBe(`${kept}00`);
  });

  const INVALID: ReadonlyArray<readonly [string, unknown]> = [
    ['blank', ''],
    ['spaces only', '   '],
    ['negative', '-1'],
    ['negative zero', '-0'],
    ['negative cent', '-0.01'],
    ['three decimals', '83.371'],
    ['three decimals, last zero', '83.370'],
    ['trailing point', '83.'],
    ['no whole part', '.5'],
    ['letters', 'abc'],
    ['digits then letters', '83.37abc'],
    ['exponent', '1e2'],
    ['thousands comma', '1,000'],
    ['decimal comma', '83,37'],
    ['inner space', '8 3'],
    ['plus sign', '+5'],
    ['hex', '0x10'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['thirteen digits', '1000000000000'],
    ['an Arabic-Indic digit', '٣'],
    ['markup', '<b>1</b>'],
    ['a SQL word', "1'; DROP TABLE exchange_rates;--"],
    ['a JSON number', 83.37],
    ['null', null],
    ['an array', ['83.37']],
    ['an object', { v: '1' }],
    ['a boolean', true],
  ];
  it.each(INVALID)('[AQP-123 AC-3] %s is refused with 422 naming the field; neither stored rate, nor the stamp, changes; no entry (EP, EG)', async (_name, bad) => {
    await putRates({ usd: '81.37', eur: '88.37' });
    const before = await storedText();
    const entriesBefore = (await entries()).length;
    for (const field of ['usd', 'eur'] as const) {
      const body = field === 'usd' ? { usd: bad, eur: '90.37' } : { usd: '90.37', eur: bad };
      const answer = await putRates(body);
      expect(answer.status).toBe(422);
      expect(JSON.stringify(answer.body)).toContain(`"${field}"`);
      expect(await storedText()).toBe(before);
    }
    expect((await entries()).length).toBe(entriesBefore);
  });

  it('[AQP-123 AC-3] the words of a refused text are the UX spec\'s, and a refusal names both fields when both are wrong', async () => {
    const answer = await putRates({ usd: '', eur: '-1' });
    expect(answer.status).toBe(422);
    const text = JSON.stringify(answer.body);
    expect(text).toContain(NUMBER_MESSAGE);
    expect(text).toContain('"usd"');
    expect(text).toContain('"eur"');
    expect(await stored()).toHaveLength(0);
  });

  it('[AQP-123 AC-3] a missing field, a field the route does not know, bad JSON and an empty body are refused and store nothing', async () => {
    for (const body of [{ usd: '81.37' }, { eur: '88.37' }, {}, { usd: '81.37', eur: '88.37', updatedBy: adminId }, { usd: '81.37', eur: '88.37', updatedAt: '2000-01-01T00:00:00Z' }, { usd: '81.37', eur: '88.37', currency: 'GBP' }]) {
      expect((await putRates(body)).status).toBe(422);
    }
    expect((await putRates(null, { raw: '{"usd": ' })).status).toBe(400);
    expect((await putRates(null, { raw: '' })).status).toBe(400);
    expect((await putRates(null, { raw: '{"__proto__": {"usd": "1"}, "usd": "81.37", "eur": "88.37"}' })).status).toBe(422);
    expect(await stored()).toHaveLength(0);
    expect(await entries()).toHaveLength(0);
  });

  it('[AQP-123 AC-3] a 1 MB value is refused (422 or 400), never a 500, and the refusal does not echo it', async () => {
    const answer = await putRates({ usd: '9'.repeat(1_000_000), eur: '88.37' });
    expect([400, 413, 422]).toContain(answer.status);
    expect(answer.text.length).toBeLessThan(2_000);
  });

  it('[AQP-123 AC-2] both rates are saved together with ONE stamp (same person, same instant); the first save inserts both rows', async () => {
    await putRates({ usd: '81.37', eur: '88.37' });
    const rows = await stored();
    expect(rows.map((row) => row.currency)).toEqual(['EUR', 'USD']);
    expect(new Set(rows.map((row) => row.updated_at.getTime())).size).toBe(1);
    expect(new Set(rows.map((row) => row.updated_by))).toEqual(new Set([adminId]));
  });

  it('[AQP-123 AC-2] a change of one rate stamps both rows with the new save', async () => {
    await putRates({ usd: '81.37', eur: '88.37' });
    const first = (await stored())[0]?.updated_at.getTime() ?? 0;
    await putRates({ usd: '81.37', eur: '89.37' });
    const rows = await stored();
    expect(rows.map((row) => row.inr_value)).toEqual(['89.3700', '81.3700']);
    expect(new Set(rows.map((row) => row.updated_at.getTime())).size).toBe(1);
    expect(rows[0]?.updated_at.getTime()).toBeGreaterThan(first);
  });

  it('[AQP-123 AC-2] idempotent: the same body gives the same answer (stamp included); "83.5" and "083.50" are one value', async () => {
    const first = await putRates({ usd: '83.5', eur: '88.37' });
    const second = await putRates({ usd: '83.5', eur: '88.37' });
    const third = await putRates({ usd: '083.50', eur: '88.37' });
    expect(second.body).toEqual(first.body);
    expect(third.body).toEqual(first.body);
    expect(await entries()).toHaveLength(1);
  });

  it('[AQP-123 AC-2] the rows survive a read by the runtime role only as SELECT, INSERT, UPDATE: it cannot delete or truncate (data integrity)', async () => {
    await putRates({ usd: '81.37', eur: '88.37' });
    await expect(db.prisma.$executeRawUnsafe('DELETE FROM exchange_rates')).rejects.toThrow();
    await expect(db.prisma.$executeRawUnsafe('TRUNCATE exchange_rates')).rejects.toThrow();
    expect(await stored()).toHaveLength(2);
  });
});

describe('AQP-123 AC-4 (amended): one master.edited entry of object_type exchange_rate per changing save; none otherwise', () => {
  it('[AQP-123 AC-4] first save: exactly one entry, with the fixed object_id, the label, the actor, the request ID of the response, before null/null and after both rates', async () => {
    const answer = await putRates({ usd: '83.37', eur: '90.5' });
    const found = await entries();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      event: 'master.edited',
      object_type: 'exchange_rate',
      object_id: FIXED_OBJECT_ID,
      object_label: 'Exchange rates',
      actor_id: adminId,
      request_id: answer.requestId,
      before: { usd: null, eur: null },
      after: { usd: '83.37', eur: '90.50' },
    });
    expect(answer.requestId).toBeTruthy();
  });

  it('[AQP-123 AC-4] a change of one currency is one entry holding both before and after; a chain: each before is the previous after', async () => {
    await putRates({ usd: '81.37', eur: '88.37' });
    await putRates({ usd: '81.37', eur: '89.37' });
    await putRates({ usd: '0', eur: '89.37' });
    const found = await entries();
    expect(found).toHaveLength(3);
    expect(found[1]).toMatchObject({ before: { usd: '81.37', eur: '88.37' }, after: { usd: '81.37', eur: '89.37' } });
    expect(found[2]).toMatchObject({ before: { usd: '81.37', eur: '89.37' }, after: { usd: '0.00', eur: '89.37' } });
    expect(new Set(found.map((entry) => entry.object_id))).toEqual(new Set([FIXED_OBJECT_ID]));
  });

  it('[AQP-123 AC-4] no entry for a save that changes nothing, for any refusal, for a GET, or for a refused caller', async () => {
    await putRates({ usd: '81.37', eur: '88.37' });
    const baseline = (await entries()).length;
    await putRates({ usd: '81.37', eur: '88.37' });
    await putRates({ usd: '081.370', eur: '88.37' });
    await putRates({ usd: '-1', eur: '88.37' });
    await getRates();
    await putRates({ usd: '1.00', eur: '2.00' }, { origin: FOREIGN_ORIGIN });
    await putRates({ usd: '1.00', eur: '2.00' }, { origin: null });
    for (const person of [leadId, engineerId, null]) {
      setUserId(person);
      await putRates({ usd: '1.00', eur: '2.00' });
    }
    setUserId(adminId);
    expect((await entries()).length).toBe(baseline);
    expect((await storedText()).includes('81.3700')).toBe(true);
  });

  it('[AQP-123 AC-4] atomic: with the unit of work failing after its last step, the save answers 500 with the generic words, stores nothing and keeps no entry (first save and a later save)', async () => {
    const failing = createLateFailingRunner(createTransactionRunner(db.prisma), new Error('the unit of work failed after its last step'));
    world.service = db.buildMastersService({ transactions: failing, clock: { now: tick } });
    const first = await putRates({ usd: '81.37', eur: '88.37' });
    expect(first.status).toBe(500);
    expect(first.text).not.toContain('unit of work');
    expect(await stored()).toHaveLength(0);
    expect(await entries()).toHaveLength(0);
    world.service = db.buildMastersService({ clock: { now: tick } });
    await putRates({ usd: '81.37', eur: '88.37' });
    const settled = await storedText();
    world.service = db.buildMastersService({ transactions: failing, clock: { now: tick } });
    expect((await putRates({ usd: '90.37', eur: '91.37' })).status).toBe(500);
    expect(await storedText()).toBe(settled);
    expect(await entries()).toHaveLength(1);
  });

  it('[AQP-123 AC-4] parallel saves of six different pairs: the rows hold one request\'s pair entire, and the entries form one unbroken chain', async () => {
    await putRates({ usd: '1.00', eur: '2.00' });
    const pairs = [1, 2, 3, 4, 5, 6].map((n) => ({ usd: `${10 * n}.37`, eur: `${10 * n + 5}.37` }));
    const answers = await Promise.all(pairs.map((pair) => putRates(pair)));
    expect(answers.every((answer) => answer.status === 200)).toBe(true);
    const rows = await stored();
    const final = { usd: rows.find((row) => row.currency === 'USD')?.inr_value, eur: rows.find((row) => row.currency === 'EUR')?.inr_value };
    expect(pairs.map((pair) => `${pair.usd}00/${pair.eur}00`)).toContain(`${final.usd}/${final.eur}`);
    expect(new Set(rows.map((row) => row.updated_at.getTime())).size).toBe(1);
    const chain = await entries();
    expect(chain).toHaveLength(7);
    for (let index = 1; index < chain.length; index += 1) expect(chain[index]?.before).toEqual(chain[index - 1]?.after);
    expect(chain[6]?.after).toEqual({ usd: Number(final.usd).toFixed(2), eur: Number(final.eur).toFixed(2) });
  });
});

describe('AQP-123 AC-5: the hints are made from the registry\'s letters', () => {
  it('[AQP-123 AC-5] the answer carries the letter and label the registry gives each rate and its price column, for both currencies', async () => {
    const { columns } = (await getRates()).body as { columns: Record<string, { rate: { letter: string }; price: { letter: string } }> };
    expect(columns['usd']?.rate.letter).toBe('BH');
    expect(columns['usd']?.price.letter).toBe('BJ');
    expect(columns['eur']?.rate.letter).toBe('BI');
    expect(columns['eur']?.price.letter).toBe('BK');
  });

  it('[AQP-123 AC-5] a damaged registry (no field for a rate column) fails loudly with the generic 500, and a save is refused before anything is written', async () => {
    const { seedConfig } = await import('../support/seed-config');
    const damaged = { ...seedConfig, fields: seedConfig.fields.filter((field) => field.key !== 'exchange-rate-usd') };
    world.service = db.buildMastersService({ configuration: damaged, clock: { now: tick } });
    expect((await getRates()).status).toBe(500);
    const saved = await putRates({ usd: '81.37', eur: '88.37' });
    expect(saved.status).toBe(500);
    expect(saved.text).not.toContain('exchange-rate-usd');
    expect(await stored()).toHaveLength(0);
    expect(await entries()).toHaveLength(0);
  });
});

describe('AQP-123 AC-6: only the Admin; nobody else receives a rate (BR-003, BR-004)', () => {
  const CANARY = { usd: '838.37', eur: '839.73' };

  it('[AQP-123 AC-6] decision table: Lead 403, Engineer 403, signed out 401, on GET and on PUT; the bodies are identical for Lead and Engineer and hold no rate', async () => {
    await putRates(CANARY);
    const seen: Record<string, string> = {};
    for (const [who, id, status] of [
      ['lead', leadId, 403],
      ['engineer', engineerId, 403],
      ['signed out', null, 401],
    ] as const) {
      setUserId(id);
      const read = await getRates();
      const write = await putRates({ usd: '1.23', eur: '4.56' });
      expect([who, read.status]).toEqual([who, status]);
      expect([who, write.status]).toEqual([who, status]);
      for (const answer of [read, write]) {
        expect(answer.text).not.toMatch(/838|839|1\.23|4\.56|inr|usd|eur/i);
        expect(answer.headers.get('cache-control')).toContain('no-store');
      }
      seen[who] = read.text.replace(/"requestId":"[^"]*"/, '');
    }
    expect(seen['lead']).toBe(seen['engineer']);
    setUserId(adminId);
    expect((await stored()).map((row) => row.inr_value).sort()).toEqual(['838.3700', '839.7300']);
  });

  it('[AQP-123 AC-6] the Admin\'s own refusals do not echo a rate; a foreign or missing Origin on PUT is 403 and stores nothing (CSRF)', async () => {
    const refused = await putRates({ usd: '838.37x', eur: '839.73' });
    expect(refused.status).toBe(422);
    expect(refused.text).not.toContain('839.73');
    for (const origin of [FOREIGN_ORIGIN, null]) {
      const answer = await putRates({ usd: '838.37', eur: '839.73' }, { origin });
      expect(answer.status).toBe(403);
      expect(answer.text).not.toMatch(/838|839/);
    }
    expect(await stored()).toHaveLength(0);
  });

  it('[AQP-123 AC-6] a deactivated Admin and a raised session version are refused at the next request (401)', async () => {
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [adminId]);
    try {
      expect((await getRates()).status).toBe(401);
      expect((await putRates({ usd: '1.00', eur: '2.00' })).status).toBe(401);
    } finally {
      await db.owner.query('UPDATE users SET is_active = true WHERE id = $1', [adminId]);
    }
    await db.owner.query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [adminId]);
    try {
      expect((await getRates()).status).toBe(401);
    } finally {
      await db.owner.query('UPDATE users SET session_version = session_version - 1 WHERE id = $1', [adminId]);
    }
    expect(await stored()).toHaveLength(0);
  });
});
