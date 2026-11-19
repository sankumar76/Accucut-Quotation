'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type FormEvent } from 'react';

import { ErrorSummary } from '@/components/shared/error-summary';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { InsertOptions } from '@/lib/config/insert-field-client';
import { insertCount, issueItems, strayMessages } from '@/lib/config/insert-field-form';

import { StepDetails, StepPreview, StepType } from './insert-field-steps';
import {
  BACK_LABEL,
  BACK_TO_FIELDS,
  BREADCRUMB_LABEL,
  CANCEL_LABEL,
  errorSummaryTitle,
  FIELDS_LINK_LABEL,
  insertLabel,
  INSERT_DESCRIPTION,
  INSERT_TITLE,
  NEXT_LABEL,
  PREVIEWING_LABEL,
  PREVIEW_LABEL,
  SAVING_LABEL,
  STALE_ACTION,
  STEP_HEADINGS,
  STEP_NAMES,
  STEPS_LABEL,
  SUCCESS_FOLLOW_UP,
  SUCCESS_TITLE,
} from './insert-field-texts';
import { useInsertWizard, type InsertWizard, type Step } from './use-insert-wizard';

/**
 * SCR-19 "Insert field" (STORY-08.03; FR-074, FR-075; AC-1 to AC-4, AC-7, AC-10): three steps in one card, a polite live region that says the step on each change and the success, errors in a summary whose links go
 * to the controls, and Insert at the end. It is **fetched after the page is up** (`insert-field-screen.tsx`; NFR-009: the route is held to 200 KB of first-load JavaScript). It decides nothing: every rule and
 * every sentence of a refusal is the server's. There is no password step: FR-080 lists only formula save, delete and revert.
 */

export interface InsertFieldWizardProps {
  readonly options: InsertOptions;
  /** The column the address named (`?after=`), when it did. */
  readonly afterId: string | null;
}

const STEP_NUMBERS: ReadonlyArray<Step> = [1, 2, 3];

function Breadcrumb() {
  return (
    <nav aria-label={BREADCRUMB_LABEL} className="flex flex-wrap items-center gap-s-2 text-body">
      <Link href="/config/fields" className="text-primary-ink underline-offset-2 hover:underline">
        {FIELDS_LINK_LABEL}
      </Link>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span aria-current="page" className="font-semibold text-ink">
        {INSERT_TITLE}
      </span>
    </nav>
  );
}

/** The three steps as a list: the one the Admin is on is marked for a screen reader as well as drawn. */
function StepList({ current }: { readonly current: Step }) {
  return (
    <ol aria-label={STEPS_LABEL} className="flex flex-wrap gap-x-s-5 gap-y-s-2">
      {STEP_NUMBERS.map((number) => (
        <li key={number} {...(number === current ? { 'aria-current': 'step' as const } : {})} className={cn('flex items-center gap-s-2 text-body', number === current ? 'font-semibold text-ink' : 'text-ink-3')}>
          <span className={cn('flex h-s-5 w-s-5 items-center justify-center rounded-full border text-label', number === current ? 'border-primary-ink bg-primary-ink text-on-fill' : 'border-border-strong')}>{number}</span>
          {STEP_NAMES[number - 1]}
        </li>
      ))}
    </ol>
  );
}

function WizardNoticeView({ wizard }: { readonly wizard: InsertWizard }) {
  const { notice } = wizard;
  if (notice === null) return null;
  return (
    <Notice tone={notice.tone} role="alert" title={notice.title}>
      {notice.message}
      {notice.stale ? (
        <Button className="mt-s-2" variant="secondary" onClick={() => window.location.reload()}>
          {STALE_ACTION}
        </Button>
      ) : null}
    </Notice>
  );
}

/** The errors of step 2: the summary with a link to each control, and any sentence about the registry as a whole, which has no control. */
function Refusals({ wizard }: { readonly wizard: InsertWizard }) {
  const items = issueItems(wizard.form.kind, wizard.errors);
  return (
    <>
      <ErrorSummary title={errorSummaryTitle(items.length)} items={items.map(({ fieldId, message }) => ({ fieldId, message }))} />
      {strayMessages(wizard.form.kind, wizard.errors).map((message) => (
        <Notice key={message} tone="danger">
          {message}
        </Notice>
      ))}
    </>
  );
}

