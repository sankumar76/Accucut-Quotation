import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertSeedAllowed, SEED_PRODUCTION_REFUSAL } from '../../prisma/seed/guard';

/** AC-7: the seed script refuses to run with NODE_ENV=production. */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function runSeed(nodeEnv: 'production' | 'development'): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed/index.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: nodeEnv },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('seed production guard (AC-7)', { timeout: 60_000 }, () => {
  it('AC-7: throws in production', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(SEED_PRODUCTION_REFUSAL);
  });

  it.each(['development', 'test', undefined])('AC-7: allows NODE_ENV=%s', (nodeEnv) => {
    expect(() => assertSeedAllowed({ NODE_ENV: nodeEnv })).not.toThrow();
  });

  it('AC-7: the seed script exits with an error and loads nothing when NODE_ENV=production', () => {
    const { status, output } = runSeed('production');
    expect(status).not.toBe(0);
    expect(output).toContain('Refusing to seed');
  });

  it('AC-7: the seed script runs when NODE_ENV=development', () => {
    const { status, output } = runSeed('development');
    expect(status).toBe(0);
    expect(output).toContain('nothing to load');
  });
});
