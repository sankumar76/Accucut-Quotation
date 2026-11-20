import { describe, expect, it, vi } from 'vitest';

import { loadInsertOptions, previewInsert, saveInsert } from '@/lib/config/insert-field-client';

/**
 * STORY-08.03 AC-2, AC-3, AC-4, AC-7: the browser's three calls of the insert wizard. `fetch` is replaced, so the test answers for the server. A good answer is read field by field into what the screen shows;
 * a refusal arrives with its code, the server's sentence and the fields it names; an answer of the wrong shape is a failure and never a success that might be wrong; the body is the spec and the version and
 * nothing else (an insert asks for no password, FR-080). Every name and ID is invented.
 */

const OPTIONS = {
  version: 9,
  columns: [
    { id: 'c-a', letter: 'ZA', label: 'Invented Length', kind: 'input', watchable: true, hideable: true },
    { id: 'c-b', letter: 'ZB', label: 'Invented Cost', kind: 'output', watchable: false, hideable: false },
    { id: 'c-c', letter: 'ZC', label: 'Invented Auto', kind: 'auto', watchable: false, hideable: false },
  ],
  sections: [{ id: 's-1', number: 1, name: 'Invented Section' }],
  stages: [{ id: 'g-1', number: 3, name: 'Invented Stage', subHeadings: ['Invented Heading'] }],
  numberFormats: ['0.00', '@'],
};

const PREVIEW = {
  baseVersion: 9,
  inserted: [{ letter: 'ZA', label: 'Invented Input', kind: 'input', followsLetter: 'YZ' }],
  moved: [{ label: 'Invented Total', from: 'ZA', to: 'ZB' }],
  productCells: [{ label: 'Invented Price', from: 'BL2', to: 'BM2' }],
  formulas: [{ letter: 'ZB', label: 'Invented Cost', formula: 'ZA * 2' }],
};

