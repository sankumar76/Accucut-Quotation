import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateWorkspace } from '@/components/features/estimate-workspace/estimate-workspace';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';

import { blocksOf, customProperties } from '../support/css-tokens';

/**
 * STORY-10.06 AC-1 and AC-3 (FR-087, NFR-023, UD-4) without a browser: the form area of SCR-05 holds exactly one reserved region, the third track after the tree and the form, that is empty,
 * hidden from the accessibility tree, not a landmark and not focusable, takes no space below 1024 px (the classes that do it are asserted here; the widths are measured in
 * `tests/e2e/estimate-layout.spec.ts`, as a static render has no viewport), and whose width is one token, `--drawing-region-width`, set to 0px now. Nothing here builds a viewer (FR-093 is Won't).
 */

// The workspace reads the router (the customer change and the leave guard) and the path; a static render has neither, and what is drawn does not use them.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const GLOBALS = readFileSync(fileURLToPath(new URL('../../src/app/globals.css', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const root = customProperties(blocksOf(GLOBALS, ':root')[0] ?? '');

const HEADER: WorkspaceHeaderView = {
  code: 'Q-2026-0318',
  status: 'DRAFT',
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  subject: 'Invented subject',
  customer: { name: 'Invented Customer', shortName: 'INV' },
  notes: null,
  assignedByName: 'Invented Lead',
};

const render = (customer: { name: string; shortName: string } | null): string => renderToStaticMarkup(createElement(EstimateWorkspace, { header: { ...HEADER, customer }, estimateId: '00000000-0000-4000-8000-000000000001' }));

/** Every element that carries the marker, as its opening tag and its inner text: a static render has no DOM, so the markup is read with a pattern that the one marker makes exact. */
function regionsOf(html: string): { readonly tag: string; readonly inner: string }[] {
  return [...html.matchAll(/<div\b([^>]*\bdata-drawing-region=""[^>]*)>([\s\S]*?)<\/div>/g)].map((match) => ({ tag: match[1] ?? '', inner: match[2] ?? '' }));
}

describe('AC-1: one reserved region, the third track of the form area', () => {
  it('AC-1: exactly one region, and it comes after the parts tree and the form in the row', () => {
    const html = render({ name: 'Invented Customer', shortName: 'INV' });
    expect(regionsOf(html)).toHaveLength(1);
    expect(html.split('data-drawing-region').length - 1).toBe(1);
    expect(html.indexOf('data-drawing-region')).toBeGreaterThan(html.indexOf('data-part-form'));
    expect(html.indexOf('data-drawing-region')).toBeGreaterThan(html.indexOf('Parts tree'));
  });

  it('AC-1: it is there with no customer too (the form area is the same card and is open: CR-01 item 6 removed the customer gate)', () => {
    expect(regionsOf(render(null))).toHaveLength(1);
  });

  it('AC-1: below 1024 px it is hidden by CSS (`hidden`, then `lg:block`), so it takes no space and is not in the accessibility tree', () => {
    const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));
    const classes = /class="([^"]*)"/.exec(region?.tag ?? '')?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain('hidden');
    expect(classes).toContain('lg:block');
    expect(classes).toContain('lg:shrink-0');
  });

  it('AC-1: its width is the token and the token is 0px now, defined once in globals.css :root', () => {
    const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));
    expect(region?.tag).toContain('lg:w-(--drawing-region-width)');
    expect(root.get('--drawing-region-width')).toBe('0px');
    expect(GLOBALS.match(/--drawing-region-width\s*:/g)).toHaveLength(1);
  });

  it('AC-1: the gap is carried by the region, not by the row: a zero-width flex item still takes the row gap, so the region takes the gap back while it is zero wide', () => {
    const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));
    // The margin is `min(0, width - gap)`: it cancels the row's gap at 0px and is 0 again from one gap of width.
    expect(region?.tag).toContain('lg:ml-[min(0px,calc(var(--drawing-region-width)_-_var(--s-4)))]');
  });

  it('AC-2: the region is held to what is left after the tree, one 232 px card and two gaps, so a 340px token never squeezes the form below one card at 1024 px', () => {
    const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));
    expect(region?.tag).toContain('lg:max-w-[calc(100%_-_var(--tree-w)_-_14.5rem_-_2*var(--s-4))]');
  });

  it('AC-1: the product sets no override: the region has no inline style (the browser test sets the token itself, A-2)', () => {
    const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));
    expect(region?.tag).not.toContain('style=');
  });
});

describe('AC-3: nothing to read, nothing to reach', () => {
  const [region] = regionsOf(render({ name: 'Invented Customer', shortName: 'INV' }));

  it('AC-3: empty: no text, no child element (so no icon, button or placeholder)', () => {
    expect(region?.inner).toBe('');
  });

  it('AC-3: aria-hidden="true", and not a landmark: not an aside, no role, no label', () => {
    expect(region?.tag).toContain('aria-hidden="true"');
    expect(region?.tag).not.toMatch(/\brole=/);
    expect(region?.tag).not.toMatch(/\baria-label/);
    expect(region?.tag).not.toMatch(/\btabindex=/);
    const html = render({ name: 'Invented Customer', shortName: 'INV' });
    expect(html).not.toMatch(/<aside\b/);
  });

  it('AC-3: the region is a div, so it is not a landmark by its element either', () => {
    expect(render({ name: 'Invented Customer', shortName: 'INV' })).toMatch(/<div\b[^>]*data-drawing-region=""/);
  });
});
