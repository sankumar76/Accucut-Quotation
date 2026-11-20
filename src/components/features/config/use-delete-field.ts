'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { deleteConfigField, listFieldReferences } from '@/lib/config/delete-field-client';
import { phaseAfterDelete, phaseAfterRead, type DeletePhase } from '@/lib/config/delete-field-phase';

/**
 * What the delete dialog of SCR-20 holds and does (STORY-08.04 AC-2 to AC-4), apart from how it looks. It reads what uses the field when it opens (so a blocked field is told so before any password is asked for), then
 * either shows the blocked list or the confirm state, and sends the delete with the password. The server judges everything (the role, the field, the references, the password, the version); what to show for each
 * answer is `lib/config/delete-field-phase.ts`, so it is tested without a browser.
 *
 * **The password** is an argument of `submit` and is never kept here: it is sent in the one request and the form clears it as soon as the answer is in. A wrong password stays in the confirm state with the screen's words
 * under the field. A field that something started to use since the dialog opened, a version that moved on, a field that is gone and an answer that was lost all ask the screen to read the list again, because it is out
 * of date or the delete may have gone through.
 */

export interface DeleteTarget {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
}

export interface DeleteFieldInputs {
  readonly target: DeleteTarget;
  /** The delete worked: the sentence to show. The screen reads the list again and shows it. */
  readonly onDeleted: (message: string) => void;
  /** The list is out of date, or no usable answer came: read it again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  /** True while the delete is under way. A ref, not state: a second press must not send a second request, and the dialog's shell reads it so the dialog cannot be dismissed meanwhile (the delete cannot be recalled). */
  readonly inFlightRef: RefObject<boolean>;
}

export function useDeleteField({ target, onDeleted, onStale, inFlightRef }: DeleteFieldInputs) {
  const [phase, setPhase] = useState<DeletePhase>({ kind: 'loading' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The screen's callbacks are read when an answer comes, not when the dialog was opened, so a new function never starts a new read.
  const callbacks = useRef({ onDeleted, onStale });
  useEffect(() => {
    callbacks.current = { onDeleted, onStale };
  });

  // The read starts when the dialog opens, and again for "Try again". The state is set in the callback, never in the effect body.
  useEffect(() => {
    let current = true;
    void listFieldReferences(target.id).then((outcome) => {
      if (!current) return;
      const change = phaseAfterRead(outcome);
      setPhase(change.phase);
      if (change.stale) callbacks.current.onStale();
    });
    return () => {
      current = false;
    };
  }, [target.id, attempt]);

  const retry = (): void => {
    setPhase({ kind: 'loading' });
    setAttempt((count) => count + 1);
  };

  async function submit(password: string): Promise<void> {
    if (inFlightRef.current || password === '') return;
    inFlightRef.current = true;
    setPasswordError(null);
    setPhase({ kind: 'saving' });
    const change = phaseAfterDelete(await deleteConfigField(target.id, password));
    inFlightRef.current = false;
    if ('deleted' in change) return callbacks.current.onDeleted(change.deleted);
    setPasswordError(change.passwordError);
    setPhase(change.phase);
    if (change.stale) callbacks.current.onStale();
  }

  return { phase, passwordError, submit, retry };
}

export type DeleteField = ReturnType<typeof useDeleteField>;
