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
