import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';

import { ActiveAdminExistsError, ForbiddenError, NotFoundError, StepUpFailed, StepUpLocked } from '@/lib/errors';
import { systemClock } from '@/lib/time';
import { resolveSessionUser } from '@/server/auth/resolve-session-user';
import type { TransactionRunner } from '@/server/repositories/transaction';
import { createAdminHandoverService, type AdminHandoverService } from '@/server/services/admin-handover-service';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { createAuthService, type AuthService } from '@/server/services/auth-service';
import { createStepUpService } from '@/server/services/step-up-service';
import {
  ADMIN_CANNOT_BE_REMOVED_CODE,
  CANNOT_HAND_OVER_TO_SELF_CODE,
  HAND_OVER_TARGET_INACTIVE_CODE,
} from '@/lib/users/hand-over';

import { untilALockWaits, refusalOf } from '../../support/approval-helpers';
import { entryCount, KEY_SECRET, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { createHoldingRunner } from '../../support/hold-before-commit';
import { createLateFailingRunner } from '../../support/late-failure-runner';

/**
 * STORY-01.09 against real PostgreSQL in a throwaway database (AC-2 to AC-5, AC-7 to AC-9): the hand-over service over the real repositories, the real transaction runner and audit log, and the real step-up check
 * (STORY-06.14, its own throttle key), with the real (cheap) hasher. What only the database can prove: the swap is one transaction in which the Admin steps down first, so `uq_users_single_active_admin` is never broken
 * and no other session ever sees zero Admins or two (a second connection watches while the role goes back and forth); two requests at once queue on the caller's row, held open until the second is seen waiting in
 * `pg_locks`; a failure after the second change leaves both roles, both sessions and the log as they were. The user.admin_handed_over entry is written and read back here (`audit-database.test.ts` points at this file).
 * Every name, address and password is invented.
 */

const PASSWORD = 'invented-handover-password-1!';
const WRONG_PASSWORD = 'invented-wrong-password-9!';
const REQUEST_ID = 'req-0a0b0c0d';
const RACE_TIMEOUT_MILLISECONDS = 30_000;
const hasher = createTestHasher();

let db: AuditDatabase;
let auth: AuthService;
let service: AdminHandoverService;
let people = 0;

interface World {
  readonly admin: Person;
  readonly lead: Person;
  readonly engineer: Person;
  /** Deactivated: an Engineer who left. */
  readonly gone: Person;
}
interface Person {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** The context the route builds for the Admin: who, under what name, on which request. */
const by = (person: Person) => ({ actorId: person.id, actorLabel: person.name, requestId: REQUEST_ID });

function buildService(overrides: { readonly transactions?: TransactionRunner; readonly audit?: Pick<AuditDatabase['audit'], 'record'> } = {}): AdminHandoverService {
  return createAdminHandoverService({
    users: db.users,
    transactions: overrides.transactions ?? db.transactions,
    audit: overrides.audit ?? db.audit,
    stepUp: createStepUpService({ users: db.users, throttles: db.throttles, hasher, clock: systemClock, keySecret: KEY_SECRET }),
  });
}

async function insertPerson(label: string, role: 'ADMIN' | 'LEAD' | 'ENGINEER', isActive = true): Promise<Person> {
  people += 1;
  const name = `Invented ${label} ${people}`;
  const email = `${label}.${people}@example.test`;
  const { rows } = await db.owner.query<{ id: string }>(
    'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4::user_role, $5) RETURNING id',
    [name, email, await hasher.hash(PASSWORD), role, isActive],
  );
  return { id: defined(rows[0]).id, name, email };
}

/** A fresh Admin, Lead, Engineer and a deactivated Engineer. The database allows one active Admin, so whoever held the place in an earlier test steps down (as the owner, which writes no audit entry). */
async function newWorld(): Promise<World> {
  await db.owner.query("UPDATE users SET role = 'LEAD' WHERE role = 'ADMIN'");
  return {
    admin: await insertPerson('admin', 'ADMIN'),
    lead: await insertPerson('lead', 'LEAD'),
    engineer: await insertPerson('engineer', 'ENGINEER'),
    gone: await insertPerson('gone', 'ENGINEER', false),
  };
}

interface StoredPerson {
  readonly role: string;
  readonly is_active: boolean;
  readonly session_version: number;
  readonly password_hash: string;
  readonly must_change_password: boolean;
}

async function stored(person: Person): Promise<StoredPerson> {
  const { rows } = await db.owner.query<StoredPerson>('SELECT role, is_active, session_version, password_hash, must_change_password FROM users WHERE id = $1', [person.id]);
  return defined(rows[0]);
}

async function activeAdmins(): Promise<ReadonlyArray<string>> {
  const { rows } = await db.owner.query<{ id: string }>("SELECT id FROM users WHERE role = 'ADMIN' AND is_active");
  return rows.map((row) => row.id);
}

/** Every person of the world as the database holds them: what a refusal or a rolled-back swap must leave alone. */
async function storedWorld(world: World): Promise<ReadonlyArray<StoredPerson>> {
  const rows: StoredPerson[] = [];
  // One after the other: the owner's connection runs one statement at a time.
  for (const person of [world.admin, world.lead, world.engineer, world.gone]) rows.push(await stored(person));
  return rows;
}

async function handoverEntries(objectId: string) {
  const { rows } = await db.owner.query<{
    event: string;
    actor_id: string;
    actor_label: string;
    object_type: string;
    object_id: string;
    object_label: string;
    before: unknown;
    after: unknown;
    before_text: string;
    after_text: string;
    request_id: string;
    created_at: Date;
  }>(
    `SELECT event, actor_id::text, actor_label, object_type, object_id::text, object_label, before, after, before::text AS before_text, after::text AS after_text, request_id, created_at
     FROM audit_log WHERE event = 'user.admin_handed_over' AND object_id = $1::uuid`,
    [objectId],
  );
  return rows;
}

/** Entries about either person that are not the hand-over's: there must be none (one entry for one act, decision D-h). */
async function otherEntriesAbout(...people_: ReadonlyArray<Person>): Promise<number> {
  const { rows } = await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event <> 'user.admin_handed_over' AND object_id = ANY($1::uuid[])", [people_.map((one) => one.id)]);
  return defined(rows[0]).n;
}

function gate() {
  let release: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reachedHolding: () => void = () => undefined;
  const isHolding = new Promise<void>((resolve) => {
    reachedHolding = resolve;
  });
  return { hold, release, isHolding, reachedHolding };
}

beforeAll(async () => {
  db = await openAuditDatabase();
  auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock: systemClock, keySecret: KEY_SECRET });
  service = buildService();
  // The first query opens the pool's connections; doing it here keeps that cost out of the first test's time limit.
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

let world: World;
beforeEach(async () => {
  world = await newWorld();
});

describe('AC-3: the swap is one transaction and ends with exactly one Admin', () => {
  it.each([
    ['a Lead', () => world.lead, 'LEAD'],
    ['an Engineer', () => world.engineer, 'ENGINEER'],
  ])('hands the role to %s: they are the Admin, the old Admin is a Lead, both sessions are ended, no password or flag is touched', async (_name, targetOf) => {
    const target = targetOf();
    const before = [await stored(world.admin), await stored(target)];
    const oldSession = defined(await auth.authenticate({ email: world.admin.email, password: PASSWORD, ipAddress: null }));
    if (oldSession.status !== 'signed-in') throw new Error('expected a sign-in');
    const claims = { userId: oldSession.userId, sessionVersion: oldSession.sessionVersion, signedAt: Math.floor(Date.now() / 1000) };
    expect((await resolveSessionUser(claims, db.users, new Date()))?.role).toBe('ADMIN');

    await service.handOver(by(world.admin), target.id, PASSWORD);

    expect(await activeAdmins()).toEqual([target.id]);
    expect(await stored(world.admin)).toEqual({ ...defined(before[0]), role: 'LEAD', session_version: defined(before[0]).session_version + 1 });
    expect(await stored(target)).toEqual({ ...defined(before[1]), role: 'ADMIN', session_version: defined(before[1]).session_version + 1 });
    // The old Admin is signed out: the session they held is refused. Signing in again gives a Lead; the new Admin signs in and holds the role.
    expect(await resolveSessionUser(claims, db.users, new Date())).toBeNull();
    expect((await db.users.findAccountById(world.admin.id))?.role).toBe('LEAD');
    const fresh = defined(await auth.authenticate({ email: target.email, password: PASSWORD, ipAddress: null }));
    if (fresh.status !== 'signed-in') throw new Error('expected a sign-in');
    const freshClaims = { userId: fresh.userId, sessionVersion: fresh.sessionVersion, signedAt: Math.floor(Date.now() / 1000) };
    expect((await resolveSessionUser(freshClaims, db.users, new Date()))?.role).toBe('ADMIN');
  });

  it('the new Admin can hand the role back, and the old one is the Admin again (no undo is needed: it is the same act)', async () => {
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    await service.handOver(by(world.lead), world.admin.id, PASSWORD);
    expect(await activeAdmins()).toEqual([world.admin.id]);
    expect((await stored(world.lead)).role).toBe('LEAD');
  });

  it('nobody else is touched: the other people keep their role and their sessions', async () => {
    const bystanders = [await stored(world.engineer), await stored(world.gone)];
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    expect([await stored(world.engineer), await stored(world.gone)]).toEqual(bystanders);
  });

  it('no other session sees zero Admins or two while the role goes back and forth (the Admin steps down and the other steps up in one commit)', async () => {
    const watcher = new Client({ connectionString: db.database.runtimeUrl });
    await watcher.connect();
    const samples: number[] = [];
    let watching = true;
    const watch = (async () => {
      while (watching) {
        const { rows } = await watcher.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role = 'ADMIN' AND is_active");
        samples.push(defined(rows[0]).n);
      }
    })();
    try {
      let holder = world.admin;
      let other = world.lead;
      for (let swap = 0; swap < 12; swap += 1) {
        await service.handOver(by(holder), other.id, PASSWORD);
        [holder, other] = [other, holder];
      }
    } finally {
      watching = false;
      await watch;
      await watcher.end();
    }
    expect(samples.length).toBeGreaterThan(12);
    expect(new Set(samples)).toEqual(new Set([1]));
    expect(await activeAdmins()).toHaveLength(1);
  }, RACE_TIMEOUT_MILLISECONDS);

  it('the database refuses a second Admin even if the swap is done in the wrong order (direct SQL: up before down fails on the index)', async () => {
    await db.owner.query('BEGIN');
    try {
      await expect(db.owner.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [world.lead.id])).rejects.toThrow('uq_users_single_active_admin');
    } finally {
      await db.owner.query('ROLLBACK');
    }
    expect(await activeAdmins()).toEqual([world.admin.id]);
  });
});

describe('AC-2: the step-up: a wrong password or a block changes nothing', () => {
  it('a wrong password is 422 STEP_UP_FAILED, nothing in the database or the log moves, and the right password then works in the same service', async () => {
    const before = await storedWorld(world);
    const entries = await entryCount(db);
    await expect(service.handOver(by(world.admin), world.lead.id, WRONG_PASSWORD)).rejects.toBeInstanceOf(StepUpFailed);
    expect(await storedWorld(world)).toEqual(before);
    expect(await entryCount(db)).toBe(entries);
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    expect(await activeAdmins()).toEqual([world.lead.id]);
  });

  it('five wrong passwords block the step-up: the sixth try, even with the right password, is 429 STEP_UP_LOCKED, and sign-in is not blocked (its own key)', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await expect(service.handOver(by(world.admin), world.lead.id, WRONG_PASSWORD)).rejects.toBeInstanceOf(StepUpFailed);
    const before = await storedWorld(world);
    await expect(service.handOver(by(world.admin), world.lead.id, PASSWORD)).rejects.toBeInstanceOf(StepUpLocked);
    expect(await storedWorld(world)).toEqual(before);
    expect((await auth.authenticate({ email: world.admin.email, password: PASSWORD, ipAddress: null })).status).toBe('signed-in');
  });
});

