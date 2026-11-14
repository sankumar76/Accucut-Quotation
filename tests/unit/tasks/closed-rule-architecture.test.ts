import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-04.05 AC-4 (architecture section 4.4; review SQR-02): there is one rule for "this task is closed", `isTaskClosed` in `src/lib/estimate/task-status.ts`, and no stored
 * open/closed column. This is the grep the story asks for:
 *   - in the code that decides a tab (`src/lib/tasks`, the queue components, the task service, the task view schema) the word `APPROVED` is not compared or filtered on;
 *   - the one other place that may name it is the repository's SQL form of the rule, the `tabFilter` function, which filters on `estimates.status` and is held to the
 *     TypeScript rule by `tests/integration/tasks/close-reopen.test.ts`;
 *   - `isTaskClosed` is written once under `src`;
 *   - the Prisma schema and the migrations have no open/closed column on `tasks` or `estimates`.
 * Comments are stripped before the search, so a sentence that explains the rule is not a second implementation.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function filesUnder(directory: string): string[] {
  return readdirSync(join(ROOT, directory)).flatMap((name) => {
    const path = `${directory}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

/** The source without block and line comments (and without the text of a string that only says `//`, which these files do not have). */
const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** A comparison with, or a filter on, the status that closes a task: `=== 'APPROVED'`, `!== 'APPROVED'`, `status: 'APPROVED'`, `not: 'APPROVED'`, `case 'APPROVED'`. */
const APPROVED_TEST = /(?:[!=]==?\s*'APPROVED'|'APPROVED'\s*[!=]==?|\bnot:\s*'APPROVED'|\bstatus:\s*'APPROVED'|\bcase\s+'APPROVED')/;

const TAB_DECIDING_CODE = [
  ...filesUnder('src/lib/tasks'),
  ...filesUnder('src/components/features/queues'),
  'src/server/services/task-service.ts',
  'src/server/views/schemas/tasks.ts',
  'src/components/shared/status-badge.tsx',
];

describe('AC-4: no second implementation of "is closed"', () => {
  it('finds the files it is meant to search', () => {
    expect(TAB_DECIDING_CODE).toEqual(expect.arrayContaining(['src/lib/tasks/task-state.ts', 'src/components/features/queues/overdue-marker.tsx', 'src/server/services/task-service.ts']));
  });

  it.each(TAB_DECIDING_CODE)('%s does not compare or filter on APPROVED', (path) => {
    expect(withoutComments(read(path))).not.toMatch(APPROVED_TEST);
  });

  it("the repository names APPROVED only in `tabFilter`, the SQL form of the one rule", () => {
    const source = withoutComments(read('src/server/repositories/task-repository.ts'));
    const start = source.indexOf('function tabFilter(');
    const end = source.indexOf('\nfunction afterFilter(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const outside = source.slice(0, start) + source.slice(end);
    expect(outside).not.toMatch(APPROVED_TEST);
    expect(source.slice(start, end)).toMatch(APPROVED_TEST);
  });

  it('writes `isTaskClosed` once under src, and `taskTab` builds on it', () => {
    const definitions = filesUnder('src')
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => /(?:function|const)\s+isTaskClosed\b/.test(withoutComments(read(path))));
    expect(definitions).toEqual(['src/lib/estimate/task-status.ts']);
    expect(withoutComments(read('src/lib/tasks/task-state.ts'))).toContain('isTaskClosed(');
  });
});

describe('AC-4: no stored open/closed column', () => {
  const MODELS = /model\s+(Task|Estimate)\s*\{[^}]*\}/g;

  it('the Prisma schema has no column of the task or the estimate that says open or closed', () => {
    const models = [...read('prisma/schema.prisma').matchAll(MODELS)].map((match) => match[0]);
    expect(models).toHaveLength(2);
    for (const model of models) {
      expect(model).not.toMatch(/^\s*(?:is_?closed|closed(?:_?at)?|is_?open|open(?:_?at)?|task_?state|task_?tab)\b/im);
    }
  });

  it('no migration adds one', () => {
    const migrations = filesUnder('prisma/migrations').filter((path) => path.endsWith('.sql'));
    expect(migrations.length).toBeGreaterThan(0);
    for (const path of migrations) {
      expect(read(path), path).not.toMatch(/\b(?:is_closed|closed_at|is_open|task_state|task_tab)\b/i);
    }
  });
});
