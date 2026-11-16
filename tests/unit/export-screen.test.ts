import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateExport } from '@/components/features/estimate-export/estimate-export';
import { BUILDING_LINE, COLUMNS_RANGE, PARTS, PICTURES, REFERENCE_LINE } from '@/components/features/estimate-export/export-texts';
import type { ExportSummaryView } from '@/server/views/schemas/export';

/**
 * STORY-07.01 AC-6 without a browser: what SCR-10 draws from the strict answer of `GET /export-summary`: the file card, the rows of the file, and the Empty state. The words are written out here from the
 * UX spec, not imported from the product, so a changed sentence fails a test. Layouts at 360, 768 and 1366 px, axe and the button are `tests/e2e/export.spec.ts`. Every name and number is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const CODE = 'Q-2026-0701';

const summary = (overrides: Partial<ExportSummaryView> = {}): ExportSummaryView => ({
  fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
  partCount: 3,
  pictureCount: 1,
  columns: { first: 'A', last: 'BO', count: 67 },
  rows: [
    { slNo: '1', name: 'Base frame', count: '2' },
    { slNo: '1.1', name: '', count: null },
    { slNo: '2', name: 'Lid', count: '24.50' },
  ],
  ...overrides,
});

const render = (view: ExportSummaryView): string => renderToStaticMarkup(createElement(EstimateExport, { summary: view, estimateId: ESTIMATE_ID, code: CODE }));

describe('the file card', () => {
  it('shows the file name as real text, the number of rows, the columns A to BO and an enabled Download .xlsx button', () => {
    const html = render(summary());
    expect(html).toContain('>Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx</dd>');
    expect(html).toContain('3 parts');
    expect(html).toContain('A to BO');
    expect(html).toMatch(/<button[^>]*id="export-download"[^>]*>Download \.xlsx<\/button>/);
    expect(html).not.toMatch(/<button[^>]*id="export-download"[^>]*disabled/);
  });

  it('says "1 part" for one part', () => {
    expect(render(summary({ partCount: 1, rows: [{ slNo: '1', name: 'Base', count: null }] }))).toContain('1 part<');
  });

  it('links back to the estimate by its code', () => {
    expect(render(summary())).toContain(`href="/estimates/${CODE}"`);
  });
});

describe('the rows of the file', () => {
  it('lists each part with its Sl. No, its name and its count, a dash for a missing count and "No name yet" for a part with no name, in a focusable, named region', () => {
    const html = render(summary());
    expect(html).toContain('aria-label="The rows in the file"');
    expect(html).toContain('tabindex="0"');
    for (const text of ['Base frame', 'Lid', 'No name yet', '24.5', '1.1']) expect(html).toContain(text);
    expect(html).toContain('—');
  });

  it('holds no rupee sign and no cost word: the summary has no figure', () => {
    const html = render(summary());
    expect(html).not.toContain('₹');
    expect(html).not.toMatch(/\bcost\b/i);
  });

  it('wraps a long unbroken name, so the page never scrolls sideways', () => {
    const html = render(summary({ rows: [{ slNo: '1', name: 'X'.repeat(200), count: null }], partCount: 1 }));
    expect(html).toContain('[overflow-wrap:anywhere]');
    expect(html).toContain('X'.repeat(200));
  });
});

describe('the Empty state', () => {
  it('says "Nothing to export yet" in a status region and draws no file card, no button and no table', () => {
    const html = render(summary({ partCount: 0, pictureCount: 0, rows: [] }));
    expect(html).toContain('Nothing to export yet');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Download .xlsx');
    expect(html).not.toContain('<table');
  });
});

describe('the words of the states, as the UX spec writes them', () => {
  it('Building: "Building the file. 10 parts, 1 picture. This usually takes a few seconds."', () => {
    expect(BUILDING_LINE(10, 1)).toBe('Building the file. 10 parts, 1 picture. This usually takes a few seconds.');
    expect(BUILDING_LINE(1, 0)).toBe('Building the file. 1 part, 0 pictures. This usually takes a few seconds.');
    expect(BUILDING_LINE(2000, 2)).toBe('Building the file. 2,000 parts, 2 pictures. This usually takes a few seconds.');
  });

  it('the small pieces', () => {
    expect(PARTS(1)).toBe('1 part');
    expect(PICTURES(1)).toBe('1 picture');
    expect(COLUMNS_RANGE('A', 'BO')).toBe('A to BO');
    expect(REFERENCE_LINE('req-0a1b2c3d')).toBe('Reference: req-0a1b2c3d');
  });
});
