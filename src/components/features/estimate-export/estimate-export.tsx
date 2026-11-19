import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatCount, formatFigure, formatRupees, NO_FIGURE } from '@/lib/money';
import { formatIst } from '@/lib/time';
import type { ExportFiguresView, ExportSummaryView } from '@/server/views/schemas/export';

import { DownloadButton } from './download-button';
import {
  BACK_TO_ESTIMATE,
  BO_EMPTY,
  BO_NO_REASON,
  BO_REASON_NOT_IN_FILE,
  boApproved,
  boApprovedEarlier,
  boDifference,
  boReasonGiven,
  boSetAgainst,
  CALCULATE_FIRST_BODY,
  CALCULATE_FIRST_TITLE,
  CLEARED_LEAD,
  CLEARED_REST,
  COLUMN_MISMATCH,
  COLUMN_SUM_DIFFERS,
  COLUMN_SUM_LABEL,
  COLUMNS_RANGE,
  EMPTY_BODY,
  EMPTY_TITLE,
  EXPORT_TITLE,
  FILE_CARD_TITLE,
  FILE_COLUMNS_LABEL,
  FILE_NAME_LABEL,
  FILE_ROWS_LABEL,
  GO_TO_ESTIMATE_TO_CALCULATE,
  GO_TO_ESTIMATE_TO_RECALCULATE,
  HEAD_COUNT,
  HEAD_COUNT_WHOLE_ORDER,
  HEAD_IN_FILE_PRICE,
  HEAD_IN_FILE_TOOL_COST,
  HEAD_PART,
  HEAD_SL_NO,
  HOLDS_EMPTY_CELL,
  HOLDS_ONCE,
  HOLDS_OWN_TOOL_COST,
  HOLDS_TITLE,
  HOW_BODY,
  HOW_LEAD,
  HOW_TITLE,
  LINES_AS_SHOWN,
  NO_FIGURE_CELL,
  NOT_CALCULATED_LEAD,
  NOT_CALCULATED_REST,
  PART_NAME_FALLBACK,
  PARTS,
  RECALCULATE_FIRST_BODY,
  RECALCULATE_FIRST_TITLE,
  ROUNDING_SENTENCE,
  ROWS_CAPTION,
  ROWS_CAPTION_FIGURES,
  ROWS_CARD_NOTE,
  ROWS_CARD_NOTE_FIGURES,
  ROWS_CARD_TITLE,
  ROWS_REGION_LABEL,
  toolCostCell,
  TOTAL_TOOL_COST_LABEL,
  TOTAL_TOOL_COST_NOTE,
  TOTAL_TOOL_COST_ROW,
} from './export-texts';

/**
 * SCR-10 "Excel export" (STORY-07.01 AC-6; UX spec SCR-10), what a Lead or an Admin sees at `/estimates/<code>/export`: the file card (name, rows, the columns A to BO, **Download .xlsx**) and the card
 * "The rows in the file". It is drawn from one `ExportSummaryView`, the strict answer of `GET /api/v1/estimates/{id}/export-summary`, which holds **no figure**, so this file has nowhere to read one from.
 * An estimate with no parts shows the Empty state (`role="status"`) and no file card.
 *
 * **No file until a calculation is current (STORY-07.04 AC-5; D-28, D-37)**: while the figures are not `current` (never calculated, or cleared by an input change) the page draws **no file card and no table**:
 * a `role="status"` empty state with the 409's own words and a link to the estimate, "Go to the estimate to Calculate" or "to Recalculate". There is no out-of-date file, no marker for one and no confirmation.
 * It is drawn from the `state` of the summary alone, which the server read in the same snapshot as everything else; the file route refuses all the same.
 *
 * **The figures (STORY-07.03 AC-9)** are drawn from `summary.figures`, which is `null` unless the calculation is current: then the rows table keeps its three columns and holds no figure; with figures it adds
 * the file's own BG and Tool Cost per row, the BG column added up against BL2 and the Total Tool Cost, and the page adds the cards "How BL2 is made" and "What the file holds" (BL2, BN2, BO2 and the Total Tool Cost).
 * Every letter and cell address in the words is read from the summary (the registry), never written here.
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
  if (summary.figures !== null) return <FigureRowsCard summary={summary} figures={summary.figures} />;
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

/** The row number of a cell address (`BM13` is `13`). */
const rowOf = (address: string): string => address.replace(/^[A-Z]+/, '');

