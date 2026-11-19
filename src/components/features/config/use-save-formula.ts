'use client';

import { useState } from 'react';

import { saveFormula } from '@/lib/config/formula-editor-client';
import { CONFIG_VERSION_CHANGED_CODE, STEP_UP_FAILED_CODE, STEP_UP_LOCKED_CODE } from '@/lib/errors';

import { SAVE_UNCONFIRMED, STALE_TITLE, stepUpFailedLine, stepUpLockedLine } from './formula-editor-texts';

/**
 * What saving a formula does on SCR-18 (STORY-08.02 AC-4, AC-5, AC-9): the password step, then one `PUT`. A wrong password or a block keeps the dialog open with the screen's words under the field (the server's
 * sentence and what to do), and the formula is kept. A formula the server refuses after all, or a version that moved on, closes the dialog and says so above the formula, with the server's own sentence. A save that
 * got no usable answer says it is not known whether it went through (the portal may have stored it). The password is an argument of `submit` and is never kept here.
 */

export interface SaveNotice {
  readonly tone: 'success' | 'danger';
  readonly title?: string;
  readonly message: string;
  /** The version moved on under the editor: the only way on is to open it again. */
  readonly stale: boolean;
}

export interface SaveFormula {
  readonly dialogOpen: boolean;
  readonly setDialogOpen: (open: boolean) => void;
  readonly pending: boolean;
  /** The sentence under the password field. */
  readonly error: string | null;
  readonly notice: SaveNotice | null;
  readonly submit: (password: string) => Promise<void>;
}

export interface SaveFormulaInput {
  readonly fieldId: string;
  readonly text: string;
  /** The version the editor was opened on, or the one this editor last saved. */
  readonly baseVersion: number;
  /** The save went through: the number of the version that holds the formula now. */
  readonly onSaved: (version: number) => void;
}

export function useSaveFormula({ fieldId, text, baseVersion, onSaved }: SaveFormulaInput): SaveFormula {
  const [dialogOpen, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);

  function setDialogOpen(open: boolean): void {
    setOpen(open);
    if (open) {
      setError(null);
      setNotice(null);
    }
  }

  async function submit(password: string): Promise<void> {
    setPending(true);
    setError(null);
    const outcome = await saveFormula(fieldId, { text, password, baseVersion });
    setPending(false);
    if (outcome.status === 'ok') {
      setOpen(false);
      setNotice({ tone: 'success', message: outcome.value.message, stale: false });
      onSaved(outcome.value.version);
      return;
    }
    if (outcome.status === 'failed') return setError(SAVE_UNCONFIRMED);
    if (outcome.code === STEP_UP_FAILED_CODE) return setError(stepUpFailedLine(outcome.title));
    if (outcome.code === STEP_UP_LOCKED_CODE) return setError(stepUpLockedLine(outcome.title));
    setOpen(false);
    if (outcome.code === CONFIG_VERSION_CHANGED_CODE) return setNotice({ tone: 'danger', title: STALE_TITLE, message: outcome.title, stale: true });
    return setNotice({ tone: 'danger', message: outcome.fields['text'] ?? outcome.title, stale: false });
  }

  return { dialogOpen, setDialogOpen, pending, error, notice, submit };
}
