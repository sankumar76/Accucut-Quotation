'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import type { CustomerView } from '@/lib/estimates/estimates-client';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import type { ChangeCustomerDialogProps } from './change-customer-dialog';
import { CHANGE_CUSTOMER_BUTTON_ID } from './customer-ids';
import { CHANGE_LABEL, FIRST_OPEN_FAILED, SET_LABEL } from './customer-texts';

/**
 * The "Change customer" action of SCR-06's header (CR-01 item 6, AQP-390; UX spec SCR-06): drawn for a Lead or an Admin on an estimate that is not approved, beside the customer's name (an Engineer never gets it,
 * and the server refuses their request all the same). A script as small as it can be (NFR-009, ADR-016: `/estimates/[code]` has a budget, measured by CI stage 11b). **The dialog is not in the first load**: its
 * code is fetched by a bare `import()` on the first press, through the loader every overlay uses (`useFirstOpen`, architecture section 10), and the type of its props is imported as a type only. A press
 * before the page was interactive is kept (`data-early-intent`).
 *
 * Nothing is decided here. After a good change the page is drawn again by the server (`router.refresh()`), so the new customer, its short name and the cleared figures reach the screen the way they always do;
 * focus returns to this button, which is still on the page.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is shown as the first-open failure line, and the next press tries again. */
const loadDialog = () => import('./change-customer-dialog').then((module) => module.ChangeCustomerDialog);

const FAILURE_ID = 'review-change-customer-first-open-failure';

export interface ChangeCustomerButtonProps {
  readonly estimateId: string;
  /** The customer the estimate has now, or null for one made before CR-01 that has none (the button then says "Set customer"). */
  readonly current: CustomerView | null;
  /** The button stands in a line of text (SCR-06's meta line, AQP-452): the look of a ghost button, the height of a row button, no border. */
  readonly inline?: boolean;
}

export function ChangeCustomerButton({ estimateId, current, inline = false }: ChangeCustomerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startRefresh] = useTransition();
  const first = useFirstOpen<ChangeCustomerDialogProps>({ id: CHANGE_CUSTOMER_BUTTON_ID, load: loadDialog, onOpen: () => setOpen(true) });
  const Dialog = first.Overlay;
  return (
    <span className="relative inline-flex flex-col gap-s-1">
      <Button
        id={CHANGE_CUSTOMER_BUTTON_ID}
        variant={inline ? 'ghost' : 'secondary'}
        {...(inline ? { className: 'h-(--control-h) px-s-2 fine-wide:h-(--control-h-row)' } : {})}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={first.pending || undefined}
        aria-describedby={first.failed ? FAILURE_ID : undefined}
        {...{ [EARLY_INTENT_ATTRIBUTE]: CHANGE_CUSTOMER_BUTTON_ID }}
        onClick={(event) => first.activate(event.detail === 0)}
      >
        {current === null ? SET_LABEL : CHANGE_LABEL}
      </Button>
      {first.failed ? <FirstOpenFailure id={FAILURE_ID} message={FIRST_OPEN_FAILED} align="left" /> : null}
      {Dialog === null ? null : (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          estimateId={estimateId}
          current={current}
          onChanged={() => {
            setOpen(false);
            startRefresh(() => router.refresh());
          }}
          onCloseAutoFocus={(event) => {
            // Radix has no trigger to return focus to, so it is placed here.
            event.preventDefault();
            document.getElementById(CHANGE_CUSTOMER_BUTTON_ID)?.focus();
          }}
        />
      )}
    </span>
  );
}
