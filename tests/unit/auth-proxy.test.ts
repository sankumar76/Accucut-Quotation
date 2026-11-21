import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isPublicPath } from '@/lib/auth/public-path';
import { config, proxy } from '@/proxy';

/**
 * STORY-01.01 AC-4: a signed-out visitor is sent to the sign-in page, and what the proxy lets through carries
 * `Cache-Control: private, no-store`. The proxy only looks for the cookie; it is never the authorisation check
 * (the real check is `requireUser`, tested with the database in `tests/integration/auth`).
 */

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, cookie === undefined ? {} : { headers: { cookie } });
}

describe('AC-4: a signed-out visitor goes to the sign-in page', () => {
  beforeEach(() => vi.stubEnv('APP_ORIGIN', 'http://localhost:3000'));
  afterEach(() => vi.unstubAllEnvs());

  it('sends the visitor to the portal\x27s own origin, not to whatever host name the request carries (behind the reverse proxy)', () => {
    vi.stubEnv('APP_ORIGIN', 'https://portal.example.test');
    const response = proxy(new NextRequest('http://app-internal:3000/queue/x'));
    expect(response.headers.get('Location')).toBe('https://portal.example.test/sign-in?callbackUrl=%2Fqueue%2Fx');
  });

  it('outside production, the address of the request stands in when no origin is set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_ORIGIN', '');
    expect(proxy(request('/queue/x')).headers.get('Location')).toBe('http://localhost:3000/sign-in?callbackUrl=%2Fqueue%2Fx');
  });

  it('in production there is no fallback: a missing or malformed origin fails loudly, never trusting the Host header (STD-03)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const value of ['', 'not a url', 'http://portal.example.test/with/path', 'ftp://portal.example.test']) {
      vi.stubEnv('APP_ORIGIN', value);
      expect(() => proxy(new NextRequest('http://evil-host.example/queue'))).toThrow('APP_ORIGIN');
    }
  });

  it('in production the validated origin is used, whatever Host header the request carries', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'https://portal.example.test');
    const response = proxy(new NextRequest('http://evil-host.example/queue/x', { headers: { host: 'evil-host.example' } }));
    expect(response.headers.get('Location')).toBe('https://portal.example.test/sign-in?callbackUrl=%2Fqueue%2Fx');
  });

  it('redirects to the sign-in page with the requested page remembered, and says "do not index"', () => {
    const response = proxy(request('/estimates/Q-2026-0001?tab=a'));
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/sign-in?callbackUrl=%2Festimates%2FQ-2026-0001%3Ftab%3Da');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('sends a visitor to the home page to the bare sign-in page', () => {
    expect(proxy(request('/queue')).headers.get('Location')).toBe('http://localhost:3000/sign-in');
  });

  it('never redirects to another site, whatever the path looks like', () => {
    const location = proxy(request('//evil.example/x')).headers.get('Location');
    expect(location).toBe('http://localhost:3000/sign-in');
  });

  it('treats a cookie of another name as no session', () => {
    expect(proxy(request('/queue', 'other=1; next-auth.callback-url=x')).status).toBe(307);
  });
});

describe('AC-4: a visitor with a session cookie is let through, with nothing stored', () => {
  it.each([
    ['__Secure-next-auth.session-token=abc', 'the production cookie'],
    ['next-auth.session-token=abc', 'the development cookie'],
    ['__Secure-next-auth.session-token.0=abc; __Secure-next-auth.session-token.1=def', 'a cookie split in chunks'],
  ])('%s (%s)', (cookie) => {
    const response = proxy(request('/queue', cookie));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Location')).toBeNull();
  });
});