function Footer({ wizard }: { readonly wizard: InsertWizard }) {
  const { step, busy } = wizard;
  const back = (
    <Button variant="secondary" onClick={wizard.back} disabled={busy !== null}>
      {BACK_LABEL}
    </Button>
  );
  const cancel = (
    <Button variant="secondary" asChild>
      <Link href="/config/fields">{CANCEL_LABEL}</Link>
    </Button>
  );
  if (step === 1) {
    return (
      <CardFooter>
        {cancel}
        <span className="flex-1" />
        <Button type="submit">
          {NEXT_LABEL}
          <Icon icon={ArrowRight} />
        </Button>
      </CardFooter>
    );
  }
  if (step === 2) {
    return (
      <CardFooter>
        {back}
        {cancel}
        <span className="flex-1" />
        <Button type="submit" loading={busy === 'previewing'}>
          {busy === 'previewing' ? PREVIEWING_LABEL : PREVIEW_LABEL}
          {busy === 'previewing' ? null : <Icon icon={ArrowRight} />}
        </Button>
      </CardFooter>
    );
  }
  return (
    <CardFooter>
      {back}
      <span className="flex-1" />
      <Button type="submit" loading={busy === 'saving'}>
        {busy === 'saving' ? null : <Icon icon={Check} />}
        {busy === 'saving' ? SAVING_LABEL : insertLabel(insertCount(wizard.form.kind))}
      </Button>
    </CardFooter>
  );
}

function Saved({ wizard }: { readonly wizard: InsertWizard }) {
  const success = useRef<HTMLDivElement>(null);
  // The insert went through: the notice takes focus, so a keyboard user hears it and tabs on to the link.
  useEffect(() => {
    success.current?.focus();
  }, []);
  return (
    <div ref={success} tabIndex={-1} className="outline-none">
      <Notice tone="success" title={SUCCESS_TITLE}>
        {wizard.saved?.message}
        <span className="mt-s-2 block">{SUCCESS_FOLLOW_UP}</span>
        <span className="mt-s-2 block">
          <Link href="/config/fields" className="font-semibold underline">
            {BACK_TO_FIELDS}
          </Link>
        </span>
      </Notice>
    </div>
  );
}

export function InsertFieldWizard({ options, afterId }: InsertFieldWizardProps) {
  const wizard = useInsertWizard(options, afterId);
  const heading = useRef<HTMLHeadingElement>(null);
  const { headingRequest, step, status, saved, busy } = wizard;

  // Moving between steps puts focus on the new step's heading, so a keyboard user starts at the top of what changed. A refusal that sends the Admin back to step 2 does not count: focus goes to the first refused control.
  useEffect(() => {
    if (headingRequest > 0) heading.current?.focus();
  }, [headingRequest]);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy !== null) return;
    if (step === 1) wizard.next();
    else if (step === 2) void wizard.showPreview();
    else void wizard.save();
  };

  return (
    <>
      <Breadcrumb />
      <PageHeader title={INSERT_TITLE} description={INSERT_DESCRIPTION} />
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
      {saved === null ? (
        <Card>
          <form noValidate aria-label={INSERT_TITLE} onSubmit={onSubmit}>
            <CardHeader>
              <StepList current={step} />
            </CardHeader>
            <CardContent className="flex flex-col gap-s-4">
              <WizardNoticeView wizard={wizard} />
              {step === 2 ? <Refusals wizard={wizard} /> : null}
              <h2 ref={heading} tabIndex={-1} className="text-sub font-semibold text-ink outline-none">
                {`${String(step)} · ${STEP_HEADINGS[step - 1]}`}
              </h2>
              {step === 1 ? <StepType value={wizard.form.kind} onChange={wizard.setKind} /> : null}
              {step === 2 ? <StepDetails wizard={wizard} options={options} /> : null}
              {step === 3 && wizard.preview !== null ? <StepPreview preview={wizard.preview} /> : null}
            </CardContent>
            <Footer wizard={wizard} />
          </form>
        </Card>
      ) : (
        <Saved wizard={wizard} />
      )}
    </>
  );
}
