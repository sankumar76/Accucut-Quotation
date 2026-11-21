'use client';

import { useRef, useState, type RefObject } from 'react';

import { checkCheckpointName } from '@/lib/config/checkpoint';
import { saveCheckpoint } from '@/lib/config/checkpoints-client';
import { phaseAfterSave } from '@/lib/config/checkpoints-phase';

import { savedNotice, SAVE_UNCONFIRMED } from './checkpoints-texts';

/**
 * The save form of SCR-21 and everything it holds (STORY-08.06 AC-2, AC-10), apart from how it looks: the typed name, the message under the field, and the notice after a save. An empty or too-long name is said at once,
 * with the same words the server uses (`lib/config/checkpoint.ts`), and sends nothing; whatever the server refuses (a name that is taken, any other) is its sentence under the field. Focus goes to the field when a
 * name is refused, so the Admin can type again; after a save the field is empty and keeps focus out of the way (the notice is a polite status).
 */

export interface SaveCheckpoint {
  readonly name: string;
  readonly setName: (name: string) => void;
  readonly error: string | null;
  /** The sentence shown after a save, or after a lost answer; `null` when there is none. */
  readonly notice: { readonly tone: 'success' | 'danger'; readonly text: string } | null;
  readonly saving: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly submit: () => Promise<void>;
}

export function useSaveCheckpoint({ onChanged }: { readonly onChanged: () => void }): SaveCheckpoint {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveCheckpoint['notice']>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  async function submit(): Promise<void> {
    if (inFlight.current) return;
    setNotice(null);
    const checked = checkCheckpointName(name);
    if (!checked.ok) {
      setError(checked.message);
      inputRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setError(null);
    setSaving(true);
    const change = phaseAfterSave(await saveCheckpoint(checked.name));
    inFlight.current = false;
    setSaving(false);
    if ('saved' in change) {
      setName('');
      setNotice({ tone: 'success', text: savedNotice(change.saved.name) });
      onChanged();
      return;
    }
    if ('nameError' in change) {
      setError(change.nameError);
      inputRef.current?.focus();
      return;
    }
    setNotice({ tone: 'danger', text: SAVE_UNCONFIRMED });
    onChanged();
  }

  return {
    name,
    setName: (next) => {
      setName(next);
      setError(null);
    },
    error,
    notice,
    saving,
    inputRef,
    submit,
  };
}
