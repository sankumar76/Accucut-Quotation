import 'server-only';

import { FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { DuePill } from '@/components/shared/due-pill';
import { FolderPath } from '@/components/shared/folder-path';
import { FOLDER_LINK_NOTE } from '@/components/shared/folder-path-texts';
import { Icon } from '@/components/shared/icon';
import { PageHead } from '@/components/shared/page-head';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

import { NOTES_FROM_PREFIX } from '../estimate-workspace/estimate-texts';
import type { WorkspaceHeaderView } from '../estimate-workspace/workspace-header';

import { OPEN_FOLDER_LABEL, SUBJECT_META_PREFIX } from './review-head-texts';

export interface ReviewHeadProps {
  readonly view: WorkspaceHeaderView;
  /** Who entered the estimate (the task's assignee). */
  readonly engineerName: string;
  /** What the customer's place says while there is none ("Not set"). */
  readonly noCustomerText: string;
  /** Change customer, drawn inside the meta line after the customer (a Lead's or an Admin's; absent while the estimate is locked or ignored). */
  readonly customerAction: ReactNode;
  /** The download marker chip, drawn after the status badge (STORY-CR01.7E AC-5). */
  readonly downloadMarker: ReactNode;
  /** The ignored estimate's notice, directly under the head. */
  readonly notice: ReactNode;
}

/** SCR-06's one meta line (the mock-up): the title, the subject, the customer with its short name and the way to change it, who entered the estimate and who assigned the task. */
function MetaLine({ view, engineerName, noCustomerText, customerAction }: Pick<ReviewHeadProps, 'view' | 'engineerName' | 'noCustomerText' | 'customerAction'>) {
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

/** The notes from the Lead who assigned the task, in a card of their own under the head; nothing when there are none. */
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

/**
 * The head of SCR-06 (AQP-452, DEF-110; UX spec SCR-06, the mock-up): a breadcrumb "Task queue / code", "Estimate code" with the status badge and the download marker, the one meta line, and at the right the due pill,
 * Open folder and Copy path; the notes below. **A server module** (`server-only`, in the review folder): the Engineer's workspace is a client component and draws its own head (`WorkspaceHeader`), so none of
 * this code or its words is in the estimate page's first load (NFR-009; the ceiling of PRD 0.58). Lead and Admin only: the customer is a name and a short name and nothing else (NFR-002).
 */
export function ReviewHead({ view, engineerName, noCustomerText, customerAction, downloadMarker, notice }: ReviewHeadProps) {
  return (
    <>
      <PageHead
        crumbs={[{ label: 'Task queue', href: '/queue' }, { label: view.code }]}
        title={`Estimate ${view.code}`}
        badges={
          <>
            <StatusBadge status={view.ignored === true ? 'IGNORED' : view.status} variant="header" />
            {downloadMarker}
          </>
        }
        description={<MetaLine view={view} engineerName={engineerName} noCustomerText={noCustomerText} customerAction={customerAction} />}
        actions={
          <div className="flex flex-wrap items-center gap-s-3">
            <DuePill label={view.deadlineLabel} />
            {view.folderUrl === null ? null : (
              <Button asChild variant="secondary">
                <a href={view.folderUrl} title={FOLDER_LINK_NOTE}>
                  <Icon icon={FolderOpen} />
                  {OPEN_FOLDER_LABEL}
                </a>
              </Button>
            )}
            <FolderPath path={view.folderPath} url={view.folderUrl ?? ''} copyOnly />
          </div>
        }
      />
      {notice}
      <NotesCard view={view} />
    </>
  );
}
