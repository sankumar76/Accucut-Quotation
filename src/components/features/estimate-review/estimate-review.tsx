import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { CostsView } from '@/server/views/schemas/costs';

import { WorkspaceHeader, type WorkspaceHeaderView } from '../estimate-workspace/workspace-header';

import { BuildTable } from './build-table';
import { FigureTiles } from './figure-tiles';
import { ReviewActions } from './review-actions';
import { ReviewTree } from './review-tree';
import { CLEARED_NOTICE_BODY, CLEARED_NOTICE_TITLE, NOT_CALCULATED_NOTICE, REVIEW_CUSTOMER_LABEL, REVIEW_NO_CUSTOMER } from './review-texts';

/**
 * SCR-06 "Estimate review" (STORY-06.02; UX spec SCR-06), what a Lead or an Admin sees at `/estimates/<code>`: the task's header and customer, the notice of the state, the BL, BN and BO tiles, the parts
 * tree with each row's own figure, "How the total is built" and the action bar. It is drawn from one `CostsView`, the strict answer of `GET /api/v1/estimates/{id}/costs`, so a figure reaches the
 * screen only as `figure-state` allowed it (architecture section 4.8): in the states `none` and `out-of-date` the view holds no figure at all, and this file has nowhere to read one from.
 *
 * **Restricted** (NFR-002): every file in this folder is for the Lead and the Admin. None is a client component, so none is ever sent to the browser as code, and none is imported by the Engineer's
 * page, which loads this folder with a dynamic `import()` only on the Lead's and the Admin's branch (`tests/unit/estimate-review-architecture.test.ts`).
 */

export interface EstimateReviewProps {
  readonly header: WorkspaceHeaderView;
  readonly customer: { readonly id: string; readonly name: string } | null;
  readonly costs: CostsView;
  /** The time of the calculation written in IST (`formatIst`), or `null` while there is no calculation. */
  readonly calculatedAt: string | null;
}

export function EstimateReview({ header, customer, costs, calculatedAt }: EstimateReviewProps) {
  const { state, letters, nodes, totals } = costs;
  return (
    <>
      <WorkspaceHeader view={header} />
      <Card>
        <CardContent>
          <p className={cn('text-body', BREAK_LONG_NAMES)}>
            <strong>{`${REVIEW_CUSTOMER_LABEL}: `}</strong>
            {customer === null ? REVIEW_NO_CUSTOMER : customer.name}
          </p>
        </CardContent>
      </Card>
      {state === 'none' ? (
        <Notice tone="info" role="status">
          {NOT_CALCULATED_NOTICE}
        </Notice>
      ) : null}
      {state === 'out-of-date' ? (
        <Notice tone="info" role="status" title={CLEARED_NOTICE_TITLE}>
          {CLEARED_NOTICE_BODY}
        </Notice>
      ) : null}
      <FigureTiles state={state} letters={letters} totals={totals} />
      <ReviewTree code={header.code} state={state} letters={letters} nodes={nodes} />
      {state === 'current' ? <BuildTable letters={letters} nodes={nodes} totalPrice={totals === null ? null : totals.totalPrice} /> : null}
      <ReviewActions
        state={state}
        calculated={calculatedAt === null || costs.configurationNumber === null ? null : { at: calculatedAt, configurationNumber: costs.configurationNumber }}
      />
    </>
  );
}
