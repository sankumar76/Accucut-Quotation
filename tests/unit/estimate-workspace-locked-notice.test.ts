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

const render = (status: EstimateStatus, ignored = false): string =>
  renderToStaticMarkup(createElement(EstimateWorkspace, { header: header(status), estimateId: '00000000-0000-4000-8000-000000000001', userId: 'invented-user', ignored, notice: ignored ? createElement('p', null, 'INVENTED-IGNORED-NOTICE') : undefined }));

const CLOSED_BODY = 'This estimate is closed and the task has moved to Closed. Inputs cannot be changed.';

// DEF-078 (AQP-421; AQP-401 AC-8, UX 12944 section 4): an ignored task shows the Engineer's Ignored notice and no banner of the status underneath ("Prepared ... sent for review", "Approved and locked ... moved to Closed").
describe('DEF-078: every status, with and without the Ignored layer, on the Engineer\'s page', () => {
  const BANNER_WORDS = ['Cost will be calculated', 'and locked.', 'moved to Closed', 'data-calculate-prepared'];

  it.each(['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'] as const)('%s and ignored: the Ignored notice and badge, and no status banner at all', (status) => {
    const html = render(status, true);
    expect(html).toContain('INVENTED-IGNORED-NOTICE');
    expect(html).toContain('data-status="IGNORED"');
    for (const words of BANNER_WORDS) expect(html, words).not.toContain(words);
  });

  it('PREPARED and not ignored keeps its banner, and APPROVED and QUOTED keep their locked notice (the layer is what removes them)', () => {
    expect(render('PREPARED')).toContain('data-calculate-prepared');
    expect(render('PREPARED')).not.toContain('INVENTED-IGNORED-NOTICE');
    expect(render('APPROVED')).toContain('moved to Closed');
    expect(render('QUOTED')).toContain('moved to Closed');
  });

  it('DRAFT and not ignored has no banner', () => {
    const html = render('DRAFT');
    for (const words of BANNER_WORDS) expect(html, words).not.toContain(words);
  });
});

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
