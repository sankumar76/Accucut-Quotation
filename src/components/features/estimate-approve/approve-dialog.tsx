'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { UnitInput } from '@/components/shared/unit-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CALCULATION_CHANGED_CODE, CALCULATION_CHANGED_MESSAGE, TOTALS_OUT_OF_DATE_CODE } from '@/lib/estimate/approval-words';
import { isPrice, PRICE_MESSAGE, prefillPrice, priceDifference, validateReason } from '@/lib/estimate/approve-price';
import { approveWarningLine } from '@/lib/estimate/lead-warning-copy';
import { RATES_CHANGED_TITLE } from '@/lib/estimate/rates-changed-copy';
import { approveEstimate, canReadFigures } from '@/lib/estimates/approve-client';
import { formatRupees } from '@/lib/money';

import {
  APPROVE_UNCONFIRMED,
  CANCEL_LABEL,
  DIALOG_TITLE,
  OUT_OF_DATE_ALERT,
  PRICE_INFO,
  PRICE_LABEL,
  priceChangedNote,
  REASON_HINT,
  REASON_LABEL,
  RECALCULATE_FIRST_LABEL,
  RUPEE_SIGN,
  SAVING_LABEL,
  SHOW_NEW_FIGURES_FAILED,
  SHOW_NEW_FIGURES_LABEL,
} from './approve-texts';

/**
 * "Approve and lock" (STORY-06.06 AC-1, AC-8; UX spec v0.30 SCR-08): the dialog that sets the Approved Quote Price. The field starts as the calculated total (BL), as two decimals, and is editable; the server
 * judges everything else (the status, the figures, the calculation named, the role), so this only collects the price and shows the server's answer. It is fetched on the first press of the button, through the
 * overlay loader, and is not in the first load of the page (NFR-009, ADR-016). Its words are in `approve-texts.ts`.
 *
 * **States.** Default; Invalid (the price is not rupees with up to 2 decimals: the message is under the field); Saving ("Approving", the button held and the dialog cannot be dismissed); **Estimate changed while open**
 * (409 `TOTALS_OUT_OF_DATE`: a danger alert, Approve and lock off, and "Recalculate first" in place of Cancel); **Figures recalculated while open** (409 `CALCULATION_CHANGED`: a danger alert with the server's sentence,
 * Approve and lock off, and "Show the new figures" in place of Cancel, which holds focus; if the page cannot be read a second alert says so and the button stays). Any other refusal shows the server's own sentence and
 * leaves Cancel. When no usable answer comes the dialog says it could not confirm and the page is drawn again, because the approval may have gone through.
 *
 * **A different price (STORY-06.07 AC-1, AC-4, AC-5; SCR-08 "Price changed", "Reason too long").** While the typed price differs from the calculated total at rupees and paise (`priceDifference`, the one rule the
 * server compares with), the information line is replaced by the warn note that names the difference, and the optional **Reason for the different price** field shows. A reason is read only while the field shows:
 * it is checked by the shared rule (at most 500 characters, no hidden character), and a refusal, the browser's or the server's 422, is shown under the field with what was typed kept. Putting the price back to
 * the total hides the field and sends no reason. The field has no `maxLength`, so a longer text is told about and never cut. Whether the price is an override, and whether the reason is kept, is the server's.
 */

export interface ApproveDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The calculation the page showed: the server approves only while it is still the current one. */
  readonly calculationId: string;
  /** The calculated total (BL) the field starts as. */
  readonly calculatedTotal: string;
  /** The Excel letter of BO, from the configuration version the figures belong to. */
  readonly approvedLetter: string;
  /** The rows of the calculation's quantity warning (STORY-06.10 AC-5): one info line names them when there are any. It never stops the approval and has no box to tick. */
  readonly warningRows: ReadonlyArray<{ readonly slNo: string; readonly label: string }>;
  /** What changed in the rates since the calculation, in one sentence of counts by kind (STORY-06.11 AC-2, SCR-08 "Rates changed"); `null` when nothing did. Approving is not stopped. */
  readonly ratesLine: string | null;
  /** The approval worked: the page is drawn again and shows the approved estimate. */
  readonly onApproved: () => void;
  /** The way on after a 409 that left the page out of date: close, and read the estimate again. */
  readonly onShowFigures: () => void;
  /** No usable answer came: read the estimate again so the page tells the truth, and keep the dialog open with the sentence. */
  readonly onUnconfirmed: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Phase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'out-of-date'; readonly reading: boolean; readonly readFailed: boolean }
  | { readonly kind: 'recalculated'; readonly reading: boolean; readonly readFailed: boolean }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

