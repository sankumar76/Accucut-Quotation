import { describe, expect, it, vi } from 'vitest';

import { deleteConfigField, listFieldReferences, usesOfRefusal } from '@/lib/config/delete-field-client';

/**
 * STORY-08.04 AC-2, AC-3, AC-4: the browser's two calls of the delete dialog. `fetch` is replaced, so the test answers for the server. A good answer is read field by field into what the dialog shows; a refusal
 * arrives with its code, the server's sentence and (for 409 `FIELD_IN_USE`) the uses; an answer of the wrong shape is a failure and never a success that might be wrong; the password goes in the body of the one
 * request and nowhere else. Every name, ID and password is invented.
 */

const FIELD = '00000000-0000-4000-8000-0000000000f1';
const FORMULA_USE = { kind: 'formula', fieldId: '00000000-0000-4000-8000-0000000000f2', letter: 'AY', label: 'Total Process Cost', formula: 'AL + AM' };
const HIDE_USE = { kind: 'hide-when-zero', fieldId: '00000000-0000-4000-8000-0000000000f3', letter: 'AM', label: 'Bending Cost' };
const VISIBLE_USE = { kind: 'visibility-rule', fieldId: '00000000-0000-4000-8000-0000000000f4', letter: 'AP', label: 'Notch Count' };
const TOTAL_USE = { kind: 'stage-total', stageId: '00000000-0000-4000-8000-0000000000f5', number: 3, name: 'Process Costs' };
const REFERENCES = { fieldId: FIELD, letter: 'AL', label: 'Cutting Cost', uses: [FORMULA_USE, HIDE_USE, VISIBLE_USE, TOTAL_USE] };

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('listFieldReferences', () => {
  it('sends GET /api/v1/config/fields/{id}/references and reads the field and every kind of use', async () => {
    const doFetch = fetching(answer(REFERENCES));
    const outcome = await listFieldReferences(FIELD, doFetch);
    expect(outcome).toEqual({ status: 'ok', value: REFERENCES });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/config/fields/${FIELD}/references`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('reads an empty list of uses (the field can be deleted)', async () => {
    expect(await listFieldReferences(FIELD, fetching(answer({ ...REFERENCES, uses: [] })))).toMatchObject({ status: 'ok', value: { uses: [] } });
  });

  it('encodes the ID in the path', async () => {
    const doFetch = fetching(answer(REFERENCES));
    await listFieldReferences('a/b c', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/config/fields/a%2Fb%20c/references');
  });

  it.each([
    ['a body that is not an object', 'nope'],
    ['no letter', { ...REFERENCES, letter: undefined }],
    ['uses that is not a list', { ...REFERENCES, uses: 'x' }],
    ['a use of a kind that does not exist', { ...REFERENCES, uses: [{ ...HIDE_USE, kind: 'other' }] }],
    ['a formula use with no formula', { ...REFERENCES, uses: [{ ...FORMULA_USE, formula: undefined }] }],
    ['a stage total with no number', { ...REFERENCES, uses: [{ ...TOTAL_USE, number: 'three' }] }],
  ])('treats %s as a failure and never as a success', async (_what, body) => {
    expect(await listFieldReferences(FIELD, fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('answers a refusal with its code and the server\'s sentence, and a lost connection as a failure', async () => {
    const problem = { code: 'SYSTEM_FIELD', title: 'This is a System field. The portal depends on it, so it cannot be deleted.', status: 409 };
    expect(await listFieldReferences(FIELD, fetching(answer(problem, 409)))).toMatchObject({ status: 'refused', httpStatus: 409, code: 'SYSTEM_FIELD' });
    expect(await listFieldReferences(FIELD, fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });
});

describe('deleteConfigField', () => {
  it('sends DELETE with the password in the body and nowhere else, and reads the version and the sentence', async () => {
    const doFetch = fetching(answer({ version: 11, message: 'Field deleted. Configuration version 11.' }));
    const outcome = await deleteConfigField(FIELD, 'Invented-password-1', doFetch);
    expect(outcome).toEqual({ status: 'ok', value: { version: 11, message: 'Field deleted. Configuration version 11.' } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/config/fields/${FIELD}`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'same-origin' });
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ password: 'Invented-password-1' });
    expect(String(doFetch.mock.calls[0]?.[0])).not.toContain('Invented-password-1');
  });

  it.each([
    ['no version', { message: 'Field deleted.' }],
    ['a version that is not a number', { version: '11', message: 'Field deleted.' }],
    ['no sentence', { version: 11 }],
  ])('treats an answer with %s as a failure', async (_what, body) => {
    expect(await deleteConfigField(FIELD, 'x', fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('answers a wrong password as a refusal with the code the dialog compares with, a block as 429, and keeps the password out of every answer', async () => {
    const wrong = await deleteConfigField(FIELD, 'Invented-wrong-1', fetching(answer({ code: 'STEP_UP_FAILED', title: 'That password is not correct.', status: 422 }, 422)));
    expect(wrong).toMatchObject({ status: 'refused', httpStatus: 422, code: 'STEP_UP_FAILED' });
    expect(JSON.stringify(wrong)).not.toContain('Invented-wrong-1');
    const locked = await deleteConfigField(FIELD, 'x', fetching(answer({ code: 'STEP_UP_LOCKED', title: 'Too many wrong passwords. Try again in 15 minutes.', status: 429 }, 429)));
    expect(locked).toMatchObject({ status: 'refused', httpStatus: 429, code: 'STEP_UP_LOCKED' });
  });

  it('reads the uses of a 409 FIELD_IN_USE out of the refusal, and reads nothing from a refusal that has none', async () => {
    const blocked = await deleteConfigField(FIELD, 'x', fetching(answer({ code: 'FIELD_IN_USE', title: 'Cannot delete AL Cutting Cost yet. 1 formula uses this field.', status: 409, uses: [FORMULA_USE] }, 409)));
    expect(blocked.status === 'refused' && usesOfRefusal(blocked)).toEqual([FORMULA_USE]);
    const other = await deleteConfigField(FIELD, 'x', fetching(answer({ code: 'CONFIG_VERSION_CHANGED', title: 'Changed.', status: 409, currentVersion: 12 }, 409)));
    expect(other.status === 'refused' && usesOfRefusal(other)).toBeNull();
    const broken = await deleteConfigField(FIELD, 'x', fetching(answer({ code: 'FIELD_IN_USE', title: 'Blocked.', status: 409, uses: [{ kind: 'formula' }] }, 409)));
    expect(broken.status === 'refused' && usesOfRefusal(broken)).toBeNull();
  });

  it('answers a server fault and a lost connection as a failure, which the dialog words as "it may have gone through"', async () => {
    expect(await deleteConfigField(FIELD, 'x', fetching(answer({ code: 'INTERNAL_ERROR', title: 'x', status: 500 }, 500)))).toEqual({ status: 'failed' });
    expect(await deleteConfigField(FIELD, 'x', fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });
});
