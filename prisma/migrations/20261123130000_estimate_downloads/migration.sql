-- STORY-CR01.7E (AQP-402; CR-01 item 7c; FR-111, FR-011, NFR-002, NFR-007; architecture section 4.12 b and d): the log of every Excel download of an estimate, for the marker "Not downloaded",
-- "Downloaded N times" and "Changed since download" that a Lead and an Admin see.
--
-- Additive only (one new table, its index, foreign keys, triggers and grants): the previous image keeps running during a rollback, because it neither reads nor writes the table.
-- Rollback note (a release rollback of this applied migration): the table holds the download history of every estimate, so dropping it loses that history (the marker then reads "Not downloaded" everywhere, which is
-- harmless). In ONE transaction, with the reversing SQL, remove the migration's own row from Prisma's history, so the next `migrate deploy` of the older release does not find a history that disagrees with the database:
--   BEGIN;
--   DROP TABLE "estimate_downloads";   -- also drops its index, its foreign keys and its triggers
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261123130000_estimate_downloads';
--   COMMIT;
-- then check `npx prisma migrate status` (architecture section 5.6). `prisma migrate resolve --rolled-back` is only for the FAILED-deploy case (P3009), not for a migration that was applied.
--
-- One row per download that the server handed over: the estimate, the calculation the file was made from, the approval whose price the file carries in BO2 (null when the file holds no price: the
-- estimate had no approval, or its approval was cancelled or its price removed), who downloaded and when. The row is written once, after the file was built and before its bytes are returned, so a
-- download that failed or was refused leaves no row, and a file is never given without its record.
--
-- No "updated_at", by design: a row is a record of what happened, written once and never changed (the append-only exception to the rule that every table has the timestamps, coding standards
-- section 10 "SQL"). "downloaded_at" is stamped by the database. Kept as long as the estimate (never deleted). Class Internal (architecture section 5.1): a person's ID, two record IDs and an instant;
-- no figure, no price and no file content is written here. Read by the Lead and the Admin only; no Engineer view or route reads it (NFR-002).

-- CreateTable
CREATE TABLE "estimate_downloads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "calculation_id" UUID NOT NULL,
    "approval_id" UUID,
    "downloaded_by" UUID NOT NULL,
    "downloaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: the newest download of an estimate first, which is how the marker asks (the count and the last download of one estimate).
CREATE INDEX "idx_estimate_downloads_estimate_id" ON "estimate_downloads"("estimate_id", "downloaded_at" DESC);

-- AddForeignKey
ALTER TABLE "estimate_downloads" ADD CONSTRAINT "fk_estimate_downloads_estimate_id" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimate_downloads" ADD CONSTRAINT "fk_estimate_downloads_calculation_id" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimate_downloads" ADD CONSTRAINT "fk_estimate_downloads_approval_id" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimate_downloads" ADD CONSTRAINT "fk_estimate_downloads_downloaded_by" FOREIGN KEY ("downloaded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. Grants. The runtime role (the web process and the worker both connect as "accucut_app", deploy/db/create-roles.psql) reads the rows, for the marker, and adds them, for the download. It cannot
--    change or remove one: no UPDATE, no DELETE, no TRUNCATE. The role script's default privileges give the four row rights; this removes three and states the list, so a later change to the
--    defaults cannot widen it.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "estimate_downloads" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "estimate_downloads" TO "accucut_app";

-- 2. Triggers, the backstop for every role, the owner included. They use the function of the config_versions migration. The owner could still drop a trigger with DDL; that is a schema change, made
--    only by a migration, and the runtime role cannot do it (architecture section 9.5, ARCH-R8).
CREATE TRIGGER "trg_estimate_downloads_forbid_change"
    BEFORE UPDATE OR DELETE ON "estimate_downloads"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_estimate_downloads_forbid_truncate"
    BEFORE TRUNCATE ON "estimate_downloads"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
