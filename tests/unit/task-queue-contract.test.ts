import { describe, expect, it } from 'vitest';

import { isQueueTab, queueQueryString, QUEUE_TABS } from '@/lib/tasks/queue';
import { decodeTaskQueueCursor, encodeTaskQueueCursor, TASK_QUEUE_CURSOR_MAX_LENGTH } from '@/server/services/task-queue-cursor';
import type { TaskQueue } from '@/server/services/task-service';
import { taskQueueQuerySchema, taskQueueSchema } from '@/server/views/schemas/tasks';
import { queueAnswer } from '@/server/views/task-queue';

/**
 * STORY-04.02 T1, T3 (AC-1, AC-2, AC-5, AC-8): the contract of `GET /api/v1/tasks` with no server: the cursor, the strict query, the strict answer and the
 * function that turns a queue into it. Every name and path is invented.
 */

const DEADLINE = new Date('2026-11-12T11:30:00.000Z');
const CODE = 'Q-2026-0042';

describe('the tabs and the query string', () => {
  it('knows the three tabs and nothing else', () => {
    expect(QUEUE_TABS).toEqual(['open', 'closed', 'overdue']);
    expect(['open', 'closed', 'overdue'].every(isQueueTab)).toBe(true);
    expect(['Open', 'all', '', 'overdue '].some(isQueueTab)).toBe(false);
  });

  it('writes the tab, and the cursor only when there is one, encoded', () => {
    expect(queueQueryString('closed')).toBe('tab=closed');
    expect(queueQueryString('open', 'abc-_')).toBe('tab=open&cursor=abc-_');
    expect(queueQueryString('open', 'a+b/c=')).toBe('tab=open&cursor=a%2Bb%2Fc%3D');
  });
});

describe('the cursor (architecture section 6, "Pagination")', () => {
  it('names the deadline and the code of the last task and reads back the same', () => {
    expect(decodeTaskQueueCursor(encodeTaskQueueCursor({ deadlineAt: DEADLINE, code: CODE }))).toEqual({ deadlineAt: DEADLINE, code: CODE });
  });

  it('is URL-safe text, short enough for the limit', () => {
    const text = encodeTaskQueueCursor({ deadlineAt: DEADLINE, code: CODE });
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThan(TASK_QUEUE_CURSOR_MAX_LENGTH);
  });

  it.each([
    ['empty', ''],
    ['not base64 JSON', '!!!'],
    ['JSON that is not a cursor', Buffer.from('{"x":1}').toString('base64url')],
    ['a code that is not a task code', Buffer.from(JSON.stringify({ t: 1, c: 'not-a-code' })).toString('base64url')],
    ['a negative time', Buffer.from(JSON.stringify({ t: -1, c: CODE })).toString('base64url')],
    ['a time beyond the calendar', Buffer.from(JSON.stringify({ t: 9e15, c: CODE })).toString('base64url')],
    ['an extra key', Buffer.from(JSON.stringify({ t: 1, c: CODE, e: 'x' })).toString('base64url')],
    ['too long', 'A'.repeat(TASK_QUEUE_CURSOR_MAX_LENGTH + 1)],
  ])('refuses text that %s, and never guesses', (_name, text) => {
    expect(decodeTaskQueueCursor(text)).toBeNull();
  });
});

describe('AC-1, AC-2: the query is strict', () => {
  it('defaults to the Open tab and the page size of 50', () => {
    expect(taskQueueQuerySchema.parse({})).toEqual({ tab: 'open', limit: 50 });
  });

  it('reads a tab, a limit as a whole number from 1 to 200, and a cursor as the place it names', () => {
    const cursor = encodeTaskQueueCursor({ deadlineAt: DEADLINE, code: CODE });
    expect(taskQueueQuerySchema.parse({ tab: 'overdue', limit: '200', cursor })).toEqual({
      tab: 'overdue',
      limit: 200,
      cursor: { deadlineAt: DEADLINE, code: CODE },
    });
  });

  it.each([
    ['a tab that is not one', { tab: 'all' }],
    ['a limit of 0', { limit: '0' }],
    ['a limit over 200', { limit: '201' }],
    ['a fractional limit', { limit: '1.5' }],
    ['a limit that is not a number', { limit: 'many' }],
    ['a cursor that is not one', { cursor: 'junk' }],
    ['whose tasks to list (the scope is the session\'s)', { engineer: '00000000-0000-4000-8000-0000000000e1' }],
    ['a filter of story 04.06, which is not built yet', { q: 'hopper' }],
    ['someone else\'s tasks by assignedBy (only "me" exists, STORY-04.03)', { assignedBy: '00000000-0000-4000-8000-0000000000b1' }],
    ['an empty assignedBy', { assignedBy: '' }],
  ])('refuses %s', (_name, query) => {
    expect(taskQueueQuerySchema.safeParse(query).success).toBe(false);
  });

  it('reads assignedBy=me, the one filter a Lead\'s bell needs (STORY-04.03 AC-3), and leaves it out when it is not given', () => {
    expect(taskQueueQuerySchema.parse({ tab: 'overdue', assignedBy: 'me' })).toMatchObject({ tab: 'overdue', assignedBy: 'me' });
    expect(taskQueueQuerySchema.parse({}).assignedBy).toBeUndefined();
  });
});

const queue: TaskQueue = {
  tab: 'open',
  tasks: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      code: CODE,
      title: 'Hopper cover',
      engineer: { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun' },
      customerName: null,
      folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
      folderUrl: 'file:////invented-server/invented-share/RFQ-1',
      deadlineAt: DEADLINE,
      status: 'DRAFT',
      assignedByName: 'Invented Boss',
    },
  ],
  counts: { open: 1, closed: 0, overdue: 0 },
  nextCursor: null,
  asOf: new Date('2026-11-09T04:00:00.000Z'),
};

describe('AC-8: the answer is strict and names no cost', () => {
  it('turns the deadline into UTC text and passes the answer its own schema', () => {
    const answer = queueAnswer(queue);
    expect(answer.tasks[0]?.deadlineAt).toBe('2026-11-12T11:30:00.000Z');
    expect(taskQueueSchema.parse(answer)).toEqual(answer);
  });

  it('accepts a row with no title, no customer and no link', () => {
    const [task] = queue.tasks;
    const bare = queueAnswer({ ...queue, tasks: [{ ...(task as NonNullable<typeof task>), title: null, folderUrl: null }] });
    expect(taskQueueSchema.safeParse(bare).success).toBe(true);
  });

  it('refuses a field that is not named, in a row and at the top, so a cost value cannot leave', () => {
    const answer = queueAnswer(queue);
    const row = { ...answer.tasks[0], materialRate: '123.45' };
    expect(taskQueueSchema.safeParse({ ...answer, tasks: [row] }).success).toBe(false);
    expect(taskQueueSchema.safeParse({ ...answer, total: '12345.00' }).success).toBe(false);
    expect(taskQueueSchema.safeParse({ ...answer, counts: { ...answer.counts, price: 1 } }).success).toBe(false);
  });

  it('refuses a code, a link and a status it does not know', () => {
    const answer = queueAnswer(queue);
    for (const change of [{ code: 'X-1' }, { folderUrl: 'javascript:alert(1)' }, { status: 'PRICED' }]) {
      expect(taskQueueSchema.safeParse({ ...answer, tasks: [{ ...answer.tasks[0], ...change }] }).success, JSON.stringify(change)).toBe(false);
    }
  });
});
