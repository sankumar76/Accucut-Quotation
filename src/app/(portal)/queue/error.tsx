'use client';

import { ERROR_TITLE } from '@/components/features/queues/queue-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-03 "Error": the first page of the queue could not be read. Nothing was changed; "Try again" asks the server again. */
export default function QueueError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle="Tasks" title={ERROR_TITLE} reset={reset} />;
}