const SAVED = { version: 10, letters: ['ZA'], message: 'Inserted as ZA. Configuration version 10.' };
const SPEC = { kind: 'input', afterFieldId: 'c-a', input: { label: 'Invented' } };

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('loadInsertOptions', () => {
  it('sends GET /api/v1/config/insert-options and reads the columns, sections, stages and formats and the version', async () => {
    const doFetch = fetching(answer(OPTIONS));
    expect(await loadInsertOptions(doFetch)).toEqual({ status: 'ok', value: OPTIONS });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/insert-options');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it.each([
    ['no version', { ...OPTIONS, version: 'nine' }],
    ['a column of a kind that does not exist', { ...OPTIONS, columns: [{ ...OPTIONS.columns[0], kind: 'picture' }] }],
    ['a column with no watchable flag', { ...OPTIONS, columns: [{ id: 'c', letter: 'ZA', label: 'L', kind: 'input', hideable: true }] }],
    ['a column with no hideable flag', { ...OPTIONS, columns: [{ id: 'c', letter: 'ZA', label: 'L', kind: 'input', watchable: true }] }],
    ['a section with no number', { ...OPTIONS, sections: [{ id: 's', name: 'S' }] }],
    ['a stage with a sub-heading that is no text', { ...OPTIONS, stages: [{ id: 'g', number: 1, name: 'G', subHeadings: [1] }] }],
    ['a stage with no sub-headings list', { ...OPTIONS, stages: [{ id: 'g', number: 1, name: 'G' }] }],
    ['formats that are not a list', { ...OPTIONS, numberFormats: '0.00' }],
    ['a body that is not an object', 'nothing'],
  ])('is a failure, never a success, for %s', async (_what, body) => {
    expect(await loadInsertOptions(fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('is a failure when no answer came', async () => {
    expect(await loadInsertOptions(fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });

  it('is a refusal, with the code and the sentence, for a caller who may not', async () => {
    const outcome = await loadInsertOptions(fetching(answer({ type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' }, 403)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 403, code: 'FORBIDDEN', title: 'You do not have access to this.' });
  });
});

describe('previewInsert', () => {
  it('sends POST /api/v1/config/fields/preview with the spec and the letters-only flag, and reads the letters, moved columns, product cells and formulas', async () => {
    const doFetch = fetching(answer(PREVIEW));
    const outcome = await previewInsert(SPEC, true, doFetch);
    expect(outcome).toEqual({
      status: 'ok',
      value: { baseVersion: 9, inserted: [{ letter: 'ZA', label: 'Invented Input', kind: 'input' }], moved: PREVIEW.moved, productCells: PREVIEW.productCells, formulas: PREVIEW.formulas },
    });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/fields/preview');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ spec: SPEC, lettersOnly: true });
  });

  it('reads the preview of a pair with two new fields and no product cell', async () => {
    const pair = { ...PREVIEW, inserted: [...PREVIEW.inserted, { letter: 'ZB', label: 'Invented Cost', kind: 'output', followsLetter: 'ZA' }], productCells: [] };
    expect(await previewInsert(SPEC, false, fetching(answer(pair)))).toMatchObject({ status: 'ok', value: { inserted: [{ kind: 'input' }, { kind: 'output' }], productCells: [] } });
  });

  it('carries the server\'s sentence under the control it names for a refusal (422)', async () => {
    const body = { type: 'about:blank', title: 'Some fields need fixing.', status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'input.label', message: 'Enter a label.' }] };
    expect(await previewInsert(SPEC, false, fetching(answer(body, 422)))).toMatchObject({ status: 'refused', httpStatus: 422, fields: { 'input.label': 'Enter a label.' } });
  });

  it.each([
    ['no base version', { ...PREVIEW, baseVersion: undefined }],
    ['a new field of a kind that does not exist', { ...PREVIEW, inserted: [{ letter: 'ZA', label: 'L', kind: 'auto' }] }],
    ['a new field with no letter', { ...PREVIEW, inserted: [{ label: 'L', kind: 'input' }] }],
    ['a moved column with no target', { ...PREVIEW, moved: [{ label: 'L', from: 'ZA' }] }],
    ['a product cell with no label', { ...PREVIEW, productCells: [{ from: 'BL2', to: 'BM2' }] }],
    ['a formula with no text', { ...PREVIEW, formulas: [{ letter: 'ZB', label: 'L' }] }],
    ['moved columns that are not a list', { ...PREVIEW, moved: 'ZA' }],
  ])('is a failure for %s', async (_what, body) => {
    expect(await previewInsert(SPEC, false, fetching(answer(body)))).toEqual({ status: 'failed' });
  });
});

describe('saveInsert', () => {
  it('sends POST /api/v1/config/fields with the spec and the base version and nothing else, and reads the version, the letters and the sentence', async () => {
    const doFetch = fetching(answer(SAVED));
    expect(await saveInsert(SPEC, 9, doFetch)).toEqual({ status: 'ok', value: SAVED });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/fields');
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ spec: SPEC, baseVersion: 9 });
    expect(String(doFetch.mock.calls[0]?.[1]?.body)).not.toMatch(/password/i);
  });

  it('is a refusal with the newer number in the body for a stale base (409)', async () => {
    const body = { type: 'about:blank', title: 'The fields and formulas were changed while you were inserting.', status: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 11 };
    const outcome = await saveInsert(SPEC, 9, fetching(answer(body, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: 'CONFIG_VERSION_CHANGED' });
    expect(outcome.status === 'refused' && outcome.body['currentVersion']).toBe(11);
  });

  it.each([
    ['no version', { letters: ['ZA'], message: 'M' }],
    ['letters that are not text', { version: 10, letters: [1], message: 'M' }],
    ['no sentence', { version: 10, letters: ['ZA'] }],
    ['a server fault', 'x'],
  ])('is a failure for %s', async (_what, body) => {
    expect(await saveInsert(SPEC, 9, fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('is a failure for a 500 and for no answer: it is then not known whether the fields went in', async () => {
    expect(await saveInsert(SPEC, 9, fetching(answer({ title: 'Boom' }, 500)))).toEqual({ status: 'failed' });
    expect(await saveInsert(SPEC, 9, fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });
});
