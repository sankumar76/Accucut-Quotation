import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasAnyAdmin = vi.fn<() => Promise<boolean>>();
vi.mock('@/server/composition', () => ({ getUserRepository: () => ({ hasAnyAdmin }) }));

const { GET } = await import('@/app/api/health/route');

/**
 * STORY-10.04 AC-1 and AC-8: `/api/health` is what the install, the update and the uptime monitor wait for. It answers 200 when
 * the database replies and 503 when it does not, says nothing else, and is never cached.
 */
describe('GET /api/health', () => {
  beforeEach(() => {
    hasAnyAdmin.mockReset();
  });

  it('[AC-1] answers 200 and the one word ok when the database replies, whatever the answer is', async () => {
    for (const present of [true, false]) {
      hasAnyAdmin.mockResolvedValueOnce(present);
      const response = await GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    }
  });

  it('[AC-1] answers 503 and the one word unavailable when the database does not reply, and reveals the error to no one', async () => {
    hasAnyAdmin.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432 password authentication failed'));
    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: 'unavailable' });
    expect(text).not.toMatch(/ECONNREFUSED|password|127\.0\.0\.1/);
  });

  it('[AC-1] answers 503 when the settings are missing (the composition root throws before any query)', async () => {
    hasAnyAdmin.mockImplementationOnce(() => {
      throw new Error('Invalid environment: DATABASE_URL (missing).');
    });
    expect((await GET()).status).toBe(503);
  });

  it('is never stored by a browser or a proxy', async () => {
    hasAnyAdmin.mockResolvedValueOnce(true);
    expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
  });
});
