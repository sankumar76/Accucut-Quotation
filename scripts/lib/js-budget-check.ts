/**
 * Judges one route against the JS budget and writes the result table (STORY-10.10 AC-1 and AC-2).
 *
 * The HTTP side is injected (`PageFetcher`), so everything here is a function of what the pages answered and what the
 * build wrote. A route is requested without a session first. A page that answers 200 is measured as it is. A page that
 * redirects needs sign-in, and is then requested as every role the route allows, and the largest total counts. Sign-in
 * is therefore needed only when a route asks for it.
 */
import {
  BYTES_PER_KB,
  DEFAULT_LIMIT_BYTES,
  ROUTE_LIMITS,
  limitFor,
  measureFirstLoad,
  type LimitEntry,
  type StaticReader,
} from './js-budget';
import type { RouteKind, RouteTarget } from './js-budget-routes';

export interface Viewer {
  /** `anonymous`, or a role name such as `ADMIN`. */
  readonly name: string;
  readonly isSignedIn: boolean;
}

export const ANONYMOUS: Viewer = { name: 'anonymous', isSignedIn: false };

export interface Observation {
  readonly status: number;
  readonly html: string;
  /** For a redirect: the `Location` header, as given. */
  readonly location?: string | undefined;
}

/** Requests a path as a viewer and returns the answer without following a redirect. */
export type PageFetcher = (path: string, viewer: Viewer) => Promise<Observation>;

export interface RouteRow {
  readonly route: string;
  readonly kind: RouteKind;
  readonly ok: boolean;
  /** Why it failed, or a remark on a pass. */
  readonly note: string;
  /** The viewer whose total counts: the largest. */
  readonly viewer?: string;
  readonly files?: number;
  readonly rawBytes?: number;
  readonly gzipBytes?: number;
  readonly limit?: number;
  readonly headroom?: number;
}

const NOT_FOUND = 404;
const OK = 200;
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

export interface CheckOptions {
  readonly read: StaticReader;
  readonly limits?: Readonly<Record<string, LimitEntry>>;
  /** The origin the pages were served from; a script on another origin cannot be read from `.next/static`. */
  readonly origin?: string;
}

function expectedStatus(kind: RouteKind): number {
  return kind === 'page' ? OK : NOT_FOUND;
}

function describeAnswer(observation: Observation): string {
  if (!REDIRECTS.has(observation.status)) return `HTTP ${observation.status}`;
  const target = observation.location === undefined ? '' : ` to ${pathOnly(observation.location)}`;
  return `a redirect (HTTP ${observation.status}${target})`;
}

/** The path of a `Location`, without its query, so a return address never reaches the report. */
function pathOnly(location: string): string {
  try {
    return new URL(location, 'http://js-budget.invalid').pathname;
  } catch {
    return '(unreadable)';
  }
}

function failure(target: RouteTarget, note: string): RouteRow {
  return { route: target.route, kind: target.kind, ok: false, note };
}

/** Requests the target as the anonymous viewer and, if it asks for sign-in, as every role allowed on it. */
async function observe(target: RouteTarget, path: string, fetchPage: PageFetcher): Promise<ReadonlyArray<readonly [Viewer, Observation]>> {
  const anonymous = await fetchPage(path, ANONYMOUS);
  if (!REDIRECTS.has(anonymous.status)) return [[ANONYMOUS, anonymous]];
  const signedIn: Array<readonly [Viewer, Observation]> = [];
  for (const role of target.roles) {
    const viewer: Viewer = { name: role, isSignedIn: true };
    signedIn.push([viewer, await fetchPage(path, viewer)]);
  }
  return signedIn;
}

function wrongAnswers(kind: RouteKind, answers: ReadonlyArray<readonly [Viewer, Observation]>): string[] {
  const expected = expectedStatus(kind);
  return answers
    .filter(([, observation]) => observation.status !== expected)
    .map(([viewer, observation]) => `${viewer.name} got ${describeAnswer(observation)}, not HTTP ${expected}`);
}

/**
 * Requests one target and judges it. Anything that stops it being measured is a failed row with its reason: a request
 * that does not complete, an answer other than the expected one, a script that cannot be found.
 */
