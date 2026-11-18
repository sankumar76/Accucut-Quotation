import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import { approveOffer } from '@/components/features/estimate-review/review-actions';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { approveRatesLine } from '@/lib/estimate/rates-changed-copy';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { ONE_OF_EACH, ONE_OF_EACH_COUNTS } from '../support/rate-change-fixture';
import { createReviewWorld, REVIEW_ESTIMATE_ID, type ReviewWorldOptions } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * STORY-06.11 AC-1, AC-3, AC-4, AC-9 and AC-10 without a browser: what SCR-06 draws from the strict answer of `GET /costs` when rates changed since the calculation: the notice with its words, its live region and
 * its link, and **the Recalculate button the link points at**, in every state and status the story names. The words are written out here from the story and the UX spec, not imported from the product. The
 * three widths, the keyboard and axe are `tests/e2e/rates-changed.spec.ts`. Every name and number is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const AT = '05 Nov 2026, 10:42 IST';

const headerOf = (status: EstimateStatus): WorkspaceHeaderView => ({
  code: 'Q-2026-0318',
  status,
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  notes: null,
  assignedByName: 'Invented Lead',
});

const CE1 = defined(QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1'));

async function costsOf(options: Partial<ReviewWorldOptions> = {}): Promise<CostsView> {
  return createReviewWorld({ rows: CE1.rows, bl: CE1.bl, ...options }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
}

const render = (costs: CostsView, status: EstimateStatus): string =>
  renderToStaticMarkup(
    createElement(EstimateReview, {
      header: headerOf(status),
      estimateId: REVIEW_ESTIMATE_ID,
      customer: { id: 'c1', name: 'Invented Customer' },
      costs,
      calculatedAt: costs.calculatedAt === null ? null : AT,
    }),
  );

const NOTICE_TITLE = 'Rates changed since this was calculated.';
const NOTICE_TEXT = `2 rates and 1 material price changed since this was calculated at ${AT}. Recalculate to use them. Approving is not blocked.`;
const textOf = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const countOf = (html: string, text: string): number => html.split(text).length - 1;
const BUTTON = /<button[^>]*\bid="review-calculate"[^>]*>/;
/** The opening tag of the button with this id, or an empty text. */
const tagOf = (html: string, id: string): string => new RegExp(`<button[^>]*\\bid="${id}"[^>]*>`).exec(html)?.[0] ?? '';
const ANCHOR =/<a href="#review-calculate"[^>]*>Recalculate<\/a>/;

describe('AC-1, AC-9: a Submitted estimate with current figures and changed rates', () => {
  it('says what changed, by kind, with the time, in a live region, with a link to Recalculate and the sentence that approving is not blocked', async () => {
    const costs = await costsOf({ mastersNow: ONE_OF_EACH });
    expect(costs.ratesChanged).toEqual(ONE_OF_EACH_COUNTS);
    const html = render(costs, 'SUBMITTED');
    const text = textOf(html);
    expect(text).toContain(`${NOTICE_TITLE} ${NOTICE_TEXT.replace(' Recalculate ', ' Recalculate ')}`);
    expect(countOf(html, NOTICE_TITLE)).toBe(1);
    // A live region (UX spec SCR-06 "Accessibility"): the notice's own element has the role, and holds the title.
    expect(html).toMatch(new RegExp(`role="status"[^>]*>(?:(?!role=)[\\s\\S])*?${NOTICE_TITLE.replace('.', '\\.')}`));
    expect(html).toMatch(ANCHOR);
    expect(countOf(html, 'id="review-calculate"')).toBe(1);
  });

  it('shows no old or new value, no ID and no rate name: the counts and the time are the only numbers of the notice', async () => {
    const html = render(await costsOf({ mastersNow: ONE_OF_EACH }), 'SUBMITTED');
    const notice = textOf(html).slice(textOf(html).indexOf(NOTICE_TITLE), textOf(html).indexOf('Approving is not blocked.') + 'Approving is not blocked.'.length);
    expect([...notice.replaceAll(AT, '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => match[0])).toEqual(['2', '1']);
    expect(html).not.toMatch(/Invented rate|Invented plate|"12\.00"|"84"/);
  });

  it('the link never points at a missing button: the Recalculate button is on the bar, and Approve and lock is still on (approving is not blocked)', async () => {
    const html = render(await costsOf({ mastersNow: ONE_OF_EACH }), 'SUBMITTED');
    expect(html).toMatch(BUTTON);
    expect(html).toMatch(/<button[^>]*\bid="review-calculate"[^>]*>(?:(?!<\/button>)[\s\S])*Recalculate/);
    // Approve and lock is the enabled button of the one script, never the disabled stand-in.
    expect(html).toMatch(/<button[^>]*\bid="review-approve"[^>]*>/);
    expect(tagOf(html, 'review-approve')).not.toBe('');
    expect(tagOf(html, 'review-approve')).not.toContain('disabled=""');
    // The notice comes before the tiles and the bar, so a reader meets it before the figures.
    expect(html.indexOf(NOTICE_TITLE)).toBeLessThan(html.indexOf('Total Unit Production Price'));
    expect(html.indexOf(NOTICE_TITLE)).toBeLessThan(html.indexOf('id="review-calculate"'));
  });

  it('nothing changed: no notice, and a Submitted estimate with current figures still has no Recalculate button (its way on is Approve and lock)', async () => {
    const html = render(await costsOf(), 'SUBMITTED');
    expect(html).not.toContain(NOTICE_TITLE);
    expect(html).not.toMatch(BUTTON);
    expect(html).not.toMatch(ANCHOR);
  });

  it('the Admin sees the same notice (AC-5): it is drawn from the answer, not from the role', async () => {
    const costs = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, mastersNow: ONE_OF_EACH }).service.getCosts({ id: LEAD.id, role: 'ADMIN' }, REVIEW_ESTIMATE_ID);
    expect(textOf(render(costs, 'SUBMITTED'))).toContain(NOTICE_TEXT);
  });
});

describe('AC-10 (AQP-321 review SQR-04): an unlocked Draft with current figures and changed rates', () => {
  it('shows the notice, and its link reaches a Recalculate button that is on the screen, once, as a button of the bar; Approve and lock is off with its reason', async () => {
    const costs = await costsOf({ status: 'DRAFT', mastersNow: ONE_OF_EACH, approval: { price: '30.00', unlock: { unlockedAt: new Date('2026-11-05T06:35:00.000Z'), byName: 'Invented Kiran', reason: 'New fixture.', engineerName: 'Invented Priya' } } });
    expect(costs.state).toBe('current');
    const html = render(costs, 'DRAFT');
    expect(textOf(html)).toContain(NOTICE_TEXT);
    expect(html).toMatch(ANCHOR);
    expect(countOf(html, 'id="review-calculate"')).toBe(1);
    expect(html).toMatch(BUTTON);
    // The target is a button inside the action bar group, after the notice: following the link goes down the page to it.
    const bar = html.indexOf('role="group"');
    expect(html.indexOf('id="review-calculate"')).toBeGreaterThan(bar);
    expect(html.indexOf(NOTICE_TITLE)).toBeLessThan(bar);
    expect(tagOf(html, 'review-approve')).toContain('disabled=""');
    expect(textOf(html)).toContain('Recalculate first. Approving is available once this Draft has been calculated again.');
  });

  it('a Draft with current figures and no change in the rates still has its Recalculate button (06.08 AC-11), and no notice', async () => {
    const html = render(await costsOf({ status: 'DRAFT' }), 'DRAFT');
    expect(html).toMatch(BUTTON);
    expect(html).not.toContain(NOTICE_TITLE);
  });
});

describe('AC-3, AC-4: an approved estimate, and the states without a current figure, have no notice', () => {
  it('APPROVED: the answer holds none, so none is drawn; and a notice is not drawn for an answer that is not current whatever it holds', async () => {
    const approved = await costsOf({ status: 'APPROVED', mastersNow: ONE_OF_EACH, approval: { price: '30.00' } });
    expect(approved.ratesChanged).toBeNull();
    expect(render(approved, 'APPROVED')).not.toContain(NOTICE_TITLE);
    const cleared = { ...(await costsOf({ inputsRevision: 4 })), ratesChanged: ONE_OF_EACH_COUNTS };
    expect(cleared.state).toBe('out-of-date');
    expect(render(cleared, 'SUBMITTED')).not.toContain(NOTICE_TITLE);
    const none = { ...(await costsOf({ calculated: false })), ratesChanged: ONE_OF_EACH_COUNTS };
    expect(render(none, 'DRAFT')).not.toContain(NOTICE_TITLE);
  });

  it('the cleared estimate keeps its own notice and its Recalculate button, and no rates notice', async () => {
    const html = render(await costsOf({ inputsRevision: 4, mastersNow: ONE_OF_EACH }), 'SUBMITTED');
    expect(html).toMatch(BUTTON);
    expect(html).not.toContain(NOTICE_TITLE);
    expect(textOf(html)).toContain('The total is cleared because an input changed.');
  });
});

describe('AC-2: the approval dialog is offered the same counts, in one line', () => {
  it('the offer carries the line of the UX spec for SCR-08, made from the counts', async () => {
    const costs = await costsOf({ mastersNow: ONE_OF_EACH });
    const offer = approveOffer('SUBMITTED', costs);
    expect(offer?.ratesLine).toBe('2 rates and 1 material price changed since this was calculated. Approving is not blocked. Close this window and Recalculate first if you want them used.');
    expect(offer?.ratesLine).toBe(approveRatesLine(ONE_OF_EACH_COUNTS));
  });

  it('there is no line when nothing changed, and the offer is the same otherwise', async () => {
    const offer = approveOffer('SUBMITTED', await costsOf());
    expect(offer).not.toBeNull();
    expect(offer?.ratesLine).toBeNull();
  });

  it('there is no offer at all for a Draft, so no dialog and no line', async () => {
    expect(approveOffer('DRAFT', await costsOf({ status: 'DRAFT', mastersNow: ONE_OF_EACH }))).toBeNull();
  });
});
