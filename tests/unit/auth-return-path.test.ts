import { describe, expect, it } from 'vitest';

import { HOME_PATH, safeReturnPath, signInPathFor } from '@/lib/auth/return-path';

/** STORY-01.01 AC-6 (negative): only a same-origin relative path is honoured as the place to go after signing in. */

describe('AC-6: a return address that leaves the site is ignored', () => {
  it.each([
    ['https://evil.example', 'an absolute address'],
    ['http://evil.example/queue', 'an absolute http address'],
    ['//evil.example', 'a protocol-relative address'],
    ['/\\evil.example', 'a slash and a backslash'],
    ['\\\\evil.example', 'two backslashes'],
    ['/\\/evil.example', 'a backslash between slashes'],
    ['/.//evil.example', 'a dot segment that resolves to //evil.example'],
    ['/a/../..//evil.example', 'dot-dot segments that resolve to //evil.example'],
    ['javascript:alert(1)', 'a script address'],
    ['data:text/html,x', 'a data address'],
    ['evil.example', 'a bare host'],
    ['queue', 'a relative path with no leading slash'],
    ['/queue\r\nSet-Cookie: x=1', 'a line break'],
    ['/queue\t//evil.example', 'a tab'],
    ['/qu\u0000eue', 'a NUL character'],
    ['', 'an empty string'],
    ['/' + 'a'.repeat(2_001), 'an over-long path'],
  ])('%s (%s) goes to the home page', (candidate) => {
    expect(safeReturnPath(candidate)).toBe(HOME_PATH);
  });

  it.each([undefined, null, 42, {}, ['/queue'], true])('%j (not a string) goes to the home page', (candidate) => {
    expect(safeReturnPath(candidate)).toBe(HOME_PATH);
  });

  it.each(['/sign-in', '/sign-in/', '/sign-in?x=1', '/api/auth/signout', '/api'])(
    '%s is never a place to land after signing in',
    (candidate) => {
      expect(safeReturnPath(candidate)).toBe(HOME_PATH);
    },
  );
});

describe('AC-6: a same-origin relative path is honoured', () => {
  it.each([
    ['/queue', '/queue'],
    ['/estimates/Q-2026-0001', '/estimates/Q-2026-0001'],
    ['/queue?tab=overdue', '/queue?tab=overdue'],
    ['/queue?tab=overdue#top', '/queue?tab=overdue'],
    ['/a/./b', '/a/b'],
    ['/%2F/not-a-host', '/%2F/not-a-host'],
    ['/', '/'],
  ])('%s becomes %s', (candidate, expected) => {
    expect(safeReturnPath(candidate)).toBe(expected);
  });

  it('uses the fallback it is given', () => {
    expect(safeReturnPath('https://evil.example', '/somewhere')).toBe('/somewhere');
  });

  it('the result never starts with two slashes and has no scheme or host', () => {
    for (const candidate of ['/.//x', '//x', '/x', '/%2F%2Fx', '/\\x']) {
      const result = safeReturnPath(candidate);
      expect(result.startsWith('//')).toBe(false);
      expect(result.startsWith('/')).toBe(true);
      expect(result).not.toMatch(/^[a-z]+:/i);
    }
  });
});

describe('the sign-in address for a signed-out visitor', () => {
  it('carries the page they asked for', () => {
    expect(signInPathFor('/estimates/Q-2026-0001?tab=a')).toBe('/sign-in?callbackUrl=%2Festimates%2FQ-2026-0001%3Ftab%3Da');
  });

  it('is the bare sign-in page for the home page, for an unsafe address, and for the sign-in page itself', () => {
    expect(signInPathFor('/queue')).toBe('/sign-in');
    expect(signInPathFor('//evil.example')).toBe('/sign-in');
    expect(signInPathFor('/sign-in')).toBe('/sign-in');
  });
});
