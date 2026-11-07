'use client';

import type { FormulaUseRow, ProcessItemRow } from '@/lib/masters/process-items-client';

import { BlockedDialog, DeleteDialog } from './process-delete-dialogs';
import { ProcessFormDialog } from './process-form-dialog';
import type { DialogKind } from './process-opener';
import { savedNotice, type PageNotice } from './process-texts';

/**
 * The dialogs of SCR-11 as one module, so the page fetches them together the first time one is opened and keeps them mounted
 * (AQP-188, NFR-009, architecture section 10): the Radix dialog and the alert dialog are not part of the first load of
 * `/masters/process`. The screen owns which dialog is open and about which rate; this only draws them.
 */

export interface ProcessDialogsProps {
  readonly open: DialogKind | null;
  /** The rate the delete and refusal dialogs are about. */
  readonly target: ProcessItemRow | null;
  /** The rate the add or edit dialog is for (null adds). Kept apart from `target` so the form does not change while it fades out. */
  readonly formItem: ProcessItemRow | null;
  /** The formulas the refusal lists. */
  readonly blockedBy: ReadonlyArray<FormulaUseRow>;
  readonly onClose: () => void;
  /** Called after the server accepted a change, with the notice to show. */
  readonly onSaved: (notice: PageNotice) => void;
  readonly onBlocked: (formulas: ReadonlyArray<FormulaUseRow>) => void;
  /** Called when the server said the rate no longer exists (a 404 on a save or a delete). */
  readonly onGone: (item: ProcessItemRow, what: 'edit' | 'delete') => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function ProcessDialogs({ open, target, formItem, blockedBy, onClose, onSaved, onBlocked, onGone, onCloseAutoFocus }: ProcessDialogsProps) {
  return (
    <>
      <ProcessFormDialog
        open={open === 'add' || open === 'edit'}
        item={formItem}
        onClose={onClose}
        onSaved={(saved, kind) => onSaved(savedNotice(saved.name, kind === 'added' ? 'added' : 'saved'))}
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
      <BlockedDialog open={open === 'blocked'} item={target} formulas={blockedBy} onClose={onClose} onCloseAutoFocus={onCloseAutoFocus} />
    </>
  );
}
