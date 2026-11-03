import { EnvValidationError, loadAppEnv } from '@/lib/env';

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
    } catch (error) {
      if (error instanceof EnvValidationError) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
  }
}
