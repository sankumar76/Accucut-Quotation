import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.02 AC-7 (negative): in a production build /design-system returns "not found". The route is a
 * Next.js page, which Vitest cannot render, so this reads the wiring in a way that survives a reformat: each call
 * site uses the one gate with no argument. The gate itself is tested in tests/unit/shell-helpers.test.ts, and the
 * built output is checked in CI stage 9 (see the "Stage 9" step in .github/workflows/ci.yml).
 */

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const CALL_SITES = ['src/app/(portal)/design-system/page.tsx', 'src/app/(portal)/layout.tsx', 'src/app/(portal)/page.tsx'];

describe('design system route, AC-7', () => {
  it('AC-7: the page answers not found when the gate says it is unavailable', () => {
    const page = read('src/app/(portal)/design-system/page.tsx');
    expect(page).toMatch(/if\s*\(\s*!\s*isDesignSystemAvailable\(\)\s*\)\s*notFound\(\)/);
  });

  it('AC-7: the page, the menu and the home page all ask the same gate, with no argument of their own', () => {
    for (const site of CALL_SITES) {
      const source = read(site);
      expect(source, site).toMatch(/isDesignSystemAvailable\(\)/);
      expect(source, site).not.toMatch(/process\.env\.NODE_ENV/);
    }
  });

  it('AC-7: the page stays in the (portal) group, whose layout is the shell', () => {
    expect(CALL_SITES[0]).toContain('(portal)/design-system/');
  });
});
