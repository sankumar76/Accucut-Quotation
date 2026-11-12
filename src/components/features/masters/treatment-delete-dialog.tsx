'use client';

import { useState } from 'react';

import { Notice } from '@/components/shared/notice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteTreatment, type TreatmentRow } from '@/lib/masters/treatments-client';

import { BREAK_LONG_NAMES } from './master-texts';
import {
  DELETE_CONFIRM_TREATMENT,
  DELETE_KEEP_TREATMENT,
  DELETING_TREATMENT,
  deleteTreatmentDescription,
  deleteTreatmentTitle,
  FAILED_DELETE_TREATMENT_MESSAGE,
  FAILED_WRITE_BODY,
} from './treatment-texts';

/**
 * The alert dialog of the delete on SCR-13's Treatment / Color tab (STORY-02.05 AC-4, AC-8): the confirmation of a treatment. It is an alert
 * dialog, because the action takes something away; focus starts on the safe choice ("Keep treatment"), and Escape closes it with nothing sent. The
 * request stays out until the server has answered, and the dialog closes then. A 404 (the treatment was deleted elsewhere) is the screen's. A
 * failed delete keeps the dialog open with the sentence for a write with nothing typed, which never says "Nothing was changed." (ux-spec v0.21,
 * section 6.0).
 */

export interface TreatmentDeleteDialogProps {
  readonly open: boolean;
  readonly item: TreatmentRow | null;
  readonly onClose: () => void;
  /** Called after the server deleted the treatment. */
  readonly onDeleted: (item: TreatmentRow) => void;
  /** Called when the server said the treatment no longer exists. */
  readonly onGone: (item: TreatmentRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The request of the confirmation and what it left: it is out, or it failed in a way the person can try again. */
function useDeleteRequest({ onDeleted, onGone }: Pick<TreatmentDeleteDialogProps, 'onDeleted' | 'onGone'>) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove(target: TreatmentRow): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const outcome = await deleteTreatment(target.id);
    setSubmitting(false);
    if (outcome.status === 'ok') return onDeleted(target);
    if (outcome.status === 'refused' && outcome.httpStatus === 404) return onGone(target);
    setFailed(true);
  }

  return { submitting, failed, clearFailure: () => setFailed(false), remove };
}

function DeleteBody({ item, request }: { readonly item: TreatmentRow; readonly request: ReturnType<typeof useDeleteRequest> }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{deleteTreatmentTitle(item.name)}</AlertDialogTitle>
        <AlertDialogDescription className={BREAK_LONG_NAMES}>{deleteTreatmentDescription(item.name)}</AlertDialogDescription>
      </AlertDialogHeader>
      {request.failed ? (
        <Notice tone="danger" title={FAILED_DELETE_TREATMENT_MESSAGE}>
          {FAILED_WRITE_BODY}
        </Notice>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>{DELETE_KEEP_TREATMENT}</AlertDialogCancel>
        <AlertDialogAction
          disabled={request.submitting}
          aria-busy={request.submitting || undefined}
          onClick={(event) => {
            // Stay open while the request is out: the dialog closes when the server has answered, not before.
            event.preventDefault();
            void request.remove(item);
          }}
        >
          {request.submitting ? DELETING_TREATMENT : DELETE_CONFIRM_TREATMENT}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export function TreatmentDeleteDialog({ open, item, onClose, onCloseAutoFocus, ...handlers }: TreatmentDeleteDialogProps) {
  const request = useDeleteRequest(handlers);
  const onOpenChange = (next: boolean): void => {
    if (next) return;
    request.clearFailure();
    onClose();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>{item === null ? null : <DeleteBody item={item} request={request} />}</AlertDialogContent>
    </AlertDialog>
  );
}
