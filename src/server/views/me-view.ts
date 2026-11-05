import type { AuthenticatedUser } from '../auth/resolve-session-user';
import { navigationFor, type NavEntry } from '../http/navigation';

import type { MeResponse } from './schemas/me';

/**
 * The projection behind `GET /api/v1/me` (STORY-01.02 AC-7): only the fields the schema names, copied one by one from the
 * signed-in person, so the id, `mustChangePassword` or anything added to `AuthenticatedUser` later is not sent by
 * accident. The menu is the one the page frame draws for the same role (`navigationFor`).
 */

/** No overdue count exists until STORY-04.03. */
const OVERDUE_COUNT_BEFORE_04_03 = 0;

export interface MeContext {
  /** Whether the review pages that a production build hides are listed (`isDesignSystemAvailable()`). */
  readonly includeHiddenInProduction: boolean;
}

function navigationItem(entry: NavEntry): MeResponse['navigation'][number] {
  return { group: entry.group, label: entry.label, href: entry.href };
}

export function buildMe(user: AuthenticatedUser, context: MeContext): MeResponse {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    navigation: navigationFor(user.role, { includeHiddenInProduction: context.includeHiddenInProduction }).map(navigationItem),
    overdueCount: OVERDUE_COUNT_BEFORE_04_03,
  };
}
