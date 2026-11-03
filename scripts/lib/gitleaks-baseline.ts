/**
 * Gitleaks baseline (delivery lead's decision of 2026-11-02, recorded on AQP-27).
 *
 * The baseline accepts exactly the findings listed in it. It is not an allow-list by path or
 * pattern: Gitleaks matches an entry on rule, description, line and column range, file, commit,
 * commit author, e-mail, date and message, and entropy. A new finding, or the same text on another
 * line or in a new commit, matches nothing here and still fails the scan.
 *
 * A Gitleaks report also carries the matched text (`Match`, `Secret`). The baseline never does:
 * this keeps only the location and the commit metadata Gitleaks needs to recognise the finding, so
 * no matched text is stored in the repository. The scan must run with `--redact`, which makes
 * Gitleaks skip those two fields when comparing (detect/baseline.go, v8.30.1).
 */
import { z } from 'zod';

const entrySchema = z.object({
  RuleID: z.string(),
  Description: z.string(),
  StartLine: z.number().int(),
  EndLine: z.number().int(),
  StartColumn: z.number().int(),
  EndColumn: z.number().int(),
  File: z.string(),
  Commit: z.string(),
  Author: z.string(),
  Email: z.string(),
  Date: z.string(),
  Message: z.string(),
  Entropy: z.number(),
  Fingerprint: z.string(),
});

export type BaselineEntry = z.infer<typeof entrySchema>;

/** The only keys a baseline entry may have. `Match` and `Secret` are deliberately absent. */
export const BASELINE_KEYS: ReadonlyArray<string> = Object.keys(entrySchema.shape);

/** Reduces a Gitleaks JSON report (extra keys such as the matched text are dropped) to baseline entries. */
export function toBaseline(report: unknown): BaselineEntry[] {
  return z
    .array(entrySchema)
    .parse(report)
    .sort((a, b) => a.Fingerprint.localeCompare(b.Fingerprint));
}

/** The fingerprint Gitleaks builds for a finding: commit, file, rule and line. */
export function fingerprintOf(entry: Pick<BaselineEntry, 'Commit' | 'File' | 'RuleID' | 'StartLine'>): string {
  return `${entry.Commit}:${entry.File}:${entry.RuleID}:${entry.StartLine}`;
}

/**
 * Entries whose `Fingerprint` does not match their own commit, file, rule and line. Gitleaks matches an
 * entry on those fields and ignores `Fingerprint`, so an entry edited in one place only would accept a
 * different finding than the one its fingerprint names (QLT-11).
 */
export function inconsistentEntries(entries: ReadonlyArray<BaselineEntry>): string[] {
  return entries.filter((entry) => entry.Fingerprint !== fingerprintOf(entry)).map((entry) => entry.Fingerprint);
}
