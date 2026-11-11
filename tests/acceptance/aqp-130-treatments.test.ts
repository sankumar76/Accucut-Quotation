import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLateFailingRunner } from '../support/late-failure-runner';
import { world, db, adminId, leadId, engineerId, openWorld, closeWorld, setUserId, ORIGIN, FOREIGN_ORIGIN } from '../support/process-master-api';
import type { Answer } from '../support/process-master-api';

/**
 * QA acceptance, AQP-130 (STORY-02.05 Treatment / Color list), AC-1 to AC-7, through the real route handlers (`GET` and `POST /api/v1/treatments`,
 * `PATCH` and `DELETE /api/v1/treatments/{id}`, `GET /api/v1/options/treatments`) and the page `/masters/materials`, the real service, the real audit
 * service and the real session code, over a throwaway PostgreSQL 17. AC-8 (three widths, axe, 44 px, keyboard, the words) is browser work and is
 * the QA probe `docs/07-qa/AQP-130-evidence/aqp-130-qa.spec.ts.txt`, run in CI.
 *
 * The oracles are written here from the acceptance criteria (AC-6 on the amended text, Jira AQP-130), architecture v0.35 sections 5.1, 6 and 8, and
 * ux-spec v0.22, not imported from the code: the "Other" ID is a literal, the refusal words are written out, and the rows and the audit entries are
 * read with plain SQL. Names are invented (`Qa130 ...`). Techniques: equivalence partitions and boundary values for the name, a decision table for
 * who may call and for the refusal order, state analysis for add, rename and delete, and error guessing for odd spellings, odd IDs, parallel
 * requests and a failure after the entry was written.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

/** Architecture v0.35 section 5.6: the migration inserts "Other" with this fixed ID. Written out, so a change of the constant fails here. */
const OTHER_ID = '00000000-0000-4000-8000-000700000001';
const UNKNOWN_ID = '00000000-0000-4000-8000-0fffffffffff';
const TAKEN = 'A treatment with this name already exists.';
const RESERVED = 'That name cannot be used.';
const LOCKED = 'This entry is always offered and cannot be renamed or deleted.';
const TOO_LONG = 'Use 100 characters or fewer.';
const ENTER_NAME = 'Enter a name.';

type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Record<string, Handler | undefined>;
let collection!: RouteModule;
let item!: RouteModule;
let optionsRoute!: RouteModule;
let materialsPage!: { default: () => Promise<unknown> };

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

interface CallOptions {
  readonly origin?: string | null;
  readonly raw?: string;
}

/** `GET` / `POST /api/v1/treatments` (id null) or `PATCH` / `DELETE /api/v1/treatments/{id}`. */
async function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', id: string | null, body?: unknown, options: CallOptions = {}): Promise<Answer> {
  const handler = (id === null ? collection : item)[method];
  if (handler === undefined) throw new Error(`no ${method}`);
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const hasBody = method === 'POST' || method === 'PATCH';
  const headers: Record<string, string> = { ...(origin === null ? {} : { origin }), ...(hasBody ? { 'content-type': 'application/json' } : {}) };
  const request = new Request(`${ORIGIN}/api/v1/treatments${id === null ? '' : `/${id}`}`, {
    method,
    headers,
    ...(hasBody ? { body: options.raw ?? JSON.stringify(body) } : {}),
  });
  return answerOf(await handler(request, { params: Promise.resolve(id === null ? {} : { id }) }));
}

const list = (): Promise<Answer> => send('GET', null);
const add = (name: unknown): Promise<Answer> => send('POST', null, { name });
const rename = (id: string, name: unknown): Promise<Answer> => send('PATCH', id, { name });
const remove = (id: string): Promise<Answer> => send('DELETE', id);

async function optionList(): Promise<Answer> {
  const handler = optionsRoute['GET'];
  if (handler === undefined) throw new Error('no GET on the options route');
  return answerOf(await handler(new Request(`${ORIGIN}/api/v1/options/treatments`, { method: 'GET', headers: { origin: ORIGIN } })));
}

function idOf(answer: Answer): string {
  const id = answer.body?.['id'];
  if (typeof id !== 'string') throw new Error(`no id in the answer (status ${answer.status}): ${answer.text}`);
  return id;
}

/** The `code` and the first message of a refusal body (`problem+json`, architecture section 6). */
function refusalOf(answer: Answer): { readonly code: unknown; readonly field: unknown; readonly message: unknown; readonly messages: string } {
  const errors = answer.body?.['errors'];
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  const { field, message } = (typeof first === 'object' && first !== null ? first : {}) as { field?: unknown; message?: unknown };
  return { code: answer.body?.['code'], field, message, messages: JSON.stringify(errors ?? []) };
}

interface Row {
  readonly id: string;
  readonly name: string;
  readonly is_system: boolean;
  readonly is_hidden: boolean;
}
const rows = async (): Promise<Row[]> =>
  (await db.owner.query<Row>('SELECT id::text, name, is_system, is_hidden FROM treatments ORDER BY created_at, id')).rows;
