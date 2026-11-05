import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

/**
 * next.config.ts settings that need a test: the development origins a phone may use (G6 STD-04: only the RFC 1918
 * private ranges, never a public address) and the cache header of the logo and favicon (PRF-02).
 */

const origins = nextConfig.allowedDevOrigins ?? [];

/** Does a pattern such as `172.16.*.*` cover this address? Each `*` stands for one number. */
function covers(pattern: string, address: string): boolean {
  const expected = pattern.split('.');
  const actual = address.split('.');
  return expected.length === actual.length && expected.every((part, index) => part === '*' || part === actual[index]);
}

const isAllowed = (address: string): boolean => origins.some((pattern) => covers(pattern, address));

describe('allowedDevOrigins (STD-04)', () => {
  it('allows the three private ranges a home or office Wi-Fi uses', () => {
    expect(isAllowed('192.168.1.20')).toBe(true);
    expect(isAllowed('10.0.4.7')).toBe(true);
    expect(isAllowed('172.16.0.5')).toBe(true);
    expect(isAllowed('172.31.255.9')).toBe(true);
  });

  it('does not allow a public address that merely starts with 172 or 192', () => {
    for (const address of ['172.15.0.1', '172.32.0.1', '172.0.0.1', '172.200.3.4', '192.169.1.1', '11.0.0.1', '8.8.8.8']) {
      expect(isAllowed(address), address).toBe(false);
    }
  });
});

describe('forbidden() for a refused page role (STORY-01.02 AC-4, QLT-62)', () => {
  it('turns on experimental.authInterrupts, without which forbidden() shows the 500 error card and not SCR-26 with HTTP 403', () => {
    // Deleting the flag still refuses access, so no other test notices; this one does.
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
  });
});

describe('cache header of the logo and favicon (PRF-02)', () => {
  it('serves /accucut-logo.jpg for a day, and lets a stale copy serve while it refreshes (the URL is not versioned)', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((entry) => entry.source === '/accucut-logo.jpg');
    const header = rule?.headers.find((entry) => entry.key === 'Cache-Control');
    expect(header?.value).toBe('public, max-age=86400, stale-while-revalidate=604800');
    expect(header?.value).not.toContain('immutable');
  });
});
