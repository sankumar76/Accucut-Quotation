'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-14 "Error": the list could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function UsersError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title="Users" />
      <Card>
        <ErrorState
          title="We could not load users"
          focusOnMount
          action={
            <Button onClick={reset}>
              <Icon icon={RotateCcw} />
              Try again
            </Button>
          }
        />
      </Card>
    </>
  );
}
