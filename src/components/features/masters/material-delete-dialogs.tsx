'use client';

import { MATERIAL_IN_USE_CODE } from '@/lib/errors';
import { deleteMaterial } from '@/lib/masters/materials-client';

import { MasterDeleteDialog, MasterInUseDialog, type DeleteConfirmTexts } from './master-delete-dialogs';
import {
  DELETE_CONFIRM_MATERIAL,
  DELETE_KEEP_MATERIAL,
  deleteMaterialDescription,
  deleteMaterialTitle,
  FAILED_DELETE_MATERIAL_MESSAGE,
  FAILED_WRITE_BODY,
} from './material-texts';
import type { DeleteDialogsProps } from './use-master-delete';

/**
 * The two dialogs of the delete on SCR-13's Materials tab as one module (STORY-02.07 AC-3, AC-7), so the page fetches them together the first time a Delete
 * button is pressed and keeps them mounted (AQP-188, NFR-009, architecture section 10). The screen owns which dialog is open and about which material
 * (`useMasterDelete`); this only draws them, in the material's words. The same two components serve the Customers screen.
 */

const CONFIRM_TEXTS: DeleteConfirmTexts = {
  title: deleteMaterialTitle,
  description: deleteMaterialDescription,
  keep: DELETE_KEEP_MATERIAL,
  confirm: DELETE_CONFIRM_MATERIAL,
  failedTitle: FAILED_DELETE_MATERIAL_MESSAGE,
  failedBody: FAILED_WRITE_BODY,
};

export function MaterialDeleteDialogs({ open, target, uses, onClose, onDeleted, onBlocked, onGone, onCloseAutoFocus }: DeleteDialogsProps) {
  return (
    <>
      <MasterDeleteDialog
        open={open === 'delete'}
        target={target}
        texts={CONFIRM_TEXTS}
        remove={(id) => deleteMaterial(id)}
        inUseCode={MATERIAL_IN_USE_CODE}
        onClose={onClose}
        onDeleted={onDeleted}
        onBlocked={onBlocked}
        onGone={onGone}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <MasterInUseDialog open={open === 'blocked'} kind="material" name={target?.name ?? null} uses={uses} onClose={onClose} onCloseAutoFocus={onCloseAutoFocus} />
    </>
  );
}
