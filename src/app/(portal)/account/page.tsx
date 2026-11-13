import type { Metadata } from 'next';

import { AccountScreen } from '@/components/features/account/account-screen';
import { roleLabel } from '@/lib/auth/roles';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Your account', description: 'View your account details and change your password.' };

/**
 * SCR-23 "Account" (STORY-01.05 AC-3, AC-5, AC-7): every signed-in role. It is the one page open to a person who has to set a new password
 * (`mustChangeAllowed` in the route manifest): every other page sends them here, and this page then shows "Set a new password" with no
 * profile card. Only the fields the screen shows are handed to it (the name, the e-mail, the role label and the flag), never the whole
 * user.
 */
export default async function AccountPage() {
  const user = await authorizePage('/account');
  return <AccountScreen name={user.name} email={user.email} roleLabel={roleLabel(user.role)} mustChange={user.mustChangePassword} />;
}
