'use client';

import { Clock, ListChecks, RotateCcw, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queueTitleFor, type RoleName } from '@/lib/auth/roles';
import { overdueSummary } from '@/lib/tasks/overdue';
import { isQueueTab, QUEUE_TABS, QUEUE_TAB_LABELS, type QueueTab } from '@/lib/tasks/queue';
import { fetchQueuePage, type QueuePageData } from '@/lib/tasks/queue-client';

import { QueueList } from './queue-list';
import {
  ASSIGN_TASK_LABEL,
  ASSIGNED_BY_ME_NOTE,
  descriptionFor,
  emptyTextFor,
  ERROR_RETRY,
  ERROR_TITLE,
  LOADING_LABEL,
  SHOW_MORE,
  SHOW_MORE_FAILED_BODY,
  SHOW_ALL_TASKS,
  SHOW_MORE_FAILED_TITLE,
  SORT_NOTE,
  TABS_LABEL,
} from './queue-texts';

/**
 * SCR-03 "Task queue" (Lead, Admin) and "My tasks" (Engineer) (STORY-04.02 AC-1, AC-3, AC-4): the Open, Closed and Overdue tabs with their counts, the sort note, and
 * the tasks of the tab. It holds the first page of the Open tab that the server rendered and asks `/api/v1/tasks` when the person changes tab or asks for more. It
 * decides nothing: which tasks a person sees, their order and the counts are the server's.
 *
 * States: the tasks; empty (the words of the role and the tab, with "Assign task" for a Lead and an Admin on the Open tab); loading (the skeleton, shown after 300 ms,
 * the card `aria-busy`); error ("We could not load the tasks", "Try again"). A newer request cancels the one before it, so a slow answer for an old tab never
 * replaces the answer for the tab that is open. The tabs are Radix's: `tablist`, `tab` and `tabpanel`, and the arrow keys move between them.
 *
 * There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, QLT-72): the first paint already holds the
 * first page, and the loading state is a tab being read.
 */

export interface QueueScreenProps {
  readonly role: RoleName;
  readonly initialPage: QueuePageData;
  /**
   * The page was opened with `assignedBy=me` (a Lead's bell, STORY-04.03 AC-3): every tab, and every later request, covers only the tasks the person assigned, so the
   * Overdue tab holds the set the bell counted. The screen says so and offers the whole queue.
   */
  readonly assignedByMe?: boolean;
}

type Status = 'ready' | 'loading' | 'error';

const SKELETON_ROWS = 5;

function AssignButton() {
  return (
    <Button asChild>
      <Link href="/assign">
        <Icon icon={UserPlus} />
        {ASSIGN_TASK_LABEL}
      </Link>
    </Button>
  );
}

export function QueueScreen({ role, initialPage, assignedByMe = false }: QueueScreenProps) {
  const [activeTab, setActiveTab] = useState<QueueTab>(initialPage.tab);
  const [page, setPage] = useState<QueuePageData>(initialPage);
  const [status, setStatus] = useState<Status>('ready');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const manager = role !== 'ENGINEER';

  /** Starts a request and returns its controller; any request before it is cancelled. */
  function startRequest(): AbortController {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller;
  }

  async function load(next: QueueTab): Promise<void> {
    const controller = startRequest();
    setActiveTab(next);
    setStatus('loading');
    setMoreFailed(false);
    setLoadingMore(false);
    const outcome = await fetchQueuePage(next, undefined, fetch, controller.signal, assignedByMe);
    // A newer request took over while this one was on its way: its answer is the one to show.
    if (inFlight.current !== controller) return;
    if (outcome.status === 'ok') {
      setPage(outcome.value);
      setStatus('ready');
    } else {
      setStatus('error');
    }
  }

  async function showMore(): Promise<void> {
    if (loadingMore || status !== 'ready' || page.nextCursor === null) return;
    const controller = startRequest();
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await fetchQueuePage(activeTab, page.nextCursor, fetch, controller.signal, assignedByMe);
    if (inFlight.current !== controller) return;
    setLoadingMore(false);
    if (outcome.status === 'ok') setPage({ ...outcome.value, tasks: [...page.tasks, ...outcome.value.tasks] });
    else setMoreFailed(true);
  }

  function retry(): void {
    void load(activeTab);
  }

  function changeTab(value: string): void {
    if (isQueueTab(value) && value !== activeTab) void load(value);
  }

  /** What the tab's panel shows: the error, the skeleton, the empty state, or the tasks with "Show more tasks" when more follow. */
  function results(): ReactNode {
    if (status === 'error') {
      return (
        <ErrorState
          title={ERROR_TITLE}
          focusOnMount
          action={
            <Button onClick={retry}>
              <Icon icon={RotateCcw} />
              {ERROR_RETRY}
            </Button>
          }
        />
      );
    }
    if (status === 'loading') return <SkeletonBlock rows={SKELETON_ROWS} label={LOADING_LABEL} />;
    if (page.tasks.length === 0) {
      const words = emptyTextFor(role, activeTab);
      return (
        <div role="status">
          <EmptyState
            icon={<Icon icon={ListChecks} size="state" />}
            title={words.title}
            description={words.description}
            action={manager && activeTab === 'open' ? <AssignButton /> : undefined}
          />
        </div>
      );
    }
    return (
      <>
        {activeTab === 'overdue' ? (
          <div className="p-s-4 pb-0">
            <Notice tone="warn">{overdueSummary(page.counts.overdue)}</Notice>
          </div>
        ) : null}
        {moreFailed ? (
          <div className="p-s-4 pb-0">
            <Notice tone="danger" title={SHOW_MORE_FAILED_TITLE}>
              {SHOW_MORE_FAILED_BODY}
            </Notice>
          </div>
        ) : null}
        <QueueList role={role} tasks={page.tasks} asOf={page.asOf} />
        {page.nextCursor === null ? null : (
          <div className="flex justify-center p-s-4">
            <Button variant="secondary" {...(loadingMore ? { 'aria-busy': true } : {})} onClick={() => void showMore()}>
              {SHOW_MORE}
            </Button>
          </div>
        )}
      </>
    );
  }

  const panel = results();
  return (
    <>
      <PageHeader title={queueTitleFor(role)} description={descriptionFor(role)} actions={manager ? <AssignButton /> : undefined} />
      {assignedByMe ? (
        <p className="text-body text-ink-2">
          {ASSIGNED_BY_ME_NOTE}{' '}
          <Link href="/queue" className="font-semibold text-primary-ink underline-offset-2 hover:underline">
            {SHOW_ALL_TASKS}
          </Link>
        </p>
      ) : null}
      <Card aria-busy={status === 'loading' || undefined}>
        <CardContent className="flex flex-col gap-s-4">
          <Tabs value={activeTab} onValueChange={changeTab}>
            <TabsList aria-label={TABS_LABEL}>
              {QUEUE_TABS.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {value === 'overdue' ? <Icon icon={Clock} size="hint" /> : null}
                  {QUEUE_TAB_LABELS[value]}
                  <Badge tone="neutral">{page.counts[value]}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="pt-s-3 text-label text-ink-2">{SORT_NOTE}</p>
            {QUEUE_TABS.map((value) => (
              <TabsContent key={value} value={value}>
                {panel}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