describe('AC-4: exactly one audit entry, in the same transaction, with no secret', () => {
  it('writes user.admin_handed_over once: the old Admin is the actor, both people are named by ID and name at the time, and nothing about either person is recorded as a role change', async () => {
    await service.handOver(by(world.admin), world.engineer.id, PASSWORD);
    const entries = await handoverEntries(world.engineer.id);
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    expect(entry).toMatchObject({
      actor_id: world.admin.id,
      actor_label: world.admin.name,
      object_type: 'user',
      object_id: world.engineer.id,
      object_label: world.engineer.name,
      before: { adminId: world.admin.id, adminName: world.admin.name },
      after: { adminId: world.engineer.id, adminName: world.engineer.name },
      request_id: REQUEST_ID,
    });
    expect(Math.abs(Date.now() - entry.created_at.getTime())).toBeLessThan(60_000);
    expect(await otherEntriesAbout(world.admin, world.engineer)).toBe(0);
  });

  it('the screen reads it in the style of SCR-16: "Admin was ..." to "Admin is now ..."', async () => {
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    const page = await db.audit.list({ event: 'user.admin_handed_over', limit: 10 });
    const mine = defined(page.entries.find((entry) => entry.objectLabel === world.lead.name));
    expect(mine).toMatchObject({
      who: world.admin.name,
      event: 'user.admin_handed_over',
      category: { label: 'User change' },
      change: { before: `Admin was ${world.admin.name}`, after: `Admin is now ${world.lead.name}` },
    });
  });

  it('no stored entry holds a password, a hash or a key that names one', async () => {
    await expect(service.handOver(by(world.admin), world.lead.id, WRONG_PASSWORD)).rejects.toBeInstanceOf(StepUpFailed);
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    const entry = defined((await handoverEntries(world.lead.id))[0]);
    const text = `${entry.before_text} ${entry.after_text}`;
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(WRONG_PASSWORD);
    expect(text).not.toContain('$argon2');
    expect(text.toLowerCase()).not.toMatch(/password|hash|token|secret/);
    const { rows } = await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE before::text LIKE ANY($1) OR after::text LIKE ANY($1)", [[`%${PASSWORD}%`, `%${WRONG_PASSWORD}%`, '%argon2%']]);
    expect(defined(rows[0]).n).toBe(0);
  });
});

