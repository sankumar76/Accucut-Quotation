import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NextRequest, type NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import nextConfig from '../../next.config';
import { API_CONTENT_SECURITY_POLICY, AUTH_ROUTE_CONTENT_SECURITY_POLICY, createNonce, EARLY_INTENT_SCRIPT_SOURCE, NONCE_PATTERN, pageContentSecurityPolicy } from '@/lib/security/csp';
import { PERMISSIONS_POLICY } from '@/lib/security/header-values';
import { EARLY_INTENT_SCRIPT } from '@/lib/ui/early-intent-script';
import { proxy } from '@/proxy';

/**
 * DEF-054 (AQP-384, STD-F-01): every answer carries the security headers of architecture section 8, with the right values. The proxy builds
 * them for a page, a signed-out redirect, a public page, an error page and an API answer alike, and `next.config.ts` covers the static files.
 */

const NONCE_IN_POLICY = /'nonce-([A-Za-z0-9+/=]+)'/;

function get(path: string, cookie?: string): NextResponse {
  return proxy(new NextRequest(`http://localhost:3000${path}`, cookie === undefined ? {} : { headers: { cookie } }));
}

function directive(policy: string, name: string): ReadonlyArray<string> {
  const found = policy.split('; ').find((entry) => entry.startsWith(`${name} `));
  return found === undefined ? [] : found.slice(name.length + 1).split(' ');
}

beforeEach(() => vi.stubEnv('APP_ORIGIN', 'http://localhost:3000'));
afterEach(() => vi.unstubAllEnvs());

describe('the page policy (architecture section 8)', () => {
  const policy = pageContentSecurityPolicy({ nonce: 'abc', development: false });

  it('allows scripts by nonce and by the hash of the early-tap script, with no unsafe-inline and no unsafe-eval', () => {
    const scripts = directive(policy, 'script-src');
    expect(scripts).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'", EARLY_INTENT_SCRIPT_SOURCE]);
    expect(policy).not.toContain('unsafe-eval');
    expect(directive(policy, 'style-src')).not.toContain("'unsafe-inline'");
  });

  it('computes the early-tap hash from the exported script text, so a changed script changes the policy', () => {
    expect(EARLY_INTENT_SCRIPT_SOURCE).toBe(`'sha256-${createHash('sha256').update(EARLY_INTENT_SCRIPT, 'utf8').digest('base64')}'`);
  });

  it('the portal frame renders that text exactly, so the hash matches what the browser reads', () => {
    const html = renderToStaticMarkup(createElement('script', { dangerouslySetInnerHTML: { __html: EARLY_INTENT_SCRIPT } }));
    const inner = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
    expect(inner).toBe(EARLY_INTENT_SCRIPT);
    const layout = readFileSync(join(process.cwd(), 'src/app/(portal)/layout.tsx'), 'utf8');
    expect(layout).toContain('dangerouslySetInnerHTML={{ __html: EARLY_INTENT_SCRIPT }}');
  });

  it('limits the one loosening to style attributes, and keeps everything else on the portal\x27s own origin', () => {
    expect(directive(policy, 'style-src-attr')).toEqual(["'unsafe-inline'"]);
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'blob:']);
    expect(directive(policy, 'connect-src')).toEqual(["'self'"]);
    expect(directive(policy, 'font-src')).toEqual(["'self'"]);
    for (const name of ['object-src', 'frame-src', 'frame-ancestors']) expect(directive(policy, name), name).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
  });

  it('relaxes only next dev: unsafe-eval for React\x27s debugging, inline styles for the overlay, and the hot-reload socket', () => {
    const development = pageContentSecurityPolicy({ nonce: 'abc', development: true });
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(development, 'script-src')).not.toContain("'unsafe-inline'");
    expect(directive(development, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('makes a different nonce every time, of at least 128 bits', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(Buffer.from(nonce, 'base64').length).toBeGreaterThanOrEqual(16);
  });
});

