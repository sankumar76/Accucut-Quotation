'use client';

import { TriangleAlert, X } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/cn';
import {
  applyAllLabel,
  applyLabel,
  differBody,
  differTitle,
  DIFFER_LIST_LABEL,
  FAILED_CHOICES_TITLE,
  keepAllLabel,
  keepLabel,
  SAVE_CHOICES,
  SAVING_CHOICES,
  type PropagationChoice,
  type PropagationCounts,
} from '@/lib/masters/default-propagation';
import { formatDefaultValue } from '@/lib/masters/process-items';
import {
  savePropagationChoices,
  type DifferingCustomerRow,
  type ProcessItemRow,
  type PropagationRow,
} from '@/lib/masters/process-items-client';

import { BREAK_LONG_NAMES, TRY_AGAIN_BODY } from './master-texts';

/**
 * "Customers differ" (STORY-02.08 AC-2, AC-3, AC-5, AC-10; SCR-11, mock-up `SCR-11.html` `data-show="sync"`): after a save changed a rate's default, the customers
 * that held the old one have moved, and this window asks, customer by customer, about those that hold another value. Each customer is one `fieldset` named by
 * the customer, with a radio pair **Apply 1.52** / **Keep 1.50**; **every row starts on Keep** (A-1: nothing changes until the Admin chooses), "Keep all" and "Apply to
 * all" only set the radios, and **Save choices** is the one thing that sends anything (`POST /process-items/{id}/propagation`, with the value each customer was listed
 * at, so a customer edited since is left alone). Escape and the close icon are Keep all with no request (AC-5); no pending state is stored anywhere (A-5).
 *
 * Focus lands on the title when it opens (AC-10), the list scrolls inside the window (the buttons stay in view whatever the number of customers), and the answer is
 * the page's notice, which is a polite status. A refusal that says the default changed again, or that the rate is gone, is the screen's, as for the other dialogs.
 */

/** What the window is about: the rate as saved (its new default), and what the save did to the customers. */
export interface SyncRequest {
  readonly item: ProcessItemRow;
  readonly propagation: PropagationRow;
}

