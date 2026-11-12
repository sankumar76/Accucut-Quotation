import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MaterialResults } from '@/components/features/masters/material-results';
import { materialSavedNotice } from '@/components/features/masters/material-texts';
import type { PageNotice } from '@/components/features/masters/master-texts';
import { ProcessResults } from '@/components/features/masters/process-results';
import { goneNotice, savedNotice } from '@/components/features/masters/process-texts';
import type { MaterialMaster } from '@/components/features/masters/use-material-master';
import type { ProcessMaster } from '@/components/features/masters/use-process-master';

/**
 * DEF-029 (AQP-274, ux-spec v0.23 section 6.0 "Error (load)", SCR-11 and SCR-13 Materials): the words of the load error of Process and of the Materials
 * tab, by whether a success notice is on the page. With one (Added, Saved or Deleted) the change happened, so the error says so and never "Nothing was
 * changed."; with none, or with a warning or an information notice (a rate deleted elsewhere), the standard line stays. The E2E tests cover the success
 * side in a browser (`masters-slow-read.spec.ts`); this file covers the side they do not, and every notice the screens can hold. The words are written
 * out here, not imported, so a change to the constants cannot change what the test expects.
 */

const STANDARD_LINE = 'Check your connection and try again. Nothing was changed.';
const SAVED_SENTENCE = 'The change was saved, but we could not show the list. Check your connection and try again.';

/**
 * `ProcessResults` and `MaterialResults` read only the list's status and the notice when the read has failed, so this is the part of the
 * hooks' return that matters to them: a failed read, and the notice. The rest of the hooks' return is never touched on this branch.
 */
function failedRead(notice: PageNotice | null) {
  return { list: { status: 'error' }, dialogs: {}, dialog: {}, notice, readAgain: () => Promise.resolve() };
}

const processError = (notice: PageNotice | null): string =>
  renderToStaticMarkup(createElement(ProcessResults, { master: failedRead(notice) as unknown as ProcessMaster, onClearFilters: () => undefined }));
const materialError = (notice: PageNotice | null): string =>
  renderToStaticMarkup(createElement(MaterialResults, { master: failedRead(notice) as unknown as MaterialMaster, onClearFilters: () => undefined }));

describe('the load error of the Process master (SCR-11)', () => {
  it.each([
    ['no notice', null],
    ['a rate deleted elsewhere while it was edited (warning)', goneNotice('n.37', 'edit')],
    ['a rate deleted elsewhere while it was deleted (information)', goneNotice('n.37', 'delete')],
  ])('%s: the title and the standard line, never the saved sentence', (_name, notice) => {
    const html = processError(notice);
    expect(html).toContain('We could not load the rates');
    expect(html).toContain(STANDARD_LINE);
    expect(html).not.toContain(SAVED_SENTENCE);
  });

  it.each([
    ['added', savedNotice('n.37', 'added')],
    ['saved', savedNotice('n.37', 'saved')],
    ['deleted', savedNotice('n.37', 'deleted')],
  ])('after a rate was %s: the title and the saved sentence, never "Nothing was changed."', (_what, notice) => {
    const html = processError(notice);
    expect(html).toContain('We could not load the rates');
    expect(html).toContain(SAVED_SENTENCE);
    expect(html).not.toContain('Nothing was changed.');
  });
});

describe('the load error of the Materials tab (SCR-13)', () => {
  it('no notice: the title and the standard line, never the saved sentence', () => {
    const html = materialError(null);
    expect(html).toContain('We could not load the materials');
    expect(html).toContain(STANDARD_LINE);
    expect(html).not.toContain(SAVED_SENTENCE);
  });

  it.each([
    ['added', materialSavedNotice('n.37', 'added')],
    ['saved', materialSavedNotice('n.37', 'saved')],
  ])('after a material was %s: the title and the saved sentence, never "Nothing was changed."', (_what, notice) => {
    const html = materialError(notice);
    expect(html).toContain('We could not load the materials');
    expect(html).toContain(SAVED_SENTENCE);
    expect(html).not.toContain('Nothing was changed.');
  });
});
