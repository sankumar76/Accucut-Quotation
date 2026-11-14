import type { Metadata } from 'next';

import { AssignScreen } from '@/components/features/tasks/assign-screen';
import { ASSIGN_META_DESCRIPTION } from '@/components/features/tasks/assign-texts';
import { getTaskService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Assign task', description: ASSIGN_META_DESCRIPTION };

/**
 * SCR-04 "Assign task" (STORY-04.01 AC-1, AC-5, AC-7): a Lead or an Admin assigns a task. The page checks the role first, with its own address, before it reads
 * the Engineers: an Engineer gets SCR-26 "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page.
 * The Engineers are read on the server for the first paint; the form then sends the task to `POST /api/v1/tasks`.
 *
 * There is deliberately no `loading.tsx` beside this page: it would stream the response with status 200 before `forbidden()` runs (TD-06).
 */
export default async function AssignPage() {
  await authorizePage('/assign');
  const { engineers } = await getTaskService().getAssignContext();
  return <AssignScreen engineers={engineers} />;
}
