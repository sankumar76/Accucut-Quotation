'use client';

import { Lock, Pencil, Trash2 } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { OTHER_LOCKED_REASON } from '@/lib/masters/treatments';
import type { TreatmentRow } from '@/lib/masters/treatments-client';

import { BREAK_LONG_NAMES } from './process-texts';
import {
  deleteTreatmentLabel,
  renameTreatmentLabel,
  TREATMENT_LIST_LABEL,
  TREATMENT_NAME_HEADING,
  TREATMENT_REGION_LABEL,
} from './treatment-texts';
import { TREATMENT_ACTIONS } from './use-treatments';

/**
 * The treatments of SCR-13's Treatment / Color tab (STORY-02.05 AC-1, AC-8): a masters table from 768 px (ux-spec section 6.0 "Masters tables": the
 * shared `Table` with its sticky Actions column of two buttons, 112 px; names wrap; the buttons stay on one line and are never moved into a menu), and
 * a card for each treatment below it. Both carry the same two actions with the same names, `Rename <name>` and `Delete <name>`; the row actions of
 * the table are the 36 px icon buttons of dense tables, the cards' are full-size. The locked "Other" row has no buttons and shows its reason as
 * text with a lock icon, so it is not told by colour alone. It decides nothing: it draws the treatments it is given and tells its parent which
 * action was pressed.
 */

export type TreatmentRowAction = 'rename' | 'delete';

export interface TreatmentListProps {
  readonly items: ReadonlyArray<TreatmentRow>;
  readonly onAction: (action: TreatmentRowAction, item: TreatmentRow) => void;
}

/** The reason a row is locked, as visible text beside a lock icon (AC-1). */
function LockedReason() {
  return (
    <span className="flex items-start gap-s-2 text-label font-normal text-ink-2">
      <Icon icon={Lock} size="small" className="mt-s-1 shrink-0" />
      <span>{OTHER_LOCKED_REASON}</span>
    </span>
  );
}

/** The name of a treatment, and under it the reason when the row is locked. */
function NameWithReason({ item }: { readonly item: TreatmentRow }) {
  return (
    <span className="flex flex-col gap-s-1">
      <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.name}</span>
      {item.locked ? <LockedReason /> : null}
    </span>
  );
}

function RowActions({ item, onAction, compact }: Pick<TreatmentListProps, 'onAction'> & { readonly item: TreatmentRow; readonly compact: boolean }) {
  const press = (action: TreatmentRowAction) => () => onAction(action, item);
  const size = compact ? 'icon-row' : 'default';
  const variant = compact ? 'ghost' : 'secondary';
  const label = (text: string, glyph: typeof Pencil) =>
    compact ? (
      <Icon icon={glyph} size="large" />
    ) : (
      <>
        <Icon icon={glyph} />
        {text}
      </>
    );

  return (
    <div className={compact ? 'flex flex-nowrap items-center justify-end gap-s-2' : 'flex flex-wrap gap-s-2'}>
      <Button variant={variant} size={size} data-action={TREATMENT_ACTIONS.rename} aria-label={renameTreatmentLabel(item.name)} onClick={press('rename')}>
        {label('Rename', Pencil)}
      </Button>
      <Button variant={variant} size={size} data-action={TREATMENT_ACTIONS.delete} aria-label={deleteTreatmentLabel(item.name)} onClick={press('delete')}>
        {label('Delete', Trash2)}
      </Button>
    </div>
  );
}

/** The table from 768 px: it scrolls inside its own container only, and its Actions column holds two buttons. */
function TreatmentTable({ items, onAction }: TreatmentListProps) {
  return (
    <Table regionLabel={TREATMENT_REGION_LABEL} caption={TREATMENT_LIST_LABEL} actionButtons={2}>
      <TableHeader>
        <TableRow>
          <TableHead>{TREATMENT_NAME_HEADING}</TableHead>
          <TableActionsHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} data-item-id={item.id}>
            <TableCell>
              <NameWithReason item={item} />
            </TableCell>
            <TableActionsCell>{item.locked ? null : <RowActions item={item} onAction={onAction} compact />}</TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each treatment below 768 px. */
function TreatmentCards({ items, onAction }: TreatmentListProps) {
  return (
    <ul aria-label={TREATMENT_LIST_LABEL} className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} data-item-id={item.id} className="flex flex-col gap-s-3 border-b border-border p-s-4 last:border-b-0">
          <NameWithReason item={item} />
          {item.locked ? null : <RowActions item={item} onAction={onAction} compact={false} />}
        </li>
      ))}
    </ul>
  );
}

export function TreatmentList(props: TreatmentListProps) {
  return (
    <>
      <div className="hidden md:block">
        <TreatmentTable {...props} />
      </div>
      <div className="md:hidden">
        <TreatmentCards {...props} />
      </div>
    </>
  );
}
