'use client';

import { Plus, SearchX } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { EmptyState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

import { MasterLoadError } from './master-load-error';
import { CLEAR_FILTERS, SAVED_NOT_SHOWN_BODY } from './master-texts';
import { ProcessList } from './process-list';
import { EMPTY_DESCRIPTION, EMPTY_TITLE, ERROR_TITLE, LOADING_LABEL, NO_MATCH_DESCRIPTION } from './process-texts';
import type { ProcessMaster } from './use-process-master';

/**
 * What the card of SCR-11 shows below the search (STORY-02.01 AC-8): the error with "Try again", the skeleton once 300 ms have
 * passed, the empty state ("No rates yet"; the Add rate button is always in the page header), "No rate matches" with Clear filters,
 * or the rates. The skeleton rows are `aria-busy`, with a polite "Loading" beside them (`SkeletonBlock`).
 */

const SKELETON_ROWS = 6;

export interface ProcessResultsProps {
  readonly master: ProcessMaster;
  /** Clear filters: the search emptied and focus put back on it. */
  readonly onClearFilters: () => void;
}

function NoMatch({ query, onClearFilters }: { readonly query: string; readonly onClearFilters: () => void }) {
  return (
    <div role="status">
      <EmptyState
        icon={<Icon icon={SearchX} size="state" />}
        title={`No rate matches "${query.trim()}"`}
        description={NO_MATCH_DESCRIPTION}
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            {CLEAR_FILTERS}
          </Button>
        }
      />
    </div>
  );
}

export function ProcessResults({ master, onClearFilters }: ProcessResultsProps) {
  const { list, dialogs } = master;
  if (list.status === 'error') {
    // While a success notice is on the page the change happened, so the error never reads "Nothing was changed." under "X saved." (DEF-029).
    const saved = master.notice !== null;
    return <MasterLoadError title={ERROR_TITLE} onRetry={() => void master.readAgain(false)} description={saved ? SAVED_NOT_SHOWN_BODY : undefined} />;
  }
  if (list.showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={LOADING_LABEL} />;
  if (list.items.length === 0) {
    return (
      <div role="status">
        <EmptyState icon={<Icon icon={Plus} size="state" />} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
      </div>
    );
  }
  if (list.shown.length === 0) return <NoMatch query={list.query} onClearFilters={onClearFilters} />;
  return <ProcessList items={list.shown} pendingOpener={dialogs.loader.pending ? dialogs.pressed : null} onAction={master.onRowAction} />;
}
