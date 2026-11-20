import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { assertNever } from '@/lib/assert-never';
import { cn } from '@/lib/cn';
import { blockedTitle, CANNOT_CHANGE_YET, canEditUse, usesSentence, usageTitle, type FieldUse } from '@/lib/fields/uses';

import {
  CHECK_FAILED_LINE,
  CHECK_RETRY,
  CHECKING_LINE,
  CLOSE_LABEL,
  CONFIRM_LINE,
  DELETE_LABEL,
  DELETE_UNCONFIRMED,
  DELETING_LABEL,
  deleteTitle,
  EDIT_LABEL,
  KEEP_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  USES_LIST_LABEL,
} from './delete-field-texts';
import type { DeleteField, DeleteTarget } from './use-delete-field';

/**
 * What the delete dialog of SCR-20 draws for each of its states (STORY-08.04 AC-2, AC-3, AC-4, AC-10): the blocked list ("Blocked by formulas"), the confirm state with the password, and the notices of the others. It
 * decides nothing: the phase and every sentence come from the hook (`use-delete-field.ts`) and the server.
 *
 * **Focus and keys (AC-10).** The dialog is an `alertdialog`. One form and one footer hold every state, so the safe button, "Keep the field" (or "Close" when there is nothing to confirm), is the same element through
 * all of them: it takes focus when the dialog opens and keeps it when the references arrive. The list of uses is a real list; each Edit is a link, so it works with the keyboard. A password the server refused is emptied
 * and takes focus back with its sentence under the field (which the field's `aria-describedby` reads out); a block is a danger alert that holds focus.
 */

const PASSWORD_FIELD_ID = 'delete-field-password';
const ALERT_ID = 'delete-field-alert';

/** `AY Total Process Cost`, its formula in the mono face (it wraps anywhere), and an Edit link for it (SCR-18); a use that is not a formula says it cannot be changed yet, and has no link. */
function UseItem({ use }: { readonly use: FieldUse }) {
  return (
    <li className="flex flex-col gap-s-2 border-b border-border py-s-3 first:pt-0 last:border-b-0 last:pb-0" data-use={use.kind}>
      <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{usageTitle(use)}</span>
      {canEditUse(use) ? (
        <>
          <code className={cn('font-mono text-body text-ink', BREAK_LONG_NAMES)}>{use.formula}</code>
          <Button asChild variant="secondary" className="self-start">
            <Link href={`/config/fields/${use.fieldId}/formula`}>
              {EDIT_LABEL}
              <span className="sr-only"> {usageTitle(use)}</span>
            </Link>
          </Button>
        </>
      ) : (
        <span className="text-label text-ink-2">{CANNOT_CHANGE_YET}</span>
      )}
    </li>
  );
}

const usageKey = (use: FieldUse): string => `${use.kind}-${use.kind === 'stage-total' ? use.stageId : use.fieldId}`;

/** "Blocked by formulas": every use, as a list (AC-2). No password field. */
function BlockedBody({ target, uses }: { readonly target: DeleteTarget; readonly uses: ReadonlyArray<FieldUse> }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{blockedTitle(target.letter, target.label)}</AlertDialogTitle>
        <AlertDialogDescription>{usesSentence(uses)}</AlertDialogDescription>
      </AlertDialogHeader>
      <ul aria-label={USES_LIST_LABEL} className="flex max-h-[50vh] flex-col overflow-y-auto">
        {uses.map((use) => (
          <UseItem key={usageKey(use)} use={use} />
        ))}
      </ul>
    </>
  );
}

function Header({ target, children }: { readonly target: DeleteTarget; readonly children: ReactNode }) {
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>{deleteTitle(target.letter, target.label)}</AlertDialogTitle>
      {children}
    </AlertDialogHeader>
  );
}

/** What is above the password field, or instead of it: the sentence of the state and the notice that goes with it. */
function PhaseBody({ target, state }: { readonly target: DeleteTarget; readonly state: Pick<DeleteField, 'phase'> }) {
  const { phase } = state;
  switch (phase.kind) {
    case 'loading':
      return (
        <Header target={target}>
          <AlertDialogDescription role="status">{CHECKING_LINE}</AlertDialogDescription>
        </Header>
      );
    case 'blocked':
      return <BlockedBody target={target} uses={phase.uses} />;
    case 'confirm':
    case 'saving':
    case 'locked':
      return (
        <Header target={target}>
          <AlertDialogDescription>{CONFIRM_LINE}</AlertDialogDescription>
        </Header>
      );
    case 'load-failed':
      return (
        <>
          <Header target={target}>
            <AlertDialogDescription className="sr-only">{CHECK_FAILED_LINE}</AlertDialogDescription>
          </Header>
          <Notice tone="danger">{CHECK_FAILED_LINE}</Notice>
        </>
      );
    case 'stopped':
    case 'unconfirmed':
      return (
        <>
          <Header target={target}>
            <AlertDialogDescription className="sr-only">{phase.kind === 'stopped' ? phase.message : DELETE_UNCONFIRMED}</AlertDialogDescription>
          </Header>
          <Notice tone="danger">{phase.kind === 'stopped' ? phase.message : DELETE_UNCONFIRMED}</Notice>
        </>
      );
    default:
      return assertNever(phase, 'delete phase');
  }
}

type DeletePanelState = Pick<DeleteField, 'phase' | 'passwordError' | 'submit' | 'retry'>;

/** The whole dialog body: one form, one footer, for every state (see the note above on focus). The password is held here and cleared as soon as it is sent, whatever the answer is. */
export function DeleteFieldPanel({ target, state }: { readonly target: DeleteTarget; readonly state: DeletePanelState }) {
  const { phase, passwordError } = state;
  const [password, setPassword] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const confirming = phase.kind === 'confirm' || phase.kind === 'saving' || phase.kind === 'locked';
  const pending = phase.kind === 'saving';
  const locked = phase.kind === 'locked' ? phase.message : null;

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
      <PhaseBody target={target} state={state} />
      {locked === null ? null : (
        <div id={ALERT_ID} ref={alert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{locked}</Notice>
        </div>
      )}
      {confirming ? (
        <FormField id={PASSWORD_FIELD_ID} label={PASSWORD_LABEL} hint={PASSWORD_HINT} {...(passwordError === null ? {} : { error: passwordError })}>
          {(control) => (
            <PasswordInput {...control} ref={field} name="password" autoComplete="current-password" required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} />
          )}
        </FormField>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{confirming || phase.kind === 'loading' ? KEEP_LABEL : CLOSE_LABEL}</AlertDialogCancel>
        {confirming ? (
          <Button type="submit" variant="danger" loading={pending} disabled={password === ''}>
            {pending ? DELETING_LABEL : DELETE_LABEL}
          </Button>
        ) : null}
        {phase.kind === 'load-failed' ? (
          <Button type="button" onClick={state.retry}>
            {CHECK_RETRY}
          </Button>
        ) : null}
      </AlertDialogFooter>
    </form>
  );
}
