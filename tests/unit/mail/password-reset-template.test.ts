import { describe, expect, it } from 'vitest';

import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { renderPasswordReset } from '@/server/mail/templates/password-reset';

/**
 * STORY-09.07 AC-2, AC-9: the reset-link message is a pure function from the person's name and the link. It has HTML and plain text, the link in both, the lifetime in words, escapes what the name
 * holds, and has no field for a cost, a password or any other personal data. Every value is invented.
 */

const LINK = 'https://portal.example.test/reset-password?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('renderPasswordReset', () => {
  it('has a subject, an HTML body and a plain-text body, each with the link and the lifetime', () => {
    const message = renderPasswordReset({ name: 'Invented Person', resetLink: LINK });
    expect(message.subject).toBe('Reset your password');
    for (const body of [message.html, message.text]) {
      expect(body).toContain(LINK);
      expect(body).toContain('Invented Person');
      expect(body).toContain('works once and for 60 minutes');
      expect(body).toContain('If you did not ask for this, ignore this message.');
    }
    expect(message.html).toContain(`<a href="${LINK}"`);
    expect(message.html).toContain(`cid:${LOGO_CONTENT_ID}`);
    expect(message.text).toContain(`Choose a new password: ${LINK}`);
  });

  it('escapes a name that holds markup, so it cannot change the message', () => {
    const message = renderPasswordReset({ name: '<script>alert(1)</script> & "Co"', resetLink: LINK });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('&amp;');
  });

  it('reads the two fields by name: a value that rides along on the object is never read', () => {
    const rider = { name: 'Invented Person', resetLink: LINK, password: 'planted-password-value', costTotal: '99999', email: 'someone@example.test' };
    const message = renderPasswordReset(rider);
    for (const text of [message.subject, message.html, message.text]) {
      expect(text).not.toContain('planted-password-value');
      expect(text).not.toContain('99999');
      expect(text).not.toContain('someone@example.test');
    }
  });

  it('refuses a link that is not a full http or https address', () => {
    for (const resetLink of ['javascript:alert(1)', '/reset-password?token=abc', 'data:text/html,x']) {
      expect(() => renderPasswordReset({ name: 'Invented Person', resetLink })).toThrow();
    }
  });
});
