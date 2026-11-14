import { z } from 'zod';

/**
 * The contract of the task routes (STORY-04.01, architecture section 6 "Create task" and "Assign context"). Every body and answer is a strict object: a key
 * that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does not offer (`assignedBy` is the
 * session's, never the body's). Both routes are for a Lead or an Admin: an Engineer never reaches them (BR-004, NFR-001).
 *
 * The body only bounds the size of each text. What is *wrong* with a value (a path that is not a UNC path, a deadline that is not later than now, a title
 * that is too long) is the task service's to say, with the words of the UX spec under the field it names (`lib/tasks/assign.ts`), so a form gets the same
 * messages from the server as from its own check. A field that is left out is read as empty, and the service names it.
 */

/** A bound on what the server reads, far above every limit of the screen (title 120, notes 1,000, path 500): a larger body is refused before anything is checked. */
const MAX_TEXT_LENGTH = 5_000;

const text = z.string().max(MAX_TEXT_LENGTH).default('');

/** `POST /api/v1/tasks` (AC-1, AC-3): the Engineer, the path, the deadline as `YYYY-MM-DDTHH:mm` in IST, and the optional title and notes. */
export const assignTaskBodySchema = z.strictObject({
  engineerId: text,
  folderPath: text,
  deadline: text,
  title: text,
  notes: text,
});

const engineerSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1) });

/** The task as it was stored, with the `file:` link the server built from its path (AC-4), and its empty estimate (AC-1). */
export const assignedTaskSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^Q-\d{4}-\d{4,}$/),
  engineer: engineerSchema,
  folderPath: z.string().min(1),
  folderUrl: z.string().startsWith('file:///'),
  /** An ISO 8601 instant in UTC; the screen shows it in IST. */
  deadlineAt: z.iso.datetime(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  estimate: z.strictObject({
    id: z.string().min(1),
    status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']),
    customerId: z.string().nullable(),
  }),
});

/** `GET /api/v1/options/assign-context` (AC-5): the active Engineers, by ID and name, and nothing else. */
export const assignContextSchema = z.strictObject({ engineers: z.array(engineerSchema).readonly() });
