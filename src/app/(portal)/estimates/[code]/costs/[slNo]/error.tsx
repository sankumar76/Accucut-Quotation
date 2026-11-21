'use client';

import {
  COST_DETAILS_LOAD_ERROR_HEADER,
  COST_DETAILS_LOAD_ERROR_TITLE,
} from '@/components/features/estimate-workspace/estimate-load-error-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-07 "Error" (STORY-10.07 AC-4): the cost details could not be read. A read changes nothing; "Try again" asks the server again. It imports no file of the Restricted folder of the screen (NFR-002). */
export default function CostDetailsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={COST_DETAILS_LOAD_ERROR_HEADER} title={COST_DETAILS_LOAD_ERROR_TITLE} reset={reset} />;
}
