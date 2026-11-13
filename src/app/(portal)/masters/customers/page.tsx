import type { Metadata } from 'next';

import { CustomerScreen } from '@/components/features/masters/customer-screen';
import { CUSTOMERS_META_DESCRIPTION } from '@/components/features/masters/customer-texts';
import { getMastersService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

export const metadata: Metadata = { title: 'Customers', description: CUSTOMERS_META_DESCRIPTION };

/**
 * SCR-12 "Customer master", the list (STORY-02.02 AC-1, AC-7, AC-8): the Admin keeps the customers and, on each customer's own page, its rates. The
 * page checks the role first, with its own address, before it reads a customer: a Lead or an Engineer gets SCR-26 "no access" with HTTP 403 and no page
 * data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. The list is read on the server for the first paint; the screen then
 * changes it through `/api/v1/customers`.
 *
 * There is deliberately no `loading.tsx` beside this page: it would wrap the page in a Suspense boundary, so the server would begin to stream the
 * response with status 200 before `forbidden()` runs (TD-06). The "Loading" state of SCR-12 is the list being read again after a change; the first
 * paint already holds the list.
 */
export default async function CustomersPage() {
  await authorizePage('/masters/customers');
  const customers = await getMastersService().listCustomers();
  return <CustomerScreen initialItems={customers} />;
}
