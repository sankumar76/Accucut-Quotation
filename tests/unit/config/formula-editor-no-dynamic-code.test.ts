import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-08.02 AC-3: no `eval` and no `new Function` anywhere, a formula is only ever read by the tokenizer and the parser of `lib/formula`. This is the story's own search, over the files the story added and, so the
 * claim is about the product and not about four files, over the whole of `src`. The older search over the engine, the scripts and the seed is `tests/unit/formula/server-only.test.ts`. Comment lines are not code, so
 * a sentence that says "no eval" is not a fault.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SRC = join(ROOT, 'src');

const STORY_FILES = [
  'src/lib/config/formula-edit.ts',
  'src/lib/config/formula-preview.ts',
  'src/lib/config/formula-words.ts',
  'src/lib/config/formula-suggestions.ts',
  'src/lib/config/formula-editor-client.ts',
  'src/server/services/config-edit-service.ts',
  'src/server/views/schemas/config-edit.ts',
  'src/app/api/v1/config/formula-check/route.ts',
  'src/app/api/v1/config/sample-rows/route.ts',
  'src/app/api/v1/config/fields/[id]/formula/route.ts',
  'src/components/features/config/formula-editor.tsx',
  'src/components/features/config/formula-editor-screen.tsx',
  'src/components/features/config/formula-preview.tsx',
  'src/components/features/config/formula-password-dialog.tsx',
  'src/components/features/config/suggestions.tsx',
  'src/components/features/config/use-formula-check.ts',
  'src/components/features/config/use-save-formula.ts',
];

/** The lines of a file that are code: not blank, not a line comment, and not a line inside or on a block comment. */
function codeLines(text: string): string[] {
  const lines: string[] = [];
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true;
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    lines.push(trimmed);
  }
  return lines;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !path.includes(`${join('src', 'generated')}`) ? [path] : [];
  });
}

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['eval()', /(^|[^\w.])eval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['Function()', /(^|[^\w.])Function\s*\(/],
  ['a string passed to setTimeout', /\bsetTimeout\s*\(\s*['"`]/],
  ['import() of a computed path', /\bimport\s*\(\s*[^'"\s)]/],
];

describe('AC-3: nothing runs text as code', () => {
  it('the search finds each fault when one is planted, and ignores a comment and a method called eval', () => {
    const planted = ["const x = eval('1');", "const f = new Function('return 1');", "const g = Function('return 1');", "setTimeout('run()', 10);", 'const m = await import(name);'];
    for (const [name, pattern] of FORBIDDEN) expect(planted.some((line) => pattern.test(line)), name).toBe(true);
    expect(codeLines('/** no eval( here */\n// new Function\nconst a = 1;')).toEqual(['const a = 1;']);
    expect(FORBIDDEN.some(([, pattern]) => pattern.test('engine.eval(1);'))).toBe(false);
  });

  it.each(FORBIDDEN)('the files of the story hold 0 uses of %s', (_name, pattern) => {
    const offenders = STORY_FILES.filter((file) => codeLines(readFileSync(join(ROOT, file), 'utf8')).some((line) => pattern.test(line)));
    expect(offenders).toEqual([]);
  });

  it.each(FORBIDDEN)('the whole source tree holds 0 uses of %s', (_name, pattern) => {
    const offenders = sourceFiles(SRC)
      .filter((file) => codeLines(readFileSync(file, 'utf8')).some((line) => pattern.test(line)))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('searches every file the story added: each exists and is read', () => {
    expect(STORY_FILES.every((file) => readFileSync(join(ROOT, file), 'utf8').length > 0)).toBe(true);
  });
});
