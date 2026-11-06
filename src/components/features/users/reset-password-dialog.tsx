'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resetUserPassword, type UserRow } from '@/lib/users/users-client';
import { newPasswordProblem } from '@/lib/users/validation';

import { FAILED_RESET_MESSAGE, RESET_PASSWORD_HINT, TRY_AGAIN_BODY } from './texts';

/**
 * The "Reset password" dialog of SCR-14 (STORY-01.04 AC-5, AC-7): a new, temporary password for one person. The old one stops
 * working at once and the person must choose their own at their next sign-in (FR-004); the server does that, this dialog only
 * sends the new password and shows the answer. The password is not kept after the dialog closes.
 */

export interface ResetPasswordDialogProps {
  readonly open: boolean;
  readonly user: UserRow | null;
  readonly onClose: () => void;
  /** Called after the server accepted the new password. */
  readonly onReset: (user: UserRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export function ResetPasswordDialog({ open, user, onClose, onReset, onCloseAutoFocus }: ResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        {user === null ? null : <ResetForm user={user} onReset={onReset} />}
      </DialogContent>
    </Dialog>
  );
}

function ResetForm({ user, onReset }: { readonly user: UserRow; readonly onReset: (user: UserRow) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error !== null) inputRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const problem = newPasswordProblem(password);
    setError(problem);
    setFailed(false);
    if (problem !== null) return;

    setSubmitting(true);
    const outcome = await resetUserPassword(user.id, password);
    setSubmitting(false);
    if (outcome.status === 'ok') return onReset(user);
    if (outcome.status === 'refused' && outcome.fields['password'] !== undefined) return setError(outcome.fields['password']);
    setFailed(true);
  }

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>Reset password for {user.name}</DialogTitle>
      </DialogHeader>
      {failed ? (
        <Notice tone="danger" title={FAILED_RESET_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <FormField id="reset-password" label="New password" hint={RESET_PASSWORD_HINT} {...(error === null ? {} : { error })}>
        {(control) => (
          <PasswordInput
            {...control}
            ref={inputRef}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={submitting}>
          {submitting ? 'Setting password' : 'Set password'}
        </Button>
      </DialogFooter>
    </form>
  );
}
