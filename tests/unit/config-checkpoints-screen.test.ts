import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CheckpointsList } from '@/components/features/config/checkpoints-table';
import { KEEP_LABEL, PASSWORD_HINT, PASSWORD_LABEL, REVERT_EFFECTS, REVERT_LABEL, revertLead, revertTitle } from '@/components/features/config/checkpoints-texts';
import type { CheckpointRow } from '@/lib/config/checkpoints-client';
import { revertedMessage } from '@/lib/config/checkpoint';

/**
 * STORY-08.06 AC-3 and AC-10 without a browser: what SCR-21 draws from the rows the server sends (the columns, the Revert on every row but the current one, the seed checkpoint with no person, the table in its own named
 * region and a card for each row) and the revert dialog's states (what a revert does, the password, the notices). The words are written out here from the UX spec and the story, not imported from the product, so a
 * changed sentence fails a test. The layouts at 360, 768 and 1366 px, axe, focus and the keyboard are `tests/e2e/checkpoints.spec.ts`. Every name is invented.
 */

const row = (overrides: Partial<CheckpointRow> = {}): CheckpointRow => ({
  id: '00000000-0000-4000-8000-0ddd00000002',
  name: 'Invented Before Insert',
  versionId: '00000000-0000-4000-8000-0ccc00000007',
  versionNumber: 7,
  savedAt: '2026-11-01T11:30:00.000Z',
  savedBy: 'Invented Admin',
  ...overrides,
});

const ROWS: ReadonlyArray<CheckpointRow> = [
  row({ id: '00000000-0000-4000-8000-0ddd00000003', name: 'Invented Current', versionNumber: 9 }),
  row(),
  row({ id: '00000000-0000-4000-8000-0ddd00000001', name: 'Original configuration', versionNumber: 1, savedAt: '2026-10-20T04:30:00.000Z', savedBy: null }),
];

const render = (props: Partial<Parameters<typeof CheckpointsList>[0]> = {}): string =>
  renderToStaticMarkup(createElement(CheckpointsList, { rows: ROWS, currentNumber: 9, onRevert: () => undefined, pressedRowId: null, ...props }));

describe('AC-3: the table', () => {
  it('heads the table Name, Version, Saved and By, with an action column named for a screen reader, in a named, focusable, scrollable region', () => {
    const html = render();
    for (const heading of ['Name', 'Version', 'Saved', 'By']) expect(html).toContain(`>${heading}</th>`);
    expect(html).toContain('<span class="sr-only">Actions</span>');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Saved checkpoints, scrollable"');
    expect(html).toContain('tabindex="0"');
  });

  it('shows each row with its name, version number, time in IST and person', () => {
    const html = render();
    expect(html).toContain('Invented Before Insert');
    expect(html).toContain('01 Nov 2026, 17:00 IST');
    expect(html).toContain('Invented Admin');
  });

  it('shows the seed checkpoint with a dash and no person, announced to a screen reader as "No person, original configuration"', () => {
    const html = render();
    expect(html).toContain('<span aria-hidden="true">—</span>');
    expect(html).toContain('No person, original configuration');
  });

  it('also draws a card for each checkpoint, for a phone, with the same words', () => {
    const html = render();
    expect(html).toContain('<ul aria-label="Saved checkpoints"');
    expect(html.match(/<li /g)).toHaveLength(ROWS.length);
  });
});

describe('AC-3: Revert on every row except the one that names the current version', () => {
  it('draws Revert, named for the checkpoint, on the other rows (once in the table and once in the card) and the tag "Current" on the current one', () => {
    const html = render();
    expect(html.match(/>Revert</g)).toHaveLength(2 * 2);
    expect(html).toContain('Revert<span class="sr-only"> to Invented Before Insert</span>');
    expect(html).toContain('Revert<span class="sr-only"> to Original configuration</span>');
    expect(html).not.toContain('Revert<span class="sr-only"> to Invented Current</span>');
    expect(html.match(/>Current</g)).toHaveLength(2);
  });

  it('marks each Revert for the opener that returns focus to it: data-action, and the row\'s data-item-id', () => {
    const html = render();
    expect(html).toContain('data-action="revert"');
    expect(html).toContain('data-item-id="00000000-0000-4000-8000-0ddd00000002"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('keeps the pressed row\'s Revert busy while the dialog\'s code loads, and no other', () => {
    const html = render({ pressedRowId: ROWS[1]?.id ?? null });
    expect(html.match(/aria-busy="true"/g)).toHaveLength(2);
  });
});

describe('AC-10: the words of the revert dialog (its states, focus and keys are tests/e2e/checkpoints.spec.ts: the dialog is a portal, which static markup does not draw)', () => {
  it('titles the dialog with the name of the checkpoint, or with the version when it has none (the undo)', () => {
    expect(revertTitle('Invented Before Insert', 7)).toBe('Revert to "Invented Before Insert"?');
    expect(revertTitle(null, 8)).toBe('Revert to version 8?');
  });

  it('says that it makes a new version that is a copy of the target', () => {
    expect(revertLead(7, 10)).toBe('This makes a new configuration version (version 10) that is a copy of version 7.');
  });

  it('says what a revert does, in four sentences: estimate data untouched, approved estimates keep theirs, a draft uses the new layout, it can be undone', () => {
    expect(REVERT_EFFECTS).toEqual([
      'Estimate data is not touched.',
      'Approved estimates keep the layout and values they were approved with.',
      'A draft estimate uses the reverted layout from its next calculation.',
      'You can undo it: the version you are on now stays in the history.',
    ]);
  });

  it('labels the password, hints what it is, and offers the safe choice first', () => {
    expect([PASSWORD_LABEL, PASSWORD_HINT, KEEP_LABEL, REVERT_LABEL]).toEqual(['Your password', 'The password you sign in with. A revert is checked with it each time.', 'Keep the current version', 'Revert']);
  });
});

describe('AC-7: the success words', () => {
  it('reads "Reverted to version 7. This is now configuration version 9."', () => {
    expect(revertedMessage(7, 9)).toBe('Reverted to version 7. This is now configuration version 9.');
  });
});
