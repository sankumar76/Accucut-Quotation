import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from '@/instrumentation';
import { ENV_VARIABLE_NAMES, EnvValidationError } from '@/lib/env';

/**
 * QLT-15, AC-3: the start-up check is what makes a bad environment stop the server. Without this
 * test, deleting the `loadAppEnv()` call would leave every other test green.
 */

/** An empty environment for the settings the app reads. An empty value counts as missing. */
function stubEmptyEnvironment(): void {
  for (const name of ENV_VARIABLE_NAMES) vi.stubEnv(name, '');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('register (start-up check)', () => {
  it('AC-3: stops the Node.js server when a required variable is missing, naming it', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    expect(() => register()).toThrow(EnvValidationError);
    expect(() => register()).toThrow(/DATABASE_URL \(missing\)/);
  });

  it('does nothing outside the Node.js runtime (edge)', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    expect(() => register()).not.toThrow();
  });

  it('does nothing while next build runs, which has no runtime settings', () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    expect(() => register()).not.toThrow();
  });

  it('passes with a complete environment', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    vi.stubEnv('DATABASE_URL', 'postgresql://accucut_app:invented-password@localhost:55432/accucut');
    vi.stubEnv('AUTH_SECRET', 'invented-start-up-secret-0123456789-abcdef');
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
    vi.stubEnv('SMTP_HOST', 'localhost');
    vi.stubEnv('SMTP_PORT', '1025');
    vi.stubEnv('SMTP_AUTH_MODE', 'none');
    expect(() => register()).not.toThrow();
  });
});
