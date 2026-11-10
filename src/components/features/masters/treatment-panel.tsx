'use client';

import { Plus, RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

import { BREAK_LONG_NAMES, ERROR_RETRY } from './process-texts';
import { TreatmentDeleteDialog } from './treatment-delete-dialog';
import { TreatmentFormDialog } from './treatment-form-dialog';
import { TreatmentList } from './treatment-list';
import {
  ADD_TREATMENT,
  TREATMENT_ERROR_TITLE,
  TREATMENT_LOADING_LABEL,
  TREATMENT_SAVED_NOT_SHOWN_BODY,
  treatmentNotice,
} from './treatment-texts';
import { useTreatments, type TreatmentsState } from './use-treatments';

/**
 * The Treatment / Color tab of SCR-13 (STORY-02.05 AC-1, AC-4, AC-8). It lays out the tab and hands everything else to `useTreatments`: the list,
 * the add / rename / delete dialogs and the notice above the table. It decides nothing: every rule (a name that is free and not kept by the
 * system, the locked "Other" entry, the audit entry) is the server's, and this screen puts the server's reason where the person can read it.
 * After a change it asks the server for the list again, so the order on screen is the server's.
 *
 * It is not in the first load of the page (NFR-009, PRF-01): the tab fetches this file, dialogs included, the first time it is opened
 * (`MastersScreen`), and the panel then reads its data from `GET /api/v1/treatments`. There is deliberately no `loading.tsx` beside the page (TD-06).
 */

/** The panel takes no props: it reads its own data when the tab first opens. */
export type TreatmentPanelProps = Record<string, never>;

function AddTreatmentButton({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <Button data-action="add" onClick={onAdd}>
      <Icon icon={Plus} />
      {ADD_TREATMENT}
    </Button>
  );
}

/** The notice above the table: a status, not an alert, because nothing failed. */
function Notices({ state }: { readonly state: TreatmentsState }) {
  const { notice } = state;
  if (notice === null) return null;
  return (
    <Notice tone={notice.tone} role="status" className={BREAK_LONG_NAMES} {...(notice.title === undefined ? {} : { title: notice.title })}>
      {notice.text}
    </Notice>
  );
}

/** The load error. While a success notice is on the page its sentence says the change happened, so it never reads "Nothing was changed" under "X was added.". */
function LoadError({ onRetry, saved }: { readonly onRetry: () => void; readonly saved: boolean }) {
  return (
    <ErrorState
      title={TREATMENT_ERROR_TITLE}
      {...(saved ? { description: TREATMENT_SAVED_NOT_SHOWN_BODY } : {})}
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

const SKELETON_ROWS = 4;

/** What the tab shows below the notices: the error with "Try again", the skeleton, or the list. */
function Body({ state }: { readonly state: TreatmentsState }) {
  const { items, status, showSkeleton, notice } = state;
  if (status === 'error') return <LoadError onRetry={state.retry} saved={notice?.tone === 'success'} />;
  // The first read has no list to keep on screen: the skeleton appears after 300 ms. A later read keeps the list until 300 ms have passed.
  if (items === null) return <SkeletonBlock rows={SKELETON_ROWS} label={TREATMENT_LOADING_LABEL} />;
  if (showSkeleton) return <SkeletonBlock rows={SKELETON_ROWS} delayMs={0} label={TREATMENT_LOADING_LABEL} />;
  return <TreatmentList items={items} onAction={state.onRowAction} />;
}

/** The three dialogs. They are part of this panel's code, which the tab fetches on its first opening, so they are not in the first load of the page. */
function Dialogs({ state }: { readonly state: TreatmentsState }) {
  const { dialog } = state;
  const close = (): void => dialog.setOpen(null);
  return (
    <>
      <TreatmentFormDialog
        open={dialog.open === 'add' || dialog.open === 'rename'}
        item={dialog.formItem}
        onClose={close}
        onSaved={(saved, kind) => void state.onSaved(treatmentNotice(kind, saved.name))}
        onGone={(item) => state.onGone(item, 'rename')}
        onCloseAutoFocus={state.onCloseAutoFocus}
      />
      <TreatmentDeleteDialog
        open={dialog.open === 'delete'}
        item={dialog.target}
        onClose={close}
        onDeleted={(item) => void state.onSaved(treatmentNotice('deleted', item.name))}
        onGone={(item) => state.onGone(item, 'delete')}
        onCloseAutoFocus={state.onCloseAutoFocus}
      />
    </>
  );
}

export function TreatmentPanel() {
  const state = useTreatments();
  return (
    <div aria-busy={state.status === 'loading' || undefined} className="flex flex-col">
      <div className="flex flex-col gap-s-3 p-s-4 md:px-s-5">
        <div className="flex justify-end">
          <AddTreatmentButton onAdd={state.onAdd} />
        </div>
        <Notices state={state} />
      </div>
      <Body state={state} />
      <Dialogs state={state} />
    </div>
  );
}
