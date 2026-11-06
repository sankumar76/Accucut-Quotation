import { beforeEach, describe, expect, it } from 'vitest';

import { startOfIstDay } from '@/lib/time';
import { decodeAuditCursor } from '@/server/services/audit-cursor';
import { createAuditService, type AuditService } from '@/server/services/audit-service';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';

import { createFakeAuditWorld, type FakeAuditWorld } from '../support/fake-audit';
import { defined } from '../support/defined';

/**
 * STORY-01.07 T2 and T4 (AC-2, AC-3, AC-4, AC-6): the audit service over an in-memory log. What `record` accepts and refuses,
 * and how `list` filters, orders, pages and counts. The same service runs against PostgreSQL, with the real trigger and a real
 * rollback, in tests/integration/audit. Every name is invented.
 */

const ADMIN = '00000000-0000-4000-8000-abcdef000001';
const LEAD = '00000000-0000-4000-8000-abcdef000002';
const PERSON = '00000000-0000-4000-8000-abcdef000003';
const NAMES: Readonly<Record<string, string>> = { [ADMIN]: 'Invented Admin', [LEAD]: 'Invented Lead' };
const REQUEST_ID = 'req-0a0b0c0d';

let world: FakeAuditWorld;
let service: AuditService;

beforeEach(() => {
  world = createFakeAuditWorld((actorId) => NAMES[actorId] ?? 'Invented Unknown');
  service = createAuditService({ audit: world.audit });
});

/** Raises `user.created` for a person, as `actorId`, at `at`, in a transaction of its own. */
async function addedAt(at: string, actorId = ADMIN, label = 'Invented Person'): Promise<void> {
  world.clock.set(new Date(at));
  await world.transactions.run((tx) =>
    service.record(tx, { event: 'user.created', actorId, requestId: REQUEST_ID, object: { id: PERSON, label }, before: null, after: { role: 'ENGINEER', isActive: true } }),
  );
}

async function deactivatedAt(at: string): Promise<void> {
  world.clock.set(new Date(at));
  await world.transactions.run((tx) =>
    service.record(tx, { event: 'user.deactivated', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'Invented Person' }, before: { isActive: true }, after: { isActive: false } }),
  );
}

describe('AC-2: record appends in the caller\'s transaction', () => {
  it('keeps the entry when the transaction commits: exactly one', async () => {
    await addedAt('2026-11-05T09:00:00.000Z');
    expect(world.audit.committed).toHaveLength(1);
  });

  it('drops the entry when the transaction rolls back', async () => {
    const failure = new Error('the change failed after the entry was recorded');
    world.clock.set(new Date('2026-11-05T09:00:00.000Z'));
    await expect(
      world.transactions.run(async (tx) => {
        await service.record(tx, { event: 'user.created', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'Invented Person' }, before: null, after: { role: 'LEAD', isActive: true } });
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(world.audit.committed).toEqual([]);
  });

  it('cannot write without a transaction: the repository refuses a handle it did not open', async () => {
    await expect(service.record({ kind: 'database-transaction' }, { event: 'user.created', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'x' }, before: null, after: { role: 'LEAD', isActive: true } })).rejects.toThrow(
      'did not open',
    );
  });

  it('keeps two entries of one transaction as two entries', async () => {
    await world.transactions.run(async (tx) => {
      await service.record(tx, { event: 'user.role_changed', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'Invented Person' }, before: { role: 'ENGINEER' }, after: { role: 'LEAD' } });
      await service.record(tx, { event: 'user.deactivated', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'Invented Person' }, before: { isActive: true }, after: { isActive: false } });
    });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['user.role_changed', 'user.deactivated']);
  });
});

