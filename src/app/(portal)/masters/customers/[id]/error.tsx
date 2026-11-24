'use client';

import { CUSTOMER_PAGE_ERROR_BODY, CUSTOMER_PAGE_ERROR_TITLE, CUSTOMERS_TITLE } from '@/components/features/masters/customer-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-12 "Error" of the customer's page (ux-spec v0.24 and v0.26): the customer could not be loaded. "Try again" asks the server again. */
export default function CustomerPageError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={CUSTOMERS_TITLE} title={CUSTOMER_PAGE_ERROR_TITLE} description={CUSTOMER_PAGE_ERROR_BODY} reset={reset} />;
}
