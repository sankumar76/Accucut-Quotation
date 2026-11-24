'use client';

import { ERROR_TITLE, SETTINGS_TITLE } from '@/components/features/settings/texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-15 "Error": the status of the backups could not be read. Nothing was changed; "Try again" asks the server again. */
export default function SettingsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={SETTINGS_TITLE} title={ERROR_TITLE} reset={reset} />;
}
