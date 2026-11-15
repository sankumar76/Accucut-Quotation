import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import { COST_ESTIMATE_ID, COST_FIRST_NODE_ID, COST_CALCULATION_REVISION, createCostWorld, type CostWorldOptions } from '../support/cost-details-world';

/**
 * STORY-06.03 AC-1 to AC-7 and AC-9 without a browser: what SCR-07 draws from the strict answer of `GET /nodes/{nodeId}/costs`, for the invented row of the hand-worked oracle, a row with the "Not applicable"
 * material, a row with its treatment lines hidden, and the two states without a stage. The words are written out here from the UX spec and the story, not imported from the product, so a changed sentence
 * fails a test. Layouts at 360, 768 and 1366 px, axe and the keyboard are `tests/e2e/cost-details.spec.ts`. Every name and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CODE = 'Q-2026-0320';

async function viewOf(options: CostWorldOptions = {}): Promise<NodeCostsView> {
  return createCostWorld(options).service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
}

const render = (view: NodeCostsView): string =>
  renderToStaticMarkup(createElement(CostDetails, { view, code: CODE, calculatedAt: view.details === null ? null : '05 Nov 2026, 10:42 IST' }));

/** The page without the paths of its icons, whose numbers (`d="M12 1.5 ..."`) are not figures. */
const withoutIcons = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '');
const textOf = (html: string): string =>
  withoutIcons(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
const countOf = (html: string, text: string): number => html.split(text).length - 1;

describe('AC-1: six panels, and in each line the tag, the name, the formula, the working and the value', () => {
  it('draws the six `details` panels with the numbers and names of the stages, each open, and the total of a stage in its summary', async () => {
    const html = render(await viewOf());
    expect(countOf(html, '<details')).toBe(6);
    expect([...html.matchAll(/<details open="" data-stage="(\d)"/g)].map((match) => match[1])).toEqual(['1', '2', '3', '4', '5', '6']);
    for (const title of ['1. Weights &amp; Areas', '2. Material Cost', '3. Process Costs', '4. Sub Total', '5. Rejection, Overheads &amp; Logistics', '6. Pricing']) expect(html).toContain(title);
    expect(html).toContain('Stage total: 15.99');
  });

  it('prints a line as its tag, its name, its formula in letters, its working with values and its value', async () => {
    const html = render(await viewOf());
    const text = textOf(html);
    expect(text).toContain('Excel column AK Material Cost 15.99');
    expect(html).toContain('AK = (M * I) - (O * Material-Scrap-Rate)');
    expect(html).toContain('AK = (0.3140 × 60) - (0.1140 × 25) = 15.99');
    expect(html).toContain('AL = P * Cutting-Rate-per-Sec');
    expect(html).toContain('AL = 10 × 0.5 = 5.00');
  });

  it('shows the material rate as a reference in stage 2, and a typed entry with its value and no formula', async () => {
    const html = render(await viewOf());
    expect(textOf(html)).toContain('Excel column I Material Rate / Kg 60.00');
    expect(html).not.toMatch(/>I = /);
    expect(textOf(html)).toContain('Machining Cost 15.00');
  });

  it('draws the row\'s box with its own price (BG) and its count, and highlights the BG line', async () => {
    const html = render(await viewOf());
    expect(html).toContain('Unit Production Price');
    expect(html).toContain('₹ 451.40');
    expect(textOf(html)).toContain('3 nos for the whole order, already included in the price');
    expect(html).toContain('border-nav bg-nav text-on-fill');
    expect(countOf(html, 'bg-nav text-on-fill')).toBeGreaterThanOrEqual(1);
  });

  it('puts the sub-headings of stage 3 in order, and a heading only where a line is shown', async () => {
    const html = render(await viewOf());
    const headings = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]);
    expect(headings).toEqual(['Cutting', 'Bending', 'Welding', 'Surface Treatment', 'Entered directly', 'Process Total']);
  });
});

describe('AC-2: the working and the sentence about rounding', () => {
  it('says what the working prints, and states the rounding rule, once each', async () => {
    const text = textOf(render(await viewOf()));
    expect(text).toContain('Inputs and rates are shown as typed, a percent rate as a percentage, and calculated values to 4 decimals, so repeating the arithmetic gives the figure printed.');
    expect(text).toContain('The portal keeps every digit, adds the unrounded values and rounds once, so adding the shown figures by hand can differ by a few hundredths.');
    expect(countOf(text, 'adds the unrounded values and rounds once')).toBe(1);
  });

  it('a percent rate is as typed (12%), and the calculation and its configuration version are named', async () => {
    const html = render(await viewOf());
    expect(html).toContain('BD = 377.7390 × 12% = 45.33');
    expect(textOf(html)).toContain('Calculated 05 Nov 2026, 10:42 IST · configuration version 9');
  });

  it('a stage whose lines as shown do not add to its total says so with the numbers', async () => {
    const html = render(await viewOf({ first: { row: { H: '1', AP: '1.05' }, material: 'not-applicable' } }));
    expect(textOf(html)).toContain('The 4 lines above add to 0.21 as shown, and the stage total is 0.20. The portal adds the unrounded values, then rounds once.');
  });

  it('says nothing about it where the lines add to the total', async () => {
    expect(textOf(render(await viewOf()))).not.toContain('lines above add to');
  });
});