const stored = async (): Promise<string> => JSON.stringify(await rows());
const names = async (): Promise<string[]> => (await rows()).map((row) => row.name);
const idByName = async (name: string): Promise<string> => {
  const found = (await rows()).find((row) => row.name === name);
  if (found === undefined) throw new Error(`No treatment named ${name}.`);
  return found.id;
};
const insertAsOwner = async (name: string): Promise<string> =>
  (await db.owner.query<{ id: string }>('INSERT INTO treatments (name) VALUES ($1) RETURNING id::text', [name])).rows[0]?.id ?? '';

interface Entry {
  readonly event: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly actor_id: string;
  readonly actor_label: string;
  readonly request_id: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly created_at: Date;
}
/** The audit log is append-only and shared by the file, so a test reads only the entries made after its own start. */
let since = '1970-01-01T00:00:00Z';
const entries = async (): Promise<Entry[]> =>
  (
    await db.owner.query<Entry>(
      "SELECT event, object_type, object_id::text, object_label, actor_id::text, actor_label, request_id, before, after, created_at FROM audit_log WHERE object_type = 'treatment' AND created_at > $1::timestamptz ORDER BY created_at, id",
      [since],
    )
  ).rows;
/** Every entry of any kind made since the test began: a refused call must leave this at zero. */
const anyEntries = async (): Promise<number> =>
  Number((await db.owner.query<{ n: string }>('SELECT count(*)::text AS n FROM audit_log WHERE created_at > $1::timestamptz', [since])).rows[0]?.n);

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  collection = (await import('@/app/api/v1/treatments/route')) as unknown as RouteModule;
  item = (await import('@/app/api/v1/treatments/[id]/route')) as unknown as RouteModule;
  optionsRoute = (await import('@/app/api/v1/options/treatments/route')) as unknown as RouteModule;
  materialsPage = (await import('@/app/(portal)/masters/materials/page')) as unknown as { default: () => Promise<unknown> };
  await openWorld();
});
afterAll(closeWorld);

beforeEach(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  setUserId(adminId);
  await db.owner.query('DELETE FROM treatments WHERE id <> $1::uuid', [OTHER_ID]);
  since = (await db.owner.query<{ now: string }>("SELECT (clock_timestamp() + interval '1 millisecond')::text AS now")).rows[0]?.now ?? since;
  world.service = db.buildMastersService();
});

describe('AQP-130 AC-1: the list shows the treatments, "Other" first and locked, and no hidden entry', () => {
  it('[AQP-130 AC-1] a new database lists exactly "Other", with the fixed ID, locked; the answer is never cached', async () => {
    const answer = await list();
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ treatments: [{ id: OTHER_ID, name: 'Other', locked: true }] });
    expect(answer.headers.get('cache-control')).toContain('no-store');
  });

  it('[AQP-130 AC-1] "Other" is first and locked, then the treatments in the order they were added, each unlocked; a row holds an ID, a name and the flag, nothing else (EP, ST)', async () => {
    await add('Qa130 powder coat');
    await add('Qa130 anodised');
    await add('Qa130 brushed grey');
    const answer = await list();
    const shown = answer.body?.['treatments'] as Array<Record<string, unknown>>;
    expect(shown.map((row) => row['name'])).toEqual(['Other', 'Qa130 powder coat', 'Qa130 anodised', 'Qa130 brushed grey']);
    expect(shown.map((row) => row['locked'])).toEqual([true, false, false, false]);
    for (const row of shown) expect(Object.keys(row).sort()).toEqual(['id', 'locked', 'name']);
  });

  it('[AQP-130 AC-1] a hidden entry (the "Not applicable" row of story 02.06, written here by the owner) is on no list: not the Admin\'s, not the options (EG)', async () => {
    await add('Qa130 shown');
    await db.owner.query("INSERT INTO treatments (name, is_system, is_hidden) VALUES ('Not applicable', true, true)");
    try {
      const admin = await list();
      expect((admin.body?.['treatments'] as Array<{ name: string }>).map((row) => row.name)).toEqual(['Other', 'Qa130 shown']);
      const options = await optionList();
      expect((options.body?.['options'] as Array<{ name: string }>).map((row) => row.name)).toEqual(['Other', 'Qa130 shown']);
      expect(admin.text).not.toMatch(/applicable/i);
      expect(options.text).not.toMatch(/applicable/i);
    } finally {
      await db.owner.query("DELETE FROM treatments WHERE is_hidden = true");
    }
  });
});