const EDITING: Phase = { kind: 'editing' };

/** Which refusal of the server the dialog has a state for, from its code and status. */
function refusalPhase(code: string, httpStatus: number, title: string): Phase {
  if (httpStatus === 409 && code === TOTALS_OUT_OF_DATE_CODE) return { kind: 'out-of-date', reading: false, readFailed: false };
  if (httpStatus === 409 && code === CALCULATION_CHANGED_CODE) return { kind: 'recalculated', reading: false, readFailed: false };
  return { kind: 'refused', message: title };
}

/**
 * What the dialog holds and what pressing Approve and lock does. `inFlightRef` is a ref, not state: a second press while the first is in flight must not send a second request, and state is read after the render.
 * It is the dialog's too, so the dialog cannot be dismissed while a request is under way.
 */
function useApproval(props: ApproveDialogProps, inFlightRef: RefObject<boolean>) {
  const { estimateId, calculationId, calculatedTotal, onApproved, onShowFigures, onUnconfirmed } = props;
  const [price, setPrice] = useState(() => prefillPrice(calculatedTotal));
  const [priceError, setPriceError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(EDITING);
  // The price differs from the calculated total at rupees and paise: the warning and the reason field show. Only a way to show them; the server decides, from the total it reads itself, whether it is an override.
  const difference = isPrice(price) ? priceDifference(price, calculatedTotal) : null;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current || phase.kind === 'out-of-date' || phase.kind === 'recalculated') return;
    if (!isPrice(price)) {
      setPriceError(PRICE_MESSAGE);
      return;
    }
    // The reason is read only while its field shows (a price equal to the calculated total sends none, AC-5). Too long, or holding a hidden character: the sentence is under the field, nothing is sent, and
    // what was typed stays (AC-4).
    const checkedReason = difference === null ? null : validateReason(reason);
    if (checkedReason !== null && !checkedReason.ok) {
      setReasonError(checkedReason.message);
      return;
    }
    const keptReason = checkedReason?.value ?? null;
    inFlightRef.current = true;
    setPriceError(null);
    setReasonError(null);
    setPhase({ kind: 'saving' });
    const outcome = await approveEstimate(estimateId, { calculationId, price: price.trim(), ...(keptReason === null ? {} : { reason: keptReason }) });
    inFlightRef.current = false;
    if (outcome.status === 'ok') return onApproved();
    if (outcome.status === 'refused') {
      // A price or a reason the server refused is shown under its own field, in the server's words, and nothing typed is cleared.
      const { price: priceRefusal, reason: reasonRefusal } = outcome.fields;
      if (priceRefusal !== undefined || reasonRefusal !== undefined) {
        setPriceError(priceRefusal ?? null);
        setReasonError(reasonRefusal ?? null);
        return setPhase(EDITING);
      }
      return setPhase(refusalPhase(outcome.code, outcome.httpStatus, outcome.title));
    }
    setPhase({ kind: 'unconfirmed' });
    return onUnconfirmed();
  }

  /** "Show the new figures" and "Recalculate first": read the estimate again. When it cannot be read the dialog stays open and says so. */
  async function showFigures(): Promise<void> {
    // Only a state that stopped the approval has this way on.
    if (inFlightRef.current || (phase.kind !== 'out-of-date' && phase.kind !== 'recalculated')) return;
    const { kind } = phase;
    inFlightRef.current = true;
    setPhase({ kind, reading: true, readFailed: false });
    const readable = await canReadFigures(estimateId);
    inFlightRef.current = false;
    if (readable) return onShowFigures();
    return setPhase({ kind, reading: false, readFailed: true });
  }

  const type = (value: string): void => {
    setPrice(value);
    setPriceError(null);
  };
  const typeReason = (value: string): void => {
    setReason(value);
    setReasonError(null);
  };
  return { price, priceError, reason, reasonError, difference, phase, setPrice: type, setReason: typeReason, submit, showFigures };
}

type Approval = ReturnType<typeof useApproval>;

/** The danger alerts of the states that stop the approval, in the words of the spec. */
function Alerts({ phase }: { readonly phase: Phase }) {
  switch (phase.kind) {
    case 'out-of-date':
    case 'recalculated':
      return (
        <>
          <Notice tone="danger">{phase.kind === 'out-of-date' ? OUT_OF_DATE_ALERT : CALCULATION_CHANGED_MESSAGE}</Notice>
          {phase.readFailed ? <Notice tone="danger">{SHOW_NEW_FIGURES_FAILED}</Notice> : null}
        </>
      );
    case 'refused':
      return <Notice tone="danger">{phase.message}</Notice>;
    case 'unconfirmed':
      return <Notice tone="danger">{APPROVE_UNCONFIRMED}</Notice>;
    default:
      return null;
  }
}

