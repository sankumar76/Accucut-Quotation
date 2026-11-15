'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { blockedSummary, CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CustomerView } from '@/lib/estimates/estimates-client';
import { askToLeave } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

import type { CalculateBarProps } from './calculate-bar';
import type { CalculateSummaryProps } from './calculate-summary';
import type { ChangeCustomerDialogProps } from './change-customer-dialog';
import { CUSTOMER_FIELD_ID, CustomerPicker } from './customer-picker';
import { CALCULATE_BAR_FAILED_TITLE, CALCULATE_FAILED_TITLE, CALCULATE_SUBMITTED_TITLE, CALCULATE_UNSAVED_TITLE, FAILED_BODY, FORM_AREA_LOCKED, FORM_AREA_TITLE, LEAVE_GUARD_FAILED_TITLE, NO_CUSTOMER_BODY, NO_CUSTOMER_TITLE } from './estimate-texts';
import { focusFirstField } from './focus-field';
import type { LeaveGuardProps } from './leave-guard';
import { PartForm } from './part-form';
import { PartsTreeArea } from './parts-tree-area';
import { useCalculate } from './use-calculate';
import { useCustomerChoice } from './use-customer-choice';
import { useLazyComponent } from './use-lazy-component';
import type { SavedPart } from './use-part-form';
import { usePartsTree, type PartsTreeState } from './use-parts-tree';
import { WorkspaceHeader, type WorkspaceHeaderView } from './workspace-header';

/**
 * SCR-05 "Estimate workspace", the Engineer's page (STORY-05.01 AC-1 to AC-4): the task's header, the Customer field and the area where the parts tree (STORY-05.02)
 * and the form (the next story) open. Until a customer is chosen the notice says so and the area is disabled (`inert`, so nothing in it takes focus or a
 * click, and `aria-disabled` so it is announced); choosing one opens it. It decides nothing: the estimate's state and the customer are the server's.
 *
 * **Calculate (STORY-05.09).** The action bar at the bottom presses it. A blocked answer is a summary at the top with each part and field as a link, a triangle on each part in the tree, the words
 * under each blank field and a triangle on each card and in the section strip; a good one turns the page to "Submitted": the badge, the sentence, inputs read-only, part actions hidden and
 * the button "Submitted" (`canEditInputs`, the same rule the server asks again). The page holds the status from the answer, not a guess: the server decided it.
 */

/** The code of the three parts that nobody needs before the page is up, each fetched after it is (`use-lazy-component.ts`; NFR-009: this page's first load has no room left in 200 KB). */
const loadBar = () => import('./calculate-bar').then((module) => module.CalculateBar);
const loadSummary = () => import('./calculate-summary').then((module) => module.CalculateSummary);
const loadChangeDialog = () => import('./change-customer-dialog').then((module) => module.ChangeCustomerDialog);
/** The warning on leaving (STORY-05.08): typing is possible only once the form's code is here, and this is asked for on mount beside it. Its dialog is an overlay, so it is never imported with a plain import. */
const loadGuard = () => import('./leave-guard').then((module) => module.LeaveGuard);
const stay = (): void => undefined;

export interface EstimateWorkspaceProps {
  readonly header: WorkspaceHeaderView;
  readonly estimateId: string;
  readonly customer: CustomerView | null;
}

