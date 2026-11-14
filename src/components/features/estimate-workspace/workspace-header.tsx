import { CalendarClock } from 'lucide-react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

import { FOLDER_TITLE, NO_LINK_NOTE, NOTES_FROM_PREFIX } from './estimate-texts';

/**
 * The top of SCR-05 and of the short header a Lead or an Admin sees until SCR-06 (STORY-05.01 AC-1; UX-15): the task code, its status, the deadline, the folder
 * and the notes typed when the task was assigned. It holds no state and needs no script of its own; the folder's "Copy path" is `FolderPath`. Everything on it
 * is the task's own: nothing here depends on the customer, so it is the same for every role that may open the task.
 */

export interface WorkspaceHeaderView {
  readonly code: string;
  readonly status: EstimateStatus;
  /** The deadline written in IST, for example "12 Nov 2026, 17:00 IST". */
  readonly deadlineLabel: string;
  readonly folderPath: string;
  /** The `file:` link the server built; null for a path it would not link. */
  readonly folderUrl: string | null;
  readonly title: string | null;
  readonly notes: string | null;
  readonly assignedByName: string;
}

export function WorkspaceHeader({ view }: { readonly view: WorkspaceHeaderView }) {
  return (
    <>
      <PageHeader
        title={view.code}
        {...(view.title === null ? {} : { description: view.title })}
        actions={
          <div className="flex flex-wrap items-center gap-s-3">
            <StatusBadge status={view.status} />
            <span className="inline-flex items-center gap-s-1 text-body font-semibold text-ink">
              <Icon icon={CalendarClock} size="small" />
              {`Due ${view.deadlineLabel}`}
            </span>
          </div>
        }
      />
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
