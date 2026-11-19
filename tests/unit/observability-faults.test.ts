import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { encode } from 'next-auth/jwt';

import { ConfigurationError, UnauthorizedError } from '@/lib/errors';
import type { AuthenticatedUser } from '@/server/auth/session';
import { sessionCookieName } from '@/server/auth/session-cookie';
import { SESSION_MAX_AGE_SECONDS } from '@/server/auth/session-token';
import type { HttpMethod, RouteRow } from '@/server/http/route-manifest';
import { runJob, type FailedJobRun } from '@/server/jobs/run-job';
import {
  logRequestError,
  type FailedRequest,
  type FailedRequestContext,
  type RequestErrorDependencies,
} from '@/server/observability/request-error';

/**
 * STORY-10.09a AC-1, AC-2, AC-8 and AC-9 (NFR-024, NFR-006, NFR-028): fault injection through the real `withRoute`, the real `onRequestError` logic (with the real `next-auth` token
 * encode and decode) and the real job wrapper, into a real pino logger whose output is captured as the JSON lines the service would write. The session and the manifest are replaced
 * as in `http-with-route.test.ts`. Every name, e-mail address, secret and password below is invented.
 */

const sink = vi.hoisted(() => ({ chunks: [] as string[] }));

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), logRequestError: vi.fn() }));

const TEST_ROWS: ReadonlyArray<RouteRow> = [
  { path: '/api/v1/test-all', kind: 'api', methods: ['GET', 'POST'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' },
  { path: '/api/v1/test-lead', kind: 'api', methods: ['GET'], roles: ['ADMIN', 'LEAD'], status: 'implemented', stage: 'R1' },
];

vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logger')>();
  const { Writable } = await import('node:stream');
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      sink.chunks.push(chunk.toString());
      callback();
    },
  });
  return { ...actual, logger: actual.createLogger({ level: 'debug' }, stream) };
});
vi.mock('@/server/http/route-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/http/route-manifest')>();
  return { ...actual, findRoute: (path: string, method: HttpMethod) => TEST_ROWS.find((row) => row.path === path && row.methods.includes(method)) };
});

const { withRoute } = await import('@/server/http/with-route');
const { logger } = await import('@/lib/logger');

const APP_ORIGIN = 'https://portal.example.test';
const ADMIN: AuthenticatedUser = { id: 'u-7f3a91', name: 'Invented Admin Name', email: 'invented.admin@example.test', role: 'ADMIN', mustChangePassword: false };
const ENGINEER: AuthenticatedUser = { id: 'u-eng-22', name: 'Invented Engineer Name', email: 'invented.engineer@example.test', role: 'ENGINEER', mustChangePassword: false };

/** A planted fake secret: it goes into an error message, a request body, a cookie and an address, and must come out of none of the logs. */
const PLANTED = ['planted', 'text', 'two'].join('-');
const SEAL = 'q'.repeat(48);
const NOW = new Date('2026-11-19T10:00:00.000Z');

type Line = Record<string, unknown>;

const PINO_ERROR = 50;
const PINO_WARN = 40;
const PINO_DEBUG = 20;

function lines(): Line[] {
  return sink.chunks
    .join('')
    .split('\n')
    .filter((line) => line !== '')
    .map((line): Line => z.record(z.string(), z.unknown()).parse(JSON.parse(line)));
}

const errorLines = (): Line[] => lines().filter((line) => line['level'] === PINO_ERROR);

/** Everything the service would have written, as one string, to search for what must not be there. */
const everything = (): string => sink.chunks.join('');

const output = z.strictObject({ greeting: z.string() });
const bodySchema = z.strictObject({ note: z.string() });

function post(note: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://portal.example.test/api/v1/test-all?token=${PLANTED}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP_ORIGIN, cookie: `${sessionCookieName(false)}=${PLANTED}; other=${PLANTED}`, ...headers },
    body: JSON.stringify({ note }),
  });
}

function get(path = '/api/v1/test-all'): Request {
  return new Request(`https://portal.example.test${path}`, { method: 'GET', headers: { cookie: `${sessionCookieName(false)}=${PLANTED}` } });
}

beforeEach(() => {
  sink.chunks.length = 0;
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue(ADMIN);
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
});

