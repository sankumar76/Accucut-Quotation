'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { checkCancelReason } from '@/lib/estimate/cancel-words';
import { cancelApproval } from '@/lib/estimates/cancel-approval-client';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';

import { CANCEL_ALERT_ID, CANCEL_PASSWORD_FIELD_ID, CANCEL_REASON_FIELD_ID } from './cancel-ids';
import {
  CANCEL_LABEL,
  CANCEL_UNCONFIRMED,
  CANCELLING_LABEL,
  cancelIntro,
  cancelTitle,
  KEEP_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  REASON_HINT,
  REASON_LABEL,
  type CancelStatus,
} from './cancel-texts';

/**
 * "Cancel the approval of <code>?" (STORY-06.12 AC-2, AC-4, AC-8, AC-9, AC-10; UX spec v0.31 SCR-06 "Cancel approval (Admin)"): the dialog the Admin opens on an approval that has not been cancelled. It collects the reason
 * and the Admin's password; the server judges everything else (the role, the password, the reason, the approval, the customer and the materials), so this only shows the server's answer. It is an AlertDialog, so focus
 * starts on the safe choice, **Keep the approval**, and Escape closes it with nothing sent. It is fetched on the first press of the button, through the overlay loader, and is **not** in the first load of the page
 * (NFR-009, ADR-016). Its words are in `cancel-texts.ts`.
 *
 * **The password** is a field of its own (the shared `PasswordInput`, `autocomplete="current-password"`). It is sent in the one request and **emptied as soon as the answer is in**: a wrong password leaves it empty with its
 * message and focus; a deleted customer or material leaves it empty, as the spec says ("it was sent"). It is never put in the page, a link, storage or a log line from here.
 *
 * **States.** Default; Reason missing and Password missing (the message under the field); Saving ("Cancelling", the buttons held and the dialog cannot be dismissed); **Wrong password** (422 `STEP_UP_FAILED`: the server's
 * sentence under the password field, which is emptied and takes focus; the session is not ended); **Blocked step-up** (429: a danger alert with the server's sentence; the Admin may try again later); **Blocked estimate**
 * (409 `CUSTOMER_DELETED` or `MATERIAL_DELETED`: a danger alert at the top with the server's sentence, the confirm button off, the reason kept, focus on the alert; **Keep the approval** is the way out). Any other refusal
 * shows the server's own sentence and the page is drawn again, because it is out of date. When no usable answer comes the dialog says it could not confirm and the page is drawn again, because the cancel may have gone through.
 */

export interface CancelDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The task's code, "Q-2026-0318": the title is "Cancel the approval of Q-2026-0318?". */
  readonly code: string;
  /** The approval the Admin sees (BO): the request names it, so a newer approval is never cancelled unseen. */
  readonly approvalId: string;
  /** The status the estimate is in now: the dialog says what happens to it. */
  readonly status: CancelStatus;
  /** The Engineer whose Open queue the task returns to, for an approved estimate. */
  readonly engineerName: string;
  /** The cancel worked: the page is drawn again and shows the cancelled state. */
  readonly onCancelled: () => void;
  /** The page is out of date, or no usable answer came: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  /** The estimate cannot be cancelled and a repeat cannot succeed (a deleted customer or material): the server's sentence. */
  | { readonly kind: 'blocked'; readonly message: string }
  /** The step-up is blocked (429): the server's sentence; the Admin may try again later. */
  | { readonly kind: 'locked'; readonly message: string }
  /** Any other refusal: the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const EDITING: Phase = { kind: 'editing' };
const STEP_UP_FAILED_CODE = 'STEP_UP_FAILED';
const STEP_UP_LOCKED_CODE = 'STEP_UP_LOCKED';
const TOO_MANY_STATUS = 429;

const isDeletedCode = (code: string): boolean => code === CUSTOMER_DELETED_CODE || code === MATERIAL_DELETED_CODE;

/** What the dialog holds and what pressing Cancel approval does. `inFlightRef` is a ref, not state: a second press while the first is in flight must not send a second request. It is the dialog's too, so the dialog cannot be dismissed while a request is under way. */
function useCancel(props: CancelDialogProps, inFlightRef: RefObject<boolean>) {
  const { estimateId, approvalId, onCancelled, onStale } = props;
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(EDITING);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current || phase.kind === 'blocked') return;
    const checked = checkCancelReason(reason);
    const missingPassword = password === '';
    setReasonError(checked.ok ? null : checked.message);
    setPasswordError(missingPassword ? PASSWORD_REQUIRED_MESSAGE : null);
    if (!checked.ok || missingPassword) return;
    inFlightRef.current = true;
    setPhase({ kind: 'saving' });
    const outcome = await cancelApproval(estimateId, { approvalId, reason: checked.reason, password });
    inFlightRef.current = false;
    // The password was sent: it is not kept, whatever the answer was.
    setPassword('');
    if (outcome.status === 'ok') return onCancelled();
    if (outcome.status === 'refused') return refuse(outcome);
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  function refuse(outcome: Extract<Awaited<ReturnType<typeof cancelApproval>>, { status: 'refused' }>): void {
    // A reason the server refused is shown under the field, in its own words, and what was typed is kept.
    if (outcome.fields['reason'] !== undefined) {
      setReasonError(outcome.fields['reason']);
      return setPhase(EDITING);
    }
    if (outcome.fields['password'] !== undefined) {
      setPasswordError(outcome.fields['password']);
      return setPhase(EDITING);
    }
    if (outcome.code === STEP_UP_FAILED_CODE) {
      setPasswordError(outcome.title);
      return setPhase(EDITING);
    }
    if (outcome.code === STEP_UP_LOCKED_CODE || outcome.httpStatus === TOO_MANY_STATUS) return setPhase({ kind: 'locked', message: outcome.title });
    if (outcome.httpStatus === 409 && isDeletedCode(outcome.code)) return setPhase({ kind: 'blocked', message: outcome.title });
    setPhase({ kind: 'refused', message: outcome.title });
    return onStale();
  }

  const typeReason = (value: string): void => {
    setReason(value);
    setReasonError(null);
  };
  const typePassword = (value: string): void => {
    setPassword(value);
    setPasswordError(null);
  };
  return { reason, password, reasonError, passwordError, phase, setReason: typeReason, setPassword: typePassword, submit };
}

