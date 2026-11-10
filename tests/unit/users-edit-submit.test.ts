import { describe, expect, it, vi } from 'vitest';

import { revealNearest, REVEAL_OPTIONS } from '@/lib/ui/reveal';
import { editChanges, submitEdit } from '@/lib/users/edit-submit';
import type { Outcome, UserChanges, UserRow } from '@/lib/users/users-client';

/**
 * QLT-78 (STORY-01.04, UX spec v0.14): two behaviours of SCR-14 that no test held.
 *   - Save in the Edit dialog with nothing changed makes no request at all (the dialog closes with no message).
 *   - The "did not open" notice is brought into view with `block: 'nearest'` and no smooth scroll.
 * Each test is written to fail when the behaviour is broken; the faults were planted to prove it (see the PR note).
 * Every name and address is invented.
 */

const PERSON: UserRow = { id: '00000000-0000-4000-8000-abcdef000001', name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true };

function saveSpy(outcome: Outcome<UserRow> = { status: 'ok', value: PERSON }) {
  return vi.fn((id: string, changes: UserChanges) => {
    void id;
    void changes;
    return Promise.resolve(outcome);
  });
}

describe('Edit user: Save with no change makes no request', () => {
  it('does not call the save request, and says there was nothing to save', async () => {
    const save = saveSpy();
    const result = await submitEdit(PERSON, { name: PERSON.name, role: PERSON.role }, save);
    expect(result).toEqual({ kind: 'unchanged' });
    expect(save).not.toHaveBeenCalled();
  });

  it('does not count spaces round the name as a change', async () => {
    const save = saveSpy();
    expect(await submitEdit(PERSON, { name: `  ${PERSON.name}  `, role: PERSON.role }, save)).toEqual({ kind: 'unchanged' });
    expect(save).not.toHaveBeenCalled();
  });

  it('sends only what changed: the name alone, the role alone, or both', async () => {
    const save = saveSpy();
    await submitEdit(PERSON, { name: 'Rohan D. Das', role: 'ENGINEER' }, save);
    await submitEdit(PERSON, { name: PERSON.name, role: 'LEAD' }, save);
    await submitEdit(PERSON, { name: ' Renamed ', role: 'LEAD' }, save);
    expect(save.mock.calls).toEqual([
      [PERSON.id, { name: 'Rohan D. Das' }],
      [PERSON.id, { role: 'LEAD' }],
      [PERSON.id, { name: 'Renamed', role: 'LEAD' }],
    ]);
  });

  it('hands back the server\'s answer when it did send, a refusal included', async () => {
    const refused: Outcome<UserRow> = { status: 'refused', httpStatus: 409, code: 'ADMIN_ALREADY_ACTIVE', title: 'x', fields: {}, currentAdminName: 'Invented Admin' };
    expect(await submitEdit(PERSON, { name: PERSON.name, role: 'ADMIN' }, saveSpy(refused))).toEqual({ kind: 'sent', outcome: refused });
  });

  it('editChanges is empty exactly when nothing differs', () => {
    expect(editChanges(PERSON, { name: PERSON.name, role: PERSON.role })).toEqual({});
    expect(editChanges(PERSON, { name: 'Other', role: PERSON.role })).toEqual({ name: 'Other' });
  });
});

describe('the failure notice is brought into view', () => {
  it('asks for the nearest position with no smooth scroll', () => {
    const scrollIntoView = vi.fn();
    revealNearest({ scrollIntoView });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('holds exactly those options, so no one adds a smooth scroll or a centred one', () => {
    expect(REVEAL_OPTIONS).toEqual({ block: 'nearest', behavior: 'auto' });
  });

  it('does nothing, and does not fail, when there is no notice yet', () => {
    expect(() => revealNearest(null)).not.toThrow();
    expect(() => revealNearest(undefined)).not.toThrow();
  });
});
