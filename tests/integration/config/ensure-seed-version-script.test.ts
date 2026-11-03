import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * AC-6: the `ensure-seed-version` entry that the `migrate` one-shot runs right after `prisma migrate
 * deploy` (architecture section 5.6). It must create version 1 once, change nothing the second time, and
 * fail with a non-zero exit, naming the setting and never printing its value, so `migrate` fails and
 * `app` and `worker` do not start.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = 'scripts/ensure-seed-version.ts';

function runStep(environment: Record<string, string | undefined>): { status: number | null; stdout: string; stderr: string } {
  const base = { ...process.env };
  // The step reads only MIGRATE_DATABASE_URL; start from a clean slate so a stray setting cannot help it.
  delete base['MIGRATE_DATABASE_URL'];
  delete base['DATABASE_URL'];
  const result = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...base, ...environment },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('scripts/ensure-seed-version.ts (AC-6)', { timeout: 120_000 }, () => {
  let database: ScratchDatabase;

  beforeAll(async () => {
    database = await createMigratedScratchDatabase();
  });
  afterAll(() => database.drop());

  async function versions(): Promise<Array<{ number: number; created_by: string | null }>> {
    const client = new Client({ connectionString: database.ownerUrl });
    await client.connect();
    try {
      return (await client.query('SELECT number, created_by FROM config_versions ORDER BY number')).rows;
    } finally {
      await client.end();
    }
  }

  it('AC-6: creates version 1 on an empty database and exits 0', async () => {
    const { status, stdout } = runStep({ MIGRATE_DATABASE_URL: database.ownerUrl });
    expect(status).toBe(0);
    expect(stdout).toContain('configuration version 1 created');
    expect(await versions()).toEqual([{ number: 1, created_by: null }]);
  });

  it('AC-6: run again, it changes nothing and exits 0', async () => {
    const { status, stdout } = runStep({ MIGRATE_DATABASE_URL: database.ownerUrl });
    expect(status).toBe(0);
    expect(stdout).toContain('already exists; nothing changed');
    expect(await versions()).toEqual([{ number: 1, created_by: null }]);
  });

  it('AC-6: without MIGRATE_DATABASE_URL it fails, names the variable and prints no value', () => {
    const { status, stderr } = runStep({});
    expect(status).toBe(1);
    expect(stderr).toContain('MIGRATE_DATABASE_URL (missing)');
  });

  it('AC-6: with a template value it fails and does not print that value', () => {
    const { status, stderr } = runStep({ MIGRATE_DATABASE_URL: 'postgresql://owner:CHANGE_ME@127.0.0.1:1/none' });
    expect(status).toBe(1);
    expect(stderr).toContain('MIGRATE_DATABASE_URL (invalid)');
    expect(stderr).not.toContain('CHANGE_ME');
  });

  it('AC-6: when the database cannot be reached it fails with a non-zero exit, so migrate fails', () => {
    const unreachable = new URL(database.ownerUrl);
    unreachable.port = '1';
    const { status, stderr } = runStep({ MIGRATE_DATABASE_URL: unreachable.toString() });
    expect(status).toBe(1);
    expect(stderr).toContain('ensure-seed-version failed');
    // The connection string, with its password, is never printed.
    expect(stderr).not.toContain(unreachable.password);
  });
});
