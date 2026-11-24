'use client';

import { RouteLoadError } from '@/components/shared/route-load-error';

/** SCR-16 "Error": the first page of the audit log could not be read. Nothing was changed; "Try again" asks the server again. */
export default function AuditError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle="Audit log" title="We could not load the audit log" reset={reset} />;
}
