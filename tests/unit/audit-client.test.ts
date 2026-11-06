import { describe, expect, it } from 'vitest';

import { fetchAuditPage, type AuditPageData } from '@/lib/audit/audit-client';
import { auditQueryString, hasActiveFilter, NO_FILTERS, RANGE_ORDER_MESSAGE, rangeProblem } from '@/lib/audit/filters';

import { defined } from '../support/defined';

/**
 * STORY-01.07 T5 (AC-6, AC-8): the browser's side of `GET /api/v1/audit`: the query string a choice of filters makes, the reading
 * of the answer, and what a failure of any kind turns into. It takes `fetch` as an argument so a test can answer for the server.
 * Every name is invented.
 */

const ENTRY = {
  id: '10000000-0000-4000-8000-000000000001',
  createdAt: '2026-11-05T09:00:00.000Z',
  who: 'Invented Admin',
  event: 'user.created',
  category: { id: 'user_change', label: 'User change' },
  objectLabel: 'Invented Person',
  change: { before: 'Not added', after: 'Added as Engineer' },
};
const PAGE: AuditPageData = { entries: [ENTRY], total: 1, nextCursor: null };

function answering(status: number, body: unknown): { readonly doFetch: typeof fetch; readonly calls: string[] } {
  const calls: string[] = [];
  const doFetch: typeof fetch = (input) => {
    calls.push(String(input));
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  };
  return { doFetch, calls };
}

describe('AC-6: the query string of a choice of filters', () => {
  it('is empty for no filter, so the server gives its default page', () => {
    expect(auditQueryString(NO_FILTERS)).toBe('');
    expect(hasActiveFilter(NO_FILTERS)).toBe(false);
  });

  it('names each filter that has a value, and leaves the others out', () => {
    expect(auditQueryString({ who: 'abc', category: 'user_change', from: '2026-11-01', to: '' })).toBe('who=abc&category=user_change&from=2026-11-01');
    expect(auditQueryString({ ...NO_FILTERS, to: '2026-11-06' })).toBe('to=2026-11-06');
  });

  it('adds the cursor of a later page, and encodes it', () => {
    expect(auditQueryString(NO_FILTERS, 'a-b_c')).toBe('cursor=a-b_c');
    expect(auditQueryString(NO_FILTERS, 'a b&c')).toBe('cursor=a+b%26c');
  });

  it('knows when a filter is on', () => {
    for (const change of [{ who: 'x' }, { category: 'x' }, { from: '2026-11-01' }, { to: '2026-11-01' }]) expect(hasActiveFilter({ ...NO_FILTERS, ...change })).toBe(true);
  });

  it('names a range that ends before it begins, and only that', () => {
    expect(rangeProblem({ from: '2026-11-07', to: '2026-11-06' })).toBe(RANGE_ORDER_MESSAGE);
    expect(rangeProblem({ from: '2026-11-06', to: '2026-11-06' })).toBeNull();
    expect(rangeProblem({ from: '', to: '2026-11-06' })).toBeNull();
    expect(rangeProblem({ from: '2026-11-06', to: '' })).toBeNull();
    expect(rangeProblem(NO_FILTERS)).toBeNull();
  });
});

describe('AC-6 and AC-8: fetchAuditPage', () => {
  it('asks /api/v1/audit with the query, from the same origin, and reads the page', async () => {
    const { doFetch, calls } = answering(200, PAGE);
    const outcome = await fetchAuditPage({ ...NO_FILTERS, category: 'user_change' }, undefined, doFetch);
    expect(calls).toEqual(['/api/v1/audit?category=user_change']);
    expect(outcome).toEqual({ status: 'ok', value: PAGE });
  });

  it('asks for the later page with its cursor', async () => {
    const { doFetch, calls } = answering(200, { ...PAGE, nextCursor: 'next' });
    const outcome = await fetchAuditPage(NO_FILTERS, 'abc', doFetch);
    expect(calls).toEqual(['/api/v1/audit?cursor=abc']);
    expect(outcome).toMatchObject({ status: 'ok', value: { nextCursor: 'next' } });
  });

  it('reads an entry of an event it does not know: no category', async () => {
    const { doFetch } = answering(200, { entries: [{ ...ENTRY, category: null, event: 'later.event' }], total: 1, nextCursor: null });
    const outcome = await fetchAuditPage(NO_FILTERS, undefined, doFetch);
    expect(outcome.status === 'ok' && defined(outcome.value.entries[0]).category).toBeNull();
  });

  it.each([
    ['a refusal of the role', 403, { code: 'FORBIDDEN' }],
    ['a signed-out answer', 401, { code: 'UNAUTHORIZED' }],
    ['a validation problem', 422, { code: 'VALIDATION_FAILED' }],
    ['a server fault', 500, { code: 'INTERNAL_ERROR' }],
    ['a busy database', 503, { code: 'DATABASE_BUSY' }],
  ])('turns %s into a failure the screen can say in words', async (_name, status, body) => {
    const { doFetch } = answering(status, body);
    expect(await fetchAuditPage(NO_FILTERS, undefined, doFetch)).toEqual({ status: 'failed' });
  });

  it.each([
    ['an answer that is not JSON', '{not json'],
    ['an answer of the wrong kind', []],
    ['a page with no total', { entries: [], nextCursor: null }],
    ['a total that is not a number', { entries: [], total: '3', nextCursor: null }],
    ['a total that is negative', { entries: [], total: -1, nextCursor: null }],
    ['entries that are not a list', { entries: {}, total: 0, nextCursor: null }],
    ['an entry with no words for the change', { entries: [{ ...ENTRY, change: null }], total: 1, nextCursor: null }],
    ['an entry whose time is not a text', { entries: [{ ...ENTRY, createdAt: 5 }], total: 1, nextCursor: null }],
    ['a category that is not an object', { entries: [{ ...ENTRY, category: 'user_change' }], total: 1, nextCursor: null }],
    ['a cursor that is not text', { entries: [], total: 0, nextCursor: 7 }],
  ])('treats %s, though it came with status 200, as a failure and not as an empty list', async (_name, body) => {
    const { doFetch } = answering(200, body);
    expect(await fetchAuditPage(NO_FILTERS, undefined, doFetch)).toEqual({ status: 'failed' });
  });

  it('turns a network error into a failure', async () => {
    const doFetch: typeof fetch = () => Promise.reject(new TypeError('network down'));
    expect(await fetchAuditPage(NO_FILTERS, undefined, doFetch)).toEqual({ status: 'failed' });
  });

  it('gives up quietly when the request was cancelled, and says so, so a newer request is not undone by an older one', async () => {
    const controller = new AbortController();
    const doFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    const pending = fetchAuditPage(NO_FILTERS, undefined, doFetch, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
  });
});
