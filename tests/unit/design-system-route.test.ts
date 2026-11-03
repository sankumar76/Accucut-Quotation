import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.02 AC-7 (negative): in a production build /design-system returns "not found". The route is a
 * Next.js page, which Vitest cannot render, so this reads the wiring; the behaviour itself was checked
 * against a real `next build` and `next start` (Dev Record). The gate's own rule is tested in
 * tests/unit/shell-helpers.test.ts.
 */

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('design system route, AC-7', () => {
  it('AC-7: the page answers not found when the gate says it is unavailable', () => {
    const page = read('src/app/(portal)/design-system/page.tsx');
    expect(page).toContain("if (!isDesignSystemAvailable(process.env.NODE_ENV)) notFound();");
  });

  it('AC-7: the menu lists the design system only where the route exists', () => {
    const layout = read('src/app/(portal)/layout.tsx');
    expect(layout).toContain('isDesignSystemAvailable(process.env.NODE_ENV) ? [work, review] : [work]');
  });

  it('AC-7: the home page offers the link only where the route exists', () => {
    expect(read('src/app/(portal)/page.tsx')).toContain('isDesignSystemAvailable(process.env.NODE_ENV)');
  });
});
