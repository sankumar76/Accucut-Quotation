import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ESTIMATE_META_DESCRIPTION, ESTIMATE_META_TITLE } from '@/components/features/estimate-workspace/estimate-texts';
import { EstimateWorkspace } from '@/components/features/estimate-workspace/estimate-workspace';
import { ReviewHeader } from '@/components/features/estimate-workspace/review-header';
import { formatIst } from '@/lib/time';
import { getEstimateService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

/** No task code and no customer name in the tab title (architecture section 8, FR-089). */
export const metadata: Metadata = { title: ESTIMATE_META_TITLE, description: ESTIMATE_META_DESCRIPTION };

interface PageProps {
  readonly params: Promise<{ readonly code: string }>;
}

/**
 * SCR-05 "Estimate workspace" at `/estimates/<code>` (STORY-05.01 AC-1, AC-5, AC-6). The same address opens SCR-05 for an Engineer and, from STORY-06.02, SCR-06 for a
 * Lead or an Admin; the server decides which. The page checks the role first, with its own address, before it reads anything (`authorizePage`, CR-33). A code that
 * is no task, and the task of another Engineer, are the same SCR-26 "not found" with HTTP 404, so the page never says that a code is real. Until SCR-06 exists a Lead
 * and an Admin get a short header: the task, its status and its customer, with no form. The task is read on the server for the first paint; the Engineer's screen
 * then reads the customers and sends the choice through the API.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (TD-06).
 */
export default async function EstimatePage({ params }: PageProps) {
  const user = await authorizePage('/estimates/[code]');
  const { code } = await params;
  const workspace = await getEstimateService().getWorkspace({ id: user.id, role: user.role }, code);
  if (workspace === null) notFound();
  const header = {
    code: workspace.code,
    status: workspace.status,
    deadlineLabel: formatIst(workspace.deadlineAt),
    folderPath: workspace.folderPath,
    folderUrl: workspace.folderUrl,
    title: workspace.title,
    notes: workspace.notes,
    assignedByName: workspace.assignedByName,
  };
  if (user.role === 'ENGINEER') return <EstimateWorkspace header={header} estimateId={workspace.estimateId} customer={workspace.customer} />;
  return <ReviewHeader header={header} customer={workspace.customer} />;
}
