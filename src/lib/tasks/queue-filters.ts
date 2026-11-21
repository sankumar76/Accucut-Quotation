import type { RoleName } from '../auth/roles';
import { isIsoDate } from '../time';

import { DEFAULT_QUEUE_TAB, isQueueTab, type QueueTab } from './queue';

/**
 * The filters of the task queue (STORY-04.06; FR-035, FR-039, architecture section 6 "Tasks") and how they become an address, in one place: the page reads the address
 * with `readQueueAddress`, the screen writes it back with `queueAddressQuery`, and `queueQueryString` is the same names for `GET /api/v1/tasks`. Pure and without zod,
 * so the browser carries it (NFR-009); the route's schema (`views/schemas/tasks.ts`) and the task service check every value again and decide.
 *
 * An empty text means "no filter". `assignedBy` has three states because the Lead's default is not a stored setting (A-1): `''` is "not said", which a Lead reads as
 * `me` and an Admin as no filter; `me` is the tasks the person assigned; `anyone` is the whole queue, written by a Lead who removed the chip.
 */

export type AssignedByFilter = '' | 'me' | 'anyone';

export interface QueueFilters {
  /** Task ID or title, contains, ignoring letter case. At most `QUEUE_SEARCH_MAX_LENGTH` characters. */
  readonly q: string;
  /** An active Engineer's ID. */
  readonly engineer: string;
  /** A customer's ID. */
  readonly customer: string;
  /** First deadline day in IST, `YYYY-MM-DD`. */
  readonly from: string;
  /** Last deadline day in IST, `YYYY-MM-DD`, inclusive. */
  readonly to: string;
  readonly assignedBy: AssignedByFilter;
}

export const NO_QUEUE_FILTERS: QueueFilters = { q: '', engineer: '', customer: '', from: '', to: '', assignedBy: '' };

/** The longest search the route reads (architecture section 6). */
export const QUEUE_SEARCH_MAX_LENGTH = 120;

/** The words under To when the range ends before it begins (STORY-04.06 AC-4); also the message of the 422. */
export const DATE_ORDER_MESSAGE = 'The start date is after the end date.';

/** Is anything but the "Assigned by me" chip narrowing the list? That is what "Clear filters" empties and what makes an empty list a "No match". */
export function hasListFilter(filters: QueueFilters): boolean {
  return filters.q !== '' || filters.engineer !== '' || filters.customer !== '' || filters.from !== '' || filters.to !== '';
}

/** The message for a range that ends before it begins, or null. ISO dates compare as text in the order of the calendar. */
export function dateRangeProblem(filters: Pick<QueueFilters, 'from' | 'to'>): string | null {
  return filters.from !== '' && filters.to !== '' && filters.from > filters.to ? DATE_ORDER_MESSAGE : null;
}

/** Clear filters: search, Engineer, Customer, From and To go; the "Assigned by me" chip is separate and stays as it is (STORY-04.06 AC-6). */
export function withoutListFilters(filters: QueueFilters): QueueFilters {
  return { ...NO_QUEUE_FILTERS, assignedBy: filters.assignedBy };
}

function appendFilters(params: URLSearchParams, filters: QueueFilters): void {
  if (filters.assignedBy !== '') params.set('assignedBy', filters.assignedBy);
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.engineer !== '') params.set('engineer', filters.engineer);
  if (filters.customer !== '') params.set('customer', filters.customer);
  if (filters.from !== '') params.set('from', filters.from);
  if (filters.to !== '') params.set('to', filters.to);
}

/**
 * `tab=overdue&assignedBy=me&q=...&cursor=...`: the query string of one page of a tab for `GET /api/v1/tasks`; the cursor is the one the server sent, passed back
 * unchanged. Names with no value are left out.
 */
export function queueQueryString(tab: QueueTab, cursor?: string, filters: QueueFilters = NO_QUEUE_FILTERS): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  appendFilters(params, filters);
  if (cursor !== undefined) params.set('cursor', cursor);
  return params.toString();
}

/** The query of the page's own address (`/queue?...`, no leading "?"): the same names, and no `tab` while it is the Open tab. Empty for the plain queue. */
export function queueAddressQuery(tab: QueueTab, filters: QueueFilters): string {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_QUEUE_TAB) params.set('tab', tab);
  appendFilters(params, filters);
  return params.toString();
}

/** What an address is read against: the person's role, and the people and customers the filter row offers (a value that is not among them is stale). */
export interface QueueAddressContext {
  readonly role: RoleName;
  readonly engineerIds: ReadonlySet<string>;
  readonly customerIds: ReadonlySet<string>;
}

export interface QueueAddress {
  readonly tab: QueueTab;
  readonly filters: QueueFilters;
}

type Params = Readonly<Record<string, string | string[] | undefined>>;

/** One value of the address as text, or null for a name that is missing or repeated. */
function valueOf(params: Params, name: string): string | null {
  const value = params[name];
  return typeof value === 'string' ? value : null;
}

function choiceOf(params: Params, name: string, offered: ReadonlySet<string>): string {
  const value = valueOf(params, name);
  return value !== null && offered.has(value) ? value : '';
}

function dayOf(params: Params, name: string): string {
  const value = valueOf(params, name);
  return value !== null && isIsoDate(value) ? value : '';
}

function searchOf(params: Params): string {
  const value = valueOf(params, 'q')?.trim() ?? '';
  return value.length > QUEUE_SEARCH_MAX_LENGTH ? '' : value;
}

/** What `assignedBy` means for this role when the address says `value` (STORY-04.06 AC-1, AC-2, D-1): the Lead's default is `me`, an Admin's is no filter, an Engineer has none. */
function assignedByOf(role: RoleName, value: string | null): AssignedByFilter {
  switch (role) {
    case 'LEAD':
      return value === 'anyone' ? 'anyone' : 'me';
    case 'ADMIN':
      return value === 'me' ? 'me' : '';
    case 'ENGINEER':
      return '';
  }
}

/**
 * The tab and the filters an address holds, for this person (STORY-04.06 AC-1, AC-4, AC-5). Never an error: a value that is malformed, repeated, stale (an Engineer or a
 * customer that is not offered any more) or not for this role is left out, so a bookmarked or hand-typed address still opens the queue. An Engineer keeps only the search; a Lead
 * whose address does not say `assignedBy` gets the default `me`; dates that end before they begin are both left out.
 */
export function readQueueAddress(params: Params, context: QueueAddressContext): QueueAddress {
  const requestedTab = valueOf(params, 'tab');
  const tab = requestedTab !== null && isQueueTab(requestedTab) ? requestedTab : DEFAULT_QUEUE_TAB;
  const assignedBy = assignedByOf(context.role, valueOf(params, 'assignedBy'));
  const q = searchOf(params);
  if (context.role === 'ENGINEER') return { tab, filters: { ...NO_QUEUE_FILTERS, q } };
  const engineer = choiceOf(params, 'engineer', context.engineerIds);
  const customer = choiceOf(params, 'customer', context.customerIds);
  const days = { from: dayOf(params, 'from'), to: dayOf(params, 'to') };
  const range = dateRangeProblem(days) === null ? days : { from: '', to: '' };
  return { tab, filters: { q, engineer, customer, ...range, assignedBy } };
}
