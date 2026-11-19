import { describe, expect, it, vi } from 'vitest';

import { reassignTask } from '@/lib/tasks/tasks-client';

/**
 * STORY-04.07 AC-3, AC-6: the browser's side of `PATCH /api/v1/tasks/{id}`. It sends only the fields it is given, as JSON with the browser's own origin, reads the task that comes
 * back, and gives a refusal with its code and its messages; an answer of the wrong shape is a failure and never a success. Every name and ID is invented.
 */

const ID = '00000000-0000-4000-8000-000000000001';
const ANSWER = {
  id: ID,
  code: 'Q-2026-0042',
  title: null,
  engineer: { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Meera' },
  customerName: null,
  folderPath: '\\invented-server\invented-share\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-13T06:30:00.000Z',
  status: 'DRAFT',
  assignedByName: 'Invented Boss',
};

const answering = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));

describe('sending the change', () => {
  it('PATCHes the task\'s address with the fields given as JSON, and reads the Engineer\'s name and the deadline back', async () => {
    const doFetch = answering(200, ANSWER);
    const outcome = await reassignTask(ID, { engineerId: ANSWER.engineer.id, deadlineAt: ANSWER.deadlineAt }, doFetch);
    expect(outcome).toEqual({ status: 'ok', value: { id: ID, code: 'Q-2026-0042', engineerName: 'Invented Meera', deadlineAt: '2026-11-13T06:30:00.000Z' } });
    const [path, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe(`/api/v1/tasks/${ID}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ engineerId: ANSWER.engineer.id, deadlineAt: ANSWER.deadlineAt });
  });

  it('writes an ID that needs it so that it stays one path segment', async () => {
    const doFetch = answering(200, ANSWER);
    await reassignTask('a/b?c', {}, doFetch);
    expect((doFetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/v1/tasks/a%2Fb%3Fc');
  });
});

describe('what the server refuses', () => {
  it('gives the 422 with its messages under the field they name', async () => {
    const outcome = await reassignTask(ID, { deadlineAt: 'x' }, answering(422, { code: 'VALIDATION_FAILED', title: 'Check the form', errors: [{ field: 'deadlineAt', message: 'Choose a deadline later than now.' }] }));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { deadlineAt: 'Choose a deadline later than now.' } });
  });

  it('gives the 409 of an approved task with its code, which the form compares with', async () => {
    const outcome = await reassignTask(ID, { engineerId: 'x' }, answering(409, { code: 'TASK_CLOSED', title: 'This task is approved, so its Engineer and deadline can no longer be changed.' }));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: 'TASK_CLOSED' });
  });

  it('is a failure for a server fault, for an answer of the wrong shape, and when the server cannot be reached', async () => {
    expect(await reassignTask(ID, {}, answering(503, {}))).toEqual({ status: 'failed' });
    expect(await reassignTask(ID, {}, answering(200, { id: ID }))).toEqual({ status: 'failed' });
    expect(await reassignTask(ID, {}, answering(200, { ...ANSWER, deadlineAt: 5 }))).toEqual({ status: 'failed' });
    expect(await reassignTask(ID, {}, vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ status: 'failed' });
  });
});
