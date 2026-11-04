/**
 * First-load JavaScript budget (NFR-009; test strategy section 10.1; STORY-10.10 AC-1 and AC-3).
 *
 * The rule: the JavaScript a page asks for in its first load, compressed, is at most 200,000 bytes. This module counts
 * it the way the AQP-28 review did (`gzip -9` of the files a page names), from the page's HTML and the build output,
 * so the number is the same on every machine and no clock is involved. The routes, the viewers and the HTTP requests
 * are in the other `js-budget-*` modules; the limit table is here, in one place.
 */
import { gzipSync } from 'node:zlib';

/** NFR-009: 200 KB of gzip JavaScript per route, with 1 KB = 1,000 bytes. */
export const DEFAULT_LIMIT_BYTES = 200_000;
export const BYTES_PER_KB = 1_000;
/** The same compression level as the `gzip -9` of the AQP-28 review (test strategy section 10.1). */
export const GZIP_LEVEL = 9;
/** Where the build writes the files a page loads. The URL path starts with this and the file is under `.next/static`. */
export const STATIC_URL_PREFIX = '/_next/static/';

/** A made-up origin used only to resolve a URL found in the HTML; a URL that leaves it is not a file of this build. */
const PROBE_ORIGIN = 'http://js-budget.invalid';
const DECISION_ID = /^DL-\d{3,}$/;

/**
 * A limit that differs from the default. A raised limit needs the product-manager's recorded decision and the
 * Lighthouse run that met the targets; a lowered one needs the run that missed them (AC-3).
 */
export interface LimitEntry {
  readonly limitBytes: number;
  /** Decision-log ID, for example `DL-123`. */
  readonly decision: string;
  /** A link or ID that finds the Lighthouse run. */
  readonly lighthouseRun: string;
  readonly lighthouseResult: 'met' | 'missed';
}

/**
 * Per-route limits, keyed by route (`/queue`, or `not-found`). No route has an exception when STORY-10.10 merges. An
 * entry is a reviewed change to this file, and `limitTableProblems` fails it unless it names its decision.
 */
// NEGATIVE CONTROL (AQP-169 AC-5), never merged: /queue is about 198,229 bytes, so a limit of 150,000 must fail step 11b.
export const ROUTE_LIMITS: Readonly<Record<string, LimitEntry>> = {
  '/queue': { limitBytes: 150_000, decision: 'DL-999', lighthouseRun: 'negative-control-never-merged', lighthouseResult: 'missed' },
};

/** One line per entry that breaks the rules of AC-3; empty when the table is acceptable. */
export function limitTableProblems(table: Readonly<Record<string, LimitEntry>>): string[] {
  return Object.entries(table).flatMap(([route, entry]) => {
    const problems: string[] = [];
    if (!Number.isInteger(entry.limitBytes) || entry.limitBytes <= 0) {
      problems.push(`${route}: the limit ${entry.limitBytes} is not a positive whole number of bytes`);
    }
    if (entry.limitBytes === DEFAULT_LIMIT_BYTES) problems.push(`${route}: the entry equals the default, so it is not an exception: remove it`);
    if (!DECISION_ID.test(entry.decision)) problems.push(`${route}: no product-manager decision ID (DL-nnn) is named`);
    if (entry.lighthouseRun.trim() === '') problems.push(`${route}: no Lighthouse run is named`);
    if (entry.limitBytes > DEFAULT_LIMIT_BYTES && entry.lighthouseResult !== 'met') {
      problems.push(`${route}: a raised limit needs a Lighthouse run that met the targets`);
    }
    if (entry.limitBytes < DEFAULT_LIMIT_BYTES && entry.lighthouseResult !== 'missed') {
      problems.push(`${route}: a lowered limit needs a Lighthouse run that missed the targets`);
    }
    return problems;
  });
}

/** The limit for a route: its table entry, else the default. */
export function limitFor(route: string, table: Readonly<Record<string, LimitEntry>> = ROUTE_LIMITS): number {
  return table[route]?.limitBytes ?? DEFAULT_LIMIT_BYTES;
}

type Attributes = ReadonlyMap<string, string>;

