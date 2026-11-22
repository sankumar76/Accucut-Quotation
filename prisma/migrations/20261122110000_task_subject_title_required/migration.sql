-- CR-01 item 6 (AQP-390; architecture section 4.11 a): a task has a subject (the project name) and a title, both required.
--
-- One transaction (Prisma runs the file in one): add the column nullable, backfill, set NOT NULL, then add the CHECKs. A failure anywhere rolls the whole file back.
--
-- Backfill rule: first title = code where the title is null or blank, then subject = the title cut to 80 characters (the literal 80 is right here: a migration is frozen history and
-- must not follow a constant that can change; the limit in code is SUBJECT_MAX_LENGTH). A legacy title longer than 80 is cut in the subject only: the title is never shortened. No
-- non-empty value is overwritten and no column is dropped, so nothing is lost; the Lead can change these labelled values. No estimate row is touched (an estimate with no customer
-- keeps NULL: the customer stays on estimates.customer_id, nullable). The backfill writes no audit entry.
--
-- Database ceiling 200 for the subject, over the code's 80: raising the constant up to 200 is a code-only change. ck_tasks_title_length (120) stays as it is.
--
-- Safe as one release only because no production database exists before G8 (assumption A-CR01-A1): the previous image would insert tasks without a subject. If CR-01 has not merged
-- when the first production install happens, split this file into expand and contract (SET NOT NULL in the next release).
--
-- Rollback note (the architecture's section 5.6 asks one for each migration with a destructive effect). Reverse order, then run with the previous release:
--   ALTER TABLE "tasks" DROP CONSTRAINT "ck_tasks_subject_length", DROP CONSTRAINT "ck_tasks_subject_not_blank", DROP CONSTRAINT "ck_tasks_title_not_blank";
--   ALTER TABLE "tasks" ALTER COLUMN "title" DROP NOT NULL;
--   ALTER TABLE "tasks" DROP COLUMN "subject";
-- Lost on rollback: only the generated subjects and any subject typed since. Titles filled with the task code stay (harmless). Restore from the pre-update backup is the fallback.

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "subject" TEXT;

-- Backfill: the title is the code where it is empty, then the subject is the title cut to 80 (trimmed, so a subject can never be blank).
UPDATE "tasks" SET "title" = "code" WHERE "title" IS NULL OR btrim("title") = '';
UPDATE "tasks" SET "subject" = btrim(left(btrim("title"), 80)) WHERE "subject" IS NULL;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "subject" SET NOT NULL;

-- Hand-written from here (Prisma cannot express these).
--
-- A title and a subject are not blank, and a subject is at most 200 characters (the ceiling).
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_title_not_blank" CHECK (btrim("title") <> '');
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_subject_not_blank" CHECK (btrim("subject") <> '');
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_subject_length" CHECK (char_length("subject") <= 200);
