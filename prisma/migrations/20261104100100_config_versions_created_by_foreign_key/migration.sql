-- STORY-01.01 (AQP-38): the foreign key from config_versions.created_by to users (architect ruling on AQP-97,
-- Jira AQP-97 comment 10695 and AQP-38 comment 10696; architecture section 5.1).
--
-- A user is deactivated and never deleted, so there is no cascade: NO ACTION on delete and on update.
-- The constraint fires no row trigger, so the immutability guard on config_versions is not affected, and
-- version 1 keeps created_by null (a null never violates a foreign key).
--
-- Rollback note: ALTER TABLE "config_versions" DROP CONSTRAINT "fk_config_versions_created_by";

-- AddForeignKey
ALTER TABLE "config_versions" ADD CONSTRAINT "fk_config_versions_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
