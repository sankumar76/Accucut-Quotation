import { z } from 'zod';

/**
 * The cursor of `GET /api/v1/tasks` (architecture section 6, "Pagination"): where the next page of a tab begins. The queue is sorted by deadline and then by
 * code (STORY-04.02 AC-1), so the cursor is the deadline and the code of the last task sent, and "everything after this" is exact even when two tasks have
 * the same deadline. The client treats it as an opaque string and sends it back unchanged; a text that is not one this function made is refused, never guessed at.
 *
 * It is not a secret and not signed: it names a position in a list the caller may read in the same order anyway, and the page that follows is still cut to
 * what the caller may see (an Engineer's own tasks), so no text can make it reach a task the caller could not already ask for.
 */

export interface TaskQueueCursor {
  readonly deadlineAt: Date;
  readonly code: string;
}

/** The longest cursor accepted; a real one is about 70 characters. */
export const TASK_QUEUE_CURSOR_MAX_LENGTH = 200;

const PAYLOAD = z.strictObject({ t: z.number().int().nonnegative(), c: z.string().regex(/^Q-\d{4}-\d{4,}$/) });

export function encodeTaskQueueCursor(cursor: TaskQueueCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.deadlineAt.getTime(), c: cursor.code })).toString('base64url');
}

/** The position a cursor names, or null if the text is not one `encodeTaskQueueCursor` could have made. */
export function decodeTaskQueueCursor(text: string): TaskQueueCursor | null {
  if (text.length === 0 || text.length > TASK_QUEUE_CURSOR_MAX_LENGTH) return null;
  try {
    const parsed = PAYLOAD.safeParse(JSON.parse(Buffer.from(text, 'base64url').toString('utf8')));
    if (!parsed.success) return null;
    const deadlineAt = new Date(parsed.data.t);
    return Number.isNaN(deadlineAt.getTime()) ? null : { deadlineAt, code: parsed.data.c };
  } catch {
    return null;
  }
}
