'use client';

import { RotateCcw, Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { listConfigFields, type ConfigFieldRow } from '@/lib/config/fields-client';
import { filterFields, isKindFilter, KIND_FILTER_OPTIONS, type KindFilter } from '@/lib/config/fields-list';

import { useMasterList } from '../masters/use-master-list';

import { FieldsList } from './fields-table';
import {
  CLEAR_FILTERS,
  ERROR_RETRY,
  ERROR_TITLE,
  FIELDS_DESCRIPTION,
  FIELDS_TITLE,
  KIND_FILTER_LABEL,
  LOADING_LABEL,
  noMatchTitle,
  NO_MATCH_DESCRIPTION,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  VIEW_ONLY_TEXT,
  VIEW_ONLY_TITLE,
} from './fields-texts';

/**
 * SCR-17 "Fields and formulas" (STORY-08.01 AC-1, AC-4, AC-7): every field in column order with its kind and formula, a search by letter, name or formula, and a filter by kind.
 * The page has checked the role and sent nothing but the role's reading of it (`viewOnly`); the screen asks `GET /api/v1/config/fields` itself, so its Loading and Error states are real:
 * the skeleton after 300 ms, and "We could not load the fields and formulas" with "Try again". It decides nothing: the letters, the kinds and the formulas are the server's.
 * A Lead sees the same table under the banner "View only", and neither role has an action here yet (08.02 onward adds the Admin's).
 *
 * The list state is the shared `useMasterList` (latest read wins, the skeleton delay, the filter), the one hook that a screen which lists rows read from the server composes (DL-150 (5)).
 * There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, QLT-72), so the page itself holds no data.
 */

export interface FieldsScreenProps {
  /** A Lead reads the page and has no action: the banner says so (AC-4). The Admin is the one role that may edit, from story 08.02. */
  readonly viewOnly: boolean;
}

const SKELETON_ROWS = 8;

function ViewOnlyBanner() {
  return (
    <Notice tone="info" role="status" title={VIEW_ONLY_TITLE}>
      {VIEW_ONLY_TEXT}
    </Notice>
  );
}

interface SearchBarProps {
  readonly query: string;
  readonly kind: KindFilter;
  readonly onQuery: (query: string) => void;
  readonly onKind: (kind: KindFilter) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}

/** The search and the kind filter, side by side from 768 px and stacked below it. */
function SearchBar({ query, kind, onQuery, onKind, inputRef }: SearchBarProps) {
  return (
    <CardContent className="flex flex-col gap-s-3 border-b border-border md:flex-row md:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-s-2">
        <Label htmlFor="field-search">{SEARCH_LABEL}</Label>
        <div className="relative">
          <Icon icon={Search} size="small" className="pointer-events-none absolute top-1/2 left-s-3 -translate-y-1/2 text-ink-2" />
          <Input
            ref={inputRef}
            id="field-search"
            type="search"
            autoComplete="off"
            placeholder={SEARCH_PLACEHOLDER}
            className="pl-s-7"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-s-2 md:w-1/3">
        <Label htmlFor="field-kind">{KIND_FILTER_LABEL}</Label>
        <NativeSelect
          id="field-kind"
          value={kind}
          onChange={(event) => {
            if (isKindFilter(event.target.value)) onKind(event.target.value);
          }}
        >
          {KIND_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </CardContent>
  );
}

function NoMatch({ query, onClear }: { readonly query: string; readonly onClear: () => void }) {
  return (
    <div role="status">
      <EmptyState
        icon={<Icon icon={SearchX} size="state" />}
        title={noMatchTitle(query)}
        description={NO_MATCH_DESCRIPTION}
        action={
          <Button variant="secondary" onClick={onClear}>
            {CLEAR_FILTERS}
          </Button>
        }
      />
    </div>
  );
}

export function FieldsScreen({ viewOnly }: FieldsScreenProps) {
  const [kind, setKind] = useState<KindFilter>('all');
  const search = useRef<HTMLInputElement>(null);
  const list = useMasterList<ConfigFieldRow, null>({
    readList: () => listConfigFields(),
    initialItems: null,
    filter: (items, query) => filterFields(items, query, kind),
  });
  const { read } = list;

  // The first read starts when the screen opens: the status is `loading` already, so nothing is set first (`useMasterList`).
  useEffect(() => {
    void read();
  }, [read]);

  const clearFilters = (): void => {
    list.setQuery('');
    setKind('all');
    search.current?.focus();
  };

  return (
    <>
      <PageHeader title={FIELDS_TITLE} description={FIELDS_DESCRIPTION} />
      {viewOnly ? <ViewOnlyBanner /> : null}
      <Card aria-busy={list.status === 'loading' || undefined}>
        <SearchBar query={list.query} kind={kind} onQuery={list.setQuery} onKind={setKind} inputRef={search} />
        <FieldsResults list={list} onClear={clearFilters} />
      </Card>
    </>
  );
}

type FieldsListState = ReturnType<typeof useMasterList<ConfigFieldRow, null>>;

/** What the card shows below the search: the error with "Try again", the skeleton, "No field matches", or the rows. */
function FieldsResults({ list, onClear }: { readonly list: FieldsListState; readonly onClear: () => void }) {
  if (list.status === 'error' && list.items === null) {
    return (
      <ErrorState
        title={ERROR_TITLE}
        focusOnMount
        action={
          <Button onClick={() => void list.refresh()}>
            <Icon icon={RotateCcw} />
            {ERROR_RETRY}
          </Button>
        }
      />
    );
  }
  if (list.items === null) return <SkeletonBlock rows={SKELETON_ROWS} label={LOADING_LABEL} />;
  if (list.shown === null || list.shown.length === 0) return <NoMatch query={list.query} onClear={onClear} />;
  return <FieldsList rows={list.shown} />;
}
