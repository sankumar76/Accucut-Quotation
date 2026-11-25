'use client';

import { MASTERS_TITLE, MATERIALS_ERROR_TITLE } from '@/components/features/masters/material-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-13 "Error": the materials could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function MaterialsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={MASTERS_TITLE} title={MATERIALS_ERROR_TITLE} reset={reset} />;
}
