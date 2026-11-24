import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateWorkspace } from '@/components/features/estimate-workspace/estimate-workspace';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

/**
 * QLT-C-02 of the final review (FR-102, FR-110; UX spec SCR-05 state Approved, SCR-06 Quoted): the Engineer's page names a locked estimate with the word of its own status, in the notice and in the badge.
 * A Quoted estimate is "Quoted and locked." and never "Approved". A static render, as `estimate-workspace-region.test.ts`; every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const header = (status: EstimateStatus): WorkspaceHeaderView => ({
  code: 'Q-2026-0318',
  status,
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\invented-server\invented-share\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  subject: 'Invented subject',
  customer: { name: 'Invented Customer', shortName: 'INV' },
  notes: null,
  assignedByName: 'Invented Lead',
});

const render = (status: EstimateStatus): string => renderToStaticMarkup(createElement(EstimateWorkspace, { header: header(status), estimateId: '00000000-0000-4000-8000-000000000001' }));

const CLOSED_BODY = 'This estimate is closed and the task has moved to Closed. Inputs cannot be changed.';

describe('QLT-C-02: the locked notice on the Engineer\'s page says the status the estimate has', () => {
  it('a Quoted estimate: "Quoted and locked." and the closed sentence, and the word Approved nowhere on the page', () => {
    const html = render('QUOTED');
    expect(html).toContain('Quoted and locked.');
    expect(html).toContain(CLOSED_BODY);
    expect(html).not.toContain('Approved');
  });

  it('an Approved estimate keeps "Approved and locked." and says nothing of Quoted', () => {
    const html = render('APPROVED');
    expect(html).toContain('Approved and locked.');
    expect(html).toContain(CLOSED_BODY);
    expect(html).not.toContain('Quoted');
  });

  it.each(['DRAFT', 'PREPARED'] as const)('a %s estimate has no locked notice', (status) => {
    const html = render(status);
    expect(html).not.toContain('and locked.');
    expect(html).not.toContain(CLOSED_BODY);
  });
});
