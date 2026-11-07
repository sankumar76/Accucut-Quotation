import { describe, expect, it, vi } from 'vitest';

import { isRecord, sendJson } from '@/lib/api-client';
import {
  createProcessItem,
  deleteProcessItem,
  formulasOf,
  listProcessItems,
  toProcessItemRow,
  updateProcessItem,
} from '@/lib/masters/process-items-client';

/**
 * STORY-02.01 T4 (AC-2 to AC-4, AC-8): the browser's side of the Process master routes. It takes `fetch` as an argument, so each
 * test answers for the server. What matters: the request that is sent, the reading of a good answer, of a refusal with its field
 * messages and its formulas, and that a network fault, a server fault and an answer of the wrong shape are all "failed" and never a
 * crash. Names and numbers are invented.
 */

const ROW = { id: '00000000-0000-4000-8000-000400000011', name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37', usedBy: [{ letter: 'AW', label: 'Foam Cost' }] };

function answer(status: number, body: unknown, contentType = 'application/json'): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })));
}

describe('requests', () => {
  it('lists with GET and asks for JSON', async () => {
    const doFetch = answer(200, { processItems: [ROW] });
    const outcome = await listProcessItems(doFetch);
    expect(outcome).toEqual({ status: 'ok', value: [ROW] });
    expect(doFetch).toHaveBeenCalledWith('/api/v1/process-items', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('adds with POST and a JSON body', async () => {
    const doFetch = answer(201, ROW);
    const input = { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37' };
    expect(await createProcessItem(input, doFetch)).toEqual({ status: 'ok', value: ROW });
    expect(doFetch).toHaveBeenCalledWith('/api/v1/process-items', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  });

  it('changes with PATCH to the rate\'s own address, and encodes the ID', async () => {
    const doFetch = answer(200, ROW);
    await updateProcessItem('a/b', { defaultValue: '1.37' }, doFetch);
    expect(doFetch).toHaveBeenCalledWith('/api/v1/process-items/a%2Fb', expect.objectContaining({ method: 'PATCH', body: '{"defaultValue":"1.37"}' }));
  });

  it('deletes with DELETE and reads the 204', async () => {
    const doFetch = answer(204, null);
    expect(await deleteProcessItem(ROW.id, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch).toHaveBeenCalledWith(`/api/v1/process-items/${ROW.id}`, expect.objectContaining({ method: 'DELETE' }));
  });
});

describe('refusals (AC-2, AC-4)', () => {
  it('reads the message of each field of a 422, the first one for a field named twice', async () => {
    const body = {
      type: 'about:blank',
      title: 'Check the values and try again.',
      status: 422,
      code: 'VALIDATION_FAILED',
      requestId: 'req-0a0b0c0d',
      errors: [
        { field: 'name', message: 'Enter a name.' },
        { field: 'name', message: 'Use 100 characters or fewer.' },
        { field: 'defaultValue', message: 'Enter a number, 0 or more, with up to 2 decimals.' },
      ],
    };
    const outcome = await createProcessItem({ name: '', unit: 'per kg', defaultValue: 'x' }, answer(422, body, 'application/problem+json'));
    expect(outcome).toMatchObject({
      status: 'refused',
      httpStatus: 422,
      code: 'VALIDATION_FAILED',
      fields: { name: 'Enter a name.', defaultValue: 'Enter a number, 0 or more, with up to 2 decimals.' },
    });
  });

  it('reads the formulas of the 409 "cannot be deleted while a formula uses it"', async () => {
    const body = {
      status: 409,
      code: 'PROCESS_ITEM_IN_USE',
      title: 'Cutting-Rate-per-Sec cannot be deleted while a formula uses it',
      usedBy: [
        { letter: 'AL', label: 'Cutting Cost' },
        { letter: 'AM', label: 'Bending Cost' },
      ],
    };
    const outcome = await deleteProcessItem(ROW.id, answer(409, body, 'application/problem+json'));
    if (outcome.status !== 'refused') throw new Error('expected a refusal');
    expect(outcome.code).toBe('PROCESS_ITEM_IN_USE');
    expect(formulasOf(outcome)).toEqual(body.usedBy);
  });

  it('reads no formulas from a refusal that names none, or names a wrong shape', async () => {
    const plain = await deleteProcessItem(ROW.id, answer(404, { status: 404, code: 'NOT_FOUND', title: 'Rate not found.' }));
    const odd = await deleteProcessItem(ROW.id, answer(409, { status: 409, code: 'PROCESS_ITEM_IN_USE', title: 'x', usedBy: [{ letter: 1 }] }));
    for (const outcome of [plain, odd]) {
      if (outcome.status !== 'refused') throw new Error('expected a refusal');
      expect(formulasOf(outcome)).toEqual([]);
    }
  });
});

describe('failures', () => {
  it('count a network fault, a server fault, an answer that is not JSON and an answer of the wrong shape as "failed"', async () => {
    const down: typeof fetch = () => Promise.reject(new Error('offline'));
    expect(await listProcessItems(down)).toEqual({ status: 'failed' });
    expect(await listProcessItems(answer(500, { status: 500, code: 'INTERNAL_ERROR', title: 'x' }))).toEqual({ status: 'failed' });
    expect(await listProcessItems(answer(503, { status: 503, code: 'DATABASE_BUSY', title: 'x' }))).toEqual({ status: 'failed' });
    expect(await listProcessItems(answer(502, 'plain text'))).toEqual({ status: 'failed' });
    expect(await listProcessItems(answer(200, { processItems: [{ id: 1 }] }))).toEqual({ status: 'failed' });
    expect(await listProcessItems(answer(200, { rates: [] }))).toEqual({ status: 'failed' });
    expect(await createProcessItem({ name: 'x', unit: 'per kg', defaultValue: '1.00' }, answer(201, { id: 'x' }))).toEqual({ status: 'failed' });
  });

  it('send a 200 whose body cannot be read as "failed", not as a crash', async () => {
    const broken = vi.fn(() => Promise.resolve(new Response('{', { status: 200 })));
    expect(await sendJson(broken, '/x', { method: 'GET' }, (body) => (body === undefined ? null : body))).toEqual({ status: 'failed' });
  });
});

describe('reading a row', () => {
  it('accepts a good row and refuses one with a missing or mistyped field', () => {
    expect(toProcessItemRow(ROW)).toEqual(ROW);
    expect(toProcessItemRow({ ...ROW, usedBy: [] })).toEqual({ ...ROW, usedBy: [] });
    for (const bad of [null, 'row', {}, { ...ROW, defaultValue: 21.37 }, { ...ROW, name: undefined }, { ...ROW, usedBy: 'AW' }, { ...ROW, usedBy: [null] }]) {
      expect(toProcessItemRow(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(isRecord(ROW)).toBe(true);
    expect(isRecord(null)).toBe(false);
  });
});
