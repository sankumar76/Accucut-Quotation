import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { createMicrosoftTokenProvider, MailTokenError, OUTLOOK_SCOPE, TOKEN_RENEWAL_MARGIN_MILLISECONDS } from '@/server/mail/microsoft-token';

/**
 * STORY-09.01 AC-3 (OAuth mode) and AC-7 (no secret leaks), against a local stub of Microsoft's token endpoint: a real HTTP server on a free local port, so the request that
 * `fetch` makes is the real one. The token URL base is injected; nothing leaves the machine. The secret below is invented.
 */

const PLANTED_SECRET = 'planted-client-secret-value';
const TENANT = 'tenant-for-tests';
const CLIENT = 'client-for-tests';

interface Received {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly contentType: string | undefined;
  readonly form: URLSearchParams;
}

let server: Server;
let baseUrl = '';
let received: Received[] = [];
/** What the stub does with the next request. */
let respond: (request: IncomingMessage, response: ServerResponse) => void = () => undefined;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

let issued = 0;
const issueToken = (expiresIn = 3600) => (_request: IncomingMessage, response: ServerResponse) => {
  issued += 1;
  json(response, 200, { token_type: 'Bearer', expires_in: expiresIn, access_token: `token-${issued}` });
};

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({ method: request.method, path: request.url, contentType: request.headers['content-type'], form: new URLSearchParams(Buffer.concat(chunks).toString('utf8')) });
      respond(request, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  issued = 0;
  respond = issueToken();
});

const NOW = new Date('2026-11-18T10:00:00.000Z');

function provider(overrides: { timeoutMilliseconds?: number } = {}) {
  const clock = createFixedClock(NOW);
  return { clock, tokens: createMicrosoftTokenProvider({ tenantId: TENANT, clientId: CLIENT, clientSecret: PLANTED_SECRET }, { clock, baseUrl, ...overrides }) };
}

describe('the token request (AC-3)', () => {
  it('AC-3: POSTs the client credentials to <base>/<tenant>/oauth2/v2.0/token with the Outlook scope, as a form', async () => {
    const { tokens } = provider();
    const token = await tokens.getToken(false);
    expect(token.accessToken).toBe('token-1');
    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe('POST');
    expect(received[0]?.path).toBe(`/${TENANT}/oauth2/v2.0/token`);
    expect(received[0]?.contentType).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(received[0]?.form ?? [])).toEqual({ client_id: CLIENT, client_secret: PLANTED_SECRET, scope: OUTLOOK_SCOPE, grant_type: 'client_credentials' });
    expect(OUTLOOK_SCOPE).toBe('https://outlook.office365.com/.default');
  });

  it('AC-3: puts the secret in the body only, never in the address', async () => {
    await provider().tokens.getToken(false);
    expect(received[0]?.path).not.toContain(PLANTED_SECRET);
  });

  it('AC-3: encodes the tenant as one path segment, so a crafted tenant cannot change the path', async () => {
    const clock = createFixedClock(NOW);
    await createMicrosoftTokenProvider({ tenantId: '../evil?x=1', clientId: CLIENT, clientSecret: PLANTED_SECRET }, { clock, baseUrl }).getToken(false);
    expect(received[0]?.path).toBe('/..%2Fevil%3Fx%3D1/oauth2/v2.0/token');
  });
});

