import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHeartbeatRepository } from '@/server/repositories/job-run-repository';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';

/**
 * STORY-10.09a AC-5 (the prune function, v0.56 ruling 2), on a real migrated database, as the runtime role: `prune_heartbeat_runs()` is SECURITY DEFINER, owned by the owner
 * role, takes no argument, has a pinned search_path, may be executed by `accucut_app` alone, and deletes only `job = 'heartbeat'` rows older than 7 days. The runtime role still has
 * no DELETE. The migration is additive and its rollback note works. Names and figures are invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261119120000_prune_heartbeat_runs/migration.sql', import.meta.url));
const migration = readFileSync(MIGRATION_SQL, 'utf8');
const PERMISSION_DENIED = '42501';
const DROP_FUNCTION = 'DROP FUNCTION IF EXISTS public.prune_heartbeat_runs();';

let db: AuthDatabase;

beforeAll(async () => {
  db = await openAuthDatabase();
});

afterAll(async () => {
  await db.close();
});

/** A run that finished `daysAgo` days (and `extraMinutes` minutes) before the database's own clock. */
async function insertRun(job: string, daysAgo: number, extraMinutes = 0): Promise<void> {
  await db.owner.query(
    `INSERT INTO job_runs (job, started_at, finished_at, result)
     VALUES ($1, now() - ($2::numeric * interval '1 day') - ($3::numeric * interval '1 minute') - interval '5 seconds', now() - ($2::numeric * interval '1 day') - ($3::numeric * interval '1 minute'), '{"status":"ok"}'::jsonb)`,
    [job, daysAgo, extraMinutes],
  );
}

async function count(job: string): Promise<number> {
  const { rows } = await db.owner.query<{ n: string }>('SELECT count(*) AS n FROM job_runs WHERE job = $1', [job]);
  return Number(rows[0]?.n);
}

const prune = async (): Promise<number> => {
  const { rows } = await db.runtime.query<{ removed: number }>('SELECT public.prune_heartbeat_runs() AS removed');
  return rows[0]?.removed ?? -1;
};

