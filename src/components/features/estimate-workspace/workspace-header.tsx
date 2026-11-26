import { CalendarClock, FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FOLDER_LINK_NOTE, FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { PageHead } from '@/components/shared/page-head';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { OPEN_FOLDER_LABEL, SUBJECT_META_PREFIX } from './workspace-head-texts';

/**
 * The top of SCR-05 and of SCR-06 (STORY-05.01 AC-1; UX-15; CR-01 item 6; AQP-452, DEF-095 and DEF-110): the page head (a breadcrumb, "Estimate <code>" with its status badge, a sentence under it and the due pill) and
 * the identity of the task: the customer, its short name and the subject (read-only, as labelled text, for every role: they are set when the task is assigned and an Engineer cannot change them), the folder and the notes
 * typed when the task was assigned. **SCR-05** has the title and the sentence of the form under the title and keeps the customer and folder cards. **SCR-06** (`review`) has one meta line under the title (title, subject,
 * customer with its short name and Change customer, who entered it and who assigned it), Open folder and Copy path beside the due pill, and only the notes below. It holds no state and needs no script of its own; the
 * folder's "Copy path" is `FolderPath` (SCR-05, whole; SCR-06, `copyOnly`). The customer is a name and a short name and nothing else (NFR-002), so it is the same for every role that may open the task. SCR-06 passes a Change customer action to sit among the
 * header actions (`customerAction`); SCR-05 passes none, so an Engineer has no control to change it.
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
  /** What the name field says while there is no customer: the Engineer's neutral sentence by default, "Not set" on SCR-06. */
  readonly noCustomerText?: string;
  /** SCR-06's Change customer action, drawn first among the actions of the page header (at the top of the screen: a control inside the identity card sat under the sticky top bar once the page was scrolled to the end of a short review, and axe read it as a target too small and too close, AQP-390). */
  readonly customerAction?: ReactNode;
  /** SCR-06's download marker chip (STORY-CR01.7E AC-5): drawn after the status, for a Lead and an Admin. SCR-05 passes none, so an Engineer's header has no marker (NFR-002). */
  readonly downloadMarker?: ReactNode;
  /**
   * The notice of an ignored estimate (CR-01 item 7D, AQP-401 AC-8; UX 12944 sections 2 and 4), directly under the page header and above the identity and folder cards, with the task's notes. SCR-05 hands in the Engineer's
   * server-rendered notice as an element, so it is drawn at first paint and adds no client code; SCR-06 hands in the Lead's.
   */
  readonly notice?: ReactNode;
  /**
   * SCR-06's head (a Lead or an Admin): present, it draws the one meta line, Open folder and Copy path in the head, and only the notes below it; absent, the head of SCR-05. `engineerName` is who entered the estimate
   * (the task's assignee).
   */
  readonly review?: { readonly engineerName: string };
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

/** The due pill of the head (the mock-up: a neutral badge with the calendar and "Due <date>"). */
function DuePill({ label }: { readonly label: string }) {
  return (
    <Badge tone="neutral" className="text-body">
      <Icon icon={CalendarClock} size="small" />
      {`Due ${label}`}
    </Badge>
  );
}

/** SCR-06's one meta line (the mock-up): the title, the subject, the customer with its short name and the way to change it, who entered the estimate and who assigned the task. */
function MetaLine({ view, engineerName, noCustomerText, customerAction }: { readonly view: WorkspaceHeaderView; readonly engineerName: string; readonly noCustomerText: string; readonly customerAction: ReactNode }) {
  return (
    <span className={BREAK_LONG_NAMES}>
      {view.title}
      {' · '}
      {`${SUBJECT_META_PREFIX} `}
      <strong className="font-semibold text-ink">{view.subject}</strong>
      {' · '}
      {view.customer === null ? (
        noCustomerText
      ) : (
        <>
          {view.customer.name} <span className="font-mono">({view.customer.shortName})</span>
        </>
      )}{' '}
      {customerAction}
      {' · '}
      {`Entered by ${engineerName}`}
      {' · '}
      {`Assigned by ${view.assignedByName}`}
    </span>
  );
}

export function WorkspaceHeader({ view, noCustomerText = NO_CUSTOMER_SET_MESSAGE, customerAction, downloadMarker, notice, review }: WorkspaceHeaderProps) {
  const crumbs = [{ label: review === undefined ? 'My tasks' : 'Task queue', href: '/queue' }, { label: view.code }];
  return (
    <>
      <PageHead
        crumbs={crumbs}
        title={`Estimate ${view.code}`}
        badges={
          <>
            <StatusBadge status={view.ignored === true ? 'IGNORED' : view.status} variant="header" />
            {downloadMarker}
          </>
        }
        description={
          review === undefined ? (
            `${view.title} · ${FORM_INTRO}`
          ) : (
            <MetaLine view={view} engineerName={review.engineerName} noCustomerText={noCustomerText} customerAction={customerAction} />
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-s-3">
            <DuePill label={view.deadlineLabel} />
            {review === undefined ? null : (
              <>
                {view.folderUrl === null ? null : (
                  <Button asChild variant="secondary">
                    <a href={view.folderUrl} title={FOLDER_LINK_NOTE}>
                      <Icon icon={FolderOpen} />
                      {OPEN_FOLDER_LABEL}
                    </a>
                  </Button>
                )}
                <FolderPath path={view.folderPath} url={view.folderUrl ?? ''} copyOnly />
              </>
            )}
          </div>
        }
      />
      {notice}
      {review === undefined ? <TaskCards view={view} noCustomerText={noCustomerText} /> : <NotesCard view={view} />}
    </>
  );
}

/** SCR-06's notes from the Lead who assigned the task, in a card of their own under the head; nothing when there are none. */
function NotesCard({ view }: { readonly view: WorkspaceHeaderView }) {
  if (view.notes === null) return null;
  return (
    <Card>
      <CardContent>
        <p className={cn('text-body whitespace-pre-wrap', BREAK_LONG_NAMES)}>
          <strong>{`${NOTES_FROM_PREFIX} ${view.assignedByName}: `}</strong>
          {view.notes}
        </p>
      </CardContent>
    </Card>
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
