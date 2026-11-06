import { describe, expect, it } from 'vitest';

import { AUDIT_CURSOR_MAX_LENGTH, decodeAuditCursor, encodeAuditCursor } from '@/server/services/audit-cursor';

/** STORY-01.07 T4 (AC-6): the cursor is a place in the list that only the service makes, and anything else is refused. */

const ID = '10000000-0000-4000-8000-000000000042';
const AT = new Date('2026-11-05T09:00:00.123Z');

describe('AC-6: the audit cursor', () => {
  it('gives back the time and the ID it was made from, to the millisecond', () => {
    expect(decodeAuditCursor(encodeAuditCursor({ createdAt: AT, id: ID }))).toEqual({ createdAt: AT, id: ID });
  });

  it('is URL-safe text, short, and says nothing a reader could use beyond the place it names', () => {
    const cursor = encodeAuditCursor({ createdAt: AT, id: ID });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor.length).toBeLessThan(AUDIT_CURSOR_MAX_LENGTH);
  });

  it('reads an ID written in capitals as the lower-case ID, because the database ignores the case', () => {
    expect(decodeAuditCursor(encodeAuditCursor({ createdAt: AT, id: ID.toUpperCase() }))?.id).toBe(ID);
  });

  const forged = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

  it.each([
    ['empty', ''],
    ['not base64 of JSON', 'zzz'],
    ['JSON that is not an object', forged([1, 2])],
    ['an object with no ID', forged({ t: 1 })],
    ['an ID that is not a UUID', forged({ t: 1, i: 'abc' })],
    ['a time that is not a whole number', forged({ t: 1.5, i: ID })],
    ['a negative time', forged({ t: -1, i: ID })],
    ['a time too large for a date', forged({ t: 8.64e15 + 1, i: ID })],
    ['a field that is not named', forged({ t: 1, i: ID, extra: true })],
    ['longer than any real cursor', 'a'.repeat(AUDIT_CURSOR_MAX_LENGTH + 1)],
  ])('refuses %s', (_name, text) => {
    expect(decodeAuditCursor(text)).toBeNull();
  });
});