describe('the function and its settings (AC-5)', () => {
  it('[AC-5] is SECURITY DEFINER, owned by the owner role, takes no argument, returns an integer and has its search_path pinned to pg_catalog, pg_temp', async () => {
    const { rows } = await db.owner.query<{ secdef: boolean; owner: string; args: number; returns: string; config: string[] | null; language: string }>(
      `SELECT p.prosecdef AS secdef, pg_get_userbyid(p.proowner) AS owner, p.pronargs AS args, p.prorettype::regtype::text AS returns, p.proconfig AS config, l.lanname AS language
       FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
       WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'prune_heartbeat_runs'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ secdef: true, owner: 'accucut_owner', args: 0, returns: 'integer', config: ['search_path=pg_catalog, pg_temp'], language: 'sql' });
  });

  it('[AC-5] EXECUTE is held by the runtime role and the owner, and by no other role and not by PUBLIC', async () => {
    const { rows: acl } = await db.owner.query<{ grantee: string; privilege: string }>(
      `SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee, a.privilege_type AS privilege
       FROM pg_proc p, aclexplode(p.proacl) a
       WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'prune_heartbeat_runs'
       ORDER BY 1`,
    );
    expect(acl).toEqual([
      { grantee: 'accucut_app', privilege: 'EXECUTE' },
      { grantee: 'accucut_owner', privilege: 'EXECUTE' },
    ]);
    const { rows } = await db.owner.query<{ app: boolean; backup: boolean; owner: boolean }>(
      `SELECT has_function_privilege('accucut_app', 'public.prune_heartbeat_runs()', 'EXECUTE') AS app,
              has_function_privilege('accucut_backup', 'public.prune_heartbeat_runs()', 'EXECUTE') AS backup,
              has_function_privilege('accucut_owner', 'public.prune_heartbeat_runs()', 'EXECUTE') AS owner`,
    );
    expect(rows[0]).toEqual({ app: true, backup: false, owner: true });
  });

  it('[AC-5] the runtime role still has no DELETE on job_runs: a direct DELETE is refused, and so are UPDATE and TRUNCATE', async () => {
    await insertRun('heartbeat', 30);
    for (const statement of ['DELETE FROM job_runs', "DELETE FROM job_runs WHERE job = 'heartbeat'", "UPDATE job_runs SET job = 'x'", 'TRUNCATE job_runs']) {
      const failure = await db.runtime.query(statement).then(
        () => undefined,
        (error: unknown) => error as { code?: string },
      );
      expect(failure?.code, statement).toBe(PERMISSION_DENIED);
    }
    const { rows } = await db.owner.query<{ allowed: boolean }>("SELECT has_table_privilege('accucut_app', 'job_runs', 'DELETE') AS allowed");
    expect(rows[0]?.allowed).toBe(false);
    await db.owner.query('DELETE FROM job_runs');
  });

  it('[AC-5] cannot be called with an argument (it has none), so nothing a caller passes can widen it', async () => {
    const failure = await db.runtime.query("SELECT public.prune_heartbeat_runs('backup')").then(
      () => undefined,
      (error: unknown) => error as { code?: string },
    );
    expect(failure?.code).toBe('42883');
  });

  it('[AC-5] adds no index: the Settings reads, the delete and the health read are served by idx_job_runs_job_finished_at', async () => {
    const { rows } = await db.owner.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'job_runs' ORDER BY indexname");
    expect(rows.map((row) => row.indexname)).toEqual(['idx_job_runs_job_finished_at', 'job_runs_pkey']);
  });
});

describe('what it deletes (AC-5)', () => {
  it('[AC-5] removes the heartbeat row that is 8 days old and keeps the one that is 6 days old', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await insertRun('heartbeat', 8);
    await insertRun('heartbeat', 6);
    expect(await prune()).toBe(1);
    expect(await count('heartbeat')).toBe(1);
    const { rows } = await db.owner.query<{ age_days: number }>("SELECT extract(epoch FROM now() - finished_at) / 86400 AS age_days FROM job_runs WHERE job = 'heartbeat'");
    expect(Number(rows[0]?.age_days)).toBeLessThan(7);
  });

  it('[AC-5] the boundary is 7 days: a heartbeat row a minute younger than 7 days stays, one a minute older goes', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await insertRun('heartbeat', 7, -1);
    await insertRun('heartbeat', 7, 1);
    expect(await prune()).toBe(1);
    expect(await count('heartbeat')).toBe(1);
  });

  it('[AC-5] never touches backup, backup-clear or backup-watch rows, of any age (1, 30 and 800 days), nor any other job', async () => {
    await db.owner.query('DELETE FROM job_runs');
    for (const job of ['backup', 'backup-clear', 'backup-watch', 'log-prune', 'Heartbeat', 'heartbeat-x']) {
      for (const days of [1, 30, 800]) await insertRun(job, days);
    }
    await insertRun('heartbeat', 800);
    await insertRun('heartbeat', 1);
    expect(await prune()).toBe(1);
    for (const job of ['backup', 'backup-clear', 'backup-watch', 'log-prune', 'Heartbeat', 'heartbeat-x']) expect(await count(job), job).toBe(3);
    expect(await count('heartbeat')).toBe(1);
  });

  it('[AC-5] answers 0 and removes nothing when there is nothing old, and is safe to call again', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await insertRun('heartbeat', 0);
    expect(await prune()).toBe(0);
    expect(await prune()).toBe(0);
    expect(await count('heartbeat')).toBe(1);
  });

  it('[AC-5] removes a large backlog in one call and answers the number removed (an Admin who ran the app for weeks without a prune)', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await db.owner.query(
      `INSERT INTO job_runs (job, started_at, finished_at, result)
       SELECT 'heartbeat', now() - interval '9 days' - g * interval '1 minute', now() - interval '9 days' - g * interval '1 minute', '{"status":"ok"}'::jsonb FROM generate_series(1, 2000) AS g`,
    );
    expect(await prune()).toBe(2000);
    expect(await count('heartbeat')).toBe(0);
  });
});

describe('the repository over the real function and table (AC-4, AC-6)', () => {
  it('[AC-6] reads the newest heartbeat finished_at, and null when there is none', async () => {
    await db.owner.query('DELETE FROM job_runs');
    const repository = createHeartbeatRepository(db.prisma);
    expect(await repository.latestHeartbeatAt()).toBeNull();
    await insertRun('heartbeat', 0, 10);
    await insertRun('heartbeat', 0, 2);
    await insertRun('backup', 0, 0);
    const newest = await repository.latestHeartbeatAt();
    const { rows } = await db.owner.query<{ finished_at: Date }>("SELECT max(finished_at) AS finished_at FROM job_runs WHERE job = 'heartbeat'");
    expect(newest?.getTime()).toBe(rows[0]?.finished_at.getTime());
    expect(Date.now() - (newest?.getTime() ?? 0)).toBeGreaterThan(2 * 60_000 - 5_000);
  });

  it('[AC-6] the heartbeat read is one index descent: it uses idx_job_runs_job_finished_at and reads finished_at only', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await db.owner.query(
      `INSERT INTO job_runs (job, started_at, finished_at, result)
       SELECT 'heartbeat', now() - g * interval '1 minute', now() - g * interval '1 minute', '{"status":"ok"}'::jsonb FROM generate_series(1, 5000) AS g`,
    );
    await db.owner.query('ANALYZE job_runs');
    const { rows } = await db.owner.query<{ 'QUERY PLAN': string }>(`EXPLAIN SELECT finished_at FROM job_runs WHERE job = 'heartbeat' ORDER BY finished_at DESC LIMIT 1`);
    const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
    expect(plan).toContain('idx_job_runs_job_finished_at');
    expect(plan).not.toMatch(/Seq Scan|Sort/);
  });

  it('[AC-4] the runtime role writes its heartbeat row (INSERT), and the repository prunes through the function and answers the count', async () => {
    await db.owner.query('DELETE FROM job_runs');
    await insertRun('heartbeat', 10);
    await insertRun('heartbeat', 9);
    await db.runtime.query(
      "INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('heartbeat', now(), now(), '{\"status\":\"ok\"}'::jsonb)",
    );
    const repository = createHeartbeatRepository(db.prisma);
    expect(await repository.pruneHeartbeatRuns()).toBe(2);
    expect(await count('heartbeat')).toBe(1);
    expect(await repository.pruneHeartbeatRuns()).toBe(0);
  });
});

describe('the migration: additive, with a rollback note, and safe where a role is missing (AC-5)', () => {
  /** The statements of the rollback note: header lines of the form `--   DROP ...;`. */
  const ROLLBACK = migration
    .split(/\r?\n/)
    .filter((line) => /^--   DROP .*;$/.test(line))
    .map((line) => line.slice('--   '.length));

  it('[AC-5] carries one rollback statement in its header, which drops the function and leaves the table and its rows', async () => {
    expect(ROLLBACK).toEqual(['DROP FUNCTION public.prune_heartbeat_runs();']);
    await db.owner.query('DELETE FROM job_runs');
    await insertRun('heartbeat', 10);
    for (const statement of ROLLBACK) await db.owner.query(statement);
    expect((await db.owner.query("SELECT 1 FROM pg_proc WHERE proname = 'prune_heartbeat_runs'")).rowCount).toBe(0);
    expect(await count('heartbeat')).toBe(1);
  });

  it('[AC-5] the migration file runs again over the rolled-back schema and restores the function, the owner, the pinned path and the one grant, with the old row still there', async () => {
    await db.owner.query(migration);
    const { rows } = await db.owner.query<{ owner: string; secdef: boolean }>(
      "SELECT pg_get_userbyid(proowner) AS owner, prosecdef AS secdef FROM pg_proc WHERE proname = 'prune_heartbeat_runs'",
    );
    expect(rows).toEqual([{ owner: 'accucut_owner', secdef: true }]);
    expect((await db.owner.query("SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'prune_heartbeat_runs' AND a.grantee = 0")).rowCount).toBe(0);
    expect(await prune()).toBe(1);
  });

  it('[AC-5] does not fail on a cluster that lacks the roles (the owner and the grant are guarded): the function is made, with a notice', async () => {
    await db.owner.query(DROP_FUNCTION);
    // The same file with the two role names replaced by names that no cluster has: what a database that never ran deploy/db/create-roles.psql would see.
    const roleless = migration.replaceAll('accucut_owner', 'accucut_absent_owner').replaceAll('accucut_app', 'accucut_absent_app');
    await db.owner.query(roleless);
    const { rows } = await db.owner.query<{ owner: string; secdef: boolean }>(
      "SELECT pg_get_userbyid(proowner) AS owner, prosecdef AS secdef FROM pg_proc WHERE proname = 'prune_heartbeat_runs'",
    );
    expect(rows[0]?.secdef).toBe(true);
    // Nothing was granted to the runtime role: the grant was guarded, not run.
    expect((await db.owner.query("SELECT has_function_privilege('accucut_app', 'public.prune_heartbeat_runs()', 'EXECUTE') AS ok")).rows[0]).toEqual({ ok: false });
    // Put it right again, as the notice tells the operator to.
    await db.owner.query(DROP_FUNCTION);
    await db.owner.query(migration);
    expect((await db.owner.query("SELECT has_function_privilege('accucut_app', 'public.prune_heartbeat_runs()', 'EXECUTE') AS ok")).rows[0]).toEqual({ ok: true });
  });

  it('[AC-5] the header says additive, carries the rollback note and names the pinned path, the full table name and the predicate', () => {
    expect(migration).toMatch(/Additive/);
    expect(migration).toMatch(/Rollback note/);
    expect(migration).toContain('SET search_path = pg_catalog, pg_temp');
    expect(migration).toContain('public.job_runs');
    expect(migration).toContain("job = 'heartbeat' AND finished_at < now() - interval '7 days'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.prune_heartbeat_runs() FROM PUBLIC');
  });
});
