import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  goToSessionEndedSignIn,
  handleSessionEnded,
  hasSessionCookie,
  isSessionEnded,
  SESSION_COOKIE_HEADER,
  SESSION_COOKIE_PRESENT,
  SESSION_ENDED_CODE,
  signInPathAfterSessionEnded,
} from '@/lib/auth/session-ended';

/**
 * STORY-01.06 AC-3 and AC-4: the small pure rules both the server and the browser share. The address a person comes back to
 * after "Session ended" goes through `safeReturnPath`, so only a same-origin relative path survives (AC-3), and a client that is
 * told the session ended (401 with the one code) goes to SCR-01 with the "Session ended" state (AC-4).
 */

describe('the session cookie, as the proxy and the sign-in check see it', () => {
  it.each([
    [['__Secure-next-auth.session-token'], true],
    [['next-auth.session-token'], true],
    [['__Secure-next-auth.session-token.0', '__Secure-next-auth.session-token.1'], true],
    [['next-auth.session-token.0'], true],
    [['next-auth.csrf-token', 'theme'], false],
    [['x-next-auth.session-token'], false],
    [['next-auth.session-tokens'], false],
    [[], false],
  ])('%j is %s', (names, expected) => {
    expect(hasSessionCookie(names.map((name) => ({ name })))).toBe(expected);
  });

  it('names the header the proxy sets and the one value it carries', () => {
    expect(SESSION_COOKIE_HEADER).toBe('x-session-cookie');
    expect(SESSION_COOKIE_PRESENT).toBe('1');
  });
});

describe('AC-4: a refusal that says the session ended', () => {
  it('is a 401 with the code SESSION_ENDED, and nothing else', () => {
    expect(isSessionEnded(401, SESSION_ENDED_CODE)).toBe(true);
    expect(isSessionEnded(401, 'UNAUTHORIZED')).toBe(false);
    expect(isSessionEnded(403, SESSION_ENDED_CODE)).toBe(false);
    expect(isSessionEnded(422, 'VALIDATION_FAILED')).toBe(false);
  });
});

describe('AC-3 and AC-4: the sign-in address after the session ended', () => {
  it('shows the "Session ended" state and keeps a same-origin page to return to', () => {
    expect(signInPathAfterSessionEnded('/users')).toBe('/sign-in?reason=session-ended&callbackUrl=%2Fusers');
    expect(signInPathAfterSessionEnded('/queue?tab=overdue')).toBe('/sign-in?reason=session-ended&callbackUrl=%2Fqueue%3Ftab%3Doverdue');
  });

  it('asks for no return address when the person was headed home anyway', () => {
    expect(signInPathAfterSessionEnded('/queue')).toBe('/sign-in?reason=session-ended');
  });

  it.each(['https://evil.example/x', '//evil.example/x', '/\\evil.example', '/api/v1/me', '/sign-in', '', '/a\r\nb'])(
    'drops %j: it is not a page of this portal',
    (address) => {
      expect(signInPathAfterSessionEnded(address)).toBe('/sign-in?reason=session-ended');
    },
  );
});

describe('AC-4: the browser leaves for SCR-01 when the server says the session ended', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBrowser(pathname: string, search: string): ReturnType<typeof vi.fn> {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { pathname, search, assign } });
    return assign;
  }

  it('goes to the sign-in page from the page the person was on', () => {
    const assign = stubBrowser('/masters/materials', '?q=steel');
    goToSessionEndedSignIn();
    expect(assign).toHaveBeenCalledExactlyOnceWith('/sign-in?reason=session-ended&callbackUrl=%2Fmasters%2Fmaterials%3Fq%3Dsteel');
  });

  it('does nothing when there is no window (the server, a test)', () => {
    expect(() => goToSessionEndedSignIn()).not.toThrow();
  });

  it('handleSessionEnded navigates for the session-ended refusal only, and says whether it did', () => {
    const assign = stubBrowser('/users', '');
    expect(handleSessionEnded(401, 'UNAUTHORIZED')).toBe(false);
    expect(handleSessionEnded(403, 'FORBIDDEN')).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(handleSessionEnded(401, SESSION_ENDED_CODE)).toBe(true);
    expect(assign).toHaveBeenCalledExactlyOnceWith('/sign-in?reason=session-ended&callbackUrl=%2Fusers');
  });
});