/** A script element (whose body is skipped, so a tag named inside inline script text is never read) or a link element. */
const SCRIPT_OR_LINK = /<script\b([^>]*)>[\s\S]*?<\/script\s*>|<link\b([^>]*)>/gi;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttributes(text: string): Attributes {
  const attributes = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function decodeEntities(value: string): string {
  return value.replaceAll('&amp;', '&').replaceAll('&#38;', '&').replaceAll('&#x26;', '&');
}

function tokens(value: string | undefined): ReadonlyArray<string> {
  return (value ?? '').toLowerCase().split(/\s+/).filter((token) => token !== '');
}

/**
 * The distinct URLs of the scripts a page loads first, in the order they appear: `<script src>` without a `nomodule`
 * attribute, and `<link rel="preload">` or `<link rel="modulepreload">` with `as="script"` (AC-1). Inline scripts (the
 * RSC payload) have no `src` and are not counted. A URL used twice counts once.
 */
export function firstLoadScriptUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(SCRIPT_OR_LINK)) {
    if (match[1] !== undefined) {
      const attributes = parseAttributes(match[1]);
      const source = attributes.get('src');
      if (source !== undefined && source !== '' && !attributes.has('nomodule')) urls.add(decodeEntities(source));
    } else {
      const attributes = parseAttributes(match[2] ?? '');
      const relations = tokens(attributes.get('rel'));
      const isPreload = relations.includes('preload') || relations.includes('modulepreload');
      const href = attributes.get('href');
      if (isPreload && attributes.get('as')?.toLowerCase() === 'script' && href !== undefined && href !== '') urls.add(decodeEntities(href));
    }
  }
  return [...urls];
}

export type StaticPath = { readonly ok: true; readonly relative: string } | { readonly ok: false; readonly reason: string };

/**
 * The file under `.next/static` that a script URL names, or the reason it cannot be read from there. Only a path of
 * this application's static files qualifies: another origin, a path outside `/_next/static/` and a path that climbs
 * out of it are all refused, so nothing is read from a place the build did not write.
 */
export function staticPathOf(url: string, origin?: string): StaticPath {
  const base = origin ?? PROBE_ORIGIN;
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return { ok: false, reason: `the script URL "${url}" is not a valid URL` };
  }
  if (parsed.origin !== new URL(base).origin) {
    return { ok: false, reason: `the script "${url}" is on another origin, so it cannot be read from .next/static` };
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return { ok: false, reason: `the script path "${parsed.pathname}" is not valid` };
  }
  if (!pathname.startsWith(STATIC_URL_PREFIX)) {
    return { ok: false, reason: `the script "${pathname}" is not under ${STATIC_URL_PREFIX}, so it cannot be read from .next/static` };
  }
  const relative = pathname.slice(STATIC_URL_PREFIX.length);
  const segments = relative.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..') || /[\\\0]/.test(relative)) {
    return { ok: false, reason: `the script path "${pathname}" is not a plain path inside ${STATIC_URL_PREFIX}` };
  }
  return { ok: true, relative };
}

export function gzipBytes(content: Uint8Array): number {
  return gzipSync(content, { level: GZIP_LEVEL }).length;
}

export interface CountedFile {
  readonly url: string;
  readonly rawBytes: number;
  readonly gzipBytes: number;
}

export type FirstLoad =
  | { readonly ok: true; readonly files: ReadonlyArray<CountedFile>; readonly rawBytes: number; readonly gzipBytes: number }
  | { readonly ok: false; readonly problems: ReadonlyArray<string> };

/** Reads a file under `.next/static`; `undefined` when it does not exist. */
export type StaticReader = (relativePath: string) => Uint8Array | undefined;

/**
 * Counts the first-load JavaScript of one page from its HTML. Any file that cannot be found or read, and a page that
 * names no script at all (which would mean the page, or this parser, is not what it should be), is a problem: nothing
 * is left out quietly (AC-2).
 */
export function measureFirstLoad(html: string, read: StaticReader, origin?: string): FirstLoad {
  const urls = firstLoadScriptUrls(html);
  if (urls.length === 0) return { ok: false, problems: ['the page names no script in its first load, so there is nothing to measure'] };
  const files: CountedFile[] = [];
  const problems: string[] = [];
  for (const url of urls) {
    const path = staticPathOf(url, origin);
    if (!path.ok) {
      problems.push(path.reason);
      continue;
    }
    const content = read(path.relative);
    if (content === undefined) {
      problems.push(`the script ${STATIC_URL_PREFIX}${path.relative} is not in .next/static`);
      continue;
    }
    files.push({ url, rawBytes: content.byteLength, gzipBytes: gzipBytes(content) });
  }
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    files,
    rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  };
}
