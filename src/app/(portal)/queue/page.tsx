import { QueueScreen } from '@/components/features/queues/queue-screen';
import { QUEUE_META_DESCRIPTION } from '@/components/features/queues/queue-texts';
import type { RoleName } from '@/lib/auth/roles';
import { readDownloadMarkers, type DownloadMarkers } from '@/lib/tasks/download-markers-client';
import { readQueuePage } from '@/lib/tasks/queue-client';
import { readQueueAddress, type QueueFilters } from '@/lib/tasks/queue-filters';
import { getDownloadMarkerService, getMastersService, getTaskService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import type { QueueQuery } from '@/server/services/task-service';
import { queueAnswer } from '@/server/views/task-queue';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Task queue', QUEUE_META_DESCRIPTION);

interface QueuePageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** The filters of the address as the task service reads them: a name with no value is left out, and `anyone` is the whole queue. */
function queryFilters(filters: QueueFilters): Omit<QueueQuery, 'tab'> {
  return {
    ...(filters.assignedBy === '' ? {} : { assignedBy: filters.assignedBy }),
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(filters.engineer === '' ? {} : { engineer: filters.engineer }),
    ...(filters.customer === '' ? {} : { customer: filters.customer }),
    ...(filters.from === '' ? {} : { from: filters.from }),
    ...(filters.to === '' ? {} : { to: filters.to }),
  };
}

/** The markers of these tasks as the browser reads them; a fault is not turned into "Not downloaded": the rows say the status is unavailable. */
async function closedMarkers(user: { readonly id: string; readonly role: RoleName }, taskIds: ReadonlyArray<string>): Promise<DownloadMarkers | 'unavailable'> {
  try {
    const answer = await getDownloadMarkerService().getMarkersOfTasks({ id: user.id, role: user.role }, taskIds);
    return readDownloadMarkers(answer) ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * SCR-03 "Task queue" and "My tasks" (STORY-04.02), every role's home after sign-in (STORY-01.01 AC-1): "My tasks" for an Engineer, "Task queue" for a Lead and an
 * Admin. The page checks the person and their role itself (`authorizePage`, STD-09) and does not rely on the portal layout. The first page of the tab in the address and the counts are read on the
 * server for the first paint, for the person asking: an Engineer's own tasks, or every task for a Lead and an Admin (`TaskService.listQueue`, decided from the session).
 * The address holds the tab (`?tab=`, Open when there is none) and the filters of STORY-04.06 (`q`, `engineer`, `customer`, `from`, `to`, `assignedBy`): `readQueueAddress` reads
 * them for this person, so a Lead whose address does not say `assignedBy` opens on the tasks they assigned (FR-035), and a stale or hand-typed value opens the default view and
 * never an error (STORY-04.03, STORY-04.06 AC-4). A Lead and an Admin choose Engineers and customers from the same lists the options routes serve. The screen then asks `/api/v1/tasks`
 * when the tab or a filter changes.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users and Audit pages: it would turn the 403 of a refused role into a
 * streamed 200 (QLT-72, `tests/security/loading-boundaries.test.ts`).
 */
export default async function QueuePage({ searchParams }: QueuePageProps) {
  const user = await authorizePage('/queue');
  const query = await searchParams;
  const manager = user.role !== 'ENGINEER';
  const [context, customerOptions] = manager ? await Promise.all([getTaskService().getAssignContext(), getMastersService().listCustomerOptions()]) : [null, []];
  const engineers = context?.engineers ?? [];
  const { tab, filters } = readQueueAddress(query, {
    role: user.role,
    engineerIds: new Set(engineers.map((engineer) => engineer.id)),
    customerIds: new Set(customerOptions.map((customer) => customer.id)),
  });
  const queue = await getTaskService().listQueue(user, { tab, ...queryFilters(filters) });
  // The same reading the browser gives an answer of the route: one shape of a page, and a body that is not one is a failure the error page shows.
  const initialPage = readQueuePage(queueAnswer(queue));
  if (initialPage === null) throw new Error('The task queue was not in the shape of its own schema.');
  // The download markers of a page of the Closed tab, for a Lead and an Admin only (STORY-CR01.7E AC-5): the Engineer's queue never asks the Restricted marker service.
  const initialMarkers = manager && tab === 'closed' && queue.tasks.length > 0 ? await closedMarkers(user, queue.tasks.map((task) => task.id)) : undefined;
  // The key makes a move to another address of the queue (the bell, a bookmark) start from its own first page, not from the old screen's state.
  const key = `${tab}:${filters.assignedBy}:${filters.q}:${filters.engineer}:${filters.customer}:${filters.from}:${filters.to}`;
  return <QueueScreen key={key} role={user.role} initialPage={initialPage} initialFilters={filters} engineers={engineers} customers={customerOptions} {...(initialMarkers === undefined ? {} : { initialMarkers })} />;
}
