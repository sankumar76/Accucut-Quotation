import { fileURLToPath } from 'node:url';

import { runProcess } from './process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * `git check-ignore -v` also reports a path that a negated pattern (`!.env.example`) re-includes, with
 * exit status 0, so the verdict comes from the pattern: a leading `!` means the file is NOT ignored.
 * If git does not start, this throws `ProcessStartError` instead of answering "not ignored" (DEF-007).
 */
export function checkIgnore(path: string): { ignored: boolean; output: string } {
  const result = runProcess('git', ['check-ignore', '-v', path], { cwd: ROOT, what: 'git check-ignore' });
  const negated = /^[^:]+:\d+:!/.test(result.stdout);
  return { ignored: result.status === 0 && !negated, output: result.stdout };
}
