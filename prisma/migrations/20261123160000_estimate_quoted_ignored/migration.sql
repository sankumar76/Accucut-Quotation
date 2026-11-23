-- CR-01 item 7B (AQP-399; architecture section 4.12 a and b; ADR-019 Option A): the columns and CHECKs behind QUOTED and the Ignored layer. Five nullable columns on "estimates"; no
-- existing row changes (every new column is NULL, and no row can be QUOTED yet), so no backfill is needed. The routes, buttons and audit events that fill them are stories 7C and 7D.
--
-- Ignored is a **layer over the status, not a status value**: "ignored_at", "ignored_by" and "ignore_remarks" are all NULL or all set, and the status underneath is never touched, so
-- Restore (7D) cannot lose it. QUOTED is a real status with "quoted_at" and "quoted_by". Class Internal: none of these is cost data, and the remarks may reach the Engineer (A-CR01-2).
--
-- This file names 'QUOTED' in a CHECK, which is allowed only because the value was added, and committed, by the earlier file 20261123150000_estimate_status_quoted.
--
-- CHECKs (each refuses a row an application bug could otherwise write):
--   ck_estimates_quoted                     "status" is QUOTED exactly when the quote columns are set, and the two quote columns are both NULL or both set. (Tighter than the
--                                           architecture's one clause: a half-set pair on a row that is not QUOTED is refused too.)
--   ck_estimates_ignored_all_or_none        the three ignore columns are all NULL or all set.
--   ck_estimates_ignore_remarks_not_blank   remarks are never empty or only white space (spaces, tabs, line breaks).
--   ck_estimates_ignore_remarks_length      at most 2000 characters: a ceiling above the code constant of 7D (IGNORE_REMARKS_MAX_LENGTH, 500), the rule that a database limit is
--                                           looser than the code limit, so raising the constant is a code-only change.
--   ck_estimates_quoted_not_ignored         a QUOTED estimate is never ignored (Ignore is refused from QUOTED, ESTIMATE_QUOTED_IS_FINAL).
--
-- The foreign keys point at "users" with no cascade, like every other person column: people are deactivated and never deleted. The runtime role already holds SELECT, INSERT and
-- UPDATE on the whole table, so the new columns need no grant.
--
-- One transaction (Prisma runs the file in one): a failure anywhere rolls the whole file back.
--
-- Rollback note (reverse order of the CR-01 migrations; run with the previous release). First, because the columns are about to go: run the UPDATE in the header of
-- 20261123150000_estimate_status_quoted (QUOTED back to APPROVED, quote columns cleared), and Restore every ignored estimate, here in SQL: the layer is cleared and **the status
-- underneath is not touched**, so an ignored Draft stays a Draft (never set a status to make a row pass a CHECK: that would forge an Approved estimate with no approval behind it). The
-- state is lost from the row but kept in the audit log (the 7C and 7D events).
--   UPDATE "estimates" SET "ignored_at" = NULL, "ignored_by" = NULL, "ignore_remarks" = NULL WHERE "ignored_at" IS NOT NULL;
--   ALTER TABLE "estimates" DROP CONSTRAINT "ck_estimates_quoted_not_ignored", DROP CONSTRAINT "ck_estimates_ignore_remarks_length", DROP CONSTRAINT "ck_estimates_ignore_remarks_not_blank", DROP CONSTRAINT "ck_estimates_ignored_all_or_none", DROP CONSTRAINT "ck_estimates_quoted";
--   ALTER TABLE "estimates" DROP CONSTRAINT "fk_estimates_ignored_by", DROP CONSTRAINT "fk_estimates_quoted_by";
--   ALTER TABLE "estimates" DROP COLUMN "ignore_remarks", DROP COLUMN "ignored_by", DROP COLUMN "ignored_at", DROP COLUMN "quoted_by", DROP COLUMN "quoted_at";
-- Restore from the pre-update backup is the fallback.

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "quoted_at" TIMESTAMPTZ(6),
ADD COLUMN "quoted_by" UUID,
ADD COLUMN "ignored_at" TIMESTAMPTZ(6),
ADD COLUMN "ignored_by" UUID,
ADD COLUMN "ignore_remarks" TEXT;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "fk_estimates_quoted_by" FOREIGN KEY ("quoted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "fk_estimates_ignored_by" FOREIGN KEY ("ignored_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written CHECKs (Prisma does not model them).
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_quoted" CHECK (("status" = 'QUOTED') = ("quoted_at" IS NOT NULL) AND ("quoted_at" IS NULL) = ("quoted_by" IS NULL));
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_ignored_all_or_none" CHECK (("ignored_at" IS NULL) = ("ignored_by" IS NULL) AND ("ignored_at" IS NULL) = ("ignore_remarks" IS NULL));
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_ignore_remarks_not_blank" CHECK ("ignore_remarks" IS NULL OR "ignore_remarks" !~ '^[[:space:]]*$');
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_ignore_remarks_length" CHECK ("ignore_remarks" IS NULL OR char_length("ignore_remarks") <= 2000);
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_quoted_not_ignored" CHECK (NOT ("status" = 'QUOTED' AND "ignored_at" IS NOT NULL));
