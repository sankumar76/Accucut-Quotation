import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TreeButtonLabel } from '@/components/features/estimate-workspace/tree-button-label';

/**
 * AQP-458 (DEF-101; UX spec SCR-05 "Responsive", the mock-up `SCR-05.html`): the button that opens the parts tree on a phone and a tablet shows the branch icon, "Parts tree" and, muted at the right, the number and
 * the name of the part that is open ("1.1 Base frame"); its accessible name reads "Parts tree 1.1 Base frame". A part with no name shows its kind's own name (DEF-089), as the tree's rows do. Every name is invented.
 */

const text = (html: string): string =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('AQP-458: the label of the parts tree button', () => {
  it('has the branch icon, "Parts tree", and the open part\'s number and name, so its name reads "Parts tree 1.1 Base frame"', () => {
    const html = renderToStaticMarkup(createElement(TreeButtonLabel, { slNo: '1.1', name: 'Base frame' }));
    expect(html).toContain('lucide-git-branch');
    expect(text(html)).toBe('Parts tree 1.1 Base frame');
    expect(html).toMatch(/<span[^>]*>Parts tree<\/span>/);
  });

  it('shows the kind\'s own name for a part with no name', () => {
    expect(text(renderToStaticMarkup(createElement(TreeButtonLabel, { slNo: '1.2', name: '  ', kindLabel: 'Sub-part' })))).toBe('Parts tree 1.2 Sub-part');
  });

  it('is just "Parts tree" while no part is known', () => {
    const html = renderToStaticMarkup(createElement(TreeButtonLabel, { slNo: null, name: '' }));
    expect(text(html)).toBe('Parts tree');
    expect(html).toContain('lucide-git-branch');
  });

  it('writes the part muted and on one line that cuts a long name, never wrapping the button', () => {
    const html = renderToStaticMarkup(createElement(TreeButtonLabel, { slNo: '1.1', name: 'Base frame' }));
    expect(html).toMatch(/<span[^>]*class="[^"]*text-ink-2[^"]*"[^>]*>1\.1 Base frame<\/span>/);
    expect(html).toContain('truncate');
  });
});
