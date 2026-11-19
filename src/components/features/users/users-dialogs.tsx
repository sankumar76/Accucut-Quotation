'use client';

import type { UserRow } from '@/lib/users/users-client';

import { DeactivateDialog } from './deactivate-dialog';
import { HandOverDialog } from './hand-over-dialog';
import type { DialogKind } from './opener';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UserFormDialog } from './user-form-dialog';

/**
 * The four dialogs of SCR-14 (add or edit, reset password, deactivate, hand over the Admin role) as one module, so the page fetches them together the first time one is opened and keeps them
 * mounted (AQP-188, NFR-009, architecture section 10): the Radix dialog, the role list and the password field are not part
 * of the first load of `/users`. The screen owns which dialog is open and about whom; this only draws them.
 */

export interface UsersDialogsProps {
  readonly open: DialogKind | null;
  /** The person the reset and deactivate dialogs are about. */
  readonly target: UserRow | null;
  /** The person the add or edit dialog is for (null adds). */
  readonly formUser: UserRow | null;
  readonly currentUserId: string;
  /** The people who may receive the Admin role (active, not the signed-in Admin), for the hand-over dialog. */
  readonly handOverCandidates: ReadonlyArray<UserRow>;
  /** The Admin role was handed over: the signed-in Admin's session has ended. */
  readonly onHandedOver: () => void;
  /** The hand-over was refused because the chosen person is no longer a choice: read the list again. */
  readonly onStaleChoice: () => void;
  readonly onClose: () => void;
  /** Called after the server accepted a change, with the sentence to show. */
  readonly onSaved: (text: string) => void;
  readonly onAdminTaken: (currentAdminName: string | null) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function UsersDialogs({
  open,
  target,
  formUser,
  currentUserId,
  handOverCandidates,
  onHandedOver,
  onStaleChoice,
  onClose,
  onSaved,
  onAdminTaken,
  onCloseAutoFocus,
}: UsersDialogsProps) {
  return (
    <>
      <UserFormDialog
        open={open === 'add' || open === 'edit'}
        user={formUser}
        isOwnRow={formUser?.id === currentUserId}
        onClose={onClose}
        onSaved={(person, kind) => onSaved(kind === 'added' ? `${person.name} was added.` : `${person.name} was saved.`)}
        onAdminTaken={onAdminTaken}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <ResetPasswordDialog
        open={open === 'reset'}
        user={target}
        onClose={onClose}
        onReset={(person) => onSaved(`Password set for ${person.name}. They must choose a new one at their next sign-in.`)}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <DeactivateDialog
        open={open === 'deactivate'}
        user={target}
        onClose={onClose}
        onDeactivated={(person) => onSaved(`${person.name} was deactivated and can no longer sign in.`)}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <HandOverDialog
        open={open === 'handover'}
        onOpenChange={(next) => (next ? undefined : onClose())}
        candidates={handOverCandidates}
        onHandedOver={onHandedOver}
        onStale={onStaleChoice}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </>
  );
}
