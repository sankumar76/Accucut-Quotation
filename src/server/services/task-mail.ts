import { idempotencyKeys } from '../../lib/mail/events';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import type { MailService } from '../mail/mail-service';
import { renderTaskAssigned } from '../mail/templates/task-assigned';
import type { EnqueueResult } from '../repositories/email-outbox-repository';
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

/** The Lead or the Admin who assigned the task, or who changed its Engineer. */
export interface TaskMailAssigner {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface TaskMail {
  /** Whether e-mail alerts are on right now (`settings.alerts_enabled`). The Lead cannot read Settings, so the assign context answers this one boolean from here. */
  alertsEnabled(): Promise<boolean>;
  /** Writes the assignment e-mail's outbox row in `tx`. Call it only when alerts are on. */
  enqueueTaskAssigned(tx: Transaction, task: TaskMailTask, assigner: TaskMailAssigner): Promise<EnqueueResult>;
}

export interface TaskMailDependencies {
  readonly mail: Pick<MailService, 'enqueue'>;
  readonly settings: Pick<SettingsRepository, 'readAlertSettings'>;
  /** The validated `APP_ORIGIN` (scheme, host and port, no trailing slash), read when a message is built so nothing is loaded at import. */
  readonly appOrigin: () => string;
}

/** The page of a task's estimate (SCR-05), as the queue links to it. */
const estimatePath = (code: string): string => `/estimates/${encodeURIComponent(code)}`;

export function createTaskMail({ mail, settings, appOrigin }: TaskMailDependencies): TaskMail {
  return {
    alertsEnabled: async () => (await settings.readAlertSettings()).alertsEnabled,

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
      });
    },
  };
}
