import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview, type EstimateReviewProps } from '@/components/features/estimate-review/estimate-review';
import { inputsNotice } from '@/components/features/estimate-review/review-texts';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { RoleName } from '@/lib/auth/roles';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import { ADD_MAIN_ASSEMBLY, treeActionsOffered } from '@/lib/estimates/tree-actions';
import type { CostsView } from '@/server/views/schemas/costs';

import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * DEF-131 stage 2T, the parts tree for a Lead and an Admin (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7; ED-18, ED-19, ED-33, ED-36). Which tree the page draws follows `treeActionsOffered(state, role)` and
 * nothing written again in the page: on a Draft and a Prepared estimate that is not ignored the page draws the editing island (its tree and its inputs block are one client component), and on an Approved, a Quoted and an
 * ignored estimate it draws the read-only server tree with its links, **with no toolbar and no "Add main assembly" in the page at all** (not disabled: not there). The words of the three read-only notices end with
 * "or the parts tree." (4.2). Every status, role and ignored flag is written out, so a status added later fails here until someone decides. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const CE1 = QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1');
const STATUSES: ReadonlyArray<EstimateStatus> = ['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'];
const ROLES: ReadonlyArray<RoleName> = ['LEAD', 'ADMIN'];

const HEADER = (status: EstimateStatus): WorkspaceHeaderView => ({
  code: 'Q-2026-0318',
  status,
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  subject: 'Invented subject',
  customer: { name: 'Invented Customer', shortName: 'INV' },
  notes: null,
  assignedByName: 'Invented Lead',
});

async function costsFor(): Promise<CostsView> {
  if (CE1 === undefined) throw new Error('the invented case CE-1 is missing');
  const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl });
  return world.service.getCosts({ id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' }, REVIEW_ESTIMATE_ID);
}

async function render(status: EstimateStatus, role: RoleName, ignored: boolean): Promise<string> {
  const costs = await costsFor();
  const props: EstimateReviewProps = {
    header: HEADER(status),
    estimateId: REVIEW_ESTIMATE_ID,
    customer: { id: 'c1', name: 'Invented Customer', shortName: 'INV' },
    costs,
    calculatedAt: '05 Nov 2026, 10:42 IST',
    viewerRole: role,
    download: { kind: 'none' },
    quoted: status === 'QUOTED' ? { at: '2026-11-05T10:42:00.000Z', byName: 'Invented Lead' } : null,
    ignored: ignored ? { at: '2026-11-05T10:42:00.000Z', byName: 'Invented Lead', remarks: 'Invented remarks.' } : null,
    engineerName: 'Invented Engineer',
    deadlinePassed: false,
  };
  return renderToStaticMarkup(createElement(EstimateReview, props));
}

const CASES = STATUSES.flatMap((status) => ROLES.flatMap((role) => [false, true].map((ignored) => ({ status, role, ignored }))));

describe('ED-18 and ED-19: the tree the page draws is the one `treeActionsOffered` says', () => {
  it.each(CASES)('$role on $status (ignored: $ignored)', async ({ status, role, ignored }) => {
    const offered = treeActionsOffered({ status, ignored }, role);
    const markup = await render(status, role, ignored);
    // The editing island marks its panel; the read-only tree does not carry the mark.
    expect(markup.includes('data-review-tree-edit=""')).toBe(offered);
    // Either way the panel of the review tree is there (the same `data-review-tree`, the same column).
    expect(markup).toContain('data-review-tree=""');
    if (!offered) {
      // Not drawn, not disabled: no toolbar slot, no "Add main assembly", no move handle, no "+" and no "-" anywhere on the page.
      expect(markup).not.toContain('data-row-toolbar');
      expect(markup).not.toContain(ADD_MAIN_ASSEMBLY);
      expect(markup).not.toContain('data-move-handle');
      // The rows are the links of Stage 1: a soft navigation to the row's inputs.
      expect(markup).toMatch(/href="\/estimates\/Q-2026-0318\?row=[^"]+#row-inputs"/);
    }
  });

  it('is exactly a Lead or an Admin on a Draft or a Prepared estimate that is not ignored', () => {
    const offered = CASES.filter(({ status, role, ignored }) => treeActionsOffered({ status, ignored }, role)).map(({ status, role }) => `${role} ${status}`);
    expect(offered).toEqual(['LEAD DRAFT', 'ADMIN DRAFT', 'LEAD PREPARED', 'ADMIN PREPARED']);
  });
});

describe('ED-19 and 4.2: the three read-only notices name the parts tree', () => {
  it.each([
    ['APPROVED', false, 'Read-only while approved. Unlock the estimate to change an input or the parts tree.'],
    ['QUOTED', false, 'Read-only while quoted. Unlock the estimate to change an input or the parts tree.'],
    ['PREPARED', true, 'Read-only while this RFQ is ignored. Restore it to change an input or the parts tree.'],
  ] as const)('%s (ignored: %s)', (status, ignored, words) => {
    expect(inputsNotice(status, ignored, 'current')).toBe(words);
    expect(words.endsWith('change an input or the parts tree.')).toBe(true);
  });

  it('the Ignored layer wins over every status', () => {
    for (const status of STATUSES) expect(inputsNotice(status, true, 'current')).toBe('Read-only while this RFQ is ignored. Restore it to change an input or the parts tree.');
  });
});
