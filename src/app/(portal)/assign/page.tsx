import { notFound } from 'next/navigation';

import { AssignScreen } from '@/components/features/tasks/assign-screen';
import { ASSIGN_META_DESCRIPTION } from '@/components/features/tasks/assign-texts';
import { ReassignScreen } from '@/components/features/tasks/reassign-screen';
import { getTaskService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Assign task', ASSIGN_META_DESCRIPTION);

interface AssignPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/**
 * SCR-04 "Assign task" (STORY-04.01 AC-1, AC-5, AC-7) and its edit mode, "Reassign or change deadline" (STORY-04.07 AC-1, AC-2): a Lead or an Admin assigns a task, or, with
 * `?task=<id>`, changes the Engineer or the deadline of that open task. The page checks the role first, with its own address, before it reads the Engineers or the task: an Engineer gets
 * SCR-26 "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. A `task` that is no task is SCR-26 "not found" with
 * HTTP 404; the page never reads a task for a role that may not change it. The Engineers (and the task) are read on the server for the first paint; the form then sends to
 * `POST /api/v1/tasks` or `PATCH /api/v1/tasks/{id}`.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` and `notFound()` run (TD-06).
 */
export default async function AssignPage({ searchParams }: AssignPageProps) {
  const user = await authorizePage('/assign');
  const { task: requested } = await searchParams;
  const service = getTaskService();
  const { engineers, customers, alertsEnabled } = await service.getAssignContext();
  if (requested === undefined) return <AssignScreen engineers={engineers} customers={customers} alertsEnabled={alertsEnabled} />;
  // More than one `task` is not an address of a task.
  const task = typeof requested === 'string' ? await service.getTask({ id: user.id, role: user.role }, requested) : null;
  if (task === null) notFound();
  return (
    <ReassignScreen
      engineers={engineers}
      task={{
        id: task.id,
        code: task.code,
        engineer: task.engineer,
        deadlineAt: task.deadlineAt.toISOString(),
        folderPath: task.folderPath,
        folderUrl: task.folderUrl,
        title: task.title,
        notes: task.notes,
        status: task.status,
        ignored: task.ignored !== null,
      }}
    />
  );
}