describe('AC-1: a failing route names the user', () => {
  it('[AC-1] an unexpected throw logs one error line with the time, the request ID, route, method, error class and the user ID', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'POST',
      body: bodySchema,
      output,
      handler: () => {
        throw new TypeError(`cannot read ${PLANTED}`);
      },
    });
    const response = await handle(post('hello'));
    expect(response.status).toBe(500);
    const requestId = response.headers.get('X-Request-Id');
    expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
    const errors = errorLines();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ requestId, route: '/api/v1/test-all', method: 'POST', errorName: 'TypeError', userId: ADMIN.id });
    expect(typeof errors[0]?.['time']).toBe('number');
  });

  it('[AC-1] a 5xx application error logs the user ID as well', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new ConfigurationError(`SMTP_USER ${PLANTED} is not valid`);
      },
    });
    expect((await handle(get())).status).toBe(500);
    expect(errorLines()).toHaveLength(1);
    expect(errorLines()[0]).toMatchObject({ errorName: 'ConfigurationError', errorCode: 'CONFIGURATION_INVALID', userId: ADMIN.id });
  });

  it('[AC-1] a response that does not fit its schema logs the user ID too', async () => {
    mocks.requireUser.mockResolvedValue(ENGINEER);
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: () => ({ greeting: 'x', unitCost: 1 }) });
    expect((await handle(get())).status).toBe(500);
    expect(errorLines()[0]).toMatchObject({ errorName: 'ResponseSchemaError', userId: ENGINEER.id });
  });

  it('[AC-1] the user ID is the signed-in person of this request: two requests by two people carry two IDs', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new Error('boom');
      },
    });
    await handle(get());
    mocks.requireUser.mockResolvedValue(ENGINEER);
    await handle(get());
    expect(errorLines().map((line) => line['userId'])).toEqual([ADMIN.id, ENGINEER.id]);
  });

  it('[AC-1] a signed-out request keeps its debug line and writes no error line and no user ID', async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: () => ({ greeting: 'x' }) });
    expect((await handle(get())).status).toBe(401);
    expect(errorLines()).toHaveLength(0);
    const [line] = lines();
    expect(line).toMatchObject({ level: PINO_DEBUG, msg: 'signed-out request', route: '/api/v1/test-all' });
    expect(line).not.toHaveProperty('userId');
  });

  it('[AC-1] a refused request (403) keeps its warn line', async () => {
    mocks.requireUser.mockResolvedValue(ENGINEER);
    const handle = withRoute({ route: '/api/v1/test-lead', method: 'GET', output, handler: () => ({ greeting: 'x' }) });
    expect((await handle(get('/api/v1/test-lead'))).status).toBe(403);
    expect(errorLines()).toHaveLength(0);
    expect(lines()[0]).toMatchObject({ level: PINO_WARN, msg: 'route refused', status: 403, code: 'FORBIDDEN' });
  });

  it('[AC-1] a failure before any user is known (the session lookup itself fails) logs an error line with no user ID', async () => {
    mocks.requireUser.mockRejectedValue(new Error(`connect ECONNREFUSED ${PLANTED}`));
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: () => ({ greeting: 'x' }) });
    expect((await handle(get())).status).toBe(500);
    expect(errorLines()).toHaveLength(1);
    expect(errorLines()[0]).not.toHaveProperty('userId');
  });

  it('[AC-1] never logs a name, an e-mail address, a message, a stack or a cause', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new Error(`${ADMIN.email} ${ADMIN.name}`, { cause: new Error(ADMIN.email) });
      },
    });
    await handle(get());
    const text = everything();
    for (const forbidden of [ADMIN.email, ADMIN.name, 'stack', 'cause', 'message']) expect(text, forbidden).not.toContain(forbidden);
  });
});

/** A request as `onRequestError` receives it. */
function failedRequest(headers: FailedRequest['headers'] = {}, path = `/estimates/abc?token=${PLANTED}`, method = 'GET'): FailedRequest {
  return { path, method, headers };
}

const RENDER_CONTEXT: FailedRequestContext = { routerKind: 'App Router', routePath: '/estimates/[id]', routeType: 'render', renderSource: 'server-rendering' };

interface Harness {
  readonly dependencies: RequestErrorDependencies;
  readonly decode: ReturnType<typeof vi.fn>;
}

/** The real encode and decode of `next-auth`, the real pino sink, a fixed clock and a known secret. */
function harness(overrides: Partial<RequestErrorDependencies> = {}, production = false): Harness {
  const decodeToken = vi.fn(async (token: string, secret: string) => (await import('next-auth/jwt')).decode({ token, secret }));
  return {
    decode: decodeToken,
    dependencies: {
      logError: (fields, message) => logger.error(fields, message),
      secret: () => SEAL,
      production,
      now: () => NOW,
      newRequestId: () => 'req-00000001',
      decodeToken,
      ...overrides,
    },
  };
}

