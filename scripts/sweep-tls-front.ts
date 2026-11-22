/**
 * Starts the TLS front of the sweep (STORY-10.08, AQP-370; see `scripts/lib/tls-front.ts` for why). `playwright.sweep.config.ts` runs it as the second web server: it listens on the portal's
 * own port (`SWEEP_TLS_PORT`) with HTTPS and passes every request to `next start` on `SWEEP_UPSTREAM_PORT`. It runs until it is stopped.
 *
 * Usage: SWEEP_TLS_PORT=3100 SWEEP_UPSTREAM_PORT=3198 npx tsx scripts/sweep-tls-front.ts
 */
import { ensureSelfSignedCertificate, startTlsFront } from './lib/tls-front';

const CERTIFICATE_FOLDER = 'test-results/sweep-tls';
const FIRST_UNPRIVILEGED_PORT = 1024;
const LAST_PORT = 65_535;

function portFrom(name: string): number {
  const port = Number(process.env[name]);
  if (!Number.isInteger(port) || port < FIRST_UNPRIVILEGED_PORT || port > LAST_PORT) throw new Error(`${name} must be a port number from ${FIRST_UNPRIVILEGED_PORT} to ${LAST_PORT}.`);
  return port;
}

async function run(): Promise<void> {
  const port = portFrom('SWEEP_TLS_PORT');
  const upstreamPort = portFrom('SWEEP_UPSTREAM_PORT');
  if (port === upstreamPort) throw new Error('SWEEP_TLS_PORT and SWEEP_UPSTREAM_PORT must differ.');
  const server = await startTlsFront({ port, upstreamPort, material: ensureSelfSignedCertificate(CERTIFICATE_FOLDER) });
  process.stdout.write(`The sweep's TLS front listens on https://localhost:${port} and passes to http://127.0.0.1:${upstreamPort}\n`);
  const stop = (): void => {
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

run().catch((error: unknown) => {
  process.stderr.write(`The sweep's TLS front did not start: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
  process.exitCode = 1;
});
