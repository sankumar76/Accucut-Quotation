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
import { updateUser, type UserRow } from '@/lib/users/users-client';

import { FAILED_DEACTIVATE_MESSAGE, TRY_AGAIN_BODY } from './texts';

/**
 * The "Deactivate" confirmation of SCR-14 (STORY-01.04 AC-1, AC-7): an alert dialog, because the action takes something away
 * and asks first. Focus starts on "Keep active", the safe choice; Escape closes it with nothing sent. The wording is the UX
 * spec's. Deactivating ends the person's sessions; their tasks and estimates stay (the server only flips the flag).
 */

export interface DeactivateDialogProps {
  readonly open: boolean;
  readonly user: UserRow | null;
  readonly onClose: () => void;
  /** Called after the server deactivated the person. */
  readonly onDeactivated: (user: UserRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function DeactivateDialog({ open, user, onClose, onDeactivated, onCloseAutoFocus }: DeactivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function deactivate(target: UserRow): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const outcome = await updateUser(target.id, { isActive: false });
    setSubmitting(false);
    if (outcome.status === 'ok') return onDeactivated(target);
    setFailed(true);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setFailed(false);
        onClose();
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {user === null ? null : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {user.name} can no longer sign in. Their tasks and estimates stay as they are. You can activate them again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {failed ? (
              <Notice tone="danger" title={FAILED_DEACTIVATE_MESSAGE}>
                {TRY_AGAIN_BODY}
              </Notice>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep active</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                aria-busy={submitting || undefined}
                onClick={(event) => {
                  // Stay open while the request is out: the dialog closes when the server has answered, not before.
                  event.preventDefault();
                  void deactivate(user);
                }}
              >
                {submitting ? 'Deactivating' : 'Deactivate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
