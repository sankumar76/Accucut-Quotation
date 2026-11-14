'use client';

import { Pencil, Trash2 } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import type { CustomerSummaryRow } from '@/lib/masters/customers-client';

import {
  ALL_DEFAULT,
  CUSTOMER_HEADINGS,
  CUSTOMER_LIST_LABEL,
  CUSTOMER_REGION_LABEL,
  DELETE_ACTION,
  deleteCustomerLabel,
  differText,
  EDIT_ACTION,
  editCustomerLabel,
} from './customer-texts';
import { isOpener, type Opener } from './master-opener';
import { BREAK_LONG_NAMES } from './master-texts';

/**
 * The customers of SCR-12 (STORY-02.02 AC-1, AC-8; STORY-02.07 AC-7): a masters table from 768 px (ux-spec section 6.0 "Masters tables" and "The Customers list from 768
 * px": the shared `Table` with its sticky Actions column holding Edit and Delete, 112 px (`actionButtons={2}`); names wrap; the E-mail column is
 * hidden below 1024 px because the same value is on the edit page), and a card for each customer below it. The way in to a customer is the Edit button, named
 * `Edit <customer name>`; the name beside it is text and not a second link to the same page, so the first Tab from the table lands on a row action (the
 * masters-table rule of ux-spec section 6.0 "Tests", held by `masters-table-actions.spec.ts` for every table). It decides nothing: it draws the customers it
 * is given.
 */

export interface CustomerListProps {
  readonly items: ReadonlyArray<CustomerSummaryRow>;
  readonly onEdit: (id: string) => void;
  /** The Delete button whose dialog is still loading: it keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pendingOpener: Opener | null;
  readonly onDelete: (item: CustomerSummaryRow, button: HTMLButtonElement, byKeyboard: boolean) => void;
}

/** The Rates cell and line: how many differ, or that none does. Text, not colour alone. */
function RatesText({ differ }: { readonly differ: number }) {
  return differ === 0 ? <span className="text-ink-3">{ALL_DEFAULT}</span> : <span>{differText(differ)}</span>;
}

function NameText({ item }: { readonly item: CustomerSummaryRow }) {
  return <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.name}</span>;
}

/** The Edit and Delete buttons of a row: the table's are the 36 px icon buttons of dense tables, the cards' are full-size, and both are named for the customer. */
function RowButtons({ item, onEdit, onDelete, pendingOpener, compact }: CustomerListProps & { readonly item: CustomerSummaryRow; readonly compact: boolean }) {
  const size = compact ? 'icon-row' : 'default';
  const variant = 'secondary';
  // Passed only when true: an explicit `aria-busy={undefined}` would replace the one a `loading` button sets itself.
  const busy = isOpener(pendingOpener, item.id, 'delete') ? ({ 'aria-busy': true } as const) : {};
  return (
    <>
      <Button variant={variant} size={size} data-action="edit" aria-label={editCustomerLabel(item.name)} onClick={() => onEdit(item.id)}>
        <Icon icon={Pencil} size={compact ? 'large' : 'default'} />
        {compact ? null : EDIT_ACTION}
      </Button>
      <Button
        variant={variant}
        size={size}
        data-action="delete"
        aria-label={deleteCustomerLabel(item.name)}
        {...busy}
        onClick={(event) => onDelete(item, event.currentTarget, event.detail === 0)}
      >
        <Icon icon={Trash2} size={compact ? 'large' : 'default'} />
        {compact ? null : DELETE_ACTION}
      </Button>
    </>
  );
}

/** The table from 768 px: it scrolls inside its own container only, and its Actions column holds two buttons, Edit and Delete (112 px). */
function CustomerTable(props: CustomerListProps) {
  const { items } = props;
  return (
    <Table regionLabel={CUSTOMER_REGION_LABEL} caption={CUSTOMER_LIST_LABEL} actionButtons={2}>
      <TableHeader>
        <TableRow>
          <TableHead>{CUSTOMER_HEADINGS.name}</TableHead>
          <TableHead>{CUSTOMER_HEADINGS.phone}</TableHead>
          <TableHead className="hidden lg:table-cell">{CUSTOMER_HEADINGS.email}</TableHead>
          <TableHead className="text-right">{CUSTOMER_HEADINGS.rates}</TableHead>
          <TableActionsHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} data-item-id={item.id}>
            <TableCell className={BREAK_LONG_NAMES}>
              <NameText item={item} />
            </TableCell>
            <TableCell className={cn('text-ink-2', BREAK_LONG_NAMES)}>{item.phone}</TableCell>
            <TableCell className={cn('hidden text-ink-2 lg:table-cell', BREAK_LONG_NAMES)}>{item.email}</TableCell>
            <TableCell className="text-right tabular-nums">
              <RatesText differ={item.differ} />
            </TableCell>
            <TableActionsCell>
              <div className="flex flex-nowrap items-center justify-end gap-s-2">
                <RowButtons {...props} item={item} compact />
              </div>
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each customer below 768 px. It carries the same two actions as the table (ux-spec section 6.0). */
function CustomerCards(props: CustomerListProps) {
  const { items } = props;
  return (
    <ul aria-label={CUSTOMER_LIST_LABEL} className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} data-item-id={item.id} className="flex flex-col gap-s-3 border-b border-border p-s-4 last:border-b-0">
          <div className="flex flex-col gap-s-1">
            <NameText item={item} />
            {item.phone === null ? null : <span className={cn('text-ink-2', BREAK_LONG_NAMES)}>{item.phone}</span>}
            <span className="text-label text-ink-2">
              <RatesText differ={item.differ} />
            </span>
          </div>
          <div className="flex flex-wrap gap-s-2">
            <RowButtons {...props} item={item} compact={false} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CustomerList(props: CustomerListProps) {
  return (
    <>
      <div className="hidden md:block">
        <CustomerTable {...props} />
      </div>
      <div className="md:hidden">
        <CustomerCards {...props} />
      </div>
    </>
  );
}
