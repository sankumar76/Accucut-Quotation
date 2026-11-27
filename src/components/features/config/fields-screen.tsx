'use client';

import { History, Plus, RotateCcw, Search, SearchX } from 'lucide-react';
import Link from 'next/link';
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
import { listConfigFields, readConfigVersionNumber, type ConfigFieldRow } from '@/lib/config/fields-client';
import { configurationNote, filterFields, isKindFilter, KIND_FILTER_OPTIONS, type KindFilter } from '@/lib/config/fields-list';

import { useMasterList } from '../masters/use-master-list';

import { DELETED_NOTICE_TITLE, DIALOG_FAILED_LINE } from './delete-field-texts';
import { FieldsList } from './fields-table';
import {
  CHECKPOINTS_BUTTON,
  CHECKPOINTS_PATH,
  CLEAR_FILTERS,
  ERROR_RETRY,
  ERROR_TITLE,
  FIELDS_DESCRIPTION,
  FIELDS_DESCRIPTION_LEAD,
  FIELDS_TITLE,
  INSERT_FIELD_BUTTON,
  INSERT_FIELD_PATH,
  KIND_FILTER_LABEL,
  LOADING_LABEL,
  noMatchTitle,
  NO_MATCH_DESCRIPTION,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  VIEW_ONLY_TEXT,
  VIEW_ONLY_TITLE,
} from './fields-texts';
import { useFieldsDelete, type FieldsDelete } from './use-fields-delete';

/**
 * SCR-17 "Fields and formulas" (STORY-08.01 AC-1, AC-4, AC-7): every field in column order with its kind and formula, a search by letter, name or formula, and a filter by kind.
 * The page has checked the role and sent nothing but the role's reading of it (`viewOnly`); the screen asks `GET /api/v1/config/fields` itself, so its Loading and Error states are real:
 * the skeleton after 300 ms, and "We could not load the fields and formulas" with "Try again". It decides nothing: the letters, the kinds and the formulas are the server's.
 * A Lead sees the same table under the banner "View only" and has no action; the Admin's "Edit formula" (STORY-08.02) opens SCR-18 on a field that has a formula, and "Delete" (STORY-08.04) opens the dialog of SCR-20 on a
 * field that is not protected; the dialog's code is fetched on the first press and is not in the first load (NFR-009). After a delete the list is read again and the server's sentence shows above it.
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
  /** The note of the configuration ("Configuration version 9. 67 columns, A to BO."), once the rows are known. */
  readonly note: string | null;
}

/** The search and the kind filter, side by side from 768 px and stacked below it. */
function SearchBar({ query, kind, onQuery, onKind, inputRef, note }: SearchBarProps) {
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
      {note === null ? null : <p className="text-label text-ink-2 md:flex-1">{note}</p>}
    </CardContent>
  );
}

/** The Admin's two buttons in the head of the page (the mock-up, AQP-473): the Checkpoints page, and the wizard that inserts a field. A Lead has neither. */
function HeadActions() {
  return (
    <div className="flex flex-wrap gap-s-2">
      <Button asChild variant="secondary">
        <Link href={CHECKPOINTS_PATH}>
          <Icon icon={History} />
          {CHECKPOINTS_BUTTON}
        </Link>
      </Button>
      <Button asChild>
        <Link href={INSERT_FIELD_PATH}>
          <Icon icon={Plus} />
          {INSERT_FIELD_BUTTON}
        </Link>
      </Button>
    </div>
  );
}

/** After a delete (STORY-08.04 AC-3): the sentence of the server, polite, above the list; and the line for a dialog whose code did not arrive. */
function DeleteNotices({ removal }: { readonly removal: FieldsDelete }) {
  return (
    <>
      {removal.notice === null ? null : (
        <Notice tone="success" title={DELETED_NOTICE_TITLE}>
          {removal.notice}
        </Notice>
      )}
      {removal.loader.failed ? <Notice tone="danger">{DIALOG_FAILED_LINE}</Notice> : null}
    </>
  );
}

/** The dialog of SCR-20, once its code is here (not in the first load, NFR-009). The field it is about stays set after it closes, so its text does not change while the panel fades out. */
function DeleteDialogHost({ removal }: { readonly removal: FieldsDelete }) {
  const Dialog = removal.loader.Overlay;
  if (Dialog === null || removal.target === null) return null;
  return <Dialog open={removal.open} onOpenChange={removal.setOpen} target={removal.target} onDeleted={removal.onDeleted} onStale={removal.onStale} onCloseAutoFocus={removal.onCloseAutoFocus} />;
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
  const removal = useFieldsDelete({ readAgain: list.refresh, listFailed: list.status === 'error' });
  // The number of the current version, for the note under the title: asked once, apart from the list; the note is without it when the answer does not come (nothing else depends on it).
  const [version, setVersion] = useState<number | null>(null);

  // The first read starts when the screen opens: the status is `loading` already, so nothing is set first (`useMasterList`).
  useEffect(() => {
    void read();
  }, [read]);
  useEffect(() => {
    let current = true;
    void readConfigVersionNumber().then((outcome) => {
      if (current && outcome.status === 'ok') setVersion(outcome.value);
    });
    return () => {
      current = false;
    };
  }, []);
  const first = list.items?.[0];
  const last = list.items?.at(-1);
  const note = first === undefined || last === undefined || list.items === null ? null : configurationNote(version, list.items.length, first.letter, last.letter);

  const clearFilters = (): void => {
    list.setQuery('');
    setKind('all');
    search.current?.focus();
  };

  return (
    <>
      <PageHeader title={FIELDS_TITLE} description={viewOnly ? FIELDS_DESCRIPTION_LEAD : FIELDS_DESCRIPTION} {...(viewOnly ? {} : { actions: <HeadActions /> })} />
      {viewOnly ? <ViewOnlyBanner /> : null}
      <DeleteNotices removal={removal} />
      <Card aria-busy={list.status === 'loading' || undefined}>
        <SearchBar query={list.query} kind={kind} onQuery={list.setQuery} onKind={setKind} inputRef={search} note={note} />
        <FieldsResults list={list} onClear={clearFilters} canEdit={!viewOnly} removal={removal} />
      </Card>
      <DeleteDialogHost removal={removal} />
    </>
  );
}

type FieldsListState = ReturnType<typeof useMasterList<ConfigFieldRow, null>>;

/** What the card shows below the search: the error with "Try again", the skeleton, "No field matches", or the rows. */
function FieldsResults({ list, onClear, canEdit, removal }: { readonly list: FieldsListState; readonly onClear: () => void; readonly canEdit: boolean; readonly removal: FieldsDelete }) {
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
  return <FieldsList rows={list.shown} canEdit={canEdit} onDelete={removal.onDelete} pressedDeleteId={removal.pressedId} />;
}