describe('AC-5: refusals leave everything as it was', () => {
  it.each([
    ['the caller', () => world.admin.id, CANNOT_HAND_OVER_TO_SELF_CODE],
    ['the caller in capitals', () => world.admin.id.toUpperCase(), CANNOT_HAND_OVER_TO_SELF_CODE],
    ['a deactivated person', () => world.gone.id, HAND_OVER_TARGET_INACTIVE_CODE],
  ])('%s: 409, nothing changes, no entry', async (_name, target, code) => {
    const before = await storedWorld(world);
    const entries = await entryCount(db);
    await expect(service.handOver(by(world.admin), target(), PASSWORD)).rejects.toMatchObject({ httpStatus: 409, code });
    expect(await storedWorld(world)).toEqual(before);
    expect(await entryCount(db)).toBe(entries);
    expect(await activeAdmins()).toEqual([world.admin.id]);
  });

  it('an unknown ID is 404, and the Admin stays the Admin', async () => {
    const before = await storedWorld(world);
    await expect(service.handOver(by(world.admin), '00000000-0000-4000-8000-0000000000ff', PASSWORD)).rejects.toBeInstanceOf(NotFoundError);
    expect(await storedWorld(world)).toEqual(before);
  });

  it('a caller who is not the Admin (a Lead whose request got through) hands over nothing: 403, nothing changes', async () => {
    const before = await storedWorld(world);
    await expect(service.handOver(by(world.lead), world.engineer.id, PASSWORD)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await storedWorld(world)).toEqual(before);
    expect(await activeAdmins()).toEqual([world.admin.id]);
  });
});