describe('AQP-130 AC-2: a name is required, unique ignoring letter case and spacing, and not one the system keeps', () => {
  it.each([
    ['an empty object', {}],
    ['an empty name', { name: '' }],
    ['spaces only', { name: '     ' }],
    ['a tab and a new line', { name: '\t\n' }],
    ['null', { name: null }],
    ['a number', { name: 5 }],
    ['an array', { name: ['Qa130 a'] }],
  ])('[AQP-130 AC-2] an add with %s is 422 on the field "name"; nothing is stored and no entry is written (EP, EG)', async (_label, body) => {
    const before = await stored();
    const answer = await send('POST', null, body);
    expect(answer.status).toBe(422);
    expect(refusalOf(answer).field).toBe('name');
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(0);
  });

  it('[AQP-130 AC-2] a blank name says "Enter a name." (ux-spec v0.22)', async () => {
    const answer = await add('   ');
    expect(refusalOf(answer).message).toBe(ENTER_NAME);
  });

  it('[AQP-130 AC-2] boundary: 1 and 100 characters are accepted (also with spaces around the 100), 101 is 422 "Use 100 characters or fewer." and stores nothing (BVA)', async () => {
    expect((await add('a')).status).toBe(201);
    expect((await add(` ${'b'.repeat(100)} `)).status).toBe(201);
    expect(await names()).toEqual(['Other', 'a', 'b'.repeat(100)]);
    const over = await add('c'.repeat(101));
    expect(over.status).toBe(422);
    expect(refusalOf(over).message).toBe(TOO_LONG);
    expect(await names()).toEqual(['Other', 'a', 'b'.repeat(100)]);
  });

  it('[AQP-130 AC-2] a name is stored in one form: surrounding spaces off, inner runs of white space made one, full-width letters folded (EP)', async () => {
    const first = await add('  Qa130   brushed \t finish  ');
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ name: 'Qa130 brushed finish', locked: false });
    const second = await add('Ｑａ１３０ matt black');
    expect(second.status).toBe(201);
    expect(await names()).toEqual(['Other', 'Qa130 brushed finish', 'Qa130 matt black']);
  });

  const SAME_AS_STORED: ReadonlyArray<readonly [string, string]> = [
    ['the same name in capitals', 'QA130 POWDER COAT'],
    ['the same name in lower case', 'qa130 powder coat'],
    ['surrounding spaces', '  Qa130 powder coat  '],
    ['two spaces inside (the near-duplicate)', 'Qa130 powder  coat'],
    ['a tab inside', 'Qa130 powder\tcoat'],
    ['a no-break space inside', 'Qa130 powder coat'],
    ['full-width letters', 'Ｑａ１３０ ｐｏｗｄｅｒ ｃｏａｔ'],
    ['full-width letters with a full-width space', 'Ｑａ１３０　ｐｏｗｄｅｒ　ｃｏａｔ'],
  ];

  it.each(SAME_AS_STORED)('[AQP-130 AC-2] an add of "Qa130 powder coat" again, written with %s, is 422 NAME_TAKEN with the sentence of AC-2; nothing is added (EP, EG)', async (_label, typed) => {
    await add('Qa130 powder coat');
    const marker = await anyEntries();
    const answer = await add(typed);
    expect(answer.status).toBe(422);
    expect(refusalOf(answer)).toMatchObject({ code: 'NAME_TAKEN', field: 'name', message: TAKEN });
    expect(await names()).toEqual(['Other', 'Qa130 powder coat']);
    expect(await anyEntries()).toBe(marker);
  });

  it.each(SAME_AS_STORED)('[AQP-130 AC-2] a rename of another treatment to "Qa130 powder coat" written with %s is 422 NAME_TAKEN; both names stay (EP, EG)', async (_label, typed) => {
    await add('Qa130 powder coat');
    const other = idOf(await add('Qa130 anodised'));
    const marker = await anyEntries();
    const answer = await rename(other, typed);
    expect(answer.status).toBe(422);
    expect(refusalOf(answer)).toMatchObject({ code: 'NAME_TAKEN', field: 'name', message: TAKEN });
    expect(await names()).toEqual(['Other', 'Qa130 powder coat', 'Qa130 anodised']);
    expect(await anyEntries()).toBe(marker);
  });

  const RESERVED_SPELLINGS = [
    'Other',
    'OTHER',
    'other',
    ' other ',
    'oTHER',
    'Not applicable',
    'NOT APPLICABLE',
    'not applicable',
    'Not  applicable',
    ' Not   Applicable ',
    'Not\tapplicable',
    'Not applicable',
    'Ｏｔｈｅｒ',
    'ＯＴＨＥＲ',
    'Ｎｏｔ　ａｐｐｌｉｃａｂｌｅ',
    'Ｎｏｔ ａｐｐｌｉｃａｂｌｅ',
  ];

  it.each(RESERVED_SPELLINGS)('[AQP-130 AC-2] an add of %j is 422 NAME_RESERVED with "That name cannot be used.", which names neither entry; nothing is stored (EP, EG)', async (typed) => {
    const before = await stored();
    const answer = await add(typed);
    expect(answer.status).toBe(422);
    const refusal = refusalOf(answer);
    expect(refusal).toMatchObject({ code: 'NAME_RESERVED', field: 'name', message: RESERVED });
    expect(refusal.messages).not.toMatch(/other|applicable/i);
    expect(answer.text).not.toMatch(/applicable/i);
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(0);
  });

  it.each(RESERVED_SPELLINGS)('[AQP-130 AC-2] a rename to %j is 422 NAME_RESERVED, the same words; the treatment keeps its name (EP, EG)', async (typed) => {
    const id = idOf(await add('Qa130 powder coat'));
    const marker = await anyEntries();
    const answer = await rename(id, typed);
    expect(answer.status).toBe(422);
    expect(refusalOf(answer)).toMatchObject({ code: 'NAME_RESERVED', field: 'name', message: RESERVED });
    expect(refusalOf(answer).messages).not.toMatch(/other|applicable/i);
    expect(await names()).toEqual(['Other', 'Qa130 powder coat']);
    expect(await anyEntries()).toBe(marker);
  });

  it('[AQP-130 AC-2] names that only contain a reserved word are fine: "Other finish" and "Not applicable paint" are added (EP: the check is on the whole name)', async () => {
    expect((await add('Other finish')).status).toBe(201);
    expect((await add('Not applicable paint')).status).toBe(201);
  });

  it('[AQP-130 AC-2] a rename works: 200 with the new name, the old name is free again, and the same treatment keeps its ID (ST)', async () => {
    const id = await insertAsOwner('Qa130 powder coat');
    const answer = await rename(id, 'Qa130 textured grey');
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ id, name: 'Qa130 textured grey', locked: false });
    expect(await names()).toEqual(['Other', 'Qa130 textured grey']);
    expect((await add('Qa130 powder coat')).status).toBe(201);
  });

  it('[AQP-130 AC-2] a change of letter case on its own is a rename, and a treatment is not a duplicate of itself (BVA)', async () => {
    const id = idOf(await add('Qa130 powder coat'));
    const answer = await rename(id, 'QA130 POWDER COAT');
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ name: 'QA130 POWDER COAT' });
    expect(await names()).toEqual(['Other', 'QA130 POWDER COAT']);
  });

  it('[AQP-130 AC-2] two requests at once for one name, spelled in two ways: one is added, the other is refused as taken, and one row is stored (EG: race)', async () => {
    const answers = await Promise.all([add('Qa130 race name'), add('QA130  RACE NAME')]);
    expect(answers.map((answer) => answer.status).sort()).toEqual([201, 422]);
    expect((await names()).filter((name) => /race name/i.test(name))).toHaveLength(1);
    expect((await entries()).map((entry) => entry.event)).toEqual(['master.created']);
  });

  it('[AQP-130 AC-2] an unknown key in the body is refused (strict schema) and a body that is not JSON is 400; nothing is stored (EG)', async () => {
    expect((await send('POST', null, { name: 'Qa130 extra', isSystem: true })).status).toBe(422);
    expect((await send('POST', null, { name: 'Qa130 extra', locked: true })).status).toBe(422);
    expect((await send('POST', null, undefined, { raw: '{"name": ' })).status).toBe(400);
    expect(await names()).toEqual(['Other']);
  });
});

