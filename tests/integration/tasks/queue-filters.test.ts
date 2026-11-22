import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createFixedClock, startOfIstDay } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { decodeTaskQueueCursor } from '@/server/services/task-queue-cursor';
import { createTaskService, type QueueQuery, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-04.06 T3 (AC-3, AC-4, AC-5, AC-8; NFR-002, NFR-015) against real PostgreSQL in a throwaway database: each filter alone and combined, From and To at the IST midnight edge, a
 * search with `%` and `_` that matches only itself, a 120-character search, an Engineer's hostile query, a cursor reused under other filters, the counts under the filters, and the
 * bell count equal to the Overdue tab. Tasks of two Leads, three Engineers, customers chosen and not. Every name, path and date is invented.
 */

/** 01:30 IST on 13 Nov: the tasks due before then are past their deadline. */
const NOW = new Date('2026-11-12T20:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const ist = (day: string, hours: number, minutes = 0): Date => new Date(startOfIstDay(day).getTime() + (hours * 60 + minutes) * 60_000);

let db: AuthDatabase;
let service: TaskService;
let firstLeadId: string;
let secondLeadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let meeraId: string;
let acmeId: string;
let boltId: string;

const as = (id: string, role: QueueViewer['role']): QueueViewer => ({ id, role });
const codes = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);
const open = (viewer: QueueViewer, query: Omit<QueueQuery, 'tab'> = {}) => service.listQueue(viewer, { tab: 'open', ...query });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW) });
  firstLeadId = await insertPersonAsOwner(db, 'Filter First Lead', 'LEAD');
  secondLeadId = await insertPersonAsOwner(db, 'Filter Second Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Filter Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Filter Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Filter Priya', 'ENGINEER');
  meeraId = await insertPersonAsOwner(db, 'Filter Meera', 'ENGINEER');
  const customers = await db.owner.query<{ id: string }>("INSERT INTO customers (name, short_name) VALUES ('Invented Acme', left(md5('Invented Acme'), 10)), ('Invented Bolt', left(md5('Invented Bolt'), 10)) RETURNING id::text");
  acmeId = defined(customers.rows[0]).id;
  boltId = defined(customers.rows[1]).id;
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

async function seed(
  code: string,
  engineerId: string,
  assignedById: string,
  deadlineAt: Date,
  options: { readonly title?: string | null; readonly customerId?: string | null; readonly status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' } = {},
): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, \'Invented subject\') RETURNING id::text',
    [code, engineerId, assignedById, PATH, deadlineAt, options.title ?? 'Invented task'],
  );
  await db.owner.query('INSERT INTO estimates (task_id, status, customer_id) VALUES ($1::uuid, $2::estimate_status, $3)', [
    defined(task.rows[0]).id,
    options.status ?? 'DRAFT',
    options.customerId ?? null,
  ]);
}

/**
 * 0001 Arjun, first Lead, Acme, "Hopper cover", 23:30 IST on 12 Nov. 0002 Arjun, second Lead, no customer, "Bracket 50% off", 00:00 IST on 13 Nov.
 * 0003 Priya, first Lead, Bolt, "Plate_A", closed, 10 Nov. 0004 Priya, second Lead, Acme, no title, 20 Nov. 0005 Meera, first Lead, none, "PlateXA", 25 Nov.
 */
async function seedFive(): Promise<void> {
  await seed('Q-2026-0001', arjunId, firstLeadId, ist('2026-11-12', 23, 30), { title: 'Hopper cover', customerId: acmeId });
  await seed('Q-2026-0002', arjunId, secondLeadId, ist('2026-11-13', 0), { title: 'Bracket 50% off' });
  await seed('Q-2026-0003', priyaId, firstLeadId, ist('2026-11-10', 12), { title: 'Plate_A', status: 'APPROVED', customerId: boltId });
  await seed('Q-2026-0004', priyaId, secondLeadId, ist('2026-11-20', 12), { customerId: acmeId });
  await seed('Q-2026-0005', meeraId, firstLeadId, ist('2026-11-25', 12), { title: 'PlateXA' });
}

