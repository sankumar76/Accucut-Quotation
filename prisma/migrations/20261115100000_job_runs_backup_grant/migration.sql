-- STORY-10.05 (AQP-311): the database role of the Windows backup may add one row to job_runs, and nothing else here (ADR-015 Amendment 3 point 3; architecture sections 5.1
-- and 9.9). The table comes from STORY-02.09 (20261115090000_job_runs).
--
-- The role, accucut_backup, is made by deploy/db/create-roles.psql (the install, the development database and CI all run it). backup.ps1 and clear-copies.ps1 use it, through a
-- protected password file, to dump the database (pg_read_all_data, granted by the role script) and to write the one row of each run (job 'backup' or 'backup-clear').
-- INSERT is all it gets: no UPDATE, no DELETE, no TRUNCATE, no other table, no DDL. A row is written once, at the end of a run, so no other right is needed.
--
-- Additive: the previous image keeps running during a rollback, because it neither names the role nor writes the table.
-- Rollback note, for use only if this migration must be undone:
--   REVOKE INSERT ON TABLE "job_runs" FROM "accucut_backup";
--
-- The statement is guarded by the existence of the role. A cluster that never ran the role script (an old development database made before STORY-10.05, whose roles are cluster
-- wide) has no accucut_backup, and an unguarded GRANT would stop every migration on it. The guard does not hide a missing grant where it matters: the Windows install makes the role
-- first, and CI stage 13 asserts, as accucut_backup, that INSERT on job_runs works and that UPDATE and DELETE are refused. Where the role is missing, the notice says so.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'accucut_backup') THEN
    GRANT INSERT ON TABLE "job_runs" TO "accucut_backup";
  ELSE
    RAISE NOTICE 'The role accucut_backup does not exist in this cluster, so it was not granted INSERT on job_runs. Run deploy/db/create-roles.psql (or recreate the development database) and grant it again.';
  END IF;
END
$$;
