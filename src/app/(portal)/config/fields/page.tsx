import type { Metadata } from 'next';

import { FieldsScreen } from '@/components/features/config/fields-screen';
import { FIELDS_META_DESCRIPTION, FIELDS_TITLE } from '@/components/features/config/fields-texts';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: FIELDS_TITLE, description: FIELDS_META_DESCRIPTION };

/**
 * SCR-17 "Fields and formulas" (STORY-08.01 AC-1, AC-4, AC-5): the Admin and the Lead read every field with its kind and formula. The page checks the role first, with its
 * own address, before it reads anything: an Engineer gets SCR-26 "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in
 * page. A formula and the rate names in it are Restricted (NFR-002), so the page reads none of them: the screen asks `GET /api/v1/config/fields`, which only the Admin and the
 * Lead can call, after it has opened. The page tells the screen only whether to be "View only", which is every role but the Admin.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users page: it would turn the 403 of a refused role into a streamed 200
 * (QLT-72, `tests/security/loading-boundaries.test.ts`). The Loading state of SCR-17 is the screen's own skeleton while it asks the route.
 */
export default async function FieldsAndFormulasPage() {
  const user = await authorizePage('/config/fields');
  return <FieldsScreen viewOnly={user.role !== 'ADMIN'} />;
}
