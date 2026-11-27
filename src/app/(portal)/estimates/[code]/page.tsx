import { notFound } from 'next/navigation';

import { ESTIMATE_META_DESCRIPTION, ESTIMATE_META_TITLE } from '@/components/features/estimate-workspace/estimate-texts';
import { EngineerIgnoredNotice } from '@/components/features/estimate-ignore/engineer-ignored-notice';
import { EstimateWorkspace } from '@/components/features/estimate-workspace/estimate-workspace';
import { TaskCards } from '@/components/features/estimate-workspace/task-cards';
import { assertNever } from '@/lib/assert-never';
import { formatIst, systemClock } from '@/lib/time';
import { getEstimateService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import { pageMetadata } from '@/lib/page-metadata';


/** No task code and no customer name in the tab title (architecture section 8, FR-089). */
export const metadata = pageMetadata(ESTIMATE_META_TITLE, ESTIMATE_META_DESCRIPTION);

interface PageProps {
  readonly params: Promise<{ readonly code: string }>;
  /** `?row=<Sl. No>`: the row whose inputs the Lead's and the Admin's review shows (AQP-488). Only ever compared with the rows the server holds. */
  readonly searchParams: Promise<{ readonly row?: string | ReadonlyArray<string> }>;
}

/**
 * SCR-05 "Estimate workspace" at `/estimates/<code>` (STORY-05.01 AC-1, AC-5, AC-6). The same address opens SCR-05 for an Engineer and, from STORY-06.02, SCR-06 for a
 * Lead or an Admin; the server decides which. The page checks the role first, with its own address, before it reads anything (`authorizePage`, CR-33). A code that
 * is no task, and the task of another Engineer, are the same SCR-26 "not found" with HTTP 404, so the page never says that a code is real. A Lead and an Admin get the
 * review (SCR-06), which holds figures (NFR-002), so it lives in `review-page.tsx` and is loaded by a dynamic `import()` on their branch alone: this file imports no review
 * code, and the Engineer's request loads none. The task is read on the server for the first paint; its customer and subject are shown read-only (CR-01 item 6).
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (TD-06).
 */
/** The row named by `?row=`, as one text, or nothing (a repeated parameter or none). Read on the Lead's and the Admin's branch only. */
async function rowOf(searchParams: PageProps['searchParams']): Promise<string | undefined> {
  const { row } = await searchParams;
  return typeof row === 'string' ? row : undefined;
}

export default async function EstimatePage({ params, searchParams }: PageProps) {
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
    subject: workspace.subject,
    // Names only (NFR-002): the customer's ID stays on the server for the Change customer action's own request.
    customer: workspace.customer === null ? null : { name: workspace.customer.name, shortName: workspace.customer.shortName },
    notes: workspace.notes,
    assignedByName: workspace.assignedByName,
    ignored: workspace.ignored !== null,
  };
  // The Ignored layer as text for the notice: a time as UTC text, a name and the Lead's words (CR-01 item 7D). The same for every role; no ID and no figure (NFR-002).
  const ignored = workspace.ignored === null ? null : { at: workspace.ignored.at.toISOString(), byName: workspace.ignored.byName, remarks: workspace.ignored.remarks };
  // An allow-list by name, closed by `assertNever`: a fourth role added one day gets no branch here until someone decides (it fails to compile) and never the review's figures (NFR-002).
  switch (user.role) {
    case 'ENGINEER': {
      // The Engineer's first wait keeps the placeholder it had: the form's ghost would need a read of the form's definition here, which this page does not make and which #833 must not add (DL-471). Its second wait, while the part's values are read, is the ghost, drawn in the lazy chunk from the client's own read of the definition (`PartFields`); the first wait takes it from the page too once one read gives it (`engineer-ghost.tsx`, the page's combined read).
      // The Engineer's notice of an ignored task is a server component with no script, handed in as an element: drawn at first paint, outside the client form (UX 12944 section 4).
      return (
        <EstimateWorkspace
          header={header}
          estimateId={workspace.estimateId}
          userId={user.id}
          ignored={ignored !== null}
          notice={ignored === null ? undefined : <EngineerIgnoredNotice ignored={ignored} />}
          cards={<TaskCards view={header} />}
        />
      );
    }
    case 'LEAD':
    case 'ADMIN': {
      // SCR-06 is Restricted: it is loaded here, on the Lead's and the Admin's branch only, and never imported by this file (NFR-002).
      const { renderReview } = await import('./review-page');
      return renderReview({
        viewer: { id: user.id, role: user.role },
        estimateId: workspace.estimateId,
        header,
        customer: workspace.customer,
        quoted: workspace.quoted,
        ignored,
        engineerName: workspace.engineerName,
        deadlinePassed: workspace.deadlineAt.getTime() < systemClock.now().getTime(),
        row: await rowOf(searchParams),
      });
    }
    default:
      return assertNever(user.role, 'role');
  }
}