describe('AQP-130 AC-2: odd bodies', () => {
  it('[AQP-130 AC-2] a 1 MB name and a "__proto__" key are refused (422, not 500), the name is not echoed back, and nothing is stored (EG)', async () => {
    const huge = 'x'.repeat(1_000_000);
    const tooBig = await add(huge);
    expect(tooBig.status).toBe(422);
    expect(tooBig.text.length).toBeLessThan(2_000);
    const proto = await send('POST', null, undefined, { raw: '{"name":"Qa130 proto","__proto__":{"isSystem":true}}' });
    expect(proto.status).toBe(422);
    const patchProto = await send('PATCH', OTHER_ID, undefined, { raw: '{"__proto__":{"name":"Qa130 x"}}' });
    expect([409, 422]).toContain(patchProto.status);
    expect(await names()).toEqual(['Other']);
    expect(await anyEntries()).toBe(0);
  });
});

describe('AQP-130 AC-3: "Other" is locked, in the service and the API', () => {
  const ATTEMPTS: ReadonlyArray<readonly [string, string]> = [
    ['a new name', 'Qa130 renamed other'],
    ['its own name', 'Other'],
    ['its own name in capitals', 'OTHER'],
    ['the other reserved name', 'Not applicable'],
    ['the name of an existing treatment', 'Qa130 taken'],
  ];

  it.each(ATTEMPTS)('[AQP-130 AC-3] PATCH on "Other" with %s is 409 TREATMENT_LOCKED, not a 422 about the name; nothing changes and no entry is written (DT: v0.35 order)', async (_label, name) => {
    await add('Qa130 taken');
    const before = await stored();
    const marker = await anyEntries();
    const answer = await rename(OTHER_ID, name);
    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ code: 'TREATMENT_LOCKED', status: 409 });
    expect(answer.text).toContain(LOCKED);
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(marker);
  });

  it('[AQP-130 AC-3] DELETE on "Other" is 409 TREATMENT_LOCKED; it is still listed, still locked, and no entry is written', async () => {
    const before = await stored();
    const answer = await remove(OTHER_ID);
    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ code: 'TREATMENT_LOCKED' });
    expect(await stored()).toBe(before);
    expect((await list()).body).toEqual({ treatments: [{ id: OTHER_ID, name: 'Other', locked: true }] });
    expect(await anyEntries()).toBe(0);
  });

  it('[AQP-130 AC-3] the ID of "Other" in capitals is the same ID: 409 as well (EG)', async () => {
    const answer = await remove(OTHER_ID.toUpperCase());
    expect(answer.status).toBe(409);
    expect((await rename(OTHER_ID.toUpperCase(), 'Qa130 x')).status).toBe(409);
    expect(await names()).toEqual(['Other']);
  });

  it('[AQP-130 AC-3] the shape of the name is judged first (blank is 422 even for "Other"), then the resource: an unknown ID sent the name "Other" is 404, not 422 (DT: v0.35 order)', async () => {
    expect((await rename(OTHER_ID, '   ')).status).toBe(422);
    expect((await rename(OTHER_ID, 'x'.repeat(101))).status).toBe(422);
    const unknownReserved = await rename(UNKNOWN_ID, 'Other');
    expect(unknownReserved.status).toBe(404);
    expect(unknownReserved.body).toMatchObject({ code: 'NOT_FOUND' });
    const unknownNormal = await rename(UNKNOWN_ID, 'Qa130 fine');
    const unknownDelete = await remove(UNKNOWN_ID);
    expect(unknownNormal.status).toBe(404);
    expect(unknownDelete.status).toBe(404);
    const strip = (answer: Answer): string => answer.text.replace(/"requestId":"[^"]*"/, '');
    expect(strip(unknownReserved)).toBe(strip(unknownNormal));
    expect(strip(unknownDelete)).toBe(strip(unknownNormal));
    expect(await names()).toEqual(['Other']);
    expect(await anyEntries()).toBe(0);
  });

  it('[AQP-130 AC-3] a hidden ID is 404 on PATCH and DELETE, in the same words as an unknown ID; the hidden row is untouched (architecture section 4.9)', async () => {
    const { rows: hidden } = await db.owner.query<{ id: string }>("INSERT INTO treatments (name, is_system, is_hidden) VALUES ('Not applicable', true, true) RETURNING id::text");
    const hiddenId = hidden[0]?.id ?? '';
    try {
      const strip = (answer: Answer): string => answer.text.replace(/"requestId":"[^"]*"/, '');
      const patchHidden = await rename(hiddenId, 'Qa130 renamed hidden');
      const patchUnknown = await rename(UNKNOWN_ID, 'Qa130 renamed hidden');
      expect(patchHidden.status).toBe(404);
      expect(strip(patchHidden)).toBe(strip(patchUnknown));
      const deleteHidden = await remove(hiddenId);
      expect(deleteHidden.status).toBe(404);
      expect(strip(deleteHidden)).toBe(strip(await remove(UNKNOWN_ID)));
      expect((await rows()).find((row) => row.id === hiddenId)).toMatchObject({ name: 'Not applicable', is_hidden: true });
      expect(await anyEntries()).toBe(0);
    } finally {
      await db.owner.query('DELETE FROM treatments WHERE is_hidden = true');
    }
  });

  it.each(['invented-id', '123', 'not-a-uuid-at-all', "1; DROP TABLE treatments", '00000000-0000-4000-8000-00070000000g'])(
    '[AQP-130 AC-3] an ID that is not a UUID (%j) is refused as invalid before anything is looked up; nothing changes (EG)',
    async (badId) => {
      const before = await stored();
      for (const answer of [await rename(badId, 'Qa130 fine'), await remove(badId)]) {
        expect([400, 404, 422]).toContain(answer.status);
        expect(answer.status).not.toBe(500);
      }
      expect(await stored()).toBe(before);
      expect(await names()).toContain('Other');
    },
  );
});

