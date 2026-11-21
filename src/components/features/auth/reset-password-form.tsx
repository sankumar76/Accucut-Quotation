'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { ErrorSummary, PasswordField, type SummaryEntry } from '@/components/features/account/change-password-parts';
import { Notice } from '@/components/shared/notice';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { PASSWORD_RULE_HINT } from '@/lib/auth/password-rule';
import { RESET_DONE_BODY, RESET_DONE_TITLE, RESET_FAILED_BODY, RESET_FAILED_TITLE, resetPasswordProblems, type ResetPasswordField, type ResetPasswordProblems } from '@/lib/auth/password-reset';
import { SIGN_IN_PATH } from '@/lib/auth/return-path';
import { resetPasswordWithLink, resetResultOf } from '@/lib/auth/reset-client';

import { InvalidLinkNotice } from './invalid-link-notice';

/**
 * The reset page of SCR-02 (STORY-09.07 AC-5, AC-6, AC-8): New password and Repeat. The form collects and shows; the server decides (the link, the rule, the e-mail). The shape of the rule that
 * needs no list and "the two match" are checked on submit (UX spec section 6.0), and the server's message for a rule that fails is put under New password. After a refusal focus goes to the first
 * field with a message and a summary above the form links to each one; the fields keep what was typed (WCAG 3.3.7) and are emptied only on success. Paste is never blocked and `autocomplete` is
 * `new-password`. The token is a prop from the page, sent in the body of the request; it is never shown, stored in the browser or put in the address by this code.
 *
 * Three ends: `done` (the password was changed: a notice and a way to sign in, since no session is issued), `invalid` (the link was used or expired between the page and the post: the page's
 * state for a dead link) and `failed` (no usable answer: the change may or may not have been saved, so the sentence is true either way).
 */

export interface ResetPasswordFormProps {
  /** The token of the link, read from the address by the page. */
  readonly token: string;
}

const FIELD_ORDER: ReadonlyArray<ResetPasswordField> = ['newPassword', 'repeatPassword'];
const EMPTY_VALUES = { newPassword: '', repeatPassword: '' };

type End = 'done' | 'invalid' | 'failed';

function summaryOf(problems: ResetPasswordProblems): ReadonlyArray<SummaryEntry> {
  return FIELD_ORDER.flatMap((field) => {
    const message = problems[field];
    return message === undefined ? [] : [{ field, message }];
  });
}

function withoutProblem(problems: ResetPasswordProblems, field: ResetPasswordField): ResetPasswordProblems {
  return Object.fromEntries(Object.entries(problems).filter(([name]) => name !== field));
}

function EndNotice({ end }: { readonly end: End }) {
  if (end === 'invalid') return <InvalidLinkNotice />;
  if (end === 'done') {
    return (
      <>
        <Notice tone="success" title={RESET_DONE_TITLE}>
          {RESET_DONE_BODY}
        </Notice>
        <Link href={SIGN_IN_PATH} className="font-semibold text-primary-ink underline underline-offset-2">
          Sign in
        </Link>
      </>
    );
  }
  return (
    <Notice tone="danger" title={RESET_FAILED_TITLE}>
      {RESET_FAILED_BODY}
    </Notice>
  );
}

// Over 40 lines on purpose (coding standards section 1): one form owns its state, its refs and its submit, as `ChangePasswordForm` does.
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [problems, setProblems] = useState<ResetPasswordProblems>({});
  const [summary, setSummary] = useState<ReadonlyArray<SummaryEntry>>([]);
  const [end, setEnd] = useState<End | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const newRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const refs: Readonly<Record<ResetPasswordField, RefObject<HTMLInputElement | null>>> = { newPassword: newRef, repeatPassword: repeatRef };

  // The notice of an end takes focus once it is in the page, so it is read and seen.
  useEffect(() => {
    if (end !== null && end !== 'invalid') noticeRef.current?.focus();
  }, [end]);

  const focusField = (field: ResetPasswordField): void => refs[field].current?.focus();
  const showProblems = useFocusOnRefusal(FIELD_ORDER, focusField, (next) => {
    setProblems(next);
    setSummary(summaryOf(next));
  });

  const set = (field: ResetPasswordField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setProblems((current) => withoutProblem(current, field));
    setEnd(null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setEnd(null);
    const found = resetPasswordProblems(values);
    showProblems(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = resetResultOf(await resetPasswordWithLink(token, values.newPassword));
    setSubmitting(false);
    if (result.kind === 'fields') return showProblems(result.problems);
    if (result.kind === 'done') {
      setValues(EMPTY_VALUES);
      setSummary([]);
    }
    setEnd(result.kind);
  }

  const finished = end === 'done' || end === 'invalid';
  const field = (name: ResetPasswordField, label: string, extra: { hint?: string } = {}) => (
    <PasswordField field={name} label={label} autoComplete="new-password" value={values[name]} onValue={set(name)} inputRef={refs[name]} error={problems[name]} {...extra} />
  );

  return (
    <div className="flex flex-col gap-s-4">
      {/* The wrapper takes focus; the notice inside announces itself (role="status" or "alert"). */}
      <div ref={noticeRef} tabIndex={-1} className="flex flex-col gap-s-4 outline-none empty:hidden">
        {end === null ? null : <EndNotice end={end} />}
      </div>
      {summary.length === 0 || finished ? null : <ErrorSummary entries={summary} onFocusField={(name) => name !== 'currentPassword' && focusField(name)} />}
      {finished ? null : (
        <Card>
          <form noValidate aria-label="Choose a new password" onSubmit={(event) => void onSubmit(event)}>
            <CardContent className="flex flex-col gap-s-4">
              {field('newPassword', 'New password', { hint: PASSWORD_RULE_HINT })}
              {field('repeatPassword', 'Repeat new password')}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" loading={submitting}>
                {submitting ? 'Changing password' : 'Change password'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
