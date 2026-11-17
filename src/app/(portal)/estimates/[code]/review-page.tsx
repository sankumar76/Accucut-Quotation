import type { ReactElement } from 'react';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { formatIst } from '@/lib/time';
import { getEstimateReviewService } from '@/server/composition';
import type { EstimateViewer } from '@/server/services/estimate-service';

/**
 * SCR-06 for a Lead or an Admin (STORY-06.02): reads the figures of the estimate through the estimate review service, which lets a figure out only while its state is `current`, and draws the
 * review from that one answer. **This file and the folder it draws from are Restricted** (NFR-002): `page.tsx` loads this file with a dynamic `import()` on the Lead's and the Admin's branch
 * alone, so the Engineer's request never loads it and the Engineer's page imports no review code (`tests/unit/estimate-review-architecture.test.ts`). It is a plain function and not an async
 * component, so the page returns the finished element and a test draws it the way the first paint is.
 */

export interface ReviewPageArgs {
  readonly viewer: EstimateViewer;
  readonly estimateId: string;
  readonly header: WorkspaceHeaderView;
  readonly customer: { readonly id: string; readonly name: string } | null;
}

export async function renderReview({ viewer, estimateId, header, customer }: ReviewPageArgs): Promise<ReactElement> {
  const costs = await getEstimateReviewService().getCosts(viewer, estimateId);
  return <EstimateReview header={header} estimateId={estimateId} customer={customer} costs={costs} calculatedAt={costs.calculatedAt === null ? null : formatIst(new Date(costs.calculatedAt))} viewerRole={viewer.role} />;
}
