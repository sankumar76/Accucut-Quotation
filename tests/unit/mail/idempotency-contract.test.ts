import { describe, expect, it } from 'vitest';

import { idempotencyKeys, MAIL_EVENTS } from '@/lib/mail/events';

/**
 * STORY-09.06 AC-3, the contract of the key builders: `src/lib/mail/events.ts` lists every builder, and each one is (a) stable across runs, so a producer that runs twice builds the same key
 * and the outbox's unique index queues one row, and (b) unique per event, so two different events can never collide on one key and swallow each other. The list of builders below is written out
 * here on purpose: a builder added to `idempotencyKeys` without an entry fails the first test, so a new e-mail event cannot go in without this contract being extended.
 */

const TASK = '11111111-1111-4111-8111-111111111111';
const ENGINEER = '22222222-2222-4222-8222-222222222222';
const DEADLINE = new Date('2026-11-20T10:30:00.000Z');

/** Every builder, with one set of arguments, the same set rebuilt (a "second run"), and a different set that must give a different key. */
const BUILDERS = {
  taskAssigned: { event: 'task-assigned', prefix: 'task-assigned:', build: () => idempotencyKeys.taskAssigned(TASK, 2), other: () => idempotencyKeys.taskAssigned(TASK, 3) },
  taskOverdue: { event: 'task-overdue', prefix: 'task-overdue:', build: () => idempotencyKeys.taskOverdue(TASK, new Date(DEADLINE)), other: () => idempotencyKeys.taskOverdue(TASK, new Date('2026-11-21T10:30:00.000Z')) },
  dailyDigest: { event: 'daily-digest', prefix: 'digest:', build: () => idempotencyKeys.dailyDigest(ENGINEER, '2026-11-20'), other: () => idempotencyKeys.dailyDigest(ENGINEER, '2026-11-21') },
  backupMissed: { event: 'backup-missed', prefix: 'backup-missed:', build: () => idempotencyKeys.backupMissed('2026-11-20'), other: () => idempotencyKeys.backupMissed('2026-11-21') },
  passwordReset: { event: 'password-reset', prefix: 'password-reset:', build: () => idempotencyKeys.passwordReset('token-1'), other: () => idempotencyKeys.passwordReset('token-2') },
} as const;

describe('the key builders (AC-3)', () => {
  it('AC-3: the list in this test is every builder of events.ts, one per mail event', () => {
    expect(Object.keys(idempotencyKeys).sort()).toEqual(Object.keys(BUILDERS).sort());
    expect(Object.values(BUILDERS).map((entry) => entry.event).sort()).toEqual([...MAIL_EVENTS].sort());
  });

  it.each(Object.entries(BUILDERS))('AC-3: %s is stable across runs (the same event gives the same key, however often it is built)', (_name, entry) => {
    const keys = new Set([entry.build(), entry.build(), entry.build()]);
    expect(keys.size).toBe(1);
  });

  it.each(Object.entries(BUILDERS))('AC-3: %s gives a different key for a different event instance (a new revision, deadline, day or token)', (_name, entry) => {
    expect(entry.other()).not.toBe(entry.build());
  });

  it('AC-3: each key starts with its own event\'s prefix and no other, so keys of two events never collide', () => {
    for (const [, entry] of Object.entries(BUILDERS)) {
      expect(entry.build().startsWith(entry.prefix)).toBe(true);
      for (const [, rival] of Object.entries(BUILDERS)) {
        if (rival !== entry) expect(entry.build().startsWith(rival.prefix)).toBe(false);
      }
    }
    const everyKey = Object.values(BUILDERS).flatMap((entry) => [entry.build(), entry.other()]);
    expect(new Set(everyKey).size).toBe(everyKey.length);
  });

  it('AC-3: a key holds no address, no name and no subject: ids, dates and counters only', () => {
    for (const entry of Object.values(BUILDERS)) expect(entry.build()).not.toMatch(/@|\s/);
  });
});
