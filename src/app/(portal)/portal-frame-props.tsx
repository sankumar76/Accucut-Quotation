import {
  Database,
  Flag,
  House,
  Info,
  ListChecks,
  Package,
  Palette,
  ScrollText,
  Settings,
  SlidersHorizontal,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import type { AccountUser } from '@/components/shared/account-trigger';
import { Icon } from '@/components/shared/icon';
import type { NavGroup } from '@/components/shared/nav';
import { roleLabel, type RoleName } from '@/lib/auth/roles';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { groupNavigation, navigationFor } from '@/server/http/navigation';
import type { NavIcon } from '@/server/http/route-manifest';

/** The drawing for each icon name the manifest uses. Server-side only: the menu reaches the browser as drawn markup. */
const NAV_ICONS: Readonly<Record<NavIcon, LucideIcon>> = {
  'list-checks': ListChecks,
  house: House,
  palette: Palette,
  'user-plus': UserPlus,
  database: Database,
  'users-round': UsersRound,
  package: Package,
  sliders: SlidersHorizontal,
  flag: Flag,
  users: Users,
  settings: Settings,
  'scroll-text': ScrollText,
  info: Info,
};

/**
 * The menu for a role (STORY-01.02 AC-6, SCR-25): the route manifest's implemented rows that are menu entries and allow the
 * role, grouped as the manifest says. An Engineer's menu holds no Admin or Lead item, not even a disabled one. The design
 * system is listed only where its route exists, that is outside a production build.
 */
function navGroups(role: RoleName): ReadonlyArray<NavGroup> {
  const entries = navigationFor(role, { includeHiddenInProduction: isDesignSystemAvailable() });
  return groupNavigation(entries).map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({ label: item.label, href: item.href, icon: <Icon icon={NAV_ICONS[item.icon]} size="large" /> })),
  }));
}

/** The signed-in person as the page frame is told about them: the fields of `AuthenticatedUser` that the frame shows, no more. */
export interface PortalFrameUser {
  readonly name: string;
  readonly email: string;
  readonly role: RoleName;
}

/** What the server layout hands to the client components of the frame (AQP-188 AC-9, NFR-001, NFR-002, BR-003). */
export interface PortalFrameProps {
  readonly navGroups: ReadonlyArray<NavGroup>;
  /** Name, e-mail and role label, for the account menu. */
  readonly account: AccountUser;
}

/**
 * The one place that builds the props of the page frame's client components. Everything that reaches the browser
 * through the frame passes through here, so a field added to `AuthenticatedUser` (the id, `mustChangePassword`)
 * cannot leak into the page by being spread: the output holds only the name, the e-mail, the role label and the role's
 * navigation entries (label, address, icon). `tests/unit/portal-frame-props.test.ts` gives it a user with every field.
 */
export function portalFrameProps(user: PortalFrameUser): PortalFrameProps {
  return {
    navGroups: navGroups(user.role),
    account: { name: user.name, email: user.email, role: roleLabel(user.role) },
  };
}
