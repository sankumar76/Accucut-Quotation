import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

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
  it('redirects to the sign-in page with the requested page remembered, and says "do not index"', () => {
    const response = proxy(request('/estimates/Q-2026-0001?tab=a'));
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/sign-in?callbackUrl=%2Festimates%2FQ-2026-0001%3Ftab%3Da');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('sends a visitor to the home page to the bare sign-in page', () => {
    expect(proxy(request('/queue')).headers.get('Location')).toBe('/sign-in');
  });

  it('never redirects to another site, whatever the path looks like', () => {
    const location = proxy(request('//evil.example/x')).headers.get('Location');
    expect(location).toBe('/sign-in');
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

describe('what the proxy covers', () => {
  const pattern = new RegExp(`^${config.matcher[0] ?? ''}$`);

  it.each(['/queue', '/', '/estimates/Q-2026-0001', '/design-system', '/api/v1/tasks'])('%s is checked', (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each(['/sign-in', '/sign-in/', '/api/auth/session', '/api/auth/callback/credentials', '/_next/static/chunks/a.js', '/_next/image', '/accucut-logo.jpg'])(
    '%s is not checked',
    (path) => {
      expect(pattern.test(path)).toBe(false);
    },
  );
});
