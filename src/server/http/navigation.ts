import type { RoleName } from '../../lib/auth/roles';

import { allowsRole, NAV_GROUP_ORDER, ROUTE_MANIFEST, type NavGroupName, type NavIcon, type RouteRow } from './route-manifest';

/**
 * The menu a role sees (STORY-01.02 AC-6, assumption A-1): the manifest rows that carry `nav`, are implemented and
 * allow the role. The menu and the access check read the same rows, so an item is shown exactly where it can be opened.
 * An Engineer's list holds no Admin or Lead item at all, not even a disabled one, and the same list is what
 * `GET /api/v1/me` returns, so a client cannot learn of a page its role may not open.
 */

export interface NavEntry {
  readonly group: NavGroupName;
  readonly label: string;
  readonly href: string;
  readonly icon: NavIcon;
}

export interface NavigationOptions {
  /** Include rows that a production build hides (`/design-system`). Pass `isDesignSystemAvailable()`. */
  readonly includeHiddenInProduction: boolean;
  readonly manifest?: ReadonlyArray<RouteRow>;
}

function isMenuEntry(row: RouteRow, role: RoleName, includeHidden: boolean): boolean {
  if (row.kind !== 'page' || row.nav === undefined || row.status !== 'implemented') return false;
  if (row.hiddenInProduction === true && !includeHidden) return false;
  return allowsRole(row, role);
}

export function navigationFor(role: RoleName, options: NavigationOptions): ReadonlyArray<NavEntry> {
  const manifest = options.manifest ?? ROUTE_MANIFEST;
  const entries = manifest.flatMap((row) => {
    const { nav } = row;
    if (nav === undefined || !isMenuEntry(row, role, options.includeHiddenInProduction)) return [];
    return [{ entry: { group: nav.group, label: nav.labelFor?.[role] ?? nav.label, href: row.path, icon: nav.icon }, order: nav.order }];
  });
  entries.sort(
    (a, b) => NAV_GROUP_ORDER.indexOf(a.entry.group) - NAV_GROUP_ORDER.indexOf(b.entry.group) || a.order - b.order,
  );
  return entries.map(({ entry }) => entry);
}

export interface NavigationGroup {
  readonly label: NavGroupName;
  readonly items: ReadonlyArray<NavEntry>;
}

/** The same entries gathered under their group headings, in the menu's order. */
export function groupNavigation(entries: ReadonlyArray<NavEntry>): ReadonlyArray<NavigationGroup> {
  return NAV_GROUP_ORDER.flatMap((label) => {
    const items = entries.filter((entry) => entry.group === label);
    return items.length === 0 ? [] : [{ label, items }];
  });
}
