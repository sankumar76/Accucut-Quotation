'use client';

import type { FormulaUseRow, ProcessItemRow } from '@/lib/masters/process-items-client';

import type { PageNotice } from './master-texts';
import { BlockedDialog, DeleteDialog } from './process-delete-dialogs';
import { ProcessFormDialog } from './process-form-dialog';
import { ProcessSyncDialog, type SyncRequest } from './process-sync-dialog';
import { choicesSavedNotice, defaultChangedNotice, savedNoticeFor, syncDismissedNotice } from './process-sync-texts';
import { savedNotice } from './process-texts';

/**
 * The dialogs of SCR-11 as one module, so the page fetches them together the first time one is opened and keeps them mounted
 * (AQP-188, NFR-009, architecture section 10): the Radix dialog and the alert dialog are not part of the first load of
 * `/masters/process`. The screen owns which dialog is open and about which rate; this only draws them.
 */

/** Which dialog of SCR-11 is open: the form for Add Rate and Edit, the delete confirmation, the refusal to delete a rate a formula uses, or "Customers differ" after a changed default. */
export type DialogKind = 'add' | 'edit' | 'delete' | 'blocked' | 'sync';

export interface ProcessDialogsProps {
  readonly open: DialogKind | null;
  /** The rate the delete and refusal dialogs are about. */
  readonly target: ProcessItemRow | null;
  /** The rate the add or edit dialog is for (null adds). Kept apart from `target` so the form does not change while it fades out. */
  readonly formItem: ProcessItemRow | null;
  /** The formulas the refusal lists. */
  readonly blockedBy: ReadonlyArray<FormulaUseRow>;
  /** What "Customers differ" is about; kept after it closes so its words do not change while it fades out. */
  readonly sync: SyncRequest | null;
  readonly onClose: () => void;
  /** Called after the server accepted a change, with the notice to show. */
  readonly onSaved: (notice: PageNotice) => void;
  readonly onBlocked: (formulas: ReadonlyArray<FormulaUseRow>) => void;
  /** A save changed the default and some customers hold another value: open "Customers differ" for them (STORY-02.08 AC-2). */
  readonly onDiffer: (request: SyncRequest) => void;
  /** Called when the server said the rate no longer exists (a 404 on a save or a delete). */
  readonly onGone: (item: ProcessItemRow, what: 'edit' | 'delete') => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function ProcessDialogs({ open, target, formItem, blockedBy, sync, onClose, onSaved, onBlocked, onDiffer, onGone, onCloseAutoFocus }: ProcessDialogsProps) {
  return (
    <>
      <ProcessFormDialog
        open={open === 'add' || open === 'edit'}
        item={formItem}
        onClose={onClose}
        onSaved={(saved, kind) => {
          const { propagation } = saved;
          // Customers that hold another value are asked about, in a window of their own; everything else is a notice (AC-1).
          if (kind === 'edited' && propagation !== null && propagation.differing.length > 0) onDiffer({ item: saved, propagation });
          else onSaved(savedNoticeFor(saved, kind));
        }}
        onGone={(item) => onGone(item, 'edit')}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <DeleteDialog
        open={open === 'delete'}
        item={target}
        onClose={onClose}
        onDeleted={(item) => onSaved(savedNotice(item.name, 'deleted'))}
        onBlocked={onBlocked}
        onGone={(item) => onGone(item, 'delete')}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <ProcessSyncDialog
        open={open === 'sync'}
        request={sync}
        onDismiss={(request) => onSaved(syncDismissedNotice(request))}
        onSaved={(counts, request) => onSaved(choicesSavedNotice(request, counts))}
        onDefaultChanged={(request) => onSaved(defaultChangedNotice(request))}
        onGone={(item) => onGone(item, 'edit')}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <BlockedDialog open={open === 'blocked'} item={target} formulas={blockedBy} onClose={onClose} onCloseAutoFocus={onCloseAutoFocus} />
    </>
  );
}
