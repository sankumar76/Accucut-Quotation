'use client';

import { ERROR_TITLE, FIELDS_TITLE } from '@/components/features/config/fields-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-17 "Error": the page itself could not be built (the list's own read failing is the screen's state). Nothing was changed; "Try again" asks the server again. */
export default function FieldsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={FIELDS_TITLE} title={ERROR_TITLE} reset={reset} />;
}
