'use client';

import { Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import type { MaterialRow } from '@/lib/masters/materials-client';
import { revealNearest } from '@/lib/ui/reveal';

import { isOpener } from './master-opener';
import { MasterSearchBox } from './master-search-box';
import { BREAK_LONG_NAMES, FAILED_DIALOGS_MESSAGE, FAILED_DIALOGS_TITLE, type PageNotice } from './master-texts';
import { MaterialResults } from './material-results';
import { ADD_MATERIAL, materialSavedNotice, MATERIAL_SEARCH_LABEL, MATERIAL_SEARCH_PLACEHOLDER } from './material-texts';
import { useMaterialMaster, type MaterialMaster } from './use-material-master';

/**
 * The Materials tab of SCR-13 (STORY-02.03 AC-1, AC-2, AC-7, AC-8). It lays out the tab and hands everything else to `useMaterialMaster`:
 * the list the server rendered, the search, the add / edit dialog and the notice above the table. It decides nothing: every rule (a name
 * that is free, a specific gravity above 0, the audit entry) is the server's, and this screen puts the server's reason where the person can
 * read it. After a change it asks the server for the list again, so the order and the values on screen are the server's.
 *
 * The dialog is not in the first load of the page (NFR-009): it is fetched the first time a button opens it, through the shared first-open
 * loader (architecture section 10, AQP-188). Focus returns to the button that opened it. There is deliberately no `loading.tsx` beside the
 * page (it would turn the 403 of a refused role into a streamed 200, TD-06): the first paint already holds the list, and the loading state
 * is the list being read again.
 */

export interface MaterialsPanelProps {
  readonly initialItems: ReadonlyArray<MaterialRow>;
}

function AddMaterialButton({ master }: { readonly master: MaterialMaster }) {
  const { dialog } = master;
  const busy = isOpener(dialog.pressed, null, 'add') && dialog.loader.pending;
  return (
    <Button data-action="add" {...(busy ? { 'aria-busy': true } : {})} onClick={(event) => master.onAdd(event.detail === 0)}>
      <Icon icon={Plus} />
      {ADD_MATERIAL}
    </Button>
  );
}

/** The code of the dialog did not arrive: said in a notice, brought into view if it is off the screen (UX spec v0.14, SCR-25). */
function DialogFailed() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealNearest(box.current);
  }, []);
  return (
    <div ref={box}>
      <Notice tone="danger" title={FAILED_DIALOGS_TITLE}>
        {FAILED_DIALOGS_MESSAGE}
      </Notice>
    </div>
  );
}

/** The notice above the table: a status, not an alert, because nothing failed. */
function SavedNotice({ notice }: { readonly notice: PageNotice }) {
  return (
    <Notice tone={notice.tone} role="status" className={BREAK_LONG_NAMES} {...(notice.title === undefined ? {} : { title: notice.title })}>
      {notice.text}
    </Notice>
  );
}

export function MaterialsPanel({ initialItems }: MaterialsPanelProps) {
  const master = useMaterialMaster(initialItems);
  const { list, dialog, notice } = master;
  const search = useRef<HTMLInputElement>(null);
  const Dialog = dialog.loader.shown ? dialog.loader.Overlay : null;
  const clearFilters = (): void => {
    list.setQuery('');
    search.current?.focus();
  };

  return (
    <div aria-busy={list.status === 'loading' || undefined} className="flex flex-col">
      <div className="flex flex-col gap-s-3 p-s-4 md:px-s-5">
        <div className="flex justify-end">
          <AddMaterialButton master={master} />
        </div>
        {dialog.loader.failed ? <DialogFailed /> : null}
        {notice === null ? null : <SavedNotice notice={notice} />}
      </div>
      <MasterSearchBox
        id="material-search"
        label={MATERIAL_SEARCH_LABEL}
        placeholder={MATERIAL_SEARCH_PLACEHOLDER}
        query={list.query}
        onChange={list.setQuery}
        inputRef={search}
      />
      <MaterialResults master={master} onClearFilters={clearFilters} />
      {Dialog === null ? null : (
        <Dialog
          open={dialog.open}
          item={dialog.formItem}
          onClose={() => dialog.setOpen(false)}
          onSaved={(saved, kind) => void master.onSaved(materialSavedNotice(saved.materialInDrawing, kind === 'added' ? 'added' : 'saved'))}
          onCloseAutoFocus={master.onCloseAutoFocus}
        />
      )}
    </div>
  );
}