async function tokenFor(userId: string, options: { readonly signedAt?: number; readonly maxAge?: number; readonly secret?: string } = {}): Promise<string> {
  const signedAt = options.signedAt ?? Math.floor(NOW.getTime() / 1000) - 60;
  return encode({ token: { sub: userId, sv: 3, signedAt }, secret: options.secret ?? SEAL, maxAge: options.maxAge ?? SESSION_MAX_AGE_SECONDS });
}

const cookieHeader = (value: string, production = false): FailedRequest['headers'] => ({ cookie: `theme=dark; ${sessionCookieName(production)}=${value}; other=1` });

describe('AC-2: a page that throws while rendering names the user without a database read', () => {
  it('[AC-2] a signed-in render fault logs the time, a request ID, the route pattern, the method, the error class and a userId equal to the token sub', async () => {
    const { dependencies } = harness();
    const token = await tokenFor(ADMIN.id);
    await logRequestError(new RangeError(`bad ${PLANTED}`), failedRequest(cookieHeader(token)), RENDER_CONTEXT, dependencies);
    const errors = errorLines();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      msg: 'page render failed',
      requestId: 'req-00000001',
      routePath: '/estimates/[id]',
      routeType: 'render',
      method: 'GET',
      errorName: 'RangeError',
      userId: ADMIN.id,
    });
    expect(typeof errors[0]?.['time']).toBe('number');
    expect(errors[0]).not.toHaveProperty('userIdAbsent');
  });

  it('[AC-2] reads the production cookie name (__Secure- prefix) in a production build, and ignores the other name', async () => {
    const token = await tokenFor(ADMIN.id);
    await logRequestError(new Error('x'), failedRequest(cookieHeader(token, true)), RENDER_CONTEXT, harness({}, true).dependencies);
    expect(errorLines()[0]).toMatchObject({ userId: ADMIN.id });
    sink.chunks.length = 0;
    await logRequestError(new Error('x'), failedRequest(cookieHeader(token, false)), RENDER_CONTEXT, harness({}, true).dependencies);
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'no-cookie' });
  });

  it('[AC-2] a signed-out request (no cookie) logs the line with the userId absent, says so, and does not throw', async () => {
    const { dependencies, decode } = harness();
    await expect(logRequestError(new Error('x'), failedRequest({}), RENDER_CONTEXT, dependencies)).resolves.toBeUndefined();
    const errors = errorLines();
    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toHaveProperty('userId');
    expect(errors[0]).toMatchObject({ userIdAbsent: 'no-cookie' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('[AC-2] a request with other cookies but not the session cookie is signed out too', async () => {
    await logRequestError(new Error('x'), failedRequest({ cookie: 'theme=dark; other=1' }), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'no-cookie' });
  });

  it('[AC-2] an expired token logs the line with the userId absent and does not throw', async () => {
    const expired = await tokenFor(ADMIN.id, { maxAge: -60 });
    await expect(logRequestError(new Error('x'), failedRequest(cookieHeader(expired)), RENDER_CONTEXT, harness().dependencies)).resolves.toBeUndefined();
    expect(errorLines()).toHaveLength(1);
    expect(errorLines()[0]).not.toHaveProperty('userId');
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'unreadable-token' });
  });

  it('[AC-2] a token that is inside its own expiry but was signed in more than 12 hours ago is not a session: userId absent', async () => {
    const old = await tokenFor(ADMIN.id, { signedAt: Math.floor(NOW.getTime() / 1000) - 13 * 3600 });
    await logRequestError(new Error('x'), failedRequest(cookieHeader(old)), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'unreadable-token' });
    expect(errorLines()[0]).not.toHaveProperty('userId');
  });

  it('[AC-2] a garbage cookie logs the line with the userId absent, does not throw and never prints the cookie', async () => {
    await expect(logRequestError(new Error('x'), failedRequest(cookieHeader(PLANTED)), RENDER_CONTEXT, harness().dependencies)).resolves.toBeUndefined();
    expect(errorLines()).toHaveLength(1);
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'unreadable-token' });
    expect(everything()).not.toContain(PLANTED);
  });

  it('[AC-2] a token sealed with another secret (forged) is not believed', async () => {
    const forged = await tokenFor(ADMIN.id, { secret: 'z'.repeat(48) });
    await logRequestError(new Error('x'), failedRequest(cookieHeader(forged)), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).not.toHaveProperty('userId');
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'unreadable-token' });
  });

  it('[AC-2] a token that decodes but does not hold the three claims is not believed', async () => {
    const odd = await encode({ token: { sub: ADMIN.id }, secret: SEAL, maxAge: 600 });
    await logRequestError(new Error('x'), failedRequest(cookieHeader(odd)), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).not.toHaveProperty('userId');
  });

  it('[AC-2] a decode that throws, and settings that are missing, each still log the line and do not throw', async () => {
    const throwing = harness({ decodeToken: () => Promise.reject(new Error(`bad token ${PLANTED}`)) });
    await expect(logRequestError(new Error('x'), failedRequest(cookieHeader('abc')), RENDER_CONTEXT, throwing.dependencies)).resolves.toBeUndefined();
    expect(errorLines()[0]).toMatchObject({ userIdAbsent: 'unreadable-token' });
    sink.chunks.length = 0;
    const noSecret = harness({
      secret: () => {
        throw new Error('Invalid environment: SEAL (missing).');
      },
    });
    await expect(logRequestError(new Error('x'), failedRequest(cookieHeader(await tokenFor(ADMIN.id))), RENDER_CONTEXT, noSecret.dependencies)).resolves.toBeUndefined();
    expect(errorLines()).toHaveLength(1);
    expect(errorLines()[0]).not.toHaveProperty('userId');
    expect(everything()).not.toContain(PLANTED);
  });

  it('[AC-2] never throws when the logger itself throws', async () => {
    const broken = harness({
      logError: () => {
        throw new Error('write EPIPE');
      },
    });
    await expect(logRequestError(new Error('x'), failedRequest({}), RENDER_CONTEXT, broken.dependencies)).resolves.toBeUndefined();
  });

  it('[AC-2] uses the X-Request-Id header when it has the form this app makes (any case, or the first of several), and a new ID otherwise', async () => {
    const send = async (headers: FailedRequest['headers']): Promise<unknown> => {
      sink.chunks.length = 0;
      await logRequestError(new Error('x'), failedRequest(headers), RENDER_CONTEXT, harness().dependencies);
      return errorLines()[0]?.['requestId'];
    };
    expect(await send({ 'x-request-id': 'req-0a1b2c3d' })).toBe('req-0a1b2c3d');
    expect(await send({ 'X-Request-Id': 'req-0a1b2c3d' })).toBe('req-0a1b2c3d');
    expect(await send({ 'x-request-id': ['req-0a1b2c3d', 'req-ffffffff'] })).toBe('req-0a1b2c3d');
    expect(await send({})).toBe('req-00000001');
    // A header is the caller's: a value with spaces, a quote, a newline or more than 64 characters is not copied into the log.
    expect(await send({ 'x-request-id': `req-1 "${PLANTED}"` })).toBe('req-00000001');
    expect(await send({ 'x-request-id': 'line1\nline2' })).toBe('req-00000001');
    expect(await send({ 'x-request-id': 'a'.repeat(65) })).toBe('req-00000001');
  });

  it('[AC-2] logs the route pattern and never the address (its query string can hold anything), the headers or the body', async () => {
    await logRequestError(
      new Error('x'),
      failedRequest({ cookie: `${sessionCookieName(false)}=${PLANTED}`, authorization: `Bearer ${PLANTED}`, 'x-forwarded-for': '10.1.2.3' }, `/estimates/abc?token=${PLANTED}`),
      RENDER_CONTEXT,
      harness().dependencies,
    );
    const text = everything();
    expect(text).not.toContain(PLANTED);
    expect(text).not.toContain('/estimates/abc');
    expect(text).not.toContain('10.1.2.3');
    expect(errorLines()[0]).not.toHaveProperty('path');
    expect(errorLines()[0]).not.toHaveProperty('headers');
  });

  it('[AC-2] logs the digest Next.js gives an error when it has the plain form, and ignores one that does not', async () => {
    const withDigest = Object.assign(new Error('x'), { digest: '1234567890' });
    await logRequestError(withDigest, failedRequest({}), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).toMatchObject({ digest: '1234567890' });
    sink.chunks.length = 0;
    await logRequestError(Object.assign(new Error('x'), { digest: `has space ${PLANTED}` }), failedRequest({}), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).not.toHaveProperty('digest');
    expect(everything()).not.toContain(PLANTED);
  });

  it('[AC-2] a thing that is not an Error is logged as NonError, and a method that is not a plain verb as unknown', async () => {
    await logRequestError(`token=${PLANTED}`, failedRequest({}, '/x', `get ${PLANTED}`), RENDER_CONTEXT, harness().dependencies);
    expect(errorLines()[0]).toMatchObject({ errorName: 'NonError', method: 'unknown' });
    expect(everything()).not.toContain(PLANTED);
  });

  it('[AC-2] a route handler or an action outside withRoute is logged too, with its own message and route type', async () => {
    await logRequestError(new Error('x'), failedRequest({}, '/api/v1/other', 'POST'), { routerKind: 'App Router', routePath: '/api/v1/other', routeType: 'route' }, harness().dependencies);
    expect(errorLines()[0]).toMatchObject({ msg: 'request failed', routeType: 'route', method: 'POST' });
  });
});

