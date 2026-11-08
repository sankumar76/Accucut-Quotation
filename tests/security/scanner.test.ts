import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET as leakRoute } from '@/app/api/test-only/leak/route';
import { isNegativeControlEnabled, NEGATIVE_CONTROL_ENV_NAME, negativeControlSentinel } from '@/lib/negative-control-gate';

import { canaryMasters, forbiddenStrings, indianGrouping, NEGATIVE_CONTROL_SENTINEL, negativeControlForbidden } from '../support/canary-masters';
import {
  cacheControlProblems,
  decodeFlightPayload,
  describeFinding,
  fixedForbiddenProblem,
  headersText,
  isPrivateNoStore,
  maskRequestId,
  scanResponse,
  scanResponses,
  staticFileUrls,
  type RecordedResponse,
} from '../support/scanner';

/**
 * STORY-01.03 T2 and T5 (AC-3, AC-4): the scanner finds a planted leak in every place the product can send one, and the negative
 * control proves it. A scanner that cannot find a planted leak makes a green scan meaningless, so these tests fail the suite when it
 * cannot: the sentinel is planted in the HTML, in the RSC flight payload (also split across two pushes), in a JSON body, in a header
 * (a Set-Cookie too), in the URL and in a JavaScript chunk, in each of its forms (plain, Indian grouping, two decimals) and as a
 * rate name or a formula marker. A typed value is no leak and is not reported.
 */

const SENTINEL = canaryMasters.find((entry) => entry.kind === 'material-price' && entry.value === '9173737.73')?.value ?? '';
const FORBIDDEN = forbiddenStrings();

function response(overrides: Partial<RecordedResponse> = {}): RecordedResponse {
  return {
    label: 'GET /queue (document)',
    url: 'https://portal.example.test/queue',
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<html><body>Task queue</body></html>',
    ...overrides,
  };
}

/** What was found, once each: a page's payload is in its body and again in its decoded form, and that is one leak. */
const found = (planted: RecordedResponse): string[] => [...new Set(scanResponse(planted, FORBIDDEN).map((finding) => finding.found))];

