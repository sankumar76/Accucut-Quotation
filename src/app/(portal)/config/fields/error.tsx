'use client';

import { RotateCcw } from 'lucide-react';

import { ERROR_RETRY, ERROR_TITLE, FIELDS_TITLE } from '@/components/features/config/fields-texts';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-17 "Error": the page itself could not be built (the list's own read failing is the screen's state). Nothing was changed; "Try again" asks the server again. */
export default function FieldsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title={FIELDS_TITLE} />
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
