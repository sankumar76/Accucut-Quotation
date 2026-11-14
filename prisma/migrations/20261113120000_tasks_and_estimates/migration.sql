-- STORY-04.01 (AQP-148): the task an Engineer is assigned, the numbers that name it, and the empty estimate that waits for the Engineer
-- (FR-032, FR-041; SPEC section 5.1; architecture sections 4.4, 5.1 and 6).
--
-- Additive only (one type, three new tables, their indexes and constraints): the previous image keeps running during a rollback.
-- Rollback note, for use only before a Lead or Admin has assigned a task; restore from backup after that:
--   DROP TABLE "estimates"; DROP TABLE "tasks"; DROP TABLE "task_sequences"; DROP TYPE "estimate_status";   -- in this order: the first refers to the second
--
-- The tables are created EMPTY. A task and its estimate are written in one transaction by the task service, so neither exists without the other.
-- Neither can be deleted by the runtime role (a task is closed or reassigned, never removed).

-- CreateEnum
CREATE TYPE "estimate_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "task_sequences" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "engineer_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "folder_path" TEXT NOT NULL,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "assignment_revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" "estimate_status" NOT NULL DEFAULT 'DRAFT',
    "inputs_revision" INTEGER NOT NULL DEFAULT 0,
    "current_calculation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tasks_code" ON "tasks"("code");

-- CreateIndex
CREATE INDEX "idx_tasks_engineer_id_deadline_at" ON "tasks"("engineer_id", "deadline_at");

-- CreateIndex
CREATE INDEX "idx_tasks_assigned_by_deadline_at" ON "tasks"("assigned_by", "deadline_at");

-- CreateIndex
CREATE INDEX "idx_tasks_deadline_at" ON "tasks"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_estimates_task_id" ON "estimates"("task_id");

-- CreateIndex
CREATE INDEX "idx_estimates_status" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "idx_estimates_customer_id" ON "estimates"("customer_id");

-- AddForeignKey
-- No cascade on any of them: people are deactivated and never deleted, and a task and its estimate are never removed. `estimates.current_calculation_id`
-- has no foreign key until `calculations` exists (story 03.05).
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_engineer_id" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "fk_estimates_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "fk_estimates_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the tables keep whoever writes to them. A folder path is a UNC path (two backslashes, then a server and a share), whatever the code that
--    wrote it checked (architecture section 8, input validation). The title and notes limits are those of the screen (SCR-04: 120 and 1,000
--    characters). A year is a four-digit year, a sequence has issued at least one number, and a revision starts at 1.
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_folder_path_is_unc" CHECK ("folder_path" ~ '^\\\\[^\\]+\\[^\\]+');
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_folder_path_length" CHECK (char_length("folder_path") <= 500);
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_title_length" CHECK (char_length("title") <= 120);
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_notes_length" CHECK (char_length("notes") <= 1000);
ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_assignment_revision_positive" CHECK ("assignment_revision" >= 1);
ALTER TABLE "task_sequences" ADD CONSTRAINT "ck_task_sequences_year" CHECK ("year" BETWEEN 2000 AND 2999);
ALTER TABLE "task_sequences" ADD CONSTRAINT "ck_task_sequences_last_value_positive" CHECK ("last_value" >= 1);
ALTER TABLE "estimates" ADD CONSTRAINT "ck_estimates_inputs_revision_not_negative" CHECK ("inputs_revision" >= 0);

-- 2. Grants for the runtime role. It reads, adds and changes the three tables (a sequence number is taken by an upsert, and a reassign or an approval
--    changes a task or an estimate later), and cannot delete from them or truncate them. The default privileges of the role script give the four row
--    rights; this states the list, so a later change to the defaults cannot widen it.
REVOKE DELETE, TRUNCATE ON TABLE "task_sequences" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "task_sequences" TO "accucut_app";
REVOKE DELETE, TRUNCATE ON TABLE "tasks" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "tasks" TO "accucut_app";
REVOKE DELETE, TRUNCATE ON TABLE "estimates" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "estimates" TO "accucut_app";
