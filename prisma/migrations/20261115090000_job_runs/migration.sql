-- STORY-02.09 (AQP-307): the record of what the background jobs and the backup did, which the Settings page reads for the Last backup line
-- (FR-105, NFR-013; architecture sections 5.1 and 9.9; assumption A-1 of the story: this story creates the table, STORY-10.05 only writes rows).
--
-- Additive only (a new table and one index): the previous image keeps running during a rollback, because it neither reads nor writes the table.
-- Rollback note, for use only before the first backup has been recorded; after that, dropping the table loses the record of the backups and the last good backup date:
--   DROP TABLE "job_runs";   -- also drops its index and its two CHECK constraints
--
-- The row contract between this story and STORY-10.05 (the writers: the weekly backup, and the worker's daily "backup-watch" job):
--   "job"          TEXT, the job's name. 'backup' (weekly backup) and 'backup-watch' (daily free-space reading) are the two the Settings page reads.
--   "started_at"   TIMESTAMPTZ, when the run began. "finished_at" TIMESTAMPTZ, when it ended. Both are required: a row is written once, at the end of a run,
--                  because the application role cannot UPDATE it.
--   "result"       JSONB object: { "status": "ok" | "failed", "sizeBytes": number, "freeBytes": number, "totalBytes": number }. The page reads "status" = 'ok' on a
--                  'backup' row as a good backup, and "freeBytes" with "totalBytes" on a row of either job as a disk reading. A writer may add other keys; the page never shows them.
--
-- No "created_at" and no "updated_at", by design: a row is a record of a run, stamped with the run's own times, and it is never changed after it is inserted (the append-only
-- exception to the rule that every table has them, coding standards section 10 "SQL"). It is not made immutable by a trigger, though: a later retention rule may have to
-- delete old rows, which only the owner could do. Class Internal (architecture section 5.1): no figure of an estimate or a rate is ever written here.

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6) NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: the newest run of a job first, which is how the Settings page asks (the id breaks a tie between two runs that finished at the same instant).
CREATE INDEX "idx_job_runs_job_finished_at" ON "job_runs"("job", "finished_at" DESC);

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it: a job has a name, and the result is a JSON object (so "result -> 'status'" always means something).
ALTER TABLE "job_runs" ADD CONSTRAINT "ck_job_runs_job_not_blank" CHECK ("job" ~ '\S');
ALTER TABLE "job_runs" ADD CONSTRAINT "ck_job_runs_result_is_object" CHECK (jsonb_typeof("result") = 'object');

-- 2. Grants. The runtime role (the web process and the worker both connect as "accucut_app", deploy/db/create-roles.psql) reads the rows, for the Settings page, and adds
--    them, for the worker's own jobs (the heartbeat and "backup-watch" of architecture sections 4.7 and 9.9). It cannot change or remove one: no UPDATE, no DELETE, no
--    TRUNCATE. The role script's default privileges give the four row rights; this removes three and states the list, so a later change to the defaults cannot widen it.
--    Nothing is granted to a backup role: the role the Windows backup task writes with does not exist yet. STORY-10.05 creates it (ADR-015 Amendment 3) and grants it INSERT.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "job_runs" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "job_runs" TO "accucut_app";