describe('the scanner finds a planted leak (AC-3, AC-4)', () => {
  it('has a sentinel to plant', () => {
    expect(SENTINEL).toBe('9173737.73');
  });

  it('in a clean response finds nothing', () => {
    expect(found(response())).toEqual([]);
  });

  it('in HTML', () => {
    expect(found(response({ body: `<p>Rate ${SENTINEL}</p>` }))).toEqual([SENTINEL]);
  });

  it('in Indian grouping, in the grouping of three and as two decimals', () => {
    expect(found(response({ body: `<p>₹ ${indianGrouping(SENTINEL)}</p>` }))).toEqual(['91,73,737.73']);
    expect(found(response({ body: '<p>₹ 9,173,737.73</p>' }))).toEqual(['9,173,737.73']);
    expect(found(response({ body: '{"price":"771.37"}' }))).toEqual(['771.37']);
  });

  it('in JSON', () => {
    expect(found(response({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: [{ price: SENTINEL }] }) }))).toEqual([SENTINEL]);
  });

  it('in a response header, and in a Set-Cookie', () => {
    const viaHeader = scanResponse(response({ headers: { 'content-type': 'text/html', 'x-debug-rate': SENTINEL } }), FORBIDDEN);
    expect(viaHeader.map((finding) => [finding.place, finding.found])).toEqual([['headers', SENTINEL]]);
    const viaCookie = scanResponse(response({ headers: { 'set-cookie': `rate=${SENTINEL}; Path=/` } }), FORBIDDEN);
    expect(viaCookie.map((finding) => finding.place)).toEqual(['headers']);
  });

  it('in the URL (a query string)', () => {
    const viaUrl = scanResponse(response({ url: `https://portal.example.test/queue?rate=${SENTINEL}` }), FORBIDDEN);
    expect(viaUrl.map((finding) => finding.place)).toEqual(['url']);
  });

  it('in an RSC flight payload fetched with RSC: 1, and inside an HTML page', () => {
    const flight = `0:{"rate":"${SENTINEL}"}\n`;
    expect(found(response({ headers: { 'content-type': 'text/x-component' }, body: flight }))).toEqual([SENTINEL]);
    const page = `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
    expect(found(response({ body: page }))).toEqual([SENTINEL]);
  });

  it('in an RSC payload split across two pushes, which the raw page does not hold in one piece', () => {
    const half = Math.floor(SENTINEL.length / 2);
    const page =
      `<script>self.__next_f.push([1,"{\\"rate\\":\\"${SENTINEL.slice(0, half)}"])</script>` +
      `<script>self.__next_f.push([1,"${SENTINEL.slice(half)}\\"}"])</script>`;
    expect(page).not.toContain(SENTINEL);
    const findings = scanResponse(response({ body: page }), FORBIDDEN);
    expect(findings.map((finding) => [finding.place, finding.found])).toEqual([['decoded RSC payload', SENTINEL]]);
  });

  it('decodes the pushes of a page in order and ignores one that is not a JSON string', () => {
    const page = 'self.__next_f.push([1,"ab"]);self.__next_f.push([1,"cd"]);self.__next_f.push([0,"zz"]);self.__next_f.push([1,"e\\u0066"])';
    expect(decodeFlightPayload(page)).toBe('abcdef');
    expect(decodeFlightPayload('<p>no payload</p>')).toBe('');
  });

  it('in a JavaScript chunk, as a number and as a rate name', () => {
    const chunk = (body: string): RecordedResponse =>
      response({
        label: 'GET /_next/static/chunks/0abc.js (script)',
        url: 'https://portal.example.test/_next/static/chunks/0abc.js',
        headers: { 'content-type': 'text/javascript' },
        body,
      });
    expect(found(chunk(`const r=${SENTINEL};`))).toEqual([SENTINEL]);
    expect(found(chunk('const names=["Cutting-Rate-per-Sec"];'))).toEqual(['Cutting-Rate-per-Sec']);
  });

  it('as a formula marker and as a formula operand name', () => {
    expect(found(response({ body: '{"formula":"{{f:00000000-0000-4000-8000-0fff00000001}} * {{rate:x}}"}' }))).toEqual(
      expect.arrayContaining(['{{f:', '{{rate:']),
    );
    expect(found(response({ body: 'Material-Specific-Gravity' }))).toEqual(['Material-Specific-Gravity']);
  });

  it('every sentinel of canaryMasters is found, in every form', () => {
    for (const sentinel of canaryMasters) {
      const forms = FORBIDDEN.filter((entry) => entry.reason.startsWith(`${sentinel.label} (`));
      expect(forms.length, sentinel.label).toBeGreaterThan(0);
      for (const form of forms) expect(found(response({ body: `<td>${form.text}</td>` })), `${sentinel.label}: ${form.reason}`).toContain(form.text);
    }
  });

  it('does not report a typed value: an Engineer sees what they typed (FR-008)', () => {
    expect(found(response({ body: '<input value="1234.5"><input value="678.25"><input value="45678.75">' }))).toEqual([]);
  });

  it('says what it found and where, in one line', () => {
    const [finding] = scanResponse(response({ body: SENTINEL }), FORBIDDEN);
    expect(finding && describeFinding(finding)).toBe('GET /queue (document): Material price 2 (plain digits) found as "9173737.73" in the body');
  });

  it('skips a body that is not text, but still reads its headers', () => {
    expect(scanResponse(response({ body: null, headers: { 'content-type': 'image/jpeg' } }), FORBIDDEN)).toEqual([]);
    expect(scanResponses([response({ body: null, headers: { 'x-rate': SENTINEL } })], FORBIDDEN)).toHaveLength(1);
  });
});

