'use client';

import { ASSIGN_LOAD_ERROR_TITLE, ASSIGN_TITLE } from '@/components/features/tasks/assign-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-04 "Error" (STORY-10.07 AC-4): the Engineers, or the task being changed, could not be read. Nothing was changed; "Try again" asks the server again. */
export default function AssignError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={ASSIGN_TITLE} title={ASSIGN_LOAD_ERROR_TITLE} reset={reset} />;
}
