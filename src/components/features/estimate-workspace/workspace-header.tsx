import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { DuePill } from '@/components/shared/due-pill';
import { FolderPath } from '@/components/shared/folder-path';
import { PageHead } from '@/components/shared/page-head';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { NO_CUSTOMER_SET_MESSAGE } from '@/lib/estimate/calculate-words';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

import {
  CUSTOMER_NAME_LABEL,
  CUSTOMER_SHORT_NAME_LABEL,
  FOLDER_TITLE,
  FORM_INTRO,
  IDENTITY_LABEL,
  NO_LINK_NOTE,
  NOTES_FROM_PREFIX,
  SHORT_NAME_NOT_SET,
  SUBJECT_LABEL,
} from './estimate-texts';

/**
 * The top of SCR-05 (STORY-05.01 AC-1; UX-15; CR-01 item 6; AQP-452, DEF-095): the page head (a breadcrumb "My tasks / code", "Estimate <code>" with its status badge, the title and the sentence of the form under it, and
 * the due pill) and the identity of the task: the customer, its short name and the subject (read-only, as labelled text: they are set when the task is assigned and an Engineer cannot change them), the folder and the
 * notes typed when the task was assigned. It holds no state. SCR-06 has its own head, a server module in the review folder (`ReviewHead`), so none of its code is in this client bundle (NFR-009).
 */

export interface WorkspaceHeaderView {
  readonly code: string;
  readonly status: EstimateStatus;
  /** The deadline written in IST, for example "12 Nov 2026, 17:00 IST". */
  readonly deadlineLabel: string;
  readonly folderPath: string;
  /** The `file:` link the server built; null for a path it would not link. */
  readonly folderUrl: string | null;
  readonly title: string;
  /** The project name (CR-01 item 6). */
  readonly subject: string;
  /** The customer's name and short name, or null for an estimate made before CR-01 that has none. */
  readonly customer: { readonly name: string; readonly shortName: string } | null;
  readonly notes: string | null;
  readonly assignedByName: string;
  /** The Ignored layer is set over the status (CR-01 item 7D): the badge says "Ignored" whatever the status underneath. Absent is not ignored. */
  readonly ignored?: boolean;
}

export interface WorkspaceHeaderProps {
  readonly view: WorkspaceHeaderView;
  /** What the name field says while there is no customer: the Engineer's neutral sentence by default. */
  readonly noCustomerText?: string;
  /**
   * The notice of an ignored estimate (CR-01 item 7D, AQP-401 AC-8; UX 12944 sections 2 and 4), directly under the page header and above the identity and folder cards, with the task's notes. SCR-05 hands in th
   * server-rendered notice as an element, so it is drawn at first paint and adds no client code.
   */
  readonly notice?: ReactNode;
}

/** One labelled value of the identity card: the label is visible text, the value is text (not a disabled input). */
function Identity({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-s-1">
      <dt className="text-label font-semibold text-ink-2">{label}</dt>
      <dd className={cn('text-body text-ink', BREAK_LONG_NAMES)}>{children}</dd>
    </div>
  );
}

export function WorkspaceHeader({ view, noCustomerText = NO_CUSTOMER_SET_MESSAGE, notice }: WorkspaceHeaderProps) {
  return (
    <>
      <PageHead
        crumbs={[{ label: 'My tasks', href: '/queue' }, { label: view.code }]}
        title={`Estimate ${view.code}`}
        badges={<StatusBadge status={view.ignored === true ? 'IGNORED' : view.status} variant="header" />}
        description={`${view.title} · ${FORM_INTRO}`}
        actions={<DuePill label={view.deadlineLabel} />}
      />
      {notice}
      <TaskCards view={view} noCustomerText={noCustomerText} />
    </>
  );
}

/** SCR-05's customer and folder cards, as they were (the compact card of C-05-04 is DEF-096's). */
function TaskCards({ view, noCustomerText }: { readonly view: WorkspaceHeaderView; readonly noCustomerText: string }) {
  return (
    <>
      <Card aria-label={IDENTITY_LABEL}>
        <CardContent>
          <dl className="grid gap-s-4 sm:grid-cols-3">
            <Identity label={CUSTOMER_NAME_LABEL}>
              {view.customer === null ? noCustomerText : view.customer.name}
            </Identity>
            <Identity label={CUSTOMER_SHORT_NAME_LABEL}>{view.customer === null ? SHORT_NAME_NOT_SET : <span className="font-mono">{view.customer.shortName}</span>}</Identity>
            <Identity label={SUBJECT_LABEL}>{view.subject}</Identity>
          </dl>
        </CardContent>
      </Card>
      <Card aria-labelledby="estimate-folder-title">
        <CardHeader>
          <CardTitle id="estimate-folder-title">{FOLDER_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-s-3">
          {view.folderUrl === null ? (
            <div className="flex flex-col gap-s-1">
              <span className={cn('font-mono text-body', BREAK_LONG_NAMES)}>{view.folderPath}</span>
              <span className="text-label text-ink-2">{NO_LINK_NOTE}</span>
            </div>
          ) : (
            <FolderPath path={view.folderPath} url={view.folderUrl} />
          )}
          {view.notes === null ? null : (
            <p className={cn('text-body whitespace-pre-wrap', BREAK_LONG_NAMES)}>
              <strong>{`${NOTES_FROM_PREFIX} ${view.assignedByName}: `}</strong>
              {view.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
