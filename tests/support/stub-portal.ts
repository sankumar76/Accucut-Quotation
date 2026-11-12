import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * A stand-in for the portal and its build, for the tests of the JS budget check (STORY-10.10 T3). It answers what a
 * production `next start` answers for the check: a redirect to sign-in without a session, the page with one,
 * next-auth's CSRF and credentials endpoints, and a 404 page for a path nothing serves. The files are a small invented
 * `.next/static`. No `next build` runs, and every value is invented.
 */

export const STUB_EMAIL = 'stub-admin@example.test';
export const STUB_PASSWORD = 'invented-stub-password';
export const STUB_CUSTOMER_ID = 'invented-stub-customer';
const SESSION = 'invented-stub-session';

/** Bytes that gzip cannot shrink (a hash chain), so the compressed size is about the raw size and a test can plant an overrun. */
export function incompressible(length: number): Buffer {
  const blocks: Buffer[] = [];
  let seed = createHash('sha256').update('js-budget-stub').digest();
  for (let size = 0; size < length; size += seed.length) {
    blocks.push(seed);
    seed = createHash('sha256').update(seed).digest();
  }
  return Buffer.concat(blocks).subarray(0, length);
}

export interface StubPage {
  /** What a signed-out visitor gets. Default: a redirect to the sign-in page. */
  readonly anonymous?: { readonly status: number; readonly html?: string; readonly location?: string };
  /** What a signed-in visitor gets. */
  readonly signedIn: { readonly status: number; readonly html?: string };
}

export function pageNaming(...chunks: string[]): string {
  return `<html><head>${chunks.map((chunk) => `<script src="/_next/static/chunks/${chunk}" async=""></script>`).join('')}</head><body></body></html>`;
}

export interface StubBuild {
  readonly directory: string;
  cleanup(): void;
}

/** A temporary build: the given static files and the app-path list for the given page keys. */
export function createStubBuild(staticFiles: Readonly<Record<string, Buffer | string>>, appPaths: ReadonlyArray<string>): StubBuild {
  const directory = mkdtempSync(join(tmpdir(), 'stub-build-'));
  const write = (relative: string, content: Buffer | string): void => {
    const file = join(directory, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  for (const [name, content] of Object.entries(staticFiles)) write(`.next/static/${name}`, content);
  write('.next/server/app-paths-manifest.json', JSON.stringify(Object.fromEntries(appPaths.map((key) => [key, `app${key}.js`]))));
  return { directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

export interface StubPortal {
  readonly baseUrl: string;
  close(): Promise<void>;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => resolve(body));
  });
}

/** Serves `pages` by path. A path not listed is a 404 page for a signed-in visitor and a redirect for a signed-out one. */
export async function startStubPortal(pages: Readonly<Record<string, StubPage>>, notFoundHtml: string): Promise<StubPortal> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://stub.invalid');
      if (url.pathname === '/api/auth/csrf') {
        response.writeHead(200, { 'content-type': 'application/json', 'set-cookie': '__Host-next-auth.csrf-token=stub-csrf; Path=/; HttpOnly; Secure' });
        response.end(JSON.stringify({ csrfToken: 'stub-csrf' }));
        return;
      }
      if (url.pathname === '/api/auth/callback/credentials' && request.method === 'POST') {
        const form = new URLSearchParams(await readBody(request));
        const accepted = form.get('email') === STUB_EMAIL && form.get('password') === STUB_PASSWORD;
        response.writeHead(200, { 'content-type': 'application/json', ...(accepted ? { 'set-cookie': `__Secure-next-auth.session-token=${SESSION}; Path=/; HttpOnly; Secure` } : {}) });
        response.end(JSON.stringify({ url: '/' }));
        return;
      }
      const signedIn = (request.headers.cookie ?? '').includes(`session-token=${SESSION}`);
      if (url.pathname === '/api/v1/customers' && request.method === 'POST') {
        // The record the budget check opens `/masters/customers/[id]` at (STORY-02.02): a signed-in caller gets a customer's ID back.
        response.writeHead(signedIn ? 201 : 401, { 'content-type': 'application/json' });
        response.end(JSON.stringify(signedIn ? { id: STUB_CUSTOMER_ID } : {}));
        return;
      }
      const page = pages[url.pathname];
      if (!signedIn) {
        const anonymous = page?.anonymous ?? { status: 307, location: '/sign-in' };
        response.writeHead(anonymous.status, anonymous.location === undefined ? {} : { location: anonymous.location });
        response.end(anonymous.html ?? '');
        return;
      }
      response.writeHead(page?.signedIn.status ?? 404);
      response.end(page?.signedIn.html ?? notFoundHtml);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('the stub portal got no port');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
