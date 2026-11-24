'use client';

import { CUSTOMERS_ERROR_TITLE, CUSTOMERS_TITLE } from '@/components/features/masters/customer-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-12 "Error": the customers could not be loaded. Nothing was changed; "Try again" asks the server again. The customer's page has its own (`[id]/error.tsx`). */
export default function CustomersError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={CUSTOMERS_TITLE} title={CUSTOMERS_ERROR_TITLE} reset={reset} />;
}
