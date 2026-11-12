'use client';

import { CustomerLoadError } from '@/components/features/masters/customer-load-error';
import { CUSTOMER_PAGE_ERROR_TITLE } from '@/components/features/masters/customer-texts';

/** SCR-12 "Error" of the customer's page (ux-spec v0.24): the customer could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function CustomerPageError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <CustomerLoadError title={CUSTOMER_PAGE_ERROR_TITLE} onRetry={reset} />;
}
