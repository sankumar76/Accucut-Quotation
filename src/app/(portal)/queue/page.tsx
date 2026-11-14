import type { Metadata } from 'next';

import { QueueScreen } from '@/components/features/queues/queue-screen';
import { QUEUE_META_DESCRIPTION } from '@/components/features/queues/queue-texts';
import { DEFAULT_QUEUE_TAB, isQueueTab } from '@/lib/tasks/queue';
import { readQueuePage } from '@/lib/tasks/queue-client';
import { getTaskService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import { queueAnswer } from '@/server/views/task-queue';

export const metadata: Metadata = { title: 'Task queue', description: QUEUE_META_DESCRIPTION };

interface QueuePageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/**
 * SCR-03 "Task queue" and "My tasks" (STORY-04.02), every role's home after sign-in (STORY-01.01 AC-1): "My tasks" for an Engineer, "Task queue" for a Lead and an
 * Admin. The page checks the person and their role itself (`authorizePage`, STD-09) and does not rely on the portal layout. The first page of the tab in the address (`?tab=`, Open when there
 * is none; `?assignedBy=me` cuts it to the tasks the person assigned, STORY-04.03) and the counts are read on the server for the first paint, for the person asking: an Engineer's own tasks, or every task for a Lead and an Admin (`TaskService.listQueue`,
 * decided from the session). The screen then asks `/api/v1/tasks` when the tab changes.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users and Audit pages: it would turn the 403 of a refused role into a
 * streamed 200 (QLT-72, `tests/security/loading-boundaries.test.ts`).
 */
export default async function QueuePage({ searchParams }: QueuePageProps) {
  const user = await authorizePage('/queue');
  const query = await searchParams;
  const requestedTab = query['tab'];
  // The bell's address (STORY-04.03 AC-3): `?tab=overdue`, and `assignedBy=me` for a Lead. Anything else is the default view, never an error: a stale or hand-typed
  // address still opens the queue.
  const tab = typeof requestedTab === 'string' && isQueueTab(requestedTab) ? requestedTab : DEFAULT_QUEUE_TAB;
  const assignedByMe = query['assignedBy'] === 'me';
  const queue = await getTaskService().listQueue(user, { tab, ...(assignedByMe ? { assignedBy: 'me' as const } : {}) });
  // The same reading the browser gives an answer of the route: one shape of a page, and a body that is not one is a failure the error page shows.
  const initialPage = readQueuePage(queueAnswer(queue));
  if (initialPage === null) throw new Error('The task queue was not in the shape of its own schema.');
  // The key makes a move between the whole queue and the person's own cut (the "Show all tasks" link) start from the new first page, not from the old screen's state.
  return <QueueScreen key={`${tab}:${String(assignedByMe)}`} role={user.role} initialPage={initialPage} assignedByMe={assignedByMe} />;
}
