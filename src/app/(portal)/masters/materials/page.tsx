import type { Metadata } from 'next';

import { MastersScreen } from '@/components/features/masters/masters-screen';
import { getMastersService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = {
  title: 'Materials and lists',
  description: 'Manage materials and exchange rates used in estimates.',
};

/**
 * SCR-13 "Materials and lists" (STORY-02.03 AC-1, AC-6, AC-8): the Admin keeps the materials the estimate form offers. The page checks the
 * role first, with its own address, before it reads a material: a Lead or an Engineer gets SCR-26 "no access" with HTTP 403 and no page
 * data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. The list is read on the server for the first paint; the
 * screen then changes it through `/api/v1/materials`. The Exchange rates tab (story 02.04) is not read here: it loads on its first opening and reads
 * `/api/v1/exchange-rates` itself (PRF-01, NFR-009). The Treatment / Color tab joins in story 02.05. The description and the meta name only the tabs in
 * the bar (ux-spec v0.18 "The page description until Exchange rates and Treatment / Color exist").
 *
 * There is deliberately no `loading.tsx` beside this page: it would wrap the page in a Suspense boundary, so the server would begin to
 * stream the response with status 200 before `forbidden()` runs (TD-06). The "Loading" state of SCR-13 is the list being read again after
 * a change; the first paint already holds the list.
 */
export default async function MaterialsPage() {
  await authorizePage('/masters/materials');
  const materials = await getMastersService().listMaterials();
  return <MastersScreen initialMaterials={materials} />;
}
