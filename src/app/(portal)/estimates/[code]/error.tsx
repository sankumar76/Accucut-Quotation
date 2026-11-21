'use client';

import {
  ESTIMATE_LOAD_ERROR_BODY,
  ESTIMATE_LOAD_ERROR_HEADER,
  ESTIMATE_LOAD_ERROR_TITLE,
} from '@/components/features/estimate-workspace/estimate-load-error-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/**
 * SCR-05 and SCR-06 "Error" (STORY-10.07 AC-4): the estimate could not be read. Its sentence does not say that nothing was changed, because the review reads
 * the page again after an approval or a calculation that went through. The cost details and the export have their own boundaries below this one.
 */
export default function EstimateError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={ESTIMATE_LOAD_ERROR_HEADER} title={ESTIMATE_LOAD_ERROR_TITLE} description={ESTIMATE_LOAD_ERROR_BODY} reset={reset} />;
}
