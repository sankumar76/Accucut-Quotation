import { fileURLToPath } from 'node:url';

import { runProcess } from './process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** `git check-ignore` exit codes: 0 when a pattern matched the path, 1 when none did. */
const GIT_MATCHED = 0;
const GIT_NOT_MATCHED = 1;

/**
 * `git check-ignore -v` also reports a path that a negated pattern (`!.env.example`) re-includes, with
 * exit status 0, so the verdict comes from the pattern: a leading `!` means the file is NOT ignored.
 * If git does not start, this throws `ProcessStartError` instead of answering "not ignored" (DEF-007).
 */
export function checkIgnore(path: string): { ignored: boolean; output: string } {
  const result = runProcess('git', ['check-ignore', '-v', path], { cwd: ROOT, what: 'git check-ignore' });
  // 0 means a pattern matched and 1 means none did. Anything else is git failing (128: a path outside the
  // repository, not a repository at all), which must not pass for "not ignored" (QLT-25).
  if (result.status !== GIT_MATCHED && result.status !== GIT_NOT_MATCHED) {
    throw new Error(`git check-ignore failed with exit code ${result.status}: ${result.stderr.trim()}`);
  }
  const negated = /^[^:]+:\d+:!/.test(result.stdout);
  return { ignored: result.status === 0 && !negated, output: result.stdout };
}
