'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { revertToVersion, type RevertedVersion } from '@/lib/config/checkpoints-client';
import { phaseAfterRevert, type RevertPhase } from '@/lib/config/checkpoints-phase';

/**
 * What the revert dialog of SCR-21 holds and does (STORY-08.06 AC-4, AC-7, AC-10), apart from how it looks. It asks for the password and sends the revert; the server judges everything (the role, the target, the base
 * version, whether the target can be used, the password). What to show for each answer is `lib/config/checkpoints-phase.ts`, so it is tested without a browser.
 *
 * **The password** is an argument of `submit` and is never kept here: it is sent in the one request and the form clears it as soon as the answer is in. A wrong password stays in the confirm state with the screen's
 * words under the field. A version that moved on, nothing to revert, a version that is gone and an answer that was lost all ask the screen to read the lists again, because they are out of date or the revert may
 * have gone through.
 */

export interface RevertTarget {
  /** The version to copy. The revert is by this ID, so the undo of a revert, which has no checkpoint, works. */
  readonly versionId: string;
  readonly versionNumber: number;
  /** The checkpoint's name, or `null` for a version with none (an undo). */
  readonly name: string | null;
}

export interface RevertInputs {
  readonly target: RevertTarget;
  /** The number of the version the screen shows as current: the revert is made only if it still is. */
  readonly baseVersion: number;
  /** The revert worked: the screen closes the dialog and says so. */
  readonly onReverted: (result: RevertedVersion) => void;
  /** The lists are out of date, or no usable answer came: read them again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  /** True while the revert is under way. A ref, not state: a second press must not send a second request, and the dialog's shell reads it so the dialog cannot be dismissed meanwhile. */
  readonly inFlightRef: RefObject<boolean>;
}

export function useRevert({ target, baseVersion, onReverted, onStale, inFlightRef }: RevertInputs) {
  const [phase, setPhase] = useState<RevertPhase>({ kind: 'confirm' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // The screen's callbacks are read when an answer comes, not when the dialog was opened.
  const callbacks = useRef({ onReverted, onStale });
  useEffect(() => {
    callbacks.current = { onReverted, onStale };
  });

  async function submit(password: string): Promise<void> {
    if (inFlightRef.current || password === '') return;
    inFlightRef.current = true;
    setPasswordError(null);
    setPhase({ kind: 'saving' });
    const change = phaseAfterRevert(await revertToVersion(target.versionId, password, baseVersion));
    inFlightRef.current = false;
    if ('reverted' in change) return callbacks.current.onReverted(change.reverted);
    setPasswordError(change.passwordError);
    setPhase(change.phase);
    if (change.stale) callbacks.current.onStale();
  }

  return { phase, passwordError, submit };
}

export type RevertState = ReturnType<typeof useRevert>;
