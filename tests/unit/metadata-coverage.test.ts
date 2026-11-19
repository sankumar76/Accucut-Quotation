/// <reference types="vite/client" />
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { metadataProblems, type PageMetadataLike } from '../support/head-tags';

/**
 * STORY-10.03 (AQP-308) AC-5, with AC-1 to AC-4 read on the real pages: a static scan lists every `page.tsx` under `src/app` and fails when one has no
 * `metadata` or `generateMetadata` of its own, or does not build it with the `pageMetadata` helper. The scan reads the folder as it is, so a page added
 * later (the formula editor of EPIC-08, the About page) is covered with no edit here, and a route that does not exist yet cannot fail it. It also
 * loads each page and applies the rules to the `metadata` object the page really exports, so a title over the limit or a customer name in a description
 * is caught here and not only in the browser (`tests/e2e/metadata.spec.ts` reads the HTML of the built app, AC-6). Every name is invented.
 */

const APP_DIRECTORY = fileURLToPath(new URL('../../src/app/', import.meta.url));
// The least number of pages the scan must find: a scan that read nothing would pass for the wrong reason. Raise it when a story adds pages; never lower it.
const LEAST_PAGES = 18;

const read = (path: string): string => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

/** The files under `src/app` whose path matches, as paths relative to it with forward slashes. */
function listFiles(pattern: RegExp): string[] {
  return readdirSync(APP_DIRECTORY, { recursive: true, encoding: 'utf8' })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => pattern.test(path))
    .sort();
}

/** Every `page.tsx` under `src/app`. */
const listPages = (): string[] => listFiles(/(^|\/)page\.(tsx|ts|jsx|js)$/);

/** The system pages of SCR-26 that a route group or the app serves. */
const listSystemPages = (): string[] => listFiles(/(^|\/)(not-found|forbidden|unauthorized)\.tsx$/);

/** The source with comments removed, so a word in a comment does not count as code. */
const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const OWN_EXPORT = /^export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b|const\s+generateMetadata\b)/m;

