'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { REQUEST_FAILED_BODY, REQUEST_FAILED_TITLE } from '@/lib/auth/password-reset';
import { SIGN_IN_PATH } from '@/lib/auth/return-path';
import { forgotResultOf, requestResetLink, type ForgotResult } from '@/lib/auth/reset-client';
import { emailProblem } from '@/lib/auth/sign-in-validation';

/**
 * The request page of SCR-02 (STORY-09.07 AC-1 to AC-4): one field, "Send reset link". The answer is the one fixed sentence whoever was asked about (the server never says whether the address
 * is registered), so the screen cannot either. After it the form gives way to the sentence and a way back to sign-in. A request refused for too many tries shows the server's words; a
 * malformed address (checked here first, then by the server) stays under the field with what was typed; no answer at all shows the failure notice. The notice takes focus when it appears.
 */

const BACK_TO_SIGN_IN = 'Back to sign in';
const LINK_CLASSES = 'font-semibold text-primary-ink underline underline-offset-2';

type Shown = Exclude<ForgotResult, { readonly kind: 'field' }>;

function ResultNotice({ result }: { readonly result: Shown }) {
  if (result.kind === 'sent') return <Notice tone="success">{result.message}</Notice>;
  if (result.kind === 'blocked') return <Notice tone="danger">{result.message}</Notice>;
  return (
    <Notice tone="danger" title={REQUEST_FAILED_TITLE}>
      {REQUEST_FAILED_BODY}
    </Notice>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shown !== null) noticeRef.current?.focus();
  }, [shown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const problem = emailProblem(email);
    setEmailError(problem);
    setShown(null);
    if (problem !== null) return emailRef.current?.focus();

    setSubmitting(true);
    const result = forgotResultOf(await requestResetLink(email.trim()));
    setSubmitting(false);
    if (result.kind === 'field') {
      setEmailError(result.message);
      emailRef.current?.focus();
      return;
    }
    setShown(result);
  }

  return (
    <div className="flex flex-col gap-s-4">
      {/* The wrapper takes focus; the notice inside announces itself (role="status" or "alert"). */}
      <div ref={noticeRef} tabIndex={-1} className="flex flex-col gap-s-4 outline-none empty:hidden">
        {shown === null ? null : <ResultNotice result={shown} />}
      </div>
      {shown?.kind === 'sent' ? (
        <p>
          <Link href={SIGN_IN_PATH} className={LINK_CLASSES}>
            {BACK_TO_SIGN_IN}
          </Link>
        </p>
      ) : (
        <Card>
          <CardContent>
            <form noValidate aria-label="Request a reset link" onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-s-4">
              <FormField id="email" label="E-mail" {...(emailError === null ? {} : { error: emailError })}>
                {(control) => (
                  <Input
                    {...control}
                    ref={emailRef}
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError(null);
                    }}
                  />
                )}
              </FormField>
              <Button type="submit" loading={submitting} className="w-full">
                {submitting ? 'Sending' : 'Send reset link'}
              </Button>
              <p>
                <Link href={SIGN_IN_PATH} className={LINK_CLASSES}>
                  {BACK_TO_SIGN_IN}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
