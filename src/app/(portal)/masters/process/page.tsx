import type { Metadata } from 'next';

import { ProcessScreen } from '@/components/features/masters/process-screen';
import { getMastersService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Process master', description: 'Manage the default process rates used in every cost calculation.' };

/**
 * SCR-11 "Process master" (STORY-02.01 AC-1, AC-6, AC-8): the Admin adds, changes and deletes the named rates the calculation
 * uses. The page checks the role first, with its own address, before it reads a rate: a Lead or an Engineer gets SCR-26 "no
 * access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. The list is read
 * on the server for the first paint; the screen then changes it through `/api/v1/process-items`.
 *
 * There is deliberately no `loading.tsx` beside this page: it would wrap the page in a Suspense boundary, so the server would
 * begin to stream the response with status 200 before `forbidden()` runs (found for `/users` by the production-build test, TD-06).
 * The "Loading" state of SCR-11 is the list being read again after a change; the first paint already holds the list.
 */
export default async function ProcessMasterPage() {
  await authorizePage('/masters/process');
  const items = await getMastersService().listProcessItems();
  return <ProcessScreen initialItems={items} />;
}
