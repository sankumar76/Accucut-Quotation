import { describe, expect, it } from 'vitest';

import { isSameOriginRequest } from '@/server/http/origin-check';
import { isStateChanging, SAFE_METHODS } from '@/server/http/route-manifest';

/**
 * STORY-01.02 AC-5 (NFR-003, negative): a state-changing request is accepted only from the portal's own origin, or when the
 * browser says `Sec-Fetch-Site: same-origin`. Anything else, including a request that says nothing, is refused.
 */

const APP_ORIGIN = 'https://portal.example.test';

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('AC-5: the origin check', () => {
  it('accepts a request from APP_ORIGIN', () => {
    expect(isSameOriginRequest(headers({ origin: APP_ORIGIN }), APP_ORIGIN)).toBe(true);
  });

  it('accepts a browser request that says same-origin, with no Origin header', () => {
    expect(isSameOriginRequest(headers({ 'sec-fetch-site': 'same-origin' }), APP_ORIGIN)).toBe(true);
  });

  it.each([
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['a foreign origin and a cross-site request', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }],
    ['a foreign origin and a same-site request', { origin: 'https://evil.example', 'sec-fetch-site': 'same-site' }],
    ['a sibling host', { origin: 'https://portal.example.test.evil.example' }],
    ['another scheme', { origin: 'http://portal.example.test' }],
    ['another port', { origin: 'https://portal.example.test:8443' }],
    ['a trailing slash', { origin: `${APP_ORIGIN}/` }],
    ['the opaque origin "null"', { origin: 'null' }],
    ['a different letter case in the sec-fetch-site value', { 'sec-fetch-site': 'Same-Origin' }],
    ['a same-site request with no origin', { 'sec-fetch-site': 'same-site' }],
    ['no Origin and no Sec-Fetch-Site (deny by default)', {}],
  ])('refuses %s', (_name, values) => {
    expect(isSameOriginRequest(headers(values), APP_ORIGIN)).toBe(false);
  });
});

describe('which methods are checked', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])('%s is safe and is not checked', (method) => {
    expect(isStateChanging(method)).toBe(false);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('%s changes state and is checked', (method) => {
    expect(isStateChanging(method)).toBe(true);
  });

  it('the safe list is exactly the three methods that change nothing', () => {
    expect([...SAFE_METHODS].sort()).toEqual(['GET', 'HEAD', 'OPTIONS']);
  });
});
