'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { checkUnlockReason } from '@/lib/estimate/unlock-words';
import { readUnlockPreview, unlockEstimate, type UnlockPreviewView } from '@/lib/estimates/unlock-client';

import { UNLOCK_BLOCKED_ALERT_ID, UNLOCK_REASON_FIELD_ID } from './unlock-ids';
import {
  CHECK_FAILED_LINE,
  CHECKING_LINE,
  KEEP_LOCKED_LABEL,
  previewNotice,
  REASON_HINT,
  REASON_LABEL,
  UNLOCK_LABEL,
  UNLOCK_UNCONFIRMED,
  UNLOCKING_LABEL,
  unlockIntro,
  unlockTitle,
} from './unlock-texts';

/**
 * "Unlock" (STORY-06.08 AC-1, AC-4, AC-9, AC-10; UX spec v0.31 SCR-09 and its mock-up): the dialog a Lead or an Admin opens on an approved estimate. It reads what changed since the approval (`GET unlock-preview`:
 * counts by kind and two version numbers) and collects the reason; the server judges everything else (the role, the status, the reason, the customer and the materials), so this only shows the server's answer. It is an
 * AlertDialog, so focus starts on the safe choice, **Keep it locked**, and Escape closes it with nothing sent. It is fetched on the first press of the button, through the overlay loader, and is **not** in the first
 * load of the page (NFR-009, ADR-016). Its words are in `unlock-texts.ts`.
 *
 * **States.** Default (the notice of what changed, or "Nothing has changed ..."); Reason missing (the message is under the field, from the shared rule `checkUnlockReason`); Saving ("Unlocking", the buttons held
 * and the dialog cannot be dismissed); **Blocked** (409 `CUSTOMER_DELETED` or `MATERIAL_DELETED`, from the preview or from the press: a danger alert at the top with the server's sentence, Unlock off, the reason
 * kept, focus on the alert; **Keep it locked** is the way out). Any other refusal shows the server's own sentence and the page is drawn again, because it is out of date. When no usable answer comes the dialog says
 * it could not confirm and the page is drawn again, because the unlock may have gone through.
 */

