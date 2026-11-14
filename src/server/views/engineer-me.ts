import type { AuthenticatedUser } from '../auth/resolve-session-user';
import { navigationFor, type NavEntry } from '../http/navigation';

import type { MeResponse } from './schemas/me';

/**
 * The projection behind `GET /api/v1/me` (STORY-01.02 AC-7): only the fields the schema names, copied one by one from the
 * signed-in person, so the id, `mustChangePassword` or anything added to `AuthenticatedUser` later is not sent by
 * accident. The menu is the one the page frame draws for the same role (`navigationFor`).
 *
 * The prefix names the lint scope, not the audience (STORY-01.03 STD-06): `engineer-*` means "an Engineer can reach this view, so the
 * import rule of `eslint.config.mjs` applies". This one answers every role; its answer is the same shape for all of them (one route,
 * one schema, architecture section 6), and it imports the one schema file it needs, never the barrel.
 */

export interface MeContext {
  /** Whether the review pages that a production build hides are listed (`isDesignSystemAvailable()`). */
  readonly includeHiddenInProduction: boolean;
  /**
   * The count of overdue tasks for the caller's role (STORY-04.03 AC-2), read by the route from the task service. It is a number the route hands in: this view imports no
   * task service or repository (they are blocked for `engineer-*` views, NFR-002), so it can only copy the count, never reach a task, and it adds no field to the answer.
   */
  readonly overdueCount: number;
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
    overdueCount: context.overdueCount,
  };
}