describe('AQP-130 AC-4: any Admin deletes an unused treatment, and it leaves the list', () => {
  it('[AQP-130 AC-4] DELETE answers 204 with no body; the row is gone from the table, the list and the options; a second DELETE is 404 (ST)', async () => {
    const id = idOf(await add('Qa130 to delete'));
    await add('Qa130 to keep');
    const answer = await remove(id);
    expect(answer.status).toBe(204);
    expect(answer.text).toBe('');
    expect(await names()).toEqual(['Other', 'Qa130 to keep']);
    expect(((await list()).body?.['treatments'] as Array<{ name: string }>).map((row) => row.name)).toEqual(['Other', 'Qa130 to keep']);
    expect(((await optionList()).body?.['options'] as Array<{ name: string }>).map((row) => row.name)).toEqual(['Other', 'Qa130 to keep']);
    expect((await remove(id)).status).toBe(404);
  });

  it('[AQP-130 AC-4] the name is free to add again after a delete (ux-spec v0.22: "To bring it back, add it again."); it is a new treatment with a new ID', async () => {
    const id = idOf(await add('Qa130 comes back'));
    await remove(id);
    const again = await add('Qa130 comes back');
    expect(again.status).toBe(201);
    expect(idOf(again)).not.toBe(id);
  });
});

