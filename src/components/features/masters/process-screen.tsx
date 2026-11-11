'use client';

import { Plus, Search } from 'lucide-react';
import { useRef, type RefObject } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProcessItemRow } from '@/lib/masters/process-items-client';

import { MasterDialogsFailed } from './master-dialogs-failed';
import { isOpener } from './master-opener';
import { BREAK_LONG_NAMES, FAILED_DIALOGS_TITLE, type PageNotice } from './master-texts';
import { ProcessResults } from './process-results';
import {
  ADD_RATE,
  FAILED_CONFIRMATION_TITLE,
  PROCESS_DESCRIPTION,
  PROCESS_TITLE,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
} from './process-texts';
import { useProcessMaster, type ProcessMaster } from './use-process-master';

/**
 * SCR-11 "Process master" (STORY-02.01 AC-1 to AC-5, AC-7, AC-8). It lays out the page and hands everything else to
 * `useProcessMaster`: the list the server rendered, the search by name, the dialogs (add, edit, delete, and the refusal to delete a
 * rate a formula uses) and the notice under the header. It decides nothing: every rule (a name that is free and safe in a formula, a
 * rate a formula uses, the audit entry) is the server's, and this screen puts the server's reason where the person can read it.
 * After a change it asks the server for the list again, so the order, the values and the "Used in" letters on screen are the server's.
 *
 * The dialogs are not in the first load of the page (NFR-009): they are fetched the first time a button opens one, through the
 * shared first-open loader (architecture section 10, AQP-188). Focus returns to the button that opened a dialog, or to the heading when
 * that button is gone. There is deliberately no `loading.tsx` beside the page (it would turn the 403 of a refused role into a
 * streamed 200, TD-06, QLT-72): the first paint already holds the list, and the loading state is the list being read again.
 */

export interface ProcessScreenProps {
  readonly initialItems: ReadonlyArray<ProcessItemRow>;
}

function AddRateButton({ master }: { readonly master: ProcessMaster }) {
  const { dialogs } = master;
  const busy = isOpener(dialogs.pressed, null, 'add') && dialogs.loader.pending;
  return (
    <Button data-action="add" {...(busy ? { 'aria-busy': true } : {})} onClick={(event) => master.onAdd(event.detail === 0)}>
      <Icon icon={Plus} />
      {ADD_RATE}
    </Button>
  );
}

/** The notice under the header. The warning and the information are statuses, not alerts: nothing failed (ux-spec v0.17). */
function PageNoticeView({ notice }: { readonly notice: PageNotice }) {
  return (
    <Notice tone={notice.tone} role="status" className={BREAK_LONG_NAMES} {...(notice.title === undefined ? {} : { title: notice.title })}>
      {notice.text}
    </Notice>
  );
}

function SearchBox({ query, onChange, inputRef }: { readonly query: string; readonly onChange: (query: string) => void; readonly inputRef: RefObject<HTMLInputElement | null> }) {
  return (
    <CardContent className="border-b border-border">
      <div className="flex max-w-120 flex-col gap-s-2">
        <Label htmlFor="rate-search">{SEARCH_LABEL}</Label>
        <div className="relative">
          <Icon icon={Search} size="small" className="pointer-events-none absolute top-1/2 left-s-3 -translate-y-1/2 text-ink-2" />
          <Input ref={inputRef} id="rate-search" type="search" autoComplete="off" placeholder={SEARCH_PLACEHOLDER} className="pl-s-7" value={query} onChange={(event) => onChange(event.target.value)} />
        </div>
      </div>
    </CardContent>
  );
}

export function ProcessScreen({ initialItems }: ProcessScreenProps) {
  const master = useProcessMaster(initialItems);
  const { list, dialogs, notice } = master;
  const search = useRef<HTMLInputElement>(null);
  const Dialogs = dialogs.loader.shown ? dialogs.loader.Overlay : null;
  const clearFilters = (): void => {
    list.setQuery('');
    search.current?.focus();
  };

  return (
    <>
      <PageHeader title={PROCESS_TITLE} description={PROCESS_DESCRIPTION} actions={<AddRateButton master={master} />} />
      {dialogs.loader.failed ? (
        <MasterDialogsFailed title={dialogs.open === 'delete' || dialogs.open === 'blocked' ? FAILED_CONFIRMATION_TITLE : FAILED_DIALOGS_TITLE} />
      ) : null}
      {notice === null ? null : <PageNoticeView notice={notice} />}
      <Card aria-busy={list.status === 'loading' || undefined}>
        <SearchBox query={list.query} onChange={list.setQuery} inputRef={search} />
        <ProcessResults master={master} onClearFilters={clearFilters} />
      </Card>
      {Dialogs === null ? null : (
        <Dialogs
          open={dialogs.open}
          target={dialogs.target}
          formItem={dialogs.formItem}
          blockedBy={dialogs.blockedBy}
          onClose={() => dialogs.setOpen(null)}
          onSaved={(saved) => void master.onSaved(saved)}
          onBlocked={master.onBlocked}
          onGone={master.onGone}
          onCloseAutoFocus={master.onCloseAutoFocus}
        />
      )}
    </>
  );
}