describe('AC-3 and AC-4: record refuses what does not fit its event, or holds a secret', () => {
  const base = { actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label: 'Invented Person' } } as const;

  /**
   * The registry's types refuse an extra key at compile time, which is the point; these tests prove the same refusal at run time,
   * for a caller that got round the compiler (data from outside, a cast), so they build the payloads without the types.
   */
  function unchecked<T>(value: unknown): T {
    return value as T;
  }

  async function refusalOf(write: (tx: Parameters<Parameters<typeof world.transactions.run>[0]>[0]) => Promise<void>): Promise<unknown> {
    return world.transactions.run(write).then(
      () => {
        throw new Error('expected a refusal');
      },
      (error: unknown) => error,
    );
  }

  it('refuses a before or an after that has a key the event does not name, and writes nothing', async () => {
    const error = await refusalOf((tx) =>
      service.record(tx, { ...base, event: 'user.role_changed', before: unchecked({ role: 'ENGINEER', passwordHash: '$argon2id$x' }), after: { role: 'LEAD' } }),
    );
    expect(error).toBeInstanceOf(AuditEntryRefusedError);
    expect(error).toMatchObject({ reason: 'shape', where: 'before' });
    const second = await refusalOf((tx) =>
      service.record(tx, { ...base, event: 'user.role_changed', before: { role: 'ENGINEER' }, after: unchecked({ role: 'LEAD', token: 'x' }) }),
    );
    expect(second).toMatchObject({ reason: 'shape', where: 'after' });
    expect(world.audit.committed).toEqual([]);
  });

  it('refuses a secret that a loose shape lets through: a key that names one, and a value that is a hash', async () => {
    const byKey = await refusalOf((tx) => service.record(tx, { ...base, event: 'master.edited', before: null, after: { rate: 1, passwordHash: 'x' } }));
    expect(byKey).toMatchObject({ reason: 'secret', where: 'after.passwordHash' });
    const byValue = await refusalOf((tx) => service.record(tx, { ...base, event: 'master.edited', before: { note: '$argon2id$v=19$m=1,t=1,p=1$a$b' }, after: null }));
    expect(byValue).toMatchObject({ reason: 'secret', where: 'before.note' });
    expect(world.audit.committed).toEqual([]);
  });

  it('accepts the words "password" and "hash" in a label, a reason or a value that is not a hash', async () => {
    await world.transactions.run((tx) =>
      service.record(tx, { ...base, event: 'master.edited', object: { id: PERSON, label: 'Password Hash Tester' }, before: { reason: 'the password hash was discussed' }, after: null }),
    );
    expect(world.audit.committed).toHaveLength(1);
  });

  it('refuses an empty label and one that is too long', async () => {
    const empty = await refusalOf((tx) => service.record(tx, { ...base, event: 'user.created', object: { id: PERSON, label: '' }, before: null, after: { role: 'LEAD', isActive: true } }));
    expect(empty).toMatchObject({ reason: 'shape', where: 'object.label' });
    const long = await refusalOf((tx) => service.record(tx, { ...base, event: 'user.created', object: { id: PERSON, label: 'x'.repeat(201) }, before: null, after: { role: 'LEAD', isActive: true } }));
    expect(long).toMatchObject({ reason: 'shape', where: 'object.label' });
  });

  it('takes the subject of the entry from the registry, not from the caller', async () => {
    await world.transactions.run((tx) => service.record(tx, { ...base, event: 'user.deactivated', before: { isActive: true }, after: { isActive: false } }));
    expect(defined(world.audit.appended[0]).objectType).toBe('user');
  });
});

