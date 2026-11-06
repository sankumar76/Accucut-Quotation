/**
 * The kinds of entry the audit screen can filter by and the words it uses (STORY-01.07; UX spec SCR-16 "Event filter"). A
 * category groups the events of one subject of the registry (`src/server/services/audit-events.ts`), for example "User change"
 * holds the five user events. The registry gives every event one of these; the screen offers them in this order.
 *
 * Only Release 1 categories are here. "Task change" (FR-040) and "Configuration change" (FR-079) are Release 2: their stories add
 * a line to this list and the events to the registry. The file is plain data, so the browser can import it (NFR-009).
 */

export const AUDIT_CATEGORIES = [
  { id: 'approval', label: 'Approval' },
  { id: 'unlock', label: 'Unlock' },
  { id: 'price_override', label: 'Price override' },
  { id: 'approval_cancelled', label: 'Approval cancelled' },
  { id: 'price_removed', label: 'Price removed' },
  { id: 'quantity_warning', label: 'Quantity warning' },
  { id: 'master_data', label: 'Master data edit' },
  { id: 'user_change', label: 'User change' },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditCategoryId = AuditCategory['id'];

export function isAuditCategoryId(value: string): value is AuditCategoryId {
  return AUDIT_CATEGORIES.some((category) => category.id === value);
}

/** The words of a category, or null for an ID this release does not know. */
export function auditCategoryLabel(id: string): string | null {
  return AUDIT_CATEGORIES.find((category) => category.id === id)?.label ?? null;
}

/** The default and the largest page of entries (architecture section 6, "Pagination"). */
export const AUDIT_DEFAULT_LIMIT = 50;
export const AUDIT_MAX_LIMIT = 200;
