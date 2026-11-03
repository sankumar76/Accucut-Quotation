import { loadAppEnv } from '@/lib/env';

/**
 * Runs once when the Next.js server starts. A missing or invalid setting stops the server here, with
 * a message that names the variable and never its value (AC-3, architecture section 8).
 * Skipped during `next build`, which has no runtime settings.
 */
export function register(): void {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  if (process.env['NEXT_PHASE'] === 'phase-production-build') return;
  loadAppEnv();
}
