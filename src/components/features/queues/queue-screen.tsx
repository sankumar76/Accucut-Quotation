'use client';

import { Clock, ListChecks, RotateCcw, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
import { fetchDownloadMarkers, type DownloadMarkers } from '@/lib/tasks/download-markers-client';
import { isQueueTab, QUEUE_TABS, QUEUE_TAB_LABELS, type QueueTab } from '@/lib/tasks/queue';
import { fetchQueuePage, type QueuePageData } from '@/lib/tasks/queue-client';
import { dateRangeProblem, hasListFilter, queueAddressQuery, withoutListFilters, type QueueFilters } from '@/lib/tasks/queue-filters';

import { QueueFiltersBar, type FilterOption } from './queue-filters';
import { QueueList } from './queue-list';
import {
  ASSIGN_TASK_LABEL,
  CLEAR_FILTERS,
  descriptionFor,
  emptyTextFor,
  ERROR_RETRY,
  ERROR_TITLE,
  ignoredIntroFor,
  LOADING_LABEL,
  NO_MATCH_ENGINEER,
  NO_MATCH_MANAGER,
  SHOW_MORE,
  SHOW_MORE_FAILED_BODY,
  SHOW_MORE_FAILED_TITLE,
  SORT_NOTE,
  SORT_NOTE_IGNORED,
  TABS_LABEL,
  tasksFoundText,
} from './queue-texts';

/**
 * SCR-03 "Task queue" (Lead, Admin) and "My tasks" (Engineer) (STORY-04.02 AC-1, AC-3, AC-4; STORY-04.06): the filter row, the Open, Closed and Overdue tabs with their
 * counts, the sort note, and the tasks of the tab. It holds the first page the server rendered for the address and asks `/api/v1/tasks` when the person changes tab, a filter
 * or asks for more. It decides nothing: which tasks a person sees, their order and the counts are the server's, and every request carries the filters, so the counts of the
 * three tabs follow them. The filters are written back into the browser's address after every change, so a filtered queue can be copied and bookmarked (AC-4).
 *
 * **Four tabs** (CR-01 item 7D, AQP-401; the order is FR-034's, DEF-103): Open, Overdue, Closed and Ignored, the last for the tasks a Lead or an Admin set aside. Below 480 px they are a 2 by 2 grid (each tab 44 px high, none out of view and no sideways
 * scroll: four labels with counts do not fit one row at 360 px, and a strip that scrolls would hide the one tab this change adds, WCAG 1.4.10, 2.5.8); from 480 px they are one row. The Ignored tab's intro line says whose
 * tasks these are. No new component and no new client code: one more tab value, its labels and texts, and a remarks line in the rows.
 *
 * States: the tasks; empty (the words of the role and the tab, with "Assign task" for a Lead and an Admin on the Open tab); no match (a filter is set and nothing fits: "Clear filters"
 * for a Lead and an Admin); loading (the skeleton, shown after 300 ms, the card `aria-busy`); error ("We could not load the tasks", "Try again"). A newer request cancels the one
 * before it, so a slow answer for old filters never replaces the answer for the filters that are set. The search asks after a 300 ms pause or on Enter. The tabs are Radix's:
 * `tablist`, `tab` and `tabpanel`, and the arrow keys move between them. After a filter changes, the number of tasks found is read out politely.
 *
 * There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, QLT-72): the first paint already holds the
 * first page, and the loading state is a tab or a filter being read.
 */

export interface QueueScreenProps {
  readonly role: RoleName;
  readonly initialPage: QueuePageData;
  /**
   * The filters the address holds, already read for this person (`readQueueAddress`): a Lead who did not say `assignedBy` has `me` here, which shows the chip "Assigned by me"
   * (STORY-04.06 AC-1). Every request of the screen carries them.
   */
  readonly initialFilters: QueueFilters;
  /** The active Engineers and the customers the filter row offers; empty for an Engineer, who has the search only. */
  readonly engineers?: ReadonlyArray<FilterOption>;
  readonly customers?: ReadonlyArray<FilterOption>;
  /**
   * The download markers of the first page when it is the Closed tab, read on the server for a Lead and an Admin (STORY-CR01.7E AC-5); `undefined` for an Engineer and for every other tab. The screen asks
   * `/api/v1/download-markers` for the pages it loads itself, and never for an Engineer.
   */
  readonly initialMarkers?: DownloadMarkers | 'unavailable';
}

type Status = 'ready' | 'loading' | 'error';
/** Where focus goes once the screen has drawn what a press removed or added. */
type FocusTarget = 'search' | 'restore' | 'remove';

const SKELETON_ROWS = 5;
/** How long the search waits after the last key before it asks (STORY-04.06 AC-7). */
const SEARCH_PAUSE_MS = 300;

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

/** The markers of the pages shown so far with those of the page just loaded; any that could not be read makes the whole list say so, rather than a mixture. */
function mergeMarkers(have: DownloadMarkers | 'unavailable' | undefined, more: DownloadMarkers | 'unavailable'): DownloadMarkers | 'unavailable' {
  return more === 'unavailable' || have === 'unavailable' || have === undefined ? more : { ...have, ...more };
}

/** Writes the tab and the filters into the browser's address without a new page or a new request (STORY-04.06 AC-4). */
function writeAddress(tab: QueueTab, filters: QueueFilters): void {
  const query = queueAddressQuery(tab, filters);
  window.history.replaceState(null, '', query === '' ? window.location.pathname : `${window.location.pathname}?${query}`);
}

export function QueueScreen({ role, initialPage, initialFilters, engineers = [], customers = [], initialMarkers }: QueueScreenProps) {
  const [activeTab, setActiveTab] = useState<QueueTab>(initialPage.tab);
  const [page, setPage] = useState<QueuePageData>(initialPage);
  const [markers, setMarkers] = useState<DownloadMarkers | 'unavailable' | undefined>(initialMarkers);
  const [filters, setFilters] = useState<QueueFilters>(initialFilters);
  const [searchText, setSearchText] = useState(initialFilters.q);
  const [announcement, setAnnouncement] = useState('');
  const [status, setStatus] = useState<Status>('ready');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  /** The tab and filters the screen is on, for a handler or the search timer that runs after a render they were created in. Written only from handlers. */
  const current = useRef({ tab: initialPage.tab, filters: initialFilters });
  const searchTimer = useRef<number | null>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef<FocusTarget | null>(null);
  const manager = role !== 'ENGINEER';

  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (target === 'search') searchBox.current?.focus();
    if (target === 'restore') restoreButton.current?.focus();
    if (target === 'remove') removeButton.current?.focus();
  });

  useEffect(
    () => () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    },
    [],
  );

  /**
   * The download markers of the rows of a page of the Closed tab (STORY-CR01.7E AC-5), asked for only by a Lead and an Admin: `undefined` where none are drawn (an Engineer, the other tabs, no rows), and `'unavailable'`
   * when they could not be read, which the rows say in words. A cancelled call is also `'unavailable'`; the caller ignores it when a newer request took over.
   */
  async function markersOf(tab: QueueTab, tasks: QueuePageData['tasks'], signal: AbortSignal): Promise<DownloadMarkers | 'unavailable' | undefined> {
    if (!manager || tab !== 'closed' || tasks.length === 0) return undefined;
    const outcome = await fetchDownloadMarkers(tasks.map((task) => task.id), fetch, signal);
    return outcome.status === 'ok' ? outcome.value : 'unavailable';
  }

  /** Starts a request and returns its controller; any request before it is cancelled. */
  function startRequest(): AbortController {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller;
  }

  function stopSearchTimer(): void {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }

  async function load(next: QueueTab, nextFilters: QueueFilters, announce: boolean): Promise<void> {
    const controller = startRequest();
    current.current = { tab: next, filters: nextFilters };
    setActiveTab(next);
    setStatus('loading');
    setMoreFailed(false);
    setLoadingMore(false);
    writeAddress(next, nextFilters);
    const outcome = await fetchQueuePage(next, undefined, fetch, controller.signal, nextFilters);
    // A newer request took over while this one was on its way: its answer is the one to show.
    if (inFlight.current !== controller) return;
    if (outcome.status === 'ok') {
      const nextMarkers = await markersOf(next, outcome.value.tasks, controller.signal);
      if (inFlight.current !== controller) return;
      setPage(outcome.value);
      setMarkers(nextMarkers);
      setStatus('ready');
      if (announce) setAnnouncement(tasksFoundText(outcome.value.counts[next]));
    } else {
      setStatus('error');
    }
  }

  /** A filter changed: show it, and ask for the list again unless the dates are the wrong way round (that is said under To, and nothing is sent until it makes sense). */
  function apply(next: QueueFilters): void {
    current.current = { tab: current.current.tab, filters: next };
    setFilters(next);
    if (dateRangeProblem(next) !== null) {
      inFlight.current?.abort();
      inFlight.current = null;
      setStatus('ready');
      setLoadingMore(false);
      return;
    }
    void load(current.current.tab, next, true);
  }

  /** The text of the search box becomes the search; nothing is asked when it is what the list already has. */
  function commitSearch(text: string): void {
    stopSearchTimer();
    const q = text.trim();
    if (q !== current.current.filters.q) apply({ ...current.current.filters, q });
  }

  function typeSearch(text: string): void {
    setSearchText(text);
    stopSearchTimer();
    searchTimer.current = window.setTimeout(() => commitSearch(text), SEARCH_PAUSE_MS);
  }

  /** Clear filters: the search, Engineer, Customer, From and To go (the chip is separate and stays); focus goes to the search, since the button is gone once it has done its work. */
  function clearFilters(): void {
    stopSearchTimer();
    setSearchText('');
    apply(withoutListFilters(current.current.filters));
    focusAfterRender.current = 'search';
  }

  function removeAssignedBy(): void {
    apply({ ...current.current.filters, assignedBy: role === 'LEAD' ? 'anyone' : '' });
    focusAfterRender.current = role === 'LEAD' ? 'restore' : 'search';
  }

  function restoreAssignedBy(): void {
    apply({ ...current.current.filters, assignedBy: 'me' });
    focusAfterRender.current = 'remove';
  }

  async function showMore(): Promise<void> {
    if (loadingMore || status !== 'ready' || page.nextCursor === null || dateRangeProblem(filters) !== null) return;
    const controller = startRequest();
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await fetchQueuePage(activeTab, page.nextCursor, fetch, controller.signal, filters);
    if (inFlight.current !== controller) return;
    if (outcome.status !== 'ok') {
      setLoadingMore(false);
      setMoreFailed(true);
      return;
    }
    const more = await markersOf(activeTab, outcome.value.tasks, controller.signal);
    if (inFlight.current !== controller) return;
    setLoadingMore(false);
    setPage({ ...outcome.value, tasks: [...page.tasks, ...outcome.value.tasks] });
    // The markers already read stay; the new rows' are added. One that could not be read makes the whole list say so, rather than a mixture.
    if (more !== undefined) setMarkers(mergeMarkers(markers, more));
  }

  function retry(): void {
    void load(activeTab, filters, false);
  }

  function changeTab(value: string): void {
    if (isQueueTab(value) && value !== activeTab) void load(value, filters, false);
  }

  /** What the tab's panel shows: the error, the skeleton, the no-match or empty state, or the tasks with "Show more tasks" when more follow. */
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
    // The Ignored tab says whose tasks these are above the list and above its empty state (UX 12944 section 1).
    const intro = activeTab === 'ignored' ? <p className="px-s-4 pt-s-4 text-label text-ink-2">{ignoredIntroFor(role)}</p> : null;
    if (page.tasks.length === 0) {
      const filtered = hasListFilter(filters);
      const words = filtered ? (manager ? NO_MATCH_MANAGER : NO_MATCH_ENGINEER) : emptyTextFor(role, activeTab);
      let action: ReactNode;
      if (filtered && manager) {
        action = (
          <Button variant="secondary" onClick={clearFilters}>
            {CLEAR_FILTERS}
          </Button>
        );
      } else if (manager && activeTab === 'open') {
        action = <AssignButton />;
      }
      return (
        <>
          {intro}
          <div role="status">
            <EmptyState icon={<Icon icon={ListChecks} size="state" />} title={words.title} description={words.description} action={action} />
          </div>
        </>
      );
    }
    return (
      <>
        {intro}
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
        <QueueList role={role} tasks={page.tasks} asOf={page.asOf} {...(markers === undefined ? {} : { markers })} />
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
      <Card>
        <CardContent>
          <QueueFiltersBar
            manager={manager}
            canRestoreAssignedBy={role === 'LEAD'}
            filters={filters}
            searchText={searchText}
            engineers={engineers}
            customers={customers}
            onSearchText={typeSearch}
            onSearchSubmit={() => commitSearch(searchText)}
            onChange={apply}
            onRemoveAssignedBy={removeAssignedBy}
            onRestoreAssignedBy={restoreAssignedBy}
            searchRef={searchBox}
            restoreRef={restoreButton}
            removeRef={removeButton}
          />
        </CardContent>
      </Card>
      {/* The number of tasks found, read out politely after a filter changes. It is in the page from the first paint, so a screen reader hears the change. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {/* A range that ends before it begins is said under To and shows nothing: not the list of the filters before it (as the audit log does). */}
      {dateRangeProblem(filters) === null ? (
        <Card aria-busy={status === 'loading' || undefined}>
          <CardContent className="flex flex-col gap-s-4">
            <Tabs value={activeTab} onValueChange={changeTab}>
              <TabsList aria-label={TABS_LABEL} className="max-[479px]:grid max-[479px]:grid-cols-2 max-[479px]:overflow-x-visible">
                {QUEUE_TABS.map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {value === 'overdue' ? <Icon icon={Clock} size="hint" /> : null}
                    {QUEUE_TAB_LABELS[value]}
                    <Badge tone="neutral">{page.counts[value]}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              <p className="pt-s-3 text-label text-ink-2">{activeTab === 'ignored' ? SORT_NOTE_IGNORED : SORT_NOTE}</p>
              {QUEUE_TABS.map((value) => (
                <TabsContent key={value} value={value}>
                  {panel}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
