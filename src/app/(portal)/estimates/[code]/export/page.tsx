import { notFound } from 'next/navigation';

import { EstimateExport, EstimateExportIgnored } from '@/components/features/estimate-export/estimate-export';
import { EXPORT_META_TITLE } from '@/components/features/estimate-export/export-texts';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { getEstimateService, getExportService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import type { EstimateViewer } from '@/server/services/estimate-service';
import type { ExportSummaryView } from '@/server/views/schemas/export';
import { pageMetadata } from '@/lib/page-metadata';

/** No task code and no customer name in the tab title (architecture section 8, FR-089). */
const EXPORT_META_DESCRIPTION = 'Download the estimate as an Excel file in the layout of the quotation sheet.';

export const metadata = pageMetadata(EXPORT_META_TITLE, EXPORT_META_DESCRIPTION);

interface PageProps {
  readonly params: Promise<{ readonly code: string }>;
}

/**
 * SCR-10 "Excel export" at `/estimates/<code>/export` (STORY-07.01 AC-3, AC-6; NFR-002): the file card and the rows the file will hold, for a Lead or an Admin. The manifest row lists no Engineer, so
 * `authorizePage` answers an Engineer with SCR-26 and HTTP 403 **before anything is read** (CR-33), and the service refuses an Engineer again before it reads. A code that is no task is the same SCR-26
 * "not found" with HTTP 404. An **ignored** estimate (409 `ESTIMATE_IGNORED`, DL-304 (2)) is an expected state, not a fault: the page draws the refusal's own sentence and the way back to the estimate, where
 * Restore is (QLT-C-01 of the final review). The page is read-only: it draws one answer (`getExportService().getSummary`), which holds no figure.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (TD-06).
 */
export default async function EstimateExportPage({ params }: PageProps) {
  const user = await authorizePage('/estimates/[code]/export');
  const { code } = await params;
  const viewer = { id: user.id, role: user.role };
  const workspace = await getEstimateService().getWorkspace(viewer, code);
  if (workspace === null) notFound();
  const summary = await summaryOf(viewer, workspace.estimateId);
  if (summary === null) notFound();
  if ('ignored' in summary) return <EstimateExportIgnored message={summary.ignored} code={workspace.code} />;
  return <EstimateExport summary={summary} estimateId={workspace.estimateId} code={workspace.code} />;
}

/**
 * The summary; `null` for an estimate that is not there (the service's 404); or `{ ignored }` with the 409's own sentence for an ignored estimate, which is a state of the estimate and not a fault (QLT-C-01).
 * Any other fault is neither of these: it reaches the error page.
 */
async function summaryOf(viewer: EstimateViewer, estimateId: string): Promise<ExportSummaryView | { readonly ignored: string } | null> {
  try {
    return await getExportService().getSummary(viewer, estimateId);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    if (error instanceof ConflictError && error.code === TRANSITION_REFUSALS.IGNORED.code) return { ignored: error.message };
    throw error;
  }
}
