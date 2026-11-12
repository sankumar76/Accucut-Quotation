'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { PasswordInput } from '@/components/shared/password-input';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { changeOwnPassword, TOO_MANY_ATTEMPTS_RESPONSE } from '@/lib/auth/account-client';
import { changePasswordProblems, type ChangePasswordField, type ChangePasswordProblems } from '@/lib/auth/change-password';
import { PASSWORD_RULE_HINT } from '@/lib/auth/password-rule';
import { HOME_PATH } from '@/lib/auth/return-path';

import { BLOCKED_BODY, BLOCKED_TITLE, errorSummaryTitle, FAILED_BODY, FAILED_TITLE, SUCCESS_BODY, SUCCESS_TITLE } from './texts';

/**
 * The "Change password" form of SCR-23 (STORY-01.05 AC-2, AC-3, AC-5, AC-6, AC-7): current, new and repeat. The form collects and shows;
 * the server decides (the current password, the rule, the attempt limit). The shape and the parts of the rule that need no list are
 * checked on submit (UX spec section 6.0), and the server's messages are put under the field they name. After a refusal focus goes to the
 * first field with a message and a summary above the form links to each one. Paste is never blocked, `autocomplete` is
 * `current-password` and `new-password`, and each field has a show and hide button.
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
const FIELD_IDS: Readonly<Record<ChangePasswordField, string>> = {
  currentPassword: 'current-password',
  newPassword: 'new-password',
  repeatPassword: 'repeat-password',
};

type Phase = 'idle' | 'saved' | 'blocked' | 'failed';

interface SummaryEntry {
  readonly field: ChangePasswordField;
  readonly message: string;
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

/** The messages of a refusal that name a field of this form. */
function serverProblems(fields: Readonly<Record<string, string>>): ChangePasswordProblems {
  const found: Partial<Record<ChangePasswordField, string>> = {};
  const current = fields['currentPassword'];
  const next = fields['newPassword'];
  if (current !== undefined) found.currentPassword = current;
  if (next !== undefined) found.newPassword = next;
  return found;
}

export function ChangePasswordForm({ email, mustChange }: ChangePasswordFormProps) {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', repeatPassword: '' });
  const [problems, setProblems] = useState<ChangePasswordProblems>({});
  const [summary, setSummary] = useState<ReadonlyArray<SummaryEntry>>([]);
  const [phase, setPhase] = useState<Phase>('idle');
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

  // The notice of a result takes focus once it is in the page (saved, blocked, failed), so it is read and seen.
  useEffect(() => {
    if (phase !== 'idle') noticeRef.current?.focus();
  }, [phase]);

  const focusField = (field: ChangePasswordField): void => refs[field].current?.focus();
  const showProblems = useFocusOnRefusal(FIELD_ORDER, focusField, (next) => {
    setProblems(next);
    setSummary(summaryOf(next));
  });

  const set = (field: ChangePasswordField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setProblems((current) => withoutProblem(current, field));
    setPhase('idle');
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setPhase('idle');
    const found = changePasswordProblems(values, email);
    showProblems(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const outcome = await changeOwnPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    if (outcome.status === 'ok') {
      if (mustChange) {
        // Stay in the loading state until the next page replaces this one.
        window.location.assign(HOME_PATH);
        return;
      }
      setSubmitting(false);
      setValues({ currentPassword: '', newPassword: '', repeatPassword: '' });
      setSummary([]);
      setPhase('saved');
      return;
    }
    setSubmitting(false);
    if (outcome.status === 'refused') {
      if (outcome.code === TOO_MANY_ATTEMPTS_RESPONSE) return setPhase('blocked');
      const fromServer = serverProblems(outcome.fields);
      if (Object.keys(fromServer).length > 0) return showProblems(fromServer);
    }
    setPhase('failed');
  }

  return (
    <div className="flex flex-col gap-s-4">
      {/* The wrapper takes focus; the notice inside announces itself (role="status" or "alert"). */}
      <div ref={noticeRef} tabIndex={-1} className="flex flex-col gap-s-4 outline-none empty:hidden">
        {phase === 'saved' ? (
          <Notice tone="success" title={SUCCESS_TITLE}>
            {SUCCESS_BODY}
          </Notice>
        ) : null}
        {phase === 'blocked' ? (
          <Notice tone="danger" title={BLOCKED_TITLE}>
            {BLOCKED_BODY}
          </Notice>
        ) : null}
        {phase === 'failed' ? (
          <Notice tone="danger" title={FAILED_TITLE}>
            {FAILED_BODY}
          </Notice>
        ) : null}
      </div>
      {summary.length === 0 ? null : (
        <Notice tone="danger" title={errorSummaryTitle(summary.length)}>
          <ul className="list-disc pl-s-4">
            {summary.map(({ field, message }) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  className="underline"
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(field);
                  }}
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </Notice>
      )}
      <Card>
        <form noValidate aria-label="Change password" onSubmit={(event) => void onSubmit(event)}>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-s-4">
            <FormField id={FIELD_IDS.currentPassword} label="Current password" {...(problems.currentPassword === undefined ? {} : { error: problems.currentPassword })}>
              {(control) => (
                <PasswordInput
                  {...control}
                  ref={currentRef}
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  value={values.currentPassword}
                  onChange={(event) => set('currentPassword')(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id={FIELD_IDS.newPassword}
              label="New password"
              hint={PASSWORD_RULE_HINT}
              {...(problems.newPassword === undefined ? {} : { error: problems.newPassword })}
            >
              {(control) => (
                <PasswordInput
                  {...control}
                  ref={newRef}
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  value={values.newPassword}
                  onChange={(event) => set('newPassword')(event.target.value)}
                />
              )}
            </FormField>
            <FormField id={FIELD_IDS.repeatPassword} label="Repeat new password" {...(problems.repeatPassword === undefined ? {} : { error: problems.repeatPassword })}>
              {(control) => (
                <PasswordInput
                  {...control}
                  ref={repeatRef}
                  name="repeatPassword"
                  autoComplete="new-password"
                  required
                  value={values.repeatPassword}
                  onChange={(event) => set('repeatPassword')(event.target.value)}
                />
              )}
            </FormField>
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
