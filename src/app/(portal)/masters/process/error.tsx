'use client';

import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-11 "Error": the rates could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function ProcessMasterError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle="Process master" title="We could not load the rates" reset={reset} />;
}
