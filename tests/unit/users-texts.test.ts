import { describe, expect, it } from 'vitest';

import { dialogFailureTitle, FAILED_DIALOGS_MESSAGE, OWN_PASSWORD_NAME } from '@/components/features/users/texts';

/** UX spec v0.14, SCR-14 and SCR-25: the notice for a dialog whose code did not arrive. */
describe('the notice when a dialog did not open', () => {
  it('names a form for add, edit and reset, and a confirmation for deactivate', () => {
    for (const kind of ['add', 'edit', 'reset', null] as const) expect(dialogFailureTitle(kind)).toBe('The form did not open.');
    expect(dialogFailureTitle('deactivate')).toBe('The confirmation did not open.');
  });

  it('DEF-016: the disabled own-row Reset is named by the exact sentence of the UX spec, full stop included', () => {
    // The whole string, not a part of it: a dropped stop, a changed word or an extra space fails here (ux-expert, 11038).
    expect(OWN_PASSWORD_NAME).toBe('Reset password is not available for your own account. Use Change password in the account menu.');
    // WCAG 2.5.3: the name contains the text the button shows.
    expect(OWN_PASSWORD_NAME.startsWith('Reset password')).toBe(true);
  });

  it('uses the shared sentence', () => {
    expect(FAILED_DIALOGS_MESSAGE).toBe('Check your connection and try again.');
  });
});
