import { describe, expect, it, vi } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { createMailService } from '@/server/mail/mail-service';
import type { Mailer, OutgoingMail } from '@/server/mail/send';
import type { EmailOutboxRepository, OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createTransactionHandle } from '@/server/repositories/transaction';

/**
 * STORY-09.01 AC-8 (`sendNow`) and the `enqueue` hand-over of AC-2: the service reads the sender from `settings` at send time, sends through the one mailer, and answers
 * `{ ok }` or `{ ok: false, code }`; it never throws. The database half of `enqueue` (the unique key, the rollback) is tested against PostgreSQL in `tests/integration/mail`.
 */

const NOW = new Date('2026-11-18T10:00:00.000Z');
const direct = { to: 'admin@example.com', subject: 'Test e-mail', bodyHtml: '<p>Hello</p>', bodyText: 'Hello' };

function harness(settings = { alertsEnabled: false, senderName: 'Accucut Portal', senderMailbox: 'portal@example.com' }) {
  const sent: Array<{ mail: OutgoingMail; sender: { name: string; mailbox: string } }> = [];
  const mailer: Mailer = {
    send: (mail, sender) => {
      sent.push({ mail, sender });
      return Promise.resolve({ ok: true });
    },
  };
  const enqueue = vi.fn<EmailOutboxRepository['enqueue']>(() => Promise.resolve('queued'));
  const readMailSettings = vi.fn<EmailOutboxRepository['readMailSettings']>(() => Promise.resolve(settings));
  const service = createMailService({ outbox: { enqueue, readMailSettings }, mailer, clock: createFixedClock(NOW) });
  return { service, sent, enqueue, readMailSettings, mailer };
}

describe('sendNow (AC-8)', () => {
  it('AC-8: sends at once through the mailer, From the settings sender read now, and answers ok', async () => {
    const { service, sent, readMailSettings } = harness();
    expect(await service.sendNow(direct)).toEqual({ ok: true });
    expect(readMailSettings).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([{ mail: { to: 'admin@example.com', cc: [], subject: 'Test e-mail', html: '<p>Hello</p>', text: 'Hello' }, sender: { name: 'Accucut Portal', mailbox: 'portal@example.com' } }]);
  });

  it('AC-8: is not gated by the alerts switch (the test e-mail proves the mailbox before alerts are on)', async () => {
    const { service } = harness({ alertsEnabled: false, senderName: '', senderMailbox: 'portal@example.com' });
    expect(await service.sendNow(direct)).toEqual({ ok: true });
  });

  it('AC-8: passes the mailer\'s failure code on: { ok: false, code }', async () => {
    const { enqueue, readMailSettings } = harness();
    const mailer: Mailer = { send: () => Promise.resolve({ ok: false, code: 'SENDER_NOT_ALLOWED' }) };
    const service = createMailService({ outbox: { enqueue, readMailSettings }, mailer, clock: createFixedClock(NOW) });
    expect(await service.sendNow(direct)).toEqual({ ok: false, code: 'SENDER_NOT_ALLOWED' });
  });

  it.each([
    ['an address that is not one', { ...direct, to: 'not-an-address' }],
    ['a subject with a line break (a header injection)', { ...direct, subject: 'Hi\r\nBcc: someone@example.com' }],
    ['an empty subject', { ...direct, subject: '' }],
    ['an empty body', { ...direct, bodyText: '' }],
  ])('AC-8: %s is refused with UNKNOWN, and nothing is sent', async (_name, message) => {
    const { service, sent, readMailSettings } = harness();
    expect(await service.sendNow(message)).toEqual({ ok: false, code: 'UNKNOWN' });
    expect(sent).toEqual([]);
    expect(readMailSettings).not.toHaveBeenCalled();
  });

  it('AC-8: a settings read that fails is { ok: false, code: UNKNOWN }, never a throw, and the error text is not in the answer', async () => {
    const { enqueue, mailer } = harness();
    const readMailSettings = vi.fn<EmailOutboxRepository['readMailSettings']>(() => Promise.reject(new Error('connection to server at "10.1.2.3" failed')));
    const service = createMailService({ outbox: { enqueue, readMailSettings }, mailer, clock: createFixedClock(NOW) });
    const answer = await service.sendNow(direct);
    expect(answer).toEqual({ ok: false, code: 'UNKNOWN' });
    expect(JSON.stringify(answer)).not.toContain('10.1.2.3');
  });
});

describe('enqueue (AC-2)', () => {
  const message: OutboxMessage = {
    idempotencyKey: 'backup-missed:2026-11-18',
    event: 'backup-missed',
    toUserId: '9d1e5b0c-7a3f-4c2d-8e61-5b2a4f7c9d02',
    ccUserIds: [],
    subject: 'Backup missed',
    bodyHtml: '<p>x</p>',
    bodyText: 'x',
  };

  it('AC-2: hands the caller\'s transaction, the message and the clock\'s now to the repository, and returns its answer', async () => {
    const { service, enqueue } = harness();
    const tx = createTransactionHandle();
    expect(await service.enqueue(tx, message)).toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(tx, message, NOW);
  });

  it('AC-2: reports an already queued event as such', async () => {
    const { enqueue, readMailSettings, mailer } = harness();
    enqueue.mockResolvedValueOnce('already-queued');
    const service = createMailService({ outbox: { enqueue, readMailSettings }, mailer, clock: createFixedClock(NOW) });
    expect(await service.enqueue(createTransactionHandle(), message)).toBe('already-queued');
  });
});
