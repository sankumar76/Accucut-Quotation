'use client';

import { Lock, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ErrorSummary } from '@/components/shared/error-summary';
import { FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { EngineerOption } from '@/lib/tasks/assign';

import { DeadlineFields, EngineerField } from './assign-fields';
import { ASSIGN_FIELD_IDS } from './assign-form-model';
import { BREADCRUMB_LABEL, QUEUE_LINK_LABEL } from './assign-texts';
import { engineerOptionsFor, type ReassignTaskData } from './reassign-form-model';
import {
  BACK_TO_QUEUE,
  CANCEL_REASSIGN,
  CLOSED_BODY,
  CLOSED_TITLE,
  IGNORED_BODY,
  IGNORED_TITLE,
  FAILED_REASSIGN_BODY,
  FAILED_REASSIGN_TITLE,
  FOLDER_LOCKED_LABEL,
  LOCKED_TAG,
  LOG_NOTICE,
  NONE_WRITTEN,
  NOTES_LOCKED_LABEL,
  NOTHING_CHANGED_BODY,
  NOTHING_CHANGED_TITLE,
  reassignedTitle,
  reassignSummaryTitle,
  REASSIGN_DESCRIPTION,
  REASSIGN_TITLE,
  SUBMIT_REASSIGN,
  SUBMITTING_REASSIGN,
  TITLE_LOCKED_LABEL,
} from './reassign-texts';
import { useReassignForm } from './use-reassign-form';

/**
 * The edit mode of SCR-04, "Reassign or change deadline" (STORY-04.07 AC-2, AC-3, AC-6): the same page and the same two controls as assigning (the Engineer, and the deadline as a
 * date and a time in IST), for one open task, filled with what it holds. The folder, the title and the notes show their value and the word "Locked" (an icon and the word, never
 * colour alone); the notice says what the log keeps. It lays out the page and hands everything else to `useReassignForm`. It decides nothing: every rule is the server's, and this screen
 * puts the server's reason under the control it names. A closed task (approved, A-14) shows the reason and no form.
 */

export interface ReassignScreenProps {
  readonly task: ReassignTaskData;
  /** The active Engineers: what the Engineer control offers. */
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
        {REASSIGN_TITLE}
      </span>
    </nav>
  );
}

/** A value the form does not change: its label, the word "Locked" with an icon, and what the task holds. */
function LockedField({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-s-1">
      <div className="flex flex-wrap items-center gap-s-2">
        <span className="text-label font-semibold text-ink-2">{label}</span>
        <Badge>
          <Icon icon={Lock} size="hint" />
          {LOCKED_TAG}
        </Badge>
      </div>
      <div className={cn('text-body text-ink', BREAK_LONG_NAMES)}>{children}</div>
    </div>
  );
}

function LockedFields({ task }: { readonly task: ReassignTaskData }) {
  return (
    <>
      <LockedField label={FOLDER_LOCKED_LABEL}>
        {task.folderUrl === null ? <span className="font-mono">{task.folderPath}</span> : <FolderPath path={task.folderPath} url={task.folderUrl} />}
      </LockedField>
      <LockedField label={TITLE_LOCKED_LABEL}>{task.title ?? <span className="text-ink-2">{NONE_WRITTEN}</span>}</LockedField>
      <LockedField label={NOTES_LOCKED_LABEL}>{task.notes ?? <span className="text-ink-2">{NONE_WRITTEN}</span>}</LockedField>
    </>
  );
}

/** The form is replaced by the reason it cannot be used: the task is approved (closed), or it is ignored and read-only until it is restored (CR-01 item 7D). */
function ClosedView({ task, ignored }: { readonly task: ReassignTaskData; readonly ignored: boolean }) {
  return (
    <>
      <Breadcrumb />
      <PageHeader title={REASSIGN_TITLE} description={`Task ${task.code}`} />
      <Notice tone="danger" title={ignored ? IGNORED_TITLE : CLOSED_TITLE}>
        <p>{ignored ? IGNORED_BODY : CLOSED_BODY}</p>
        <div className="mt-s-3">
          <Button variant="secondary" asChild>
            <Link href="/queue">{BACK_TO_QUEUE}</Link>
          </Button>
        </div>
      </Notice>
    </>
  );
}

export function ReassignScreen({ task, engineers }: ReassignScreenProps) {
  const form = useReassignForm(task);
  const success = useRef<HTMLDivElement>(null);
  const { done } = form;

  // A change was saved: the notice takes focus, so a keyboard user hears it and tabs on to the link back to the queue.
  useEffect(() => {
    if (done !== null) success.current?.focus();
  }, [done]);

  if (form.ignored || form.closed) return <ClosedView task={task} ignored={form.ignored} />;

  const items = (['engineerId', 'deadline'] as const).flatMap((field) => {
    const message = form.errors[field];
    return message === undefined ? [] : [{ fieldId: ASSIGN_FIELD_IDS[field], message }];
  });

  return (
    <>
      <Breadcrumb />
      <PageHeader title={REASSIGN_TITLE} description={REASSIGN_DESCRIPTION} />
      <Notice tone="info">{LOG_NOTICE}</Notice>
      {done === null ? null : (
        <div ref={success} tabIndex={-1} className="outline-none">
          <Notice tone="success" title={reassignedTitle(done.code, done.engineerName, new Date(done.deadlineAt))}>
            <div className="mt-s-2">
              <Button variant="secondary" asChild>
                <Link href="/queue">{BACK_TO_QUEUE}</Link>
              </Button>
            </div>
          </Notice>
        </div>
      )}
      <ErrorSummary title={reassignSummaryTitle(items.length)} items={items} />
      {form.unchanged ? (
        <Notice tone="warn" title={NOTHING_CHANGED_TITLE}>
          {NOTHING_CHANGED_BODY}
        </Notice>
      ) : null}
      {form.failed ? (
        <Notice tone="danger" title={FAILED_REASSIGN_TITLE}>
          {FAILED_REASSIGN_BODY}
        </Notice>
      ) : null}
      <form noValidate aria-label={REASSIGN_TITLE} onSubmit={(event) => void form.submit(event)}>
        <Card>
          <CardHeader>
            <CardTitle>{`Task ${task.code}`}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-s-4">
            <EngineerField values={form.values} errors={form.errors} engineers={engineerOptionsFor({ engineer: form.held.engineer }, engineers)} onChange={form.setValue} />
            <DeadlineFields values={form.values} errors={form.errors} engineers={engineers} onChange={form.setValue} />
            <LockedFields task={task} />
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="secondary" asChild>
              <Link href="/queue">{CANCEL_REASSIGN}</Link>
            </Button>
            <Button type="submit" loading={form.submitting}>
              {form.submitting ? null : <Icon icon={Save} />}
              {form.submitting ? SUBMITTING_REASSIGN : SUBMIT_REASSIGN}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
