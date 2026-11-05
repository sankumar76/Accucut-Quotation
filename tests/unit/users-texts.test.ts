import { describe, expect, it } from 'vitest';

import { dialogFailureTitle, FAILED_DIALOGS_MESSAGE } from '@/components/features/users/texts';

/** UX spec v0.14, SCR-14 and SCR-25: the notice for a dialog whose code did not arrive. */
describe('the notice when a dialog did not open', () => {
  it('names a form for add, edit and reset, and a confirmation for deactivate', () => {
    for (const kind of ['add', 'edit', 'reset', null] as const) expect(dialogFailureTitle(kind)).toBe('The form did not open.');
    expect(dialogFailureTitle('deactivate')).toBe('The confirmation did not open.');
  });

  it('uses the shared sentence', () => {
    expect(FAILED_DIALOGS_MESSAGE).toBe('Check your connection and try again.');
  });
});
