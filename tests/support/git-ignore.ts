import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * `git check-ignore -v` also reports a path that a negated pattern (`!.env.example`) re-includes, with
 * exit status 0, so the verdict comes from the pattern: a leading `!` means the file is NOT ignored.
 */
export function checkIgnore(path: string): { ignored: boolean; output: string } {
  const result = spawnSync('git', ['check-ignore', '-v', path], { cwd: ROOT, encoding: 'utf8' });
  const negated = /^[^:]+:\d+:!/.test(result.stdout);
  return { ignored: result.status === 0 && !negated, output: result.stdout };
}
