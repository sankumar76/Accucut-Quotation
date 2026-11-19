import { describe, expect, it, vi } from 'vitest';

import { checkFormula, listSampleRows, readConfigVersionNumber, saveFormula } from '@/lib/config/formula-editor-client';

/**
 * STORY-08.02 AC-1, AC-2, AC-4, AC-5, AC-9: the browser's four calls of the formula editor. `fetch` is replaced, so the test answers for the server. A good answer is read field by field into what the screen
 * shows; a refusal arrives with its code, the server's sentence and the fields it names; an answer of the wrong shape is a failure and never a success that might be wrong; the password goes in the body of the
 * one request and nowhere else. Every name, ID and password is invented.
 */

const FIELD = '00000000-0000-4000-8000-0000000000f1';
const CHECK = {
  valid: true,
  message: 'The formula is valid.',
  uses: [{ kind: 'field', name: 'P (Cutting Time)' }],
  feeds: [{ letter: 'AY', label: 'Total Process Cost' }],
  note: null,
  preview: { estimateCode: 'Q-2026-0318', slNo: '1.1', value: '45.12', shown: '45.12', operands: [{ name: 'P Cutting Time', value: '96' }] },
};

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('checkFormula', () => {
  it('sends POST /api/v1/config/formula-check with the field, the text and the chosen row, and reads what the server says', async () => {
    const doFetch = fetching(answer(CHECK));
    const outcome = await checkFormula({ fieldId: FIELD, text: 'P * 2', sampleRowId: 'row-1' }, doFetch);
    expect(outcome).toEqual({
      status: 'ok',
      value: { message: 'The formula is valid.', uses: CHECK.uses, feeds: CHECK.feeds, note: null, preview: CHECK.preview },
    });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/formula-check');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ fieldId: FIELD, text: 'P * 2', sampleRowId: 'row-1' });
  });

  it('reads a check with no sample estimate (no preview) and one with a note', async () => {
    const none = await checkFormula({ fieldId: FIELD, text: 'P' }, fetching(answer({ ...CHECK, preview: null, note: 'A note.' })));
    expect(none).toMatchObject({ status: 'ok', value: { preview: null, note: 'A note.' } });
  });

  it('reads a preview with no figure, the dash of a division by zero', async () => {
    const dash = { ...CHECK.preview, value: null, shown: '—', slNo: null };
    expect(await checkFormula({ fieldId: FIELD, text: 'P / 0' }, fetching(answer({ ...CHECK, preview: dash })))).toMatchObject({ status: 'ok', value: { preview: dash } });
  });

  it('answers a refusal with the SCR-18 sentence under text, never as a success', async () => {
    const problem = { code: 'VALIDATION_FAILED', title: 'Check the values and try again.', status: 422, errors: [{ field: 'text', message: '"Cuting" is not a column letter, rate name or function.' }] };
    const outcome = await checkFormula({ fieldId: FIELD, text: 'Cuting' }, fetching(answer(problem, 422)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, code: 'VALIDATION_FAILED', fields: { text: '"Cuting" is not a column letter, rate name or function.' } });
  });

  it.each([
    ['a body that is not the shape', { valid: true }],
    ['a use of an unknown kind', { ...CHECK, uses: [{ kind: 'planted', name: 'x' }] }],
    ['a feeds entry with no label', { ...CHECK, feeds: [{ letter: 'AY' }] }],
    ['a preview with no shown text', { ...CHECK, preview: { ...CHECK.preview, shown: 3 } }],
    ['an operand that is no pair', { ...CHECK, preview: { ...CHECK.preview, operands: [{ name: 1 }] } }],
    ['a note that is a number', { ...CHECK, note: 4 }],
    ['no note at all', { valid: true, message: 'x', uses: [], feeds: [], preview: null }],
  ])('is a failure for %s', async (_name, body) => {
    expect(await checkFormula({ fieldId: FIELD, text: 'P' }, fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('is a failure when the network is down or the server faults', async () => {
    expect(await checkFormula({ fieldId: FIELD, text: 'P' }, fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await checkFormula({ fieldId: FIELD, text: 'P' }, fetching(answer({ title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });
});

describe('listSampleRows', () => {
  it('reads the estimate, its rows and the operand names', async () => {
    const body = { estimate: { code: 'Q-2026-0318' }, rows: [{ id: 'r1', slNo: '1.1', name: 'Base frame' }], operandNames: ['An-Operand'] };
    const doFetch = fetching(answer(body));
    expect(await listSampleRows(doFetch)).toEqual({ status: 'ok', value: { estimateCode: 'Q-2026-0318', rows: body.rows, operandNames: ['An-Operand'] } });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/sample-rows');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('reads no estimate and no rows', async () => {
    expect(await listSampleRows(fetching(answer({ estimate: null, rows: [], operandNames: [] })))).toEqual({ status: 'ok', value: { estimateCode: null, rows: [], operandNames: [] } });
  });

  it.each([
    ['an estimate with no code', { estimate: {}, rows: [], operandNames: [] }],
    ['a row with no Sl. No', { estimate: null, rows: [{ id: 'r' }], operandNames: [] }],
    ['operand names that are numbers', { estimate: null, rows: [], operandNames: [1] }],
    ['no list of rows', { estimate: null, operandNames: [] }],
  ])('is a failure for %s', async (_name, body) => {
    expect(await listSampleRows(fetching(answer(body)))).toEqual({ status: 'failed' });
  });
});

describe('readConfigVersionNumber', () => {
  it('reads the number of the version in force from GET /api/v1/config/current', async () => {
    const doFetch = fetching(answer({ number: 9, savedBy: null, savedAt: '2026-11-05T09:00:00.000Z', estimatesInUse: 0 }));
    expect(await readConfigVersionNumber(doFetch)).toEqual({ status: 'ok', value: 9 });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/current');
  });

  it('is a failure for an answer with no number', async () => {
    expect(await readConfigVersionNumber(fetching(answer({ savedBy: null })))).toEqual({ status: 'failed' });
  });
});

describe('saveFormula', () => {
  it('sends PUT /api/v1/config/fields/{id}/formula with the text, the password and the base version, and reads the new version', async () => {
    const doFetch = fetching(answer({ version: 10, changed: true, message: 'Formula saved as configuration version 10.' }));
    const outcome = await saveFormula(FIELD, { text: 'P * 2', password: 'Invented-Secret-1!', baseVersion: 9 }, doFetch);
    expect(outcome).toEqual({ status: 'ok', value: { version: 10, changed: true, message: 'Formula saved as configuration version 10.' } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/config/fields/${FIELD}/formula`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', credentials: 'same-origin' });
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ text: 'P * 2', password: 'Invented-Secret-1!', baseVersion: 9 });
  });

  it('puts the password in the body and in no address or header', async () => {
    const doFetch = fetching(answer({ version: 2, changed: false, message: 'Nothing.' }));
    await saveFormula(FIELD, { text: 'P', password: 'Invented-Secret-1!', baseVersion: 1 }, doFetch);
    expect(String(doFetch.mock.calls[0]?.[0])).not.toContain('Invented-Secret');
    expect(JSON.stringify(doFetch.mock.calls[0]?.[1]?.headers)).not.toContain('Invented-Secret');
  });

  it('encodes the field ID into the path', async () => {
    const doFetch = fetching(answer({ version: 2, changed: false, message: 'x' }));
    await saveFormula('a/b c', { text: 'P', password: 'x', baseVersion: 1 }, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/fields/a%2Fb%20c/formula');
  });

  it('answers a wrong password and a block as refusals with their codes and the server sentence', async () => {
    const wrong = await saveFormula(FIELD, { text: 'P', password: 'x', baseVersion: 1 }, fetching(answer({ code: 'STEP_UP_FAILED', title: 'That password is not correct.', status: 422 }, 422)));
    expect(wrong).toMatchObject({ status: 'refused', httpStatus: 422, code: 'STEP_UP_FAILED', title: 'That password is not correct.' });
    const locked = await saveFormula(FIELD, { text: 'P', password: 'x', baseVersion: 1 }, fetching(answer({ code: 'STEP_UP_LOCKED', title: 'Too many wrong passwords. Try again in 15 minutes.', status: 429 }, 429)));
    expect(locked).toMatchObject({ status: 'refused', httpStatus: 429, code: 'STEP_UP_LOCKED' });
  });

  it('answers a stale base as a refusal with the code of the 409', async () => {
    const stale = await saveFormula(FIELD, { text: 'P', password: 'x', baseVersion: 1 }, fetching(answer({ code: 'CONFIG_VERSION_CHANGED', title: 'Changed.', status: 409, currentVersion: 4 }, 409)));
    expect(stale).toMatchObject({ status: 'refused', httpStatus: 409, code: 'CONFIG_VERSION_CHANGED' });
  });

  it.each([
    ['no version', { changed: true, message: 'x' }],
    ['a changed flag that is text', { version: 2, changed: 'yes', message: 'x' }],
    ['no message', { version: 2, changed: true }],
  ])('is a failure for an answer with %s: it is not known whether the formula was saved', async (_name, body) => {
    expect(await saveFormula(FIELD, { text: 'P', password: 'x', baseVersion: 1 }, fetching(answer(body)))).toEqual({ status: 'failed' });
  });
});