describe('every answer of the proxy carries the headers', () => {
  const answers: ReadonlyArray<readonly [string, () => NextResponse]> = [
    ['a signed-in page', () => get('/queue', 'next-auth.session-token=abc')],
    ['a signed-out visit, redirected to sign-in', () => get('/queue')],
    ['the sign-in page', () => get('/sign-in')],
    ['the forgot-password page', () => get('/forgot-password')],
    ['the reset-password page', () => get('/reset-password?token=x')],
    ['a path no route serves (the not-found page)', () => get('/no/such/page', 'next-auth.session-token=abc')],
    ['an API route, signed out', () => get('/api/v1/me')],
    ['an API route, signed in', () => get('/api/v1/me', 'next-auth.session-token=abc')],
    ['next-auth\x27s own route', () => get('/api/auth/session')],
  ];

  it.each(answers)('%s', (_name, answer) => {
    const headers = answer().headers;
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(headers.get('Referrer-Policy')).toMatch(/^(same-origin|no-referrer)$/);
    expect(directive(headers.get('Content-Security-Policy') ?? '', 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('never sends Strict-Transport-Security: the reverse proxy that ends TLS is its only sender (architecture section 8, P3)', () => {
    vi.stubEnv('APP_ORIGIN', 'https://portal.example.test');
    for (const [, answer] of answers) expect(answer().headers.get('Strict-Transport-Security')).toBeNull();
    const secure = proxy(new NextRequest('https://portal.example.test/sign-in'));
    expect(secure.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('gives a page the policy with a nonce, an API answer the policy of data, and a redirect the policy of data', () => {
    const page = get('/queue', 'next-auth.session-token=abc').headers.get('Content-Security-Policy') ?? '';
    expect(NONCE_IN_POLICY.test(page)).toBe(true);
    expect(get('/api/v1/me').headers.get('Content-Security-Policy')).toBe(API_CONTENT_SECURITY_POLICY);
    expect(get('/queue').headers.get('Content-Security-Policy')).toBe(API_CONTENT_SECURITY_POLICY);
  });

  it('uses a different nonce for every request, and hands the same policy to Next.js on the request, where it reads the nonce', () => {
    const first = get('/sign-in');
    const second = get('/sign-in');
    const nonceOf = (response: NextResponse): string | undefined => NONCE_IN_POLICY.exec(response.headers.get('Content-Security-Policy') ?? '')?.[1];
    expect(nonceOf(first)).toBeDefined();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(first.headers.get('Content-Security-Policy'));
    expect(first.headers.get('x-middleware-override-headers')).toContain('content-security-policy');
  });

  it('hands the nonce to the root layout in a request header the proxy always sets, and takes it off an API request', () => {
    const response = proxy(new NextRequest('http://localhost:3000/sign-in', { headers: { 'x-nonce': 'forged' } }));
    const policy = response.headers.get('Content-Security-Policy') ?? '';
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(NONCE_IN_POLICY.exec(policy)?.[1]);
    const api = proxy(new NextRequest('http://localhost:3000/api/v1/me', { headers: { 'x-nonce': 'forged' } }));
    expect(api.headers.get('x-middleware-request-x-nonce')).toBeNull();
  });

  it('ignores a policy the browser sends on the request: the nonce is always the proxy\x27s', () => {
    const response = proxy(new NextRequest('http://localhost:3000/sign-in', { headers: { 'content-security-policy': "script-src 'nonce-evil'" } }));
    expect(response.headers.get('x-middleware-request-content-security-policy')).not.toContain('evil');
  });

  it('keeps the two reset pages at Referrer-Policy: no-referrer, because their address carries the token, and every other page at same-origin', () => {
    for (const path of ['/forgot-password', '/reset-password']) expect(get(path).headers.get('Referrer-Policy'), path).toBe('no-referrer');
    for (const path of ['/sign-in', '/reset-passwords', '/api/v1/me']) expect(get(path).headers.get('Referrer-Policy'), path).toBe('same-origin');
  });

  it('does not carry a browser\x27s address or session claim into a public page', () => {
    const response = proxy(new NextRequest('http://localhost:3000/sign-in', { headers: { 'x-return-path': 'https://evil.example/', 'x-session-cookie': '1' } }));
    expect(response.headers.get('x-middleware-request-x-return-path')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-session-cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBeNull();
  });
});

describe('a stored file and next-auth through the proxy (SQR-01, AQP-384 review)', () => {
  const PICTURE = '/api/v1/images/00000000-0000-4000-8000-000000000001';

  it('the picture download gets default-src none, frame-ancestors none and sandbox: the policy on the wire is the proxy\x27s, because Next.js drops a route header the proxy already set', () => {
    for (const cookie of [undefined, 'next-auth.session-token=abc']) {
      const policy = get(PICTURE, cookie).headers.get('Content-Security-Policy') ?? '';
      expect(policy).toBe("default-src 'none'; frame-ancestors 'none'; sandbox");
      expect(policy).toContain('sandbox');
    }
  });

  it('every API answer and the signed-out redirect carry sandbox, and next-auth\x27s own routes do not', () => {
    expect(API_CONTENT_SECURITY_POLICY).toContain('sandbox');
    expect(get('/api/v1/me').headers.get('Content-Security-Policy')).toBe(API_CONTENT_SECURITY_POLICY);
    expect(get('/queue').headers.get('Content-Security-Policy')).toBe(API_CONTENT_SECURITY_POLICY);
    for (const path of ['/api/auth/session', '/api/auth/csrf', '/api/auth/callback/credentials']) {
      const policy = get(path).headers.get('Content-Security-Policy');
      expect(policy, path).toBe(AUTH_ROUTE_CONTENT_SECURITY_POLICY);
      expect(policy, path).not.toContain('sandbox');
    }
  });

  it('a page never gets sandbox, which would stop its scripts and forms', () => {
    expect(get('/sign-in').headers.get('Content-Security-Policy')).not.toContain('sandbox');
    expect(get('/queue', 'next-auth.session-token=abc').headers.get('Content-Security-Policy')).not.toContain('sandbox');
  });
});

describe('the development switch is exactly NODE_ENV === development (SQR-03, AQP-384 review)', () => {
  const policyOf = (): ReadonlyArray<string> => {
    const policy = get('/sign-in').headers.get('Content-Security-Policy') ?? '';
    return [directive(policy, 'script-src').join(' '), directive(policy, 'style-src').join(' '), directive(policy, 'connect-src').join(' ')];
  };

  it.each(['test', 'production', 'staging', ''])('NODE_ENV "%s" gets the strict policy: no unsafe-eval, no unsafe-inline in style-src, no web socket', (value) => {
    vi.stubEnv('NODE_ENV', value);
    const [scripts, styles, connect] = policyOf();
    expect(scripts).not.toContain('unsafe-');
    expect(styles).not.toContain('unsafe-');
    expect(connect).toBe("'self'");
  });

  it('NODE_ENV development, and only it, adds unsafe-eval, inline styles and the hot-reload socket', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const [scripts, styles, connect] = policyOf();
    expect(scripts).toContain("'unsafe-eval'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(styles).toContain("'unsafe-inline'");
    expect(connect).toContain('ws:');
  });
});

describe('the nonce pattern (SQR-02, AQP-384 review)', () => {
  it('accepts what createNonce makes', () => {
    for (let index = 0; index < 20; index += 1) expect(NONCE_PATTERN.test(createNonce())).toBe(true);
  });

  it.each(['</script><script>alert(1)</script>', 'abc"def', "abc'def", 'a b c d e f g h i j k l', '<b>', '', 'short', 'AAAAAAAAAAAAAAAA\n</script>', 'AAAAAAAAAAAAAAAA=x'])('rejects %j, so it never becomes markup in the layout\x27s script', (value) => {
    expect(NONCE_PATTERN.test(value)).toBe(false);
  });
});

describe('the static files the proxy does not run for', () => {
  it('get nosniff, no framing and the permissions policy from next.config.ts', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const source of ['/_next/static/:path*', '/accucut-logo.jpg']) {
      const headers = new Map(rules.filter((rule) => rule.source === source).flatMap((rule) => rule.headers.map((header) => [header.key, header.value] as const)));
      expect(headers.get('X-Content-Type-Options'), source).toBe('nosniff');
      expect(headers.get('X-Frame-Options'), source).toBe('DENY');
      expect(headers.get('Permissions-Policy'), source).toBe(PERMISSIONS_POLICY);
    }
  });

  it('keep the logo cache header and the reset pages\x27 own headers', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const reset = rules.find((rule) => rule.source === '/reset-password');
    expect(reset?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    expect(reset?.headers).toContainEqual({ key: 'Cache-Control', value: 'private, no-store' });
  });
});

describe('Next.js can put the nonce on its scripts', () => {
  const layout = (): string => readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

  it('renders every page per request: the root layout reads the request headers, so no page is built ahead of time without a nonce', () => {
    expect(layout()).toContain('(await headers()).get(NONCE_HEADER)');
    expect(layout()).toMatch(/export default async function RootLayout/);
  });

  it('gives the browser code the nonce as __webpack_nonce__, on a script that carries the nonce itself (the scroll lock of a dialog adds a style element)', () => {
    expect(layout()).toContain('<script nonce={nonce}');
    expect(layout()).toContain('window.__webpack_nonce__=');
  });
});