export async function checkTarget(target: RouteTarget, fetchPage: PageFetcher, options: CheckOptions): Promise<RouteRow> {
  if (target.problem !== undefined || target.path === undefined) return failure(target, target.problem ?? 'the route has no request path');
  let answers: ReadonlyArray<readonly [Viewer, Observation]>;
  try {
    answers = await observe(target, target.path, fetchPage);
  } catch (error) {
    // The class and message of a request error name the cause (a refused connection, a failed sign-in); they hold no secret.
    return failure(target, `the request did not complete: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  if (answers.length === 0) return failure(target, 'the route needs sign-in and no role is allowed on it');
  const wrong = wrongAnswers(target.kind, answers);
  if (wrong.length > 0) return failure(target, wrong.join('; '));
  if (target.kind === 'hidden') return { route: target.route, kind: target.kind, ok: true, note: 'answers 404 as required (hidden in production); not measured' };
  return measureAnswers(target, answers, options);
}

function measureAnswers(target: RouteTarget, answers: ReadonlyArray<readonly [Viewer, Observation]>, options: CheckOptions): RouteRow {
  const limit = limitFor(target.route, options.limits ?? ROUTE_LIMITS);
  let largest: { readonly viewer: string; readonly files: number; readonly rawBytes: number; readonly gzipBytes: number } | undefined;
  for (const [viewer, observation] of answers) {
    const counted = measureFirstLoad(observation.html, options.read, options.origin);
    if (!counted.ok) return failure(target, `${viewer.name}: ${counted.problems.join('; ')}`);
    if (largest === undefined || counted.gzipBytes > largest.gzipBytes) {
      largest = { viewer: viewer.name, files: counted.files.length, rawBytes: counted.rawBytes, gzipBytes: counted.gzipBytes };
    }
  }
  if (largest === undefined) return failure(target, 'nothing was measured');
  const headroom = limit - largest.gzipBytes;
  const base = { route: target.route, kind: target.kind, viewer: largest.viewer, files: largest.files, rawBytes: largest.rawBytes, gzipBytes: largest.gzipBytes, limit, headroom };
  return headroom >= 0 ? { ...base, ok: true, note: '' } : { ...base, ok: false, note: `over its limit by ${formatBytes(-headroom)} bytes` };
}

/** Checks every target one after the other, so the order of the table is the order of the targets. */
export async function checkTargets(targets: ReadonlyArray<RouteTarget>, fetchPage: PageFetcher, options: CheckOptions): Promise<RouteRow[]> {
  const rows: RouteRow[] = [];
  for (const target of targets) rows.push(await checkTarget(target, fetchPage, options));
  return rows;
}

/** `197138` becomes `197,138`: a fixed format, not the machine's locale. */
export function formatBytes(value: number): string {
  const sign = value < 0 ? '-' : '';
  return sign + Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const HEADER = ['Route', 'Result', 'Viewer', 'Files', 'Raw bytes', 'Gzip bytes', 'Limit', 'Headroom', 'Note'] as const;

function cells(row: RouteRow): string[] {
  const number = (value: number | undefined): string => (value === undefined ? 'n/a' : formatBytes(value));
  const kilobytes = row.gzipBytes === undefined ? '' : ` (${(row.gzipBytes / BYTES_PER_KB).toFixed(1)} KB)`;
  return [
    row.route,
    row.ok ? 'pass' : 'FAIL',
    row.viewer ?? 'n/a',
    row.files === undefined ? 'n/a' : String(row.files),
    number(row.rawBytes),
    `${number(row.gzipBytes)}${kilobytes}`,
    number(row.limit),
    number(row.headroom),
    row.note,
  ];
}

/** The table for the job summary. A `|` or a line break in a note would break a row, so both are replaced. */
export function rowsAsMarkdown(rows: ReadonlyArray<RouteRow>): string {
  const clean = (text: string): string => text.replaceAll('|', '/').replace(/\s+/g, ' ');
  const lines = [`| ${HEADER.join(' | ')} |`, `| ${HEADER.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${cells(row).map(clean).join(' | ')} |`);
  return lines.join('\n');
}

/** The same rows for the job log: one line each. */
export function rowsAsText(rows: ReadonlyArray<RouteRow>): string {
  return rows
    .map((row) => {
      const [route, result, , , , gzip, limit, headroom, note] = cells(row);
      return `${result === 'pass' ? 'PASS' : 'FAIL'}  ${route}  gzip ${gzip}  limit ${limit}  headroom ${headroom}${note === '' ? '' : `  ${note}`}`;
    })
    .join('\n');
}

export function failedRows(rows: ReadonlyArray<RouteRow>): RouteRow[] {
  return rows.filter((row) => !row.ok);
}

export function headline(rows: ReadonlyArray<RouteRow>): string {
  const failed = failedRows(rows).length;
  const limit = formatBytes(DEFAULT_LIMIT_BYTES);
  return failed === 0
    ? `JS budget: all ${rows.length} rows are within their limit (default ${limit} bytes gzip).`
    : `JS budget: ${failed} of ${rows.length} rows failed (default limit ${limit} bytes gzip): ${failedRows(rows).map((row) => row.route).join(', ')}.`;
}
