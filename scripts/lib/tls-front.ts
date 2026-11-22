/**
 * A TLS front for the sweep's server (STORY-10.08, AQP-370; NFR-019). The production build sets the session cookie `Secure` and `__Host-` prefixed (STORY-01.02 AC-5), as it must behind
 * HTTPS. Chromium and Firefox keep a Secure cookie that a page on `http://localhost` receives; WebKit (Playwright's Linux build) does not, so signing in over plain http never produced a
 * session and every WebKit journey stayed on the sign-in screen (run 44931496595). Real Safari users always arrive over HTTPS, so the sweep serves the portal over HTTPS too: `next start` listens
 * on an internal port, and this front, on the portal's own port, terminates TLS with a throwaway certificate and passes every request to it unchanged.
 *
 * The front changes nothing the portal sees except the scheme the browser used: the headers (the client address of `useFreshAddress`, `Origin`, `Host`, cookies) go through as they came,
 * so the portal's origin check, which compares `Origin` with `APP_ORIGIN`, sees `https://localhost:<port>` on both sides. It is a test tool: the certificate is self-signed, valid for two days,
 * made in the job's own folder and never committed (`*.pem` is ignored), and the front listens for the life of one run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import { join } from 'node:path';

export interface TlsMaterial {
  readonly key: string;
  readonly cert: string;
}

const KEY_FILE = 'localhost-key.pem';
const CERT_FILE = 'localhost-cert.pem';
const VALID_DAYS = 2;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** A certificate older than this is made again, so a folder left from an earlier day never serves one that is about to expire. */
const REUSE_MAX_AGE_MS = ONE_DAY_MS / 2;
const UPSTREAM_HOST = '127.0.0.1';

/**
 * The key and certificate in `directory`, made with `openssl` when they are missing or older than half a day: a self-signed certificate for `localhost` and `127.0.0.1`. The browsers of the sweep
 * are told to accept it (`ignoreHTTPSErrors`); nothing else trusts it.
 */
export function ensureSelfSignedCertificate(directory: string): TlsMaterial {
  const keyFile = join(directory, KEY_FILE);
  const certFile = join(directory, CERT_FILE);
  const fresh = existsSync(keyFile) && existsSync(certFile) && Date.now() - statSync(certFile).mtimeMs < REUSE_MAX_AGE_MS;
  if (!fresh) {
    mkdirSync(directory, { recursive: true });
    try {
      execFileSync(
        'openssl',
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', String(VALID_DAYS), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'],
        { stdio: 'pipe' },
      );
    } catch (error) {
      throw new Error(`The sweep serves the portal over HTTPS and needs the "openssl" command to make its throwaway certificate: ${error instanceof Error ? error.message : 'it did not run'}`);
    }
  }
  return { key: readFileSync(keyFile, 'utf8'), cert: readFileSync(certFile, 'utf8') };
}

export interface TlsFrontOptions {
  /** The port the browsers use (the portal's own origin). */
  readonly port: number;
  /** The port `next start` listens on, on the same machine. */
  readonly upstreamPort: number;
  readonly material: TlsMaterial;
}

function pass(request: IncomingMessage, response: ServerResponse, upstreamPort: number): void {
  const forwarded = http.request({ host: UPSTREAM_HOST, port: upstreamPort, method: request.method, path: request.url, headers: request.headers }, (answer) => {
    response.writeHead(answer.statusCode ?? 502, answer.statusMessage, answer.headers);
    answer.pipe(response);
  });
  forwarded.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
    response.end('The portal did not answer.');
  });
  // A browser that goes away takes its request to the portal with it.
  response.on('close', () => forwarded.destroy());
  request.pipe(forwarded);
}

/** Starts the front and resolves once it listens. Close it with `server.close()`. */
export function startTlsFront({ port, upstreamPort, material }: TlsFrontOptions): Promise<https.Server> {
  const server = https.createServer({ key: material.key, cert: material.cert }, (request, response) => pass(request, response, upstreamPort));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}
