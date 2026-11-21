import { describe, expect, it } from 'vitest';

import { listCheckpoints, readCurrentVersion, revertToVersion, saveCheckpoint } from '@/lib/config/checkpoints-client';
import { phaseAfterRevert, phaseAfterSave, type RevertPhase } from '@/lib/config/checkpoints-phase';
import type { Outcome } from '@/lib/api-client';
import { CONFIG_VERSION_CHANGED_CODE, STEP_UP_FAILED_CODE, STEP_UP_LOCKED_CODE } from '@/lib/errors';

/**
 * STORY-08.06 AC-2 to AC-4, AC-7, AC-10: the browser's side of the three routes, and what the screen shows after each answer, as pure rules with no browser. The server decides everything (the role, the target, the
 * base version, the password); these files only turn its answers into values the screen can show. Every name is invented.
 */

const ROW = { id: '00000000-0000-4000-8000-0ddd00000001', name: 'Before AY insert', versionId: '00000000-0000-4000-8000-0ccc00000007', versionNumber: 7, savedAt: '2026-11-01T11:30:00.000Z', savedBy: 'Invented Admin' };

const answer = (status: number, body: unknown): typeof fetch => () => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } }));
const problem = (status: number, code: string, title: string, extra: Record<string, unknown> = {}): typeof fetch => answer(status, { type: 'about:blank', title, status, code, ...extra });

describe('the three calls', () => {
  it('reads the list, a row by row, and refuses an answer that is not a list of rows', async () => {
    expect(await listCheckpoints(answer(200, { checkpoints: [ROW] }))).toEqual({ status: 'ok', value: [ROW] });
    expect(await listCheckpoints(answer(200, { checkpoints: [{ ...ROW, versionNumber: 'seven' }] }))).toEqual({ status: 'failed' });
    expect(await listCheckpoints(answer(200, { rows: [] }))).toEqual({ status: 'failed' });
  });

  it('reads the current version line', async () => {
    const line = { number: 9, savedBy: null, savedAt: '2026-11-02T06:00:00.000Z', estimatesInUse: 3 };
    expect(await readCurrentVersion(answer(200, line))).toEqual({ status: 'ok', value: line });
    expect(await readCurrentVersion(answer(200, { number: '9' }))).toEqual({ status: 'failed' });
  });

  it('saves a name and sends it in the body', async () => {
    let sent: { url: string; init: RequestInit | undefined } | undefined;
    const doFetch: typeof fetch = (url, init) => {
      sent = { url: String(url), init };
      return answer(201, ROW)(url, init);
    };
    expect(await saveCheckpoint('Before AY insert', doFetch)).toEqual({ status: 'ok', value: ROW });
    expect(sent?.url).toBe('/api/v1/config/checkpoints');
    expect(sent?.init?.method).toBe('POST');
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ name: 'Before AY insert' });
  });

  it('reverts by version ID with the password and the base version in the body, and reads the answer', async () => {
    let sent: { url: string; init: RequestInit | undefined } | undefined;
    const doFetch: typeof fetch = (url, init) => {
      sent = { url: String(url), init };
      return answer(200, { version: 9, copiedFrom: 7, undoVersionId: ROW.versionId })(url, init);
    };
    expect(await revertToVersion(ROW.versionId, 'Invented-pw-1', 8, doFetch)).toEqual({ status: 'ok', value: { version: 9, copiedFrom: 7, undoVersionId: ROW.versionId } });
    expect(sent?.url).toBe(`/api/v1/config/versions/${ROW.versionId}/revert`);
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ password: 'Invented-pw-1', baseVersion: 8 });
  });

  it('says "failed" for an answer that is not the revert\'s', async () => {
    expect(await revertToVersion(ROW.versionId, 'x', 8, answer(200, { version: 9 }))).toEqual({ status: 'failed' });
  });
});

