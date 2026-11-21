import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const latestHeartbeatAt = vi.fn<() => Promise<Date | null>>();
vi.mock('@/server/composition', () => ({ getHeartbeatRepository: () => ({ latestHeartbeatAt }) }));

const { GET } = await import('@/app/api/health/route');

/**
 * STORY-10.04 AC-1 and AC-8, STORY-10.09a AC-6 (NFR-012): `/api/health` is what the install, the update, the restore and the uptime monitor wait for. It answers 200 only while
 * the database replies and the worker's newest heartbeat is less than 3 minutes old, 503 otherwise, says nothing else, and is never cached.
 */

const NOW = new Date('2026-11-19T10:00:00.000Z');
const SECOND = 1000;
const ago = (seconds: number): Date => new Date(NOW.getTime() - seconds * SECOND);

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    latestHeartbeatAt.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[AC-6] answers 200 and the one word ok for a heartbeat that finished 2 min 59 s ago', async () => {
    latestHeartbeatAt.mockResolvedValueOnce(ago(179));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('[AC-6] answers 503 and the one word unavailable for a heartbeat that finished 3 min 1 s ago', async () => {
    latestHeartbeatAt.mockResolvedValueOnce(ago(181));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('[AC-6] answers 503 when the worker has never written a heartbeat', async () => {
    latestHeartbeatAt.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('[AC-6] answers 503 and reveals the error to no one when the database does not reply', async () => {
    latestHeartbeatAt.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432 password authentication failed'));
    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: 'unavailable' });
    expect(text).not.toMatch(/ECONNREFUSED|password|127\.0\.0\.1/);
  });

  it('[AC-6] answers 503 when the settings are missing (the composition root throws before any query)', async () => {
    latestHeartbeatAt.mockImplementationOnce(() => {
      throw new Error('Invalid environment: DATABASE_URL (missing).');
    });
    expect((await GET()).status).toBe(503);
  });

  it('[AC-6] says the same words whichever check failed, so the body never tells which', async () => {
    latestHeartbeatAt.mockResolvedValueOnce(null);
    const stale = await (await GET()).text();
    latestHeartbeatAt.mockRejectedValueOnce(new Error('down'));
    const down = await (await GET()).text();
    expect(stale).toBe(down);
  });

  it('is never stored by a browser or a proxy, whatever the answer', async () => {
    latestHeartbeatAt.mockResolvedValueOnce(ago(1));
    expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
    latestHeartbeatAt.mockResolvedValueOnce(null);
    expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
  });
});

/**
 * #576, check C5 of the install guide (architecture section 8, P2): the answer says which address the portal worked out for the caller, in `X-Client-Address-Seen`, so the install can see that
 * the reverse proxy writes the real address as the last entry of `X-Forwarded-For`. It is the same rule the sign-in limit uses (`clientAddressFrom`: the last entry, only a well-formed
 * address, no port), so the check shows what the limit sees. `none` when there is no usable address. The address is the caller's own, so it discloses nothing.
 */
describe('GET /api/health: X-Client-Address-Seen (#576, check C5)', () => {
  const ask = (forwardedFor?: string): Promise<Response> =>
    GET(new Request('http://127.0.0.1:3000/api/health', forwardedFor === undefined ? {} : { headers: { 'x-forwarded-for': forwardedFor } }));

  beforeEach(() => latestHeartbeatAt.mockResolvedValue(new Date()));
  afterEach(() => latestHeartbeatAt.mockReset());

  it.each([
    ['one address', '198.51.100.4', '198.51.100.4'],
    ['the last of several, which the proxy wrote, not the first, which a browser can send', '203.0.113.7, 198.51.100.4', '198.51.100.4'],
    ['an IPv6 address, in lower case', '2001:DB8::1', '2001:db8::1'],
  ])('shows %s', async (_name, header, seen) => {
    expect((await ask(header)).headers.get('X-Client-Address-Seen')).toBe(seen);
  });

  it.each([
    ['no header at all', undefined],
    ['an address with a port, which is not an address (the proxy must not add one)', '198.51.100.4:51234'],
    ['text that is not an address', 'not-an-address'],
    ['an empty last entry', '198.51.100.4,'],
  ])('shows none for %s', async (_name, header) => {
    expect((await ask(header)).headers.get('X-Client-Address-Seen')).toBe('none');
  });

  it('is on a 503 as well, so a proxy can be checked while the worker is down', async () => {
    latestHeartbeatAt.mockResolvedValue(null);
    const response = await ask('198.51.100.4');
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Client-Address-Seen')).toBe('198.51.100.4');
    latestHeartbeatAt.mockRejectedValue(new Error('down'));
    expect((await ask('198.51.100.5')).headers.get('X-Client-Address-Seen')).toBe('198.51.100.5');
  });

  it('keeps the body at the one word and the answer uncached', async () => {
    const response = await ask('198.51.100.4');
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
