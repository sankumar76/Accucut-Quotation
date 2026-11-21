-- STORY-10.09a (AQP-375): the one way the runtime role removes anything from job_runs, and only the worker's own heartbeat rows (architecture sections 4.7 and 5.1, ruling of v0.56).
--
-- The worker writes one job_runs row a minute (job = 'heartbeat'), which is about 525,000 rows a year, and every weekly full copy would carry them. Rows older than 7 days are
-- removed by this function, called by the worker's heartbeat job right after it writes its row. About 10,100 heartbeat rows are at rest.
--
-- The runtime role (accucut_app) still has no DELETE on job_runs: a direct DELETE is refused, as before. It may only EXECUTE this function, which runs with the rights of its owner
-- (SECURITY DEFINER) and can do one thing:
--   - it takes NO argument, so nothing a caller passes can widen it;
--   - it deletes only  job = 'heartbeat' AND finished_at < now() - interval '7 days'. The rows of 'backup', 'backup-clear' and 'backup-watch', of any age, are never touched
--     (the Settings page and the backup watch read them);
--   - search_path is pinned to pg_catalog, pg_temp, and the table is named in full (public.job_runs), so no object a caller creates in another schema can stand in for a name
--     the function uses (the usual way a SECURITY DEFINER function is attacked);
--   - EXECUTE is revoked from PUBLIC (a new function is executable by everyone) and granted to accucut_app alone.
-- It answers the number of rows it removed, for the worker's log line.
--
-- No index is added: idx_job_runs_job_finished_at ("job", "finished_at" DESC) serves the delete, the Settings reads and the health check's read of the newest heartbeat.
--
-- Additive: the previous image keeps running during a rollback, because it neither names nor calls the function.
-- Rollback note, for use only if this migration must be undone (the heartbeat rows then pile up until the migration is applied again):
--   DROP FUNCTION public.prune_heartbeat_runs();
--
-- The owner and the grant are guarded by the existence of their roles, as in 20261115100000_job_runs_backup_grant: a cluster that never ran deploy/db/create-roles.psql must not
-- stop every migration. The Windows install and CI make the roles first, and the privilege tests (tests/integration/job-runs/prune-heartbeat.test.ts, CI stage 13) prove the
-- owner, the grant and the refusal of a direct DELETE; where a role is missing the notice says so.

CREATE OR REPLACE FUNCTION public.prune_heartbeat_runs()
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH removed AS (
    DELETE FROM public.job_runs
    WHERE job = 'heartbeat' AND finished_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM removed
$$;

COMMENT ON FUNCTION public.prune_heartbeat_runs() IS
  'Removes the worker heartbeat rows of job_runs older than 7 days and returns how many went. SECURITY DEFINER: the one removal the runtime role may make. No argument, fixed predicate (STORY-10.09a).';

-- The owner role owns it (a migration is run by accucut_owner, which then already does; this also covers a run by a superuser, whose rights the function must never carry).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'accucut_owner') THEN
    ALTER FUNCTION public.prune_heartbeat_runs() OWNER TO accucut_owner;
  ELSE
    RAISE NOTICE 'The role accucut_owner does not exist in this cluster, so prune_heartbeat_runs() stays with the role that ran the migration. Run deploy/db/create-roles.psql and set the owner again.';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.prune_heartbeat_runs() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'accucut_app') THEN
    GRANT EXECUTE ON FUNCTION public.prune_heartbeat_runs() TO accucut_app;
  ELSE
    RAISE NOTICE 'The role accucut_app does not exist in this cluster, so it was not granted EXECUTE on prune_heartbeat_runs(). Run deploy/db/create-roles.psql (or recreate the development database) and grant it again.';
  END IF;
END
$$;
