import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DL-135 for the Treatment / Color tab (STORY-02.05): focus moves only when a submit is refused. The Add / Rename form has ONE field, so the browser
 * test of the other masters' dialogs (a refusal naming two fields, then typing into the first) cannot be made on it: with one field, the old effect
 * keyed on `errors` finds no refused field after the first key and does nothing visible. The rule is therefore also held at the source: the form takes
 * its focus from the shared `useFocusOnRefusal`, and no effect in the form or in the tab's hook depends on `errors` (or on any object that typing
 * rebuilds). A fault planted back, an effect `[errors]` that focuses a field, is found by `focusEffectsKeyedOnErrors` below (the planted source in
 * the last test), so the guard is shown able to fail.
 */

const MASTERS = join(__dirname, '..', '..', 'src', 'components', 'features', 'masters');
const read = (file: string): string => readFileSync(join(MASTERS, file), 'utf8');

/** The text of every call of `useEffect` in a source, from its open parenthesis to the matching close (strings and comments of these files hold no parenthesis that would upset the count). */
function effectCalls(source: string): string[] {
  const calls: string[] = [];
  let at = source.indexOf('useEffect(');
  while (at !== -1) {
    let depth = 0;
    let index = at + 'useEffect'.length;
    for (; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      if (source[index] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(at, index + 1));
    at = source.indexOf('useEffect(', index);
  }
  return calls;
}

/** Every `useEffect(..., [deps])` of a source whose dependency list names `errors`. */
export function focusEffectsKeyedOnErrors(source: string): string[] {
  return effectCalls(source).filter((call) => {
    const deps = /,\s*\[([^\]]*)\]\s*\)$/.exec(call);
    return deps !== null && /\berrors?\b/.test(deps[1] ?? '');
  });
}

describe('focus moves only on a refusal (DL-135)', () => {
  it('the form takes its focus from the shared useFocusOnRefusal, and the refusal handler is the only caller', () => {
    const form = read('treatment-form-dialog.tsx');
    expect(form).toContain("import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';");
    expect(form.match(/useFocusOnRefusal\(/g)).toHaveLength(1);
    expect(form.match(/showErrors\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each(['treatment-form-dialog.tsx', 'use-treatments.ts', 'treatment-panel.tsx', 'treatment-list.tsx', 'treatment-delete-dialog.tsx'])(
    '%s has no effect keyed on the errors',
    (file) => {
      expect(focusEffectsKeyedOnErrors(read(file))).toEqual([]);
    },
  );

  it('the guard can fail: an effect keyed on errors that moves focus is found', () => {
    const planted = `function useFocusFirstError(errors) {
  useEffect(() => {
    const first = FIELD_NAMES.find((field) => errors[field] !== undefined);
    if (first !== undefined) document.getElementById(FIELD_IDS[first])?.focus();
  }, [errors]);
}
`;
    expect(focusEffectsKeyedOnErrors(planted)).toHaveLength(1);
  });

  it('the guard does not mistake the shared hook\'s own effect (keyed on the request) for a fault', () => {
    expect(focusEffectsKeyedOnErrors(readFileSync(join(MASTERS, '..', '..', 'shared', 'use-focus-on-refusal.ts'), 'utf8'))).toEqual([]);
  });
});
