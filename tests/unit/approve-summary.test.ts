import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApproveSummary } from '@/components/features/estimate-approve/approve-summary';
import { calculatedTotalLabel, dialogTitle, LEAD_IN, NO_CUSTOMER, PRICE_HINT } from '@/components/features/estimate-approve/approve-texts';
import { approveOffer } from '@/components/features/estimate-review/review-actions';

/**
 * AQP-478 (DEF-121; conformance C-08-01; UX spec SCR-08 and the mock-up `SCR-08.html`): the approval dialog says which estimate it is about ("Approve and lock <code>"), has the lead-in sentence, the two rows
 * "Calculated total (BL)" and "Customer", and the hint under the price. The words are written out here and not imported, so a change of a word is a change of this test. The dialog itself is judged by
 * `tests/e2e/approve.spec.ts`; this file holds the words and the one piece of markup that can be drawn without a browser. Every name and number is invented.
 */

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('AQP-478: the words of SCR-08', () => {
  it('the title carries the task code, and the button keeps its own words', () => {
    expect(dialogTitle('Q-2026-0318')).toBe('Approve and lock Q-2026-0318');
  });

  it('has the lead-in and the hint of the mock-up, word for word', () => {
    expect(LEAD_IN).toBe('Set the Approved Quote Price. After you approve, inputs become read-only and the task moves to Closed.');
    expect(PRICE_HINT).toBe('Starts as the calculated total. Edit it to set a different price.');
  });

  it('names the calculated total with its Excel letter, which comes from the configuration and is never typed', () => {
    expect(calculatedTotalLabel('BL')).toBe('Calculated total (BL)');
    expect(calculatedTotalLabel('BM')).toBe('Calculated total (BM)');
  });
});

describe('AQP-478: the summary of the dialog', () => {
  const render = (customerName: string | null): string => renderToStaticMarkup(createElement(ApproveSummary, { totalLetter: 'BL', calculatedTotal: '12951.53', customerName }));

  it('is the lead-in sentence, then two rows: the calculated total in rupees and the customer', () => {
    const html = render('Brightwater Controls');
    const words = text(html);
    expect(words).toBe(`${LEAD_IN} Calculated total (BL) ₹ 12,951.53 Customer Brightwater Controls`);
    expect(html).toMatch(/<dl[^>]*>[\s\S]*<dt[^>]*>Calculated total \(BL\)<\/dt>[\s\S]*<dd[^>]*>₹ 12,951.53<\/dd>[\s\S]*<dt[^>]*>Customer<\/dt>[\s\S]*<dd[^>]*>Brightwater Controls<\/dd>/);
  });

  it('gives the lead-in the id the dialog is described by', () => {
    expect(render('Brightwater Controls')).toMatch(/<p[^>]*id="approve-lead-in"[^>]*>Set the Approved Quote Price\./);
  });

  it('says "Not set" for an estimate made before it had a customer, and never leaves the row empty', () => {
    expect(NO_CUSTOMER).toBe('Not set');
    expect(text(render(null))).toMatch(/Customer Not set$/);
  });

  it('escapes a customer name, so markup in it is shown and never run', () => {
    const html = render('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('AQP-478: what the Approve button hands the dialog', () => {
  const costs = {
    state: 'current',
    calculationId: 'calc-1',
    totals: { totalPrice: '12951.53' },
    letters: { totalPrice: 'BL', approvedPrice: 'BO' },
    warning: null,
    ratesChanged: null,
  } as unknown as Parameters<typeof approveOffer>[1];

  it('carries the letter of the calculated total and the customer name next to the total it already carried', () => {
    const offer = approveOffer('PREPARED', costs, 'Brightwater Controls');
    expect(offer?.totalLetter).toBe('BL');
    expect(offer?.customerName).toBe('Brightwater Controls');
    expect(offer?.calculatedTotal).toBe('12951.53');
  });

  it('carries no name when the estimate has no customer, and there is still no offer for a Draft', () => {
    expect(approveOffer('PREPARED', costs, null)?.customerName).toBeNull();
    expect(approveOffer('DRAFT', costs, 'Brightwater Controls')).toBeNull();
  });
});
