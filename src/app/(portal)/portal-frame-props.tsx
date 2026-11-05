import { House, ListChecks, Palette } from 'lucide-react';

import type { AccountUser } from '@/components/shared/account-trigger';
import { Icon } from '@/components/shared/icon';
import type { NavGroup } from '@/components/shared/nav';
import { queueTitleFor, roleLabel, type RoleName } from '@/lib/auth/roles';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';

/**
 * The menu until the role-specific menus arrive (STORY-01.02, SCR-25). The task queue is the one page every
 * role lands on after signing in (STORY-01.01 AC-1). The design system is listed only where its route exists, that
 * is outside a production build.
 */
function navGroups(role: RoleName): ReadonlyArray<NavGroup> {
  const work: NavGroup = {
    label: 'Work',
    items: [
      { label: queueTitleFor(role), href: '/queue', icon: <Icon icon={ListChecks} size="large" /> },
      { label: 'Home', href: '/', icon: <Icon icon={House} size="large" /> },
    ],
  };
  const review: NavGroup = {
    label: 'Review',
    items: [{ label: 'Design system', href: '/design-system', icon: <Icon icon={Palette} size="large" /> }],
  };
  return isDesignSystemAvailable() ? [work, review] : [work];
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