describe('AQP-130 AC-5: the options list, for every role: IDs and names, no rate of any kind', () => {
  it.each([
    ['the Admin', () => adminId],
    ['a Lead', () => leadId],
    ['an Engineer', () => engineerId],
  ])('[AQP-130 AC-5] %s gets 200 with "Other" first and every other treatment, each as an ID and a name and nothing else (DT)', async (_label, who) => {
    await add('Qa130 powder coat');
    await add('Qa130 anodised');
    setUserId(who());
    const answer = await optionList();
    expect(answer.status).toBe(200);
    expect(Object.keys(answer.body ?? {})).toEqual(['options']);
    const shown = answer.body?.['options'] as Array<Record<string, unknown>>;
    expect(shown.map((row) => row['name'])).toEqual(['Other', 'Qa130 powder coat', 'Qa130 anodised']);
    expect(shown[0]?.['id']).toBe(OTHER_ID);
    for (const row of shown) expect(Object.keys(row).sort()).toEqual(['id', 'name']);
    expect(answer.text).not.toMatch(/rate|price|cost|usd|eur|inr|currency|locked|isSystem|isHidden/i);
  });

  it('[AQP-130 AC-5] signed out is 401; the route offers GET and no other method (EG)', async () => {
    setUserId(null);
    expect((await optionList()).status).toBe(401);
    expect(Object.keys(optionsRoute).filter((key) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(key))).toEqual(['GET']);
  });
});