function ApproveForm({ props, approval }: { readonly props: ApproveDialogProps; readonly approval: Approval }) {
  const { phase, price, priceError, reason, reasonError, difference } = approval;
  const priceInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const wayOn = useRef<HTMLButtonElement>(null);
  const stopped = phase.kind === 'out-of-date' || phase.kind === 'recalculated';
  const saving = phase.kind === 'saving';

  // The button that was pressed is now off, so focus would be lost: it goes to the way on, and the alert is read out by its role (v0.30, "Focus"). A price the server or the shape refused takes it back to the field.
  useEffect(() => {
    if (stopped) wayOn.current?.focus();
  }, [stopped]);
  useEffect(() => {
    if (priceError !== null) priceInput.current?.focus();
  }, [priceError]);
  // A reason that was refused takes focus back to its field, unless the price was refused too (the price comes first, as it does on the form).
  useEffect(() => {
    if (reasonError !== null && priceError === null) reasonInput.current?.focus();
  }, [reasonError, priceError]);

  return (
    <form noValidate onSubmit={(event) => void approval.submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>{DIALOG_TITLE}</DialogTitle>
      </DialogHeader>
      <Alerts phase={phase} />
      {props.warningRows.length === 0 ? null : <Notice tone="info">{approveWarningLine(props.warningRows)}</Notice>}
      {props.ratesLine === null ? null : (
        <Notice tone="info" title={RATES_CHANGED_TITLE}>
          {props.ratesLine}
        </Notice>
      )}
      {difference === null ? <Notice tone="info">{PRICE_INFO}</Notice> : <Notice tone="warn">{priceChangedNote(difference.direction, formatRupees(difference.amount))}</Notice>}
      <FormField id="approve-price" label={PRICE_LABEL} tag={<ColumnTag letter={props.approvedLetter} kind="output" />} {...(priceError === null ? {} : { error: priceError })}>
        {(control) => (
          <UnitInput
            {...control}
            ref={priceInput}
            name="price"
            autoComplete="off"
            inputMode="decimal"
            required
            disabled={stopped || saving}
            value={price}
            onChange={(event) => approval.setPrice(event.target.value)}
            unit={RUPEE_SIGN}
          />
        )}
      </FormField>
      {difference === null ? null : (
        <FormField id="approve-reason" label={REASON_LABEL} hint={REASON_HINT} {...(reasonError === null ? {} : { error: reasonError })}>
          {(control) => (
            // No `maxLength`: a browser would cut a longer text silently. The limit is told under the field and on submit, and what was typed stays (AC-4).
            <Textarea {...control} ref={reasonInput} name="reason" autoComplete="off" disabled={stopped || saving} value={reason} onChange={(event) => approval.setReason(event.target.value)} />
          )}
        </FormField>
      )}
      <DialogFooter>
        {stopped ? (
          <Button ref={wayOn} type="button" variant="secondary" loading={(phase.kind === 'recalculated' || phase.kind === 'out-of-date') && phase.reading} onClick={() => void approval.showFigures()}>
            {phase.kind === 'recalculated' ? SHOW_NEW_FIGURES_LABEL : RECALCULATE_FIRST_LABEL}
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled={saving} onClick={() => props.onOpenChange(false)}>
            {CANCEL_LABEL}
          </Button>
        )}
        <Button type="submit" loading={saving} disabled={stopped}>
          {saving ? SAVING_LABEL : DIALOG_TITLE}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ApproveDialog(props: ApproveDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape, the close control and a press outside do nothing while a request is under way (the approval cannot be recalled).
    <Dialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={props.onCloseAutoFocus}>
        <ApproveFormHost {...props} inFlightRef={inFlightRef} />
      </DialogContent>
    </Dialog>
  );
}

/** The form mounts when the dialog opens and goes when it closes, so every opening starts from the current total and a new price: what was typed before is not kept (v0.30, "After it"). */
function ApproveFormHost({ inFlightRef, ...props }: ApproveDialogProps & { readonly inFlightRef: RefObject<boolean> }) {
  const approval = useApproval(props, inFlightRef);
  return <ApproveForm props={props} approval={approval} />;
}
