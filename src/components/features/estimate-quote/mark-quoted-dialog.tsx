'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { DownloadChip } from '@/components/shared/download-chip';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { markEstimateQuoted } from '@/lib/estimates/mark-quoted-client';
import type { DownloadChipData } from '@/lib/export/download-marker-view';

import { MARK_QUOTED_ALERT_ID } from './mark-quoted-ids';
import { ALREADY_QUOTED_CODE, MARK_QUOTED_NO_UNDO, MARK_QUOTED_SUBMIT_LABEL, MARK_QUOTED_UNCONFIRMED, MARKING_LABEL, markQuotedIntro, markQuotedTitle, NOT_YET_LABEL } from './mark-quoted-texts';

/**
 * "Mark as quoted" (CR-01 item 7C, AQP-400; AC-3, AC-4, AC-9; UX spec SCR-06 "Mark as quoted"): the dialog a Lead or an Admin opens on an approved estimate. It says that the quote should have been sent to the customer, that the
 * status becomes Quoted with the person's name and the time, **that only Unlock can reverse it**, and what the download marker says now (the shared chip, so the Lead sees whether the file they sent is the one that stands).
 * The server judges everything (the role, the status, the Ignored layer); this only shows its answer. It is an AlertDialog, so focus starts on the safe choice, **Not yet**, and Escape closes it with nothing sent. It is fetched
 * on the first press of the button, through the overlay loader, and is **not** in the first load of the page (NFR-009, ADR-016). Its words are in `mark-quoted-texts.ts`.
 *
 * **States.** Default; Saving ("Marking as quoted", the buttons held and the dialog cannot be dismissed: the mark cannot be recalled); **a second press** (409 `ESTIMATE_ALREADY_QUOTED`: the estimate is quoted, which is what the
 * person wanted, so it is treated as done and the page is drawn again); any other refusal shows the server's own sentence and the page is drawn again, because it is out of date; and when no usable answer comes the dialog
 * says it could not confirm and the page is drawn again, because the mark may have gone through.
 */

export interface MarkQuotedDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The task's code, "Q-2026-0318": the title is "Mark Q-2026-0318 as quoted?". */
  readonly code: string;
  /** The customer's name, or `null` for an estimate made before CR-01 that has none. */
  readonly customerName: string | null;
  /** The marker of the estimate's Excel downloads as the page drew it, or `'unavailable'` when it could not be read (the chip then says so in words). */
  readonly download: DownloadChipData | 'unavailable';
  /** The mark worked, or the estimate was already quoted: the page is drawn again and shows the Quoted state. */
  readonly onMarked: () => void;
  /** No usable answer came and the mark may have gone through: read the estimate again so the page tells the truth. The dialog stays open with its sentence. */
  readonly onStale: () => void;
  /** The server refused the mark with a sentence (the estimate changed elsewhere): the dialog keeps the sentence in view and the page is drawn again when the dialog is closed, not before. */
  readonly onRefused: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  /** Any refusal that is not "already quoted": the server's own sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const IDLE: Phase = { kind: 'idle' };

function Alert({ phase }: { readonly phase: Phase }) {
  const refusedAlert = useRef<HTMLDivElement>(null);
  // The button that was pressed is now off, so focus would be lost: it goes to the alert, which is read out by its role (as the unlock dialog's blocked alert).
  useEffect(() => {
    if (phase.kind === 'refused') refusedAlert.current?.focus();
  }, [phase.kind]);
  if (phase.kind === 'refused') {
    return (
      <div id={MARK_QUOTED_ALERT_ID} ref={refusedAlert} tabIndex={-1} className="rounded-md">
        <Notice tone="danger">{phase.message}</Notice>
      </div>
    );
  }
  if (phase.kind === 'unconfirmed') return <Notice tone="danger">{MARK_QUOTED_UNCONFIRMED}</Notice>;
  return null;
}

function MarkQuotedForm({ props, inFlightRef }: { readonly props: MarkQuotedDialogProps; readonly inFlightRef: { current: boolean } }) {
  const { estimateId, code, customerName, download, onMarked, onStale, onRefused } = props;
  const [phase, setPhase] = useState<Phase>(IDLE);
  const saving = phase.kind === 'saving';

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // A second press while the first is in flight must not send a second request (a ref, not state: the next render has not happened yet).
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase({ kind: 'saving' });
    const outcome = await markEstimateQuoted(estimateId);
    inFlightRef.current = false;
    if (outcome.status === 'ok') return onMarked();
    if (outcome.status === 'refused') {
      // A second press (another window, a double tap that got through): the estimate is quoted, which is what was asked for.
      if (outcome.httpStatus === 409 && outcome.code === ALREADY_QUOTED_CODE) return onMarked();
      // Any other refusal means the estimate changed elsewhere (unlocked, cancelled, ignored): the sentence stays in the dialog, and the page is drawn again when the dialog is closed.
      setPhase({ kind: 'refused', message: outcome.title });
      return onRefused();
    }
    setPhase({ kind: 'unconfirmed' });
    return onStale();
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-s-4">
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{markQuotedTitle(code)}</AlertDialogTitle>
        <AlertDialogDescription className={BREAK_LONG_NAMES}>{markQuotedIntro(customerName)}</AlertDialogDescription>
      </AlertDialogHeader>
      <p className="text-body text-ink">{MARK_QUOTED_NO_UNDO}</p>
      <DownloadChip marker={download} explain />
      <Alert phase={phase} />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>{NOT_YET_LABEL}</AlertDialogCancel>
        <Button type="submit" loading={saving} disabled={phase.kind === 'refused'}>
          <Icon icon={Send} size="large" />
          {saving ? MARKING_LABEL : MARK_QUOTED_SUBMIT_LABEL}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

export function MarkQuotedDialog(props: MarkQuotedDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while a request is under way (the mark cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <MarkQuotedForm props={props} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
