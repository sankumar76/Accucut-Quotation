'use client';

import { RotateCcw } from 'lucide-react';

import { MASTERS_TITLE, MATERIALS_ERROR_TITLE } from '@/components/features/masters/material-texts';
import { ERROR_RETRY } from '@/components/features/masters/process-texts';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-13 "Error": the materials could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function MaterialsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title={MASTERS_TITLE} />
      <Card>
        <ErrorState
          title={MATERIALS_ERROR_TITLE}
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
