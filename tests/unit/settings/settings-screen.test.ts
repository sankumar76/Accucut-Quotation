import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SettingsScreen } from '@/components/features/settings/settings-screen';
import { readingAgeText } from '@/components/features/settings/texts';
import type { AlertSettingsView, BackupStatusView } from '@/server/services/settings-service';

/**
 * STORY-02.09 AC-1 to AC-5 without a browser: what SCR-15 draws from the status the server sends, in every state: a good backup, "Backup late", no backup yet, "Disk nearly full", a fresh and
 * a stale reading, no reading. The words are written out here from the UX spec and the story, not imported from the product, so a changed sentence fails a test. The layouts at 360, 768 and
 * 1366 px, axe and the keyboard are `tests/e2e/settings.spec.ts`. Every figure is invented.
 */

const GOOD: BackupStatusView = {
  // 2026-10-31 20:30 UTC is Sunday 01 Nov 2026, 02:00 IST, the example of the spec.
  lastGoodBackupAt: '2026-10-31T20:30:00.000Z',
  backupLate: false,
  diskReading: { freePercent: 74, readAt: '2026-11-07T09:00:00.000Z', ageSeconds: 3 * 3600, stale: false },
  diskNearlyFull: false,
};

const ALERTS_OFF: AlertSettingsView = { alertsEnabled: false, senderName: '', senderAddress: '', emailEnabled: true };
const ADMIN_ADDRESS = 'admin.own@example.com';

const render = (status: BackupStatusView, alerts: AlertSettingsView = ALERTS_OFF): string =>
  renderToStaticMarkup(createElement(SettingsScreen, { status, alerts, adminAddress: ADMIN_ADDRESS }));

describe('AC-1: a good backup and no warning', () => {
  const html = render(GOOD);

  it('has the title, the two lines and the sentence about the server', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('>Settings</h1>');
    expect(html).toContain('Last good backup');
    expect(html).toContain('Sunday 01 Nov 2026, 02:00 IST. Finished without errors.');
    expect(html).toContain('Server disk');
    expect(html).toContain('74 % free. Read 3 hours ago.');
    expect(html).toContain('Backups are kept on the same server.');
  });

  it('shows no notice', () => {
    expect(html).not.toContain('Backup late');
    expect(html).not.toContain('Disk nearly full');
    expect(html).not.toContain('data-slot="alert"');
  });
});

describe('AC-2: "Backup late"', () => {
  it('shows the notice with its title, its icon and the sentence of the spec, and still shows the date of the last good backup', () => {
    const html = render({ ...GOOD, backupLate: true });
    expect(html).toContain('Backup late');
    expect(html).toContain('No backup has finished for 8 days. Ask Accucut IT to check the weekly backup.');
    expect(html).toMatch(/data-slot="alert"[^>]*>\s*<svg/);
    expect(html).toContain('Sunday 01 Nov 2026, 02:00 IST. Finished without errors.');
  });
});

describe('STORY-10.05 AC-10 (replaces 02.09 AC-3): no good backup yet', () => {
  it('says "No good backup yet." and shows "Backup late" with the sentence for "never" and no number of days', () => {
    const html = render({ ...GOOD, lastGoodBackupAt: null, backupLate: true });
    expect(html).toContain('Last good backup');
    expect(html).toContain('No good backup yet.');
    expect(html).toContain('Backup late');
    expect(html).toContain('No backup has finished without errors yet. Ask Accucut IT to check the weekly backup.');
    expect(html).not.toContain('for 8 days');
    expect(html).not.toContain('Finished without errors.');
  });

  it('with a previous good backup, the late notice keeps the 8-day sentence (nothing changes there)', () => {
    const html = render({ ...GOOD, backupLate: true });
    expect(html).toContain('No backup has finished for 8 days. Ask Accucut IT to check the weekly backup.');
    expect(html).not.toContain('without errors yet');
  });
});

