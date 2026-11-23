import { z } from 'zod';

import { ESTIMATE_STATUSES } from '../../../lib/estimate/state-machine';
import { DEFAULT_QUEUE_TAB, QUEUE_DEFAULT_LIMIT, QUEUE_MAX_LIMIT, QUEUE_TABS } from '../../../lib/tasks/queue';
import { QUEUE_SEARCH_MAX_LENGTH } from '../../../lib/tasks/queue-filters';
import { isIsoDate } from '../../../lib/time';
import { decodeTaskQueueCursor, TASK_QUEUE_CURSOR_MAX_LENGTH } from '../../services/task-queue-cursor';

import { ignoredMarkerSchema } from './estimates';

/**
 * The contract of the task routes (STORY-04.01, architecture section 6 "Create task" and "Assign context"). Every body and answer is a strict object: a key
 * that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does not offer (`assignedBy` is the
 * session's, never the body's). `POST /api/v1/tasks` and the assign context are for a Lead or an Admin: an Engineer never reaches them (BR-004, NFR-001);
 * `GET /api/v1/tasks` (the queue, STORY-04.02) is for every role, and answers an Engineer with their own tasks only.
 *
 * The body only bounds the size of each text. What is *wrong* with a value (a path that is not a UNC path, a deadline that is not later than now, a title
 * that is too long) is the task service's to say, with the words of the UX spec under the field it names (`lib/tasks/assign.ts`), so a form gets the same
 * messages from the server as from its own check. A field that is left out is read as empty, and the service names it.
 */

/** A bound on what the server reads, far above every limit of the screen (title 120, notes 1,000, path 500): a larger body is refused before anything is checked. */
const MAX_TEXT_LENGTH = 5_000;

const text = z.string().max(MAX_TEXT_LENGTH).default('');

const MAX_ID_LENGTH = 100;


/**
 * `POST /api/v1/tasks` (AC-1, AC-3; CR-01 item 6, AQP-390): the Engineer, the customer, the path, the deadline as `YYYY-MM-DDTHH:mm` in IST, the title and the subject (both required by the service's
 * rules), and the optional notes. The customer's short name has no key here: it is never typed, the service reads it from the Customer master. Each text only has its size bounded here (the limits of the screen are `lib/tasks/assign.ts`).
 */
export const assignTaskBodySchema = z.strictObject({
  engineerId: text,
  customerId: text,
  folderPath: text,
  deadline: text,
  title: text,
  subject: text,
  notes: text,
});

/**
 * `PATCH /api/v1/tasks/{id}` (STORY-04.07 AC-3): the new Engineer's ID and/or the new deadline as an ISO 8601 instant in UTC. Both are optional, and a body with neither (or with the stored values)
 * changes nothing. As for the assignment, the body only bounds the size of each text: what is *wrong* with a value is the task service's to say, with the words of the UX spec under the field it
 * names (`lib/tasks/reassign.ts`). The assigner, the revision, the folder, the title and the notes have no key here, so a client cannot set them.
 */
export const reassignTaskBodySchema = z.strictObject({
  engineerId: z.string().max(MAX_TEXT_LENGTH).optional(),
  deadlineAt: z.string().max(MAX_TEXT_LENGTH).optional(),
});

const engineerSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1) });

/** A customer as the assignment answers carry it: the ID, the name and the short name (class Internal). No contact detail and no rate can leave with it (NFR-002). */
const customerSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1), shortName: z.string().min(1) });

/** The task as it was stored, with the `file:` link the server built from its path (AC-4), and its empty estimate (AC-1). */
export const assignedTaskSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^Q-\d{4}-\d{4,}$/),
  engineer: engineerSchema,
  folderPath: z.string().min(1),
  folderUrl: z.string().startsWith('file:///'),
  /** An ISO 8601 instant in UTC; the screen shows it in IST. */
  deadlineAt: z.iso.datetime(),
  title: z.string().min(1),
  subject: z.string().min(1),
  customer: customerSchema,
  notes: z.string().nullable(),
  estimate: z.strictObject({
    id: z.string().min(1),
    status: z.enum(ESTIMATE_STATUSES),
    customerId: z.string().nullable(),
  }),
});

