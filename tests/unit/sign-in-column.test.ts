import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SignInForm } from '@/components/features/auth/sign-in-form';

/**
 * AQP-459 (DEF-102; UX spec SCR-01, the ux-expert's check C-01-01 and C-01-02): the sign-in card is in a centred column of about 480 px at every width, and the E-mail field has no placeholder. The column was meant
 * to be `max-w-120`, but the spacing scale is replaced (`--spacing-*: initial` in `globals.css`, the same trap as #395), so that class draws nothing and the page spanned the whole width: the column is a named token now.
 * The widths as drawn are `tests/e2e/sign-in.spec.ts`. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => undefined }) }));

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('AQP-459: the centred column of about 480 px', () => {
  it('names the width as a token, because the default spacing scale is off and max-w-120 draws nothing', () => {
    const css = read('src/app/globals.css');
    expect(css).toMatch(/--column-w:\s*480px;/);
    expect(css).toContain('--spacing-*: initial;');
  });

  it.each(['src/app/(public)/sign-in/page.tsx', 'src/components/features/auth/public-page-frame.tsx'])('%s puts its main in that column (the card 480 px wide, the gutters added), centred, and uses no max-w-120', (path) => {
    const source = read(path);
    expect(source).toMatch(/<main[^>]*className="[^"]*\bmx-auto\b[^"]*\bw-full\b[^"]*\bmax-w-\[calc\(var\(--column-w\)\+var\(--s-4\)\*2\)\]/);
    expect(source).not.toContain('max-w-120');
  });
});

describe('AQP-459: the E-mail field has no placeholder', () => {
  it('draws the field with its label and no placeholder text', () => {
    const html = renderToStaticMarkup(createElement(SignInForm, { returnTo: '/queue' }));
    expect(html).toContain('type="email"');
    expect(html).not.toMatch(/ placeholder="/);
    expect(html).not.toContain('name@company.com');
  });
});
