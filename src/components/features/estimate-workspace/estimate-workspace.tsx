'use client';

import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import type { CustomerView } from '@/lib/estimates/estimates-client';

import { ChangeCustomerDialog } from './change-customer-dialog';
import { CUSTOMER_FIELD_ID, CustomerPicker } from './customer-picker';
import { FORM_AREA_LOCKED, FORM_AREA_OPEN, FORM_AREA_TITLE, NO_CUSTOMER_BODY, NO_CUSTOMER_TITLE } from './estimate-texts';
import { useCustomerChoice } from './use-customer-choice';
import { WorkspaceHeader, type WorkspaceHeaderView } from './workspace-header';

/**
 * SCR-05 "Estimate workspace", the Engineer's page (STORY-05.01 AC-1 to AC-4): the task's header, the Customer field and the area where the parts tree and the
 * form open (the next stories fill it). Until a customer is chosen the notice says so and the area is disabled (`inert`, so nothing in it takes focus or a
 * click, and `aria-disabled` so it is announced); choosing one opens it. It decides nothing: the estimate's state and the customer are the server's.
 */

export interface EstimateWorkspaceProps {
  readonly header: WorkspaceHeaderView;
  readonly estimateId: string;
  readonly customer: CustomerView | null;
}

export function EstimateWorkspace({ header, estimateId, customer }: EstimateWorkspaceProps) {
  // This page is the Engineer's (a Lead or an Admin sees the short header until SCR-06), so the Engineer's rule is the one asked.
  const editable = canEditInputs(header.status, 'ENGINEER');
  const choice = useCustomerChoice({ estimateId, initial: customer, editable });
  const hasCustomer = choice.current !== null;

  /** The dialog closes: focus goes back to the field it was opened from. */
  const returnFocus = (event: Event): void => {
    event.preventDefault();
    document.getElementById(CUSTOMER_FIELD_ID)?.focus();
  };

  return (
    <>
      <WorkspaceHeader view={header} />
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
        <CardContent>
          <p className="text-body text-ink-2">{hasCustomer ? FORM_AREA_OPEN : FORM_AREA_LOCKED}</p>
        </CardContent>
      </Card>
    </>
  );
}
