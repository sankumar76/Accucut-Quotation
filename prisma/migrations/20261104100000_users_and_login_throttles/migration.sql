-- STORY-01.01 (AQP-38): the people who sign in and the counters that slow a guesser (ADR-009, NFR-003,
-- architecture sections 5.1, 6 and 8).
--
-- Additive only (two new tables, one new type): the previous image keeps running during a rollback.
-- Rollback note, for use only before any user exists; restore from backup after that:
--   DROP TABLE "login_throttles";
--   DROP TABLE "users";
--   DROP TYPE "user_role";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'LEAD', 'ENGINEER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttles" (
    "key_hash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- Hand-written from here (Prisma cannot express these).
--
-- 1. The e-mail is unique without regard to letter case: the application stores it lower-case, and this
--    constraint refuses any other spelling, so two rows can never differ only by case.
ALTER TABLE "users" ADD CONSTRAINT "ck_users_email_lower_case" CHECK ("email" = lower("email"));

-- 2. One active Admin at most (architecture section 5.1, CONSTRAINT-04). Its test is story 01.04.
CREATE UNIQUE INDEX "uq_users_single_active_admin" ON "users" ("role") WHERE "role" = 'ADMIN' AND "is_active";

-- 3. Grants for the runtime role (convention for every migration: say what it may do). It reads, adds and
--    changes users, and never deletes one: a user is deactivated (FR-004). The throttle table is plain
--    working data, so it also allows DELETE for a later clean-up job.
REVOKE DELETE, TRUNCATE ON TABLE "users" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "users" TO "accucut_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "login_throttles" TO "accucut_app";
