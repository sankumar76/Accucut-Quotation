-- CR-01 item 7A (AQP-398; architecture section 4.12 a and b; ADR-019 Option A): the estimate status that follows Calculate is called PREPARED. The stored value SUBMITTED is renamed in
-- place. Same meaning, same rules: no new column, event or route (QUOTED and the Ignored layer are story 7B, in files of their own).
--
-- One statement. ALTER TYPE ... RENAME VALUE (PostgreSQL 10 or later; the target is 17) changes the enum label in the catalogue only: no row of "estimates" is rewritten, no index or
-- default is rebuilt and nothing can be lost. Every row that read SUBMITTED reads PREPARED from the commit on. Nothing else in the database names the label (checked: no CHECK, index,
-- trigger or default in the earlier migrations mentions it).
--
-- Safe as one release only because no production database exists before G8 (assumption A-CR01-A1): the previous image would not know PREPARED. If CR-01 has not merged when the first
-- production install happens, this item needs expand-then-contract (add PREPARED, copy, retire SUBMITTED) instead.
--
-- Legacy audit entries: approval.cancelled entries written before this file hold "status": "SUBMITTED" in their JSON, and the audit log is immutable (a trigger refuses UPDATE). They are
-- not touched here. The code reads them as PREPARED (src/server/services/audit-events.ts, read schema only).
--
-- Rollback note (reverse order of the CR-01 migrations; this one is the last to undo). Run with the previous release:
--   ALTER TYPE "estimate_status" RENAME VALUE 'PREPARED' TO 'SUBMITTED';
-- Nothing is lost. Entries written after this file by "approval.cancelled" hold "PREPARED" and the previous release cannot read them as Submitted; they would show without detail.
-- Restore from the pre-update backup is the fallback.

-- AlterEnum
ALTER TYPE "estimate_status" RENAME VALUE 'SUBMITTED' TO 'PREPARED';
