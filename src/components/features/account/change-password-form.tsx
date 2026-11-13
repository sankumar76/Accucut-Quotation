'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { changeOwnPassword, resultOf } from '@/lib/auth/account-client';
import { changePasswordProblems, type ChangePasswordField, type ChangePasswordProblems } from '@/lib/auth/change-password';
import { PASSWORD_RULE_HINT } from '@/lib/auth/password-rule';
import { HOME_PATH } from '@/lib/auth/return-path';

import { ErrorSummary, PasswordField, ResultNotice, type ResultKind, type SummaryEntry } from './change-password-parts';

/**
 * The "Change password" form of SCR-23 (STORY-01.05 AC-2, AC-3, AC-5, AC-6, AC-7): current, new and repeat. The form collects and shows;
 * the server decides (the current password, the rule, the attempt limit). The shape, the parts of the rule that need no list and "the new
 * password is the current one" are checked on submit (UX spec section 6.0), and the server's messages are put under the field they name.
 * After a refusal focus goes to the first field with a message and a summary above the form links to each one. Paste is never blocked,
 * `autocomplete` is `current-password` and `new-password`, and each field has a show and hide button. The fields keep what was typed
 * after every refusal and are emptied only after a success (WCAG 3.3.7).
 *
 * On success the server has issued this browser a fresh session. A person who had to set a new password goes to their home with a full
 * page load (so no page from before is left in the router cache); anyone else stays here, the fields are cleared and the notice says so.
 */

export interface ChangePasswordFormProps {
  /** The signed-in person's e-mail address, which the new password must not equal. */
  readonly email: string;
  /** The person is in the "Set a new password" state: they go home after the change. */
  readonly mustChange: boolean;
}

const FIELD_ORDER: ReadonlyArray<ChangePasswordField> = ['currentPassword', 'newPassword', 'repeatPassword'];
const EMPTY_VALUES = { currentPassword: '', newPassword: '', repeatPassword: '' };

interface Shown {
  readonly kind: ResultKind;
  readonly serverTitle?: string;
}

function summaryOf(problems: ChangePasswordProblems): ReadonlyArray<SummaryEntry> {
  return FIELD_ORDER.flatMap((field) => {
    const message = problems[field];
    return message === undefined ? [] : [{ field, message }];
  });
}

function withoutProblem(problems: ChangePasswordProblems, field: ChangePasswordField): ChangePasswordProblems {
  return Object.fromEntries(Object.entries(problems).filter(([name]) => name !== field));
}

// Over 40 lines on purpose (coding standards section 1): one form owns its state, its refs and its submit. The repeated pieces are in
// `change-password-parts.tsx` and the reading of the answer is `resultOf`; what is left is the wiring, as in `UserForm` (SCR-14).
export function ChangePasswordForm({ email, mustChange }: ChangePasswordFormProps) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [problems, setProblems] = useState<ChangePasswordProblems>({});
  const [summary, setSummary] = useState<ReadonlyArray<SummaryEntry>>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const refs: Readonly<Record<ChangePasswordField, RefObject<HTMLInputElement | null>>> = {
    currentPassword: currentRef,
    newPassword: newRef,
    repeatPassword: repeatRef,
  };

  // The notice of a result takes focus once it is in the page (saved, blocked, failed, refused), so it is read and seen.
  useEffect(() => {
    if (shown !== null) noticeRef.current?.focus();
  }, [shown]);

  const focusField = (field: ChangePasswordField): void => refs[field].current?.focus();
  const showProblems = useFocusOnRefusal(FIELD_ORDER, focusField, (next) => {
    setProblems(next);
    setSummary(summaryOf(next));
  });

  const set = (field: ChangePasswordField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setProblems((current) => withoutProblem(current, field));
    setShown(null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setShown(null);
    const found = changePasswordProblems(values, email);
    showProblems(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = resultOf(await changeOwnPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }));
    if (result.kind === 'saved' && mustChange) {
      // Stay in the loading state until the next page replaces this one.
      window.location.assign(HOME_PATH);
      return;
    }
    setSubmitting(false);
    if (result.kind === 'fields') return showProblems(result.problems);
    if (result.kind === 'saved') {
      setValues(EMPTY_VALUES);
      setSummary([]);
    }
    setShown(result.kind === 'refused' ? { kind: 'refused', serverTitle: result.title } : { kind: result.kind });
  }

  const field = (name: ChangePasswordField, label: string, autoComplete: 'current-password' | 'new-password', extra: { hint?: string } = {}) => (
    <PasswordField
      field={name}
      label={label}
      autoComplete={autoComplete}
      value={values[name]}
      onValue={set(name)}
      inputRef={refs[name]}
      error={problems[name]}
      {...extra}
    />
  );

  return (
    <div className="flex flex-col gap-s-4">
      {/* The wrapper takes focus; the notice inside announces itself (role="status" or "alert"). */}
      <div ref={noticeRef} tabIndex={-1} className="flex flex-col gap-s-4 outline-none empty:hidden">
        {shown === null ? null : <ResultNotice kind={shown.kind} {...(shown.serverTitle === undefined ? {} : { serverTitle: shown.serverTitle })} />}
      </div>
      {summary.length === 0 ? null : <ErrorSummary entries={summary} onFocusField={focusField} />}
      <Card>
        <form noValidate aria-label="Change password" onSubmit={(event) => void onSubmit(event)}>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-s-4">
            {field('currentPassword', 'Current password', 'current-password')}
            {field('newPassword', 'New password', 'new-password', { hint: PASSWORD_RULE_HINT })}
            {field('repeatPassword', 'Repeat new password', 'new-password')}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? 'Changing password' : 'Change password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
