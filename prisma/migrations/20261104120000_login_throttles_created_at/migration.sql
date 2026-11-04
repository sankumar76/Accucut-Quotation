-- STORY-01.01 (AQP-38), G6 finding STD-02: every mutable table has created_at (coding standards section 10).
-- The natural primary key key_hash is accepted (decision DL-072): the key is a keyed hash of an account key or an
-- address, looked up by exactly that value, so a surrogate id would add a column and an index and no use.
--
-- Additive only. Existing rows (none outside development) take the time of the migration.
-- Rollback note: ALTER TABLE "login_throttles" DROP COLUMN "created_at";

-- AlterTable
ALTER TABLE "login_throttles" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
