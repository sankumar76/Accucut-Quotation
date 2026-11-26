import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { COMPACT_BOX_PADDING } from '@/components/shared/compact-padding';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { RowName } from '@/components/shared/row-name';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatCount, formatRupees, NO_FIGURE } from '@/lib/money';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import {
  BACK_TO_ESTIMATE,
  BOX_NAME,
  CLEARED_BODY,
  CLEARED_TITLE,
  CONFIGURATION_LINE,
  COST_DETAILS_TITLE,
  COUNT_HINT,
  COUNT_UNIT,
  GO_TO_ESTIMATE_TO_CALCULATE,
  GO_TO_ESTIMATE_TO_RECALCULATE,
  NOT_APPLICABLE_NOTE,
  NOT_CALCULATED_BODY,
  NOT_CALCULATED_TITLE,
  ROW_LABEL,
  RULES_READ_ONLY,
  RULES_ROUNDING,
  RULES_TITLE,
  RULES_WORKING,
  STAGES_HEADING,
} from './cost-details-texts';
import { PhoneStages } from './phone-stages';
import { StagePanel } from './stage-panel';

/**
 * SCR-07 "Cost details" (STORY-06.03; UX spec SCR-07), what a Lead or an Admin sees at `/estimates/<code>/costs/<slNo>`: the row's header, the one box with its own price (BG) and count, and the six
 * stages with each formula next to its value. It is drawn from one `NodeCostsView`, the strict answer of `GET /api/v1/estimates/{id}/nodes/{nodeId}/costs`, so a stage reaches the screen only as
 * `figure-state` allowed it (architecture section 4.8): in the states `none` and `out-of-date` the view holds no stage at all, and this file has nowhere to read one from (FR-100, UX-57).
 *
 * **Restricted** (NFR-002): every file in this folder is for the Lead and the Admin and shows formulas, rates and costs. The folder is loaded by `costs/[slNo]/page.tsx` alone, whose manifest row lists
 * no Engineer, and nothing outside it imports it (`tests/unit/cost-details-architecture.test.ts`). The page is read-only: it has no field, no button that changes anything and no edit control for a
 * formula (AC-6). It is one of the three compact screens: the root sets `is-compact` (`globals.css`, AQP-388). The only script is `PhoneStages`, which closes stages 2 to 6 on a phone and holds no figure.
 */

export interface CostDetailsProps {
  readonly view: NodeCostsView;
  /** The task code of the estimate (the address of the estimate's own page). */
  readonly code: string;
  /** The time of the calculation written in IST (`formatIst`), or `null` while there is no calculation. */
  readonly calculatedAt: string | null;
}

function EstimateLink({ code, label, variant }: { readonly code: string; readonly label: string; readonly variant: 'secondary' | 'ghost' }) {
  return (
    <Button asChild variant={variant}>
      <Link href={`/estimates/${encodeURIComponent(code)}`} prefetch={false}>
        {label}
      </Link>
    </Button>
  );
}

function RowHeader({ view }: { readonly view: NodeCostsView }) {
  const { row } = view;
  return (
    <Card>
      <CardContent className={cn('flex flex-wrap items-baseline gap-x-s-3 gap-y-s-1', COMPACT_BOX_PADDING)}>
        <span className="text-label font-semibold text-ink-2">{ROW_LABEL}</span>
        <span className="text-body font-semibold text-ink tabular-nums">{row.slNo}</span>
        <span className={cn('min-w-0 flex-1 text-body text-ink', BREAK_LONG_NAMES)}>
          <RowName label={row.name} kindLabel={row.kindLabel} />
        </span>
      </CardContent>
    </Card>
  );
}

/** The one box of the row (SCR-06): its own price and the count that is already in it. */
function RowBox({ view }: { readonly view: NodeCostsView }) {
  const { details } = view;
  if (details === null) return null;
  const price = details.stages.flatMap((stage) => stage.lines).find((line) => line.letter === details.letters.unitPrice);
  return (
    <Card className="min-w-0">
      <CardContent className={cn('flex flex-col gap-s-2', COMPACT_BOX_PADDING)}>
        <p className="flex flex-wrap items-center gap-s-2 text-label font-semibold text-ink-2">
          <span>{BOX_NAME}</span>
          <ColumnTag letter={details.letters.unitPrice} kind="output" />
        </p>
        <p className="text-heading font-semibold tracking-tight text-ink [overflow-wrap:anywhere] tabular-nums">{formatRupees(price?.value ?? null)}</p>
        <p className="flex flex-wrap items-center gap-s-2 text-label text-ink-2 tabular-nums">
          <span>{`${details.count === null ? NO_FIGURE : `${formatCount(details.count)} ${COUNT_UNIT}`} ${COUNT_HINT}`}</span>
          <ColumnTag letter={details.letters.count} kind="input" />
        </p>
      </CardContent>
    </Card>
  );
}

function Stages({ view, calculatedAt }: { readonly view: NodeCostsView; readonly calculatedAt: string | null }) {
  const { details } = view;
  if (details === null) return null;
  return (
    <section aria-labelledby="cost-stages-heading" className="flex min-w-0 flex-col gap-s-3">
      <h2 id="cost-stages-heading" className="sr-only">
        {STAGES_HEADING}
      </h2>
      {details.notApplicable ? (
        <Notice tone="info" role="status">
          {NOT_APPLICABLE_NOTE}
        </Notice>
      ) : null}
      {details.stages.map((stage) => (
        <StagePanel key={stage.number} stage={stage} unitPriceLetter={details.letters.unitPrice} />
      ))}
      <section aria-label={RULES_TITLE} className="flex flex-col gap-s-2 text-label text-ink-2">
        <p>{RULES_WORKING}</p>
        <p>{RULES_ROUNDING}</p>
        <p>{RULES_READ_ONLY}</p>
        {calculatedAt === null ? null : <p>{CONFIGURATION_LINE(calculatedAt, details.configurationNumber)}</p>}
      </section>
    </section>
  );
}

export function CostDetails({ view, code, calculatedAt }: CostDetailsProps) {
  const { state } = view;
  return (
    <div className="is-compact contents">
      <PageHeader title={COST_DETAILS_TITLE} actions={<EstimateLink code={code} label={BACK_TO_ESTIMATE} variant="secondary" />} />
      <RowHeader view={view} />
      {state === 'none' ? (
        <Notice tone="info" role="status" title={NOT_CALCULATED_TITLE}>
          <span className="flex flex-col items-start gap-s-2">
            {NOT_CALCULATED_BODY}
            <EstimateLink code={code} label={GO_TO_ESTIMATE_TO_CALCULATE} variant="ghost" />
          </span>
        </Notice>
      ) : null}
      {state === 'out-of-date' ? (
        <Notice tone="info" role="status" title={CLEARED_TITLE}>
          <span className="flex flex-col items-start gap-s-2">
            {CLEARED_BODY}
            <EstimateLink code={code} label={GO_TO_ESTIMATE_TO_RECALCULATE} variant="ghost" />
          </span>
        </Notice>
      ) : null}
      {state === 'current' && view.details !== null ? (
        <div className="flex flex-col gap-s-3 xl:grid xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:items-start">
          <RowBox view={view} />
          <Stages view={view} calculatedAt={calculatedAt} />
          <PhoneStages />
        </div>
      ) : null}
    </div>
  );
}
