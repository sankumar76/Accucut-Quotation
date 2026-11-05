import type { Metadata } from 'next';

import { UsersScreen } from '@/components/features/users/users-screen';
import { getUserService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Users', description: 'Manage portal users, roles and passwords.' };

/**
 * SCR-14 "Users" (STORY-01.04 AC-1, AC-6, AC-7): the Admin adds, edits, deactivates and re-activates people and resets their
 * passwords. The page checks the role first, with its own address, before it reads anyone: a Lead or an Engineer gets SCR-26
 * "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page.
 * The list is read on the server for the first paint; the screen then changes it through `/api/v1/users`.
 *
 * There is deliberately no `loading.tsx` beside this page. It would wrap the page in a Suspense boundary, so the server would
 * begin to stream the response with status 200 before `forbidden()` runs, and a Lead or an Engineer would get the "no access"
 * page with HTTP 200 and not 403 (found by the production-build test, TD-06, `tests/e2e/users-production.spec.ts`). The
 * "Loading" state of SCR-14 is the list being read again after a change, which the screen marks `aria-busy` without leaving
 * the page; the first paint already holds the list.
 */
export default async function UsersPage() {
  const user = await authorizePage('/users');
  const users = await getUserService().list();
  return <UsersScreen initialUsers={users} currentUserId={user.id} />;
}