describe('AC-2: what the screen shows after a save', () => {
  it('a saved checkpoint is the saved notice with its name', async () => {
    expect(phaseAfterSave(await saveCheckpoint('x', answer(201, ROW)))).toEqual({ saved: ROW });
  });

  it('a name the server refuses is its sentence under the name field, for the empty, the long and the taken name alike', async () => {
    expect(phaseAfterSave(await saveCheckpoint('', problem(422, 'VALIDATION_FAILED', 'Check the form.', { errors: [{ field: 'name', message: 'Enter a name for this checkpoint.' }] })))).toEqual({ nameError: 'Enter a name for this checkpoint.' });
    expect(phaseAfterSave(await saveCheckpoint('x', problem(409, 'CHECKPOINT_NAME_TAKEN', 'A checkpoint with this name already exists. Names must be unique.')))).toEqual({
      nameError: 'A checkpoint with this name already exists. Names must be unique.',
    });
  });

  it('a lost answer says so and asks the screen to read the list again, because the save may have gone through', async () => {
    expect(phaseAfterSave({ status: 'failed' })).toMatchObject({ unconfirmed: true });
  });
});

describe('AC-4 and AC-7: what the revert dialog shows after the answer', () => {
  const revert = async (fetcher: typeof fetch): Promise<ReturnType<typeof phaseAfterRevert>> => phaseAfterRevert(await revertToVersion(ROW.versionId, 'pw', 8, fetcher));

  it('success is the new version and the undo, and nothing else', async () => {
    expect(await revert(answer(200, { version: 9, copiedFrom: 7, undoVersionId: '00000000-0000-4000-8000-0ccc00000008' }))).toEqual({ reverted: { version: 9, copiedFrom: 7, undoVersionId: '00000000-0000-4000-8000-0ccc00000008' } });
  });

  it('a wrong password stays on the confirm state with the sentence and "Try again" under the field', async () => {
    expect(await revert(problem(422, STEP_UP_FAILED_CODE, 'That password is not correct.'))).toEqual({
      phase: { kind: 'confirm' } satisfies RevertPhase,
      passwordError: 'That password is not correct. Try again.',
      stale: false,
    });
  });

  it('a block (429) is its own state with the sentence that says the configuration is not changed', async () => {
    expect(await revert(problem(429, STEP_UP_LOCKED_CODE, 'Too many wrong passwords. Try again in 15 minutes.'))).toEqual({
      phase: { kind: 'locked', message: 'Too many wrong passwords. Try again in 15 minutes. The configuration is not changed.' },
      passwordError: null,
      stale: false,
    });
  });

  it('a version that moved on, nothing to revert, an unusable target and a version that is gone are stopped with the server\'s sentence, and the lists are read again', async () => {
    expect(await revert(problem(409, CONFIG_VERSION_CHANGED_CODE, 'The configuration was changed while you were reverting.'))).toEqual({
      phase: { kind: 'stopped', message: 'The configuration was changed while you were reverting.' },
      passwordError: null,
      stale: true,
    });
    expect(await revert(problem(409, 'NOTHING_TO_REVERT', 'This checkpoint is the same as the current configuration.'))).toMatchObject({ phase: { kind: 'stopped', message: 'This checkpoint is the same as the current configuration.' }, stale: true });
    expect(await revert(problem(422, 'VALIDATION_FAILED', 'AL Cutting Cost uses a rate that is no longer in the Process master.', { errors: [{ field: 'AL Cutting Cost', message: 'AL Cutting Cost uses a rate that is no longer in the Process master.' }] }))).toMatchObject({
      phase: { kind: 'stopped', message: 'AL Cutting Cost uses a rate that is no longer in the Process master.' },
      stale: false,
    });
    expect(await revert(problem(404, 'NOT_FOUND', 'Not found.'))).toMatchObject({ phase: { kind: 'stopped' }, stale: true });
  });

  it('a lost answer is "unconfirmed" and asks for the lists to be read again, because the revert may have gone through', () => {
    const lost: Outcome<never> = { status: 'failed' };
    expect(phaseAfterRevert(lost)).toEqual({ phase: { kind: 'unconfirmed' }, passwordError: null, stale: true });
  });
});