describe('AC-6: list', () => {
  beforeEach(async () => {
    await addedAt('2026-11-01T09:00:00.000Z', ADMIN, 'First Person');
    await deactivatedAt('2026-11-02T09:00:00.000Z');
    await addedAt('2026-11-03T09:00:00.000Z', LEAD, 'Third Person');
    await addedAt('2026-11-04T09:00:00.000Z', ADMIN, 'Fourth Person');
  });

  const labels = (page: { readonly entries: ReadonlyArray<{ readonly objectLabel: string }> }) => page.entries.map((entry) => entry.objectLabel);

  it('lists newest first with the total, the words of each entry and the name of who made it', async () => {
    const page = await service.list({ limit: 50 });
    expect(labels(page)).toEqual(['Fourth Person', 'Third Person', 'Invented Person', 'First Person']);
    expect(page.total).toBe(4);
    expect(page.nextCursor).toBeNull();
    expect(page.entries[0]).toEqual({
      id: expect.any(String),
      createdAt: '2026-11-04T09:00:00.001Z',
      who: 'Invented Admin',
      event: 'user.created',
      category: { id: 'user_change', label: 'User change' },
      objectLabel: 'Fourth Person',
      change: { before: 'Not added', after: 'Added as Engineer' },
    });
  });

  it('never sends the stored before and after, only their words', async () => {
    const page = await service.list({ limit: 50 });
    for (const entry of page.entries) expect(Object.keys(entry).sort()).toEqual(['category', 'change', 'createdAt', 'event', 'id', 'objectLabel', 'who']);
  });

  it('filters by who', async () => {
    const page = await service.list({ limit: 50, who: LEAD });
    expect(labels(page)).toEqual(['Third Person']);
    expect(page.total).toBe(1);
  });

  it('filters by an event, by a category, and by both (both must hold)', async () => {
    expect(labels(await service.list({ limit: 50, event: 'user.deactivated' }))).toEqual(['Invented Person']);
    expect((await service.list({ limit: 50, category: 'user_change' })).total).toBe(4);
    expect((await service.list({ limit: 50, category: 'approval' })).total).toBe(0);
    expect((await service.list({ limit: 50, category: 'user_change', event: 'user.deactivated' })).total).toBe(1);
    expect((await service.list({ limit: 50, category: 'approval', event: 'user.deactivated' })).total).toBe(0);
  });

  it('filters by day in IST: From and To are whole days, both included', async () => {
    // 09:00 UTC is 14:30 IST of the same day, so each entry sits in the IST day of its UTC date.
    expect(labels(await service.list({ limit: 50, from: '2026-11-02', to: '2026-11-03' }))).toEqual(['Third Person', 'Invented Person']);
    expect(labels(await service.list({ limit: 50, from: '2026-11-04' }))).toEqual(['Fourth Person']);
    expect(labels(await service.list({ limit: 50, to: '2026-11-01' }))).toEqual(['First Person']);
  });

  it('puts the edge of a day at midnight IST, not midnight UTC (edge case: time zone across midnight)', async () => {
    await addedAt('2026-11-05T18:29:59.000Z', ADMIN, 'Last second of 5 Nov');
    await addedAt('2026-11-05T18:30:00.000Z', ADMIN, 'First second of 6 Nov');
    expect(labels(await service.list({ limit: 50, from: '2026-11-05', to: '2026-11-05' }))).toEqual(['Last second of 5 Nov']);
    expect(labels(await service.list({ limit: 50, from: '2026-11-06', to: '2026-11-06' }))).toEqual(['First second of 6 Nov']);
    expect(startOfIstDay('2026-11-06').toISOString()).toBe('2026-11-05T18:30:00.000Z');
  });

  it('pages without a gap or a repeat: the cursor continues after the last entry, the total stays whole, the last page has no cursor', async () => {
    const first = await service.list({ limit: 3 });
    expect(labels(first)).toEqual(['Fourth Person', 'Third Person', 'Invented Person']);
    expect(first.total).toBe(4);
    const cursor = defined(decodeAuditCursor(defined(first.nextCursor)));
    expect(cursor.id).toBe(defined(first.entries[2]).id);
    const second = await service.list({ limit: 3, cursor });
    expect(labels(second)).toEqual(['First Person']);
    expect(second.total).toBe(4);
    expect(second.nextCursor).toBeNull();
  });

  it('pages through entries of the same millisecond by ID, so none is lost or shown twice', async () => {
    world.clock.set(new Date('2026-11-06T09:00:00.000Z'));
    await world.transactions.run(async (tx) => {
      for (const label of ['Same A', 'Same B', 'Same C', 'Same D']) {
        // The fake advances the clock by one millisecond for each append; setting it back keeps the four on one instant.
        world.clock.set(new Date('2026-11-06T08:59:59.999Z'));
        await service.record(tx, { event: 'user.created', actorId: ADMIN, requestId: REQUEST_ID, object: { id: PERSON, label }, before: null, after: { role: 'LEAD', isActive: true } });
      }
    });
    const seen: string[] = [];
    let cursor: ReturnType<typeof decodeAuditCursor> | undefined;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await service.list({ limit: 2, from: '2026-11-06', ...(cursor === undefined || cursor === null ? {} : { cursor }) });
      seen.push(...labels(page));
      if (page.nextCursor === null) break;
      cursor = decodeAuditCursor(page.nextCursor);
    }
    expect([...seen].sort()).toEqual(['Same A', 'Same B', 'Same C', 'Same D']);
    expect(new Set(seen).size).toBe(4);
  });

  it('answers an empty page with a zero total when nothing matches', async () => {
    expect(await service.list({ limit: 50, who: PERSON })).toEqual({ entries: [], total: 0, nextCursor: null });
  });

  it('shows an entry of an event it does not know with its name and no category, and an entry it cannot read as a dash', async () => {
    await world.transactions.run((tx) =>
      world.audit.append({ actorId: ADMIN, event: 'later.event', objectType: 'thing', objectId: PERSON, objectLabel: 'From A Newer Release', before: { a: 1 }, after: { b: 2 }, requestId: REQUEST_ID }, tx),
    );
    await world.transactions.run((tx) =>
      world.audit.append({ actorId: ADMIN, event: 'user.role_changed', objectType: 'user', objectId: PERSON, objectLabel: 'Damaged Row', before: { role: 'OWNER' }, after: null, requestId: REQUEST_ID }, tx),
    );
    const page = await service.list({ limit: 2 });
    expect(page.entries.map((entry) => [entry.objectLabel, entry.event, entry.category, entry.change])).toEqual([
      ['Damaged Row', 'user.role_changed', { id: 'user_change', label: 'User change' }, { before: '—', after: '—' }],
      ['From A Newer Release', 'later.event', null, { before: '—', after: '—' }],
    ]);
  });
});
