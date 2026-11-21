/**
 * The e-mail events and the keys that make each one happen once (STORY-09.01; architecture section 4.7 "Idempotency keys" and "Alert and non-alert events").
 *
 * One list, here, for every caller: the writers of the later stories (09.03 to 09.07) build their keys with these functions, and the worker's `outbox-send` job reads the same
 * lists, so an event is classed in one place. The module is plain TypeScript with no imports, so a test, a job and the web process can all use it.
 */

/** The alert events of FR-081 to FR-084: the ones the alerts switch (`settings.alerts_enabled`, FR-019) governs. */
export const ALERT_EVENTS = ['task-assigned', 'task-overdue', 'daily-digest', 'backup-missed'] as const;

/** The events the alerts switch does not govern: the reset link is the person's own request for access (ruling of 2026-11-18). */
export const NON_ALERT_EVENTS = ['password-reset'] as const;

export const MAIL_EVENTS = [...ALERT_EVENTS, ...NON_ALERT_EVENTS] as const;

export type AlertEvent = (typeof ALERT_EVENTS)[number];
export type MailEvent = (typeof MAIL_EVENTS)[number];

/**
 * The events whose body holds a secret while the row can still be sent. Today only the reset link. Such a body is emptied once the row is sent, finally failed or skipped
 * (architecture section 4.7), so a link lives in the database only while it can still be used.
 */
export const SECRET_BEARING_EVENTS = ['password-reset'] as const satisfies ReadonlyArray<MailEvent>;

export function isAlertEvent(event: string): event is AlertEvent {
  return ALERT_EVENTS.some((alert) => alert === event);
}

export function isMailEvent(event: string): event is MailEvent {
  return MAIL_EVENTS.some((known) => known === event);
}

export function holdsSecret(event: string): boolean {
  return SECRET_BEARING_EVENTS.some((secret) => secret === event);
}

/** A moment as it goes into a key: the UTC instant in ISO form, so the same moment always gives the same key. */
function instantKey(instant: Date): string {
  return instant.toISOString();
}

/** `task-assigned:<taskId>:` - what every revision's key of one task starts with (a task ID has no colon, so no other task's key starts with it). Not a key: it names a set of them (DEF-055). */
export const taskAssignedKeyPrefix = (taskId: string): string => `task-assigned:${taskId}:`;

/**
 * The idempotency keys (a unique index on `email_outbox.idempotency_key` enforces them). A changed deadline or a new assignment revision gives a new key, so a task that
 * becomes overdue again is reported again (architecture assumption A-09).
 */
export const idempotencyKeys = {
  /** `task-assigned:<taskId>:<assignmentRevision>` */
  taskAssigned: (taskId: string, assignmentRevision: number): string => `task-assigned:${taskId}:${assignmentRevision}`,
  /** `task-overdue:<taskId>:<deadlineAtUtc>` */
  taskOverdue: (taskId: string, deadlineAt: Date): string => `task-overdue:${taskId}:${instantKey(deadlineAt)}`,
  /** `digest:<engineerId>:<istDate>` (`istDate` is the day in Indian Standard Time, `YYYY-MM-DD`) */
  dailyDigest: (engineerId: string, istDate: string): string => `digest:${engineerId}:${istDate}`,
  /** `backup-missed:<istDate>` */
  backupMissed: (istDate: string): string => `backup-missed:${istDate}`,
  /** `password-reset:<tokenId>` */
  passwordReset: (tokenId: string): string => `password-reset:${tokenId}`,
} as const;
