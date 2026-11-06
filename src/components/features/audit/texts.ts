/**
 * The words of SCR-16 "Audit log" (UX spec section 6, written out; STORY-01.07 AC-6, AC-8). One file, so a sentence is written
 * once and a test can compare it with the spec.
 */

export const AUDIT_TITLE = 'Audit log';

/**
 * The page description (ux-spec v0.16, release 1). It says what the portal does and no more: whoever has access to the server can
 * reach the database, so the log is a record and not a control over the Admin (ARCH-R8). Task and configuration changes join the
 * list with the Release 2 stories that write them.
 */
export const AUDIT_DESCRIPTION =
  'A record of approvals, unlocks, price overrides, cancelled approvals, removed prices, quantity warnings gone ahead on, master data and user changes. The portal has no way to edit or delete an entry.';

/** The page's own description meta tag (ux-spec v0.16). */
export const AUDIT_META_DESCRIPTION = 'A record of approvals, unlocks, price overrides, master data and user changes.';

export const WHO_LABEL = 'Who';
export const EVENT_LABEL = 'Event';
export const FROM_LABEL = 'From';
export const TO_LABEL = 'To';
export const EVERYONE = 'Everyone';
export const ALL_EVENTS = 'All events';

export const TABLE_CAPTION = 'Audit log, newest first';
export const TABLE_REGION_LABEL = 'Audit log, newest first, scrollable';
export const LIST_LABEL = 'Audit log entries, newest first';

export const COLUMN_WHEN = 'When';
export const COLUMN_WHO = 'Who';
export const COLUMN_EVENT = 'Event';
export const COLUMN_OBJECT = 'Object';
/** The arrow between the two is an icon, with the word "to" for a screen reader. */
export const CHANGE_FROM = 'Before';
export const CHANGE_TO = 'after';
export const ARROW_TEXT = 'to';

export const EMPTY_TITLE = 'No entries match';
export const EMPTY_FILTERED_DESCRIPTION = 'Try a wider date range or another event type.';
export const EMPTY_CLEAR_FILTERS = 'Clear filters';
/** With no filter on, an empty log is not a matter of filters: nothing has been recorded yet. */
export const EMPTY_UNFILTERED_TITLE = 'No entries yet';
export const EMPTY_UNFILTERED_DESCRIPTION = 'Changes to users, masters and approvals are recorded here as they happen.';

export const ERROR_TITLE = 'We could not load the audit log';
export const ERROR_RETRY = 'Try again';

export const LOADING_LABEL = 'Loading the audit log';

export const SHOW_MORE = 'Show more entries';
export const SHOW_MORE_FAILED_TITLE = 'We could not load more entries';
export const SHOW_MORE_FAILED_BODY = 'Nothing was changed. Press "Show more entries" to try again.';

/** The line under the list: "Showing 14 of 14 entries, newest first". */
export function showingText(shown: number, total: number): string {
  return `Showing ${String(shown)} of ${String(total)} ${total === 1 ? 'entry' : 'entries'}, newest first`;
}
