import type { ForbiddenString } from './canary-masters';

/**
 * The cost-confidentiality scanner (STORY-01.03 T2, AC-3, AC-4; ADR-008 layer 5; test strategy section 6). It holds no
 * browser and no server: it is handed what was recorded (a status, headers and a text body per response) and the forbidden
 * list, and says what it found. That keeps it testable on its own, including against a planted leak, which is the point of
 * the negative control: a scanner that cannot find a planted leak must fail the suite (`tests/security/scanner.test.ts`).
 *
 * What is scanned, for every recorded response: the body as it came (HTML, JSON, JavaScript, CSS, an RSC payload fetched
 * with `RSC: 1`), the **decoded** payload inside an HTML page (`self.__next_f.push` strings, joined, so a value split
 * across two pushes is still one value), the headers and the URL. Typed values are allowed: the forbidden list holds only
 * Restricted values, names and formula markers, never what an Engineer typed.
 */

export interface RecordedResponse {
  /** What this was, for the failure message: `GET /queue (page)`. */
  readonly label: string;
  readonly url: string;
  readonly status: number;
  /** Header names in lower case. */
  readonly headers: Readonly<Record<string, string>>;
  /** The text of the body, or `null` for a body that is not text (an image, a font). */
  readonly body: string | null;
}

export type FindingPlace = 'body' | 'decoded RSC payload' | 'headers' | 'url';

export interface Finding {
  readonly label: string;
  readonly place: FindingPlace;
  readonly found: string;
  readonly reason: string;
}

