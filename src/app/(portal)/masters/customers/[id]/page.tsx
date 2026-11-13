import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CustomerEditScreen } from '@/components/features/masters/customer-edit-screen';
import { CUSTOMERS_META_DESCRIPTION } from '@/components/features/masters/customer-texts';
import { NotFoundError } from '@/lib/errors';
import { getMastersService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';

/** No customer name in the tab title (architecture section 8, FR-089: no customer name may enter any `<title>` or tag). */
export const metadata: Metadata = { title: 'Customer', description: CUSTOMERS_META_DESCRIPTION };

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * SCR-12 "Customer master", the edit page (STORY-02.02 AC-1 to AC-3, AC-7, AC-8): a customer's details and its rate for every Process Master item, with
 * Reset to defaults. The page checks the role first, with its own address, before it reads the customer, so a real ID and an invented one are refused
 * alike (CR-33). An ID that is no listed customer is SCR-26 "not found". The customer is read on the server for the first paint; the screen then changes
 * it through `/api/v1/customers/{id}` and shows the customer the server answered with.
 */
export default async function CustomerPage({ params }: PageProps) {
  await authorizePage('/masters/customers/[id]');
  const { id } = await params;
  const customer = await getMastersService()
    .getCustomer(id)
    .catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    });
  return <CustomerEditScreen initial={customer} />;
}
