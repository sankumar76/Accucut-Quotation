import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { NUMBER_RULE_MESSAGE } from '@/lib/estimate/validation';
import { formResponseSchema, nodeDetailSchema, savedInputsSchema } from '@/server/views/schemas';
import { MAX_VALUES_PER_SAVE } from '@/server/views/schemas/form';

import { defined } from '../support/defined';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { seedFieldAt } from '../support/seed-config';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.03 T4 (AC-1 to AC-4, AC-7, AC-8), through the real `withRoute`, the real session and the real estimate service over in-memory storage: what the form
 * answers (one shape for every role, no cost), what a save must look like, what each refusal answers, and that every answer is one strict shape. Who may call is
 * `tests/security`. Every name and ID is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { GET: getForm } = await import('@/app/api/v1/estimates/[id]/form/route');
const { PATCH: saveInputs } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/inputs/route');
const { GET: getNode } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route');

const record = z.record(z.string(), z.unknown());
const LENGTH = seedFieldAt('J').id;
const WIDTH = seedFieldAt('K').id;
const PART_NO = seedFieldAt('B').id;
const MATERIAL = seedFieldAt('E').id;
const RATE = seedFieldAt('I').id;
const FIRST_MATERIAL = defined(MATERIAL_CANARIES[0]).id;

const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
/** The one part the recipe makes: the estimate's own ID, first at the top, revision 1. */
const canary = (): string => owned();
const base = (id = owned()): string => `/api/v1/estimates/${id}`;
const stored = () => defined(harness.estimateWorld.nodes[0]);
/** One value of a part as it leaves the server. */
const entry = (fieldId: string, value: string) => ({ fieldId, value });

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const forEstimate = (id: string) => ({ params: Promise.resolve({ id }) });
const forNode = (id: string, nodeId: string) => ({ params: Promise.resolve({ id, nodeId }) });

/** The one member of a problem body that differs between two calls. */
const withoutRequestId = (body: unknown): Record<string, unknown> => ({ ...record.parse(body), requestId: undefined });

const form = (id = owned()): Promise<Response> => getForm(request('GET', `${base(id)}/form`), forEstimate(id));

function save(body: unknown, id = owned(), nodeId = canary()): Promise<Response> {
  return saveInputs(request('PATCH', `${base(id)}/nodes/${nodeId}/inputs`, body), forNode(id, nodeId));
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
});

