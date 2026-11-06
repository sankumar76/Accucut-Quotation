import { z } from 'zod';

/**
 * The cursor of `GET /api/v1/audit` (architecture section 6, "Pagination"): where the next page begins. It is the time and the ID
 * of the last entry sent, because the list is newest first by time and then by ID, so "everything older than this" is exact even
 * when two entries have the same millisecond. The client treats it as an opaque string and sends it back unchanged; a text that
 * is not one this function made is refused, never guessed at.
 *
 * It is not a secret and not signed: it names a position in a list the Admin may read in full, and nothing it can be made to say
 * reaches a row the Admin could not already ask for.
 */

export interface AuditCursor {
  readonly createdAt: Date;
  readonly id: string;
}

/** The longest cursor accepted; a real one is about 80 characters. */
export const AUDIT_CURSOR_MAX_LENGTH = 200;

const PAYLOAD = z.strictObject({ t: z.number().int().nonnegative(), i: z.uuid() });

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.createdAt.getTime(), i: cursor.id })).toString('base64url');
}

/** The position a cursor names, or null if the text is not one `encodeAuditCursor` could have made. */
export function decodeAuditCursor(text: string): AuditCursor | null {
  if (text.length === 0 || text.length > AUDIT_CURSOR_MAX_LENGTH) return null;
  try {
    const parsed = PAYLOAD.safeParse(JSON.parse(Buffer.from(text, 'base64url').toString('utf8')));
    if (!parsed.success) return null;
    const createdAt = new Date(parsed.data.t);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: parsed.data.i.toLowerCase() };
  } catch {
    return null;
  }
}
