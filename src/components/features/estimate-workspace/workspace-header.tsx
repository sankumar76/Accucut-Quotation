import type { ReactNode } from 'react';

import { DuePill } from '@/components/shared/due-pill';
import { PageHead } from '@/components/shared/page-head';
import { StatusBadge } from '@/components/shared/status-badge';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

import { FORM_INTRO } from './estimate-texts';

/**
 * The top of SCR-05 (STORY-05.01 AC-1; UX-15; CR-01 item 6; AQP-452, DEF-095): the page head (a breadcrumb "My tasks / code", "Estimate <code>" with its status badge, the title and the sentence of the form under it, and
 * the due pill), then the notice and the cards it is handed. The customer, its short name, the subject and the folder are `TaskCards`, a server module (read-only, as labelled text: they are set when the task is
 * assigned and an Engineer cannot change them). It holds no state. SCR-06 has its own head, a server module in the review folder (`ReviewHead`), so none of its code is in this client bundle (NFR-009).
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
  /**
   * The notice of an ignored estimate (CR-01 item 7D, AQP-401 AC-8; UX 12944 sections 2 and 4), directly under the page header and above the identity and folder cards, with the task's notes. SCR-05 hands in th
   * server-rendered notice as an element, so it is drawn at first paint and adds no client code.
   */
  readonly notice?: ReactNode;
  /** The customer and folder cards, **server-rendered** and handed in as an element (`TaskCards`), so their code is not in the client bundle (NFR-009; the ceiling of PRD 0.58). */
  readonly cards?: ReactNode;
}

export function WorkspaceHeader({ view, notice, cards }: WorkspaceHeaderProps) {
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
      {cards}
    </>
  );
}
