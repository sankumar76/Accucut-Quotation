import { describe, expect, it } from 'vitest';

import { serializeSessionCookie } from '@/server/http/set-cookie';

/** STORY-01.05 AC-3: the one cookie a route may set is written as next-auth writes its own session cookie, and nothing can be injected into it. */

const COOKIE = { name: 'next-auth.session-token', value: 'one.two-3', maxAgeSeconds: 648_000, secure: false };

describe('serializeSessionCookie', () => {
  it('writes HttpOnly, SameSite=Lax, path /, and the lifetime in seconds', () => {
    expect(serializeSessionCookie(COOKIE)).toBe('next-auth.session-token=one.two-3; Max-Age=648000; Path=/; HttpOnly; SameSite=Lax');
  });

  it('adds Secure for a production cookie, with the __Secure- prefix the caller gives it', () => {
    expect(serializeSessionCookie({ ...COOKIE, name: '__Secure-next-auth.session-token', secure: true })).toBe(
      '__Secure-next-auth.session-token=one.two-3; Max-Age=648000; Path=/; HttpOnly; SameSite=Lax; Secure',
    );
  });

  it.each([
    ['a value with a semicolon', { value: 'a; Path=/evil' }],
    ['a value with a space', { value: 'a b' }],
    ['a value with a line break', { value: 'a\r\nSet-Cookie: x=y' }],
    ['an empty value', { value: '' }],
    ['a name with an equals sign', { name: 'a=b' }],
    ['an empty name', { name: '' }],
  ])('refuses %s, so nothing can add an attribute or split the header', (_name, change) => {
    expect(() => serializeSessionCookie({ ...COOKIE, ...change })).toThrow('not a cookie token');
  });

  it.each([-1, 1.5, Number.NaN])('refuses a lifetime of %s', (maxAgeSeconds) => {
    expect(() => serializeSessionCookie({ ...COOKIE, maxAgeSeconds })).toThrow('lifetime');
  });
});
