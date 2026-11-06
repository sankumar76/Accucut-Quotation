'use client';

import { Plus, RotateCcw, Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/shared/icon';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SKELETON_DELAY_MS, SkeletonBlock } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { revealNearest } from '@/lib/ui/reveal';
import { listProcessItems, type FormulaUseRow, type ProcessItemRow } from '@/lib/masters/process-items-client';

import type { ProcessDialogsProps } from './process-dialogs';
import { ProcessList, type RowAction } from './process-list';
import { findOpenerElement, isOpener, type DialogKind, type Opener } from './process-opener';
import {
  ADD_RATE,
  CLEAR_FILTERS,
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  ERROR_RETRY,
  ERROR_TITLE,
  FAILED_CONFIRMATION_TITLE,
  FAILED_DIALOGS_MESSAGE,
  FAILED_DIALOGS_TITLE,
  LOADING_LABEL,
  NO_MATCH_DESCRIPTION,
  PROCESS_DESCRIPTION,
  PROCESS_TITLE,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
} from './process-texts';

/**
 * SCR-11 "Process master" (STORY-02.01 AC-1 to AC-5, AC-7, AC-8). It holds the list the server rendered, filters it by name as the
 * Admin types, opens the dialogs (add, edit, delete, and the refusal to delete a rate a formula uses) and shows what the server
 * answered. It decides nothing: every rule (a name that is free and safe in a formula, a rate a formula uses, the audit entry) is the
 * server's, and this screen puts the server's reason where the person can read it. After a change it asks the server for the list
 * again, so the order, the values and the "Used in" letters on screen are the server's too.
 *
 * States: the list; empty ("No rates yet", with the Add rate button always in the header); no match ("No rate matches", with
 * Clear filters); loading (the list that was there stays until 300 ms have passed, then skeleton rows, the card `aria-busy`);
 * error ("We could not load the rates", "Try again"). The dialogs are not in the first load of the page (NFR-009): they are
 * fetched the first time a button opens one, through the shared first-open loader (architecture section 10, AQP-188). Focus returns
 * to the button that opened a dialog, or to the same action of the same rate when the list has changed under it.
 *
 * There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, TD-06,
 * QLT-72): the first paint already holds the list, and the loading state is the list being read again after a change.
 */

export interface ProcessScreenProps {
  readonly initialItems: ReadonlyArray<ProcessItemRow>;
}

type Status = 'ready' | 'loading' | 'error';

const SKELETON_ROWS = 6;

/** The dialogs' code: a bare `import()` that the loader can try again after a failure. */
const loadDialogs = () => import('./process-dialogs').then((module) => module.ProcessDialogs);

/** Rates whose name contains what was typed, ignoring letter case and surrounding spaces. */
function matching(items: ReadonlyArray<ProcessItemRow>, query: string): ReadonlyArray<ProcessItemRow> {
  const wanted = query.trim().toLowerCase();
  return wanted === '' ? items : items.filter((item) => item.name.toLowerCase().includes(wanted));
}

export function ProcessScreen({ initialItems }: ProcessScreenProps) {
  const [items, setItems] = useState<ReadonlyArray<ProcessItemRow>>(initialItems);
  const [status, setStatus] = useState<Status>('ready');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<DialogKind | null>(null);
  // The rate a dialog is about stays set after it closes, so the text does not change while the panel fades out.
  const [target, setTarget] = useState<ProcessItemRow | null>(null);
  const [formItem, setFormItem] = useState<ProcessItemRow | null>(null);
  const [blockedBy, setBlockedBy] = useState<ReadonlyArray<FormulaUseRow>>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [pressed, setPressed] = useState<Opener | null>(null);
  const opener = useRef<Opener | null>(null);
  const refocus = useRef<Opener | null>(null);
  const failureNotice = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const first = useFirstOpen<ProcessDialogsProps>({ id: 'process-dialogs', load: loadDialogs });
  const showSkeleton = useAfterDelay(status === 'loading', SKELETON_DELAY_MS);

  // A list that changed may have moved the button focus returned to: put focus back on it once the new list is drawn.
  useEffect(() => {
    if (refocus.current === null) return;
    findOpenerElement(refocus.current)?.focus();
    refocus.current = null;
  }, [items]);

  // A notice that is off-screen is brought into view; one already in view does not move (UX spec v0.14, SCR-25).
  useEffect(() => {
    if (first.failed) revealNearest(failureNotice.current);
  }, [first.failed]);

  function openDialog(kind: DialogKind, item: ProcessItemRow | null, from: Opener, byKeyboard: boolean): void {
    // A second press while the first is loading does nothing (UX spec 7.3.1 rule 11): no second request, no second target.
    if (first.pending) return;
    opener.current = from;
    setPressed(from);
    setSaved(null);
    setTarget(item);
    if (kind === 'add' || kind === 'edit') setFormItem(item);
    if (kind === 'blocked') setBlockedBy(item?.usedBy ?? []);
    setOpen(kind);
    first.activate(byKeyboard);
  }

  function onRowAction(action: RowAction, item: ProcessItemRow, button: HTMLButtonElement, byKeyboard: boolean): void {
    const from: Opener = { itemId: item.id, action: button.dataset['action'] ?? action };
    // A rate a formula uses cannot be deleted: the refusal opens at once, from the list the page already holds (AC-4).
    const kind: DialogKind = action === 'delete' && item.usedBy.length > 0 ? 'blocked' : action;
    openDialog(kind, item, from, byKeyboard);
  }

  function onCloseAutoFocus(event: Event): void {
    // Radix returns focus only to a trigger, and these dialogs have none: the opener is remembered here.
    event.preventDefault();
    if (opener.current !== null) findOpenerElement(opener.current)?.focus();
  }

  /** Reads the list again. The change itself is already saved, so a failure here says so and leaves the list as it was. */
  async function refresh(returnFocus = true): Promise<void> {
    refocus.current = returnFocus ? opener.current : null;
    setStatus('loading');
    const outcome = await listProcessItems();
    if (outcome.status === 'ok') {
      setItems(outcome.value);
      setStatus('ready');
      return;
    }
    refocus.current = null;
    setStatus('error');
  }

  async function onSaved(text: string): Promise<void> {
    setOpen(null);
    setSaved(text);
    await refresh();
  }

  function clearFilters(): void {
    setQuery('');
    search.current?.focus();
  }

  const shown = matching(items, query);
  const Dialogs = first.shown ? first.Overlay : null;

  /** What the card shows below the search: the error, the skeleton once 300 ms have passed, an empty state, or the rates. */
  function results() {
    if (status === 'error') {
      return (
        <ErrorState
          title={ERROR_TITLE}
          focusOnMount
          action={
            <Button onClick={() => void refresh()}>
              <Icon icon={RotateCcw} />
              {ERROR_RETRY}
            </Button>
          }
        />
      );
    }
    if (showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={LOADING_LABEL} />;
    if (items.length === 0) {
      return (
        <div role="status">
          <EmptyState icon={<Icon icon={Plus} size="state" />} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
        </div>
      );
    }
    if (shown.length === 0) {
      return (
        <div role="status">
          <EmptyState
            icon={<Icon icon={SearchX} size="state" />}
            title={`No rate matches "${query.trim()}"`}
            description={NO_MATCH_DESCRIPTION}
            action={
              <Button variant="secondary" onClick={clearFilters}>
                {CLEAR_FILTERS}
              </Button>
            }
          />
        </div>
      );
    }
    return <ProcessList items={shown} pendingOpener={first.pending ? pressed : null} onAction={onRowAction} />;
  }

  return (
    <>
      <PageHeader
        title={PROCESS_TITLE}
        description={PROCESS_DESCRIPTION}
        actions={
          <Button
            data-action="add"
            {...(isOpener(pressed, null, 'add') && first.pending ? { 'aria-busy': true } : {})}
            onClick={(event) => openDialog('add', null, { itemId: null, action: 'add' }, event.detail === 0)}
          >
            <Icon icon={Plus} />
            {ADD_RATE}
          </Button>
        }
      />
      {first.failed ? (
        <div ref={failureNotice}>
          <Notice tone="danger" title={open === 'delete' || open === 'blocked' ? FAILED_CONFIRMATION_TITLE : FAILED_DIALOGS_TITLE}>
            {FAILED_DIALOGS_MESSAGE}
          </Notice>
        </div>
      ) : null}
      {saved === null ? null : <Notice tone="success">{saved}</Notice>}
      <Card aria-busy={status === 'loading' || undefined}>
        <CardContent className="border-b border-border">
          <div className="flex max-w-120 flex-col gap-s-2">
            <Label htmlFor="rate-search">{SEARCH_LABEL}</Label>
            <div className="relative">
              <Icon icon={Search} size="small" className="pointer-events-none absolute top-1/2 left-s-3 -translate-y-1/2 text-ink-2" />
              <Input
                ref={search}
                id="rate-search"
                type="search"
                autoComplete="off"
                placeholder={SEARCH_PLACEHOLDER}
                className="pl-s-7"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
        {results()}
      </Card>
      {Dialogs === null ? null : (
        <Dialogs
          open={open}
          target={target}
          formItem={formItem}
          blockedBy={blockedBy}
          onClose={() => setOpen(null)}
          onSaved={(text) => void onSaved(text)}
          onBlocked={(formulas) => {
            setBlockedBy(formulas);
            setOpen('blocked');
            // The list was out of date (a formula began to use the rate): read it again, behind the dialog, and leave focus where it is.
            void refresh(false);
          }}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      )}
    </>
  );
}
