import { describe, expect, it } from 'vitest';

import { AUDIT_DEFAULT_LIMIT, AUDIT_MAX_LIMIT } from '@/lib/audit/categories';
import { encodeAuditCursor } from '@/server/services/audit-cursor';
import { auditPageSchema, auditQuerySchema } from '@/server/views/schemas/audit';

import { defined } from '../support/defined';

/**
 * STORY-01.07 T4 (AC-6): the contract of `GET /api/v1/audit`. The query is strict (a name that is not a filter is an error), the
 * limit is 50 unless asked and never over 200, the dates are real calendar dates and in order, and the cursor must be one the
 * service made. The answer is strict too: a field that is not named cannot leave (NFR-002). Every value is invented.
 */

const WHO = '00000000-0000-4000-8000-abcdef000001';
const CURSOR = encodeAuditCursor({ createdAt: new Date('2026-11-05T09:00:00.000Z'), id: '10000000-0000-4000-8000-000000000007' });

function issuesOf(query: unknown): string[] {
  const parsed = auditQuerySchema.safeParse(query);
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('AC-6: the query', () => {
  it('accepts no filter at all and gives the default limit of 50', () => {
    expect(auditQuerySchema.parse({})).toEqual({ limit: AUDIT_DEFAULT_LIMIT });
    expect(AUDIT_DEFAULT_LIMIT).toBe(50);
  });

  it('accepts every filter together and turns the limit and the cursor into their values', () => {
    const parsed = auditQuerySchema.parse({
      who: WHO.toUpperCase(),
      category: 'user_change',
      event: 'user.created',
      from: '2026-11-01',
      to: '2026-11-06',
      limit: '25',
      cursor: CURSOR,
    });
    expect(parsed).toMatchObject({ who: WHO, category: 'user_change', event: 'user.created', from: '2026-11-01', to: '2026-11-06', limit: 25 });
    expect(parsed.cursor).toEqual({ createdAt: new Date('2026-11-05T09:00:00.000Z'), id: '10000000-0000-4000-8000-000000000007' });
  });

  it('keeps the limit between 1 and 200', () => {
    expect(auditQuerySchema.parse({ limit: String(AUDIT_MAX_LIMIT) }).limit).toBe(200);
    expect(AUDIT_MAX_LIMIT).toBe(200);
    for (const limit of ['0', '201', '-1', '1.5', 'abc', '']) expect(issuesOf({ limit }), limit).not.toEqual([]);
  });

  it('refuses a name that is not a filter, so a mistyped filter is not ignored', () => {
    expect(issuesOf({ whoo: WHO })).not.toEqual([]);
    expect(issuesOf({ sort: 'asc' })).not.toEqual([]);
  });

  it('refuses a person that is not an ID, a category or an event that does not exist, and an empty value', () => {
    expect(issuesOf({ who: 'Divya' })).toEqual(expect.arrayContaining([expect.stringContaining('who')]));
    expect(issuesOf({ category: 'configuration' })).toEqual(expect.arrayContaining([expect.stringContaining('category')]));
    expect(issuesOf({ event: 'user.exploded' })).toEqual(expect.arrayContaining([expect.stringContaining('event')]));
    expect(issuesOf({ who: '' })).not.toEqual([]);
  });

  it('accepts a registered event that no story raises yet, because the registry already declares it', () => {
    expect(auditQuerySchema.parse({ event: 'approval.cancelled' }).event).toBe('approval.cancelled');
  });

  it('accepts real dates only, and not 30 February, a time, or another order of the parts', () => {
    expect(issuesOf({ from: '2026-02-28', to: '2026-03-01' })).toEqual([]);
    for (const date of ['2026-02-30', '2026-13-01', '06-11-2026', '2026-11-06T10:00:00Z', '2026-1-6', 'today']) {
      expect(issuesOf({ from: date }), date).not.toEqual([]);
    }
  });

  it('refuses a From that is after the To, on the To field, in words', () => {
    expect(issuesOf({ from: '2026-11-07', to: '2026-11-06' })).toEqual(['to: The To date must be on or after the From date.']);
    expect(issuesOf({ from: '2026-11-06', to: '2026-11-06' })).toEqual([]);
  });

  it('refuses a cursor the service did not make', () => {
    for (const cursor of ['not-a-cursor', '', 'e30', Buffer.from('{"t":1,"i":"x"}').toString('base64url'), 'a'.repeat(500)]) {
      expect(issuesOf({ cursor }), cursor).not.toEqual([]);
    }
  });
});

describe('AC-6: the answer', () => {
  const entry = {
    id: '10000000-0000-4000-8000-000000000001',
    createdAt: '2026-11-05T09:00:00.000Z',
    who: 'Invented Admin',
    event: 'user.created',
    category: { id: 'user_change', label: 'User change' },
    objectLabel: 'Invented Person',
    change: { before: 'Not added', after: 'Added as Engineer' },
  };

  it('accepts a page and refuses a field that is not named, in the page and in an entry', () => {
    const page = { entries: [entry], total: 1, nextCursor: null };
    expect(auditPageSchema.parse(page)).toEqual(page);
    expect(auditPageSchema.safeParse({ ...page, extra: true }).success).toBe(false);
    expect(auditPageSchema.safeParse({ ...page, entries: [{ ...entry, before: { role: 'ADMIN' } }] }).success).toBe(false);
  });

  it('allows an entry of an event this release does not know: no category, and its name as it was stored', () => {
    const unknown = { ...entry, event: 'later.event', category: null };
    expect(defined(auditPageSchema.parse({ entries: [unknown], total: 1, nextCursor: 'abc' }).entries[0]).category).toBeNull();
  });

  it('refuses a total that is not a whole number of zero or more', () => {
    for (const total of [-1, 1.5, '3']) expect(auditPageSchema.safeParse({ entries: [], total, nextCursor: null }).success).toBe(false);
  });
});
