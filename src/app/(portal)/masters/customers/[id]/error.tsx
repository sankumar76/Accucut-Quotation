'use client';

import { CustomerLoadError } from '@/components/features/masters/customer-load-error';
import { CUSTOMER_PAGE_ERROR_BODY, CUSTOMER_PAGE_ERROR_TITLE } from '@/components/features/masters/customer-texts';

/** SCR-12 "Error" of the customer's page (ux-spec v0.24 and v0.26): the customer could not be loaded. "Try again" asks the server again. */
export default function CustomerPageError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <CustomerLoadError title={CUSTOMER_PAGE_ERROR_TITLE} description={CUSTOMER_PAGE_ERROR_BODY} onRetry={reset} />;
}