/** AC-5: what a page's source must hold, as a list of problems. */
function pageSourceProblems(source: string): string[] {
  const code = withoutComments(source);
  const problems: string[] = [];
  if (!OWN_EXPORT.test(code)) problems.push('has no `export const metadata` or `export function generateMetadata`');
  else if (!/\bpageMetadata\(/.test(code)) problems.push('does not build its metadata with `pageMetadata` (src/lib/page-metadata.ts)');
  return problems;
}

describe('the static scan of pages (AC-5)', () => {
  const pages = listPages();

  it('AC-5: finds the pages it is meant to guard, so a scan that read nothing cannot pass', () => {
    expect(pages.length).toBeGreaterThanOrEqual(LEAST_PAGES);
    expect(pages).toContain('(public)/sign-in/page.tsx');
    expect(pages).toContain('(portal)/queue/page.tsx');
    expect(pages).toContain('(portal)/estimates/[code]/page.tsx');
  });

  it.each(pages)('AC-5: %s has its own metadata, built with pageMetadata', (page) => {
    expect(pageSourceProblems(read(`${APP_DIRECTORY}${page}`)), page).toEqual([]);
  });

  // SCR-26 (AC-1 names the system pages). `error.tsx` is a client component, which cannot export metadata: the page that failed has already been given its own tags
  // by the layout, and the card says what happened in its heading. Every other system page has its own words.
  const systemPages = listSystemPages();

  it('AC-1: finds the system pages, so a scan that read nothing cannot pass', () => {
    expect(systemPages).toEqual(['(portal)/forbidden.tsx', '(portal)/not-found.tsx', 'not-found.tsx', 'unauthorized.tsx']);
  });

  it.each(systemPages)('AC-1: the system page %s has its own metadata, built with pageMetadata', (page) => {
    expect(pageSourceProblems(read(`${APP_DIRECTORY}${page}`)), page).toEqual([]);
  });

  it('AC-5: a page that is added with no metadata is caught', () => {
    expect(pageSourceProblems("export default function Page() { return null; }")).toHaveLength(1);
  });

  it('AC-5: a page that inherits the root default is caught: the root default is not a page title', () => {
    expect(pageSourceProblems("export const dynamic = 'force-dynamic';\nexport default function Page() { return null; }")).toHaveLength(1);
  });

  it('AC-5: a metadata export that is only in a comment or in a string is caught', () => {
    expect(pageSourceProblems('// export const metadata = pageMetadata("A", "B");\nexport default function Page() { return null; }')).toHaveLength(1);
    expect(pageSourceProblems('/* export const metadata = pageMetadata("A", "B"); */\nexport default function Page() { return null; }')).toHaveLength(1);
  });

  it('AC-5: a metadata export that does not use the helper is caught', () => {
    expect(pageSourceProblems("export const metadata = { title: 'Users' };\nexport default function Page() { return null; }")).toEqual([
      'does not build its metadata with `pageMetadata` (src/lib/page-metadata.ts)',
    ]);
  });

  it('AC-5: both ways of having metadata pass: a constant, and a function (for a page whose words depend on the address)', () => {
    expect(pageSourceProblems("export const metadata = pageMetadata('Users', 'Manage users.');")).toEqual([]);
    expect(pageSourceProblems("export async function generateMetadata() { return pageMetadata('Users', 'Manage users.'); }")).toEqual([]);
    expect(pageSourceProblems("export function generateMetadata() { return pageMetadata('Users', 'Manage users.'); }")).toEqual([]);
  });
});

describe('no sitemap and no robots file (AC-2)', () => {
  it('AC-2: the app has no sitemap or robots route, and the public folder has no sitemap.xml or robots.txt', () => {
    expect(listFiles(/(^|\/)(sitemap|robots)\.(tsx?|jsx?|xml|txt)$/)).toEqual([]);
    const publicFiles = readdirSync(fileURLToPath(new URL('../../public/', import.meta.url)), { recursive: true, encoding: 'utf8' });
    expect(publicFiles.filter((file) => /^(sitemap.*\.xml|robots\.txt)$/i.test(file))).toEqual([]);
  });
});

// The pages are loaded to read the object they export. Their imports reach the server's composition root, which builds nothing until a service is asked for; a page's
// guard and services are never called here, so this stands in for the composition and lets the module load.
vi.mock('@/server/composition', () => new Proxy({}, { get: (_target, name) => (name === 'then' ? undefined : () => ({})) }));

/** What a page file exports that the rules read. */
interface PageModule {
  readonly metadata?: PageMetadataLike;
  readonly generateMetadata?: () => Promise<PageMetadataLike> | PageMetadataLike;
}

// Vite lists the files at transform time, so no import path is computed (ADR-010, CONSTRAINT-02). The folder is read as it is: a page added later is loaded with no edit here.
const LOADERS = import.meta.glob<PageModule>('../../src/app/**/{page,not-found,forbidden,unauthorized}.tsx');
const LOADER_PREFIX = '../../src/app/';

describe('the metadata the pages really export (AC-1, AC-3, AC-4)', () => {
  const files = [...listPages(), ...listSystemPages()];

  it('AC-1: loads exactly the files that the scan lists', () => {
    expect(Object.keys(LOADERS).map((key) => key.replace(LOADER_PREFIX, '')).sort()).toEqual([...files].sort());
  });

  // The first load of the app's module graph is slow, so every page is loaded in a hook, under the shared hook limit (vitest.config.ts, DL-057), and the tests read what was loaded.
  const modules = new Map<string, PageModule>();
  beforeAll(async () => {
    for (const file of files) {
      const load = LOADERS[`${LOADER_PREFIX}${file}`];
      if (load === undefined) throw new Error(`${file} has no loader`);
      modules.set(file, await load());
    }
  });

  it.each(files)('AC-1, AC-3, AC-4: %s exports metadata that passes every rule', async (file) => {
    const loaded = modules.get(file) ?? {};
    const exported = loaded.metadata ?? (loaded.generateMetadata === undefined ? undefined : await loaded.generateMetadata());
    expect(exported, `${file} exports no metadata`).toBeDefined();
    expect(metadataProblems(exported as PageMetadataLike), file).toEqual([]);
  });
});
