import { ESLint } from 'eslint';

/**
 * Lints source text under the path a rule applies to, without writing a file. Three older lint tests keep a copy of this helper
 * (`layer-rules`, `engineer-import-rule`, `aqp-27-scaffold`; GitHub #259): a new lint test takes it from here.
 */

export interface LintedMessage {
  readonly ruleId: string;
  readonly message: string;
}

export interface LintFixture {
  /** The messages a rule raised for `code` as if it were the file `filePath` (relative to the root). */
  messagesFor(filePath: string, code: string): Promise<LintedMessage[]>;
  /** The IDs of the rules that raised a message (a rule that raised two appears twice). */
  ruleIdsFor(filePath: string, code: string): Promise<string[]>;
}

/**
 * The first lint of a run loads the whole configuration (the Next.js and TypeScript plugins). That is set-up, not the behaviour under
 * test, so a test calls `ruleIdsFor` once in its own `beforeAll` with this limit (test strategy section 10, DL-057; DEF-003).
 */
export const LINT_WARM_UP_TIMEOUT = 180_000;

/** `root` ends with a slash (`fileURLToPath(new URL('../../', import.meta.url))`). */
export function createLintFixture(root: string): LintFixture {
  const eslint = new ESLint({ cwd: root });

  async function messagesFor(filePath: string, code: string): Promise<LintedMessage[]> {
    const absolutePath = `${root}${filePath}`;
    // An ignored path or a fixture that does not parse comes back as `[]` too, which would turn every "allows" test into a no-op (STD-13).
    if (await eslint.isPathIgnored(absolutePath)) throw new Error(`${filePath}: ESLint ignores this path, so the fixture would not be linted`);
    const [result] = await eslint.lintText(code, { filePath: absolutePath });
    if (result === undefined) throw new Error(`${filePath}: ESLint returned no result for the fixture`);
    return result.messages.flatMap(({ ruleId, message, fatal }) => {
      if (fatal === true) throw new Error(`${filePath}: the fixture does not parse: ${message}`);
      return ruleId === null ? [] : [{ ruleId, message }];
    });
  }

  async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
    return (await messagesFor(filePath, code)).map(({ ruleId }) => ruleId);
  }

  return { messagesFor, ruleIdsFor };
}