describe('keeping and renewing the token (AC-3)', () => {
  it('AC-3: keeps the token until shortly before it expires: a second call within its life makes no request', async () => {
    const { tokens, clock } = provider();
    await tokens.getToken(false);
    clock.advance(54 * MILLISECONDS_PER_MINUTE);
    expect((await tokens.getToken(false)).accessToken).toBe('token-1');
    expect(received).toHaveLength(1);
  });

  it('AC-3: renews it once it is within the renewal margin of its end', async () => {
    const { tokens, clock } = provider();
    const first = await tokens.getToken(false);
    expect(TOKEN_RENEWAL_MARGIN_MILLISECONDS).toBe(5 * MILLISECONDS_PER_MINUTE);
    expect(first.renewAtMs).toBe(NOW.getTime() + 55 * MILLISECONDS_PER_MINUTE);
    clock.advance(56 * MILLISECONDS_PER_MINUTE);
    expect((await tokens.getToken(false)).accessToken).toBe('token-2');
    expect(received).toHaveLength(2);
  });

  it('AC-3: renews at once when Nodemailer says the token was refused (renew = true)', async () => {
    const { tokens } = provider();
    await tokens.getToken(false);
    expect((await tokens.getToken(true)).accessToken).toBe('token-2');
  });

  it('AC-3: a refused token does not come back from the cache if the renewal fails', async () => {
    const { tokens } = provider();
    await tokens.getToken(false);
    respond = (_request, response) => json(response, 500, {});
    await expect(tokens.getToken(true)).rejects.toBeInstanceOf(MailTokenError);
    respond = issueToken();
    expect((await tokens.getToken(false)).accessToken).toBe('token-2');
  });

  it('AC-3: a token that lives under ten minutes is renewed at half its life, not at once', async () => {
    respond = issueToken(120);
    const { tokens, clock } = provider();
    const token = await tokens.getToken(false);
    expect(token.renewAtMs).toBe(NOW.getTime() + 60_000);
    clock.advance(30_000);
    await tokens.getToken(false);
    expect(received).toHaveLength(1);
  });

  it('AC-3: five calls at once make one request', async () => {
    respond = (request, response) => setTimeout(() => issueToken()(request, response), 30);
    const { tokens } = provider();
    const all = await Promise.all([tokens.getToken(false), tokens.getToken(false), tokens.getToken(false), tokens.getToken(false), tokens.getToken(false)]);
    expect(received).toHaveLength(1);
    expect(new Set(all.map((token) => token.accessToken))).toEqual(new Set(['token-1']));
  });
});

describe('a failed token request (AC-3, AC-7)', () => {
  async function failure(run: () => Promise<unknown>): Promise<MailTokenError> {
    try {
      await run();
    } catch (error) {
      if (error instanceof MailTokenError) return error;
      throw error;
    }
    throw new Error('The request was expected to fail.');
  }

  it('AC-3: a 401 is `refused` and the class is AUTH_FAILED', async () => {
    respond = (_request, response) => json(response, 401, { error: 'invalid_client' });
    const error = await failure(() => provider().tokens.getToken(false));
    expect(error.reason).toBe('refused');
    expect(error.code).toBe('AUTH_FAILED');
  });

  it('AC-7: the error holds none of the secret, the tenant, the client or what Microsoft said, even when the answer echoes them', async () => {
    respond = (_request, response) => json(response, 400, { error: 'invalid_client', error_description: `client ${CLIENT} secret ${PLANTED_SECRET} tenant ${TENANT}` });
    const error = await failure(() => provider().tokens.getToken(false));
    const shown = `${error.message} ${error.name} ${JSON.stringify(error)} ${String(error.stack)}`;
    for (const value of [PLANTED_SECRET, TENANT, CLIENT, 'invalid_client']) expect(shown).not.toContain(value);
  });

  it('AC-3: an answer that is not a token is `malformed`', async () => {
    respond = (_request, response) => json(response, 200, { hello: 'world' });
    expect((await failure(() => provider().tokens.getToken(false))).reason).toBe('malformed');
    respond = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('not json');
    };
    expect((await failure(() => provider().tokens.getToken(false))).reason).toBe('malformed');
  });

  it('AC-3: a server that does not answer in time is `unreachable`, and the request is cut off', async () => {
    respond = () => undefined;
    const error = await failure(() => provider({ timeoutMilliseconds: 80 }).tokens.getToken(false));
    expect(error.reason).toBe('unreachable');
  });

  it('AC-3: a server that cannot be reached is `unreachable`', async () => {
    const clock = createFixedClock(NOW);
    const tokens = createMicrosoftTokenProvider({ tenantId: TENANT, clientId: CLIENT, clientSecret: PLANTED_SECRET }, { clock, baseUrl: 'http://127.0.0.1:1' });
    const error = await failure(() => tokens.getToken(false));
    expect(error.reason).toBe('unreachable');
    expect(error.message).not.toContain(PLANTED_SECRET);
  });

  it('AC-7: a redirect is refused, so the secret is never sent on to another address', async () => {
    respond = (_request, response) => {
      response.writeHead(307, { location: `${baseUrl}/elsewhere` });
      response.end();
    };
    await failure(() => provider().tokens.getToken(false));
    expect(received.map((request) => request.path)).toEqual([`/${TENANT}/oauth2/v2.0/token`]);
  });

  it('AC-3: a failure is not cached: the next call asks again', async () => {
    const { tokens } = provider();
    respond = (_request, response) => json(response, 503, {});
    await failure(() => tokens.getToken(false));
    respond = issueToken();
    expect((await tokens.getToken(false)).accessToken).toBe('token-1');
  });
});
