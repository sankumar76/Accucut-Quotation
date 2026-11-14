import { describe, expect, it, vi } from 'vitest';

import { loadForm, loadMaterialOptions, loadPartInputs, PART_CHANGED_CODE, savePartInputs } from '@/lib/estimates/form-client';

/**
 * STORY-05.03 T5 (AC-1, AC-4, AC-5, AC-7): the browser's side of the part form's routes, with a fetch that answers for the server. Nothing here decides anything; a
 * wrong-shaped answer is a failure and not a crash, and a refusal carries the server's words under the field's ID. Every name and ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PART = '00000000-0000-4000-8000-0000000000d1';
const FIELD = '00000000-0000-4000-8000-000100000010';
const OTHER_FIELD = '00000000-0000-4000-8000-000100000011';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });

const field = (overrides: Record<string, unknown> = {}) => ({
  id: FIELD,
  letter: 'J',
  label: 'Length',
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: null,
  required: true,
  editable: true,
  rule: { type: 'number', decimals: 2 },
  ...overrides,
});
const section = (fields: unknown[] = [field()], reserved: unknown[] = []) => ({
  id: '00000000-0000-4000-8000-000200000002',
  number: 2,
  name: 'Material and Dimensions',
  shortName: 'Material',
  columnRange: 'E, F, J–L, N',
  fields,
  reserved,
});

describe('loadForm', () => {
  it('reads GET /api/v1/estimates/{id}/form into sections of fields, with each field\'s rule and the time of the last save', async () => {
    const fetcher = vi.fn(() => Promise.resolve(json(200, { sections: [section([field(), field({ id: OTHER_FIELD, letter: 'B', rule: { type: 'text', maxLength: 200, multiline: false } })])], lastSavedAt: '2026-11-14T10:41:00.000Z' })));
    const outcome = await loadForm(ESTIMATE, fetcher);
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/estimates/${ESTIMATE}/form`, expect.objectContaining({ method: 'GET' }));
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.value.lastSavedAt).toBe('2026-11-14T10:41:00.000Z');
    expect(outcome.value.sections[0]).toMatchObject({ number: 2, name: 'Material and Dimensions', columnRange: 'E, F, J–L, N' });
    expect(outcome.value.sections[0]?.fields.map((entry) => [entry.letter, entry.rule.type])).toEqual([
      ['J', 'number'],
      ['B', 'text'],
    ]);
  });

  it('reads every kind of rule', async () => {
    const rules = [{ type: 'number', decimals: 2 }, { type: 'text', maxLength: 200, multiline: true }, { type: 'select', source: 'materials' }, { type: 'derived', from: FIELD }, { type: 'derived', from: null }];
    const answer = { sections: [section(rules.map((rule) => field({ rule })))], lastSavedAt: null };
    const outcome = await loadForm(ESTIMATE, () => Promise.resolve(json(200, answer)));
    expect(outcome.status === 'ok' && outcome.value.sections[0]?.fields.map((entry) => entry.rule)).toEqual(rules);
  });

  it('STORY-05.04: reads a field\'s default, its rupee unit and hint, a text of 1,000 characters, and the placeholders of a section', async () => {
    const fasteners = field({ id: OTHER_FIELD, letter: 'S', label: 'Fasteners', defaultValue: 'None', hint: 'Type "None" if the part has no fasteners.', rule: { type: 'text', maxLength: 200, multiline: false } });
    const remarks = field({ letter: 'AJ', label: 'Remarks', unit: '₹', rule: { type: 'text', maxLength: 1000, multiline: true } });
    const placeholder = { id: '00000000-0000-4000-8000-000100000007', letter: 'G', label: 'Treatment / Color' };
    const outcome = await loadForm(ESTIMATE, () => Promise.resolve(json(200, { sections: [section([fasteners, remarks], [placeholder])], lastSavedAt: null })));
    expect(outcome.status === 'ok' && outcome.value.sections[0]?.fields.map((entry) => [entry.letter, entry.defaultValue, entry.unit])).toEqual([
      ['S', 'None', null],
      ['AJ', null, '₹'],
    ]);
    expect(outcome.status === 'ok' && outcome.value.sections[0]?.fields[1]?.rule).toEqual({ type: 'text', maxLength: 1000, multiline: true });
    expect(outcome.status === 'ok' && outcome.value.sections[0]?.reserved).toEqual([placeholder]);
  });

  it.each([
    ['a field with a default that is not text', { sections: [section([field({ defaultValue: 5 })])], lastSavedAt: null }],
    ['a field with no default key', { sections: [section([{ ...field(), defaultValue: undefined }])], lastSavedAt: null }],
    ['a section whose placeholders are not a list', { sections: [{ ...section(), reserved: 'x' }], lastSavedAt: null }],
    ['a section with no placeholders list', { sections: [{ ...section(), reserved: undefined }], lastSavedAt: null }],
    ['a placeholder with no letter', { sections: [section([field()], [{ id: FIELD, letter: '', label: 'Treatment / Color' }])], lastSavedAt: null }],
  ])('an answer with %s is a failure, not a crash', async (_name, answer) => {
    expect((await loadForm(ESTIMATE, () => Promise.resolve(json(200, answer)))).status).toBe('failed');
  });

  it.each([
    ['sections that are not a list', { sections: {}, lastSavedAt: null }],
    ['a field with no letter', { sections: [section([field({ letter: '' })])], lastSavedAt: null }],
    ['a field with a rule that is not known', { sections: [section([field({ rule: { type: 'formula', text: 'x' } })])], lastSavedAt: null }],
    ['a field of a kind that is not known', { sections: [section([field({ kind: 'output' })])], lastSavedAt: null }],
    ['a last save that is not text', { sections: [], lastSavedAt: 5 }],
    ['a section with no fields list', { sections: [{ ...section(), fields: 'x' }], lastSavedAt: null }],
    ['no body', undefined],
  ])('an answer with %s is a failure, not a crash', async (_name, answer) => {
    expect((await loadForm(ESTIMATE, () => Promise.resolve(json(200, answer)))).status).toBe('failed');
  });

  it('a 404 is a refusal the screen can read; a server fault is a failure', async () => {
    expect((await loadForm(ESTIMATE, () => Promise.resolve(json(404, { code: 'NOT_FOUND', title: 'Not found.', status: 404 })))).status).toBe('refused');
    expect((await loadForm(ESTIMATE, () => Promise.resolve(json(500, { code: 'X', title: 'Y' })))).status).toBe('failed');
    expect((await loadForm(ESTIMATE, () => Promise.reject(new Error('offline')))).status).toBe('failed');
  });

  it('puts the estimate ID in the path as one segment', async () => {
    const fetcher = vi.fn(() => Promise.resolve(json(200, { sections: [], lastSavedAt: null })));
    await loadForm('a/b?c', fetcher);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/estimates/a%2Fb%3Fc/form', expect.anything());
  });
});

describe('loadPartInputs and savePartInputs', () => {
  const part = { id: PART, parentId: null, slNo: '1', label: '', completeness: 'PARTIAL', revision: 3, inputs: [{ fieldId: FIELD, value: '12.50' }] };

  it('reads GET /nodes/{nodeId} into the part\'s revision and its values by field ID', async () => {
    const fetcher = vi.fn(() => Promise.resolve(json(200, part)));
    const outcome = await loadPartInputs(ESTIMATE, PART, fetcher);
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/estimates/${ESTIMATE}/nodes/${PART}`, expect.objectContaining({ method: 'GET' }));
    expect(outcome).toEqual({ status: 'ok', value: { id: PART, revision: 3, completeness: 'PARTIAL', inputs: { [FIELD]: '12.50' } } });
  });

  it('sends PATCH /nodes/{nodeId}/inputs with the revision and the values by field ID, and reads the part as saved', async () => {
    const fetcher = vi.fn(() => Promise.resolve(json(200, { id: PART, revision: 4, completeness: 'PARTIAL', inputs: [{ fieldId: FIELD, value: '12.50' }] })));
    const outcome = await savePartInputs(ESTIMATE, PART, { revision: 3, values: { [FIELD]: '12.5' } }, fetcher);
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe(`/api/v1/estimates/${ESTIMATE}/nodes/${PART}/inputs`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ revision: 3, values: { [FIELD]: '12.5' } });
    expect(outcome).toEqual({ status: 'ok', value: { id: PART, revision: 4, completeness: 'PARTIAL', inputs: { [FIELD]: '12.50' } } });
  });

  it('carries the server\'s words under the ID of the field at fault when a value is refused (422)', async () => {
    const problem = { code: 'VALIDATION_FAILED', title: 'x', status: 422, errors: [{ field: FIELD, message: 'Enter 0 or more, with up to 2 decimals.' }] };
    const outcome = await savePartInputs(ESTIMATE, PART, { revision: 3, values: { [FIELD]: '-1' } }, () => Promise.resolve(json(422, problem)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { [FIELD]: 'Enter 0 or more, with up to 2 decimals.' } });
  });

  it('names a part that changed under the person by its code (409)', async () => {
    const outcome = await savePartInputs(ESTIMATE, PART, { revision: 1, values: {} }, () => Promise.resolve(json(409, { code: PART_CHANGED_CODE, title: 'changed', status: 409 })));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: 'PART_CHANGED' });
  });

  it.each([
    ['an entry with no value', { ...part, inputs: [{ fieldId: FIELD }] }],
    ['inputs that are not a list', { ...part, inputs: {} }],
    ['a revision that is not a number', { ...part, revision: '3' }],
    ['a completeness that is not known', { ...part, completeness: 'DONE' }],
    ['no ID', { ...part, id: '' }],
  ])('an answer with %s is a failure', async (_name, answer) => {
    expect((await loadPartInputs(ESTIMATE, PART, () => Promise.resolve(json(200, answer)))).status).toBe('failed');
    expect((await savePartInputs(ESTIMATE, PART, { revision: 1, values: {} }, () => Promise.resolve(json(200, answer)))).status).toBe('failed');
  });
});

describe('loadMaterialOptions (AC-5)', () => {
  it('reads GET /api/v1/options/materials: the ID, the name and Material Considered of each, or null for one with none', async () => {
    const fetcher = vi.fn(() => Promise.resolve(json(200, { options: [{ id: PART, name: 'Invented-plate', materialConsidered: 'Invented steel' }, { id: ESTIMATE, name: 'Not applicable', materialConsidered: null }] })));
    const outcome = await loadMaterialOptions(fetcher);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/options/materials', expect.objectContaining({ method: 'GET' }));
    expect(outcome).toEqual({
      status: 'ok',
      value: [
        { id: PART, name: 'Invented-plate', materialConsidered: 'Invented steel' },
        { id: ESTIMATE, name: 'Not applicable', materialConsidered: null },
      ],
    });
  });

  it.each([
    ['options that are not a list', { options: 'x' }],
    ['an option with no name', { options: [{ id: PART, name: '', materialConsidered: 'x' }] }],
    ['an option whose Material Considered is a number', { options: [{ id: PART, name: 'a', materialConsidered: 5 }] }],
  ])('an answer with %s is a failure', async (_name, answer) => {
    expect((await loadMaterialOptions(() => Promise.resolve(json(200, answer)))).status).toBe('failed');
  });

  it('reads only the three members of an option: nothing else of an answer is kept', async () => {
    const outcome = await loadMaterialOptions(() => Promise.resolve(json(200, { options: [{ id: PART, name: 'a', materialConsidered: 'b', extra: 'kept?' }] })));
    expect(outcome.status === 'ok' && Object.keys(outcome.value[0] ?? {}).sort()).toEqual(['id', 'materialConsidered', 'name']);
  });
});