/**
 * `GET /api/v1/options/assign-context` (AC-5): the active Engineers, by ID and name, and one boolean of the settings, whether e-mail alerts are on (STORY-09.03 AC-6, for the notice of
 * SCR-04). A Lead cannot read Settings, so nothing else of them is here: no sender, no address.
 */
export const assignContextSchema = z.strictObject({ engineers: z.array(engineerSchema).readonly(), customers: z.array(customerSchema).readonly(), alertsEnabled: z.boolean() });

const LIMIT_MESSAGE = `The limit must be a whole number from 1 to ${QUEUE_MAX_LIMIT}.`;
const CURSOR_MESSAGE = 'This is not a place in the list. Start again from the first page.';
const ASSIGNED_BY_MESSAGE = 'The assignedBy filter can only be "me" or "anyone".';
const SEARCH_MESSAGE = `The search can be at most ${QUEUE_SEARCH_MAX_LENGTH} characters.`;
const ENGINEER_MESSAGE = 'The Engineer filter must be the ID of an Engineer.';
const CUSTOMER_MESSAGE = 'The customer filter must be the ID of a customer.';
const FROM_MESSAGE = 'The start date must be a real date written YYYY-MM-DD.';
const TO_MESSAGE = 'The end date must be a real date written YYYY-MM-DD.';

const day = (message: string) => z.string({ error: message }).refine(isIsoDate, message);

/**
 * `GET /api/v1/tasks?tab=&limit=&cursor=&assignedBy=&q=&engineer=&customer=&from=&to=` (STORY-04.02 AC-1, AC-2; STORY-04.03 AC-3; STORY-04.06 AC-3, AC-4;
 * architecture section 6, "Tasks"). The query is a strict object, so a name that is not offered is an error and is never read: in particular there is no field that
 * names whose tasks to list (the scope comes from the session). The filters only narrow what the role may see. `assignedBy` is `me` (the signed-in person, never
 * another) or `anyone`; `q` is the task ID or title, `engineer` and `customer` are IDs, `from` and `to` are deadline days in IST (`YYYY-MM-DD`, both inclusive). What
 * only a Lead or an Admin may use, and a range that ends before it begins, are the task service's to refuse. Query strings arrive as text: the limit becomes a whole
 * number and the cursor the place it names.
 */
export const taskQueueQuerySchema = z.strictObject({
  tab: z.enum(QUEUE_TABS, { error: 'The tab must be open, closed, overdue or ignored.' }).default(DEFAULT_QUEUE_TAB),
  limit: z.coerce
    .number({ error: LIMIT_MESSAGE })
    .int(LIMIT_MESSAGE)
    .min(1, LIMIT_MESSAGE)
    .max(QUEUE_MAX_LIMIT, LIMIT_MESSAGE)
    .default(QUEUE_DEFAULT_LIMIT),
  cursor: z
    .string({ error: CURSOR_MESSAGE })
    .max(TASK_QUEUE_CURSOR_MAX_LENGTH, CURSOR_MESSAGE)
    .transform((text, context) => {
      const position = decodeTaskQueueCursor(text);
      if (position === null) {
        context.issues.push({ code: 'custom', message: CURSOR_MESSAGE, input: text });
        return z.NEVER;
      }
      return position;
    })
    .optional(),
  assignedBy: z.enum(['me', 'anyone'], { error: ASSIGNED_BY_MESSAGE }).optional(),
  q: z
    .string({ error: SEARCH_MESSAGE })
    .trim()
    .max(QUEUE_SEARCH_MAX_LENGTH, SEARCH_MESSAGE)
    .transform((text) => (text === '' ? undefined : text))
    .optional(),
  engineer: z.uuid({ error: ENGINEER_MESSAGE }).optional(),
  customer: z.uuid({ error: CUSTOMER_MESSAGE }).optional(),
  from: day(FROM_MESSAGE).optional(),
  to: day(TO_MESSAGE).optional(),
});

/**
 * One row of the queue. Every field is a name, a code, a path, an instant or a status: no cost, rate, price or formula value is in the schema, and a field that
 * is not named cannot leave (NFR-002, STORY-04.02 AC-8). The same schema answers an Engineer, whose service call is already cut to their own tasks.
 */
const queueTaskSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^Q-\d{4}-\d{4,}$/),
  title: z.string(),
  engineer: engineerSchema,
  /** Null only for an estimate made before CR-01 item 6, which has no customer yet. */
  customerName: z.string().nullable(),
  folderPath: z.string().min(1),
  folderUrl: z.string().startsWith('file:///').nullable(),
  /** An ISO 8601 instant in UTC; the screen shows it in IST. */
  deadlineAt: z.iso.datetime(),
  /** What a row shows (`displayStatusOf`): the estimate's status, or `IGNORED` while the layer over it is set (CR-01 item 7D). */
  status: z.enum([...ESTIMATE_STATUSES, 'IGNORED']),
  assignedByName: z.string().min(1),
  /** The Lead's remarks, **only on a row of the Ignored tab** (AC-3, AC-9); `null` on every other row. Who ignored it and when are not in a row. Words typed by a Lead: no figure (NFR-002). */
  ignoredRemarks: z.string().min(1).nullable(),
});

/**
 * `PATCH /api/v1/tasks/{id}` (STORY-04.07 AC-3; architecture section 6, "Change task"): the answer is the task as the queue shows it, the same strict row, so no cost, rate, price or
 * formula value can leave with it (NFR-002).
 */
export const reassignedTaskSchema = queueTaskSchema;

/** The path parameter of `/api/v1/tasks/{id}`: it only bounds the size of the text. Whether it names a task, and whose, is the service's to say, always as a 404. */
export const taskIdParamsSchema = z.strictObject({ id: z.string().max(MAX_ID_LENGTH) });

/**
 * `GET /api/v1/tasks/{id}` (STORY-04.04 AC-1, AC-3; architecture section 6, "Task detail"): one task and the status of its estimate. The same strict schema answers an
 * Engineer, a Lead and an Admin (one route, one schema: a Lead's or an Admin's extras come from separate routes, never from a role branch here). Every field is a name,
 * a code, a path, a text the person typed, an instant or the status: no rate, cost, formula value, approver, price or override reason is in the schema, and a field that
 * is not named cannot leave (NFR-002). "Approved" is the status word and carries no amount.
 */
export const taskDetailSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^Q-\d{4}-\d{4,}$/),
  title: z.string(),
  /** The project name (CR-01 item 6). */
  subject: z.string().min(1),
  /** What the person who assigned the task wrote for the Engineer; null when nothing was written. */
  notes: z.string().nullable(),
  engineer: engineerSchema,
  /** Null only for an estimate made before CR-01 item 6. Names only: the ID, the name and the short name (NFR-002). */
  customer: customerSchema.nullable(),
  customerName: z.string().nullable(),
  folderPath: z.string().min(1),
  folderUrl: z.string().startsWith('file:///').nullable(),
  /** An ISO 8601 instant in UTC; the screen shows it in IST. */
  deadlineAt: z.iso.datetime(),
  /** The status of the estimate, from `estimates.status`, **underneath** the Ignored layer. The words come from `taskStatusOf`; an approved estimate is the closed task (`isTaskClosed`). */
  status: z.enum(ESTIMATE_STATUSES),
  assignedByName: z.string().min(1),
  /**
   * The Ignored layer (CR-01 item 7D, AQP-401 AC-9): who set it (by name, never an ID), when (UTC text) and the Lead's remarks, or `null`. **The same for every role**: an Engineer's own ignored task reads its notice from
   * it, and another Engineer's task is not found before this is read. It holds no figure (NFR-002).
   */
  ignored: ignoredMarkerSchema.nullable(),
});

const count = z.number().int().nonnegative();

/** `GET /api/v1/tasks` (STORY-04.02 AC-1): a page of one tab, the count of every tab, and where the next page begins. */
export const taskQueueSchema = z.strictObject({
  tab: z.enum(QUEUE_TABS),
  tasks: z.array(queueTaskSchema),
  counts: z.strictObject({ open: count, closed: count, overdue: count, ignored: count }),
  nextCursor: z.string().min(1).nullable(),
  /** The instant overdue was judged at, as an ISO 8601 instant in UTC: the rows' "Overdue by" text is worded against it (STORY-04.03 AC-1). */
  asOf: z.iso.datetime(),
});