/** The string pushes of the Next.js flight payload inside an HTML page: `self.__next_f.push([1,"..."])`. */
const FLIGHT_PUSH = /self\.__next_f\.push\(\[\s*1\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;

/** The text of the RSC flight payload in an HTML page, the pushes joined in order. Empty when the page carries none. */
export function decodeFlightPayload(html: string): string {
  const pieces: string[] = [];
  for (const match of html.matchAll(FLIGHT_PUSH)) {
    try {
      const piece: unknown = JSON.parse(match[1] ?? '""');
      if (typeof piece === 'string') pieces.push(piece);
    } catch {
      // A push that is not a JSON string is still in the raw body, which is scanned as it came.
    }
  }
  return pieces.join('');
}

/** The header block as one text, `name: value` per line, so a name or a value is found the same way. */
export function headersText(headers: Readonly<Record<string, string>>): string {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');
}

function findAll(text: string, forbidden: ReadonlyArray<ForbiddenString>): ForbiddenString[] {
  return forbidden.filter((entry) => text.includes(entry.text));
}

/** What one recorded response holds from the forbidden list. */
export function scanResponse(response: RecordedResponse, forbidden: ReadonlyArray<ForbiddenString>): Finding[] {
  const places: ReadonlyArray<readonly [FindingPlace, string]> = [
    ['body', response.body ?? ''],
    ['decoded RSC payload', response.body === null ? '' : decodeFlightPayload(response.body)],
    ['headers', headersText(response.headers)],
    ['url', response.url],
  ];
  return places.flatMap(([place, text]) =>
    findAll(text, forbidden).map((entry) => ({ label: response.label, place, found: entry.text, reason: entry.reason })),
  );
}

export function scanResponses(responses: ReadonlyArray<RecordedResponse>, forbidden: ReadonlyArray<ForbiddenString>): Finding[] {
  return responses.flatMap((response) => scanResponse(response, forbidden));
}

/** A finding as one readable line for a failure message. */
export function describeFinding(finding: Finding): string {
  return `${finding.label}: ${finding.reason} found as "${finding.found}" in the ${finding.place}`;
}

/** Matches the build's file references: `/_next/static/chunks/0abc.js`, `static/chunks/0abc.js` inside a payload, and `.css`. */
const STATIC_REFERENCE = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-./%~[\]()@]+?\.(?:js|css)(?![A-Za-z0-9])/g;

/**
 * The scripts and style sheets a recorded page or payload names, as absolute URLs: the `<script src>` tags, the preloads
 * and the chunk lists inside the flight payload, which name chunks that the page loads later. A chunk is fetched even when
 * the browser has not asked for it yet, so a lazily loaded chunk is scanned too. The query string `?dpl=` is kept.
 */
export function staticFileUrls(text: string, origin: string): string[] {
  const urls = new Set<string>();
  for (const match of text.matchAll(STATIC_REFERENCE)) {
    const reference = match[0].startsWith('/_next/') ? match[0] : `/_next/${match[0]}`;
    urls.add(new URL(decodeURI(reference), origin).toString());
  }
  return [...urls];
}

/** A route pattern of the manifest as a regular expression: `[id]` is one segment, `[...rest]` is anything below. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => {
      if (/^\[\.\.\..+\]$/.test(segment)) return '.*';
      if (/^\[.+\]$/.test(segment)) return '[^/]+';
      return segment.replace(/[.*+?^${}()|\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${source}/?$`);
}

/** The rows of the manifest this scan needs: a path and who may open it. */
export interface ScanRoute {
  readonly path: string;
  readonly roles: 'public' | ReadonlyArray<string>;
}

/**
 * Does this response answer a route or page that needs a session? True when its path matches a manifest row whose roles are
 * not `public`. A built file under `/_next/`, an asset in `public/` and the sign-in and next-auth routes match no such row,
 * so they are not held to `private, no-store` (a built file is public and immutable by design).
 */
export function answersProtectedRoute(url: string, routes: ReadonlyArray<ScanRoute>): boolean {
  const { pathname } = new URL(url);
  return routes.some((route) => route.roles !== 'public' && patternToRegExp(route.path).test(pathname));
}

/** The directives of a `Cache-Control` value, lower case. */
export function cacheDirectives(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((directive) => directive.trim().toLowerCase().split('=')[0] ?? '')
    .filter((directive) => directive !== '');
}

/** `private` and `no-store` are both present (architecture section 8; ADR-008 layer 4). */
export function isPrivateNoStore(value: string | undefined): boolean {
  const directives = cacheDirectives(value);
  return directives.includes('private') && directives.includes('no-store');
}

/** The responses to a protected route or page that do not say `private, no-store`, one line each (AC-5). */
export function cacheControlProblems(responses: ReadonlyArray<RecordedResponse>, routes: ReadonlyArray<ScanRoute>): string[] {
  return responses
    .filter((response) => answersProtectedRoute(response.url, routes))
    .filter((response) => !isPrivateNoStore(response.headers['cache-control']))
    .map((response) => `${response.label}: Cache-Control is "${response.headers['cache-control'] ?? '(none)'}", not private, no-store`);
}

/** What a refused role is sent, apart from the request ID (architecture section 6, CR-33). */
export const FIXED_FORBIDDEN_BODY = { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' } as const;

/** The fixed 403 body with the request ID taken out, or `null` when the text is not that body. */
export function withoutRequestId(text: string): { readonly fixed: Record<string, unknown>; readonly requestId: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const { requestId, ...fixed } = Object.fromEntries(Object.entries(parsed));
    return { fixed, requestId };
  } catch {
    return null;
  }
}

const REQUEST_ID_FORM = /^req-[0-9a-f]{8}$/;

/** Why a response is not the fixed 403 of a refused role, or `null` when it is. */
export function fixedForbiddenProblem(response: RecordedResponse): string | null {
  if (response.status !== 403) return `${response.label}: status ${response.status}, not 403`;
  if (!(response.headers['content-type'] ?? '').startsWith('application/problem+json')) return `${response.label}: not application/problem+json`;
  const body = withoutRequestId(response.body ?? '');
  if (body === null) return `${response.label}: the body is not a JSON object`;
  const expected = Object.entries(FIXED_FORBIDDEN_BODY);
  const isFixed = Object.keys(body.fixed).length === expected.length && expected.every(([key, value]) => body.fixed[key] === value);
  if (!isFixed) return `${response.label}: the body is not the fixed 403 body`;
  if (typeof body.requestId !== 'string' || !REQUEST_ID_FORM.test(body.requestId)) return `${response.label}: the request ID is missing or malformed`;
  return null;
}