describe('AC-3: each filter alone, on the real tables', () => {
  it('searches the code and the title, contains, ignoring letter case', async () => {
    await seedFive();
    const lead = as(firstLeadId, 'LEAD');
    expect(codes(await open(lead, { q: 'hOpPeR' }))).toEqual(['Q-2026-0001']);
    expect(codes(await open(lead, { q: 'q-2026-0004' }))).toEqual(['Q-2026-0004']);
    expect(codes(await open(lead, { q: 'BRACKET' }))).toEqual(['Q-2026-0002']);
    expect(codes(await open(lead, { q: 'no such task' }))).toEqual([]);
  });

  it('reads a percent sign, an underscore and a backslash as themselves, never as wildcards', async () => {
    await seedFive();
    const lead = as(firstLeadId, 'LEAD');
    expect(codes(await service.listQueue(lead, { tab: 'closed', q: 'Plate_A' }))).toEqual(['Q-2026-0003']);
    expect(codes(await open(lead, { q: 'Plate_A' }))).toEqual([]);
    expect(codes(await open(lead, { q: '50%' }))).toEqual(['Q-2026-0002']);
    expect(codes(await open(lead, { q: '%' }))).toEqual(['Q-2026-0002']);
    expect(codes(await open(lead, { q: '_' }))).toEqual([]);
    expect(codes(await open(lead, { q: 'a\\b' }))).toEqual([]);
  });

  it('accepts a search of exactly 120 characters', async () => {
    await seedFive();
    expect(codes(await open(as(firstLeadId, 'LEAD'), { q: 'x'.repeat(120) }))).toEqual([]);
  });

  it('filters by Engineer, and by customer: a task whose Engineer has not chosen one matches no customer', async () => {
    await seedFive();
    const lead = as(firstLeadId, 'LEAD');
    expect(codes(await open(lead, { engineer: arjunId }))).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(codes(await open(lead, { customer: acmeId }))).toEqual(['Q-2026-0001', 'Q-2026-0004']);
    expect(codes(await service.listQueue(lead, { tab: 'closed', customer: boltId }))).toEqual(['Q-2026-0003']);
    expect(codes(await open(lead, { customer: '00000000-0000-4000-8000-0000000000a9' }))).toEqual([]);
  });

  it('takes the deadline days in IST, both inclusive: 23:30 IST on the To day is in, 00:00 IST the next day is not', async () => {
    await seedFive();
    const lead = as(firstLeadId, 'LEAD');
    expect(codes(await open(lead, { to: '2026-11-12' }))).toEqual(['Q-2026-0001']);
    expect(codes(await open(lead, { from: '2026-11-13', to: '2026-11-13' }))).toEqual(['Q-2026-0002']);
    expect(codes(await open(lead, { from: '2026-11-12', to: '2026-11-12' }))).toEqual(['Q-2026-0001']);
    expect(codes(await open(lead, { from: '2026-11-13' }))).toEqual(['Q-2026-0002', 'Q-2026-0004', 'Q-2026-0005']);
    expect(codes(await open(lead, { from: '2026-11-21', to: '2026-11-24' }))).toEqual([]);
  });
});

