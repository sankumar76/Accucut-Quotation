'use client';

import { Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { restoreEstimate } from '@/lib/estimates/ignore-client';

import { announce, prepareAnnouncer } from './announce';
import { NOT_IGNORED_CODE } from './ignore-codes';
import { RESTORE_ALERT_ID } from './ignore-ids';
import {
  KEEP_IT_IGNORED_LABEL,
  RESTORE_SUBMIT_LABEL,
  RESTORE_UNCONFIRMED,
  restoredStatusLine,
  restoreLines,
  RESTORING_LABEL,
  restoreTitle,
  type RestoreFacts,
} from './ignore-texts';

/**
 * "Restore" (CR-01 item 7D, AQP-401 AC-4, AC-8; UX 12944 section 2): the dialog a Lead or an Admin opens on an ignored estimate, from the notice of SCR-06. **It is a dialog and not a direct button**: Restore returns the
 * status the estimate had (Draft, Prepared or Approved), so a label that named one status would be false for the others, and the press has effects the person cannot see (the task reappears in an Engineer's Open queue and
 * bell, may show Overdue at once, or returns to Closed). **It takes no remarks of its own** (the product-manager, FR-109): the Ignore remarks stay on record. It is an AlertDialog, so focus starts on the safe choice, **Keep it
 * ignored**, and Escape closes it with nothing sent. It is fetched on the first press of the notice's button, through the overlay loader, and is **not** in the first load of the page (NFR-009, ADR-016). Its words are in
 * `ignore-texts.ts`: the text follows the status underneath, and the Overdue sentence is said only when the deadline has passed and the status is not Approved.
 *
 * **States.** Default; Saving ("Restoring", the buttons held and the dialog cannot be dismissed); **a second press** (409 `ESTIMATE_NOT_IGNORED`: the estimate is not ignored, which is what the person wanted, so it is
 * treated as done and the page is drawn again); any other refusal shows the server's own sentence and the page is drawn again when the dialog is closed; and when no usable answer comes the dialog says it could not
 * confirm and the page is drawn again, because the Restore may have gone through.
 */

export interface RestoreDialogProps extends RestoreFacts {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The task's code: the title is "Restore Q-2026-0318?". */
  readonly code: string;
  /** The Restore worked, or the estimate was not ignored: the page is drawn again and shows the estimate as it is. */
  readonly onRestored: () => void;
  /** No usable answer came and the Restore may have gone through: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  /** The server refused with a sentence: the dialog keeps it in view and the page is drawn again when the dialog is closed, not before. */
  readonly onRefused: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  /** Any refusal that is not "not ignored": the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const IDLE: Phase = { kind: 'idle' };

function Alert({ phase }: { readonly phase: Phase }) {
  const refusedAlert = useRef<HTMLDivElement>(null);
  // The button that was pressed is now off, so focus would be lost: it goes to the alert, which is read out by its role.
  useEffect(() => {
    if (phase.kind === 'refused') refusedAlert.current?.focus();
  }, [phase.kind]);
  if (phase.kind === 'refused') {
    return (
      <div id={RESTORE_ALERT_ID} ref={refusedAlert} tabIndex={-1} className="rounded-md">
        <Notice tone="danger">{phase.message}</Notice>
      </div>
    );
  }
  if (phase.kind === 'unconfirmed') return <Notice tone="danger">{RESTORE_UNCONFIRMED}</Notice>;
  return null;
}

function RestoreForm({ props, inFlightRef }: { readonly props: RestoreDialogProps; readonly inFlightRef: { current: boolean } }) {
  const { estimateId, code, status, engineerName, deadlineLabel, deadlinePassed, onRestored, onStale, onRefused } = props;
  const [phase, setPhase] = useState<Phase>(IDLE);
  const saving = phase.kind === 'saving';

  // The live region is made now, before the action is sent, so the sentence that follows is announced as a change.
  useEffect(() => {
    prepareAnnouncer();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // A second press while the first is in flight must not send a second request (a ref, not state: the next render has not happened yet).
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase({ kind: 'saving' });
    const outcome = await restoreEstimate(estimateId);
    inFlightRef.current = false;
    if (outcome.status === 'ok' || (outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code === NOT_IGNORED_CODE)) {
      // Restored, or already restored by someone else (a second window, a double tap that got through): the estimate is as it was asked to be.
      announce(restoredStatusLine(code, status));
      return onRestored();
    }
    if (outcome.status === 'refused') {
      // Any other refusal means the estimate changed elsewhere: the sentence stays in the dialog, and the page is drawn again when the dialog is closed.
      setPhase({ kind: 'refused', message: outcome.title });
      return onRefused();
    }
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  const lines = restoreLines({ status, engineerName, deadlineLabel, deadlinePassed });
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{restoreTitle(code)}</AlertDialogTitle>
        <AlertDialogDescription className={BREAK_LONG_NAMES}>{lines.join(' ')}</AlertDialogDescription>
      </AlertDialogHeader>
      <Alert phase={phase} />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{KEEP_IT_IGNORED_LABEL}</AlertDialogCancel>
        <Button type="submit" loading={saving} disabled={phase.kind === 'refused'}>
          <Icon icon={Undo2} size="large" />
          {saving ? RESTORING_LABEL : RESTORE_SUBMIT_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

export function RestoreDialog(props: RestoreDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the Restore cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <RestoreForm props={props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
