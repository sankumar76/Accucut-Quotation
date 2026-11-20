import { describe, expect, it } from 'vitest';

import { decidePreview, decideSave } from '@/components/features/config/insert-field-outcome';
import type { Refusal } from '@/lib/api-client';
import type { InsertPreviewView, InsertSavedView } from '@/lib/config/insert-field-client';
import { CONFIG_VERSION_CHANGED_CODE } from '@/lib/errors';

/**
 * STORY-08.03 AC-4 (409 and the answer that never came), AC-7 (a refusal under the control it names) and AC-2 (the states "preview error", "validation errors", "409 stale version" and "success") without a
 * browser: where each answer of the server goes. The words of a refusal are the server's and are passed through as given; the screen's own words are written out here from the UX spec and the story,
 * not imported, so a changed sentence fails a test.
 */

const PREVIEW: InsertPreviewView = { baseVersion: 9, inserted: [{ letter: 'ZA', label: 'Invented', kind: 'input' }], moved: [], productCells: [], formulas: [] };
const SAVED: InsertSavedView = { version: 10, letters: ['ZA'], message: 'Inserted as ZA. Configuration version 10.' };

const refusal = (overrides: Partial<Refusal> = {}): Refusal => ({ status: 'refused', httpStatus: 422, code: 'VALIDATION_FAILED', title: 'The input is not valid.', fields: {}, body: {}, ...overrides });

describe('the answer to the preview', () => {
  it('shows the preview and goes to step 3 when it worked', () => {
    expect(decidePreview({ status: 'ok', value: PREVIEW })).toEqual({ kind: 'preview', view: PREVIEW });
  });

  it('puts a refusal that names controls under them, in the server\'s words (AC-7)', () => {
    const fields = { 'input.label': 'Enter a label.', 'cost.formula': 'The formula uses a name that is not a column or a rate.' };
    expect(decidePreview(refusal({ fields }))).toEqual({ kind: 'fields', fields });
  });

  it('shows a refusal that names no control as a notice with the server\'s title', () => {
    expect(decidePreview(refusal({ httpStatus: 403, code: 'FORBIDDEN', title: 'You do not have access to this.' }))).toEqual({
      kind: 'notice',
      notice: { tone: 'danger', title: 'Nothing was inserted', message: 'You do not have access to this.', stale: false },
    });
  });

  it('says nothing was changed when no answer came (the state "preview error")', () => {
    expect(decidePreview({ status: 'failed' })).toEqual({
      kind: 'notice',
      notice: { tone: 'warn', title: 'We could not work out the preview', message: 'The portal did not answer. Nothing was changed. Try again in a moment.', stale: false },
    });
  });
});

describe('the answer to the save', () => {
  it('is the success, with the server\'s sentence (AC-4)', () => {
    expect(decideSave({ status: 'ok', value: SAVED })).toEqual({ kind: 'saved', saved: SAVED });
  });

  it('is a stale notice that can only be answered by starting again, with the newer number in the server\'s words (AC-4)', () => {
    const title = 'The fields and formulas were changed while you were inserting. They are now at configuration version 11. Nothing was inserted; start again to see what changed.';
    expect(decideSave(refusal({ httpStatus: 409, code: CONFIG_VERSION_CHANGED_CODE, title }))).toEqual({
      kind: 'notice',
      notice: { tone: 'danger', title: 'The fields and formulas changed while you were inserting', message: title, stale: true },
    });
  });

  it('sends a 422 back to the controls it names (a client that skipped the preview still gets the words)', () => {
    const fields = { 'input.sectionId': 'Choose a section.' };
    expect(decideSave(refusal({ fields }))).toEqual({ kind: 'fields', fields });
  });

  it('says it is not known whether the fields went in when no answer came, and that a check is the next step', () => {
    const decision = decideSave({ status: 'failed' });
    expect(decision).toEqual({
      kind: 'notice',
      notice: {
        tone: 'warn',
        title: 'We could not confirm the insert',
        message: 'The portal did not answer, so it is not known whether the fields were inserted. Check Fields and formulas before you try again.',
        stale: false,
      },
    });
  });

  it('does not offer "start again" for any other refusal', () => {
    const decision = decideSave(refusal({ httpStatus: 403, code: 'FORBIDDEN', title: 'No.' }));
    expect(decision.kind === 'notice' && decision.notice.stale).toBe(false);
  });
});
