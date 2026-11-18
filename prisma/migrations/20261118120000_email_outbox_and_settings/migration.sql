-- STORY-09.01 (AQP-348): the e-mail outbox and the mail settings (FR-019, FR-081 to FR-084, FR-003; architecture sections 4.7 and 5.1; ADR-011).
--
-- Additive only (two new tables, a foreign key to users): the previous image keeps running during a rollback, because it neither reads nor writes them.
-- Rollback note, for use only before the first alert or reset e-mail has been queued; after that, dropping "email_outbox" loses the e-mail log (DR-013):
--   DROP TABLE "email_outbox";   -- also drops its indexes, its foreign key and its CHECK constraints
--   DROP TABLE "settings";
--
-- Column names, by ruling of the solution-architect on this story (2026-11-18, architecture v0.55, Jira AQP-348 comments 12213 and 12215):
--   - Recipients are user IDs, never addresses: "to_user_id" (a foreign key to users, no cascade) and "cc_user_ids" (an array of user IDs). The address is read from users.email when
--     the row is sent, and only for an active user (NFR-028), so this table holds no personal data and tests/unit/privacy-schema.test.ts needs no exception. They replace the columns
--     "to" and "cc" of the first draft of section 5.1 ("TO" is an SQL keyword).
--   - "send_before": a row past it at claim time is marked 'skipped' with last_error 'EXPIRED' and is never sent (a reset row carries its token's expiry).
--   - "settings"."sender_mailbox", not "sender_address": the portal's own sending mailbox is not personal data, and the name keeps it off the privacy test's list.
-- "last_error" is a class code (SENDER_NOT_ALLOWED, AUTH_FAILED, CONNECTION, NO_SENDER, NO_RECIPIENT, EXPIRED, ALERTS_OFF, UNKNOWN), never a message, so a secret cannot reach it.
-- A body that holds a secret (the reset link of STORY-09.07) is emptied once the row is sent, failed or skipped: the row stays as the e-mail log. Class Confidential.

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "to_user_id" UUID NOT NULL,
    "cc_user_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(6),
    "send_before" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sender_name" TEXT NOT NULL DEFAULT '',
    "sender_mailbox" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: the claim reads the due rows of one status, oldest first.
CREATE INDEX "idx_email_outbox_status_next_attempt_at" ON "email_outbox"("status", "next_attempt_at");

-- CreateIndex: the idempotency key (architecture section 4.7): a second row for the same event cannot exist.
CREATE UNIQUE INDEX "uq_email_outbox_idempotency_key" ON "email_outbox"("idempotency_key");

-- AddForeignKey: no cascade and no action on delete, so a user who has mail on record cannot be deleted (users are deactivated, never deleted).
ALTER TABLE "email_outbox" ADD CONSTRAINT "fk_email_outbox_to_user_id" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it.
--    "cc_user_ids" is NOT NULL in effect: Prisma models a list column as nullable with a default, so the rule is a CHECK, which keeps the schema and the migration identical for the drift check.
ALTER TABLE "email_outbox" ADD CONSTRAINT "ck_email_outbox_status" CHECK ("status" IN ('pending', 'sending', 'sent', 'failed', 'skipped'));
ALTER TABLE "email_outbox" ADD CONSTRAINT "ck_email_outbox_event_not_blank" CHECK ("event" ~ '\S');
ALTER TABLE "email_outbox" ADD CONSTRAINT "ck_email_outbox_idempotency_key_not_blank" CHECK ("idempotency_key" ~ '\S');
ALTER TABLE "email_outbox" ADD CONSTRAINT "ck_email_outbox_cc_user_ids_not_null" CHECK ("cc_user_ids" IS NOT NULL);
ALTER TABLE "email_outbox" ADD CONSTRAINT "ck_email_outbox_attempts_not_negative" CHECK ("attempts" >= 0);

-- 2. "settings" is one row: id = 1. The row is seeded here, so the worker and the Settings page can always read it, and the runtime role never inserts or deletes it.
ALTER TABLE "settings" ADD CONSTRAINT "ck_settings_single_row" CHECK ("id" = 1);
INSERT INTO "settings" ("id", "alerts_enabled", "sender_name", "sender_mailbox") VALUES (1, false, '', '');

-- 3. Grants. The runtime role (the web process and the worker both connect as "accucut_app", deploy/db/create-roles.psql) is given by default all four row rights on a new table; this
--    removes what it must not have and states the list, so a later change to the defaults cannot widen it. The outbox: SELECT, INSERT and UPDATE, no DELETE and no TRUNCATE (the rows are
--    the e-mail log). The settings row: SELECT and UPDATE, so it can be read and changed and can never be added to or removed.
REVOKE ALL ON TABLE "email_outbox" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "email_outbox" TO "accucut_app";
REVOKE ALL ON TABLE "settings" FROM "accucut_app";
GRANT SELECT, UPDATE ON TABLE "settings" TO "accucut_app";
