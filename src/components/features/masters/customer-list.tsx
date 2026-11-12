'use client';

import { Pencil } from 'lucide-react';

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
  differText,
  EDIT_ACTION,
  editCustomerLabel,
} from './customer-texts';
import { BREAK_LONG_NAMES } from './master-texts';

/**
 * The customers of SCR-12 (STORY-02.02 AC-1, AC-8): a masters table from 768 px (ux-spec section 6.0 "Masters tables" and "The Customers list from 768
 * px": the shared `Table` with its sticky Actions column holding **Edit only**, 68 px, until story 02.07 adds Delete; names wrap; the E-mail column is
 * hidden below 1024 px because the same value is on the edit page), and a card for each customer below it. The way in to a customer is the Edit button, named
 * `Edit <customer name>`; the name beside it is text and not a second link to the same page, so the first Tab from the table lands on a row action (the
 * masters-table rule of ux-spec section 6.0 "Tests", held by `masters-table-actions.spec.ts` for every table). It decides nothing: it draws the customers it
 * is given.
 */

export interface CustomerListProps {
  readonly items: ReadonlyArray<CustomerSummaryRow>;
  readonly onEdit: (id: string) => void;
}

/** The Rates cell and line: how many differ, or that none does. Text, not colour alone. */
function RatesText({ differ }: { readonly differ: number }) {
  return differ === 0 ? <span className="text-ink-3">{ALL_DEFAULT}</span> : <span>{differText(differ)}</span>;
}

function NameText({ item }: { readonly item: CustomerSummaryRow }) {
  return <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.name}</span>;
}

function EditButton({ item, onEdit, compact }: Pick<CustomerListProps, 'onEdit'> & { readonly item: CustomerSummaryRow; readonly compact: boolean }) {
  return (
    <Button
      variant="secondary"
      size={compact ? 'icon-row' : 'default'}
      data-action="edit"
      aria-label={editCustomerLabel(item.name)}
      onClick={() => onEdit(item.id)}
    >
      <Icon icon={Pencil} size={compact ? 'large' : 'default'} />
      {compact ? null : EDIT_ACTION}
    </Button>
  );
}

/** The table from 768 px: it scrolls inside its own container only, and its Actions column holds one button. */
function CustomerTable({ items, onEdit }: CustomerListProps) {
  return (
    <Table regionLabel={CUSTOMER_REGION_LABEL} caption={CUSTOMER_LIST_LABEL} actionButtons={1}>
      <TableHeader>
        <TableRow>
          <TableHead>{CUSTOMER_HEADINGS.name}</TableHead>
          <TableHead>{CUSTOMER_HEADINGS.phone}</TableHead>
          <TableHead className="hidden lg:table-cell">{CUSTOMER_HEADINGS.email}</TableHead>
          <TableHead className="text-right">{CUSTOMER_HEADINGS.rates}</TableHead>
          <TableActionsHead className="min-w-[1200px]" />
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
                <EditButton item={item} onEdit={onEdit} compact />
              </div>
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each customer below 768 px. */
function CustomerCards({ items, onEdit }: CustomerListProps) {
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
            <EditButton item={item} onEdit={onEdit} compact={false} />
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
