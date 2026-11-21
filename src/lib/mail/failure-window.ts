import { MILLISECONDS_PER_DAY } from '../time';

/**
 * How far back the Settings notice "E-mails not sent" looks (STORY-09.06 AC-8): the e-mails that failed for good in the last 7 days. One constant and one function, so the service that asks and
 * the sentence that says it cannot disagree.
 */
export const MAIL_FAILURE_WINDOW_DAYS = 7;

/** The start of the window: failures at or after this instant count. */
export function mailFailureSince(now: Date): Date {
  return new Date(now.getTime() - MAIL_FAILURE_WINDOW_DAYS * MILLISECONDS_PER_DAY);
}
