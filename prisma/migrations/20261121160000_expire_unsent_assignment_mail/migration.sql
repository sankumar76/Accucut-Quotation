-- DEF-055 (AQP-385, master's ruling DL-282): the assignment e-mails that were queued before the fix have no expiry.
--
-- From this change a "Task assigned" row is written with send_before = 24 hours after it is written, so the worker skips an old one as EXPIRED (STORY-09.03 AC-1, AC-7; decision D-c: a mail
-- about an old event must not go out late). Rows written earlier have send_before NULL and would still all go out, at 25 a minute, the day e-mail is switched on (STORY-09.08) or after a
-- long worker outage, including mails about tasks long closed. This statement gives each of them a send_before of now, so the worker's claim skips them as EXPIRED and never sends them.
--
-- Data only, no schema change: it touches the rows of one event that are waiting to be sent and have no deadline, and nothing else:
--   - a row that is sent, sending, failed or skipped is left as it is;
--   - a row of another event (overdue, digest, backup missed, reset link) is left as it is;
--   - a row that already has a send_before, earlier or later, is left as it is.
-- It is safe to run again: the rows it changed now have a send_before, so a second run changes nothing. On a database with no such row (a new install, or CI) it changes none.
--
-- The previous image keeps running during a rollback: it neither names nor reads send_before for this event, and an expired row is only skipped, never lost (the row stays, with last_error
-- EXPIRED once the worker has claimed it). No rollback is needed or possible: the rows are not mails anyone should still receive.

UPDATE email_outbox
   SET send_before = now()
 WHERE event = 'task-assigned' AND status = 'pending' AND send_before IS NULL;
