import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * QLT-13: the wrong-database guard works only if `vitest.config.ts` names it as `globalSetup`. This runs
 * a real, separate `vitest run` on a trivial file, so deleting that line from the configuration fails
 * here. The trivial file is outside tests/unit, so this test cannot run itself again.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const VITEST = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
const TRIVIAL_FILE = 'tests/fixtures/guard-wiring/trivial.test.ts';

const INVENTED_PASSWORD = 'invented-wiring-secret';

/** The parent's own Vitest and coverage variables would confuse a nested run, so they are dropped. */
function cleanEnvironment(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const kept = Object.entries(process.env).filter(
    ([name]) => !name.startsWith('VITEST') && name !== 'NODE_V8_COVERAGE' && name !== 'DATABASE_URL' && name !== 'MIGRATE_DATABASE_URL',
  );
  // NODE_ENV is typed as a union by the Next.js types, so it is set explicitly rather than spread.
  return { ...Object.fromEntries(kept), ...overrides, NODE_ENV: overrides['NODE_ENV'] === 'production' ? 'production' : 'test' };
}

function runVitest(overrides: Record<string, string>): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [VITEST, 'run', TRIVIAL_FILE], {
    cwd: ROOT,
    encoding: 'utf8',
    env: cleanEnvironment(overrides),
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('globalSetup wiring (QLT-13, AC-10)', { timeout: 120_000 }, () => {
  it('refuses to start a run whose DATABASE_URL points at a remote host', () => {
    const { status, output } = runVitest({
      DATABASE_URL: `postgresql://app_user:${INVENTED_PASSWORD}@db.invented-remote.example:5432/accucut`,
    });
    expect(status).not.toBe(0);
    expect(output).toContain('Refusing to run');
    expect(output).not.toContain(INVENTED_PASSWORD);
  });

  it('refuses to start a run with NODE_ENV=production', () => {
    const { status, output } = runVitest({ NODE_ENV: 'production' });
    expect(status).not.toBe(0);
    expect(output).toContain('Refusing to run');
  });

  it('runs the same file when the database is local (so the refusals above come from the guard)', () => {
    const { status } = runVitest({ DATABASE_URL: `postgresql://app_user:${INVENTED_PASSWORD}@localhost:5432/accucut` });
    expect(status).toBe(0);
  });
});
