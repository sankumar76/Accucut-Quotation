'use client';

import { Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { ErrorSummary } from '@/components/shared/error-summary';
import { FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ASSIGN_FIELD_NAMES, type EngineerOption } from '@/lib/tasks/assign';

import { AssignFields } from './assign-fields';
import { ASSIGN_FIELD_IDS } from './assign-form-model';
import {
  ASSIGN_ANOTHER,
  ASSIGN_ANOTHER_HINT,
  ASSIGN_DESCRIPTION,
  ASSIGN_TITLE,
  assignedTitle,
  BREADCRUMB_LABEL,
  CANCEL_ASSIGN,
  FAILED_ASSIGN_BODY,
  FAILED_ASSIGN_TITLE,
  FOLDER_HELP_BODY,
  FOLDER_HELP_LABEL,
  FOLDER_LABEL,
  NEXT_STEPS,
  NEXT_TITLE,
  QUEUE_LINK_LABEL,
  SUBMITTING_ASSIGN,
  SUBMIT_ASSIGN,
  summaryTitle,
} from './assign-texts';
import { useAssignForm } from './use-assign-form';

/**
 * SCR-04 "Assign task" (STORY-04.01 AC-1, AC-3, AC-4, AC-7): the form, the error summary, the success notice and the "What happens next" card, which sits
 * below the form on a phone and a tablet. It lays out the page and hands everything else to `useAssignForm`. It decides nothing: every rule (the UNC path,
 * a deadline later than now, an active Engineer) is the server's, and this screen puts the server's reason under the control it names.
 */

export interface AssignScreenProps {
  readonly engineers: ReadonlyArray<EngineerOption>;
}

function Breadcrumb() {
  return (
    <nav aria-label={BREADCRUMB_LABEL} className="flex flex-wrap items-center gap-s-2 text-body">
      <Link href="/queue" className="text-primary-ink underline-offset-2 hover:underline">
        {QUEUE_LINK_LABEL}
      </Link>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span aria-current="page" className="font-semibold text-ink">
        {ASSIGN_TITLE}
      </span>
    </nav>
  );
}

function NextCard() {
  return (
    <Card aria-labelledby="assign-next-title" className="self-start">
      <CardHeader>
        <CardTitle id="assign-next-title">{NEXT_TITLE}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-s-4">
        <ol className="list-decimal pl-s-5 text-body">
          {NEXT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <hr className="border-border" />
        <div className="flex flex-col gap-s-2">
          <span className="text-label font-semibold text-ink-2 uppercase">{FOLDER_HELP_LABEL}</span>
          <p className="text-body">{FOLDER_HELP_BODY}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssignScreen({ engineers }: AssignScreenProps) {
  const form = useAssignForm();
  const success = useRef<HTMLDivElement>(null);
  const { assigned } = form;

  // A task was assigned: the notice takes focus, so a keyboard user hears it and tabs on to the folder link and "Assign another".
  useEffect(() => {
    if (assigned !== null) success.current?.focus();
  }, [assigned]);

  const items = ASSIGN_FIELD_NAMES.flatMap((field) => {
    const message = form.errors[field];
    return message === undefined ? [] : [{ fieldId: ASSIGN_FIELD_IDS[field], message }];
  });

  return (
    <>
      <Breadcrumb />
      <PageHeader title={ASSIGN_TITLE} description={ASSIGN_DESCRIPTION} />
      {assigned === null ? null : (
        <div ref={success} tabIndex={-1} className="outline-none">
          <Notice tone="success" title={assignedTitle(assigned.code, assigned.engineerName)}>
            <div className="mt-s-2 flex flex-col gap-s-3">
              <div className="flex flex-col gap-s-1">
                <span className="text-label font-semibold">{FOLDER_LABEL}</span>
                <FolderPath path={assigned.folderPath} url={assigned.folderUrl} />
              </div>
              <div className="flex flex-wrap items-center gap-s-3">
                <Button variant="secondary" onClick={form.assignAnother}>
                  {ASSIGN_ANOTHER}
                </Button>
                <span>{ASSIGN_ANOTHER_HINT}</span>
              </div>
            </div>
          </Notice>
        </div>
      )}
      <ErrorSummary title={summaryTitle(items.length)} items={items} />
      {form.failed ? (
        <Notice tone="danger" title={FAILED_ASSIGN_TITLE}>
          {FAILED_ASSIGN_BODY}
        </Notice>
      ) : null}
      <div className="grid gap-s-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form noValidate aria-label={ASSIGN_TITLE} onSubmit={(event) => void form.submit(event)}>
          <Card>
            <CardContent className="flex flex-col gap-s-4">
              <AssignFields values={form.values} errors={form.errors} engineers={engineers} onChange={form.setValue} />
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="secondary" asChild>
                <Link href="/queue">{CANCEL_ASSIGN}</Link>
              </Button>
              <Button type="submit" loading={form.submitting}>
                {form.submitting ? null : <Icon icon={Send} />}
                {form.submitting ? SUBMITTING_ASSIGN : SUBMIT_ASSIGN}
              </Button>
            </CardFooter>
          </Card>
        </form>
        <NextCard />
      </div>
    </>
  );
}