/** Puts the harness estimate and its one part back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  harness.estimateWorld.nodes.splice(0, harness.estimateWorld.nodes.length, { id: held.id, estimateId: held.id, parentId: null, sortIndex: 0, revision: 1, inputs: {} });
});

describe('AC-1, AC-2, AC-3, AC-8: GET /estimates/{id}/form', () => {
  it('answers every role with one strict shape and the same sections', async () => {
    const answers = [];
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const response = await form();
      expect(response.status).toBe(200);
      answers.push(await response.json());
    }
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(formResponseSchema.safeParse(answers[0]).success).toBe(true);
    expect(Object.keys(record.parse(answers[0])).sort()).toEqual(['lastSavedAt', 'sections']);
  });

  it('has the eight sections with their numbers, names and column ranges, and the letter of every field (STORY-05.04 AC-1)', async () => {
    const body = formResponseSchema.parse(await (await form()).json());
    expect(body.sections.map((section) => [section.number, section.name, section.columnRange])).toEqual([
      [1, 'Part Details', 'A, B, D, G, H'],
      [2, 'Material and Dimensions', 'E, F, J–L, N'],
      [3, 'Cutting Process', 'P, Q'],
      [4, 'Bending', 'R'],
      [5, 'Fasteners', 'S–U'],
      [6, 'Welding', 'V–Y'],
      [7, 'Surface Treatment', 'Z–AG'],
      [8, 'Other Costs and Remarks', 'AJ, AP, AU, BM'],
    ]);
    expect(body.sections.flatMap((section) => section.fields.map((field) => field.letter))).toEqual([
      ...['A', 'B', 'D', 'H', 'E', 'F', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'],
      ...['AP', 'AU', 'BM', 'AJ'],
    ]);
  });

  it('AC-6: sends Treatment / Color (G) and the eight surface treatments as placeholders, with a letter and a label and nothing else', async () => {
    const body = formResponseSchema.parse(await (await form()).json());
    expect(body.sections.map((section) => section.reserved.map((field) => field.letter))).toEqual([['G'], [], [], [], [], [], ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'], []]);
    expect(defined(body.sections[0]).reserved).toEqual([{ id: seedFieldAt('G').id, letter: 'G', label: 'Treatment / Color' }]);
  });

  it('AC-2, AC-3, AC-4: carries the rupee add-on and the hint of the cost-typed inputs, the default and hint of Fasteners, and the hint of Remarks', async () => {
    const body = formResponseSchema.parse(await (await form()).json());
    const field = (letter: string) => defined(body.sections.flatMap((section) => section.fields).find((candidate) => candidate.letter === letter));
    for (const letter of ['U', 'AP', 'AU', 'BM']) expect(field(letter), letter).toMatchObject({ unit: '₹', hint: 'Enter 0 if there is none.' });
    expect(field('S')).toMatchObject({ defaultValue: 'None', hint: 'Type "None" if the part has no fasteners.', rule: { type: 'text', maxLength: 200, multiline: false } });
    expect(field('AJ')).toMatchObject({ hint: 'Write "None" if there is nothing to add.', rule: { type: 'text', maxLength: 1000, multiline: true } });
    expect(field('B').defaultValue).toBeNull();
  });

  it('keeps the label "QTY per Assy" and carries the hint of the delivery lead (AC-2)', async () => {
    const body = formResponseSchema.parse(await (await form()).json());
    const qty = defined(body.sections.flatMap((section) => section.fields).find((field) => field.letter === 'H'));
    expect(qty.label).toBe('QTY per Assy');
    expect(qty.hint).toBe('Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.');
  });

  it('marks Material Considered read-only and has no Material Rate / Kg, no calculated field and no formula anywhere (AC-3, AC-8)', async () => {
    const text = await (await form()).text();
    const body = formResponseSchema.parse(JSON.parse(text));
    const fields = body.sections.flatMap((section) => section.fields);
    expect(defined(fields.find((field) => field.letter === 'F')).editable).toBe(false);
    expect(fields.map((field) => field.id)).not.toContain(RATE);
    // "cost" is the word of the four typed inputs and of the name of section 08 only (AC-7: what an Engineer types is no cost shown to them, FR-008).
    const allowed = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost', 'Other Costs and Remarks'];
    const rest = allowed.reduce((left, words) => left.replaceAll(words, ''), text);
    expect(rest).not.toMatch(/\{\{|formula|price|cost|rate|917373/i);
    for (const words of allowed) expect(text).toContain(words);
  });

  it('AC-7: no calculated field of any section is on the form: not one of the cost columns after Remarks, and not Total Process Cost', async () => {
    const body = formResponseSchema.parse(await (await form()).json());
    const ids = new Set([...body.sections.flatMap((section) => section.fields.map((field) => field.id)), ...body.sections.flatMap((section) => section.reserved.map((field) => field.id))]);
    for (const letter of ['M', 'O', 'AH', 'AI', 'AK', 'AL', 'AM', 'AN', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BG', 'BL', 'BN', 'BO']) {
      expect(ids.has(seedFieldAt(letter).id), letter).toBe(false);
    }
  });

  it('is 404 for another Engineer\'s estimate and for one that does not exist: the same answer', async () => {
    estimate().engineerId = harness.idOf.LEAD;
    const other = await form();
    const missing = await form(UNKNOWN_ID);
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(withoutRequestId(await other.json())).toEqual(withoutRequestId(await missing.json()));
  });

  it('answers with the one form schema, so a key planted into it is refused', () => {
    expect(getForm.responseSchema).toBe(formResponseSchema);
    expect(saveInputs.responseSchema).toBe(savedInputsSchema);
  });
});

describe('AC-4, AC-7: PATCH /estimates/{id}/nodes/{nodeId}/inputs', () => {
  it('saves by field ID with the revision, stores decimal text, and answers with the part\'s new revision and what is stored', async () => {
    const response = await save({ revision: 1, values: { [LENGTH]: '12.5', [PART_NO]: 'FR-1', [MATERIAL]: FIRST_MATERIAL } });
    expect(response.status).toBe(200);
    const body = savedInputsSchema.parse(await response.json());
    expect(body).toEqual({ id: canary(), revision: 2, completeness: 'PARTIAL', inputs: [entry(PART_NO, 'FR-1'), entry(MATERIAL, FIRST_MATERIAL), entry(LENGTH, '12.50')] });
    expect(stored().inputs).toEqual({ [LENGTH]: '12.50', [PART_NO]: 'FR-1', [MATERIAL]: FIRST_MATERIAL });
    expect(estimate().inputsRevision).toBe(1);
  });

  it('a value equal after normalisation changes nothing and does not raise inputs_revision (1.50 = 1.5)', async () => {
    await save({ revision: 1, values: { [LENGTH]: '1.50' } });
    const again = await save({ revision: 2, values: { [LENGTH]: '1.5' } });
    expect(again.status).toBe(200);
    expect(savedInputsSchema.parse(await again.json()).revision).toBe(2);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('keeps the typed text and answers 422 under the field with the words of the rule, for -1, 1.234 and abc', async () => {
    for (const typed of ['-1', '1.234', 'abc']) {
      const response = await save({ revision: 1, values: { [LENGTH]: typed } });
      expect(response.status, typed).toBe(422);
      const problem = record.parse(await response.json());
      expect(problem['errors']).toEqual([{ field: LENGTH, message: NUMBER_RULE_MESSAGE }]);
    }
    expect(stored().inputs).toEqual({});
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a blank is allowed while saving: 200, and the value is cleared', async () => {
    await save({ revision: 1, values: { [LENGTH]: '5' } });
    const cleared = await save({ revision: 2, values: { [LENGTH]: '' } });
    expect(cleared.status).toBe(200);
    expect(savedInputsSchema.parse(await cleared.json())).toMatchObject({ completeness: 'EMPTY', inputs: [] });
  });

  it('a stale revision is 409 PART_CHANGED and nothing is stored', async () => {
    await save({ revision: 1, values: { [LENGTH]: '1' } });
    const stale = await save({ revision: 1, values: { [WIDTH]: '2' } });
    expect(stale.status).toBe(409);
    expect(record.parse(await stale.json())).toMatchObject({ code: 'PART_CHANGED', status: 409 });
    expect(stored().inputs).toEqual({ [LENGTH]: '1.00' });
  });

  it.each([
    ['Material Rate / Kg (I)', RATE],
    ['a calculated field (M)', seedFieldAt('M').id],
    ['Material Considered (F)', seedFieldAt('F').id],
    ['an ID the registry does not have', UNKNOWN_ID],
  ])('%s is 422 under that ID, and no value is stored', async (_name, id) => {
    const response = await save({ revision: 1, values: { [id]: '5', [LENGTH]: '1' } });
    expect(response.status).toBe(422);
    expect(record.parse(await response.json())['errors']).toEqual([{ field: id, message: 'This field cannot be saved.' }]);
    expect(stored().inputs).toEqual({});
  });

  it.each([
    ['a number sent as a JSON number, not as text', { revision: 1, values: { [LENGTH]: 12.5 } }],
    ['a value of null', { revision: 1, values: { [LENGTH]: null } }],
    ['a key that is not a field ID', { revision: 1, values: { length: '5' } }],
    ['no revision', { values: {} }],
    ['revision 0', { revision: 0, values: {} }],
    ['a revision as text', { revision: '1', values: {} }],
    ['no values', { revision: 1 }],
    ['a key the route does not offer', { revision: 1, values: {}, parentId: null }],
    ['a value of more than 1,000 characters', { revision: 1, values: { [PART_NO]: 'x'.repeat(1001) } }],
    ['more values than a form can have', { revision: 1, values: Object.fromEntries(Array.from({ length: MAX_VALUES_PER_SAVE + 1 }, (_, index) => [`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, '1'])) }],
  ])('%s is 422 and nothing is stored', async (_name, body) => {
    const response = await save(body);
    expect(response.status).toBe(422);
    expect(stored().inputs).toEqual({});
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a body that is not JSON is 400', async () => {
    const notJson = new Request(`${ORIGIN}${base()}/nodes/${canary()}/inputs`, { method: 'PATCH', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await saveInputs(notJson, forNode(owned(), canary()))).status).toBe(400);
  });

  it('is 404 for another Engineer\'s estimate, one that does not exist, and a part that is not there: the same answer for all', async () => {
    const unknownPart = await save({ revision: 1, values: {} }, owned(), UNKNOWN_ID);
    const unknownEstimate = await save({ revision: 1, values: {} }, UNKNOWN_ID);
    estimate().engineerId = harness.idOf.LEAD;
    const notTheirs = await save({ revision: 1, values: {} });
    for (const answer of [unknownPart, unknownEstimate, notTheirs]) expect(answer.status).toBe(404);
    expect(withoutRequestId(await notTheirs.json())).toEqual(withoutRequestId(await unknownEstimate.json()));
  });

  it('is 409 ESTIMATE_NOT_EDITABLE for an Engineer once the estimate is submitted, and a Lead may still save', async () => {
    estimate().status = 'SUBMITTED';
    const refused = await save({ revision: 1, values: { [LENGTH]: '1' } });
    expect(refused.status).toBe(409);
    expect(record.parse(await refused.json())).toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    harness.signInAs('LEAD');
    expect((await save({ revision: 1, values: { [LENGTH]: '1' } })).status).toBe(200);
  });

  it('refuses a request from another origin before anything is read (CSRF)', async () => {
    const foreign = new Request(`${ORIGIN}${base()}/nodes/${canary()}/inputs`, {
      method: 'PATCH',
      headers: { origin: 'https://evil.example.test', 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 1, values: { [LENGTH]: '1' } }),
    });
    expect((await saveInputs(foreign, forNode(owned(), canary()))).status).toBe(403);
    expect(stored().inputs).toEqual({});
  });
});

describe('STORY-05.04 AC-1, AC-4, AC-5: saving the fields of the other sections', () => {
  const PICK = (letter: string): string => seedFieldAt(letter).id;
  const COST_LETTERS = ['U', 'AP', 'AU', 'BM'];

  it('stores every number of sections 03 to 08 as decimal text with two decimals, and answers with what was typed, no figure of its own', async () => {
    const letters = ['P', 'Q', 'R', 'T', 'V', 'W', 'X', 'Y', ...COST_LETTERS];
    const values = Object.fromEntries(letters.map((letter, index) => [PICK(letter), `${index + 1}.5`]));
    const response = await save({ revision: 1, values });
    expect(response.status).toBe(200);
    const body = savedInputsSchema.parse(await response.json());
    expect(body.revision).toBe(2);
    expect(Object.fromEntries(body.inputs.map((item) => [item.fieldId, item.value]))).toEqual(Object.fromEntries(letters.map((letter, index) => [PICK(letter), `${index + 1}.50`])));
    expect(estimate().inputsRevision).toBe(1);
  });

  it('AC-5: the number rule is the same as in 05.03 for every new number: -1, 1.234 and abc are 422 with the words of the rule, and a repeat of the same value is no change', async () => {
    for (const letter of ['P', 'U', 'AP', 'AU', 'BM']) {
      for (const typed of ['-1', '1.234', 'abc']) {
        const response = await save({ revision: 1, values: { [PICK(letter)]: typed } });
        expect(response.status, `${letter} ${typed}`).toBe(422);
        expect(record.parse(await response.json())['errors']).toEqual([{ field: PICK(letter), message: NUMBER_RULE_MESSAGE }]);
      }
    }
    await save({ revision: 1, values: { [PICK('BM')]: '4.5' } });
    const again = await save({ revision: 2, values: { [PICK('BM')]: '4.50' } });
    expect(savedInputsSchema.parse(await again.json()).revision).toBe(2);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('AC-3: Fasteners (S) is saved as typed, and a part that never had it saved has no value for it: the default "None" is the form\'s, not stored', async () => {
    const untouched = await save({ revision: 1, values: { [PICK('P')]: '3' } });
    expect(savedInputsSchema.parse(await untouched.json()).inputs.map((item) => item.fieldId)).toEqual([PICK('P')]);
    const typed = await save({ revision: 2, values: { [PICK('S')]: '  M6 bolt ' } });
    expect(savedInputsSchema.parse(await typed.json()).inputs).toContainEqual(entry(PICK('S'), 'M6 bolt'));
  });

  it('AC-4 (assumption A-1): Remarks (AJ) takes 1,000 characters and 422s one more with the words "Use 1,000 characters or fewer."; Part No. (B) still stops at 200', async () => {
    const full = await save({ revision: 1, values: { [PICK('AJ')]: 'x'.repeat(1000) } });
    expect(full.status).toBe(200);
    const over = await save({ revision: 2, values: { [PICK('AJ')]: 'x'.repeat(1001) } });
    expect(over.status).toBe(422);
    expect(record.parse(await over.json())['errors']).toEqual([{ field: PICK('AJ'), message: 'Use 1,000 characters or fewer.' }]);
    const partNo = await save({ revision: 2, values: { [PART_NO]: 'x'.repeat(201) } });
    expect(partNo.status).toBe(422);
    expect(record.parse(await partNo.json())['errors']).toEqual([{ field: PART_NO, message: 'Use 200 characters or fewer.' }]);
  });

  it('AC-4: Remarks keeps its line breaks, a lone surrogate is 422 and not a 500 (review SQR-13), and a control character is 422', async () => {
    const lines = await save({ revision: 1, values: { [PICK('AJ')]: 'one\r\ntwo' } });
    expect(savedInputsSchema.parse(await lines.json()).inputs).toContainEqual(entry(PICK('AJ'), 'one\ntwo'));
    for (const typed of ['bad\uD800text', 'nul\u0000byte']) {
      const refused = await save({ revision: 2, values: { [PART_NO]: typed } });
      expect(refused.status, typed).toBe(422);
    }
  });

  it.each([
    ['Treatment / Color (G)', 'G'],
    ['Hot Dip Galvanizing (Z)', 'Z'],
    ['Soft Anodize (AG)', 'AG'],
    ['Part Model (C)', 'C'],
    ['Total Process Cost (AY), the calculated twin of Machining Cost', 'AY'],
    ['Approved Quote Price (BO)', 'BO'],
  ])('%s is 422 "This field cannot be saved.", and nothing is stored', async (_name, letter) => {
    const response = await save({ revision: 1, values: { [PICK(letter)]: '1' } });
    expect(response.status).toBe(422);
    expect(record.parse(await response.json())['errors']).toEqual([{ field: PICK(letter), message: 'This field cannot be saved.' }]);
    expect(stored().inputs).toEqual({});
  });
});

describe('SQR-09: the part is read back by field ID', () => {
  it('GET /nodes/{nodeId} sends what was saved, by field ID, with its revision, for every role', async () => {
    await save({ revision: 1, values: { [LENGTH]: '10', [PART_NO]: 'FR-1' } });
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const response = await getNode(request('GET', `${base()}/nodes/${canary()}`), forNode(owned(), canary()));
      expect(response.status).toBe(200);
      const part = nodeDetailSchema.parse(await response.json());
      expect(part).toMatchObject({ revision: 2, completeness: 'PARTIAL', inputs: [entry(PART_NO, 'FR-1'), entry(LENGTH, '10.00')] });
    }
  });

  it('the schemas refuse a key that is not a field ID, a value that is not text, and a planted key', () => {
    const part = { id: 'a', parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1 };
    expect(nodeDetailSchema.safeParse({ ...part, inputs: [entry(LENGTH, '1.00')] }).success).toBe(true);
    expect(nodeDetailSchema.safeParse({ ...part, inputs: [entry('length', '1.00')] }).success).toBe(false);
    expect(nodeDetailSchema.safeParse({ ...part, inputs: [{ fieldId: LENGTH, value: '1.00', planted: 1 }] }).success).toBe(false);
    expect(nodeDetailSchema.safeParse({ ...part, inputs: [{ fieldId: LENGTH, value: 1 }] }).success).toBe(false);
    expect(nodeDetailSchema.safeParse({ ...part, inputs: [], planted: 1 }).success).toBe(false);
    expect(savedInputsSchema.safeParse({ id: 'a', revision: 1, completeness: 'EMPTY', inputs: [], planted: 1 }).success).toBe(false);
    expect(formResponseSchema.safeParse({ sections: [], lastSavedAt: null, planted: 1 }).success).toBe(false);
  });
});