describe('AC-2: onRequestError in src/instrumentation.ts', () => {
  const logRequestErrorMock = mocks.logRequestError;

  beforeEach(() => {
    logRequestErrorMock.mockReset();
    vi.resetModules();
    vi.doMock('@/server/observability/request-error', () => ({ logRequestError: logRequestErrorMock, productionRequestErrorDependencies: () => ({}) }));
  });

  afterAll(() => {
    vi.doUnmock('@/server/observability/request-error');
  });

  it('[AC-2] on the Node runtime it hands the error, the request and the context to the logger', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const { onRequestError } = await import('@/instrumentation');
    const error = new Error('x');
    const request = failedRequest({});
    await onRequestError(error, request, RENDER_CONTEXT as never);
    expect(logRequestErrorMock).toHaveBeenCalledWith(error, request, RENDER_CONTEXT, {});
  });

  it('[AC-2] on the Edge runtime it does nothing (the Node-only code stays out of the Edge bundle)', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    const { onRequestError } = await import('@/instrumentation');
    await onRequestError(new Error('x'), failedRequest({}), RENDER_CONTEXT as never);
    expect(logRequestErrorMock).not.toHaveBeenCalled();
  });

  it('[AC-2] never throws into the framework, even when the logging module throws', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    logRequestErrorMock.mockRejectedValue(new Error(`boom ${PLANTED}`));
    const { onRequestError } = await import('@/instrumentation');
    await expect(onRequestError(new Error('x'), failedRequest({}), RENDER_CONTEXT as never)).resolves.toBeUndefined();
  });
});

