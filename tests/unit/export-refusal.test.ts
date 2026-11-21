import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateExport } from '@/components/features/estimate-export/estimate-export';
import { ReviewActions } from '@/components/features/estimate-review/review-actions';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { ExportSummaryView } from '@/server/views/schemas/export';

import { REPOSITORY_ROOT, isTextFile, trackedFiles } from '../support/scan-files';

/**
 * STORY-07.04 without a browser: AC-5 (SCR-10 in each refused state: no file card, no table, the words of the UX spec, a `role="status"` empty state with its link), AC-7 (the download button of SCR-06 is
 * disabled and described by its reason in those states, at every status) and AC-8 (the code holds no out-of-date file name, sheet, marker or confirmation, D-28). The words are written out here from the UX spec
 * and the story, not imported from the product, so a changed sentence fails a test. The layouts, the keyboard and axe are `tests/e2e/export-refusal.spec.ts`. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0701' }));

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const CODE = 'Q-2026-0701';

const summary = (state: ExportSummaryView['state']): ExportSummaryView => ({
  fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
  partCount: 3,
  pictureCount: 1,
  columns: { first: 'A', last: 'BO', count: 67 },
  rows: [
    { slNo: '1', name: 'Base frame', count: '2' },
    { slNo: '1.1', name: 'Pipe', count: '6' },
    { slNo: '2', name: 'Lid', count: '24' },
  ],
  state,
  figures: null,
  warning: null,
});

const render = (view: ExportSummaryView): string => renderToStaticMarkup(createElement(EstimateExport, { summary: view, estimateId: ESTIMATE_ID, code: CODE }));

describe('AC-5: SCR-10 in a refused state shows no file card and no table', () => {
  it('Not calculated: the UX spec\'s words, a status region, and a link "Go to the estimate to Calculate" to the estimate', () => {
    const html = render(summary('none'));
    expect(html).toContain('There is no file to download yet.');
    expect(html).toContain('This estimate has not been calculated. The download stays off until a calculation is current.');
    expect(html).toContain('Calculate first');
    expect(html).toContain('The file holds the rows and the totals of a calculation. There is none yet.');
    expect(html).toMatch(/<div role="status"[^>]*>/);
    expect(html).toMatch(new RegExp(`<a[^>]*href="/estimates/${CODE}"[^>]*>Go to the estimate to Calculate</a>`));
    expect(html).not.toContain('Recalculate');
  });

  it('Total cleared: the UX spec\'s words, a status region, and a link "Go to the estimate to Recalculate" to the estimate', () => {
    const html = render(summary('out-of-date'));
    expect(html).toContain('The total is cleared because an input changed.');
    expect(html).toContain('There is no file to download until you press Recalculate.');
    expect(html).toContain('Recalculate first');
    expect(html).toContain('The file would hold figures that no longer match the inputs, so the portal does not build one. After Recalculate the download comes back.');
    expect(html).toMatch(/<div role="status"[^>]*>/);
    expect(html).toMatch(new RegExp(`<a[^>]*href="/estimates/${CODE}"[^>]*>Go to the estimate to Recalculate</a>`));
    expect(html).not.toContain('Go to the estimate to Calculate');
  });

  it.each(['none', 'out-of-date'] as const)('%s: no file card, no file name, no Download button, no table, no rows region, no part name, no figure', (state) => {
    const html = render(summary(state));
    for (const absent of ['The file<', 'File name', 'Quotation_Acme', 'Download .xlsx', 'export-download', '<table', 'The rows in the file', 'Base frame', 'Pipe', 'Lid', '₹', 'A to BO']) {
      expect(html, absent).not.toContain(absent);
    }
  });

  it.each(['none', 'out-of-date'] as const)('%s: the page still says nothing of an out-of-date file, a marker, a sheet or a confirmation (D-28)', (state) => {
    const html = render(summary(state));
    expect(html).not.toMatch(/out-of-date file|OUT OF DATE|_OUT-OF-DATE|Download out-of-date|confirm/i);
    expect(html).not.toContain('role="alertdialog"');
    expect(html).not.toContain('role="dialog"');
  });

  it('a current state still shows the file card and the table, so the refusal is by the state and not by an empty answer', () => {
    const html = render(summary('current'));
    expect(html).toContain('Download .xlsx');
    expect(html).toContain('<table');
    expect(html).not.toContain('There is no file to download yet.');
    expect(html).not.toContain('The total is cleared');
  });
});

describe('AC-7: the download button of SCR-06 in those states', () => {
  const STATUSES: ReadonlyArray<EstimateStatus> = ['DRAFT', 'SUBMITTED', 'APPROVED'];
  const REASON = 'Calculate or Recalculate first. There is no file until a calculation is current.';

  const bar = (state: 'none' | 'out-of-date', status: EstimateStatus): string =>
    renderToStaticMarkup(
      createElement(ReviewActions, { estimateId: ESTIMATE_ID, code: CODE, state, status, calculated: null, approve: null, cancel: null, remove: null, ratesChanged: false }),
    );

  it.each(STATUSES.flatMap((status) => (['none', 'out-of-date'] as const).map((state) => [state, status] as const)))('%s, %s: Download is disabled and described by the reason, which is visible text', (state, status) => {
    const html = bar(state, status);
    const button = html.match(/<button[^>]*id="review-download"[^>]*>/)?.[0] ?? '';
    expect(button).toContain('disabled=""');
    const reasonId = button.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(reasonId).toBe('review-download-reason');
    expect(html).toMatch(new RegExp(`<p id="${reasonId}"[^>]*>${REASON}</p>`));
  });
});

describe('AC-8 (D-28): there is no out-of-date file anywhere in the code', () => {
  const sourceFiles = trackedFiles().filter((path) => path.startsWith('src/') && isTextFile(path));

  it('no tracked file under src names an _OUT-OF-DATE file, an OUT OF DATE sheet or marker, or the old switch of the stated choice', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
    const found = sourceFiles.filter((path) => /_OUT-OF-DATE|OUT OF DATE|OUT-OF-DATE|allowOutOfDate|allow_out_of_date/.test(readFileSync(join(REPOSITORY_ROOT, path), 'utf8')));
    expect(found).toEqual([]);
  });

  it('the export has no confirmation dialog: nothing in its folder, the file route or the download client opens one', () => {
    const exportFiles = sourceFiles.filter((path) => path.startsWith('src/components/features/estimate-export/') || path.startsWith('src/lib/export/') || path.startsWith('src/server/export/') || path === 'src/server/services/export-service.ts');
    expect(exportFiles.length).toBeGreaterThan(5);
    const found = exportFiles.filter((path) => /alert-dialog|AlertDialog|role="alertdialog"|window\.confirm|\bconfirm\(/.test(readFileSync(join(REPOSITORY_ROOT, path), 'utf8')));
    expect(found).toEqual([]);
  });

});
