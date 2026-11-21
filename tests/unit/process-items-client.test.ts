import { describe, expect, it, vi } from 'vitest';

import { isRecord, sendJson } from '@/lib/api-client';
import {
  createProcessItem,
  deleteProcessItem,
  formulasOf,
  listProcessItems,
  savePropagationChoices,
  toProcessItemRow,
  updateProcessItem,
} from '@/lib/masters/process-items-client';

/**
 * STORY-02.01 T4 (AC-2 to AC-4, AC-8): the browser's side of the Process master routes. It takes `fetch` as an argument, so each
 * test answers for the server. What matters: the request that is sent, the reading of a good answer, of a refusal with its field
 * messages and its formulas, and that a network fault, a server fault and an answer of the wrong shape are all "failed" and never a
 * crash. Names and numbers are invented.
 */

const ROW = { id: '00000000-0000-4000-8000-000400000011', name: 'Foam Cost', unit: 'per sq ft', defaultValue: '21.37', usedBy: [{ letter: 'AW', label: 'Foam Cost' }], customersWithOwnValue: 2 };
const CUSTOMER = '00000000-0000-4000-8000-0000000000c1';
const DIFFERING = { customerId: CUSTOMER, name: 'Marlow Agro', value: '1.50' };

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
    const doFetch = answer(200, { ...ROW, propagation: null });
    await updateProcessItem('a/b', { defaultValue: '1.37' }, doFetch);
    expect(doFetch).toHaveBeenCalledWith('/api/v1/process-items/a%2Fb', expect.objectContaining({ method: 'PATCH', body: '{"defaultValue":"1.37"}' }));
  });

  it('reads what a new default did to the customers: how many moved, the old default, and who differs (STORY-02.08 AC-1, AC-2)', async () => {
    const propagation = { previousDefault: '20.00', moved: 17, differing: [DIFFERING] };
    expect(await updateProcessItem(ROW.id, { defaultValue: '21.37' }, answer(200, { ...ROW, propagation }))).toEqual({ status: 'ok', value: { ...ROW, propagation } });
    expect(await updateProcessItem(ROW.id, { name: 'Foam' }, answer(200, { ...ROW, propagation: null }))).toEqual({ status: 'ok', value: { ...ROW, propagation: null } });
  });

  it('counts a save whose propagation is missing or malformed as failed, never as a save with nothing to ask', async () => {
    for (const propagation of [undefined, 'none', { previousDefault: 20, moved: 1, differing: [] }, { previousDefault: '20.00', moved: 1, differing: [{ customerId: CUSTOMER }] }, { previousDefault: '20.00', moved: 1 }]) {
      expect(await updateProcessItem(ROW.id, { defaultValue: '21.37' }, answer(200, { ...ROW, propagation })), JSON.stringify(propagation)).toEqual({ status: 'failed' });
    }
  });

  it('sends Save choices with POST to the rate\'s propagation address, the default they were made for and the value each customer was shown (AC-3)', async () => {
    const doFetch = answer(200, { applied: 1, kept: 2, skipped: 0 });
    const choices = [{ customerId: CUSTOMER, choice: 'apply' as const, shownValue: '1.50' }];
    expect(await savePropagationChoices('a/b', '1.52', choices, doFetch)).toEqual({ status: 'ok', value: { applied: 1, kept: 2, skipped: 0 } });
    expect(doFetch).toHaveBeenCalledWith('/api/v1/process-items/a%2Fb/propagation', expect.objectContaining({ method: 'POST', body: JSON.stringify({ newDefault: '1.52', choices }) }));
  });

  it('reads the 409 of a default that changed again as a refusal with its code, and an answer without counts as failed', async () => {
    const conflict = { type: 'about:blank', title: 'The default changed again.', status: 409, code: 'DEFAULT_CHANGED' };
    expect(await savePropagationChoices(ROW.id, '1.52', [], answer(409, conflict, 'application/problem+json'))).toMatchObject({ status: 'refused', httpStatus: 409, code: 'DEFAULT_CHANGED' });
    expect(await savePropagationChoices(ROW.id, '1.52', [], answer(200, { applied: 1 }))).toEqual({ status: 'failed' });
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
    expect(await listProcessItems(answer(200, { processItems: [{ ...ROW, customersWithOwnValue: '2' }] }))).toEqual({ status: 'failed' });
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
    for (const bad of [null, 'row', {}, { ...ROW, defaultValue: 21.37 }, { ...ROW, name: undefined }, { ...ROW, usedBy: 'AW' }, { ...ROW, usedBy: [null] }, { ...ROW, customersWithOwnValue: undefined }]) {
      expect(toProcessItemRow(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(isRecord(ROW)).toBe(true);
    expect(isRecord(null)).toBe(false);
  });
});
