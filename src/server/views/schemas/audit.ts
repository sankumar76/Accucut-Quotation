import { z } from 'zod';

import { AUDIT_DEFAULT_LIMIT, AUDIT_MAX_LIMIT, isAuditCategoryId } from '../../../lib/audit/categories';
import { RANGE_ORDER_MESSAGE } from '../../../lib/audit/filters';
import { isIsoDate } from '../../../lib/time';
import { AUDIT_CURSOR_MAX_LENGTH, decodeAuditCursor } from '../../services/audit-cursor';
import { isAuditEventName } from '../../services/audit-events';

/**
 * The contract of `GET /api/v1/audit` (STORY-01.07 AC-6; architecture section 6, "Audit" and "Pagination"). The query is a strict
 * object, so a name that is not a filter is an error and not silently ignored, and the answer is strict too: a field the schema
 * does not name cannot leave (NFR-002). The answer carries the words of "Before to after", not the stored JSON, which is
 * Restricted and stays on the server.
 *
 * The messages are the ones the API returns under the field they name; the screen checks the same two rules before it asks
 * (a real date, From not after To) and shows its own words for them (`src/components/features/audit/texts.ts`).
 */

const DATE_MESSAGE = 'Enter a date like 2026-11-06.';
const CURSOR_MESSAGE = 'This is not a place in the list. Start again from the first page.';

const date = z.string({ error: DATE_MESSAGE }).refine(isIsoDate, DATE_MESSAGE);

/** Query strings arrive as text: the limit is turned into a whole number, and the cursor into the place it names. */
export const auditQuerySchema = z
  .strictObject({
    who: z
      .uuid('Not a person ID.')
      .transform((id) => id.toLowerCase())
      .optional(),
    category: z.string().refine(isAuditCategoryId, 'Not an event category.').optional(),
    event: z.string().refine(isAuditEventName, 'Not an audit event.').optional(),
    from: date.optional(),
    to: date.optional(),
    limit: z.coerce
      .number({ error: `The limit must be a whole number from 1 to ${AUDIT_MAX_LIMIT}.` })
      .int(`The limit must be a whole number from 1 to ${AUDIT_MAX_LIMIT}.`)
      .min(1, `The limit must be at least 1.`)
      .max(AUDIT_MAX_LIMIT, `The limit must be at most ${AUDIT_MAX_LIMIT}.`)
      .default(AUDIT_DEFAULT_LIMIT),
    cursor: z
      .string({ error: CURSOR_MESSAGE })
      .max(AUDIT_CURSOR_MAX_LENGTH, CURSOR_MESSAGE)
      .transform((text, context) => {
        const position = decodeAuditCursor(text);
        if (position === null) {
          context.issues.push({ code: 'custom', message: CURSOR_MESSAGE, input: text });
          return z.NEVER;
        }
        return position;
      })
      .optional(),
  })
  // ISO dates compare as text in the order of the calendar.
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    path: ['to'],
    message: RANGE_ORDER_MESSAGE,
  });

const entrySchema = z.strictObject({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  who: z.string().min(1),
  event: z.string().min(1),
  category: z.strictObject({ id: z.string().min(1), label: z.string().min(1) }).nullable(),
  objectLabel: z.string().min(1),
  change: z.strictObject({ before: z.string(), after: z.string() }),
});

export const auditPageSchema = z.strictObject({
  entries: z.array(entrySchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).nullable(),
});
