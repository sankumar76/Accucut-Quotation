import { describe, expect, it } from 'vitest';

import { ALERT_EVENTS, holdsSecret, idempotencyKeys, isAlertEvent, isMailEvent, MAIL_EVENTS, NON_ALERT_EVENTS } from '@/lib/mail/events';

/**
 * STORY-09.01 AC-2 and AC-5 (architecture section 4.7): the event list lives once, in `src/lib/mail/events.ts`; the alerts switch governs exactly the four alert events and not
 * the reset link; the idempotency keys have the documented shapes, so a re-run of a job or a changed deadline behaves as the architecture says.
 */

describe('the event list (AC-5)', () => {
  it('AC-5: the alert events are exactly task-assigned, task-overdue, daily-digest and backup-missed', () => {
    expect([...ALERT_EVENTS]).toEqual(['task-assigned', 'task-overdue', 'daily-digest', 'backup-missed']);
  });

  it('AC-5: password-reset is the one non-alert event, and it is the one that holds a secret', () => {
    expect([...NON_ALERT_EVENTS]).toEqual(['password-reset']);
    expect(holdsSecret('password-reset')).toBe(true);
    for (const event of ALERT_EVENTS) expect(holdsSecret(event), event).toBe(false);
  });

  it('AC-5: isAlertEvent is true for the four alert events only', () => {
    for (const event of ALERT_EVENTS) expect(isAlertEvent(event), event).toBe(true);
    expect(isAlertEvent('password-reset')).toBe(false);
    expect(isAlertEvent('something-else')).toBe(false);
  });

  it('every event is known, and nothing else is', () => {
    for (const event of MAIL_EVENTS) expect(isMailEvent(event), event).toBe(true);
    expect(isMailEvent('daily_digest')).toBe(false);
  });
});

describe('the idempotency keys (AC-2, architecture section 4.7)', () => {
  const task = '3f0c2a4e-1b7d-4a55-9a43-0f2d6f6f1a01';
  const engineer = '9d1e5b0c-7a3f-4c2d-8e61-5b2a4f7c9d02';

  it('AC-2: each key has the shape of the architecture', () => {
    expect(idempotencyKeys.taskAssigned(task, 3)).toBe(`task-assigned:${task}:3`);
    expect(idempotencyKeys.taskOverdue(task, new Date('2026-11-20T10:30:00.000Z'))).toBe(`task-overdue:${task}:2026-11-20T10:30:00.000Z`);
    expect(idempotencyKeys.dailyDigest(engineer, '2026-11-18')).toBe(`digest:${engineer}:2026-11-18`);
    expect(idempotencyKeys.backupMissed('2026-11-18')).toBe('backup-missed:2026-11-18');
    expect(idempotencyKeys.passwordReset('b7c4')).toBe('password-reset:b7c4');
  });

  it('AC-2: the same moment gives the same key, whatever time zone the Date was made in, and a changed deadline gives a new one (A-09)', () => {
    const first = idempotencyKeys.taskOverdue(task, new Date('2026-11-20T16:00:00+05:30'));
    expect(first).toBe(idempotencyKeys.taskOverdue(task, new Date('2026-11-20T10:30:00Z')));
    expect(first).not.toBe(idempotencyKeys.taskOverdue(task, new Date('2026-11-21T10:30:00Z')));
  });

  it('a new assignment revision of the same task gives a new key', () => {
    expect(idempotencyKeys.taskAssigned(task, 1)).not.toBe(idempotencyKeys.taskAssigned(task, 2));
  });
});
