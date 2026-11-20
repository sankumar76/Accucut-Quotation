import { describe, expect, it } from 'vitest';

import { createTaskMail, type TaskMailTask } from '@/server/services/task-mail';
import { createTransactionHandle } from '@/server/repositories/transaction';
import type { OutboxMessage } from '@/server/repositories/email-outbox-repository';

import { createFakeSettingsRepository } from '../../support/fake-settings';

/**
 * STORY-09.03 AC-1, AC-5, AC-7: `enqueueTaskAssigned` builds one outbox message for the Engineer, copying the assigner, with the key `task-assigned:<taskId>:<revision>`, and writes it
 * through the shared mail service in the caller's own transaction. Whether a person is active is judged here, when the row is written (decision D-5). The row is queued with user IDs and
 * never with an address (NFR-028). Every name, ID and address is invented.
 */

const ENGINEER = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun' };
const BOSS = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Boss', isActive: true };
const ORIGIN = 'https://portal.example.com';

const task = (overrides: Partial<TaskMailTask> = {}): TaskMailTask => ({
  id: '00000000-0000-4000-8000-0000000000f1',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  notes: 'Sheet-metal parts only.',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-123',
  deadlineAt: new Date('2026-11-06T18:00:00.000Z'),
  assignmentRevision: 1,
  engineer: ENGINEER,
  ...overrides,
});

function setUp(alertsEnabled = true) {
  const queued: Array<{ readonly tx: unknown; readonly message: OutboxMessage }> = [];
  const mail = createTaskMail({
    mail: {
      enqueue: (tx, message) => {
        queued.push({ tx, message });
        return Promise.resolve('queued' as const);
      },
    },
    settings: createFakeSettingsRepository({ alertsEnabled, senderName: 'Invented Portal', senderAddress: 'portal@example.com' }),
    appOrigin: () => ORIGIN,
  });
  return { mail, queued };
}

describe('AC-1: one row for the Engineer, the assigner copied, keyed by task and revision', () => {
  it('queues a task-assigned row in the caller\'s transaction: To the Engineer, Cc the assigner, key revision 1, subject and both bodies', async () => {
    const { mail, queued } = setUp();
    const tx = createTransactionHandle();
    await expect(mail.enqueueTaskAssigned(tx, task(), BOSS)).resolves.toBe('queued');
    expect(queued).toHaveLength(1);
    const { message, tx: usedTx } = queued[0] ?? { message: undefined, tx: undefined };
    expect(usedTx).toBe(tx);
    expect(message).toMatchObject({
      event: 'task-assigned',
      idempotencyKey: 'task-assigned:00000000-0000-4000-8000-0000000000f1:1',
      toUserId: ENGINEER.id,
      ccUserIds: [BOSS.id],
      subject: 'Task assigned: Q-2026-0042',
    });
    expect(message?.bodyHtml).toContain('Q-2026-0042');
    expect(message?.bodyText).toContain('Q-2026-0042');
    expect(message?.bodyText).toContain('Assigned by: Invented Boss');
    expect(message?.bodyText).toContain('06 Nov 2026, 23:30 IST');
  });

  it('builds the link to the task from the origin: a full address to the estimate by code', async () => {
    const { mail, queued } = setUp();
    await mail.enqueueTaskAssigned(createTransactionHandle(), task(), BOSS);
    expect(queued[0]?.message.bodyText).toContain('Open the task: https://portal.example.com/estimates/Q-2026-0042');
    expect(queued[0]?.message.bodyHtml).toContain('href="https://portal.example.com/estimates/Q-2026-0042"');
  });

  it('puts the folder path and the file: link in the message', async () => {
    const { mail, queued } = setUp();
    await mail.enqueueTaskAssigned(createTransactionHandle(), task(), BOSS);
    expect(queued[0]?.message.bodyText).toContain('\\\\invented-server\\invented-share\\RFQ-123');
    expect(queued[0]?.message.bodyText).toContain('file:////invented-server/invented-share/RFQ-123');
  });

  it('adds nothing to the row but the fixed fields of the outbox message', async () => {
    const { mail, queued } = setUp();
    await mail.enqueueTaskAssigned(createTransactionHandle(), task(), BOSS);
    expect(Object.keys(queued[0]?.message ?? {}).sort()).toEqual(['bodyHtml', 'bodyText', 'ccUserIds', 'event', 'idempotencyKey', 'subject', 'toUserId']);
  });

  it('answers what the outbox answered, so the same key twice is one row ("already-queued")', async () => {
    const mail = createTaskMail({
      mail: { enqueue: () => Promise.resolve('already-queued' as const) },
      settings: createFakeSettingsRepository({ alertsEnabled: true, senderName: '', senderAddress: '' }),
      appOrigin: () => ORIGIN,
    });
    await expect(mail.enqueueTaskAssigned(createTransactionHandle(), task(), BOSS)).resolves.toBe('already-queued');
  });
});

describe('AC-5: who is copied, judged when the row is written (D-5)', () => {
  it('copies the Admin like a Lead: the Cc is whoever assigned, by ID', async () => {
    const { mail, queued } = setUp();
    const admin = { id: '00000000-0000-4000-8000-0000000000a3', name: 'Invented Admin', isActive: true };
    await mail.enqueueTaskAssigned(createTransactionHandle(), task(), admin);
    expect(queued[0]?.message.ccUserIds).toEqual([admin.id]);
    expect(queued[0]?.message.bodyText).toContain('Assigned by: Invented Admin');
  });

  it('does not copy an assigner who is not active when the row is written, but still names them', async () => {
    const { mail, queued } = setUp();
    await mail.enqueueTaskAssigned(createTransactionHandle(), task(), { ...BOSS, isActive: false });
    expect(queued[0]?.message.ccUserIds).toEqual([]);
    expect(queued[0]?.message.bodyText).toContain('Assigned by: Invented Boss');
  });
});

describe('AC-7: a reassign is the same message with the new revision', () => {
  it('keys the row task-assigned:<taskId>:2 for revision 2, To the new Engineer, Cc the person who made the change', async () => {
    const { mail, queued } = setUp();
    const meera = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Meera' };
    const otherLead = { id: '00000000-0000-4000-8000-0000000000b2', name: 'Invented Other Lead', isActive: true };
    await mail.enqueueTaskAssigned(createTransactionHandle(), task({ assignmentRevision: 2, engineer: meera }), otherLead);
    expect(queued[0]?.message).toMatchObject({
      idempotencyKey: 'task-assigned:00000000-0000-4000-8000-0000000000f1:2',
      toUserId: meera.id,
      ccUserIds: [otherLead.id],
    });
    expect(queued[0]?.message.bodyText).toContain('Assigned by: Invented Other Lead');
  });
});

describe('AC-4 (BR-040): the alerts switch', () => {
  it('says whether alerts are on, from the settings row at the moment it is asked', async () => {
    const settings = createFakeSettingsRepository({ alertsEnabled: false, senderName: '', senderAddress: '' });
    const mail = createTaskMail({ mail: { enqueue: () => Promise.resolve('queued' as const) }, settings, appOrigin: () => ORIGIN });
    await expect(mail.alertsEnabled()).resolves.toBe(false);
    settings.current = { ...settings.current, alertsEnabled: true };
    await expect(mail.alertsEnabled()).resolves.toBe(true);
  });
});
