import { describe, expect, it, vi } from 'vitest';

import { fetchQueuePage, readQueuePage } from '@/lib/tasks/queue-client';

/**
 * STORY-04.02 T4 (AC-1, AC-4): the browser's side of `GET /api/v1/tasks`. It asks for the tab and the cursor, reads a page, and treats an answer of the wrong shape as
 * a failure and never as an empty list. Every name is invented.
 */

const ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineer: { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun' },
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-12T11:30:00.000Z',
  status: 'DRAFT',
  assignedByName: 'Invented Boss',
};
const BODY = { tab: 'open', tasks: [ROW], counts: { open: 1, closed: 0, overdue: 0 }, nextCursor: null };

const answering = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));

describe('reading a page', () => {
  it('turns the answer into rows with the Engineer\'s name, and keeps the counts and the cursor', () => {
    expect(readQueuePage({ ...BODY, nextCursor: 'abc' })).toEqual({
      tab: 'open',
      tasks: [
        {
          id: ROW.id,
          code: ROW.code,
          title: 'Hopper cover',
          engineerName: 'Invented Arjun',
          customerName: null,
          folderPath: ROW.folderPath,
          folderUrl: ROW.folderUrl,
          deadlineAt: ROW.deadlineAt,
          status: 'DRAFT',
          assignedByName: 'Invented Boss',
        },
      ],
      counts: { open: 1, closed: 0, overdue: 0 },
      nextCursor: 'abc',
    });
  });

  it('accepts a row with no title and no link, and a page with no rows', () => {
    expect(readQueuePage({ ...BODY, tasks: [{ ...ROW, title: null, folderUrl: null, customerName: 'Invented Customer' }] })?.tasks[0]).toMatchObject({ title: null, folderUrl: null, customerName: 'Invented Customer' });
    expect(readQueuePage({ ...BODY, tasks: [] })?.tasks).toEqual([]);
  });

  it.each([
    ['not an object', 'nope'],
    ['no tasks list', { ...BODY, tasks: undefined }],
    ['a tab that is not one', { ...BODY, tab: 'all' }],
    ['counts that are not whole numbers', { ...BODY, counts: { open: 1.5, closed: 0, overdue: 0 } }],
    ['negative counts', { ...BODY, counts: { open: -1, closed: 0, overdue: 0 } }],
    ['no counts', { ...BODY, counts: null }],
    ['a cursor that is not text', { ...BODY, nextCursor: 5 }],
    ['a row with no engineer', { ...BODY, tasks: [{ ...ROW, engineer: null }] }],
    ['a row with a status it does not know', { ...BODY, tasks: [{ ...ROW, status: 'PRICED' }] }],
    ['a row with a code that is not text', { ...BODY, tasks: [{ ...ROW, code: 7 }] }],
    ['a row with a title that is not text', { ...BODY, tasks: [{ ...ROW, title: 7 }] }],
    ['a row with a customer that is not text', { ...BODY, tasks: [{ ...ROW, customerName: 7 }] }],
    ['a row with a link that is not text', { ...BODY, tasks: [{ ...ROW, folderUrl: 7 }] }],
    ['a row that is not an object', { ...BODY, tasks: ['x'] }],
  ])('treats %s as no page at all', (_name, body) => {
    expect(readQueuePage(body)).toBeNull();
  });
});

describe('asking for a page', () => {
  it('sends a GET for the tab, with the cursor when there is one, as JSON and with the session cookie', async () => {
    const doFetch = answering(200, BODY);
    await fetchQueuePage('overdue', 'a+b', doFetch);
    expect(doFetch).toHaveBeenCalledWith('/api/v1/tasks?tab=overdue&cursor=a%2Bb', expect.objectContaining({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } }));
  });

  it('answers ok with the page', async () => {
    const outcome = await fetchQueuePage('open', undefined, answering(200, BODY));
    expect(outcome.status).toBe('ok');
  });

  it('answers failed for an answer that is not a page, for a server fault and for no answer, never an empty list', async () => {
    expect((await fetchQueuePage('open', undefined, answering(200, { tasks: 'none' }))).status).toBe('failed');
    expect((await fetchQueuePage('open', undefined, answering(500, {}))).status).toBe('failed');
    expect((await fetchQueuePage('open', undefined, vi.fn(() => Promise.reject(new TypeError('offline'))))).status).toBe('failed');
  });

  it('passes a cancel signal on, and answers failed when the call is cancelled', async () => {
    const controller = new AbortController();
    const doFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (init?.signal?.aborted === true ? Promise.reject(new DOMException('cancelled', 'AbortError')) : Promise.resolve(new Response('{}'))));
    controller.abort();
    expect((await fetchQueuePage('open', undefined, doFetch, controller.signal)).status).toBe('failed');
    expect(doFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }));
  });

  it('shows a refusal with its reason', async () => {
    const outcome = await fetchQueuePage('open', undefined, answering(403, { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' }));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 403 });
  });
});
