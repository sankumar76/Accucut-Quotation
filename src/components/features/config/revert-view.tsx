import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import {
  CLOSE_LABEL,
  KEEP_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  REVERT_EFFECTS,
  REVERT_EFFECTS_LABEL,
  REVERT_LABEL,
  REVERT_UNCONFIRMED,
  REVERTING_LABEL,
  revertLead,
  revertTitle,
} from './checkpoints-texts';
import type { RevertState, RevertTarget } from './use-revert';

/**
 * What the revert dialog of SCR-21 draws (STORY-08.06 AC-4, AC-7, AC-10): what a revert does, in four sentences, the password field, and the notice of a refusal. It decides nothing: the phase and every sentence of a
 * refusal come from the hook (`use-revert.ts`) and the server.
 *
 * **Focus and keys (AC-10).** The dialog is an `alertdialog`. One form and one footer hold every state, so the safe button, "Keep the current version" (or "Close" once the revert is stopped), is the same element through
 * all of them: it takes focus when the dialog opens. A password the server refused is emptied and takes focus back with its sentence under the field (which the field's `aria-describedby` reads out); a block is a
 * danger alert that holds focus. The password is held here and cleared as soon as it is sent, whatever the answer is.
 */

const PASSWORD_FIELD_ID = 'revert-password';
const ALERT_ID = 'revert-alert';

type RevertPanelState = Pick<RevertState, 'phase' | 'passwordError' | 'submit'>;

export function RevertPanel({ target, baseVersion, state }: { readonly target: RevertTarget; readonly baseVersion: number; readonly state: RevertPanelState }) {
  const { phase, passwordError } = state;
  const [password, setPassword] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const confirming = phase.kind === 'confirm' || phase.kind === 'saving' || phase.kind === 'locked';
  const pending = phase.kind === 'saving';
  const locked = phase.kind === 'locked' ? phase.message : null;
  const stopped = phase.kind === 'stopped' ? phase.message : phase.kind === 'unconfirmed' ? REVERT_UNCONFIRMED : null;

  // A refused password takes focus back to the field, empty, ready to be typed again; a block takes it to the alert, which says why.
  useEffect(() => {
    if (pending) return;
    if (locked !== null) alert.current?.focus();
    else if (passwordError !== null) field.current?.focus();
  }, [pending, passwordError, locked]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!confirming || pending || password === '') return;
    const sent = password;
    setPassword('');
    await state.submit(sent);
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{revertTitle(target.name, target.versionNumber)}</AlertDialogTitle>
        <AlertDialogDescription>{revertLead(target.versionNumber, baseVersion + 1)}</AlertDialogDescription>
      </AlertDialogHeader>
      <ul aria-label={REVERT_EFFECTS_LABEL} className={cn('flex list-disc flex-col gap-s-1 pl-s-5 text-ink-2')}>
        {REVERT_EFFECTS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {locked === null ? null : (
        <div id={ALERT_ID} ref={alert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{locked}</Notice>
        </div>
      )}
      {stopped === null ? null : <Notice tone="danger">{stopped}</Notice>}
      {confirming ? (
        <FormField id={PASSWORD_FIELD_ID} label={PASSWORD_LABEL} hint={PASSWORD_HINT} {...(passwordError === null ? {} : { error: passwordError })}>
          {(control) => (
            <PasswordInput {...control} ref={field} name="password" autoComplete="current-password" required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} />
          )}
        </FormField>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{confirming ? KEEP_LABEL : CLOSE_LABEL}</AlertDialogCancel>
        {confirming ? (
          <Button type="submit" variant="danger" loading={pending} disabled={password === ''}>
            {pending ? REVERTING_LABEL : REVERT_LABEL}
          </Button>
        ) : null}
      </AlertDialogFooter>
    </form>
  );
}
