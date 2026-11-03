import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { register } from '@/instrumentation';
import { ENV_VARIABLE_NAMES, loadAppEnv } from '@/lib/env';

// Wrap the real loader so one test can make it fail in a way that is not an environment problem.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, loadAppEnv: vi.fn(actual.loadAppEnv) };
});

/**
 * AC-3, DEF-001, QLT-15: an invalid environment must stop the server at start-up. Next.js catches an
 * error thrown by `register()` and keeps serving HTTP 500, so `register()` writes one line naming the
 * variables and exits the process with code 1, which a supervisor sees as a failed start.
 */

class ExitCalled extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

const PLANTED_VALUE = 'planted-short-secret';

/** An empty environment for the settings the app reads. An empty value counts as missing. */
function stubEmptyEnvironment(): void {
  for (const name of ENV_VARIABLE_NAMES) vi.stubEnv(name, '');
}

function stubCompleteEnvironment(): void {
  vi.stubEnv('DATABASE_URL', 'postgresql://accucut_app:invented-password@localhost:55432/accucut');
  vi.stubEnv('AUTH_SECRET', 'invented-start-up-secret-0123456789-abcdef');
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  vi.stubEnv('SMTP_HOST', 'localhost');
  vi.stubEnv('SMTP_PORT', '1025');
  vi.stubEnv('SMTP_AUTH_MODE', 'none');
}

let exit: MockInstance<typeof process.exit>;
let stderr: MockInstance<typeof process.stderr.write>;

beforeEach(() => {
  // Throwing stops the code after process.exit, as the real exit does, without ending the test run.
  exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitCalled(code);
  });
  stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function written(): string {
  return stderr.mock.calls.map(([chunk]) => String(chunk)).join('');
}

describe('register (start-up check)', () => {
  it('DEF-001: exits with code 1, exactly once, when a required variable is missing', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    expect(() => register()).toThrow(ExitCalled);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('DEF-001: writes one line to stderr that names the variables', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    expect(() => register()).toThrow(ExitCalled);
    const output = written();
    expect(output.trimEnd().split('\n')).toHaveLength(1);
    expect(output).toContain('DATABASE_URL (missing)');
    expect(output).toContain('AUTH_SECRET (missing)');
    expect(output).toContain('Invalid environment');
  });

  it('DEF-001, AC-3: never prints a value, including a planted invalid one', () => {
    stubEmptyEnvironment();
    vi.stubEnv('AUTH_SECRET', PLANTED_VALUE);
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    expect(() => register()).toThrow(ExitCalled);
    expect(written()).toContain('AUTH_SECRET (invalid)');
    expect(written()).not.toContain(PLANTED_VALUE);
  });

  it('re-throws an error that is not about the environment, unchanged, and does not exit', () => {
    const unexpected = new Error('unexpected failure');
    vi.mocked(loadAppEnv).mockImplementationOnce(() => {
      throw unexpected;
    });
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    expect(() => register()).toThrow(unexpected);
    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe('');
  });

  it('does nothing outside the Node.js runtime (edge)', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    expect(() => register()).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
  });

  it('does nothing while next build runs, which has no runtime settings', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    expect(() => register()).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
  });

  it('passes with a complete environment, and neither exits nor writes', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    stubCompleteEnvironment();
    expect(() => register()).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe('');
  });
});