describe('the negative control: a route that leaks one sentinel, which the scanner must report (AC-4)', () => {
  afterEach(() => vi.unstubAllEnvs());

  async function leaked(): Promise<RecordedResponse> {
    const answer = leakRoute();
    return {
      label: 'GET /api/test-only/leak (fetch)',
      url: 'https://portal.example.test/api/test-only/leak',
      status: answer.status,
      headers: Object.fromEntries(answer.headers),
      body: await answer.text(),
    };
  }

  it("runs under NODE_ENV=test, which is Vitest's", () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(isNegativeControlEnabled()).toBe(true);
  });

  it('returns the sentinel it is given, and the scanner reports it (if it did not, this suite would fail)', async () => {
    vi.stubEnv(NEGATIVE_CONTROL_ENV_NAME, NEGATIVE_CONTROL_SENTINEL);
    const planted = await leaked();
    expect(planted.status).toBe(200);
    expect(JSON.parse(planted.body ?? '')).toEqual({ leaked: NEGATIVE_CONTROL_SENTINEL });
    const findings = scanResponse(planted, negativeControlForbidden());
    expect(findings.map((finding) => finding.found)).toEqual([NEGATIVE_CONTROL_SENTINEL]);
    // And a scanner that looked for the wrong strings would have found nothing: the control would have failed.
    expect(scanResponse(planted, FORBIDDEN)).toEqual([]);
  });

  it('answers 404 with no body under test when no sentinel was supplied', async () => {
    vi.stubEnv(NEGATIVE_CONTROL_ENV_NAME, '');
    const answer = await leaked();
    expect(answer.status).toBe(404);
    expect(answer.body).toBe('');
  });

  it.each(['production', 'development'])('is absent under NODE_ENV=%s even when a sentinel is supplied: 404, no body, nothing to find', async (nodeEnv) => {
    vi.stubEnv(NEGATIVE_CONTROL_ENV_NAME, NEGATIVE_CONTROL_SENTINEL);
    vi.stubEnv('NODE_ENV', nodeEnv);
    expect(isNegativeControlEnabled()).toBe(false);
    const answer = await leaked();
    expect(answer.status).toBe(404);
    expect(answer.body).toBe('');
    expect(headersText(answer.headers)).not.toContain(NEGATIVE_CONTROL_SENTINEL);
  });

  it('the gate reads the environment it is given, and a blank sentinel is none', () => {
    expect(isNegativeControlEnabled('test')).toBe(true);
    expect(isNegativeControlEnabled('production')).toBe(false);
    expect(isNegativeControlEnabled('')).toBe(false);
    expect(negativeControlSentinel('  1234.37  ')).toBe('1234.37');
    expect(negativeControlSentinel('   ')).toBeUndefined();
  });
});

describe("the static files a page names (AC-3: the JS chunks the Engineer's pages load)", () => {
  const origin = 'https://portal.example.test';

  it('finds script tags, preloads and the chunk lists inside a flight payload, once each, as absolute URLs', () => {
    const html =
      '<link rel="preload" href="/_next/static/chunks/0a1b.js" as="script"/>' +
      '<script src="/_next/static/chunks/0a1b.js" async=""></script><script src="/_next/static/chunks/turbopack-9z.js"></script>';
    const flight = '1:I[1234,["static/chunks/0c2d.js","static/chunks/0a1b.js"],"default"]';
    expect(staticFileUrls(`${html}${flight}`, origin).sort()).toEqual(
      [`${origin}/_next/static/chunks/0a1b.js`, `${origin}/_next/static/chunks/0c2d.js`, `${origin}/_next/static/chunks/turbopack-9z.js`].sort(),
    );
  });

  it('finds style sheets and encoded names, and ignores text that only looks like one', () => {
    expect(staticFileUrls('<link href="/_next/static/css/0f.css"/>', origin)).toEqual([`${origin}/_next/static/css/0f.css`]);
    expect(staticFileUrls('static/chunks/%5Broot%5D-x.js', origin)).toEqual([`${origin}/_next/static/chunks/[root]-x.js`]);
    expect(staticFileUrls('the static chunks are in /chunks/x.js', origin)).toEqual([]);
  });
});