describe('STORY-01.02 AC-4: the address asked for, and API routes', () => {
  it('forwards the address asked for to the page, replacing whatever the browser sent under that name', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/estimates/Q-2026-0001?tab=a', {
        headers: { cookie: 'next-auth.session-token=abc', 'x-return-path': 'https://evil.example/' },
      }),
    );
    // A forwarded request header is carried to the page as `x-middleware-request-<name>` and an override marker.
    expect(response.headers.get('x-middleware-request-x-return-path')).toBe('/estimates/Q-2026-0001?tab=a');
    expect(response.headers.get('x-middleware-override-headers')).toContain('x-return-path');
  });

  it('lets a signed-out API call through, so the route answers 401 with a problem body and not a page redirect', () => {
    const response = proxy(request('/api/v1/me'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('still sends a signed-out page request to the sign-in page, also for a path that merely starts with "api"', () => {
    expect(proxy(request('/apiary')).status).toBe(307);
  });
});

describe('STORY-01.06 AC-3 and AC-4: telling the page that the browser sent a session cookie', () => {
  it('sets the header for a request that carries the cookie, whatever the browser sent under that name', () => {
    const response = proxy(new NextRequest('http://localhost:3000/queue', { headers: { cookie: 'next-auth.session-token=abc', 'x-session-cookie': '0' } }));
    expect(response.headers.get('x-middleware-request-x-session-cookie')).toBe('1');
  });

  it('sets it for a cookie split in chunks and for the production cookie', () => {
    const chunked = proxy(request('/queue', '__Secure-next-auth.session-token.0=abc; __Secure-next-auth.session-token.1=def'));
    expect(chunked.headers.get('x-middleware-request-x-session-cookie')).toBe('1');
  });

  it('removes it from an API call that carries no cookie, so a browser cannot claim to have had a session', () => {
    const response = proxy(new NextRequest('http://localhost:3000/api/v1/me', { headers: { 'x-session-cookie': '1' } }));
    expect(response.headers.get('x-middleware-request-x-session-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-override-headers')).not.toContain('x-session-cookie');
  });

  it('does not set it for a cookie of another name', () => {
    const response = proxy(new NextRequest('http://localhost:3000/api/v1/me', { headers: { cookie: 'other=1' } }));
    expect(response.headers.get('x-middleware-request-x-session-cookie')).toBeNull();
  });
});

describe('what the proxy covers', () => {
  const pattern = new RegExp(`^${config.matcher[0] ?? ''}$`);

  // Since DEF-054 the proxy runs for every page and API route, public or not, because it puts the security headers (and the nonce) on each answer.
  it.each(['/queue', '/', '/estimates/Q-2026-0001', '/design-system', '/api/v1/tasks', '/sign-in', '/forgot-password', '/reset-password', '/api/auth/session', '/no/such/page', '/_next/staticfoo', '/_next/static', '/_next/image-x', '/_next/imagefoo'])('%s goes through the proxy', (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  // Static files carry their headers from next.config.ts, so the proxy does not run for them.
  it.each(['/_next/static/chunks/a.js', '/_next/image', '/_next/image/', '/accucut-logo.jpg'])('%s does not', (path) => {
    expect(pattern.test(path)).toBe(false);
  });
});

describe('which pages are checked for a session (public paths)', () => {
  it.each(['/queue', '/', '/estimates/Q-2026-0001', '/design-system', '/api/v1/tasks', '/forgot-passwords', '/reset-password-now', '/account/reset-password', '/sign-ins'])('%s is checked', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  // STORY-09.07: the two pages of the reset by e-mailed link are public (a person who forgot their password has no session); a path that only starts like them is still checked.
  it.each(['/forgot-password', '/forgot-password/', '/reset-password', '/reset-password/', '/sign-in', '/sign-in/', '/api/auth/session', '/api/auth/callback/credentials'])('%s is public', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it('sends no one away from a public page, with or without a cookie', () => {
    expect(proxy(request('/sign-in')).status).toBe(200);
    expect(proxy(request('/forgot-password')).status).toBe(200);
    expect(proxy(request('/api/auth/session')).status).toBe(200);
  });
});