describe('AC-3: filters combine with AND, with the tab and with assignedBy, and the counts follow', () => {
  it('combines Engineer, customer, a search and a range', async () => {
    await seedFive();
    const admin = as(adminId, 'ADMIN');
    expect(codes(await open(admin, { engineer: arjunId, customer: acmeId, q: 'cover', from: '2026-11-12', to: '2026-11-12' }))).toEqual(['Q-2026-0001']);
    expect(codes(await open(admin, { engineer: priyaId, q: 'bracket' }))).toEqual([]);
  });

  it('follows assignedBy=me and the tab for a Lead', async () => {
    await seedFive();
    const lead = as(firstLeadId, 'LEAD');
    expect(codes(await open(lead, { assignedBy: 'me' }))).toEqual(['Q-2026-0001', 'Q-2026-0005']);
    expect(codes(await open(lead, { assignedBy: 'anyone' }))).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004', 'Q-2026-0005']);
    expect(codes(await open(lead, { assignedBy: 'me', customer: acmeId }))).toEqual(['Q-2026-0001']);
  });

  it('counts the three tabs under the filters, and the bell count is the Overdue tab of assignedBy=me with no other filter', async () => {
    await seedFive();
    expect((await open(as(adminId, 'ADMIN'), { customer: acmeId })).counts).toEqual({ open: 2, closed: 0, overdue: 1 });
    expect((await open(as(adminId, 'ADMIN'), { engineer: priyaId })).counts).toEqual({ open: 1, closed: 1, overdue: 0 });
    const lead = as(firstLeadId, 'LEAD');
    const cut = await service.listQueue(lead, { tab: 'overdue', assignedBy: 'me' });
    expect(cut.counts).toEqual({ open: 2, closed: 1, overdue: 1 });
    expect(cut.tasks).toHaveLength(await service.countOverdue(lead));
  });

  it('pages a filtered set: page 2 is the next rows of the same filtered set', async () => {
    await seedFive();
    const admin = as(adminId, 'ADMIN');
    const first = await open(admin, { q: 'q-2026', limit: 2 });
    expect(codes(first)).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    const cursor = decodeTaskQueueCursor(defined(first.nextCursor));
    const second = await open(admin, { q: 'q-2026', limit: 2, ...(cursor === null ? {} : { cursor }) });
    expect(codes(second)).toEqual(['Q-2026-0004', 'Q-2026-0005']);
    expect(second.nextCursor).toBeNull();
  });
});

describe('AC-5, AC-8: scope and what an Engineer is refused', () => {
  it('lets an Engineer search and keeps every result their own, in the list and in the counts', async () => {
    await seedFive();
    const result = await open(as(priyaId, 'ENGINEER'), { q: 'q-2026' });
    expect(codes(result)).toEqual(['Q-2026-0004']);
    expect(result.counts).toEqual({ open: 1, closed: 1, overdue: 0 });
    expect(codes(await service.listQueue(as(arjunId, 'ENGINEER'), { tab: 'closed', q: 'plate' }))).toEqual([]);
  });

  it('refuses a hostile engineer, customer, dates and assignedBy for an Engineer, naming each', async () => {
    await seedFive();
    const arjun = as(arjunId, 'ENGINEER');
    for (const [field, extra] of [
      ['engineer', { engineer: priyaId }],
      ['assignedBy', { assignedBy: 'anyone' as const }],
      ['customer', { customer: acmeId }],
      ['from', { from: '2026-11-01' }],
      ['to', { to: '2026-11-30' }],
    ] as const) {
      await expect(open(arjun, extra)).rejects.toMatchObject({ fields: [{ field }] });
    }
  });

  it('gives a Lead\'s assignedBy=me the signed-in Lead\'s tasks only, never another person\'s', async () => {
    await seedFive();
    const second = await open(as(secondLeadId, 'LEAD'), { assignedBy: 'me' });
    expect(codes(second)).toEqual(['Q-2026-0002', 'Q-2026-0004']);
    expect(second.counts).toEqual({ open: 2, closed: 0, overdue: 1 });
  });

  it('uses a cursor made under one filter set under another, and returns rows only inside the caller\'s scope', async () => {
    await seedFive();
    const first = await open(as(adminId, 'ADMIN'), { limit: 1 });
    const cursor = decodeTaskQueueCursor(defined(first.nextCursor));
    const reused = await open(as(priyaId, 'ENGINEER'), { q: 'q-2026', ...(cursor === null ? {} : { cursor }) });
    expect(codes(reused)).toEqual(['Q-2026-0004']);
  });

  it('refuses a start date after the end date, under To', async () => {
    await seedFive();
    await expect(open(as(adminId, 'ADMIN'), { from: '2026-11-20', to: '2026-11-10' })).rejects.toMatchObject({
      fields: [{ field: 'to', message: 'The start date is after the end date.' }],
    });
  });
});