export interface UnlockDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The task's code, "Q-2026-0318": the title is "Unlock Q-2026-0318". */
  readonly code: string;
  /** The unlock worked: the page is drawn again and shows the Draft. */
  readonly onUnlocked: () => void;
  /** The page is out of date, or no usable answer came: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Preview =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: UnlockPreviewView }
  | { readonly kind: 'failed' };

type Phase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  /** The estimate cannot be unlocked and a repeat cannot succeed (a deleted customer or material): the server's sentence. */
  | { readonly kind: 'blocked'; readonly message: string }
  /** Any other refusal: the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const EDITING: Phase = { kind: 'editing' };

const isDeletedCode = (code: string): boolean => code === CUSTOMER_DELETED_CODE || code === MATERIAL_DELETED_CODE;

/** What the dialog holds and what pressing Unlock does. `inFlightRef` is a ref, not state: a second press while the first is in flight must not send a second request. It is the dialog's too, so the dialog cannot be dismissed while a request is under way. */
function useUnlock(props: UnlockDialogProps, inFlightRef: RefObject<boolean>) {
  const { estimateId, onUnlocked, onStale } = props;
  const [preview, setPreview] = useState<Preview>({ kind: 'loading' });
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(EDITING);

  // The preview is read once, when the dialog opens. A deleted customer or material blocks the unlock before the reason is typed; a preview that cannot be read does not stop the unlock.
  useEffect(() => {
    let cancelled = false;
    void readUnlockPreview(estimateId).then((outcome) => {
      if (cancelled) return;
      if (outcome.status === 'ok') return setPreview({ kind: 'ready', view: outcome.value });
      if (outcome.status === 'refused' && outcome.httpStatus === 409 && isDeletedCode(outcome.code)) {
        setPreview({ kind: 'failed' });
        return setPhase({ kind: 'blocked', message: outcome.title });
      }
      return setPreview({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current || phase.kind === 'blocked') return;
    const checked = checkUnlockReason(reason);
    if (!checked.ok) {
      setReasonError(checked.message);
      return;
    }
    inFlightRef.current = true;
    setReasonError(null);
    setPhase({ kind: 'saving' });
    const outcome = await unlockEstimate(estimateId, checked.reason);
    inFlightRef.current = false;
    if (outcome.status === 'ok') return onUnlocked();
    if (outcome.status === 'refused') {
      // A reason the server refused is shown under the field, in its own words, and what was typed is kept.
      if (outcome.fields['reason'] !== undefined) {
        setReasonError(outcome.fields['reason']);
        return setPhase(EDITING);
      }
      if (outcome.httpStatus === 409 && isDeletedCode(outcome.code)) return setPhase({ kind: 'blocked', message: outcome.title });
      setPhase({ kind: 'refused', message: outcome.title });
      return onStale();
    }
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  const type = (value: string): void => {
    setReason(value);
    setReasonError(null);
  };
  return { preview, reason, reasonError, phase, setReason: type, submit };
}

type Unlocking = ReturnType<typeof useUnlock>;

function PreviewNotice({ preview }: { readonly preview: Preview }) {
  switch (preview.kind) {
    case 'loading':
      return (
        <Notice tone="info" role="status">
          {CHECKING_LINE}
        </Notice>
      );
    case 'failed':
      return <Notice tone="info">{CHECK_FAILED_LINE}</Notice>;
    case 'ready':
      return <Notice tone="info">{previewNotice(preview.view)}</Notice>;
    default:
      return null;
  }
}

/** The danger alerts of the states that stop or fail the unlock, in the words of the spec and the server. */
function Alerts({ phase }: { readonly phase: Phase }) {
  const blockedAlert = useRef<HTMLDivElement>(null);
  // The button that was pressed is now off, so focus would be lost: it goes to the alert, which is read out by its role (ux-spec v0.30, "Where it shows").
  useEffect(() => {
    if (phase.kind === 'blocked') blockedAlert.current?.focus();
  }, [phase.kind]);
  switch (phase.kind) {
    case 'blocked':
      return (
        <div id={UNLOCK_BLOCKED_ALERT_ID} ref={blockedAlert} tabIndex={-1} className="rounded-md">
          <Notice tone="danger">{phase.message}</Notice>
        </div>
      );
    case 'refused':
      return <Notice tone="danger">{phase.message}</Notice>;
    case 'unconfirmed':
      return <Notice tone="danger">{UNLOCK_UNCONFIRMED}</Notice>;
    default:
      return null;
  }
}

function UnlockForm({ props, unlocking, engineerName }: { readonly props: UnlockDialogProps; readonly unlocking: Unlocking; readonly engineerName: string | null }) {
  const { phase, preview, reason, reasonError } = unlocking;
  const field = useRef<HTMLTextAreaElement>(null);
  const saving = phase.kind === 'saving';
  const blocked = phase.kind === 'blocked';

  // A reason the shape or the server refused takes focus back to the field.
  useEffect(() => {
    if (reasonError !== null) field.current?.focus();
  }, [reasonError]);

  return (
    <form noValidate onSubmit={(event) => void unlocking.submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle>{unlockTitle(props.code)}</AlertDialogTitle>
        <AlertDialogDescription>{unlockIntro(engineerName)}</AlertDialogDescription>
      </AlertDialogHeader>
      <Alerts phase={phase} />
      {blocked ? null : <PreviewNotice preview={preview} />}
      <FormField id={UNLOCK_REASON_FIELD_ID} label={REASON_LABEL} hint={REASON_HINT} {...(reasonError === null ? {} : { error: reasonError })}>
        {(control) => (
          <Textarea {...control} ref={field} name="reason" required autoComplete="off" disabled={saving} value={reason} onChange={(event) => unlocking.setReason(event.target.value)} />
        )}
      </FormField>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{KEEP_LOCKED_LABEL}</AlertDialogCancel>
        <Button type="submit" loading={saving} disabled={blocked}>
          {saving ? UNLOCKING_LABEL : UNLOCK_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts from a fresh preview and an empty reason. */
function UnlockFormHost({ inFlightRef, ...props }: UnlockDialogProps & { readonly inFlightRef: RefObject<boolean> }) {
  const unlocking = useUnlock(props, inFlightRef);
  return <UnlockForm props={props} unlocking={unlocking} engineerName={unlocking.preview.kind === 'ready' ? unlocking.preview.view.engineerName : null} />;
}

export function UnlockDialog(props: UnlockDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the unlock cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <UnlockFormHost {...props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
