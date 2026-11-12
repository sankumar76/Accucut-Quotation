'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { CUSTOMERS_TITLE } from './customer-texts';
import { ERROR_RETRY } from './master-texts';

/**
 * SCR-12 "Error" (ux-spec v0.24 and v0.26): the page header `Customers` and the error state with focus on its title and a Try again button. The list and
 * the customer's page each have their own `error.tsx` and their own title; the rest is this one block. `description` is the sentence under the title; the
 * state's standard sentence ("Nothing was changed.", true of a read) is used when it is left out.
 */
export function CustomerLoadError({ title, description, onRetry }: Readonly<{ title: string; description?: string; onRetry: () => void }>) {
  return (
    <>
      <PageHeader title={CUSTOMERS_TITLE} />
      <Card>
        <ErrorState
          title={title}
          {...(description === undefined ? {} : { description })}
          focusOnMount
          action={
            <Button onClick={onRetry}>
              <Icon icon={RotateCcw} />
              {ERROR_RETRY}
            </Button>
          }
        />
      </Card>
    </>
  );
}
