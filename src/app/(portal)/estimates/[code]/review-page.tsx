import type { ReactElement } from 'react';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { formatIst } from '@/lib/time';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getDownloadMarkerService, getEstimateReviewService } from '@/server/composition';
import type { EstimateViewer } from '@/server/services/estimate-service';

/**
 * SCR-06 for a Lead or an Admin (STORY-06.02): reads the figures of the estimate through the estimate review service, which lets a figure out only while its state is `current`, and draws the
 * review from that one answer. **This file and the folder it draws from are Restricted** (NFR-002): `page.tsx` loads this file with a dynamic `import()` on the Lead's and the Admin's branch
 * alone, so the Engineer's request never loads it and the Engineer's page imports no review code (`tests/unit/estimate-review-architecture.test.ts`). It is a plain function and not an async
 * component, so the page returns the finished element and a test draws it the way the first paint is.
 *
 * **The download marker (STORY-CR01.7E AC-5)** is read here for the header, through the Restricted marker service, beside the figures: a Lead and an Admin see "Not downloaded", "Downloaded N×" or amber "Changed since download".
 *
 * **The customer's name is the current one, also on an approved estimate** (STORY-06.09 AC-3, NFR-026): `customer` is read by `page.tsx` from `customers` through the estimate's own `customer_id`, so a customer
 * the Admin renamed after the approval shows under its new name. The name the calculation used is kept in `calculations.master_snapshot` and is shown nowhere; every figure and word that was approved
 * is read from the calculation record alone (`estimate-review-service.ts`), and `tests/acceptance/aqp-approved-immutable.test.ts` pins both facts.
 */

export interface ReviewPageArgs {
  readonly viewer: EstimateViewer;
  readonly estimateId: string;
  readonly header: WorkspaceHeaderView;
  readonly customer: { readonly id: string; readonly name: string; readonly shortName: string } | null;
  /** Who marked the estimate as quoted and when, for the Quoted notice (CR-01 item 7C): the Lead's and the Admin's only, so `page.tsx` reads it from the workspace on their branch alone. */
  readonly quoted: { readonly at: Date; readonly byName: string } | null;
  /** Whether the Ignored layer is set over the status: an ignored estimate is not offered Mark as quoted. */
  readonly ignored: boolean;
}

/**
 * The marker for the header, or `'unavailable'` when it could not be read (QLT-03): a marker is a convenience beside the figures, so a fault in its read must not take SCR-06 down. The kind of the fault is
 * logged, never its cause or the estimate (no personal data); the header then says "Download status unavailable." and never "Not downloaded".
 */
async function markerOf(viewer: EstimateViewer, estimateId: string): Promise<DownloadChipData | 'unavailable'> {
  try {
    return await getDownloadMarkerService().getMarker(viewer, estimateId);
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined }, 'The download marker could not be read.');
    return 'unavailable';
  }
}

export async function renderReview({ viewer, estimateId, header, customer, quoted, ignored }: ReviewPageArgs): Promise<ReactElement> {
  const [costs, download] = await Promise.all([getEstimateReviewService().getCosts(viewer, estimateId), markerOf(viewer, estimateId)]);
  return (
    <EstimateReview
      header={header}
      estimateId={estimateId}
      customer={customer}
      costs={costs}
      calculatedAt={costs.calculatedAt === null ? null : formatIst(new Date(costs.calculatedAt))}
      viewerRole={viewer.role}
      download={download}
      quoted={quoted === null ? null : { at: quoted.at.toISOString(), byName: quoted.byName }}
      ignored={ignored}
    />
  );
}
