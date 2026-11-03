/**
 * Writes the Gitleaks baseline from a Gitleaks JSON report, keeping fingerprints and locations only.
 *
 *   gitleaks git --redact --config .gitleaks.toml --report-format json --report-path <report> .
 *   npx tsx scripts/make-gitleaks-baseline.ts --report <report>
 *
 * Review the result before committing: every entry is a finding the delivery lead has accepted.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { toBaseline } from './lib/gitleaks-baseline';

const BASELINE_PATH = '.gitleaks-baseline.json';

const args = process.argv.slice(2);
const index = args.indexOf('--report');
const reportPath = index === -1 ? undefined : args[index + 1];
if (reportPath === undefined) {
  process.stderr.write('Usage: make-gitleaks-baseline.ts --report <gitleaks json report>\n');
  process.exit(2);
}

const entries = toBaseline(JSON.parse(readFileSync(reportPath, 'utf8')));
writeFileSync(BASELINE_PATH, `${JSON.stringify(entries, null, 2)}\n`);
process.stdout.write(`Wrote ${entries.length} entries to ${BASELINE_PATH}.\n`);
