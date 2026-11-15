import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import { COST_DETAILS_META_TITLE } from '@/components/features/cost-details/cost-details-texts';
import { NotFoundError } from '@/lib/errors';
import { formatIst } from '@/lib/time';
import { getCostDetailsService, getEstimateService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import type { EstimateViewer } from '@/server/services/estimate-service';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

/** No task code and no customer name in the tab title (architecture section 8, FR-089). */
export const metadata: Metadata = { title: COST_DETAILS_META_TITLE };

interface PageProps {
  readonly params: Promise<{ readonly code: string; readonly slNo: string }>;
}

/** A Sl. No as the tree writes it: whole numbers joined by dots (`1`, `2.3`, `1.1.2`). Anything else names no part, so nothing is looked up for it. */
const SL_NO = /^\d{1,9}(?:\.\d{1,9}){0,50}$/;

/**
 * SCR-07 "Cost details" at `/estimates/<code>/costs/<slNo>` (STORY-06.03 AC-1 to AC-9; NFR-002): the six stages of one row for a Lead or an Admin. The manifest row lists no Engineer, so `authorizePage`
 * answers an Engineer with SCR-26 and HTTP 403 **before anything is read** (CR-33), and the service refuses an Engineer again before it reads. A code that is no task, a Sl. No that is not a part of it and a
 * Sl. No of another shape are the same SCR-26 "not found" with HTTP 404. The page is read-only: it draws one answer (`getCostDetailsService`), which holds the stages only while the figures are current.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (TD-06).
 */
export default async function CostDetailsPage({ params }: PageProps) {
  const user = await authorizePage('/estimates/[code]/costs/[slNo]');
  const { code, slNo } = await params;
  if (!SL_NO.test(slNo)) notFound();
  const viewer = { id: user.id, role: user.role };
  const workspace = await getEstimateService().getWorkspace(viewer, code);
  if (workspace === null) notFound();
  const view = await costsOfRow(viewer, workspace.estimateId, slNo);
  if (view === null) notFound();
  return <CostDetails view={view} code={workspace.code} calculatedAt={view.details === null ? null : formatIst(new Date(view.details.calculatedAt))} />;
}

/** The row's answer, or `null` for a part that is not in this estimate (the service's 404). Any other fault is not turned into "not found". */
async function costsOfRow(viewer: EstimateViewer, estimateId: string, slNo: string): Promise<NodeCostsView | null> {
  try {
    return await getCostDetailsService().getNodeCostsBySlNo(viewer, estimateId, slNo);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
