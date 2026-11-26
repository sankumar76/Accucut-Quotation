import type { Instrumentation } from 'next';

import { EnvValidationError, loadAppEnv, loadExportEnv } from '@/lib/env';

/**
 * Runs once when the Next.js server starts. A missing or invalid setting stops the server here (AC-3,
 * architecture section 8): one line to stderr names the variables, never a value, and the process exits
 * with code 1, so a supervisor sees a failed start. Throwing would not do it: Next.js catches an error
 * from this hook and keeps answering HTTP 500 (DEF-001). Any other error is re-thrown unchanged.
 * Skipped during `next build`, which has no runtime settings, and on the Edge runtime. It is `async` only for the dynamic imports below: the exit of the first check is made before any `await`, so it is as immediate as ever.
 *
 * `process.env.NEXT_RUNTIME` is written with dot access on purpose: Next.js replaces that exact form at
 * build time, so the Node-only calls inside the branch are dropped from the Edge bundle and the build
 * prints no Edge-runtime warning.
 */
export async function register(): Promise<void> {
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
    // A production server whose export thread bundle is missing says so once, here (DEF-130), as one structured `error` record with the code `EXPORT_THREAD_MISSING`. It does not stop the start: everything but Download works, and nothing in this
    // block may stop it (a throw here would keep the whole portal answering 500, the DEF-001 behaviour above). Both modules are loaded here, on the Node branch, because `thread-runner` imports `node:fs`, `node:path` and
    // `node:worker_threads`, which a static import would compile into the Edge bundle and print as three build warnings (QLT-799-01).
    if (process.env.NODE_ENV === 'production') {
      try {
        const { exportThreadProblem } = await import('@/server/export/thread-runner');
        const problem = exportThreadProblem(process.cwd());
        if (problem !== null) {
          const { logger } = await import('@/lib/logger');
          logger.error({ code: 'EXPORT_THREAD_MISSING' }, problem);
        }
      } catch {
        // The check must never stop the start.
      }
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
