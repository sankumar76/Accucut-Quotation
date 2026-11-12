'use client';

import { RotateCcw } from 'lucide-react';

import { CUSTOMERS_ERROR_TITLE, CUSTOMERS_TITLE } from '@/components/features/masters/customer-texts';
import { ERROR_RETRY } from '@/components/features/masters/master-texts';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-12 "Error": the customers could not be loaded. Nothing was changed; "Try again" asks the server again. It covers the list and the edit page. */
export default function CustomersError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title={CUSTOMERS_TITLE} />
      <Card>
        <ErrorState
          title={CUSTOMERS_ERROR_TITLE}
          focusOnMount
          action={
            <Button onClick={reset}>
              <Icon icon={RotateCcw} />
              {ERROR_RETRY}
            </Button>
          }
        />
      </Card>
    </>
  );
}
