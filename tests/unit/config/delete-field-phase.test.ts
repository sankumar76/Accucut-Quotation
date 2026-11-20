import { describe, expect, it } from 'vitest';

import type { Refusal } from '@/lib/api-client';
import { phaseAfterDelete, phaseAfterRead } from '@/lib/config/delete-field-phase';
import type { FieldUse } from '@/lib/fields/uses';

/**
 * STORY-08.04 AC-2, AC-3, AC-4: what the delete dialog shows after each answer of the server, as pure rules (the dialog itself is Playwright's, `tests/e2e/delete-field.spec.ts`): the references read decides between the
 * blocked list and the confirm state; a delete answers the success, a wrong password under the field, a block, a field that something uses now, a version that moved on, a field that is gone, or a lost answer. The
 * words under the field are the screen's, built from the server's own sentence. Every name is invented.
 */

const FORMULA_USE: FieldUse = { kind: 'formula', fieldId: 'f1', letter: 'AY', label: 'Total Process Cost', formula: 'AL + AM' };

const refusal = (httpStatus: number, code: string, title: string, body: Record<string, unknown> = {}): Refusal => ({ status: 'refused', httpStatus, code, title, fields: {}, body: { code, title, ...body } });

describe('the references read (AC-2)', () => {
  const view = (uses: ReadonlyArray<FieldUse>) => ({ status: 'ok' as const, value: { fieldId: 'x', letter: 'AL', label: 'Cutting Cost', uses } });

  it('shows the confirm state when nothing uses the field, and the blocked list when something does', () => {
    expect(phaseAfterRead(view([]))).toEqual({ phase: { kind: 'confirm' }, stale: false });
    expect(phaseAfterRead(view([FORMULA_USE]))).toEqual({ phase: { kind: 'blocked', uses: [FORMULA_USE] }, stale: false });
  });

  it('shows the server\'s sentence for a refusal (a System field), and a "no longer in the worksheet" line, with the list read again, for a field that is gone', () => {
    expect(phaseAfterRead(refusal(409, 'SYSTEM_FIELD', 'This is a System field.'))).toEqual({ phase: { kind: 'stopped', message: 'This is a System field.' }, stale: false });
    expect(phaseAfterRead(refusal(404, 'NOT_FOUND', 'Not found.'))).toEqual({ phase: { kind: 'stopped', message: 'This field is no longer in the worksheet. The list is being updated.' }, stale: true });
  });

  it('offers "Try again" when no usable answer came', () => {
    expect(phaseAfterRead({ status: 'failed' })).toEqual({ phase: { kind: 'load-failed' }, stale: false });
  });
});

describe('the delete (AC-3, AC-4)', () => {
  it('is a success with the server\'s sentence', () => {
    expect(phaseAfterDelete({ status: 'ok', value: { version: 11, message: 'Field deleted. Configuration version 11.' } })).toEqual({ deleted: 'Field deleted. Configuration version 11.' });
  });

  it('keeps the confirm state for a wrong password, with the screen\'s words under the field built from the server\'s sentence', () => {
    expect(phaseAfterDelete(refusal(422, 'STEP_UP_FAILED', 'That password is not correct.'))).toEqual({
      phase: { kind: 'confirm' },
      passwordError: 'That password is not correct. Try again.',
      stale: false,
    });
  });

  it('shows a block above the field with "The field is not deleted." after the server\'s sentence, and does not read the list again', () => {
    expect(phaseAfterDelete(refusal(429, 'STEP_UP_LOCKED', 'Too many wrong passwords. Try again in 15 minutes.'))).toEqual({
      phase: { kind: 'locked', message: 'Too many wrong passwords. Try again in 15 minutes. The field is not deleted.' },
      passwordError: null,
      stale: false,
    });
  });

  it('turns a field that something uses now (409 FIELD_IN_USE) into the blocked list with the server\'s uses, and reads the list again', () => {
    expect(phaseAfterDelete(refusal(409, 'FIELD_IN_USE', 'Cannot delete AL Cutting Cost yet. 1 formula uses this field.', { uses: [FORMULA_USE] }))).toEqual({
      phase: { kind: 'blocked', uses: [FORMULA_USE] },
      passwordError: null,
      stale: true,
    });
  });

  it('says so, with the server\'s sentence, when the version moved on, and reads the list again', () => {
    expect(phaseAfterDelete(refusal(409, 'CONFIG_VERSION_CHANGED', 'The fields and formulas were changed while you were deleting.'))).toEqual({
      phase: { kind: 'stopped', message: 'The fields and formulas were changed while you were deleting.' },
      passwordError: null,
      stale: true,
    });
  });

  it('says the field is gone for a 404 and shows the server\'s sentence for another refusal (a System field)', () => {
    expect(phaseAfterDelete(refusal(404, 'NOT_FOUND', 'Not found.'))).toMatchObject({ phase: { kind: 'stopped', message: 'This field is no longer in the worksheet. The list is being updated.' }, stale: true });
    expect(phaseAfterDelete(refusal(409, 'SYSTEM_FIELD', 'This is a System field.'))).toEqual({ phase: { kind: 'stopped', message: 'This is a System field.' }, passwordError: null, stale: false });
  });

  it('does not claim "in use" for a FIELD_IN_USE refusal whose list is missing or empty: it is stopped with the sentence', () => {
    expect(phaseAfterDelete(refusal(409, 'FIELD_IN_USE', 'Blocked.'))).toMatchObject({ phase: { kind: 'stopped', message: 'Blocked.' }, stale: true });
    expect(phaseAfterDelete(refusal(409, 'FIELD_IN_USE', 'Blocked.', { uses: [] }))).toMatchObject({ phase: { kind: 'stopped', message: 'Blocked.' } });
  });

  it('says it is not known whether the field was deleted when no usable answer came, and reads the list again (the delete may have gone through)', () => {
    expect(phaseAfterDelete({ status: 'failed' })).toEqual({ phase: { kind: 'unconfirmed' }, passwordError: null, stale: true });
  });
});
