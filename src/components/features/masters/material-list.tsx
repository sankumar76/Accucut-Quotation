'use client';

import { Pencil } from 'lucide-react';
import type { MouseEvent } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { MATERIAL_FIELD_LABELS } from '@/lib/masters/materials';
import type { MaterialRow } from '@/lib/masters/materials-client';

import { editMaterialLabel, PRICE_HEADING, SCRAP_HEADING } from './material-texts';
import { isOpener, type Opener } from './process-opener';
import { BREAK_LONG_NAMES } from './process-texts';

/**
 * The materials of SCR-13 (STORY-02.03 AC-1, AC-7): a table from 768 px, where it scrolls inside its own container only, and a card for
 * each material below it. Both carry the same action with the same name; the row action of the table is the 36 px icon button of dense
 * tables, the card's is full-size. It decides nothing: it draws the materials it is given and tells its parent which one was pressed, so
 * focus can return to its button. The numbers are the server's decimal text; Delete is story 02.07's.
 */

export interface MaterialListProps {
  readonly items: ReadonlyArray<MaterialRow>;
  /** The button whose dialog is still loading: it keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pendingOpener: Opener | null;
  readonly onEdit: (item: MaterialRow, byKeyboard: boolean) => void;
}


function EditButton({ item, pendingOpener, onEdit, compact }: MaterialListProps & { readonly item: MaterialRow; readonly compact: boolean }) {
  const press = (event: MouseEvent<HTMLButtonElement>): void => onEdit(item, event.detail === 0);
  // Passed only when true: an explicit `aria-busy={undefined}` would replace the one a `loading` button sets itself.
  const busy = isOpener(pendingOpener, item.id, 'edit') ? ({ 'aria-busy': true } as const) : {};
  return (
    <Button
      variant={compact ? 'ghost' : 'secondary'}
      size={compact ? 'icon-row' : 'default'}
      data-action="edit"
      aria-label={editMaterialLabel(item.materialInDrawing)}
      {...busy}
      onClick={press}
    >
      {compact ? (
        <Icon icon={Pencil} size="large" />
      ) : (
        <>
          <Icon icon={Pencil} />
          Edit
        </>
      )}
    </Button>
  );
}

/** The table from 768 px: it scrolls inside its own container only. */
function MaterialTable(props: MaterialListProps) {
  return (
    <Table regionLabel="Material Master, scrollable" caption="Material Master" actionButtons={1}>
      <TableHeader>
        <TableRow>
          <TableHead>{MATERIAL_FIELD_LABELS.materialInDrawing}</TableHead>
          <TableHead>{MATERIAL_FIELD_LABELS.materialConsidered}</TableHead>
          <TableHead className="text-right">{PRICE_HEADING}</TableHead>
          <TableHead className="text-right">{MATERIAL_FIELD_LABELS.specificGravity}</TableHead>
          <TableHead className="text-right">{SCRAP_HEADING}</TableHead>
          <TableActionsHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.items.map((item) => (
          <TableRow key={item.id} data-item-id={item.id}>
            <TableCell className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.materialInDrawing}</TableCell>
            <TableCell className={BREAK_LONG_NAMES}>{item.materialConsidered}</TableCell>
            <TableCell className="text-right tabular-nums">{item.pricePerKg}</TableCell>
            <TableCell className="text-right tabular-nums">{item.specificGravity}</TableCell>
            <TableCell className="text-right tabular-nums">{item.scrapRate}</TableCell>
            <TableActionsCell>
              <div className="flex flex-nowrap items-center justify-end gap-s-2">
                <EditButton {...props} item={item} compact />
              </div>
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** One number of a card with its label, as the table's heading would say it. */
function CardFigure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-s-3">
      <dt className="min-w-0 text-label text-ink-2">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** A card for each material below 768 px. */
function MaterialCards(props: MaterialListProps) {
  return (
    <ul aria-label="Material Master" className="flex flex-col">
      {props.items.map((item) => (
        <li key={item.id} data-item-id={item.id} className="flex flex-col gap-s-3 border-b border-border p-s-4 last:border-b-0">
          <div className="flex min-w-0 flex-col">
            <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.materialInDrawing}</span>
            <span className={cn('text-ink-2', BREAK_LONG_NAMES)}>{item.materialConsidered}</span>
          </div>
          <dl className="flex flex-col gap-s-2">
            <CardFigure label={PRICE_HEADING} value={item.pricePerKg} />
            <CardFigure label={MATERIAL_FIELD_LABELS.specificGravity} value={item.specificGravity} />
            <CardFigure label={SCRAP_HEADING} value={item.scrapRate} />
          </dl>
          <div className="flex flex-wrap gap-s-2">
            <EditButton {...props} item={item} compact={false} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MaterialList(props: MaterialListProps) {
  return (
    <>
      <div className="hidden md:block">
        <MaterialTable {...props} />
      </div>
      <div className="md:hidden">
        <MaterialCards {...props} />
      </div>
    </>
  );
}
