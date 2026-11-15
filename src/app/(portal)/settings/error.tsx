'use client';

import { RotateCcw } from 'lucide-react';

import { ERROR_RETRY, ERROR_TITLE, SETTINGS_TITLE } from '@/components/features/settings/texts';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** SCR-15 "Error": the status of the backups could not be read. Nothing was changed; "Try again" asks the server again. */
export default function SettingsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <>
      <PageHeader title={SETTINGS_TITLE} />
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
