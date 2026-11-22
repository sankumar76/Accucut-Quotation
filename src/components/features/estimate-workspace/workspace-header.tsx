import { CalendarClock } from 'lucide-react';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { NO_CUSTOMER_SET_MESSAGE } from '@/lib/estimate/calculate-words';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

import { CUSTOMER_NAME_LABEL, CUSTOMER_SHORT_NAME_LABEL, FOLDER_TITLE, IDENTITY_LABEL, NO_LINK_NOTE, NOTES_FROM_PREFIX, SHORT_NAME_NOT_SET, SUBJECT_LABEL } from './estimate-texts';

/**
 * The top of SCR-05 and of SCR-06 (STORY-05.01 AC-1; UX-15; CR-01 item 6): the task code, its status, the deadline, the customer, its short name and the subject (read-only, as labelled text, for every
 * role: they are set when the task is assigned and an Engineer cannot change them), the folder and the notes typed when the task was assigned. It holds no state and needs no script of its own; the folder's
 * "Copy path" is `FolderPath`. The customer is a name and a short name and nothing else (NFR-002), so it is the same for every role that may open the task. SCR-06 passes a Change customer action to sit beside
 * the name (`customerAction`); SCR-05 passes none, so an Engineer has no control to change it.
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
}

export interface WorkspaceHeaderProps {
  readonly view: WorkspaceHeaderView;
  /** What the name field says while there is no customer: the Engineer's neutral sentence by default, "Not set" on SCR-06. */
  readonly noCustomerText?: string;
  /** SCR-06's Change customer action, drawn beside the customer's name. */
  readonly customerAction?: ReactNode;
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

export function WorkspaceHeader({ view, noCustomerText = NO_CUSTOMER_SET_MESSAGE, customerAction }: WorkspaceHeaderProps) {
  return (
    <>
      <PageHeader
        title={view.code}
        description={view.title}
        actions={
          <div className="flex flex-wrap items-center gap-s-3">
            <StatusBadge status={view.status} variant="header" />
            <span className="inline-flex items-center gap-s-1 text-body font-semibold text-ink">
              <Icon icon={CalendarClock} size="small" />
              {`Due ${view.deadlineLabel}`}
            </span>
          </div>
        }
      />
      <Card aria-label={IDENTITY_LABEL}>
        <CardContent>
          <dl className="grid gap-s-4 sm:grid-cols-3">
            <Identity label={CUSTOMER_NAME_LABEL}>
              <span className="inline-flex flex-wrap items-center gap-s-2">
                <span>{view.customer === null ? noCustomerText : view.customer.name}</span>
                {customerAction}
              </span>
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
