import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvValidationError, loadExportEnv } from '@/lib/env';

const IMPORT_TIME_MS = 90_000;
const builder = vi.hoisted(() => vi.fn());
vi.mock('@/server/export/thread-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/export/thread-runner')>();
  return { ...actual, createThreadBuilder: builder };
});

/**
 * ADR-017 decision 1: the export's time limit is a setting, `EXPORT_TIMEOUT_SECONDS`, from 120 to 300 seconds, 240 when it is absent or empty. A value outside the range, or one that is
 * not a whole number, stops the start like any other invalid setting (it is also checked by `register()`, `src/instrumentation.ts`). The setting reaches the thread builder as milliseconds.
 */

describe('loadExportEnv (ADR-017)', () => {
  it('is 240 when the setting is absent', () => {
    expect(loadExportEnv({})).toEqual({ EXPORT_TIMEOUT_SECONDS: 240 });
  });

  it('is 240 when the setting is an empty line, as for every other setting', () => {
    expect(loadExportEnv({ EXPORT_TIMEOUT_SECONDS: '' }).EXPORT_TIMEOUT_SECONDS).toBe(240);
  });

  it.each([
    ['120', 120],
    ['121', 121],
    ['240', 240],
    ['300', 300],
  ])('accepts %s', (text, seconds) => {
    expect(loadExportEnv({ EXPORT_TIMEOUT_SECONDS: text }).EXPORT_TIMEOUT_SECONDS).toBe(seconds);
  });

  it.each(['119', '301', '0', '-240', '120.5', 'soon', '2e2x', '1e9'])('refuses %s and names the setting, never the value', (text) => {
    let thrown: unknown;
    try {
      loadExportEnv({ EXPORT_TIMEOUT_SECONDS: text });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(EnvValidationError);
    expect(thrown instanceof EnvValidationError ? thrown.problems : []).toEqual([{ name: 'EXPORT_TIMEOUT_SECONDS', reason: 'invalid' }]);
    expect(String(thrown instanceof Error ? thrown.message : '')).not.toContain(text);
  });
});

describe('the setting reaches the thread builder, and a bad one stops the start', () => {
  beforeEach(() => {
    vi.resetModules();
    builder.mockReset();
    vi.stubEnv('DATABASE_URL', 'postgresql://accucut_app:invented-password@localhost:55432/accucut');
    vi.stubEnv('AUTH_SECRET', 'invented-export-secret-0123456789-abcdef');
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
    vi.stubEnv('SMTP_HOST', 'localhost');
    vi.stubEnv('SMTP_PORT', '1025');
    vi.stubEnv('SMTP_AUTH_MODE', 'none');
  });

  afterEach(() => vi.unstubAllEnvs());

  async function timeoutGiven(): Promise<unknown> {
    const { getExportService } = await import('@/server/composition');
    getExportService();
    expect(builder).toHaveBeenCalledTimes(1);
    return builder.mock.calls[0]?.[0]?.timeoutMs;
  }

  // The first import of the composition root loads the whole server side; that is set-up, so this one test has room for it.
  it('is the setting in milliseconds when it is set, and 240,000 when it is not', async () => {
    vi.stubEnv('EXPORT_TIMEOUT_SECONDS', '300');
    expect(await timeoutGiven()).toBe(300_000);
    builder.mockReset();
    vi.resetModules();
    vi.stubEnv('EXPORT_TIMEOUT_SECONDS', '');
    expect(await timeoutGiven()).toBe(240_000);
  }, IMPORT_TIME_MS);

  it('start-up refuses a value outside 120 to 300 with one line naming the setting and exit code 1', async () => {
    vi.stubEnv('EXPORT_TIMEOUT_SECONDS', '301');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${String(code)})`);
    });
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { register } = await import('@/instrumentation');
    await expect(register()).rejects.toThrow('process.exit(1)');
    expect(exit).toHaveBeenCalledWith(1);
    const text = stderr.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(text).toContain('EXPORT_TIMEOUT_SECONDS (invalid)');
    expect(text).not.toContain('301');
    vi.restoreAllMocks();
  });
});
