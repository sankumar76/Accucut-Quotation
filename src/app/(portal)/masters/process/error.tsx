'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-11 "Error": the rates could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function ProcessMasterError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title="Process master" />
      <Card>
        <ErrorState
          title="We could not load the rates"
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
