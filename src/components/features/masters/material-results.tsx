'use client';

import { Plus, RotateCcw, SearchX } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

import { BREAK_LONG_NAMES, CLEAR_FILTERS, ERROR_RETRY } from './master-texts';
import { MaterialList } from './material-list';
import {
  MATERIALS_EMPTY_DESCRIPTION,
  MATERIALS_EMPTY_TITLE,
  MATERIALS_ERROR_TITLE,
  MATERIALS_LOADING_LABEL,
  MATERIALS_NO_MATCH_DESCRIPTION,
  noMaterialMatchTitle,
} from './material-texts';
import type { MaterialMaster } from './use-material-master';

/**
 * What the Materials tab of SCR-13 shows below the search (STORY-02.03 AC-8): the error with "Try again", the skeleton once 300 ms have
 * passed, the empty state ("No materials yet"; the Add material button is always above), "No material matches" with Clear filters, or the
 * materials. The skeleton rows are `aria-busy`, with a polite "Loading" beside them (`SkeletonBlock`).
 */

const SKELETON_ROWS = 6;

export interface MaterialResultsProps {
  readonly master: MaterialMaster;
  /** Clear filters: the search emptied and focus put back on it. */
  readonly onClearFilters: () => void;
}

function LoadError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <ErrorState
      title={MATERIALS_ERROR_TITLE}
      focusOnMount
      action={
        <Button onClick={onRetry}>
          <Icon icon={RotateCcw} />
          {ERROR_RETRY}
        </Button>
      }
    />
  );
}

function NoMatch({ query, onClearFilters }: { readonly query: string; readonly onClearFilters: () => void }) {
  return (
    <div role="status">
      <EmptyState
        icon={<Icon icon={SearchX} size="state" />}
        title={noMaterialMatchTitle(query)}
        description={MATERIALS_NO_MATCH_DESCRIPTION}
        className={BREAK_LONG_NAMES}
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            {CLEAR_FILTERS}
          </Button>
        }
      />
    </div>
  );
}

export function MaterialResults({ master, onClearFilters }: MaterialResultsProps) {
  const { list, dialog } = master;
  if (list.status === 'error') return <LoadError onRetry={() => void master.readAgain(false)} />;
  if (list.showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={MATERIALS_LOADING_LABEL} />;
  if (list.items.length === 0) {
    return (
      <div role="status">
        <EmptyState icon={<Icon icon={Plus} size="state" />} title={MATERIALS_EMPTY_TITLE} description={MATERIALS_EMPTY_DESCRIPTION} />
      </div>
    );
  }
  if (list.shown.length === 0) return <NoMatch query={list.query} onClearFilters={onClearFilters} />;
  return <MaterialList items={list.shown} pendingOpener={dialog.loader.pending ? dialog.pressed : null} onEdit={master.onEdit} />;
}
