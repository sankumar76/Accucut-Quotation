import 'server-only';

import { Building2, FolderOpen, Lock, StickyNote, Tag } from 'lucide-react';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FolderPath } from '@/components/shared/folder-path';
import { FOLDER_LINK_NOTE } from '@/components/shared/folder-path-texts';
import { Icon } from '@/components/shared/icon';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { NO_CUSTOMER_SET_MESSAGE } from '@/lib/estimate/calculate-words';

import { NOTES_FROM_PREFIX } from './estimate-texts';
import { CUSTOMER_LABEL, customerLockLine, FOLDER_TITLE, NO_LINK_NOTE, SUBJECT_LABEL } from './task-cards-texts';
import type { WorkspaceHeaderView } from './workspace-header';

/** One row of the card: its parts wrap on a narrow screen and sit on a line from a tablet; a hairline separates it from the row above (the mock-up's `card-body row`). */
function TaskRow({ name, first = false, children }: { readonly name: string; readonly first?: boolean; readonly children: ReactNode }) {
  return (
    <div data-task-row={name} className={cn('flex flex-wrap items-center gap-x-s-4 gap-y-s-2 px-s-4 py-s-3', first ? null : 'border-t border-border')}>
      {children}
    </div>
  );
}

/** A small capital label with its icon, as the mock-up draws it ("TASK FOLDER", "CUSTOMER"). */
function RowLabel({ icon, children }: { readonly icon: Parameters<typeof Icon>[0]['icon']; readonly children: ReactNode }) {
  return (
    <span className="flex items-center gap-s-2 text-label font-semibold tracking-[0.06em] text-ink-2 uppercase">
      <Icon icon={icon} size="small" />
      {children}
    </span>
  );
}

/**
 * SCR-05's customer, subject, folder and notes (AQP-453, DEF-096; UX spec SCR-05, the mock-up `SCR-05.html`, CR-01 items 1 and 6): **one compact card of three rows**. Row 1, the task folder: the path as a link in mono,
 * Copy path, and the note on links a browser may block. Row 2, the customer with its short name, the subject, and the line that says who set the customer and that only a Lead or Admin can change it. Row 3, the notes
 * from the Lead who assigned the task (left out when there are none). All of it is read-only text (an Engineer cannot change any of it). **A server module** (\`server-only\`): the page draws it and hands it to the client
 * workspace as an element (\`cards\`), so its code and words are not in the estimate page's first load (NFR-009; the ceiling of PRD 0.65).
 */
export function TaskCards({ view, noCustomerText = NO_CUSTOMER_SET_MESSAGE }: { readonly view: WorkspaceHeaderView; readonly noCustomerText?: string }) {
  return (
    <Card>
      <TaskRow name="folder" first>
        <RowLabel icon={FolderOpen}>{FOLDER_TITLE}</RowLabel>
        {view.folderUrl === null ? (
          <>
            <span className={cn('min-w-0 font-mono text-body text-ink', BREAK_LONG_NAMES)}>{view.folderPath}</span>
            <FolderPath path={view.folderPath} url="" copyOnly />
            <span className="min-w-0 flex-[1_1_16rem] text-label text-ink-2">{NO_LINK_NOTE}</span>
          </>
        ) : (
          <>
            <a href={view.folderUrl} title={FOLDER_LINK_NOTE} className={cn('min-w-0 font-mono text-body text-primary-ink underline-offset-2 hover:underline', BREAK_LONG_NAMES)}>
              {view.folderPath}
            </a>
            <FolderPath path={view.folderPath} url={view.folderUrl} copyOnly />
            <span className="min-w-0 flex-[1_1_16rem] text-label text-ink-2">{FOLDER_LINK_NOTE}</span>
          </>
        )}
      </TaskRow>
      <TaskRow name="customer">
        <RowLabel icon={Building2}>{CUSTOMER_LABEL}</RowLabel>
        <span className={cn('min-w-0 text-body font-semibold text-ink', BREAK_LONG_NAMES)}>
          {view.customer === null ? (
            noCustomerText
          ) : (
            <>
              {view.customer.name} <span className="font-mono font-normal text-ink-2">({view.customer.shortName})</span>
            </>
          )}
        </span>
        <RowLabel icon={Tag}>{SUBJECT_LABEL}</RowLabel>
        <span className={cn('min-w-0 text-body font-semibold text-ink', BREAK_LONG_NAMES)}>{view.subject}</span>
        <span className="flex min-w-0 flex-[1_1_14rem] items-center gap-s-2 text-label text-ink-2">
          <Icon icon={Lock} size="small" className="shrink-0" />
          {customerLockLine(view.assignedByName)}
        </span>
      </TaskRow>
      {view.notes === null ? null : (
        <TaskRow name="notes">
          <RowLabel icon={StickyNote}>{`${NOTES_FROM_PREFIX} ${view.assignedByName}`}</RowLabel>
          <span className={cn('min-w-0 flex-[1_1_18rem] text-body whitespace-pre-wrap text-ink', BREAK_LONG_NAMES)}>{view.notes}</span>
        </TaskRow>
      )}
    </Card>
  );
}