export function EstimateWorkspace({ header, estimateId, customer }: EstimateWorkspaceProps) {
  // The status is the server's: it starts as the page was rendered and becomes SUBMITTED when Calculate says it did.
  const [status, setStatus] = useState<EstimateStatus>(header.status);
  // This page is the Engineer's (a Lead or an Admin sees the short header until SCR-06), so the Engineer's rule is the one asked.
  const editable = canEditInputs(status, 'ENGINEER');
  const choice = useCustomerChoice({ estimateId, initial: customer, editable });
  const hasCustomer = choice.current !== null;
  // The tree lives here: the form beside it is for the part chosen in it, and a save of the form gives the tree the part's new revision.
  const tree = usePartsTree(estimateId);
  const selected = tree.selected === null ? null : { id: tree.selected.id, slNo: tree.selected.slNo, revision: tree.selected.revision };
  // What Calculate waits for: the part form's saves in flight, and the fields that show a value that is not saved (review SQR-01 of AQP-317).
  const [saves] = useState(createSaveGate);
  const calculation = useCalculate({ estimateId, onSubmitted: () => setStatus('SUBMITTED'), settle: saves.settle });
  const bar = useLazyComponent<CalculateBarProps>(loadBar, true);
  const summary = useLazyComponent<CalculateSummaryProps>(loadSummary, calculation.blocked !== null);
  const changeDialog = useLazyComponent<ChangeCustomerDialogProps>(loadChangeDialog, choice.pending !== null);
  const Bar = bar.Component;
  const Summary = summary.Component;
  const ChangeDialog = changeDialog.Component;
  const guard = useLazyComponent<LeaveGuardProps>(loadGuard, true);
  const Guard = guard.Component;
  /**
   * Another part, or a new one, takes the form that shows the part now away, with whatever was typed into it and is not saved (STORY-05.08 AC-4, AC-5). So while anything is unsaved the person is asked
   * first, once the saves in flight have finished; with nothing unsaved the choice goes through at once, as before.
   */
  const guarded = (go: () => void): void => (saves.isDirty() ? askToLeave({ proceed: go, cancel: stay }) : go());
  const guardedTree: PartsTreeState = { ...tree, select: (next) => guarded(() => tree.select(next)), add: (kind) => guarded(() => tree.add(kind)) };
  const submittedNotice = useRef<HTMLDivElement>(null);
  // The press that submitted the estimate: the button has become "Submitted" and is off, so focus goes to the notice. A reload of a submitted estimate steals nothing (`done` is null).
  useEffect(() => {
    if (calculation.done !== null) submittedNotice.current?.focus();
  }, [calculation.done]);
  const missingFields = useMemo(() => new Map((calculation.blocked ?? []).map((part) => [part.nodeId, new Set(part.fields.map((field) => field.fieldId))])), [calculation.blocked]);
  const missingParts = useMemo(() => new Set(missingFields.keys()), [missingFields]);
  const noFields: ReadonlySet<string> = useMemo(() => new Set<string>(), []);

  /** The dialog closes: focus goes back to the field it was opened from. */
  const returnFocus = (event: Event): void => {
    event.preventDefault();
    document.getElementById(CUSTOMER_FIELD_ID)?.focus();
  };

  /** A save went through: the tree takes the part's revision and icon, and the summary drops the fields that now have a value. */
  const saved = (part: SavedPart): void => {
    tree.applySaved(part);
    calculation.filled(part.id, part.inputs);
  };

  return (
    <>
      <WorkspaceHeader view={{ ...header, status }} />
      {Guard !== null ? (
        <Guard gate={saves} />
      ) : guard.failed ? (
        // The warning on leaving could not be fetched: the page then has no protection for what is typed, and says so instead of looking as if it had (review SQR-05).
        <Notice tone="danger" title={LEAVE_GUARD_FAILED_TITLE} />
      ) : null}
      {calculation.blocked === null ? null : Summary === null ? (
        // The list's code is on its way (or could not be fetched): the sentence is the server's, and it is never missing.
        <Notice tone="danger" title={blockedSummary(calculation.blocked.length)} />
      ) : (
        <Summary parts={calculation.blocked} onChoosePart={guardedTree.select} focusRequest={calculation.focusRequest} />
      )}
      {calculation.problem === null ? null : (
        <Notice tone="danger" title={calculation.problem.kind === 'refused' ? calculation.problem.message : calculation.problem.kind === 'unsaved' ? CALCULATE_UNSAVED_TITLE : CALCULATE_FAILED_TITLE}>
          {calculation.problem.kind === 'failed' ? FAILED_BODY : null}
        </Notice>
      )}
      {status === 'SUBMITTED' ? (
        // The state "Submitted": the one sentence the server answers with and nothing else. No number from the calculation is anywhere (NFR-002). Focus comes here after the press that submitted it.
        <div ref={submittedNotice} tabIndex={-1} data-calculate-submitted="" className="rounded-md">
          <Notice tone="success" title={CALCULATE_SUBMITTED_TITLE}>
            {calculation.done ?? CALCULATE_MESSAGE}
          </Notice>
        </div>
      ) : null}
      {hasCustomer || !editable ? null : (
        <Notice tone="info" title={NO_CUSTOMER_TITLE}>
          {NO_CUSTOMER_BODY}
        </Notice>
      )}
      <CustomerPicker choice={choice} editable={editable} />
      {ChangeDialog === null || choice.current === null || choice.pending === null ? null : (
        <ChangeDialog
          current={choice.current}
          pending={choice.pending}
          open={choice.dialogOpen}
          saving={choice.saving}
          problem={choice.problem}
          onConfirm={() => void choice.confirmChange()}
          onCancel={choice.cancelChange}
          onCloseAutoFocus={returnFocus}
        />
      )}
      <Card role="group" aria-labelledby="estimate-form-area-title" aria-disabled={!hasCustomer} inert={!hasCustomer} className={hasCustomer ? undefined : 'opacity-60'}>
        <CardHeader>
          <CardTitle id="estimate-form-area-title">{FORM_AREA_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-s-4 lg:flex-row">
          <PartsTreeArea tree={guardedTree} editable={editable} onOpenPart={focusFirstField} missingIds={missingParts} />
          {hasCustomer ? (
            <PartForm estimateId={estimateId} part={selected} editable={editable} onSaved={saved} onChanged={tree.readAgain} missing={selected === null ? noFields : (missingFields.get(selected.id) ?? noFields)} gate={saves} />
          ) : (
            <p className="min-w-0 flex-1 text-body text-ink-2">{FORM_AREA_LOCKED}</p>
          )}
        </CardContent>
      </Card>
      {status === 'APPROVED' ? null : Bar !== null ? (
        <Bar submitted={status === 'SUBMITTED'} calculation={calculation} gate={saves} onChoosePart={guardedTree.select} />
      ) : bar.failed ? (
        // The button's code could not be fetched: the person is told so and what to do, never left with no button and no word (review SQR-06 of AQP-317).
        <Notice tone="danger" title={CALCULATE_BAR_FAILED_TITLE} />
      ) : null}
    </>
  );
}
