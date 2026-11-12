'use client';

import { CustomerLoadError } from '@/components/features/masters/customer-load-error';
import { CUSTOMERS_ERROR_TITLE } from '@/components/features/masters/customer-texts';

/** SCR-12 "Error": the customers could not be loaded. Nothing was changed; "Try again" asks the server again. The customer's page has its own (`[id]/error.tsx`). */
export default function CustomersError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <CustomerLoadError title={CUSTOMERS_ERROR_TITLE} onRetry={reset} />;
}
