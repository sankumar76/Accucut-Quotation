import type { Instrumentation } from 'next';

import { EnvValidationError, loadAppEnv, loadExportEnv } from '@/lib/env';
import { exportThreadProblem } from '@/server/export/thread-runner';

/**
 * Runs once when the Next.js server starts. A missing or invalid setting stops the server here (AC-3,
 * architecture section 8): one line to stderr names the variables, never a value, and the process exits
 * with code 1, so a supervisor sees a failed start. Throwing would not do it: Next.js catches an error
 * from this hook and keeps answering HTTP 500 (DEF-001). Any other error is re-thrown unchanged.
 * Skipped during `next build`, which has no runtime settings, and on the Edge runtime.
 *
 * `process.env.NEXT_RUNTIME` is written with dot access on purpose: Next.js replaces that exact form at
 * build time, so the Node-only calls inside the branch are dropped from the Edge bundle and the build
 * prints no Edge-runtime warning.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      loadAppEnv();
      // The export time limit is read when the first export is asked for; a bad value stops the start here, not at that moment (ADR-017).
      loadExportEnv();
    } catch (error) {
      if (error instanceof EnvValidationError) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
    // A production server whose export thread bundle is missing says so once, here (DEF-130). It does not stop the start: everything but Download works.
    if (process.env.NODE_ENV === 'production') {
      const problem = exportThreadProblem(process.cwd());
      if (problem !== null) process.stderr.write(`${problem}\n`);
    }
  }
}

/**
 * Called by Next.js for every error it catches while serving a request that no `withRoute` caught: a page or a server component that throws while rendering, a server action, a route
 * handler outside `withRoute` (STORY-10.09a AC-2, AC-9; NFR-024). It writes one `error` line with the time, a request ID, the route's pattern, the method, the class of the error and the
 * user ID, which it reads from the session cookie's token with no database read (`src/server/observability/request-error.ts` says what the line holds and what it never does). The
 * person still sees the existing error page: this hook only writes the line, and it can never throw into the framework.
 *
 * The Node-only code sits behind the same `process.env.NEXT_RUNTIME === 'nodejs'` form as `register()`, so it is dropped from the Edge bundle. The import is dynamic for the same reason.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { logRequestError, productionRequestErrorDependencies } = await import('@/server/observability/request-error');
      await logRequestError(error, request, context, productionRequestErrorDependencies());
    } catch {
      // Nothing is printed: the error is already the framework's to report, and a failure here must not replace it.
    }
  }
};