describe('AQP-130 AC-6: exactly one audit entry per add, rename and delete', () => {
  it('[AQP-130 AC-6] an add writes one master.created entry: object_type treatment, the new ID and name, the actor, the request, before null, after { name }', async () => {
    const answer = await add('Qa130 powder coat');
    const id = idOf(answer);
    const written = await entries();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      event: 'master.created',
      object_type: 'treatment',
      object_id: id,
      object_label: 'Qa130 powder coat',
      actor_id: adminId,
      actor_label: 'Invented Admin',
      request_id: answer.requestId,
      before: null,
      after: { name: 'Qa130 powder coat' },
    });
    expect(Date.now() - (written[0]?.created_at.getTime() ?? 0)).toBeLessThan(60_000);
    expect(await anyEntries()).toBe(1);
  });

  it('[AQP-130 AC-6] a rename writes one master.edited entry: before { name } and after { name }, both names, the same object ID', async () => {
    const id = await insertAsOwner('Qa130 powder coat');
    const answer = await rename(id, 'Qa130 textured grey');
    const written = (await entries()).filter((entry) => entry.event === 'master.edited');
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      event: 'master.edited',
      object_type: 'treatment',
      object_id: id,
      object_label: 'Qa130 textured grey',
      actor_id: adminId,
      request_id: answer.requestId,
      before: { name: 'Qa130 powder coat' },
      after: { name: 'Qa130 textured grey' },
    });
    expect(await anyEntries()).toBe(1);
  });

  it('[AQP-130 AC-6] a delete writes one master.deleted entry: before { name }, after null; the entry stays when the row is gone', async () => {
    const id = await insertAsOwner('Qa130 powder coat');
    const answer = await remove(id);
    const written = (await entries()).filter((entry) => entry.event === 'master.deleted');
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      event: 'master.deleted',
      object_type: 'treatment',
      object_id: id,
      object_label: 'Qa130 powder coat',
      actor_id: adminId,
      request_id: answer.requestId,
      before: { name: 'Qa130 powder coat' },
      after: null,
    });
    expect(await names()).toEqual(['Other']);
    expect(await anyEntries()).toBe(1);
  });

  it('[AQP-130 AC-6] add, rename, rename and delete make exactly four entries in order, and each rename starts where the last ended (ST)', async () => {
    const id = idOf(await add('Qa130 one'));
    await rename(id, 'Qa130 two');
    await rename(id, 'Qa130 three');
    await remove(id);
    const written = await entries();
    expect(written.map((entry) => entry.event)).toEqual(['master.created', 'master.edited', 'master.edited', 'master.deleted']);
    expect(written.map((entry) => entry.before)).toEqual([null, { name: 'Qa130 one' }, { name: 'Qa130 two' }, { name: 'Qa130 three' }]);
    expect(written.map((entry) => entry.after)).toEqual([{ name: 'Qa130 one' }, { name: 'Qa130 two' }, { name: 'Qa130 three' }, null]);
    expect(new Set(written.map((entry) => entry.object_id))).toEqual(new Set([id]));
    expect(await anyEntries()).toBe(4);
  });

  it('[AQP-130 AC-6] a rename to the same canonical name writes no entry and no change, and answers 200 with the treatment as it is: exact repeat, inner spaces, full-width letters (DT)', async () => {
    const id = idOf(await add('Qa130 powder coat'));
    const marker = await anyEntries();
    for (const same of ['Qa130 powder coat', 'Qa130 powder  coat', '  Qa130   powder coat ', 'Ｑａ１３０ ｐｏｗｄｅｒ ｃｏａｔ', 'Qa130\tpowder coat']) {
      const answer = await rename(id, same);
      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ id, name: 'Qa130 powder coat', locked: false });
    }
    expect(await names()).toEqual(['Other', 'Qa130 powder coat']);
    expect(await anyEntries()).toBe(marker);
  });

  it('[AQP-130 AC-6] a refused change writes no entry: blank, too long, taken, reserved, locked, unknown, a bad ID, a foreign origin, bad JSON, an extra key (DT)', async () => {
    const id = idOf(await add('Qa130 powder coat'));
    await add('Qa130 anodised');
    const marker = await anyEntries();
    const before = await stored();
    const refused = [
      await add('  '),
      await add('x'.repeat(101)),
      await add('QA130 ANODISED'),
      await add('Other'),
      await add(' not  applicable '),
      await rename(id, ''),
      await rename(id, 'qa130 anodised'),
      await rename(id, 'OTHER'),
      await rename(OTHER_ID, 'Qa130 x'),
      await rename(UNKNOWN_ID, 'Qa130 x'),
      await rename('invented-id', 'Qa130 x'),
      await remove(OTHER_ID),
      await remove(UNKNOWN_ID),
      await remove('invented-id'),
      await send('POST', null, { name: 'Qa130 foreign' }, { origin: FOREIGN_ORIGIN }),
      await send('PATCH', id, { name: 'Qa130 foreign' }, { origin: null }),
      await send('DELETE', id, undefined, { origin: FOREIGN_ORIGIN }),
      await send('PATCH', id, undefined, { raw: 'not json' }),
      await send('PATCH', id, { name: 'Qa130 extra', locked: false }),
      await send('PATCH', id, {}),
    ];
    for (const answer of refused) expect(answer.status).toBeGreaterThanOrEqual(400);
    for (const answer of refused) expect(answer.status).toBeLessThan(500);
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(marker);
  });

  it('[AQP-130 AC-6] a read writes no entry: the list and the options, as the Admin, a Lead and an Engineer', async () => {
    await list();
    await optionList();
    setUserId(leadId);
    await optionList();
    setUserId(engineerId);
    await optionList();
    expect(await anyEntries()).toBe(0);
  });

  it('[AQP-130 AC-6] a Lead, an Engineer and a signed-out caller change nothing and write no entry', async () => {
    const id = idOf(await add('Qa130 powder coat'));
    const marker = await anyEntries();
    const before = await stored();
    for (const who of [leadId, engineerId, null]) {
      setUserId(who);
      for (const answer of [await add('Qa130 intruder'), await rename(id, 'Qa130 intruder'), await remove(id), await rename(OTHER_ID, 'Qa130 intruder'), await remove(OTHER_ID)]) {
        expect([401, 403]).toContain(answer.status);
      }
    }
    setUserId(adminId);
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(marker);
  });

  it.each([
    ['add', async () => add('Qa130 late add'), 'master.created'],
    ['rename', async (id: string) => rename(id, 'Qa130 late rename'), 'master.edited'],
    ['delete', async (id: string) => remove(id), 'master.deleted'],
  ])('[AQP-130 AC-6] a %s that fails after its entry was written leaves neither the change nor the entry: 500 with the generic words (DEF-017, atomicity)', async (kind, act, event) => {
    const id = idOf(await add('Qa130 powder coat'));
    const marker = await anyEntries();
    const before = await stored();
    const failure = new Error('Invented failure after the entry was written');
    world.service = db.buildMastersService({ transactions: createLateFailingRunner(db.transactions, failure) });
    const answer = await act(id);
    expect(answer.status, kind).toBe(500);
    expect(answer.text).not.toContain('Invented failure');
    expect(answer.text).not.toMatch(/treatment|audit_log|SELECT|INSERT/i);
    expect(await stored()).toBe(before);
    expect(await anyEntries()).toBe(marker);
    expect((await entries()).filter((entry) => entry.event === event && entry.object_label.includes('late'))).toHaveLength(0);
  });

  it('[AQP-130 AC-6] six renames at once of one treatment: one entry each, and the entries form one chain, each before being the previous after (EG: race, DL-142 QLT-03)', async () => {
    const id = idOf(await add('Qa130 start'));
    const targets = ['Qa130 r1', 'Qa130 r2', 'Qa130 r3', 'Qa130 r4', 'Qa130 r5', 'Qa130 r6'];
    const answers = await Promise.all(targets.map((name) => rename(id, name)));
    expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const edited = (await entries()).filter((entry) => entry.event === 'master.edited');
    expect(edited).toHaveLength(6);
    const afterOf = new Map(edited.map((entry) => [(entry.before as { name: string }).name, (entry.after as { name: string }).name]));
    expect(afterOf.size).toBe(6);
    let current = 'Qa130 start';
    const walked: string[] = [];
    while (afterOf.has(current)) {
      const next = afterOf.get(current) as string;
      walked.push(next);
      current = next;
    }
    expect(walked).toHaveLength(6);
    expect([...walked].sort()).toEqual([...targets].sort());
    expect(await names()).toEqual(['Other', current]);
  });
});

