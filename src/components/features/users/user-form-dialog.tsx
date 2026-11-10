'use client';

import { useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { roleLabel } from '@/lib/auth/roles';
import { ADMIN_ALREADY_ACTIVE_CODE } from '@/lib/errors';
import { submitEdit } from '@/lib/users/edit-submit';
import { createUser, updateUser, type Refusal, type UserRow } from '@/lib/users/users-client';
import {
  isUserRole,
  newPasswordProblem,
  nameProblem,
  USER_ROLE_VALUES,
  userEmailProblem,
  type UserRoleValue,
} from '@/lib/users/validation';

import { FAILED_ADD_MESSAGE, FAILED_EDIT_MESSAGE, PASSWORD_HINT, TRY_AGAIN_BODY } from './texts';

/**
 * The "Add user" and "Edit" dialogs of SCR-14 (STORY-01.04 AC-1, AC-3, AC-4, AC-7). Add: name, e-mail, role and the first
 * password. Edit: name and role (the e-mail does not change). The dialog only collects and shows; the server decides. A
 * refusal comes back with its reason and is put under the field it names: a used e-mail under the e-mail, a second Admin
 * under the role, with the current Admin named on the page (the parent shows that notice). Nothing typed is cleared by a
 * refusal. The first focus is the first field, and Escape or Cancel closes it with nothing sent.
 */

export interface UserFormDialogProps {
  readonly open: boolean;
  /** `null` adds a person; a person edits them. */
  readonly user: UserRow | null;
  /** Editing the caller themself: the role cannot change (AC-4). */
  readonly isOwnRow: boolean;
  readonly onClose: () => void;
  /** Called with the saved person after the server accepted the change. */
  readonly onSaved: (saved: UserRow, kind: 'added' | 'edited') => void;
  /** Called when the server refused a second Admin, with the current Admin's name when it gave one. */
  readonly onAdminTaken: (currentAdminName: string | null) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

interface Values {
  readonly name: string;
  readonly email: string;
  readonly role: UserRoleValue;
  readonly password: string;
}

type FieldName = 'name' | 'email' | 'role' | 'password';
type Errors = Readonly<Partial<Record<FieldName, string>>>;

const FIELD_NAMES: ReadonlyArray<FieldName> = ['name', 'email', 'role', 'password'];

function problemsOf(values: Values, adding: boolean): Errors {
  const found: Partial<Record<FieldName, string>> = {};
  const name = nameProblem(values.name);
  if (name !== null) found.name = name;
  if (adding) {
    const email = userEmailProblem(values.email);
    if (email !== null) found.email = email;
    const password = newPasswordProblem(values.password);
    if (password !== null) found.password = password;
  }
  return found;
}

/** The server's messages for the fields this dialog has, and nothing for any other field. */
function serverErrors(refusal: Refusal): Errors {
  const found: Partial<Record<FieldName, string>> = {};
  for (const field of FIELD_NAMES) {
    const message = refusal.fields[field];
    if (message !== undefined) found[field] = message;
  }
  return found;
}

/** The errors without the one for `field`, once the person has changed that field. */
function withoutError(errors: Errors, field: FieldName): Errors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}

function initialValues(user: UserRow | null): Values {
  return user === null ? { name: '', email: '', role: 'ENGINEER', password: '' } : { name: user.name, email: user.email, role: user.role, password: '' };
}

export function UserFormDialog({ open, user, isOwnRow, onClose, onSaved, onAdminTaken, onCloseAutoFocus }: UserFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <UserForm user={user} isOwnRow={isOwnRow} onClose={onClose} onSaved={onSaved} onAdminTaken={onAdminTaken} />
      </DialogContent>
    </Dialog>
  );
}

type FormProps = Pick<UserFormDialogProps, 'user' | 'isOwnRow' | 'onClose' | 'onSaved' | 'onAdminTaken'>;

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts empty. */
function UserForm({ user, isOwnRow, onClose, onSaved, onAdminTaken }: FormProps) {
  const adding = user === null;
  const [values, setValues] = useState<Values>(() => initialValues(user));
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLButtonElement>(null);

  const set = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    showErrors(withoutError(errors, field));
  };

  // After a refusal, focus goes to the first field with a message (SCR-14, UX spec section 6.0 "Forms"), and never while a person types (DEF-026).
  const showErrors = useFocusOnRefusal(
    FIELD_NAMES,
    (field) => ({ name: nameRef, email: emailRef, role: roleRef, password: passwordRef })[field].current?.focus(),
    setErrors,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = problemsOf(values, adding);
    showErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;

    if (!adding) {
      // Nothing changed: close with no request and no message (UX spec v0.14, SCR-14 Edit user; `submitEdit` never calls `save`).
      const result = await submitEdit(user, values, (id, changes) => {
        setSubmitting(true);
        return updateUser(id, changes);
      });
      if (result.kind === 'unchanged') return onClose();
      return finish(result.outcome, 'edited');
    }
    setSubmitting(true);
    return finish(await createUser({ name: values.name.trim(), email: values.email.trim(), role: values.role, password: values.password }), 'added');
  }

  /** Shows the server's answer to an add or an edit. */
  function finish(outcome: Awaited<ReturnType<typeof updateUser>>, kind: 'added' | 'edited'): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value, kind);
    if (outcome.status === 'failed') return setFailed(true);
    if (outcome.code === ADMIN_ALREADY_ACTIVE_CODE) {
      showErrors({ role: outcome.title });
      return onAdminTaken(outcome.currentAdminName);
    }
    const fromServer = serverErrors(outcome);
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>{adding ? 'Add user' : `Edit ${user.name}`}</DialogTitle>
        {adding ? null : <DialogDescription>{user.email}</DialogDescription>}
      </DialogHeader>
      {failed ? (
        <Notice tone="danger" title={adding ? FAILED_ADD_MESSAGE : FAILED_EDIT_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <FormField id="user-name" label="Name" {...(errors.name === undefined ? {} : { error: errors.name })}>
        {(control) => (
          <Input {...control} ref={nameRef} name="name" autoComplete="off" required value={values.name} onChange={(event) => set('name')(event.target.value)} />
        )}
      </FormField>
      {adding ? (
        <FormField id="user-email" label="E-mail (used to sign in)" {...(errors.email === undefined ? {} : { error: errors.email })}>
          {(control) => (
            <Input
              {...control}
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="off"
              inputMode="email"
              required
              placeholder="name@company.com"
              value={values.email}
              onChange={(event) => set('email')(event.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <FormField
        id="user-role"
        label="Role"
        {...(isOwnRow ? { hint: 'You cannot change your own role.' } : {})}
        {...(errors.role === undefined ? {} : { error: errors.role })}
      >
        {(control) => (
          <Select
            name="role"
            value={values.role}
            disabled={isOwnRow}
            onValueChange={(value) => {
              if (isUserRole(value)) set('role')(value);
            }}
          >
            <SelectTrigger {...control} ref={roleRef}>
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLE_VALUES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {adding ? (
        <FormField id="user-password" label="First password" hint={PASSWORD_HINT} {...(errors.password === undefined ? {} : { error: errors.password })}>
          {(control) => (
            <PasswordInput
              {...control}
              ref={passwordRef}
              name="password"
              autoComplete="new-password"
              required
              value={values.password}
              onChange={(event) => set('password')(event.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={submitting}>
          {submitting ? (adding ? 'Adding user' : 'Saving') : adding ? 'Add user' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
