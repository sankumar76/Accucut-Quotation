import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CalculateBar, type CalculateBarProps } from '@/components/features/estimate-workspace/calculate-bar';
import { SaveDraftNotice, type SaveDraftControl } from '@/components/features/estimate-workspace/save-bar';
import { draftSavedText } from '@/components/features/estimate-workspace/save-texts';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * STORY-05.08 AC-1, AC-5: the action bar draws "Save draft" beside Calculate while the estimate can still be changed, and not once it is submitted; the line "Draft saved at 10:42 IST." is a polite
 * live region that is always on the page, and a draft that could not be saved is an alert. Rendered to markup with no browser: the press, the saves and the announcement are the page's own, in
 * `tests/e2e/estimate-save.spec.ts` at three widths.
 */

const calculation = { busy: false, warning: null } as unknown as CalculateBarProps['calculation'];
const bar = (submitted: boolean): string =>
  renderToStaticMarkup(createElement(CalculateBar, { submitted, calculation, gate: createSaveGate(), onChoosePart: () => undefined }));
const control = (outcome: SaveDraftControl['outcome']): SaveDraftControl => ({ saving: false, outcome, press: () => Promise.resolve() });

describe('AC-1: Save draft is in the action bar while the estimate can be changed', () => {
  it('draws the Save draft button and the Calculate button, and an empty live region for the saved line', () => {
    const markup = bar(false);
    expect(markup).toContain('>Save draft<');
    expect(markup).toContain('>Calculate<');
    expect(markup).toMatch(/<p role="status"[^>]*data-draft-status=""[^>]*><\/p>/);
  });

  it('draws neither the button nor the line once the estimate is submitted: there is nothing left to save', () => {
    const markup = bar(true);
    expect(markup).not.toContain('Save draft');
    expect(markup).not.toContain('data-draft-status');
    expect(markup).toContain('>Submitted<');
  });
});

describe('AC-1, AC-5: what the person is told after a press', () => {
  it('"Draft saved at 10:42 IST." in the polite live region', () => {
    const markup = renderToStaticMarkup(createElement(SaveDraftNotice, { draft: control({ kind: 'saved', time: '10:42 IST' }) }));
    expect(markup).toContain(`>${draftSavedText('10:42 IST')}<`);
    expect(markup).toContain('Draft saved at 10:42 IST.');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('role="alert"');
  });

  it('a draft that could not be saved is an alert that says what to do, and says nothing is saved', () => {
    const markup = renderToStaticMarkup(createElement(SaveDraftNotice, { draft: control({ kind: 'failed' }) }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('The draft was not saved.');
    expect(markup).toContain('press Save draft again');
    expect(markup).not.toContain('Draft saved at');
  });

  it('before any press the line is empty and no alert is drawn', () => {
    const markup = renderToStaticMarkup(createElement(SaveDraftNotice, { draft: control({ kind: 'none' }) }));
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('Draft saved');
  });
});
