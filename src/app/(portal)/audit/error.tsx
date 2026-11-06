'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-16 "Error": the first page of the audit log could not be read. Nothing was changed; "Try again" asks the server again. */
export default function AuditError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title="Audit log" />
      <Card>
        <ErrorState
          title="We could not load the audit log"
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
