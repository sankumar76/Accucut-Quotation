import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MailFailures } from '@/components/features/settings/mail-failures';
import { SettingsScreen } from '@/components/features/settings/settings-screen';
import { SEND_FAILURE_CODES } from '@/lib/mail/codes';
import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import type { MailFailureSummary } from '@/server/repositories/email-outbox-repository';
import { settingsSchema } from '@/server/views/schemas/settings';
import { createSettingsService, type BackupStatusView, type MailFailuresView } from '@/server/services/settings-service';

import { fakeSettingsDependencies } from '../../support/fake-settings';

/**
 * STORY-09.06 AC-8: the Settings page shows that e-mails could not be sent. The service asks the outbox for the rows that failed in the last 7 days (and says nothing of an address, a subject
 * or an ID), the strict schema of `GET /settings` carries `mailFailures`, and SCR-15 draws a warning notice (an icon, a title, a sentence, `role="alert"`) with a plain sentence for each
 * class code and "Ask Accucut IT". The words are written out here, not imported, so a changed sentence fails a test. Every value is invented.
 */

const NOW = new Date('2026-11-20T10:00:00.000Z');
const LAST_AT = new Date('2026-11-19T08:30:00.000Z');

function serviceWith(summary: MailFailureSummary | null) {
  const failedSince = vi.fn<(since: Date) => Promise<MailFailureSummary | null>>(() => Promise.resolve(summary));
  const service = createSettingsService({ ...fakeSettingsDependencies(), outbox: { failedSince }, clock: createFixedClock(NOW) });
  return { service, failedSince };
}

describe('the service (AC-8)', () => {
  it('AC-8: asks for the rows that failed in the last 7 days, by the clock it was given', async () => {
    const { service, failedSince } = serviceWith(null);
    await service.getMailFailures();
    expect(failedSince).toHaveBeenCalledWith(new Date(NOW.getTime() - 7 * MILLISECONDS_PER_DAY));
  });

  it('AC-8: with none failed the answer is null (no notice)', async () => {
    expect(await serviceWith(null).service.getMailFailures()).toBeNull();
  });

  it('AC-8: the answer is the count, the last class code and the time as ISO text, and nothing else', async () => {
    const { service } = serviceWith({ count: 3, lastCode: 'AUTH_FAILED', lastAt: LAST_AT });
    expect(await service.getMailFailures()).toEqual({ count: 3, lastCode: 'AUTH_FAILED', lastAt: '2026-11-19T08:30:00.000Z' });
  });

  it('AC-8: a field the outbox should never return (an address, a subject, an ID) cannot reach the answer', async () => {
    const leaky = { count: 1, lastCode: 'CONNECTION', lastAt: LAST_AT, toAddress: 'someone@example.com', subject: 'Task overdue: X', id: 'row-1' } as unknown as MailFailureSummary;
    const answer = await serviceWith(leaky).service.getMailFailures();
    expect(JSON.stringify(answer)).not.toMatch(/example.com|Task overdue|row-1/);
  });
});

describe('GET /settings schema (AC-8)', () => {
  const base = {
    lastGoodBackupAt: null,
    backupLate: false,
    diskReading: null,
    diskNearlyFull: false,
    alertsEnabled: true,
    senderName: 'Accucut',
    senderAddress: 'portal@example.com',
    emailEnabled: true,
  };

  it('AC-8: mailFailures is null or { count, lastCode, lastAt }', () => {
    expect(settingsSchema.safeParse({ ...base, mailFailures: null }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...base, mailFailures: { count: 2, lastCode: 'NO_SENDER', lastAt: LAST_AT.toISOString() } }).success).toBe(true);
  });

  it('AC-8: it is required, and a key that is not named (an address, a subject) is refused, in the answer and inside mailFailures', () => {
    expect(settingsSchema.safeParse(base).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, mailFailures: null, address: 'a@example.com' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, mailFailures: { count: 1, lastCode: 'CONNECTION', lastAt: LAST_AT.toISOString(), subject: 'x' } }).success).toBe(false);
  });

  it('AC-8: a code that is not a class code, and a count below 1, are refused', () => {
    expect(settingsSchema.safeParse({ ...base, mailFailures: { count: 1, lastCode: 'ECONNREFUSED 10.1.2.3', lastAt: LAST_AT.toISOString() } }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, mailFailures: { count: 0, lastCode: 'UNKNOWN', lastAt: LAST_AT.toISOString() } }).success).toBe(false);
  });
});

const view = (overrides: Partial<MailFailuresView> = {}): MailFailuresView => ({ count: 1, lastCode: 'CONNECTION', lastAt: '2026-11-19T08:30:00.000Z', ...overrides });
const render = (failures: MailFailuresView | null): string => renderToStaticMarkup(createElement(MailFailures, { failures }));

describe('the notice (AC-8)', () => {
  it('AC-8: with none failed there is no notice at all', () => {
    expect(render(null)).toBe('');
  });

  it('AC-8: it is a warning with an icon, a title and role="alert", so it is not shown by colour alone', () => {
    const html = render(view());
    expect(html).toContain('role="alert"');
    expect(html).toContain('<svg');
    expect(html).toContain('E-mails not sent');
  });

  it('AC-8: it says how many e-mails could not be sent in the last 7 days (one, and many)', () => {
    expect(render(view({ count: 1 }))).toContain('1 e-mail could not be sent in the last 7 days.');
    expect(render(view({ count: 12 }))).toContain('12 e-mails could not be sent in the last 7 days.');
  });

  it('AC-8: it gives the time of the last failure in IST', () => {
    // 08:30 UTC is 14:00 IST.
    expect(render(view())).toMatch(/Last failure: 19 Nov 2026, 14:00 IST/);
  });

  it.each([
    ['SENDER_NOT_ALLOWED', 'The mail server did not accept the sender address for this mailbox.'],
    ['AUTH_FAILED', 'The mail server refused the sign-in.'],
    ['CONNECTION', 'The mail server could not be reached.'],
    ['NO_SENDER', 'No sender name and e-mail address are saved.'],
    ['UNKNOWN', 'The cause is not known.'],
  ] as const)('AC-8: the last problem %s is said in a plain sentence, with "Ask Accucut IT"', (code, sentence) => {
    const html = render(view({ lastCode: code }));
    expect(html).toContain(`Last problem: ${sentence}`);
    expect(html).toContain('Ask Accucut IT.');
    // The class code itself is not shown to the Admin.
    expect(html).not.toContain(code);
  });

  it('AC-8: every class code of the outbox has a sentence (a new code cannot reach the page unworded)', () => {
    for (const code of SEND_FAILURE_CODES) expect(render(view({ lastCode: code }))).toContain('Last problem: ');
  });
});

describe('the page (AC-8)', () => {
  const status: BackupStatusView = { lastGoodBackupAt: null, backupLate: false, diskReading: null, diskNearlyFull: false };
  const alerts = { alertsEnabled: true, senderName: 'Accucut', senderAddress: 'portal@example.com', emailEnabled: true };
  const page = (mailFailures: MailFailuresView | null): string => renderToStaticMarkup(createElement(SettingsScreen, { status, alerts, adminAddress: 'admin@example.com', mailFailures }));

  it('AC-8: SCR-15 shows the notice when mail failed and not when none did', () => {
    expect(page(view())).toContain('E-mails not sent');
    expect(page(null)).not.toContain('E-mails not sent');
  });
});