describe('AC-3: treatment lines that are not selected are not drawn, and one sentence says how many', () => {
  it('hides the two lines of the oracle row (Primer, Foam) with the sentence in the plural, and draws the five that are selected', async () => {
    const html = render(await viewOf());
    expect(textOf(html)).toContain('2 treatment lines are hidden because they are not selected for this part. They are still calculated and exported as 0.');
    expect(html).not.toContain('Primer Cost');
    expect(html).not.toContain('Foam Cost');
    for (const name of ['Hot Dip Galvanizing Cost', 'Shot Blasting Cost', 'Polishing Cost', 'Powder Coating Cost', 'Soft Anodize Cost']) expect(html).toContain(name);
  });

  it('with no flag chosen all seven are hidden and the sentence says 7', async () => {
    const html = render(await viewOf({ first: { row: { H: '1', AP: '10' } } }));
    expect(textOf(html)).toContain('7 treatment lines are hidden because they are not selected for this part.');
    expect(html).not.toContain('Polishing Cost');
    expect(html).toContain('Machining Cost');
  });

  it('with every flag chosen no sentence is drawn', async () => {
    const all = { H: '1', AP: '1', Z: '1', AA: '1', AB: '1', AC: '1', AE: '1', AF: '1', AG: '1' };
    expect(textOf(render(await viewOf({ first: { row: all } })))).not.toContain('treatment line');
  });
});

describe('AC-4: no figure is a dash', () => {
  it('a division by zero shows the dash as the value and as the result of the working, and the other lines keep theirs', async () => {
    const html = render(await viewOf({ first: { exchange: { usd: '0', eur: '90' } } }));
    expect(html).toContain('BJ = 451.3981 / 0.0000 = —');
    expect(textOf(html)).toContain('Unit Production Price (USD) —');
    expect(html).toContain('BK = 451.3981 / 90.0000 = 5.02');
  });
});

describe('AC-5: a row with the "Not applicable" material', () => {
  it('says so once, shows the material rate blank and 0.00 for M, O and AK with no worked line, and prints no Material- operand', async () => {
    const html = render(await viewOf({ first: { material: 'not-applicable' } }));
    expect(textOf(html)).toContain('The material of this part is "Not applicable", so its material rate is blank and the three lines that read the material show 0.00 with no worked line.');
    expect(countOf(html, 'is &quot;Not applicable&quot;')).toBe(1);
    expect(html).toContain('M = (L * K * J * Material-Specific-Gravity) / 1000000');
    expect(html).not.toContain('M = (2 ');
    expect(html).not.toContain('AK = (0');
    expect(textOf(html)).toContain('Excel column AK Material Cost 0.00');
    expect(textOf(html)).toContain('Excel column M Blank Weight 0.00 kg');
    expect(html).not.toContain('Material Rate / Kg 60');
    expect(html).toContain('Blank: this part has no material rate');
  });
});

describe('AC-6: read-only', () => {
  it('has no field, no editable element and no button, and prints the Scrap Weight formula as seeded', async () => {
    const html = render(await viewOf());
    expect(html).not.toMatch(/<(input|textarea|select|form|button)\b/);
    expect(html).not.toMatch(/contenteditable/i);
    expect(html).toContain('O = IF(Material-Specific-Gravity &gt; 0, M - N, 0)');
    expect(textOf(html)).toContain('This page only shows the formulas. They cannot be changed here.');
  });
});

describe('AC-7: the states with nothing current show the row header and no stage', () => {
  it('OUT OF DATE: "Cleared. Press Recalculate", the sentence, and a link to the estimate; no stage, no formula, no figure', async () => {
    const html = render(await viewOf({ inputsRevision: COST_CALCULATION_REVISION + 1 }));
    const text = textOf(html);
    expect(text).toContain('Cleared. Press Recalculate');
    expect(text).toContain('An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.');
    expect(html).toContain(`href="/estimates/${CODE}"`);
    expect(text).toContain('Part 1 Invented Bracket');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<details');
    for (const absent of ['451.40', '15.99', 'Material-Scrap-Rate', 'Cutting-Rate-per-Sec', 'Stage total', 'Excel column']) expect(html, absent).not.toContain(absent);
  });

  it('NONE: says the estimate has not been calculated, with a link to it; no stage', async () => {
    const html = render(await viewOf({ calculated: false }));
    expect(textOf(html)).toContain('Not calculated The Engineer has not calculated this estimate yet, so there are no stages to show for this part.');
    expect(html).toContain(`href="/estimates/${CODE}"`);
    expect(html).not.toContain('<details');
    expect(html).not.toContain('Stage total');
  });

  it('both states keep the page title, the way back and the row header', async () => {
    for (const options of [{ calculated: false }, { inputsRevision: COST_CALCULATION_REVISION + 1 }]) {
      const html = render(await viewOf(options));
      expect(html).toContain('>Cost details</h1>');
      expect(textOf(html)).toContain('Back to the estimate');
      expect(textOf(html)).toContain('Part 1 Invented Bracket');
    }
  });
});

describe('AC-9 (without a browser): formulas are text, `details` and `summary` are the controls, and the layout classes are in place', () => {
  it('every formula is text and no image is drawn for one', async () => {
    const html = withoutIcons(render(await viewOf()));
    expect(html).not.toMatch(/<(img|canvas)\b/);
    expect(html).toContain('<summary');
  });

  it('the stages sit in a column below 1280 px and beside the row box from 1280 px, and the lines wrap at any width', async () => {
    const html = render(await viewOf());
    expect(html).toContain('xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]');
    expect(html).toContain('[overflow-wrap:anywhere]');
  });

  it('has one h1, and the stages are named by one (visually hidden) h2 so the headings never skip a level', async () => {
    const html = render(await viewOf());
    expect(countOf(html, '<h1')).toBe(1);
    expect(countOf(html, '<h2')).toBe(1);
    expect(html).toContain('The six stages');
  });
});
