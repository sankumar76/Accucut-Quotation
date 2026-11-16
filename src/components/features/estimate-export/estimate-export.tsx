import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatCount, NO_FIGURE } from '@/lib/money';
import type { ExportSummaryView } from '@/server/views/schemas/export';

import { DownloadButton } from './download-button';
import {
  BACK_TO_ESTIMATE,
  COLUMNS_RANGE,
  EMPTY_BODY,
  EMPTY_TITLE,
  EXPORT_TITLE,
  FILE_CARD_TITLE,
  FILE_COLUMNS_LABEL,
  FILE_NAME_LABEL,
  FILE_ROWS_LABEL,
  HEAD_COUNT,
  HEAD_PART,
  HEAD_SL_NO,
  PART_NAME_FALLBACK,
  PARTS,
  ROWS_CAPTION,
  ROWS_CARD_NOTE,
  ROWS_CARD_TITLE,
  ROWS_REGION_LABEL,
} from './export-texts';

/**
 * SCR-10 "Excel export" (STORY-07.01 AC-6; UX spec SCR-10), what a Lead or an Admin sees at `/estimates/<code>/export`: the file card (name, rows, the columns A to BO, **Download .xlsx**) and the card
 * "The rows in the file". It is drawn from one `ExportSummaryView`, the strict answer of `GET /api/v1/estimates/{id}/export-summary`, which holds **no figure**, so this file has nowhere to read one from.
 * An estimate with no parts shows the Empty state (`role="status"`) and no file card.
 *
 * **Restricted** (NFR-002): every file in this folder is for the Lead and the Admin. The folder is loaded by `export/page.tsx` alone, whose manifest row lists no Engineer, and nothing outside it imports it.
 * The only script is `DownloadButton`. The table scrolls inside its own focusable, named region and the button stacks full width at 360 px (AC-7).
 */

export interface EstimateExportProps {
  readonly summary: ExportSummaryView;
  readonly estimateId: string;
  /** The task code of the estimate (the address of the estimate's own page). */
  readonly code: string;
}

const DOWNLOAD_BUTTON_ID = 'export-download';

function EstimateLink({ code }: { readonly code: string }) {
  return (
    <Button asChild variant="secondary">
      <Link href={`/estimates/${encodeURIComponent(code)}`} prefetch={false}>
        {BACK_TO_ESTIMATE}
      </Link>
    </Button>
  );
}

function FileCard({ summary, estimateId }: { readonly summary: ExportSummaryView; readonly estimateId: string }) {
  const { columns } = summary;
  return (
    <Card>
      <CardContent className="flex flex-col gap-s-4">
        <h2 className="text-body font-semibold text-ink">{FILE_CARD_TITLE}</h2>
        <dl className="grid gap-s-3 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-s-4">
          <dt className="text-label font-semibold text-ink-2">{FILE_NAME_LABEL}</dt>
          <dd className={cn('text-body text-ink', BREAK_LONG_NAMES)}>{summary.fileName}</dd>
          <dt className="text-label font-semibold text-ink-2">{FILE_ROWS_LABEL}</dt>
          <dd className="text-body text-ink tabular-nums">{PARTS(summary.partCount)}</dd>
          <dt className="text-label font-semibold text-ink-2">{FILE_COLUMNS_LABEL}</dt>
          <dd className="text-body text-ink">{COLUMNS_RANGE(columns.first, columns.last)}</dd>
        </dl>
        <DownloadButton id={DOWNLOAD_BUTTON_ID} estimateId={estimateId} fileName={summary.fileName} partCount={summary.partCount} pictureCount={summary.pictureCount} />
      </CardContent>
    </Card>
  );
}

function RowsCard({ summary }: { readonly summary: ExportSummaryView }) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-s-3">
        <h2 className="text-body font-semibold text-ink">{ROWS_CARD_TITLE}</h2>
        <p className="text-label text-ink-2">{ROWS_CARD_NOTE}</p>
        <Table regionLabel={ROWS_REGION_LABEL} caption={ROWS_CAPTION}>
          <TableHeader>
            <TableRow>
              <TableHead>{HEAD_SL_NO}</TableHead>
              <TableHead>{HEAD_PART}</TableHead>
              <TableHead className="text-right">{HEAD_COUNT}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.rows.map((row) => (
              <TableRow key={row.slNo}>
                <TableCell className="tabular-nums">{row.slNo}</TableCell>
                <TableCell className={cn('min-w-0', BREAK_LONG_NAMES)}>{row.name === '' ? PART_NAME_FALLBACK : row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.count === null ? NO_FIGURE : formatCount(row.count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function EstimateExport({ summary, estimateId, code }: EstimateExportProps) {
  return (
    <>
      <PageHeader title={EXPORT_TITLE} actions={<EstimateLink code={code} />} />
      {summary.partCount === 0 ? (
        <Notice tone="info" role="status" title={EMPTY_TITLE}>
          {EMPTY_BODY}
        </Notice>
      ) : (
        <div className="flex flex-col gap-s-4">
          <FileCard summary={summary} estimateId={estimateId} />
          <RowsCard summary={summary} />
        </div>
      )}
    </>
  );
}
