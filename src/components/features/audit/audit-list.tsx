import { ArrowRight } from 'lucide-react';
import type { Ref } from 'react';

import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditEntryRow } from '@/lib/audit/audit-client';
import { formatIst } from '@/lib/time';

import {
  ARROW_TEXT,
  CHANGE_FROM,
  CHANGE_TO,
  COLUMN_EVENT,
  COLUMN_OBJECT,
  COLUMN_WHEN,
  COLUMN_WHO,
  LIST_LABEL,
  SHOW_MORE,
  showingText,
  TABLE_CAPTION,
  TABLE_REGION_LABEL,
} from './texts';

/**
 * The entries of SCR-16 (STORY-01.07 AC-6, AC-8): a table from 768 px, which scrolls inside its own container only, and a card
 * for each entry below it. Both are drawn from the same entries, in the order the server sent them (newest first), and neither
 * has a control that changes an entry: there is nothing to press but "Show more entries". "Before to after" is two texts with an
 * arrow icon between them, and the word "to" for a screen reader, which cannot see the arrow.
 */

export interface AuditListProps {
  readonly entries: ReadonlyArray<AuditEntryRow>;
  readonly total: number;
  readonly hasMore: boolean;
  /** The next page is being read: the button says it is busy and a second press does nothing. */
  readonly loadingMore: boolean;
  readonly onShowMore: () => void;
  /** The line under the list, which takes focus when "Show more entries" has just shown the last page and so disappeared. */
  readonly footerRef: Ref<HTMLParagraphElement>;
}

/** "Not approved [arrow] Approved at ...": the arrow is drawn, and read as the word "to". */
function ChangeText({ change }: { readonly change: AuditEntryRow['change'] }) {
  return (
    <>
      {change.before} <Icon icon={ArrowRight} size="hint" className="inline align-text-bottom" />
      <span className="sr-only"> {ARROW_TEXT} </span> {change.after}
    </>
  );
}

/** The Event column: the category the entry appears under, or the stored event name for one this release does not know. */
function eventLabelOf(entry: AuditEntryRow): string {
  return entry.category?.label ?? entry.event;
}

export function AuditList({ entries, total, hasMore, loadingMore, onShowMore, footerRef }: AuditListProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
          <TableHeader>
            <TableRow>
              <TableHead>{COLUMN_WHEN}</TableHead>
              <TableHead>{COLUMN_WHO}</TableHead>
              <TableHead>{COLUMN_EVENT}</TableHead>
              <TableHead>{COLUMN_OBJECT}</TableHead>
              <TableHead>
                {CHANGE_FROM} <Icon icon={ArrowRight} size="hint" className="inline align-text-bottom" />
                <span className="sr-only"> {ARROW_TEXT} </span> {CHANGE_TO}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id} data-entry-id={entry.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{formatIst(new Date(entry.createdAt))}</TableCell>
                <TableCell>{entry.who}</TableCell>
                <TableCell>
                  <Badge tone="neutral">
                    {eventLabelOf(entry)}
                  </Badge>
                </TableCell>
                <TableCell className="break-words text-ink">{entry.objectLabel}</TableCell>
                <TableCell className="text-ink-2">
                  <ChangeText change={entry.change} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={LIST_LABEL} className="flex flex-col md:hidden">
        {entries.map((entry) => (
          <li key={entry.id} data-entry-id={entry.id} className="flex flex-col gap-s-2 border-b border-border p-s-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-s-3 gap-y-s-1">
              <span className="font-semibold text-ink">
                {eventLabelOf(entry)}
              </span>
              <span className="text-label text-ink-2 tabular-nums">{formatIst(new Date(entry.createdAt))}</span>
            </div>
            <div className="break-words text-ink">{entry.objectLabel}</div>
            <div className="break-words text-ink-2">
              <ChangeText change={entry.change} />
            </div>
            <div className="text-label text-ink-2">{entry.who}</div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-s-3 p-s-4">
        <p ref={footerRef} tabIndex={-1} role="status" className="text-label text-ink-2">
          {showingText(entries.length, total)}
        </p>
        {hasMore ? (
          <Button variant="secondary" data-action="more" {...(loadingMore ? { 'aria-busy': true } : {})} onClick={onShowMore}>
            {SHOW_MORE}
          </Button>
        ) : null}
      </div>
    </>
  );
}
