import { describe, expect, it, vi } from 'vitest';

import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { blockedPartsFrom, calculateEstimate } from '@/lib/estimates/calculate-client';

/**
 * STORY-05.09 (AC-1, AC-2, AC-7): the browser's call to Calculate and the reading of its two answers: the good one (a status and a sentence) and the 422 that lists parts and fields. `fetch` is
 * replaced, so the test answers for the server. An answer of the wrong shape is a failure, never a list or a message that might be wrong. Every name and ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PART = '00000000-0000-4000-8000-0000000000b1';
const FIELD = '00000000-0000-4000-8000-000100000010';

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

const blocked = (parts: unknown): Response => answer({ type: 'about:blank', title: 'Nothing was submitted. 1 part has missing inputs.', status: 422, code: 'CALCULATE_BLOCKED', requestId: 'req-00000000', parts }, 422);

describe('calculateEstimate (AC-2)', () => {
  it('sends POST /api/v1/estimates/{id}/calculate with no body and reads the status and the sentence', async () => {
    const doFetch = fetching(answer({ status: 'SUBMITTED', message: CALCULATE_MESSAGE }));
    expect(await calculateEstimate(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: { status: 'SUBMITTED', message: CALCULATE_MESSAGE } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/calculate`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ status: 'SUBMITTED', message: CALCULATE_MESSAGE }));
    await calculateEstimate('a/b c', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/calculate');
  });

  it.each([
    ['another status', answer({ status: 'DRAFT', message: CALCULATE_MESSAGE })],
    ['no message', answer({ status: 'SUBMITTED' })],
    ['an empty message', answer({ status: 'SUBMITTED', message: '' })],
    ['a message that is not text', answer({ status: 'SUBMITTED', message: 12 })],
    ['a body that is not an object', answer('SUBMITTED')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s', async (_name, response) => {
    expect(await calculateEstimate(ESTIMATE, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await calculateEstimate(ESTIMATE, fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await calculateEstimate(ESTIMATE, fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });

  it('a refusal keeps the server\'s code and words', async () => {
    const outcome = await calculateEstimate(ESTIMATE, fetching(answer({ code: 'CUSTOMER_NOT_CHOSEN', title: 'Choose the customer before calculating.', status: 409 }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: 'CUSTOMER_NOT_CHOSEN', title: 'Choose the customer before calculating.' });
  });
});

describe('blockedPartsFrom (AC-1)', () => {
  async function refusal(response: Response) {
    const outcome = await calculateEstimate(ESTIMATE, fetching(response));
    if (outcome.status !== 'refused') throw new Error('The test expected a refusal.');
    return outcome;
  }

  it('reads each part with its Sl. No, name and fields', async () => {
    const parts = [{ nodeId: PART, slNo: '1.2', name: 'Invented lid', fields: [{ fieldId: FIELD, label: 'Length' }] }];
    expect(blockedPartsFrom(await refusal(blocked(parts)))).toEqual(parts);
  });

  it('a part with no name keeps it as null', async () => {
    const parts = [{ nodeId: PART, slNo: '1', name: null, fields: [{ fieldId: FIELD, label: 'Length' }] }];
    expect(blockedPartsFrom(await refusal(blocked(parts)))).toEqual(parts);
  });

  it('is null for any other refusal, so the screen shows the server\'s sentence and no list', async () => {
    expect(blockedPartsFrom(await refusal(answer({ code: 'NO_PARTS', title: 'Add at least one part before calculating.', status: 409 }, 409)))).toBeNull();
  });

  it.each([
    ['no parts member', undefined],
    ['parts that are not a list', 'x'],
    ['a part without an ID', [{ slNo: '1', name: null, fields: [{ fieldId: FIELD, label: 'Length' }] }]],
    ['a part whose name is a number', [{ nodeId: PART, slNo: '1', name: 5, fields: [{ fieldId: FIELD, label: 'Length' }] }]],
    ['a part without fields as a list', [{ nodeId: PART, slNo: '1', name: null, fields: 'Length' }]],
    ['a field without a label', [{ nodeId: PART, slNo: '1', name: null, fields: [{ fieldId: FIELD }] }]],
    ['an entry that is not an object', ['1']],
  ])('is null for %s: a list that might be wrong is never shown', async (_name, parts) => {
    const body = { type: 'about:blank', title: 'Nothing was submitted.', status: 422, code: 'CALCULATE_BLOCKED', requestId: 'req-00000000', ...(parts === undefined ? {} : { parts }) };
    expect(blockedPartsFrom(await refusal(answer(body, 422)))).toBeNull();
  });

  it('a part listed with no field is dropped: there is nothing to link to', async () => {
    const parts = [
      { nodeId: PART, slNo: '1', name: null, fields: [] },
      { nodeId: '00000000-0000-4000-8000-0000000000b2', slNo: '2', name: null, fields: [{ fieldId: FIELD, label: 'Width' }] },
    ];
    expect(blockedPartsFrom(await refusal(blocked(parts)))?.map((part) => part.slNo)).toEqual(['2']);
  });
});
