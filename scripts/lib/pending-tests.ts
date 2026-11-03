/**
 * Scanner for pending tests (test strategy section 5.6, control 4).
 *
 * A quantity test that is skipped, pending, expected to fail or focused with `.only` would let a wrong
 * price reach G7 unseen. This finds those markers in test source text. It is strict on purpose: a
 * comment that mentions one is reported too, and the author rewords it.
 */

const MODIFIER_CALL = /\.(todo|skip|skipIf|fails|only)\b/;
const MODIFIER_OPTION = /\b(todo|skip|only|fails)\s*:\s*true\b/;

export interface PendingTestFinding {
  readonly line: number;
  readonly text: string;
}

export function findPendingTests(source: string): PendingTestFinding[] {
  return source.split(/\r?\n/).flatMap((text, index) =>
    MODIFIER_CALL.test(text) || MODIFIER_OPTION.test(text) ? [{ line: index + 1, text: text.trim() }] : [],
  );
}
