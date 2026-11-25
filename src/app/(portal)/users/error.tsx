'use client';

import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-14 "Error": the list could not be loaded. Nothing was changed; "Try again" asks the server again. */
export default function UsersError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle="Users" title="We could not load users" reset={reset} />;
}
