import type { Metadata } from 'next';

import { AuditScreen } from '@/components/features/audit/audit-screen';
import { AUDIT_DEFAULT_LIMIT } from '@/lib/audit/categories';
import { getAuditService, getUserService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Audit log', description: 'A permanent record of who changed what and when.' };

/**
 * SCR-16 "Audit log" (STORY-01.07 AC-6, AC-7, AC-8): the Admin reads the record of changes and filters it. The page checks the
 * role first, with its own address, before it reads anything: a Lead or an Engineer gets SCR-26 "no access" with HTTP 403 and no
 * page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. The first page of entries and the people
 * for the Who list are read on the server for the first paint; the screen then asks `/api/v1/audit` when a filter changes.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users page: it would turn the 403 of a
 * refused role into a streamed 200 (QLT-72, `tests/security/loading-boundaries.test.ts`). The "Loading" state of SCR-16 is a
 * filter being read again, which the screen marks `aria-busy` without leaving the page.
 */
export default async function AuditPage() {
  await authorizePage('/audit');
  const [initialPage, users] = await Promise.all([getAuditService().list({ limit: AUDIT_DEFAULT_LIMIT }), getUserService().list()]);
  // Only the ID and the name of a person reach the browser: no e-mail address, role or flag.
  const people = users.map(({ id, name }) => ({ id, name }));
  return <AuditScreen initialPage={initialPage} people={people} />;
}
