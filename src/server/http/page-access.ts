import 'server-only';

import { forbidden } from 'next/navigation';

import { requireUserOrRedirect, type AuthenticatedUser } from '../auth/session';

import { allowsRole, findPage } from './route-manifest';

/**
 * The access check of every page (STORY-01.02 AC-4; architecture section 8, layer 1). The page calls it first, with its
 * own address as written in the manifest: `const user = await authorizePage('/queue');`. It does not rely on the layout,
 * which checks only that someone is signed in (STD-09), and an architecture test fails a page that does not call it.
 *
 *   - signed out: a redirect to the sign-in page that remembers the address;
 *   - a role the row does not list: `forbidden()`, which renders SCR-26 "no access" with status 403. The check runs
 *     before the page reads anything, so the answer cannot depend on what the page holds (CR-33, UX-22);
 *   - otherwise the signed-in person.
 */
export async function authorizePage(path: string): Promise<AuthenticatedUser> {
  const row = findPage(path);
  if (row === undefined) throw new Error(`authorizePage: ${path} is not a page in the route manifest.`);
  if (row.roles === 'public') throw new Error(`authorizePage: ${path} is a public page and needs no session.`);
  const user = await requireUserOrRedirect();
  if (!allowsRole(row, user.role)) forbidden();
  return user;
}
