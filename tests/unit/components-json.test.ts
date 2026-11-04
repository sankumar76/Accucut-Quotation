import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findDisallowedDataFiles } from '../../scripts/lib/data-files';

/**
 * The shadcn/ui CLI reads `components.json` to decide where a component goes and which helper it imports.
 * The architect's ruling on AQP-28 (Jira 10705): `aliases.utils` is `@/lib/cn`, so `npx shadcn add` output imports
 * the configured `cn` directly (the output is reviewed in the pull request like any other code).
 */

const schema = z.object({
  tsx: z.literal(true),
  rsc: z.literal(true),
  tailwind: z.object({ config: z.literal(''), css: z.literal('src/app/globals.css') }),
  aliases: z.object({ components: z.string(), utils: z.literal('@/lib/cn'), ui: z.literal('@/components/ui') }),
  iconLibrary: z.literal('lucide'),
});

const file = JSON.parse(readFileSync(fileURLToPath(new URL('../../components.json', import.meta.url)), 'utf8')) as unknown;

describe('components.json (shadcn/ui CLI settings)', () => {
  it('points the CLI at the token file, the ui folder and the configured cn helper', () => {
    expect(schema.safeParse(file).success).toBe(true);
  });

  it('is on the data-file allow-list (CI stage 3), as an exact path with a reason', () => {
    expect(findDisallowedDataFiles(['components.json'])).toEqual([]);
    expect(findDisallowedDataFiles(['docs/components.json'])).toHaveLength(1);
  });

  it('rejects the stock utils alias, so the test can fail', () => {
    const stock = { ...(file as object), aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui' } };
    expect(schema.safeParse(stock).success).toBe(false);
  });
});
