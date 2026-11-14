'use client';

import { useMemo, useState } from 'react';

import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CustomerView } from '@/lib/estimates/estimates-client';

import { CalculateBar } from './calculate-bar';
import { CalculateSummary, SubmittedNotice } from './calculate-summary';
import { ChangeCustomerDialog } from './change-customer-dialog';
import { CUSTOMER_FIELD_ID, CustomerPicker } from './customer-picker';
import { CALCULATE_FAILED_TITLE, FAILED_BODY, FORM_AREA_LOCKED, FORM_AREA_TITLE, NO_CUSTOMER_BODY, NO_CUSTOMER_TITLE } from './estimate-texts';
import { focusFieldWhenPresent } from './focus-field';
import { focusFirstField } from './part-fields';
import { PartForm } from './part-form';
import { PartsTreeArea } from './parts-tree-area';
import { useCalculate } from './use-calculate';
import { useCustomerChoice } from './use-customer-choice';
import type { SavedPart } from './use-part-form';
import { usePartsTree } from './use-parts-tree';
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
  const calculation = useCalculate({ estimateId, onSubmitted: () => setStatus('SUBMITTED') });
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

  /** A link of the summary: choose the part, then focus the field once that part's form is on the page. */
  const goToField = (nodeId: string, fieldId: string): void => {
    tree.select(nodeId);
    focusFieldWhenPresent(nodeId, fieldId);
  };

  return (
    <>
      <WorkspaceHeader view={{ ...header, status }} />
      {calculation.blocked === null ? null : <CalculateSummary parts={calculation.blocked} onGo={goToField} focusRequest={calculation.focusRequest} />}
      {calculation.problem === null ? null : (
        <Notice tone="danger" title={calculation.problem.kind === 'refused' ? calculation.problem.message : CALCULATE_FAILED_TITLE}>
          {calculation.problem.kind === 'failed' ? FAILED_BODY : null}
        </Notice>
      )}
      {status === 'SUBMITTED' ? <SubmittedNotice message={calculation.done ?? CALCULATE_MESSAGE} takeFocus={calculation.done !== null} /> : null}
      {hasCustomer || !editable ? null : (
        <Notice tone="info" title={NO_CUSTOMER_TITLE}>
          {NO_CUSTOMER_BODY}
        </Notice>
      )}
      <CustomerPicker choice={choice} editable={editable} />
      {choice.current === null || choice.pending === null ? null : (
        <ChangeCustomerDialog
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
          <PartsTreeArea tree={tree} editable={editable} onOpenPart={focusFirstField} missingIds={missingParts} />
          {hasCustomer ? (
            <PartForm estimateId={estimateId} part={selected} editable={editable} onSaved={saved} onChanged={tree.readAgain} missing={selected === null ? noFields : (missingFields.get(selected.id) ?? noFields)} />
          ) : (
            <p className="min-w-0 flex-1 text-body text-ink-2">{FORM_AREA_LOCKED}</p>
          )}
        </CardContent>
      </Card>
      {status === 'APPROVED' ? null : <CalculateBar submitted={status === 'SUBMITTED'} busy={calculation.busy} onCalculate={() => void calculation.calculate()} />}
    </>
  );
}
