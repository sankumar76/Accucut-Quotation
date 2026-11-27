import 'server-only';

import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FolderPath } from '@/components/shared/folder-path';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { NO_CUSTOMER_SET_MESSAGE } from '@/lib/estimate/calculate-words';

import {
  CUSTOMER_NAME_LABEL,
  CUSTOMER_SHORT_NAME_LABEL,
  FOLDER_TITLE,
  IDENTITY_LABEL,
  NO_LINK_NOTE,
  NOTES_FROM_PREFIX,
  SHORT_NAME_NOT_SET,
  SUBJECT_LABEL,
} from './estimate-texts';
import type { WorkspaceHeaderView } from './workspace-header';

/** One labelled value of the identity card: the label is visible text, the value is text (not a disabled input). */
function Identity({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-s-1">
      <dt className="text-label font-semibold text-ink-2">{label}</dt>
      <dd className={cn('text-body text-ink', BREAK_LONG_NAMES)}>{children}</dd>
    </div>
  );
}

/**
 * SCR-05's customer and folder cards, as they were (the compact card of C-05-04 is DEF-096's). **A server module** (`server-only`): the page draws it and hands it to the client workspace as an element (`cards`), as it
 * does the ignored notice, so its code and words are not in the estimate page's first load (NFR-009; the ceiling of PRD 0.58). They hold nothing that changes while the Engineer works.
 */
export function TaskCards({ view, noCustomerText = NO_CUSTOMER_SET_MESSAGE }: { readonly view: WorkspaceHeaderView; readonly noCustomerText?: string }) {
  return (
    <>
      <Card aria-label={IDENTITY_LABEL}>
        <CardContent>
          <dl className="grid gap-s-4 sm:grid-cols-3">
            <Identity label={CUSTOMER_NAME_LABEL}>{view.customer === null ? noCustomerText : view.customer.name}</Identity>
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
