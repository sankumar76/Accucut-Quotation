'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { PasswordInput } from '@/components/shared/password-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { CANCEL_LABEL, PASSWORD_DESCRIPTION, PASSWORD_FIELD_LABEL, PASSWORD_TITLE, SAVE_LABEL, SAVING_LABEL } from './formula-editor-texts';

/**
 * "Confirm with your password" (STORY-08.02 AC-4; SCR-18 password step; FR-080, NFR-004; ADR-009): the step-up every save of a formula asks for. The password is held only in this form's own state, is sent once with the
 * save and is cleared as soon as an answer comes, so a wrong one is typed again and none stays in the page. The words of a refusal are the screen's, built from the server's sentence (`stepUpFailedLine`,
 * `stepUpLockedLine`), and shown under the field. Escape and Cancel close the dialog with nothing sent and the formula kept; neither works while the save is under way.
 */

export interface FormulaPasswordDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly pending: boolean;
  /** The sentence under the field after a refused password, or `null`. */
  readonly error: string | null;
  /** Sends the save. Resolves when the answer is in, so the form can clear the password and take focus back. */
  readonly onSubmit: (password: string) => Promise<void>;
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts with an empty password. */
function PasswordForm({ pending, error, onSubmit }: Pick<FormulaPasswordDialogProps, 'pending' | 'error' | 'onSubmit'>) {
  const [password, setPassword] = useState('');
  const field = useRef<HTMLInputElement>(null);

  // A refused password takes focus back to the field, empty, ready to be typed again.
  useEffect(() => {
    if (!pending && error !== null) field.current?.focus();
  }, [pending, error]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || password === '') return;
    const sent = password;
    setPassword('');
    await onSubmit(sent);
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>{PASSWORD_TITLE}</DialogTitle>
        <DialogDescription>{PASSWORD_DESCRIPTION}</DialogDescription>
      </DialogHeader>
      <FormField id="formula-password" label={PASSWORD_FIELD_LABEL} {...(error === null ? {} : { error })}>
        {(control) => (
          <PasswordInput {...control} ref={field} name="password" autoComplete="current-password" required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={pending}>
            {CANCEL_LABEL}
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending} disabled={password === ''}>
          {pending ? SAVING_LABEL : SAVE_LABEL}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FormulaPasswordDialog({ open, onOpenChange, pending, error, onSubmit }: FormulaPasswordDialogProps) {
  return (
    // Escape and the way out do nothing while the save is under way: it cannot be recalled.
    <Dialog open={open} onOpenChange={(next) => (next || !pending ? onOpenChange(next) : undefined)}>
      <DialogContent>
        <PasswordForm pending={pending} error={error} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}