export interface ProcessSyncDialogProps {
  readonly open: boolean;
  /** Stays set after the window closes, so its words do not change while it fades out. */
  readonly request: SyncRequest | null;
  /** Escape, the close icon: the same as Keep all, and nothing is sent. */
  readonly onDismiss: (request: SyncRequest) => void;
  /** Save choices was accepted: the counts it answered. */
  readonly onSaved: (counts: PropagationCounts, request: SyncRequest) => void;
  /** The server said the default is no longer the one the choices were made for (409): nothing changed. */
  readonly onDefaultChanged: (request: SyncRequest) => void;
  /** The server said the rate no longer exists (404). */
  readonly onGone: (item: ProcessItemRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Choices = Readonly<Record<string, PropagationChoice>>;

/** Every customer on one choice. */
function allOn(customers: ReadonlyArray<DifferingCustomerRow>, choice: PropagationChoice): Choices {
  return Object.fromEntries(customers.map((customer) => [customer.customerId, choice]));
}

/** One customer: its name as the legend, its current value, and the two radios. */
function CustomerChoice({
  customer,
  unit,
  next,
  choice,
  onChange,
}: {
  readonly customer: DifferingCustomerRow;
  readonly unit: string;
  readonly next: string;
  readonly choice: PropagationChoice;
  readonly onChange: (choice: PropagationChoice) => void;
}) {
  const legend = `legend-${customer.customerId}`;
  const radio = (value: PropagationChoice, text: string) => (
    <div className="flex items-center gap-s-1">
      <RadioGroupItem value={value} id={`choice-${customer.customerId}-${value}`} />
      <Label htmlFor={`choice-${customer.customerId}-${value}`} className="text-body font-normal text-ink">
        {text}
      </Label>
    </div>
  );
  return (
    <fieldset data-customer-id={customer.customerId} className="flex min-w-0 flex-col gap-s-2 rounded-md border border-border p-s-3">
      <legend id={legend} className={cn('px-s-1 text-body font-semibold text-ink', BREAK_LONG_NAMES)}>
        {customer.name}
      </legend>
      <p className="text-label text-ink-2">
        Current value <span className="tabular-nums text-ink">{formatDefaultValue(customer.value, unit)}</span>
      </p>
      <RadioGroup
        value={choice}
        aria-labelledby={legend}
        onValueChange={(value) => onChange(value === 'apply' ? 'apply' : 'keep')}
        className="flex-row flex-wrap gap-x-s-5 gap-y-s-1"
      >
        {radio('apply', applyLabel(unit, next))}
        {radio('keep', keepLabel(unit, customer.value))}
      </RadioGroup>
    </fieldset>
  );
}

type Handlers = Pick<ProcessSyncDialogProps, 'onSaved' | 'onDefaultChanged' | 'onGone'>;

/** What the window holds and what Save choices does. `onBusy` says while the request is out, so Escape does not dismiss a window whose answer is on its way. */
function useChoices(request: SyncRequest, handlers: Handlers, onBusy: (busy: boolean) => void) {
  const { item, propagation } = request;
  const [choices, setChoices] = useState<Choices>(() => allOn(propagation.differing, 'keep'));
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    onBusy(true);
    setFailed(false);
    const sent = propagation.differing.map((customer) => ({
      customerId: customer.customerId,
      choice: choices[customer.customerId] ?? 'keep',
      shownValue: customer.value,
    }));
    const outcome = await savePropagationChoices(item.id, item.defaultValue, sent);
    setSubmitting(false);
    onBusy(false);
    if (outcome.status === 'ok') return handlers.onSaved(outcome.value, request);
    if (outcome.status === 'refused' && outcome.httpStatus === 409) return handlers.onDefaultChanged(request);
    if (outcome.status === 'refused' && outcome.httpStatus === 404) return handlers.onGone(item);
    setFailed(true);
  }

  const setAll = (choice: PropagationChoice): void => setChoices(allOn(propagation.differing, choice));
  const setOne = (id: string, choice: PropagationChoice): void => setChoices((current) => ({ ...current, [id]: choice }));
  return { choices, submitting, failed, save, setAll, setOne };
}

interface SyncBodyProps {
  readonly request: SyncRequest;
  readonly title: RefObject<HTMLHeadingElement | null>;
  readonly onBusy: (busy: boolean) => void;
  readonly handlers: Handlers;
}

function SyncBody({ request, title, onBusy, handlers }: SyncBodyProps) {
  const { item, propagation } = request;
  const state = useChoices(request, handlers, onBusy);
  const count = propagation.differing.length;
  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-s-3">
          <Icon icon={TriangleAlert} size="large" className="mt-s-1 shrink-0 text-accent-ink" />
          <DialogTitle ref={title} tabIndex={-1} className={cn('min-w-0 flex-1 outline-none', BREAK_LONG_NAMES)}>
            {differTitle(item.name, item.unit, propagation.previousDefault, item.defaultValue)}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close" disabled={state.submitting}>
              <Icon icon={X} size="large" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription>{differBody(propagation.moved, count, item.unit, propagation.previousDefault, item.defaultValue)}</DialogDescription>
      </DialogHeader>
      {state.failed ? (
        <Notice tone="danger" title={FAILED_CHOICES_TITLE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <div role="region" aria-label={DIFFER_LIST_LABEL} className="flex min-h-0 flex-1 flex-col gap-s-3 overflow-y-auto">
        {propagation.differing.map((customer) => (
          <CustomerChoice
            key={customer.customerId}
            customer={customer}
            unit={item.unit}
            next={item.defaultValue}
            choice={state.choices[customer.customerId] ?? 'keep'}
            onChange={(choice) => state.setOne(customer.customerId, choice)}
          />
        ))}
      </div>
      <DialogFooter className="flex-wrap sm:justify-between">
        <div className="flex flex-col gap-s-3 sm:flex-row">
          <Button variant="secondary" disabled={state.submitting} onClick={() => state.setAll('keep')}>
            {keepAllLabel(count)}
          </Button>
          <Button variant="secondary" disabled={state.submitting} onClick={() => state.setAll('apply')}>
            {applyAllLabel(count)}
          </Button>
        </div>
        <Button loading={state.submitting} onClick={() => void state.save()}>
          {state.submitting ? SAVING_CHOICES : SAVE_CHOICES}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ProcessSyncDialog({ open, request, onDismiss, onCloseAutoFocus, ...handlers }: ProcessSyncDialogProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => (next || request === null || busy ? undefined : onDismiss(request))}>
      <DialogContent
        className="max-w-[45rem] overflow-hidden"
        onOpenAutoFocus={(event) => {
          // Focus lands on the title, so a screen reader reads what the window is about before its first control (AC-10).
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {request === null ? null : <SyncBody request={request} title={title} onBusy={setBusy} handlers={handlers} />}
      </DialogContent>
    </Dialog>
  );
}
