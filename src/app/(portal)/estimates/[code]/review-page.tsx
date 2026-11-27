import type { ReactElement } from 'react';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { formatIst } from '@/lib/time';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { selectedRow } from '@/components/features/estimate-review/selected-row';
import { getDownloadMarkerService, getEstimateReviewService, getEstimateService, getMastersService } from '@/server/composition';
import type { EstimateViewer } from '@/server/services/estimate-service';

import { readFormBodies, readPartBody, seedOf } from './part-form-seed';

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
  /** The Ignored layer over the status, or `null` (CR-01 item 7D): who, when (UTC text) and the remarks. An ignored estimate is read-only: the page draws its notice and no action bar. */
  readonly ignored: { readonly at: string; readonly byName: string; readonly remarks: string } | null;
  /** The name of the Engineer the task is assigned to: the Restore dialog says whose Open queue the task returns to. */
  readonly engineerName: string;
  /** The deadline has passed at the moment the page was drawn: the Restore dialog then says the task will also show as Overdue (unless it is Approved). */
  readonly deadlinePassed: boolean;
  /** The Sl. No of the row whose inputs are shown, from `?row=` (AQP-488): the review resolves it against the rows it holds; one that is not there opens the first row. */
  readonly row?: string | undefined;
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

export async function renderReview({ viewer, estimateId, header, customer, quoted, ignored, engineerName, deadlinePassed, row }: ReviewPageArgs): Promise<ReactElement> {
  // The form's definition and the two option lists do not depend on the row, so they are read beside the figures; the part's values are read for the row the page shows (`part-form-seed.ts`, DEF-141).
  const services = { estimates: getEstimateService(), masters: getMastersService() };
  const [costs, download, bodies] = await Promise.all([getEstimateReviewService().getCosts(viewer, estimateId), markerOf(viewer, estimateId), readFormBodies(services, viewer, estimateId)]);
  const selected = selectedRow(costs.nodes, row);
  const seed = selected === null ? undefined : seedOf(estimateId, selected.id, bodies, bodies === null ? null : await readPartBody(services, viewer, estimateId, selected.id));
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
      engineerName={engineerName}
      deadlinePassed={deadlinePassed}
      row={row}
      seed={seed}
    />
  );
}
