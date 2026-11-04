'use client';

import { Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { safeReturnPath } from '@/lib/auth/return-path';
import { emailProblem, passwordProblem } from '@/lib/auth/sign-in-validation';

/**
 * SCR-01 "Sign in" (STORY-01.01 AC-1, AC-2, AC-3, AC-6, AC-8; UX spec section 6, UJ-01). The form only collects the
 * two fields and shows the server's answer. Who may sign in, how often and what the cookie holds are decided on the
 * server (`src/server/auth`); nothing here is an authorisation check.
 *
 * States: default, loading ("Signing in", button disabled), error, locked, and "could not be checked" for a
 * failure that is neither (the database is down). A failed attempt keeps both fields as typed and moves focus to the
 * notice (CR-32, UX spec: it "clears nothing").
 */

const ERROR_TITLE = 'E-mail or password is not correct.';
const ERROR_BODY = 'Check both and try again.';
const LOCKED_BODY = 'Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password.';
const UNAVAILABLE_TITLE = 'We could not sign you in.';
const UNAVAILABLE_BODY = 'Check your connection and try again. Nothing was changed.';

/** The codes the sign-in route returns in `error` (`src/server/auth/options.ts`). */
const LOCKED_CODE = 'locked';
const UNAVAILABLE_CODE = 'unavailable';

type Failure = 'invalid' | 'locked' | 'unavailable';

export interface SignInFormProps {
  /** Where to go afterwards: already checked on the server, and checked again here before it is used. */
  readonly returnTo: string;
}

function failureFor(error: string | null | undefined): Failure {
  if (error === LOCKED_CODE) return 'locked';
  if (error === UNAVAILABLE_CODE) return 'unavailable';
  return 'invalid';
}

function FailureNotice({ failure }: { readonly failure: Failure }) {
  if (failure === 'locked') return <Notice tone="danger">{LOCKED_BODY}</Notice>;
  if (failure === 'unavailable') return <Notice tone="danger" title={UNAVAILABLE_TITLE}>{UNAVAILABLE_BODY}</Notice>;
  return (
    <Notice tone="danger" title={ERROR_TITLE}>
      {ERROR_BODY}
    </Notice>
  );
}

export function SignInForm({ returnTo }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordShown, setPasswordShown] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Focus moves to the notice when a failure appears (SCR-01 "Interactions"), once the notice is in the page.
  useEffect(() => {
    if (failure !== null) noticeRef.current?.focus();
  }, [failure]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const nextEmailError = emailProblem(email);
    const nextPasswordError = passwordProblem(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError !== null) return emailRef.current?.focus();
    if (nextPasswordError !== null) return passwordRef.current?.focus();

    setSubmitting(true);
    setFailure(null);
    try {
      const result = await signIn('credentials', { redirect: false, email: email.trim(), password });
      if (result?.ok === true && !result.error) {
        // Stay in the loading state until the next page replaces this one.
        router.replace(safeReturnPath(returnTo));
        return;
      }
      setFailure(result === undefined ? 'unavailable' : failureFor(result.error));
    } catch {
      setFailure('unavailable');
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-s-4">
      {/* The wrapper takes focus; the notice inside announces itself (role="alert"). */}
      <div ref={noticeRef} tabIndex={-1} className="outline-none">
        {failure === null ? null : <FailureNotice failure={failure} />}
      </div>
      <Card>
        <CardContent>
          <form noValidate aria-label="Sign in" onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-s-4">
            <FormField id="email" label="E-mail" {...(emailError === null ? {} : { error: emailError })}>
              {(control) => (
                <Input
                  {...control}
                  ref={emailRef}
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setEmailError(email === '' ? null : emailProblem(email))}
                />
              )}
            </FormField>
            <FormField id="password" label="Password" {...(passwordError === null ? {} : { error: passwordError })}>
              {(control) => (
                <div className="flex gap-s-2">
                  <Input
                    {...control}
                    ref={passwordRef}
                    name="password"
                    type={passwordShown ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="shrink-0"
                    aria-pressed={passwordShown}
                    aria-label={passwordShown ? 'Hide password' : 'Show password'}
                    onClick={() => setPasswordShown((shown) => !shown)}
                  >
                    <Icon icon={passwordShown ? EyeOff : Eye} size="large" />
                  </Button>
                </div>
              )}
            </FormField>
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
            <p className="text-ink-2">Forgot your password? Ask the Admin to reset it.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
