import { describe, expect, it, vi } from 'vitest';

import {
  initialTreatmentValues,
  newTreatmentBody,
  TREATMENT_NAME_MAX_LENGTH,
  treatmentChangesFrom,
  treatmentEditChanges,
  treatmentFormProblems,
  withoutTreatmentError,
} from '@/lib/masters/treatments';
import {
  deleteTreatmentDescription,
  OTHER_LOCKED_REASON,
  treatmentNotice,
  treatmentRenamedNotice,
} from '@/components/features/masters/treatment-texts';
import { createTreatment, deleteTreatment, listTreatments, toTreatmentRow, updateTreatment } from '@/lib/masters/treatments-client';

/**
 * STORY-02.05 T2 and T4 (AC-1, AC-2, AC-4): the pure rules the Treatment / Color form and its routes share (`src/lib/masters/treatments.ts`), and the
 * browser's side of the four routes (`treatments-client.ts`), which takes `fetch` as an argument so each test answers for the server. Names are invented.
 */

const ROW = { id: '00000000-0000-4000-8000-000700000c01', name: 'Invented powder coat', locked: false };

function answer(status: number, body: unknown): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
}

describe('the name field (AC-2)', () => {
  it('asks for a name, and not for more than 100 characters, in the words of SCR-11', () => {
    expect(treatmentFormProblems({ name: '' })).toEqual({ name: 'Enter a name.' });
    expect(treatmentFormProblems({ name: '   ' })).toEqual({ name: 'Enter a name.' });
    expect(treatmentFormProblems({ name: 'x'.repeat(TREATMENT_NAME_MAX_LENGTH + 1) })).toEqual({ name: 'Use 100 characters or fewer.' });
  });

  it('accepts a name of exactly 100 characters, and says nothing about a name the system keeps (that is the server\'s, and its words name nothing)', () => {
    expect(treatmentFormProblems({ name: 'x'.repeat(TREATMENT_NAME_MAX_LENGTH) })).toEqual({});
    expect(treatmentFormProblems({ name: 'other' })).toEqual({});
    expect(treatmentFormProblems({ name: 'Not applicable' })).toEqual({});
  });
});

describe('what a rename changes', () => {
  const before = { name: 'Powder coat' };

  it('is the name when it differs as written, so a change of letter case counts', () => {
    expect(treatmentChangesFrom(before, { name: 'Powder Coat' })).toEqual({ name: 'Powder Coat' });
    expect(treatmentChangesFrom(before, { name: 'Anodised' })).toEqual({ name: 'Anodised' });
  });

  it('is nothing for the same name, or no name', () => {
    expect(treatmentChangesFrom(before, { name: 'Powder coat' })).toEqual({});
    expect(treatmentChangesFrom(before, {})).toEqual({});
  });

  it('ignores spaces around the name in a form (a rename to the same name with spaces changes nothing)', () => {
    expect(treatmentEditChanges(before, { name: '  Powder coat ' })).toEqual({});
    expect(treatmentEditChanges(before, { name: ' Anodised ' })).toEqual({ name: 'Anodised' });
  });
});

describe('the form', () => {
  it('starts empty for an add and from the treatment\'s own name for a rename', () => {
    expect(initialTreatmentValues(null)).toEqual({ name: '' });
    expect(initialTreatmentValues({ name: 'Powder coat' })).toEqual({ name: 'Powder coat' });
  });

  it('sends the name trimmed', () => {
    expect(newTreatmentBody({ name: '  Powder coat  ' })).toEqual({ name: 'Powder coat' });
  });

  it('removes the message of a field once the person changes that field, and keeps the others', () => {
    expect(withoutTreatmentError({ name: 'Enter a name.' }, 'name')).toEqual({});
  });

  it('gives "Other" a visible reason in words (AC-1)', () => {
    expect(OTHER_LOCKED_REASON).toBe('Always offered; the Engineer types the text');
  });
});

describe('the words of ux-spec v0.22', () => {
  it('the renamed notice names the old and the new name and has no audit-log clause', () => {
    expect(treatmentRenamedNotice('Textured grey', 'Brushed finish')).toEqual({ tone: 'success', text: 'Textured grey was renamed to Brushed finish.' });
  });

  it('the added and deleted notices keep the audit-log clause', () => {
    expect(treatmentNotice('added', 'Brushed finish').text).toBe('Brushed finish was added. The change is in the audit log.');
    expect(treatmentNotice('deleted', 'Brushed finish').text).toBe('Brushed finish was deleted. The change is in the audit log.');
  });

  it('the delete text says what stays and how to bring the treatment back, and claims nothing about a draft', () => {
    expect(deleteTreatmentDescription('Brushed finish')).toBe(
      'Brushed finish is removed from the Treatment / Color list. Estimates that are already calculated keep the treatment they show. To bring it back, add it again.',
    );
  });
});

describe('the browser\'s side of the routes', () => {
  it('lists with GET and reads the rows, the locked one included', async () => {
    const locked = { id: '00000000-0000-4000-8000-000700000001', name: 'Other', locked: true };
    const doFetch = answer(200, { treatments: [locked, ROW] });
    expect(await listTreatments(doFetch)).toEqual({ status: 'ok', value: [locked, ROW] });
    expect(doFetch).toHaveBeenCalledWith('/api/v1/treatments', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('adds with POST, renames with PATCH to the ID, and deletes with DELETE and a 204', async () => {
    const add = answer(201, ROW);
    expect(await createTreatment({ name: ROW.name }, add)).toEqual({ status: 'ok', value: ROW });
    expect(add).toHaveBeenCalledWith('/api/v1/treatments', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: ROW.name }) }));
    const rename = answer(200, ROW);
    expect(await updateTreatment(ROW.id, { name: ROW.name }, rename)).toEqual({ status: 'ok', value: ROW });
    expect(rename).toHaveBeenCalledWith(`/api/v1/treatments/${ROW.id}`, expect.objectContaining({ method: 'PATCH' }));
    const remove = answer(204, undefined);
    expect(await deleteTreatment(ROW.id, remove)).toEqual({ status: 'ok', value: true });
    expect(remove).toHaveBeenCalledWith(`/api/v1/treatments/${ROW.id}`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('reads a refusal with the message of the field it names', async () => {
    const problem = { type: 'about:blank', title: 'Validation failed', status: 422, code: 'NAME_RESERVED', errors: [{ field: 'name', message: 'That name cannot be used.' }] };
    expect(await createTreatment({ name: 'other' }, answer(422, problem))).toMatchObject({
      status: 'refused',
      httpStatus: 422,
      code: 'NAME_RESERVED',
      fields: { name: 'That name cannot be used.' },
    });
  });

  it('calls a server fault, a network fault and an answer of the wrong shape "failed", and never crashes', async () => {
    expect(await listTreatments(answer(503, { code: 'DATABASE_BUSY', title: 'Busy' }))).toEqual({ status: 'failed' });
    expect(await listTreatments(vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ status: 'failed' });
    expect(await listTreatments(answer(200, { treatments: [{ id: 1 }] }))).toEqual({ status: 'failed' });
    expect(await listTreatments(answer(200, { treatments: [{ id: 'x', name: 'y' }] }))).toEqual({ status: 'failed' });
    expect(toTreatmentRow(null)).toBeNull();
  });
});
