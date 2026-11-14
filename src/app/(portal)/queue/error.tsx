'use client';

import { RotateCcw } from 'lucide-react';

import { ERROR_RETRY, ERROR_TITLE } from '@/components/features/queues/queue-texts';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-03 "Error": the first page of the queue could not be read. Nothing was changed; "Try again" asks the server again. */
export default function QueueError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title="Tasks" />
      <Card>
        <ErrorState
          title={ERROR_TITLE}
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