describe('AQP-130 AC-7: only the Admin manages treatments; the role is checked first', () => {
  /** The body of a refusal without the request ID, which differs by request. */
  const stripped = (answer: Answer): string => answer.text.replace(/"requestId":"[^"]*"/, '');

  it.each([
    ['a Lead', () => leadId, 403],
    ['an Engineer', () => engineerId, 403],
    ['a signed-out caller', () => null, 401],
  ])('[AQP-130 AC-7] %s gets %i on every admin route, with no treatment in the body, and the Lead\'s and the Engineer\'s refusals are the same body (DT)', async (_label, who, status) => {
    const real = idOf(await add('Qa130 canary treatment'));
    setUserId(who());
    const calls = [
      await list(),
      await add('Qa130 intruder'),
      await rename(real, 'Qa130 intruder'),
      await rename(UNKNOWN_ID, 'Qa130 intruder'),
      await remove(real),
      await remove(UNKNOWN_ID),
      await remove(OTHER_ID),
    ];
    for (const answer of calls) {
      expect(answer.status).toBe(status);
      expect(answer.text).not.toMatch(/Qa130|Other|treatments?"|locked/);
      expect(answer.text).not.toContain(real);
    }
    setUserId(adminId);
    expect(await names()).toEqual(['Other', 'Qa130 canary treatment']);
  });

  it('[AQP-130 AC-7] a real ID and an invented ID get the same 403, byte for byte apart from the request ID, on PATCH and on DELETE, even when the ID is not a UUID or the body is invalid (CR-33)', async () => {
    const real = idOf(await add('Qa130 canary treatment'));
    for (const who of [leadId, engineerId]) {
      setUserId(who);
      const patchReal = await rename(real, 'Qa130 intruder');
      for (const other of [await rename(UNKNOWN_ID, 'Qa130 intruder'), await rename(OTHER_ID, 'Other'), await rename('invented-id', ''), await send('PATCH', 'invented-id', undefined, { raw: 'not json' })]) {
        expect(other.status).toBe(403);
        expect(stripped(other)).toBe(stripped(patchReal));
      }
      const deleteReal = await remove(real);
      for (const other of [await remove(UNKNOWN_ID), await remove(OTHER_ID), await remove('invented-id')]) {
        expect(other.status).toBe(403);
        expect(stripped(other)).toBe(stripped(deleteReal));
      }
      expect(patchReal.status).toBe(403);
      expect(patchReal.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    }
    setUserId(leadId);
    expect(Object.keys((await rename(real, 'x')).body ?? {}).sort()).toEqual(['code', 'requestId', 'status', 'title', 'type']);
    setUserId(adminId);
  });

  it('[AQP-130 AC-7] the page /masters/materials, which holds the tab: a Lead and an Engineer get the forbidden screen (SCR-26), a signed-out visitor is sent to sign-in, the Admin gets the page', async () => {
    setUserId(leadId);
    await expect(materialsPage.default()).rejects.toThrow('NEXT_FORBIDDEN');
    setUserId(engineerId);
    await expect(materialsPage.default()).rejects.toThrow('NEXT_FORBIDDEN');
    setUserId(null);
    await expect(materialsPage.default()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);
    setUserId(adminId);
    await expect(materialsPage.default()).resolves.toBeDefined();
  });

  it('[AQP-130 AC-7] a foreign or missing Origin on a change is 403 and changes nothing (CSRF)', async () => {
    const id = idOf(await add('Qa130 powder coat'));
    const before = await stored();
    for (const origin of [FOREIGN_ORIGIN, null]) {
      expect((await send('POST', null, { name: 'Qa130 csrf' }, { origin })).status).toBe(403);
      expect((await send('PATCH', id, { name: 'Qa130 csrf' }, { origin })).status).toBe(403);
      expect((await send('DELETE', id, undefined, { origin })).status).toBe(403);
    }
    expect(await stored()).toBe(before);
  });

  it('[AQP-130 AC-7] the Admin\'s own refusals leave the other treatments unnamed: a 409 and a 422 carry the words, not the names of other rows', async () => {
    await insertAsOwner('Qa130 secret-looking name');
    const taken = await add('QA130 SECRET-LOOKING NAME');
    expect(taken.text).not.toContain('Qa130 secret-looking name');
    const locked = await rename(OTHER_ID, 'Qa130 x');
    expect(locked.text).not.toContain('Qa130 secret-looking name');
    expect(await idByName('Qa130 secret-looking name')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