type Cancelling = ReturnType<typeof useCancel>;

/** The danger alerts of the states that stop or fail the cancel, in the words of the spec and the server. */
function Alerts({ phase }: { readonly phase: Phase }) {
  const alert = useRef<HTMLDivElement>(null);
  const stops = phase.kind === 'blocked' || phase.kind === 'locked';
  // The button that was pressed is now off, or the person needs to read why: focus goes to the alert, which is read out by its role (ux-spec v0.30, "Where it shows").
  useEffect(() => {
    if (stops) alert.current?.focus();
  }, [stops]);
  switch (phase.kind) {
    case 'blocked':
    case 'locked':
      return (
        <div id={CANCEL_ALERT_ID} ref={alert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{phase.message}</Notice>
        </div>
      );
    case 'refused':
      return <Notice tone="danger">{phase.message}</Notice>;
    case 'unconfirmed':
      return <Notice tone="danger">{CANCEL_UNCONFIRMED}</Notice>;
    default:
      return null;
  }
}

function CancelForm({ props, cancelling }: { readonly props: CancelDialogProps; readonly cancelling: Cancelling }) {
  const { phase, reason, password, reasonError, passwordError } = cancelling;
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const saving = phase.kind === 'saving';
  const blocked = phase.kind === 'blocked';

  // A reason the shape or the server refused takes focus back to the field; so does a password that was refused (the reason, which comes first on the screen, wins when both are).
  useEffect(() => {
    if (reasonError !== null) reasonField.current?.focus();
    else if (passwordError !== null) passwordField.current?.focus();
  }, [reasonError, passwordError]);

  return (
    <form noValidate onSubmit={(event) => void cancelling.submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle>{cancelTitle(props.code)}</AlertDialogTitle>
        <AlertDialogDescription>{cancelIntro(props.status, props.engineerName)}</AlertDialogDescription>
      </AlertDialogHeader>
      <Alerts phase={phase} />
      <FormField id={CANCEL_REASON_FIELD_ID} label={REASON_LABEL} hint={REASON_HINT} {...(reasonError === null ? {} : { error: reasonError })}>
        {(control) => (
          <Textarea {...control} ref={reasonField} name="reason" required autoComplete="off" disabled={saving} value={reason} onChange={(event) => cancelling.setReason(event.target.value)} />
        )}
      </FormField>
      <FormField id={CANCEL_PASSWORD_FIELD_ID} label={PASSWORD_LABEL} hint={PASSWORD_HINT} {...(passwordError === null ? {} : { error: passwordError })}>
        {(control) => (
          <PasswordInput
            {...control}
            ref={passwordField}
            name="password"
            required
            autoComplete="current-password"
            disabled={saving}
            value={password}
            onChange={(event) => cancelling.setPassword(event.target.value)}
          />
        )}
      </FormField>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{KEEP_LABEL}</AlertDialogCancel>
        <Button type="submit" variant="danger" loading={saving} disabled={blocked}>
          {saving ? CANCELLING_LABEL : CANCEL_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts from an empty reason and an empty password. */
function CancelFormHost({ inFlightRef, ...props }: CancelDialogProps & { readonly inFlightRef: RefObject<boolean> }) {
  const cancelling = useCancel(props, inFlightRef);
  return <CancelForm props={props} cancelling={cancelling} />;
}

export function CancelDialog(props: CancelDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the cancel cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <CancelFormHost {...props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
