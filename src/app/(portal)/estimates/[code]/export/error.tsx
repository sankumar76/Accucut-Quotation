'use client';

import { EXPORT_LOAD_ERROR_HEADER, EXPORT_LOAD_ERROR_TITLE } from '@/components/features/estimate-workspace/estimate-load-error-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-10 "Error" (STORY-10.07 AC-4): the summary of the export could not be read. A read changes nothing; "Try again" asks the server again. It imports no file of the Restricted folder of the screen (NFR-002). */
export default function ExportError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={EXPORT_LOAD_ERROR_HEADER} title={EXPORT_LOAD_ERROR_TITLE} reset={reset} />;
}
