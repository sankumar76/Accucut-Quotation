'use client';

import { RotateCcw, ScrollText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SKELETON_DELAY_MS, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAuditPage, type AuditPageData } from '@/lib/audit/audit-client';
import { hasActiveFilter, NO_FILTERS, rangeProblem, type AuditFilters } from '@/lib/audit/filters';

import { AuditFiltersBar, type AuditPerson } from './audit-filters';
import { AuditList } from './audit-list';
import {
  AUDIT_DESCRIPTION,
  AUDIT_TITLE,
  EMPTY_CLEAR_FILTERS,
  EMPTY_FILTERED_DESCRIPTION,
  EMPTY_TITLE,
  EMPTY_UNFILTERED_DESCRIPTION,
  EMPTY_UNFILTERED_TITLE,
  ERROR_RETRY,
  ERROR_TITLE,
  LOADING_LABEL,
  SHOW_MORE_FAILED_BODY,
  SHOW_MORE_FAILED_TITLE,
} from './texts';
import { useAfterDelay } from './use-after-delay';

/**
 * SCR-16 "Audit log" (STORY-01.07 AC-6, AC-8): the Admin reads the permanent record and filters it by who, event, from and to.
 * It holds the first page the server rendered, asks `/api/v1/audit` again whenever a filter changes, and shows what the server
 * answered. It decides nothing: which entries exist, their order, their words and the total are the server's. There is no control
 * that changes an entry; the only thing to press is "Show more entries".
 *
 * States: the list; empty ("No entries match", with a way to clear the filters); loading (the list that was there stays until
 * 300 ms have passed, then skeleton rows, the whole card `aria-busy`); error ("We could not load the audit log", "Try again").
 * A newer request cancels the one before it, so a slow answer to an old filter never replaces the answer to the current one.
 *
 * There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, QLT-72): the
 * first paint already holds the first page, and the loading state is a filter being read again.
 */

export interface AuditScreenProps {
  readonly initialPage: AuditPageData;
  /** Everyone who can have made a change, for the Who list. */
  readonly people: ReadonlyArray<AuditPerson>;
}

type Status = 'ready' | 'loading' | 'error';

const SKELETON_ROWS = 6;

export function AuditScreen({ initialPage, people }: AuditScreenProps) {
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const [page, setPage] = useState<AuditPageData>(initialPage);
  const [status, setStatus] = useState<Status>('ready');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const footer = useRef<HTMLParagraphElement>(null);
  const focusFooterAfterRender = useRef(false);
  const showSkeleton = useAfterDelay(status === 'loading', SKELETON_DELAY_MS);

  // "Show more entries" removes itself on the last page, and focus must not fall to the top of the document with it.
  useEffect(() => {
    if (focusFooterAfterRender.current && page.nextCursor === null) footer.current?.focus();
    focusFooterAfterRender.current = false;
  }, [page]);

  /** Starts a request and returns its controller; any request before it is cancelled. */
  function startRequest(): AbortController {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller;
  }

  async function load(next: AuditFilters): Promise<void> {
    const controller = startRequest();
    setStatus('loading');
    setMoreFailed(false);
    setLoadingMore(false);
    const outcome = await fetchAuditPage(next, undefined, fetch, controller.signal);
    // A newer request took over while this one was on its way: its answer is the one to show.
    if (inFlight.current !== controller) return;
    if (outcome.status === 'ok') {
      setPage(outcome.value);
      setStatus('ready');
    } else {
      // A call that was cancelled and is still the current one was cancelled by nothing of ours: say so, never spin for ever.
      setStatus('error');
    }
  }

  function change(next: AuditFilters): void {
    setFilters(next);
    if (rangeProblem(next) !== null) {
      // Said in words under the To field; nothing is asked of the server until the range makes sense.
      inFlight.current?.abort();
      inFlight.current = null;
      setStatus('ready');
      setLoadingMore(false);
      return;
    }
    void load(next);
  }

  async function showMore(): Promise<void> {
    if (loadingMore || status !== 'ready' || page.nextCursor === null) return;
    const controller = startRequest();
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await fetchAuditPage(filters, page.nextCursor, fetch, controller.signal);
    if (inFlight.current !== controller) return;
    setLoadingMore(false);
    if (outcome.status === 'ok') {
      focusFooterAfterRender.current = true;
      setPage({ ...outcome.value, entries: [...page.entries, ...outcome.value.entries] });
    } else {
      setMoreFailed(true);
    }
  }

  /** What the results card shows: the error, the skeleton once 300 ms have passed, the empty state, or the entries. */
  function results() {
    if (status === 'error') {
      return (
        <ErrorState
          title={ERROR_TITLE}
          focusOnMount
          action={
            <Button onClick={() => void load(filters)}>
              <Icon icon={RotateCcw} />
              {ERROR_RETRY}
            </Button>
          }
        />
      );
    }
    if (showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={LOADING_LABEL} />;
    if (page.entries.length === 0) {
      const filtered = hasActiveFilter(filters);
      return (
        <EmptyState
          icon={<Icon icon={ScrollText} size="state" />}
          title={filtered ? EMPTY_TITLE : EMPTY_UNFILTERED_TITLE}
          description={filtered ? EMPTY_FILTERED_DESCRIPTION : EMPTY_UNFILTERED_DESCRIPTION}
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => change(NO_FILTERS)}>
                {EMPTY_CLEAR_FILTERS}
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <>
        {moreFailed ? (
          <div className="p-s-4 pb-0">
            <Notice tone="danger" title={SHOW_MORE_FAILED_TITLE}>
              {SHOW_MORE_FAILED_BODY}
            </Notice>
          </div>
        ) : null}
        <AuditList
          entries={page.entries}
          total={page.total}
          hasMore={page.nextCursor !== null}
          loadingMore={loadingMore}
          onShowMore={() => void showMore()}
          footerRef={footer}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={AUDIT_TITLE} description={AUDIT_DESCRIPTION} />
      <Card>
        <CardContent>
          <AuditFiltersBar people={people} filters={filters} onChange={change} />
        </CardContent>
      </Card>
      <Card aria-busy={status === 'loading' || undefined}>{results()}</Card>
    </>
  );
}
