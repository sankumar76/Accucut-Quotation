import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReviewTree } from '@/components/features/estimate-review/review-tree';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * PF-23 (d) of the ux ruling, section 11 (AQP-506, DEF-149, #845): the Lead's row links use `replace` **only where the page is guarded** (the review while it is editable, where the leave guard counts its own
 * history entry); the Approved, Quoted and Ignored reviews have no guard and keep their own behaviour, so a row link there still pushes an entry. Next's `Link` is stood in for by an anchor that shows whether it
 * was asked to replace, since `replace` is not in the markup. Invented rows only.
 */

vi.mock('next/link', () => ({
  default: ({ href, replace, children }: { readonly href: string; readonly replace?: boolean; readonly children?: ReactNode }) =>
    createElement('a', { href, 'data-replace': String(replace === true), 'data-row-link': '' }, children),
}));

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CE1 = defined(QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1'));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');

async function rowLinks(guarded: boolean | undefined): Promise<string[]> {
  const costs: CostsView = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
  const props = { code: 'Q-2026-0318', state: costs.state, letters: costs.letters, nodes: costs.nodes, warned: new Set<string>(), selectedSlNo: null, ...(guarded === undefined ? {} : { guarded }) };
  const html = renderToStaticMarkup(createElement(ReviewTree, props));
  return [...html.matchAll(/<a [^>]*data-row-link[^>]*>/g)].map((match) => match[0]);
}

describe('PF-23 (d): the row links replace only on a guarded page', () => {
  it('a guarded page (the editable review): every row link replaces', async () => {
    const links = await rowLinks(true);
    expect(links.length).toBeGreaterThan(1);
    expect(links.every((link) => link.includes('data-replace="true"'))).toBe(true);
  });

  it('a page without the guard (Approved, Quoted, Ignored): every row link still pushes, and so does a tree that is not told', async () => {
    for (const guarded of [false, undefined]) {
      const links = await rowLinks(guarded);
      expect(links.length).toBeGreaterThan(1);
      expect(links.every((link) => link.includes('data-replace="false"'))).toBe(true);
    }
  });

  it('the review hands its tree the same flag that decides whether its inputs are editable, so the two cannot disagree', () => {
    const text = source('src/components/features/estimate-review/estimate-review.tsx');
    expect(text).toMatch(/const editable = canEditInputs\(/);
    expect(text).toContain('guarded={editable}');
    expect(source('src/components/features/estimate-review/review-tree.tsx')).toContain('replace={guarded}');
  });
});
