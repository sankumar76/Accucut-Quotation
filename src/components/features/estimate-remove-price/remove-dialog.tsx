'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { removePrice } from '@/lib/estimates/remove-price-client';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';

import { REMOVE_ALERT_ID, REMOVE_PASSWORD_FIELD_ID } from './remove-ids';
import { KEEP_LABEL, PASSWORD_HINT, PASSWORD_LABEL, REMOVE_LABEL, REMOVE_UNCONFIRMED, removeIntro, REMOVING_LABEL, removeTitle } from './remove-texts';

/**
 * "Remove the approved price?" (STORY-06.13 AC-2, AC-4, AC-5, AC-8; UX spec SCR-06 "Remove price (Admin)"): the dialog the Admin opens on a cancelled approval, **a separate dialog from the cancel** (no single request does
 * both). It collects the Admin's password; the server judges everything else (the role, the password, the approval), so this only shows the server's answer. It is an AlertDialog, so focus starts on the safe choice,
 * **Keep the price**, and Escape closes it with nothing sent. It is fetched on the first press of the button, through the overlay loader, and is **not** in the first load of the page (NFR-009, ADR-016). Its words are in
 * `remove-texts.ts`.
 *
 * **The password** is a field of its own (the shared `PasswordInput`, `autocomplete="current-password"`). It is sent in the one request and **emptied as soon as the answer is in**: a wrong password leaves it empty with
 * its message and focus. It is never put in the page, a link, storage or a log line from here.
 *
 * **States.** Default; Password missing (the message under the field); Saving ("Removing", the buttons held and the dialog cannot be dismissed); **Wrong password** (422 `STEP_UP_FAILED`: the server's sentence under the
 * password field, which is emptied and takes focus; the session is not ended); **Blocked step-up** (429: a danger alert with the server's sentence; the Admin may try again later). Any other refusal (the page is out of
 * date: a newer approval, a price removed already, an approval not cancelled) shows the server's own sentence and the page is drawn again. When no usable answer comes the dialog says it could not confirm and the page
 * is drawn again, because the removal may have gone through.
 */

export interface RemoveDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The cancelled approval the Admin sees (BO): the request names it, so a newer approval is never touched. */
  readonly approvalId: string;
  /** The price on the page, written as rupees ("₹ 12,600.00"), for the dialog's sentence. The page already shows it to the Admin; the dialog only repeats it. */
  readonly priceLabel: string;
  /** The removal worked: the page is drawn again and shows the removed state. */
  readonly onRemoved: () => void;
  /** The page is out of date, or no usable answer came: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  /** The step-up is blocked (429): the server's sentence; the Admin may try again later. */
  | { readonly kind: 'locked'; readonly message: string }
  /** Any other refusal: the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const EDITING: Phase = { kind: 'editing' };
const STEP_UP_FAILED_CODE = 'STEP_UP_FAILED';
const STEP_UP_LOCKED_CODE = 'STEP_UP_LOCKED';
const TOO_MANY_STATUS = 429;

/** What the dialog holds and what pressing Remove price does. `inFlightRef` is a ref, not state: a second press while the first is in flight must not send a second request. It is the dialog's too, so the dialog cannot be dismissed while a request is under way. */
function useRemove(props: RemoveDialogProps, inFlightRef: RefObject<boolean>) {
  const { estimateId, approvalId, onRemoved, onStale } = props;
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(EDITING);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current) return;
    if (password === '') {
      setPasswordError(PASSWORD_REQUIRED_MESSAGE);
      return;
    }
    setPasswordError(null);
    inFlightRef.current = true;
    setPhase({ kind: 'saving' });
    const outcome = await removePrice(estimateId, { approvalId, password });
    inFlightRef.current = false;
    // The password was sent: it is not kept, whatever the answer was.
    setPassword('');
    if (outcome.status === 'ok') return onRemoved();
    if (outcome.status === 'refused') return refuse(outcome);
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  function refuse(outcome: Extract<Awaited<ReturnType<typeof removePrice>>, { status: 'refused' }>): void {
    if (outcome.fields['password'] !== undefined) {
      setPasswordError(outcome.fields['password']);
      return setPhase(EDITING);
    }
    if (outcome.code === STEP_UP_FAILED_CODE) {
      setPasswordError(outcome.title);
      return setPhase(EDITING);
    }
    if (outcome.code === STEP_UP_LOCKED_CODE || outcome.httpStatus === TOO_MANY_STATUS) return setPhase({ kind: 'locked', message: outcome.title });
    // A 409 (the page is out of date) and anything else: the server's own sentence, and the page is drawn again.
    setPhase({ kind: 'refused', message: outcome.title });
    return onStale();
  }

  const typePassword = (value: string): void => {
    setPassword(value);
    setPasswordError(null);
  };
  return { password, passwordError, phase, setPassword: typePassword, submit };
}

type Removing = ReturnType<typeof useRemove>;

/** The danger alerts of the states that stop or fail the removal, in the words of the spec and the server. */
function Alerts({ phase }: { readonly phase: Phase }) {
  const alert = useRef<HTMLDivElement>(null);
  const locked = phase.kind === 'locked';
  // The person needs to read why they cannot go on: focus goes to the alert, which is read out by its role.
  useEffect(() => {
    if (locked) alert.current?.focus();
  }, [locked]);
  switch (phase.kind) {
    case 'locked':
      return (
        <div id={REMOVE_ALERT_ID} ref={alert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{phase.message}</Notice>
        </div>
      );
    case 'refused':
      return <Notice tone="danger">{phase.message}</Notice>;
    case 'unconfirmed':
      return <Notice tone="danger">{REMOVE_UNCONFIRMED}</Notice>;
    default:
      return null;
  }
}

function RemoveForm({ props, removing }: { readonly props: RemoveDialogProps; readonly removing: Removing }) {
  const { phase, password, passwordError } = removing;
  const passwordField = useRef<HTMLInputElement>(null);
  const saving = phase.kind === 'saving';

  // A password that was refused takes focus back to its field.
  useEffect(() => {
    if (passwordError !== null) passwordField.current?.focus();
  }, [passwordError]);

  return (
    <form noValidate onSubmit={(event) => void removing.submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle>{removeTitle}</AlertDialogTitle>
        <AlertDialogDescription>{removeIntro(props.priceLabel)}</AlertDialogDescription>
      </AlertDialogHeader>
      <Alerts phase={phase} />
      <FormField id={REMOVE_PASSWORD_FIELD_ID} label={PASSWORD_LABEL} hint={PASSWORD_HINT} {...(passwordError === null ? {} : { error: passwordError })}>
        {(control) => (
          <PasswordInput
            {...control}
            ref={passwordField}
            name="password"
            required
            autoComplete="current-password"
            disabled={saving}
            value={password}
            onChange={(event) => removing.setPassword(event.target.value)}
          />
        )}
      </FormField>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{KEEP_LABEL}</AlertDialogCancel>
        <Button type="submit" variant="danger" loading={saving}>
          {saving ? REMOVING_LABEL : REMOVE_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts from an empty password. */
function RemoveFormHost({ inFlightRef, ...props }: RemoveDialogProps & { readonly inFlightRef: RefObject<boolean> }) {
  const removing = useRemove(props, inFlightRef);
  return <RemoveForm props={props} removing={removing} />;
}

export function RemoveDialog(props: RemoveDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the removal cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <RemoveFormHost {...props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
