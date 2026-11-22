import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateExport } from '@/components/features/estimate-export/estimate-export';
import { QueueList } from '@/components/features/queues/queue-list';
import { DownloadChip } from '@/components/shared/download-chip';
import { readDownloadMarker, type DownloadChipData } from '@/lib/export/download-marker-view';
import { readDownloadMarkers } from '@/lib/tasks/download-markers-client';
import type { QueueRowData } from '@/lib/tasks/queue-client';
import type { ExportSummaryView } from '@/server/views/schemas/export';

/**
 * STORY-CR01.7E AC-5, AC-7 without a browser: the one chip that SCR-10, SCR-06's header and the Closed tab draw, in its three states, with the words written out here from the UX spec (section 0.9 row 7c) and not imported,
 * so a changed sentence fails a test. The amber state is told in words and an icon, never by colour alone. Layouts at 360, 768 and 1366 px and axe are `tests/e2e/download-marker.spec.ts`. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const LAST = { byName: 'Invented Lead', at: '2026-11-23T04:30:00.000Z' };
const WHEN = '23 Nov 2026, 10:00 IST';
const chip = (marker: DownloadChipData, explain = false): string => renderToStaticMarkup(createElement(DownloadChip, { marker, explain }));

describe('the chip', () => {
  it('says "Not downloaded" and nothing else when there is no download', () => {
    const html = chip({ kind: 'none' });
    expect(html).toContain('Not downloaded');
    expect(html).toContain('data-marker="none"');
    expect(html).not.toContain('Last downloaded');
  });

  it('says "Downloaded 3×" with the last person and the time in IST', () => {
    const html = chip({ kind: 'downloaded', count: 3, last: LAST });
    expect(html).toContain('Downloaded 3×');
    expect(html).toContain(`Last downloaded by Invented Lead, ${WHEN}`);
    expect(html).toContain('data-marker="downloaded"');
  });

  it('says "Changed since download" in amber, with a warning icon, and still says how many and who downloaded last (AC-7: words and an icon, not colour alone)', () => {
    const html = chip({ kind: 'changed', count: 2, last: LAST });
    expect(html).toContain('Changed since download');
    expect(html).toContain('Downloaded 2×. Last downloaded by Invented Lead');
    expect(html).toContain('data-marker="changed"');
    // The amber badge tone of the design system, and an icon inside it (lucide draws an svg that is hidden from a screen reader).
    expect(html).toMatch(/<span data-slot="badge" class="[^"]*accent-soft[^"]*"><svg[^>]*aria-hidden="true"/);
  });

  it('says why it is amber only when asked (SCR-10), in the same words', () => {
    expect(chip({ kind: 'changed', count: 1, last: LAST })).not.toContain('may not match');
    expect(chip({ kind: 'changed', count: 1, last: LAST }, true)).toContain('The approval changed after the last download, so the file the customer has may not match the current approved price.');
    expect(chip({ kind: 'downloaded', count: 1, last: LAST }, true)).not.toContain('may not match');
  });

  it('wraps (no sideways scroll on a phone), is no landmark or group of its own, and holds no figure, price or ID', () => {
    const html = chip({ kind: 'changed', count: 2, last: LAST });
    expect(html).not.toContain('role=');
    expect(html).toContain('flex-wrap');
    expect(html).not.toMatch(/₹|\bprice\b|[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe('the readers of the browser', () => {
  it('reads each of the three markers, and nothing else', () => {
    expect(readDownloadMarker({ kind: 'none' })).toEqual({ kind: 'none' });
    expect(readDownloadMarker({ kind: 'downloaded', count: 2, last: LAST })).toEqual({ kind: 'downloaded', count: 2, last: LAST });
    expect(readDownloadMarker({ kind: 'changed', count: 1, last: LAST })).toEqual({ kind: 'changed', count: 1, last: LAST });
  });

  it.each([
    ['not an object', 'none'],
    ['an unknown kind', { kind: 'quoted' }],
    ['a count of 0 with a kind that needs a download', { kind: 'downloaded', count: 0, last: LAST }],
    ['a fractional count', { kind: 'downloaded', count: 1.5, last: LAST }],
    ['no last download', { kind: 'changed', count: 1 }],
    ['a last download with no person', { kind: 'changed', count: 1, last: { byName: '', at: LAST.at } }],
    ['a last download with a time that is none', { kind: 'changed', count: 1, last: { byName: 'X', at: 'yesterday' } }],
  ])('refuses %s: a screen never draws a guess', (_title, value) => {
    expect(readDownloadMarker(value)).toBeNull();
  });

  it('reads the answer of the route by task, and refuses a body with one entry that is not a marker', () => {
    expect(readDownloadMarkers({ markers: [{ taskId: 'a', marker: { kind: 'none' } }, { taskId: 'b', marker: { kind: 'downloaded', count: 1, last: LAST } }] })).toEqual({
      a: { kind: 'none' },
      b: { kind: 'downloaded', count: 1, last: LAST },
    });
    expect(readDownloadMarkers({ markers: [] })).toEqual({});
    expect(readDownloadMarkers({ markers: [{ taskId: 'a', marker: { kind: 'bogus' } }] })).toBeNull();
    expect(readDownloadMarkers({ markers: [{ marker: { kind: 'none' } }] })).toBeNull();
    expect(readDownloadMarkers({})).toBeNull();
  });
});

const row = (overrides: Partial<QueueRowData> = {}): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-05T11:30:00.000Z',
  status: 'APPROVED',
  assignedByName: 'Invented Boss',
  ...overrides,
});
const AS_OF = '2026-11-09T04:00:00.000Z';
const count = (html: string, text: string): number => html.split(text).length - 1;

describe('AC-5: the Closed tab rows', () => {
  const list = (props: Partial<Parameters<typeof QueueList>[0]>): string =>
    renderToStaticMarkup(createElement(QueueList, { role: 'LEAD', tasks: [row()], asOf: AS_OF, ...props }));

  it('draws the chip of a closed row under "Closed" in the table and on the phone\'s card, from the same marker', () => {
    const html = list({ markers: { [row().id]: { kind: 'downloaded', count: 2, last: LAST } } });
    // Once in the table and once in the card.
    expect(count(html, 'Downloaded 2×')).toBe(2);
    expect(count(html, `Last downloaded by Invented Lead, ${WHEN}`)).toBe(2);
  });

  it('says the marker is unavailable, never "Not downloaded", when the markers could not be read or a row has none', () => {
    expect(count(list({ markers: 'unavailable' }), 'Download status unavailable.')).toBe(2);
    expect(count(list({ markers: {} }), 'Download status unavailable.')).toBe(2);
    expect(list({ markers: 'unavailable' })).not.toContain('Not downloaded');
  });

  it('draws no chip for an Engineer, who is given no markers, and none for an open row', () => {
    expect(list({ role: 'ENGINEER' })).not.toContain('download');
    expect(list({ tasks: [row({ status: 'DRAFT' })], markers: {} })).not.toContain('Download status');
  });
});

describe('AC-5: SCR-10', () => {
  const summary = (overrides: Partial<ExportSummaryView> = {}): ExportSummaryView => ({
    fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
    partCount: 1,
    pictureCount: 0,
    columns: { first: 'A', last: 'BO', count: 67 },
    rows: [{ slNo: '1', name: 'Base', count: null }],
    state: 'current',
    figures: null,
    warning: null,
    download: { kind: 'none' },
    ...overrides,
  });
  const page = (view: ExportSummaryView): string => renderToStaticMarkup(createElement(EstimateExport, { summary: view, estimateId: '00000000-0000-4000-8000-0000000e5701', code: 'Q-2026-0701' }));

  it('shows the chip in the page whatever the state of the figures, with the reason when amber', () => {
    expect(page(summary())).toContain('Not downloaded');
    expect(page(summary({ state: 'out-of-date' }))).toContain('Not downloaded');
    const amber = page(summary({ download: { kind: 'changed', count: 2, last: LAST } }));
    expect(amber).toContain('Changed since download');
    expect(amber).toContain('may not match the current approved price');
  });

  it('shows no chip for an estimate with no parts: there is nothing to download', () => {
    expect(page(summary({ partCount: 0, rows: [] }))).not.toContain('Not downloaded');
  });
});
