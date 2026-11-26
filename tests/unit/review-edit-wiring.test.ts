import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EstimateReview, type EstimateReviewProps } from '@/components/features/estimate-review/estimate-review';
import { inputsNotice } from '@/components/features/estimate-review/review-texts';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CostsView } from '@/server/views/schemas/costs';

import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * DEF-131 stage 2, the inputs edit UI (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.1, 4.2; ED-1, ED-3): what the review page hands the inputs island. `editable` is `canEditInputs` asked with the viewer's real role (a
 * Lead or an Admin) over the status and the Ignored layer, never a role or status test written again: Draft and Prepared, not ignored, are editable, and Approved, Quoted and every ignored estimate are not. The island
 * is told whether the figures are current (it refreshes the page once, when a save takes them to cleared), and the notice has the words of 4.2 for the status and the state of the figures. The island itself is a client
 * component drawn after the page is up, so it is captured here at the boundary. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

interface Captured {
  readonly editable: boolean;
  readonly figuresCurrent?: boolean;
  readonly review: { readonly notice: string; readonly figuresCurrent?: boolean };
}
const captured: Captured[] = [];
vi.mock('@/components/features/estimate-workspace/lazy-part-form', () => ({
  LazyPartForm: (props: Captured) => {
    captured.push(props);
    return null;
  },
}));

const CE1 = QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1');
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

type Figures = 'current' | 'out-of-date' | 'none';

async function costsFor(figures: Figures): Promise<CostsView> {
  if (CE1 === undefined) throw new Error('the invented case CE-1 is missing');
  const world = createReviewWorld(figures === 'none' ? { rows: CE1.rows, bl: CE1.bl, calculated: false } : figures === 'out-of-date' ? { rows: CE1.rows, bl: CE1.bl, inputsRevision: 9 } : { rows: CE1.rows, bl: CE1.bl });
  return world.service.getCosts({ id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' }, REVIEW_ESTIMATE_ID);
}

async function render(status: EstimateStatus, role: 'LEAD' | 'ADMIN', ignored: boolean, figures: Figures): Promise<Captured> {
  const costs = await costsFor(figures);
  const props: EstimateReviewProps = {
    header: HEADER(status),
    estimateId: REVIEW_ESTIMATE_ID,
    customer: { id: 'c1', name: 'Invented Customer', shortName: 'INV' },
    costs,
    calculatedAt: costs.calculatedAt === null ? null : '05 Nov 2026, 10:42 IST',
    viewerRole: role,
    download: { kind: 'none' },
    quoted: status === 'QUOTED' ? { at: '2026-11-05T10:42:00.000Z', byName: 'Invented Lead' } : null,
    ignored: ignored ? { at: '2026-11-05T10:42:00.000Z', byName: 'Invented Lead', remarks: 'Invented remarks.' } : null,
    engineerName: 'Invented Engineer',
    deadlinePassed: false,
  };
  renderToStaticMarkup(createElement(EstimateReview, props));
  const last = captured.at(-1);
  if (last === undefined) throw new Error('the inputs island was not drawn');
  return last;
}

beforeEach(() => {
  captured.length = 0;
});

const STATUSES: ReadonlyArray<EstimateStatus> = ['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'];

describe('ED-1: editable follows canEditInputs, for a Lead and for an Admin', () => {
  it.each(STATUSES.flatMap((status) => (['LEAD', 'ADMIN'] as const).flatMap((role) => [false, true].map((ignored) => [status, role, ignored] as const))))('%s, %s, ignored %s', async (status, role, ignored) => {
    const island = await render(status, role, ignored, status === 'DRAFT' ? 'none' : 'current');
    expect(island.editable).toBe(!ignored && (status === 'DRAFT' || status === 'PREPARED'));
  });
});

describe('ED-3: the island is told whether the figures are current, and the notice has the words of 4.2', () => {
  it('says current only when the figures are current', async () => {
    expect((await render('PREPARED', 'LEAD', false, 'current')).review.figuresCurrent).toBe(true);
    expect((await render('PREPARED', 'LEAD', false, 'out-of-date')).review.figuresCurrent).toBe(false);
    expect((await render('DRAFT', 'LEAD', false, 'none')).review.figuresCurrent).toBe(false);
  });

  it.each([
    ['PREPARED', 'current', 'You can correct inputs. Any change clears every calculated figure; press Recalculate to see them again.'],
    ['PREPARED', 'out-of-date', 'You can correct inputs. Every calculated figure is already cleared; press Recalculate when you have finished.'],
    ['PREPARED', 'none', 'You can correct inputs.'],
    ['DRAFT', 'none', 'You can correct inputs. The Engineer can change this estimate too.'],
    ['DRAFT', 'out-of-date', 'You can correct inputs. Every calculated figure is already cleared; press Recalculate when you have finished. The Engineer can change this estimate too.'],
    ['APPROVED', 'current', 'Read-only while approved. Unlock the estimate to change an input or the parts tree.'],
    ['QUOTED', 'current', 'Read-only while quoted. Unlock the estimate to change an input or the parts tree.'],
  ] as const)('%s with figures %s', (status, figures, words) => {
    expect(inputsNotice(status, false, figures)).toBe(words);
  });

  it('the Ignored layer wins over the status and says how to get editing back', () => {
    for (const status of STATUSES) expect(inputsNotice(status, true, 'current')).toBe('Read-only while this RFQ is ignored. Restore it to change an input or the parts tree.');
  });

  it('hands the page\'s own notice to the island', async () => {
    expect((await render('PREPARED', 'ADMIN', false, 'out-of-date')).review.notice).toBe(inputsNotice('PREPARED', false, 'out-of-date'));
  });
});