describe('AC-4: the server disk', () => {
  it('"Disk nearly full" has its title, its icon and the sentence of the spec', () => {
    const html = render({ ...GOOD, diskNearlyFull: true, diskReading: { freePercent: 19, readAt: '2026-11-07T09:00:00.000Z', ageSeconds: 60, stale: false } });
    expect(html).toContain('Disk nearly full');
    expect(html).toContain('Less than 20 % of the server disk is free. Backups are kept on the same server, so ask Accucut IT to free space or add disk.');
    expect(html).toMatch(/data-slot="alert"[^>]*>\s*<svg/);
    expect(html).toContain('19 % free. Read 1 minute ago.');
  });

  it('at 20 % there is no notice', () => {
    const html = render({ ...GOOD, diskReading: { freePercent: 20, readAt: '2026-11-07T09:00:00.000Z', ageSeconds: 60, stale: false } });
    expect(html).toContain('20 % free.');
    expect(html).not.toContain('Disk nearly full');
  });

  it('a reading more than 3 days old shows its date in IST and does not say it was read "ago" as if it were fresh', () => {
    const html = render({ ...GOOD, diskReading: { freePercent: 55, readAt: '2026-11-03T09:00:00.000Z', ageSeconds: 4 * 86_400, stale: true } });
    expect(html).toContain('55 % free when it was last read, on 03 Nov 2026, 14:30 IST.');
    expect(html).toContain('That is more than 3 days ago, so it may be out of date.');
    expect(html).not.toContain('Read 4 days ago');
  });

  it('no reading at all says so', () => {
    const html = render({ ...GOOD, diskReading: null });
    expect(html).toContain('The server disk has not been read yet.');
    expect(html).not.toContain('% free');
  });

  it.each([
    [0, 'less than a minute ago'],
    [59, 'less than a minute ago'],
    [60, '1 minute ago'],
    [3599, '59 minutes ago'],
    [3600, '1 hour ago'],
    [86_399, '23 hours ago'],
    [86_400, '1 day ago'],
    [3 * 86_400, '3 days ago'],
  ])('writes an age of %s seconds as "%s"', (seconds, text) => {
    expect(readingAgeText(seconds)).toBe(text);
  });
});

describe('AC-5: the Backups card is read-only', () => {
  const html = render({ ...GOOD, backupLate: true, diskNearlyFull: true });

  it('has no link, and no word that starts, restores or deletes a backup', () => {
    expect(html).not.toMatch(/<a[s>]/);
    expect(html).not.toMatch(/(Start|Restore|Delete|Run) (a |the )?backup/i);
  });

  it('has one h1 and the two cards under h2', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/<h2/g)).toHaveLength(2);
  });
});

describe('STORY-09.02 AC-1: the e-mail alerts card replaces the placeholder', () => {
  const html = render(GOOD);

  it('no longer says the switch will be added', () => {
    expect(html).not.toContain('will be added here');
  });

  it('has the switch with its state in words, the two fields and the two buttons', () => {
    expect(html).toContain('>E-mail alerts</h2>');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('E-mail alerts: OFF');
    expect(html).toContain('When OFF, nothing is sent.');
    expect(html).toContain('>Sender name</label>');
    expect(html).toContain('>Sender e-mail address</label>');
    expect(html).toContain('>Save settings<');
    expect(html).toContain('>Send test e-mail<');
  });

  it('says in words that the mail server credentials are set on the server by Accucut IT, and has no password field', () => {
    expect(html).toContain('The mail server password is set on the server by Accucut IT, not here.');
    expect(html).not.toMatch(/type="password"/);
  });

  it('says where the test e-mail goes: the signed-in Admin own address', () => {
    expect(html).toContain('The test e-mail goes to your own address, admin.own@example.com.');
  });

  it('draws the saved values and the ON state', () => {
    const on = render(GOOD, { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com', emailEnabled: true });
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('E-mail alerts: ON');
    expect(on).toContain('daily digest at 11:00 IST');
    expect(on).toContain('value="Accucut Portal"');
    expect(on).toContain('value="portal@example.com"');
  });

  it('AC-8: says that sending is not enabled yet only while FEATURE_EMAIL is off, and still shows every control', () => {
    const off = render(GOOD, { ...ALERTS_OFF, emailEnabled: false });
    expect(off).toContain('Sending is not enabled on this server yet. Accucut IT turns it on.');
    expect(off).toContain('role="switch"');
    expect(off).toContain('>Send test e-mail<');
    expect(html).not.toContain('Sending is not enabled');
  });

  it('keeps the Last backup lines unchanged', () => {
    expect(html).toContain('Sunday 01 Nov 2026, 02:00 IST. Finished without errors.');
    expect(html).toContain('Backups are kept on the same server.');
  });
});
