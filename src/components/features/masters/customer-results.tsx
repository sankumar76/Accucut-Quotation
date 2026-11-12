'use client';

import { Plus, SearchX, Users } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { EmptyState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

import { CustomerList } from './customer-list';
import {
  ADD_CUSTOMER,
  CUSTOMERS_EMPTY_DESCRIPTION,
  CUSTOMERS_EMPTY_TITLE,
  CUSTOMERS_ERROR_TITLE,
  CUSTOMERS_LOADING_LABEL,
  CUSTOMERS_NO_MATCH_DESCRIPTION,
  CUSTOMERS_SAVED_NOT_SHOWN_BODY,
  noCustomerMatchTitle,
} from './customer-texts';
import { MasterLoadError } from './master-load-error';
import type { CustomersState } from './use-customers';

/**
 * What the card of SCR-12 shows below the search (STORY-02.02 AC-8): the error with "Try again", the skeleton once 300 ms have passed, the empty state
 * ("No customers yet"), "No customer matches" with the way to add one, or the customers. The skeleton rows are `aria-busy`, with a polite "Loading" beside
 * them (`SkeletonBlock`). The Add customer button of the empty and no-match states is a second way to the same dialog, so it carries the same
 * `data-action` as the one in the page header and focus returns to whichever is on screen (`findOpenerElement`).
 */

const SKELETON_ROWS = 6;

export interface CustomerResultsProps {
  readonly customers: CustomersState;
  /** True once a change has been saved on this page: the load error then says the change was saved. */
  readonly changeSaved: boolean;
}

function AddButton({ onAdd }: { readonly onAdd: (byKeyboard: boolean) => void }) {
  return (
    <Button data-action="add" onClick={(event) => onAdd(event.detail === 0)}>
      <Icon icon={Plus} />
      {ADD_CUSTOMER}
    </Button>
  );
}

export function CustomerResults({ customers, changeSaved }: CustomerResultsProps) {
  const { list } = customers;
  if (list.status === 'error') {
    return (
      <MasterLoadError
        title={CUSTOMERS_ERROR_TITLE}
        description={changeSaved ? CUSTOMERS_SAVED_NOT_SHOWN_BODY : undefined}
        onRetry={() => void customers.readAgain(false)}
      />
    );
  }
  if (list.showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={CUSTOMERS_LOADING_LABEL} />;
  if (list.items.length === 0) {
    return (
      <div role="status">
        <EmptyState
          icon={<Icon icon={Users} size="state" />}
          title={CUSTOMERS_EMPTY_TITLE}
          description={CUSTOMERS_EMPTY_DESCRIPTION}
          action={<AddButton onAdd={customers.onAdd} />}
        />
      </div>
    );
  }
  if (list.shown.length === 0) {
    return (
      <div role="status">
        <EmptyState
          icon={<Icon icon={SearchX} size="state" />}
          title={noCustomerMatchTitle(list.query)}
          description={CUSTOMERS_NO_MATCH_DESCRIPTION}
          action={<AddButton onAdd={customers.onAdd} />}
        />
      </div>
    );
  }
  return <CustomerList items={list.shown} onEdit={customers.onEdit} />;
}