describe('Cache-Control on every authenticated response (AC-5)', () => {
  it('wants private and no-store both', () => {
    expect(isPrivateNoStore('private, no-store')).toBe(true);
    expect(isPrivateNoStore('private, no-cache, no-store, max-age=0, must-revalidate')).toBe(true);
    expect(isPrivateNoStore('no-store')).toBe(false);
    expect(isPrivateNoStore('private')).toBe(false);
    expect(isPrivateNoStore('public, max-age=60')).toBe(false);
    expect(isPrivateNoStore(undefined)).toBe(false);
  });

  const signedIn = (overrides: Partial<RecordedResponse>): RecordedResponse => response({ carriedSession: true, ...overrides });

  it('holds every response to a request that carried the session, public routes included (QLT-09), and ignores a built file', () => {
    const ok = signedIn({ headers: { 'cache-control': 'private, no-store' } });
    const missing = signedIn({ label: 'GET /queue (document)', headers: {} });
    const wrong = signedIn({
      label: 'GET /api/v1/x/abc (fetch)',
      url: 'https://portal.example.test/api/v1/x/abc',
      headers: { 'cache-control': 'public, max-age=60' },
    });
    // next-auth's session route is a `public` row of the manifest and carries the signed-in person: it is held too.
    const session = signedIn({
      label: 'GET /api/auth/session (fetch)',
      url: 'https://portal.example.test/api/auth/session',
      headers: { 'cache-control': 'no-cache' },
    });
    const asset = signedIn({
      url: 'https://portal.example.test/_next/static/chunks/a.js',
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    });
    expect(cacheControlProblems([ok, missing, wrong, session, asset])).toEqual([
      'GET /queue (document): Cache-Control is "(none)", not private, no-store',
      'GET /api/v1/x/abc (fetch): Cache-Control is "public, max-age=60", not private, no-store',
      'GET /api/auth/session (fetch): Cache-Control is "no-cache", not private, no-store',
    ]);
  });

  it('does not hold a response to a request that carried no session, and takes the exemptions it is given', () => {
    const signedOut = response({ headers: { 'cache-control': 'no-cache' } });
    expect(cacheControlProblems([signedOut])).toEqual([]);
    const logo = signedIn({ url: 'https://portal.example.test/accucut-logo.jpg', headers: { 'cache-control': 'public, max-age=86400' } });
    expect(cacheControlProblems([logo])).toHaveLength(1);
    expect(cacheControlProblems([logo], (pathname) => pathname === '/accucut-logo.jpg')).toEqual([]);
  });
});

describe('two refusals compared word for word', () => {
  it('masks only the request ID', () => {
    expect(maskRequestId('{"code":"FORBIDDEN","requestId":"req-7f3a91c2"}')).toBe('{"code":"FORBIDDEN","requestId":"req-"}');
    expect(maskRequestId('{"code":"FORBIDDEN","requestId":"req-00000000"}')).toBe(maskRequestId('{"code":"FORBIDDEN","requestId":"req-ffffffff"}'));
    expect(maskRequestId('{"code":"OTHER","requestId":"req-00000000"}')).not.toBe(maskRequestId('{"code":"FORBIDDEN","requestId":"req-00000000"}'));
  });
});

describe('the fixed 403 of a refused role (AC-5, architecture section 6, CR-33)', () => {
  const fixed = (
    overrides: Partial<RecordedResponse> = {},
    body: unknown = { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN', requestId: 'req-7f3a91c2' },
  ): RecordedResponse => response({ status: 403, headers: { 'content-type': 'application/problem+json' }, body: JSON.stringify(body), ...overrides });

  it('accepts the fixed body with a request ID', () => {
    expect(fixedForbiddenProblem(fixed())).toBeNull();
  });

  it.each([
    ['another status', fixed({ status: 404 }), 'status 404, not 403'],
    ['the wrong media type', fixed({ headers: { 'content-type': 'application/json' } }), 'not application/problem+json'],
    ['a body that is not JSON', fixed({ body: '<html>' }), 'not a JSON object'],
    [
      'an extra key',
      fixed({}, { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN', requestId: 'req-7f3a91c2', errors: [] }),
      'not the fixed 403 body',
    ],
    ['other words', fixed({}, { type: 'about:blank', title: 'Nope', status: 403, code: 'FORBIDDEN', requestId: 'req-7f3a91c2' }), 'not the fixed 403 body'],
    ['no request ID', fixed({}, { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' }), 'request ID is missing'],
  ])('refuses %s', (_name, candidate, reason) => {
    expect(fixedForbiddenProblem(candidate)).toContain(reason);
  });
});
