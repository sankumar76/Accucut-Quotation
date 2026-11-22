import { describe, expect, it } from 'vitest';

import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { renderBackupMissed } from '@/server/mail/templates/backup-missed';

/**
 * STORY-09.06 AC-10: the "Server check needed" message is a pure function of two flags. It says in words that the weekly backup is late and/or that the disk is nearly full, that the server should
 * be checked and that a reminder comes each morning, in HTML and in plain text, and it holds no figure, path, drive letter, volume name or secret: it cannot, because it is given none.
 */

describe('the words (AC-10)', () => {
  it('AC-10: a late backup alone', () => {
    const { subject, html, text } = renderBackupMissed({ backupLate: true, diskNearlyFull: false });
    expect(subject).toBe('Accucut RFQ Portal: server check needed');
    for (const body of [html, text]) {
      expect(body).toContain('The weekly backup is late.');
      expect(body).not.toContain('disk');
      expect(body).toContain('Please ask Accucut IT to check the server.');
      expect(body).toContain('You will get this reminder each morning until it is fixed.');
    }
  });

  it('AC-10: a nearly full disk alone', () => {
    const { html, text } = renderBackupMissed({ backupLate: false, diskNearlyFull: true });
    for (const body of [html, text]) {
      expect(body).toContain('The server disk is nearly full.');
      expect(body).not.toContain('backup is late');
    }
  });

  it('AC-10: both, in one sentence pair', () => {
    const { text } = renderBackupMissed({ backupLate: true, diskNearlyFull: true });
    expect(text).toContain('The weekly backup is late. The server disk is nearly full.');
  });

  it('AC-10: neither is a programming error: there is nothing to say', () => {
    expect(() => renderBackupMissed({ backupLate: false, diskNearlyFull: false })).toThrow(RangeError);
  });
});

describe('what the message cannot hold (AC-10)', () => {
  const MESSAGES = [
    renderBackupMissed({ backupLate: true, diskNearlyFull: false }),
    renderBackupMissed({ backupLate: false, diskNearlyFull: true }),
    renderBackupMissed({ backupLate: true, diskNearlyFull: true }),
  ];

  it('AC-10: no figure, no percentage, no size, no path and no drive letter', () => {
    for (const { subject, text } of MESSAGES) {
      for (const part of [subject, text.replace(LOGO_CONTENT_ID, '')]) {
        expect(part).not.toMatch(/\d/);
        expect(part).not.toMatch(/%|\bGB\b|\bMB\b|bytes/i);
        expect(part).not.toMatch(/[A-Za-z]:[\/]|\\|\/(?:var|mnt|srv)\//);
      }
    }
  });

  it('AC-10: the HTML refers to the logo and nothing outside the layout', () => {
    for (const { html } of MESSAGES) expect(html).toContain(`cid:${LOGO_CONTENT_ID}`);
  });
});