/** The rows card of a current calculation: the file's own count, BG and Tool Cost per row, then the BG column added up and the Total Tool Cost (UX spec SCR-10 "Layout"). */
function FigureRowsCard({ summary, figures }: { readonly summary: ExportSummaryView; readonly figures: ExportFiguresView }) {
  const { letters, cells, reconciliation } = figures;
  const names = new Map(summary.rows.map((row) => [row.slNo, row.name]));
  return (
    <Card className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-s-3">
        <h2 className="text-body font-semibold text-ink">{ROWS_CARD_TITLE}</h2>
        <p className="text-label text-ink-2">{ROWS_CARD_NOTE_FIGURES(letters.count, letters.bg)}</p>
        <Table regionLabel={ROWS_REGION_LABEL} caption={ROWS_CAPTION_FIGURES(letters.count, letters.bg, letters.toolCost)}>
          <TableHeader>
            <TableRow>
              <TableHead>{HEAD_SL_NO}</TableHead>
              <TableHead>{HEAD_PART}</TableHead>
              <TableHead className="text-right">{HEAD_COUNT_WHOLE_ORDER(letters.count)}</TableHead>
              <TableHead className="text-right">{HEAD_IN_FILE_PRICE(letters.bg)}</TableHead>
              <TableHead className="text-right">{HEAD_IN_FILE_TOOL_COST(letters.toolCost)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {figures.rows.map((row) => {
              const name = names.get(row.slNo) ?? '';
              return (
                <TableRow key={row.slNo}>
                  <TableCell className="tabular-nums">{row.slNo}</TableCell>
                  <TableCell className={cn('min-w-0', BREAK_LONG_NAMES)}>{name === '' ? PART_NAME_FALLBACK : name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFigure(row.bg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFigure(row.toolCost)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                {reconciliation.matches ? COLUMN_SUM_LABEL(cells.bl) : COLUMN_SUM_DIFFERS(cells.bl)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatFigure(reconciliation.columnSum)}</TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                {TOTAL_TOOL_COST_ROW(rowOf(cells.toolCostTotal))}
              </TableCell>
              <TableCell />
              <TableCell className="text-right font-semibold tabular-nums">{formatFigure(figures.totals.toolCostTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-label text-ink-2">{TOTAL_TOOL_COST_NOTE(cells.bn)}</p>
      </CardContent>
    </Card>
  );
}

/** "How BL2 is made": add the BG column and you get BL2, at any quantity; and the rounding sentence, with the two sums where the lines as shown differ from the total (UX-02, UX-54). */
function HowCard({ figures }: { readonly figures: ExportFiguresView }) {
  const { cells, reconciliation } = figures;
  const total = reconciliation.total === null ? null : formatFigure(reconciliation.total);
  const shown = formatFigure(reconciliation.linesAsShown);
  const linesDiffer = total !== null && shown !== total;
  return (
    <Card>
      <CardContent className="flex flex-col gap-s-3">
        <h2 className="text-body font-semibold text-ink">{HOW_TITLE(cells.bl)}</h2>
        <p className="text-label font-semibold text-ink-2">{HOW_LEAD}</p>
        <p className="text-body text-ink">{HOW_BODY(cells.bl)}</p>
        <p className="text-body text-ink">
          {ROUNDING_SENTENCE}
          {linesDiffer ? ` ${LINES_AS_SHOWN(shown, total)}` : ''}
        </p>
        {reconciliation.matches ? null : (
          <Notice tone="danger" title={COLUMN_SUM_DIFFERS(cells.bl)}>
            {COLUMN_MISMATCH(formatFigure(reconciliation.columnSum), cells.bl)}
          </Notice>
        )}
      </CardContent>
    </Card>
  );
}

/** The lines under BO2: the difference from the calculated total and the reason, which are shown here and never written into the file (FR-103). */
function ApprovalLines({ approval }: { readonly approval: NonNullable<ExportFiguresView['approval']> }) {
  const when = formatIst(new Date(approval.approvedAt));
  const price = formatRupees(approval.price);
  const { difference } = approval;
  return (
    <>
      <span className="block">{approval.earlier ? boApprovedEarlier(price, when) : boApproved(price, when)}</span>
      {difference === null ? null : (
        <>
          <span className="block">{boDifference(difference.direction, formatRupees(difference.amount))}</span>
          <span className="block">{boSetAgainst(price, formatRupees(approval.calculatedTotal))}</span>
          <span className={cn('block', BREAK_LONG_NAMES)}>{approval.reason === null || approval.reason === '' ? BO_NO_REASON : boReasonGiven(approval.reason)}</span>
          <span className="block">{BO_REASON_NOT_IN_FILE}</span>
        </>
      )}
    </>
  );
}

/** "What the file holds": the checklist of the product's own cells, with BL2, BN2, BO2 and the Total Tool Cost as the file holds them. */
function HoldsCard({ figures }: { readonly figures: ExportFiguresView }) {
  const { cells, totals, approval } = figures;
  return (
    <Card>
      <CardContent className="flex flex-col gap-s-4">
        <h2 className="text-body font-semibold text-ink">{HOLDS_TITLE}</h2>
        <ul className="list-disc space-y-s-1 pl-s-5 text-body text-ink">
          <li>{HOLDS_ONCE(cells.bl, cells.bn, cells.bo)}</li>
          <li>{HOLDS_OWN_TOOL_COST}</li>
          <li>{HOLDS_EMPTY_CELL}</li>
        </ul>
        <dl className="grid gap-s-3 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-s-4">
          <dt className="text-label font-semibold text-ink-2">{cells.bl}</dt>
          <dd className="text-body text-ink tabular-nums">{totals.bl === null ? NO_FIGURE_CELL : formatRupees(totals.bl)}</dd>
          <dt className="text-label font-semibold text-ink-2">{cells.bn}</dt>
          <dd className="text-body text-ink tabular-nums">{totals.bn === null ? NO_FIGURE_CELL : formatFigure(totals.bn)}</dd>
          <dt className="text-label font-semibold text-ink-2">{cells.bo}</dt>
          <dd className="text-body text-ink">
            {approval === null || totals.bo === null ? (
              BO_EMPTY
            ) : (
              <>
                <span className="block tabular-nums">{formatRupees(totals.bo)}</span>
                <ApprovalLines approval={approval} />
              </>
            )}
          </dd>
          <dt className="text-label font-semibold text-ink-2">{TOTAL_TOOL_COST_LABEL}</dt>
          <dd className="text-body text-ink tabular-nums">{toolCostCell(formatRupees(totals.toolCostTotal), rowOf(cells.toolCostTotal))}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/** The two refused states of SCR-10 (UX spec "No file until a calculation is current"): the notice with the refusal's words, and an empty state with the one way on, a link to the estimate. Nothing here is a script. */
function RefusedState({ state, code }: { readonly state: 'none' | 'out-of-date'; readonly code: string }) {
  const never = state === 'none';
  return (
    <div role="status" className="flex flex-col gap-s-4">
      <Notice tone="warn" title={never ? NOT_CALCULATED_LEAD : CLEARED_LEAD}>
        {never ? NOT_CALCULATED_REST : CLEARED_REST}
      </Notice>
      <Card>
        <CardContent className="flex flex-col items-start gap-s-3">
          <h2 className="text-body font-semibold text-ink">{never ? CALCULATE_FIRST_TITLE : RECALCULATE_FIRST_TITLE}</h2>
          <p className="text-body text-ink-2">{never ? CALCULATE_FIRST_BODY : RECALCULATE_FIRST_BODY}</p>
          <Button asChild>
            <Link href={`/estimates/${encodeURIComponent(code)}`} prefetch={false}>
              {never ? GO_TO_ESTIMATE_TO_CALCULATE : GO_TO_ESTIMATE_TO_RECALCULATE}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
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
      ) : summary.state !== 'current' ? (
        <RefusedState state={summary.state} code={code} />
      ) : (
        <div className="flex flex-col gap-s-4">
          <FileCard summary={summary} estimateId={estimateId} />
          <RowsCard summary={summary} />
          {summary.figures === null ? null : <HowCard figures={summary.figures} />}
          {summary.figures === null ? null : <HoldsCard figures={summary.figures} />}
        </div>
      )}
    </>
  );
}
