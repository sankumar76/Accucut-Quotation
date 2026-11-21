import { describe, expect, it } from 'vitest';

import type { RoleName } from '@/lib/auth/roles';
import {
  DATE_ORDER_MESSAGE,
  dateRangeProblem,
  hasListFilter,
  NO_QUEUE_FILTERS,
  queueAddressQuery,
  queueQueryString,
  readQueueAddress,
  withoutListFilters,
  type QueueAddressContext,
} from '@/lib/tasks/queue-filters';

/**
 * STORY-04.06 T1 (AC-1, AC-2, AC-4, AC-5, AC-6): the address parser and writer, with no server. The one copy the page, the screen and the route's query string share: a
 * malformed, stale or not-for-this-role value gives the default view and never an error, the Lead's default is `me`, and what the screen writes the page reads back the same.
 * Every name and ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000e1';
const ACME = '00000000-0000-4000-8000-0000000000c1';
const OPTIONS = { engineerIds: new Set([ARJUN]), customerIds: new Set([ACME]) };
const as = (role: RoleName): QueueAddressContext => ({ role, ...OPTIONS });
const FULL = { tab: 'overdue', assignedBy: 'anyone', q: 'hopper', engineer: ARJUN, customer: ACME, from: '2026-11-01', to: '2026-11-30' };

describe('AC-1, AC-2: what an address that does not say assignedBy means for each role', () => {
  it('opens a Lead on the tasks they assigned, and an Admin and an Engineer on no cut', () => {
    expect(readQueueAddress({}, as('LEAD')).filters.assignedBy).toBe('me');
    expect(readQueueAddress({}, as('ADMIN')).filters.assignedBy).toBe('');
    expect(readQueueAddress({}, as('ENGINEER')).filters.assignedBy).toBe('');
  });

  it('keeps a Lead\'s "anyone" (the chip removed) and the bell\'s "me", and gives an Admin only the "me" a bell address brings', () => {
    expect(readQueueAddress({ assignedBy: 'anyone' }, as('LEAD')).filters.assignedBy).toBe('anyone');
    expect(readQueueAddress({ tab: 'overdue', assignedBy: 'me' }, as('LEAD'))).toMatchObject({ tab: 'overdue', filters: { assignedBy: 'me' } });
    expect(readQueueAddress({ assignedBy: 'me' }, as('ADMIN')).filters.assignedBy).toBe('me');
    expect(readQueueAddress({ assignedBy: 'anyone' }, as('ADMIN')).filters.assignedBy).toBe('');
  });

  it('reads a value it does not know, or one given twice, as not said', () => {
    expect(readQueueAddress({ assignedBy: 'someone' }, as('LEAD')).filters.assignedBy).toBe('me');
    expect(readQueueAddress({ assignedBy: ['anyone', 'me'] }, as('LEAD')).filters.assignedBy).toBe('me');
  });
});

describe('AC-4: a stale or malformed value in a page address gives the default view, never an error', () => {
  it('reads every filter of a good address for a Lead', () => {
    expect(readQueueAddress(FULL, as('LEAD'))).toEqual({
      tab: 'overdue',
      filters: { q: 'hopper', engineer: ARJUN, customer: ACME, from: '2026-11-01', to: '2026-11-30', assignedBy: 'anyone' },
    });
  });

  it.each<[string, Record<string, string | string[]>, Record<string, string>]>([
    ['a tab that is not one', { tab: 'all' }, { tab: 'open' }],
    ['an Engineer that is not offered any more', { engineer: '00000000-0000-4000-8000-0000000000e9' }, { engineer: '' }],
    ['an Engineer that is not an ID', { engineer: 'arjun' }, { engineer: '' }],
    ['a customer that is not offered', { customer: '00000000-0000-4000-8000-0000000000c9' }, { customer: '' }],
    ['a start date that is not a date', { from: '31/10/2026' }, { from: '' }],
    ['an end date that is not a real day', { to: '2026-02-30' }, { to: '' }],
    ['a search of 121 characters', { q: 'x'.repeat(121) }, { q: '' }],
    ['a search that is only spaces', { q: '   ' }, { q: '' }],
    ['a name given twice', { q: ['a', 'b'] }, { q: '' }],
  ])('leaves out %s', (_name, params, expected) => {
    const read = readQueueAddress(params, as('LEAD'));
    expect({ tab: read.tab, ...read.filters }).toMatchObject(expected);
  });

  it('trims the search and accepts exactly 120 characters', () => {
    expect(readQueueAddress({ q: '  Hopper  ' }, as('ENGINEER')).filters.q).toBe('Hopper');
    expect(readQueueAddress({ q: 'x'.repeat(120) }, as('LEAD')).filters.q).toHaveLength(120);
  });

  it('leaves out both dates when the range ends before it begins', () => {
    const read = readQueueAddress({ from: '2026-11-20', to: '2026-11-10' }, as('LEAD'));
    expect(read.filters).toMatchObject({ from: '', to: '' });
    expect(readQueueAddress({ from: '2026-11-10', to: '2026-11-10' }, as('LEAD')).filters).toMatchObject({ from: '2026-11-10', to: '2026-11-10' });
  });
});

describe('AC-5: an Engineer keeps the search and nothing else', () => {
  it('drops Engineer, customer, dates and assignedBy from an Engineer\'s address', () => {
    expect(readQueueAddress(FULL, as('ENGINEER'))).toEqual({ tab: 'overdue', filters: { ...NO_QUEUE_FILTERS, q: 'hopper' } });
  });
});

describe('AC-4: the address the screen writes is the one the page reads', () => {
  it('writes the tab (not while it is Open) and only the filters that are set, in a fixed order', () => {
    expect(queueAddressQuery('open', NO_QUEUE_FILTERS)).toBe('');
    expect(queueAddressQuery('closed', NO_QUEUE_FILTERS)).toBe('tab=closed');
    expect(queueAddressQuery('overdue', { ...NO_QUEUE_FILTERS, assignedBy: 'me' })).toBe('tab=overdue&assignedBy=me');
    expect(queueAddressQuery('open', { q: 'a b&c', engineer: ARJUN, customer: ACME, from: '2026-11-01', to: '2026-11-30', assignedBy: 'anyone' })).toBe(
      `assignedBy=anyone&q=a+b%26c&engineer=${ARJUN}&customer=${ACME}&from=2026-11-01&to=2026-11-30`,
    );
  });

  it('is read back the same for a Lead, whatever the text typed (spaces, ampersand, percent, non-ASCII)', () => {
    const filters = { q: 'Rev 100% & "x" _y', engineer: ARJUN, customer: ACME, from: '2026-11-01', to: '2026-11-30', assignedBy: 'anyone' as const };
    const params = Object.fromEntries(new URLSearchParams(queueAddressQuery('closed', filters)));
    expect(readQueueAddress(params, as('LEAD'))).toEqual({ tab: 'closed', filters });
  });

  it('sends the route the same names, with the tab always and the cursor last', () => {
    expect(queueQueryString('open')).toBe('tab=open');
    expect(queueQueryString('overdue', undefined, { ...NO_QUEUE_FILTERS, assignedBy: 'me' })).toBe('tab=overdue&assignedBy=me');
    expect(queueQueryString('open', 'abc', { ...NO_QUEUE_FILTERS, q: 'x', from: '2026-11-01' })).toBe('tab=open&q=x&from=2026-11-01&cursor=abc');
  });
});

describe('AC-3, AC-6: the range message, and what Clear filters empties', () => {
  it('says "The start date is after the end date." only for a range that ends before it begins', () => {
    expect(dateRangeProblem({ from: '2026-11-20', to: '2026-11-10' })).toBe(DATE_ORDER_MESSAGE);
    expect(DATE_ORDER_MESSAGE).toBe('The start date is after the end date.');
    for (const range of [{ from: '2026-11-10', to: '2026-11-10' }, { from: '', to: '2026-11-10' }, { from: '2026-11-20', to: '' }]) expect(dateRangeProblem(range)).toBeNull();
  });

  it('clears the search, Engineer, Customer, From and To, and keeps the chip as it is', () => {
    const filters = { q: 'x', engineer: ARJUN, customer: ACME, from: '2026-11-01', to: '2026-11-30', assignedBy: 'me' as const };
    expect(hasListFilter(filters)).toBe(true);
    expect(withoutListFilters(filters)).toEqual({ ...NO_QUEUE_FILTERS, assignedBy: 'me' });
    expect(hasListFilter(withoutListFilters(filters))).toBe(false);
    expect(hasListFilter({ ...NO_QUEUE_FILTERS, assignedBy: 'me' })).toBe(false);
  });
});
