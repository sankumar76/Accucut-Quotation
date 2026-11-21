import { idempotencyKeys, taskAssignedKeyPrefix } from '../../lib/mail/events';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import { MILLISECONDS_PER_HOUR, type Clock } from '../../lib/time';
import type { MailService } from '../mail/mail-service';
import { renderTaskAssigned } from '../mail/templates/task-assigned';
import type { EmailOutboxRepository, EnqueueResult } from '../repositories/email-outbox-repository';
import type { SettingsRepository } from '../repositories/settings-repository';
import type { Transaction } from '../repositories/transaction';

/**
 * The assignment e-mail (STORY-09.03; FR-081, BR-040, BR-041; architecture section 4.7). `enqueueTaskAssigned(tx, task, assigner)` writes one outbox row in the caller's own transaction,
 * so a task that rolls back sends nothing: the Engineer is the To, the assigner the Cc, and the key is `task-assigned:<taskId>:<assignmentRevision>`, so the same assignment queued twice
 * is one message and a reassign (a new revision) is a new one. It is a function the task service calls, not an event bus (architecture section 6, "Events").
 *
 *   - **Recipients come from `users` and nowhere else**: the Engineer and the assigner are read by the task service in the same transaction and passed in by ID. The row holds IDs, not
 *     addresses (NFR-028), and no address is ever taken from a request.
 *   - **Active is judged when the row is written** (decision D-5): an assigner who is not active is named in the message but not copied. The Engineer is an active Engineer by the
 *     time they get here (`findActiveEngineer`).
 *   - **The alerts switch** (BR-040) is read by `alertsEnabled()`; the caller writes nothing when it is off. A row written while it was on and not yet sent is skipped by the worker
 *     if the switch is turned off before it is claimed (STORY-09.01 AC-5).
 *   - **A row is written only where it can be sent, and only for a message that is still news** (DEF-055, AQP-385; D-c: a mail about an old event must not go out late). `queueingEnabled()` is
 *     the alerts switch **and** `FEATURE_EMAIL`: with it off the worker's mail jobs are not scheduled (`outbox-send.ts`), as the overdue, digest, backup and reset writers already do not write,
 *     so a row written then could only wait and go out in a burst the day e-mail is switched on. Every row carries `send_before` = 24 hours after it is written, so the worker skips it as
 *     `EXPIRED` after a long outage or a late switch-on. And `withdrawUnsent` gives the same expiry to the unsent rows of a task whose Engineer has just changed, so the old Engineer is not
 *     told of a task that is no longer theirs (a new revision is a new row, and the old one would stay due).
 *   - **No cost, rate, formula, customer or price can get in** (NFR-002): the template takes a fixed DTO and this file builds it from the task's own plain fields.
 */

/** The task as the message needs it: plain fields of the task, the Engineer by ID and name, and the revision the key is made from. */
export interface TaskMailTask {
  readonly id: string;
  readonly code: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly assignmentRevision: number;
  readonly engineer: { readonly id: string; readonly name: string };
}

/** How long an assignment e-mail stays worth sending: 24 hours after its row is written (DEF-055; the overdue e-mail's window is the same length). */
export const ASSIGNMENT_MAIL_WINDOW_MS = 24 * MILLISECONDS_PER_HOUR;

/** The Lead or the Admin who assigned the task, or who changed its Engineer. */
export interface TaskMailAssigner {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface TaskMail {
  /** Whether e-mail alerts are on right now (`settings.alerts_enabled`). The Lead cannot read Settings, so the assign context answers this one boolean from here. */
  alertsEnabled(): Promise<boolean>;
  /** Whether a row should be written now: the alerts switch is on **and** `FEATURE_EMAIL` is on, so a row is written only where the worker can send it (DEF-055). */
  queueingEnabled(): Promise<boolean>;
  /** Writes the assignment e-mail's outbox row in `tx`, to expire 24 hours after the clock's now. Call it only when `queueingEnabled()` says so. */
  enqueueTaskAssigned(tx: Transaction, task: TaskMailTask, assigner: TaskMailAssigner): Promise<EnqueueResult>;
  /** Expires, in `tx`, every assignment e-mail of this task that is not sent yet, a row the worker has claimed but not sent included (the Engineer changed). Done whatever the switches say: the row may date from when they were on. */
  withdrawUnsent(tx: Transaction, taskId: string): Promise<void>;
}

export interface TaskMailDependencies {
  readonly mail: Pick<MailService, 'enqueue'>;
  /** The one write of the outbox that does not go through the mail service, so it never builds the mail transport: expiring unsent rows (DEF-055). */
  readonly outbox: Pick<EmailOutboxRepository, 'expireUnsent'>;
  readonly settings: Pick<SettingsRepository, 'readAlertSettings'>;
  /** The validated `APP_ORIGIN` (scheme, host and port, no trailing slash), read when a message is built so nothing is loaded at import. */
  readonly appOrigin: () => string;
  /** The moment a row is written, so a test controls it and `send_before` is judged by the same kind of clock as the worker's. */
  readonly clock: Clock;
  /** `FEATURE_EMAIL` as this process reads it now (`loadEmailFeature`). */
  readonly emailEnabled: () => boolean;
}

/** The page of a task's estimate (SCR-05), as the queue links to it. */
const estimatePath = (code: string): string => `/estimates/${encodeURIComponent(code)}`;

export function createTaskMail({ mail, outbox, settings, appOrigin, clock, emailEnabled }: TaskMailDependencies): TaskMail {
  const alertsEnabled = async (): Promise<boolean> => (await settings.readAlertSettings()).alertsEnabled;
  return {
    alertsEnabled,

    // The cheaper question first: with `FEATURE_EMAIL` off the settings row is not read at all.
    queueingEnabled: async () => emailEnabled() && (await alertsEnabled()),

    enqueueTaskAssigned(tx, task, assigner) {
      const rendered = renderTaskAssigned({
        code: task.code,
        title: task.title,
        notes: task.notes,
        assignerName: assigner.name,
        folderPath: task.folderPath,
        folderUrl: folderUrlOf(task.folderPath),
        deadlineAt: task.deadlineAt,
        taskLink: `${appOrigin()}${estimatePath(task.code)}`,
      });
      return mail.enqueue(tx, {
        idempotencyKey: idempotencyKeys.taskAssigned(task.id, task.assignmentRevision),
        event: 'task-assigned',
        toUserId: task.engineer.id,
        ccUserIds: assigner.isActive ? [assigner.id] : [],
        subject: rendered.subject,
        bodyHtml: rendered.html,
        bodyText: rendered.text,
        sendBefore: new Date(clock.now().getTime() + ASSIGNMENT_MAIL_WINDOW_MS),
      });
    },

    async withdrawUnsent(tx, taskId) {
      await outbox.expireUnsent(tx, 'task-assigned', taskAssignedKeyPrefix(taskId), clock.now());
    },
  };
}