const FAULT_COUNT = 12;

/** Twelve different things a dependency can throw: classes, plain values, a message that holds the planted secret. */
function fault(index: number): unknown {
  class CustomError extends Error {
    override name = 'CustomError';
  }
  const kinds: ReadonlyArray<() => unknown> = [
    () => new Error(`plain ${PLANTED}`),
    () => new TypeError(`type ${PLANTED}`),
    () => new RangeError(`range ${PLANTED}`),
    () => new CustomError(`custom ${PLANTED}`),
    () => new Error('with a cause', { cause: new Error(PLANTED) }),
    () => `a string ${PLANTED}`,
    () => ({ message: PLANTED }),
    () => new ConfigurationError(`setting ${PLANTED}`),
    () => Object.assign(new Error(PLANTED), { digest: '987654321' }),
    () => new SyntaxError(`syntax ${PLANTED}`),
    () => new EvalError(`eval ${PLANTED}`),
    () => new URIError(`uri ${PLANTED}`),
  ];
  const make = kinds[index % kinds.length];
  if (make === undefined) throw new Error('No fault kind.');
  return make();
}

describe('AC-8 and AC-9: every fault leaves one error line, and no line holds a secret', () => {
  it('[AC-9] 12 faults injected into a route each leave exactly one error line with the fields of AC-1', async () => {
    for (let index = 0; index < FAULT_COUNT; index += 1) {
      const before = errorLines().length;
      const thrown = fault(index);
      const handle = withRoute({
        route: '/api/v1/test-all',
        method: 'POST',
        body: bodySchema,
        output,
        handler: () => {
          throw thrown;
        },
      });
      const response = await handle(post(`note ${index}`));
      expect(response.status, `fault ${index}`).toBe(500);
      const added = errorLines().slice(before);
      expect(added, `fault ${index}`).toHaveLength(1);
      expect(added[0], `fault ${index}`).toMatchObject({ requestId: response.headers.get('X-Request-Id'), route: '/api/v1/test-all', method: 'POST', userId: ADMIN.id });
      expect(typeof added[0]?.['errorName'], `fault ${index}`).toBe('string');
      expect(typeof added[0]?.['time'], `fault ${index}`).toBe('number');
    }
    expect(errorLines()).toHaveLength(FAULT_COUNT);
  });

  it('[AC-9] 12 faults injected into a page render each leave exactly one error line with the fields of AC-2, naming the signed-in person', async () => {
    const token = await tokenFor(ADMIN.id);
    const { dependencies } = harness();
    for (let index = 0; index < FAULT_COUNT; index += 1) {
      const before = errorLines().length;
      await logRequestError(fault(index), failedRequest(cookieHeader(token)), RENDER_CONTEXT, dependencies);
      const added = errorLines().slice(before);
      expect(added, `fault ${index}`).toHaveLength(1);
      expect(added[0], `fault ${index}`).toMatchObject({ msg: 'page render failed', requestId: 'req-00000001', routePath: '/estimates/[id]', method: 'GET', userId: ADMIN.id });
      expect(typeof added[0]?.['errorName'], `fault ${index}`).toBe('string');
      expect(typeof added[0]?.['time'], `fault ${index}`).toBe('number');
    }
    expect(errorLines()).toHaveLength(FAULT_COUNT);
  });

  it('[AC-9] 12 faults injected into a worker job each leave exactly one error line with the job name, the duration and the error class, and a failed row for a job that records runs', async () => {
    const rows: FailedJobRun[] = [];
    for (let index = 0; index < FAULT_COUNT; index += 1) {
      const before = errorLines().length;
      const thrown = fault(index);
      await runJob(
        {
          name: 'backup-watch',
          log: (message, level, fields) => {
            if (level === 'error') logger.error({ ...fields }, message);
            else logger.info({ ...fields }, message);
          },
          now: () => NOW,
          recordFailure: (run) => Promise.resolve(void rows.push(run)),
        },
        () => Promise.reject(thrown),
      );
      const added = errorLines().slice(before);
      expect(added, `fault ${index}`).toHaveLength(1);
      expect(added[0], `fault ${index}`).toMatchObject({ job: 'backup-watch', durationMs: 0 });
      expect(typeof added[0]?.['errorName'], `fault ${index}`).toBe('string');
    }
    expect(errorLines()).toHaveLength(FAULT_COUNT);
    expect(rows).toHaveLength(FAULT_COUNT);
  });

  it('[AC-8] a planted secret in a thrown message, a request body, a cookie and an address appears in no route log line', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'POST',
      body: bodySchema,
      output,
      handler: ({ body }) => {
        throw new Error(`failed for ${body.note}`, { cause: new Error(PLANTED) });
      },
    });
    await handle(post(PLANTED));
    expect(errorLines()).toHaveLength(1);
    expect(everything()).not.toContain(PLANTED);
    // The line holds the IDs only: the user ID, never a name or an e-mail address (NFR-028).
    expect(everything()).not.toContain(ADMIN.name);
    expect(everything()).not.toContain(ADMIN.email);
  });

  it('[AC-8] a planted secret in a thrown message, a cookie and an address appears in no page-render log line', async () => {
    const token = await tokenFor(ADMIN.id);
    await logRequestError(
      new Error(`render failed for ${PLANTED}`, { cause: new Error(PLANTED) }),
      failedRequest({ cookie: `${sessionCookieName(false)}=${token}; planted=${PLANTED}`, authorization: PLANTED }, `/estimates/${PLANTED}?token=${PLANTED}`, 'POST'),
      RENDER_CONTEXT,
      harness().dependencies,
    );
    expect(errorLines()).toHaveLength(1);
    expect(everything()).not.toContain(PLANTED);
    // Nor the token itself: the cookie is read, never logged.
    expect(everything()).not.toContain(token);
    expect(everything()).not.toContain(ADMIN.name);
    expect(everything()).not.toContain(ADMIN.email);
  });

  it('[AC-8] a planted secret in a thrown message appears in no job log line and no job_runs row', async () => {
    const rows: FailedJobRun[] = [];
    await runJob(
      { name: 'backup-watch', log: (message, level, fields) => void (level === 'error' ? logger.error({ ...fields }, message) : logger.info({ ...fields }, message)), now: () => NOW, recordFailure: (run) => Promise.resolve(void rows.push(run)) },
      () => Promise.reject(new Error(`password ${PLANTED}`, { cause: new Error(PLANTED) })),
    );
    expect(errorLines()).toHaveLength(1);
    expect(everything()).not.toContain(PLANTED);
    expect(JSON.stringify(rows)).not.toContain(PLANTED);
  });
});
