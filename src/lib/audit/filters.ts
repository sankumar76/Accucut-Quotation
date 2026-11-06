/**
 * What the audit screen filters by, and how a choice becomes a query string for `GET /api/v1/audit` (STORY-01.07 AC-6; UX spec
 * SCR-16). Pure and without zod, so the page does not carry it (NFR-009): the server's schema (`views/schemas/audit.ts`) checks
 * everything again and decides.
 *
 * An empty text means "no filter". `event` holds the category the Event list offers ("User change"), not a single event: the API
 * also takes one event, but the screen filters by the kinds of entry the UX spec names.
 */

export interface AuditFilters {
  /** A person's ID, or ''. */
  readonly who: string;
  /** A category ID (`categories.ts`), or ''. */
  readonly category: string;
  /** First day, `YYYY-MM-DD`, or ''. */
  readonly from: string;
  /** Last day, `YYYY-MM-DD`, or ''. */
  readonly to: string;
}

export const NO_FILTERS: AuditFilters = { who: '', category: '', from: '', to: '' };

export const RANGE_ORDER_MESSAGE = 'The To date must be on or after the From date.';

export function hasActiveFilter(filters: AuditFilters): boolean {
  return filters.who !== '' || filters.category !== '' || filters.from !== '' || filters.to !== '';
}

/** The message for a range that ends before it begins, or null. ISO dates compare as text in the order of the calendar. */
export function rangeProblem(filters: Pick<AuditFilters, 'from' | 'to'>): string | null {
  return filters.from !== '' && filters.to !== '' && filters.from > filters.to ? RANGE_ORDER_MESSAGE : null;
}

/** The query string (with no leading "?") for these filters, and the cursor of a later page. Names with no value are left out. */
export function auditQueryString(filters: AuditFilters, cursor?: string): string {
  const query = new URLSearchParams();
  if (filters.who !== '') query.set('who', filters.who);
  if (filters.category !== '') query.set('category', filters.category);
  if (filters.from !== '') query.set('from', filters.from);
  if (filters.to !== '') query.set('to', filters.to);
  if (cursor !== undefined) query.set('cursor', cursor);
  return query.toString();
}
