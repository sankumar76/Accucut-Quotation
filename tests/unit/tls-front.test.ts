import { mkdtempSync, rmSync, statSync, utimesSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureSelfSignedCertificate, startTlsFront } from '../../scripts/lib/tls-front';

/**
 * STORY-10.08 AC-6 (NFR-019): the TLS front that lets WebKit keep the portal's Secure session cookie (`scripts/lib/tls-front.ts`). It must pass a request to the portal unchanged (method, path,
 * headers, body) and the answer back unchanged (status, every header, both cookies), because the portal's origin check and cookies depend on it. These tests make a throwaway certificate with `openssl`
 * (present on the CI runner and in Git for Windows) and use two servers on free ports; nothing is written outside the system's temporary folder.
 */

interface Seen {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
}

interface Answer {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

let folder: string;
let upstream: http.Server;
let front: https.Server;
const seen: Seen[] = [];

const portOf = (server: http.Server | https.Server): number => (server.address() as AddressInfo).port;

function ask(port: number, options: { method?: string; path: string; headers?: http.OutgoingHttpHeaders; body?: string }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const request = https.request({ host: '127.0.0.1', port, method: options.method ?? 'GET', path: options.path, headers: options.headers, rejectUnauthorized: false }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end(options.body);
  });
}

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'tls-front-test-'));
  upstream = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString('utf8') });
      if (request.url === '/missing') {
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end('not here');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': ['__Host-a=1; Path=/; Secure', '__Secure-b=2; Path=/; Secure'], location: '/queue' });
      response.end('answer');
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  front = await startTlsFront({ port: 0, upstreamPort: portOf(upstream), material: ensureSelfSignedCertificate(folder) });
});

afterAll(async () => {
  await new Promise((resolve) => front.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
  rmSync(folder, { recursive: true, force: true });
});

describe('AC-6: the TLS front passes a request to the portal and its answer back unchanged', () => {
  it('passes the method, the path with its query, the headers (Origin, Host, the client address, the cookie) and the body', async () => {
    seen.length = 0;
    const answer = await ask(portOf(front), {
      method: 'POST',
      path: '/api/auth/callback/credentials?x=1',
      headers: { origin: 'https://localhost:3100', host: 'localhost:3100', 'x-forwarded-for': '203.0.113.7, 198.51.100.9', cookie: 'a=b', 'content-type': 'application/json' },
      body: '{"hello":"world"}',
    });
    expect(answer.status).toBe(200);
    expect(answer.body).toBe('answer');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.url).toBe('/api/auth/callback/credentials?x=1');
    expect(seen[0]?.body).toBe('{"hello":"world"}');
    expect(seen[0]?.headers['origin']).toBe('https://localhost:3100');
    expect(seen[0]?.headers['host']).toBe('localhost:3100');
    expect(seen[0]?.headers['x-forwarded-for']).toBe('203.0.113.7, 198.51.100.9');
    expect(seen[0]?.headers['cookie']).toBe('a=b');
  });

  it('keeps the status, the Location and every Set-Cookie of the answer (the session cookie and the CSRF cookie are two headers)', async () => {
    const answer = await ask(portOf(front), { path: '/api/auth/csrf' });
    expect(answer.headers['location']).toBe('/queue');
    expect(answer.headers['set-cookie']).toEqual(['__Host-a=1; Path=/; Secure', '__Secure-b=2; Path=/; Secure']);
    const missing = await ask(portOf(front), { path: '/missing' });
    expect(missing.status).toBe(404);
    expect(missing.body).toBe('not here');
  });

  it('answers 502 with a plain message when the portal is not there, and does not crash', async () => {
    // A port that was just given up: nothing listens there.
    const closed = http.createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const closedPort = portOf(closed);
    await new Promise((resolve) => closed.close(resolve));
    const lonely = await startTlsFront({ port: 0, upstreamPort: closedPort, material: ensureSelfSignedCertificate(folder) });
    try {
      const answer = await ask(portOf(lonely), { path: '/' });
      expect(answer.status).toBe(502);
      expect(answer.body).toBe('The portal did not answer.');
    } finally {
      await new Promise((resolve) => lonely.close(resolve));
    }
  });
});

describe('STD-C-04 (#693): the front listens on loopback only', () => {
  it('is bound to 127.0.0.1, not to every interface (0.0.0.0 or ::), so a run by hand on an office or Wi-Fi network opens no port to it', () => {
    const bound = front.address() as AddressInfo;
    expect(bound.address).toBe('127.0.0.1');
    expect(bound.family).toBe('IPv4');
    expect(['0.0.0.0', '::']).not.toContain(bound.address);
  });

  it('is still reached by the name the browsers of the sweep use, https://localhost:<port>, where localhost may resolve to ::1 first (the client tries the next address)', async () => {
    const answer = await new Promise<Answer>((resolve, reject) => {
      const request = https.request({ host: 'localhost', port: portOf(front), path: '/sign-in', rejectUnauthorized: false }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject);
      request.end();
    });
    expect(answer.status).toBe(200);
    expect(answer.body).toBe('answer');
  });
});

describe('the throwaway certificate', () => {
  it('is made once and reused while it is fresh, and made again when it is older than half a day', () => {
    const own = mkdtempSync(join(tmpdir(), 'tls-front-cert-'));
    try {
      const first = ensureSelfSignedCertificate(own);
      const certFile = join(own, 'localhost-cert.pem');
      const made = statSync(certFile).mtimeMs;
      expect(ensureSelfSignedCertificate(own)).toEqual(first);
      expect(statSync(certFile).mtimeMs).toBe(made);
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      utimesSync(certFile, old, old);
      expect(ensureSelfSignedCertificate(own).cert).not.toBe(first.cert);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });

  it('holds a private key and a certificate in PEM form, and is never a file of the repository (the ignore list names *.pem)', () => {
    const own = mkdtempSync(join(tmpdir(), 'tls-front-pem-'));
    try {
      const material = ensureSelfSignedCertificate(own);
      expect(material.key).toMatch(/BEGIN (RSA )?PRIVATE KEY/);
      expect(material.cert).toMatch(/BEGIN CERTIFICATE/);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });
});