describe('AC-7: two requests at once, and a hand-over racing an edit: never more than one active Admin', () => {
  it('two hand-overs by the Admin that overlap: the second waits for the first (seen waiting in pg_locks), then is refused because the caller is no longer the Admin; one swap, one entry', async () => {
    const holding = gate();
    const first = refusalOf(buildService({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).handOver(by(world.admin), world.lead.id, PASSWORD));
    let second: Promise<unknown> | undefined;
    let secondDone = false;
    try {
      await Promise.race([holding.isHolding, first]);
      second = refusalOf(service.handOver(by(world.admin), world.engineer.id, PASSWORD)).finally(() => {
        secondDone = true;
      });
      // The second is seen waiting for a lock the first holds, so the two did overlap; it has not answered.
      await untilALockWaits(db);
      expect(secondDone, 'the second hand-over did not wait for the first').toBe(false);
      holding.release();
    } finally {
      holding.release();
    }
    expect(await first).toBeUndefined();
    expect(await second).toBeInstanceOf(ForbiddenError);
    expect(await activeAdmins()).toEqual([world.lead.id]);
    expect((await stored(world.engineer)).role).toBe('ENGINEER');
    expect(await handoverEntries(world.lead.id)).toHaveLength(1);
    expect(await handoverEntries(world.engineer.id)).toHaveLength(0);
  }, RACE_TIMEOUT_MILLISECONDS);

  it('several hand-overs at once to different people: exactly one wins, the others are refused, and one Admin and one entry remain', async () => {
    const extra = [await insertPerson('extra', 'LEAD'), await insertPerson('extra', 'ENGINEER')];
    const targets = [world.lead, world.engineer, ...extra];
    const outcomes = await Promise.allSettled(targets.map((target) => service.handOver(by(world.admin), target.id, PASSWORD)));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    for (const outcome of outcomes) if (outcome.status === 'rejected') expect(outcome.reason).toBeInstanceOf(ForbiddenError);
    const admins = await activeAdmins();
    expect(admins).toHaveLength(1);
    expect(targets.map((target) => target.id)).toContain(defined(admins[0]));
    const { rows } = await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event = 'user.admin_handed_over' AND actor_id = $1::uuid", [world.admin.id]);
    expect(defined(rows[0]).n).toBe(1);
  }, RACE_TIMEOUT_MILLISECONDS);

  it('an edit that deactivates, or demotes, the person the hand-over is giving the role to waits for the lock, then is refused 409: the portal is not left without an Admin', async () => {
    const holding = gate();
    const handover = refusalOf(buildService({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).handOver(by(world.admin), world.lead.id, PASSWORD));
    let edits: Promise<ReadonlyArray<unknown>> | undefined;
    try {
      await Promise.race([holding.isHolding, handover]);
      // The old Admin's own requests, begun before the hand-over was seen, which the role check let through.
      edits = Promise.all([
        refusalOf(db.userService.update(by(world.admin), world.lead.id, { isActive: false })),
        refusalOf(db.userService.update(by(world.admin), world.lead.id, { role: 'ENGINEER' })),
      ]);
      await untilALockWaits(db);
      holding.release();
    } finally {
      holding.release();
    }
    expect(await handover).toBeUndefined();
    for (const refusal of await defined(edits)) expect(refusal).toMatchObject({ httpStatus: 409, code: ADMIN_CANNOT_BE_REMOVED_CODE });
    expect(await activeAdmins()).toEqual([world.lead.id]);
    expect(await stored(world.lead)).toMatchObject({ role: 'ADMIN', is_active: true });
  }, RACE_TIMEOUT_MILLISECONDS);

  it('an edit that makes someone else the Admin while a hand-over is open, or activates an old Admin, is the one-Admin refusal (the index and the check), and the hand-over still lands', async () => {
    const formerAdmin = await insertPerson('former', 'ADMIN', false);
    const holding = gate();
    const handover = refusalOf(buildService({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).handOver(by(world.admin), world.lead.id, PASSWORD));
    let refusals: ReadonlyArray<unknown> = [];
    try {
      await Promise.race([holding.isHolding, handover]);
      refusals = await Promise.all([
        refusalOf(db.userService.update(by(world.admin), world.engineer.id, { role: 'ADMIN' })),
        refusalOf(db.userService.update(by(world.admin), formerAdmin.id, { isActive: true })),
      ]);
      holding.release();
    } finally {
      holding.release();
    }
    expect(await handover).toBeUndefined();
    for (const refusal of refusals) expect(refusal).toBeInstanceOf(ActiveAdminExistsError);
    expect(await activeAdmins()).toEqual([world.lead.id]);
  }, RACE_TIMEOUT_MILLISECONDS);
});

describe('AC-8: a failure after the first role change and before the commit leaves everything as it was', () => {
  it('a fault after the last step: both roles, both session counters and the log are unchanged, and the same hand-over then works', async () => {
    const failure = new Error('invented failure after the last step');
    const failing = buildService({ transactions: createLateFailingRunner(db.transactions, failure) });
    const before = await storedWorld(world);
    const entries = await entryCount(db);
    await expect(failing.handOver(by(world.admin), world.lead.id, PASSWORD)).rejects.toBe(failure);
    expect(await storedWorld(world)).toEqual(before);
    expect(await entryCount(db)).toBe(entries);
    expect(await activeAdmins()).toEqual([world.admin.id]);
    // Control: the swap itself was a real one, which went through when nothing failed.
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    expect(await activeAdmins()).toEqual([world.lead.id]);
  });

  it('an audit entry that is refused takes both role changes back (no half done: the Admin is not left a Lead with nobody the Admin)', async () => {
    const failing = buildService({ audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')) } });
    const before = await storedWorld(world);
    await expect(failing.handOver(by(world.admin), world.lead.id, PASSWORD)).rejects.toBeInstanceOf(AuditEntryRefusedError);
    expect(await storedWorld(world)).toEqual(before);
    expect(await activeAdmins()).toEqual([world.admin.id]);
  });
});

describe('AC-9: the password is nowhere it should not be', () => {
  it('after a good hand-over, a wrong password and a failed one, no refusal message holds either password', async () => {
    const refusals = [
      await refusalOf(service.handOver(by(world.admin), world.lead.id, WRONG_PASSWORD)),
      await refusalOf(service.handOver(by(world.admin), world.admin.id, PASSWORD)),
      await refusalOf(buildService({ audit: { record: () => Promise.reject(new Error('invented audit failure')) } }).handOver(by(world.admin), world.lead.id, PASSWORD)),
    ];
    await service.handOver(by(world.admin), world.lead.id, PASSWORD);
    for (const refusal of refusals) {
      const text = JSON.stringify(refusal, Object.getOwnPropertyNames(refusal));
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toContain(WRONG_PASSWORD);
    }
  });
});
