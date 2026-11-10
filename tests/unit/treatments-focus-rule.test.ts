import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DL-135 for the Treatment / Color tab (STORY-02.05): focus moves only when a submit is refused. The Add / Rename form has ONE field, so the browser
 * test of the other masters' dialogs (a refusal naming two fields, then typing into the first) cannot be made on it: with one field, the old effect
 * keyed on `errors` finds no refused field after the first key and does nothing visible. The rule is therefore also held at the source: the form takes
 * its focus from the shared `useFocusOnRefusal`, and no effect in any file of the tab depends on the errors (a name that ends in `Errors` or is `errors`),
 * or on any object that typing rebuilds. The effect hooks are `useEffect`, `useLayoutEffect` and `useInsertionEffect` (QLT-05 of the G6: not only the
 * first). The files are every `treatment-*` file and `use-treatments.ts` of the folder, not a fixed list, so a new file of the tab is held to it too. A
 * fault planted back, an effect `[errors]` that focuses a field, is found by `focusEffectsKeyedOnErrors` (the planted sources in the last tests), so the
 * guard is shown able to fail. When the form gains a second field, the two-field typing test of Jira 11354 becomes possible and must be added then.
 */

const MASTERS = join(__dirname, '..', '..', 'src', 'components', 'features', 'masters');
const read = (file: string): string => readFileSync(join(MASTERS, file), 'utf8');

/** The files of the tab: every `treatment-*` source and its hook. */
const TAB_FILES = readdirSync(MASTERS).filter((file) => /^(treatment-.*\.tsx?|use-treatments\.ts)$/.test(file));

const EFFECT_HOOKS = ['useEffect(', 'useLayoutEffect(', 'useInsertionEffect('] as const;

/** The text of every call of an effect hook in a source, from its name to the matching close parenthesis (these files hold no parenthesis in a string that would upset the count). */
function effectCalls(source: string): string[] {
  const calls: string[] = [];
  for (const hook of EFFECT_HOOKS) {
    let at = source.indexOf(hook);
    while (at !== -1) {
      let depth = 0;
      let index = at + hook.length - 1;
      for (; index < source.length; index += 1) {
        if (source[index] === '(') depth += 1;
        if (source[index] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      calls.push(source.slice(at, index + 1));
      at = source.indexOf(hook, index);
    }
  }
  return calls;
}

/** Every effect of a source whose dependency list names the errors: `errors`, `fieldErrors`, `formErrors`, and so on. */
export function focusEffectsKeyedOnErrors(source: string): string[] {
  return effectCalls(source).filter((call) => {
    const deps = /,\s*\[([^\]]*)\]\s*\)$/.exec(call);
    return deps !== null && /\b\w*[Ee]rrors?\b/.test(deps[1] ?? '');
  });
}

describe('focus moves only on a refusal (DL-135)', () => {
  it('the form takes its focus from the shared useFocusOnRefusal, and the refusal handler is the only caller', () => {
    const form = read('treatment-form-dialog.tsx');
    expect(form).toContain("import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';");
    expect(form.match(/useFocusOnRefusal\(/g)).toHaveLength(1);
    expect(form.match(/showErrors\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('the guard looks at the whole tab: the form, the panel, the list, the delete dialog, the texts and the hook', () => {
    expect(TAB_FILES).toEqual(
      expect.arrayContaining(['treatment-form-dialog.tsx', 'treatment-panel.tsx', 'treatment-list.tsx', 'treatment-delete-dialog.tsx', 'treatment-texts.ts', 'use-treatments.ts']),
    );
  });

  it.each(TAB_FILES)('%s has no effect keyed on the errors', (file) => {
    expect(focusEffectsKeyedOnErrors(read(file))).toEqual([]);
  });

  it.each(EFFECT_HOOKS)('the guard can fail: %s keyed on errors that moves focus is found', (hook) => {
    const planted = `function useFocusFirstError(errors) {
  ${hook}() => {
    const first = FIELD_NAMES.find((field) => errors[field] !== undefined);
    if (first !== undefined) document.getElementById(FIELD_IDS[first])?.focus();
  }, [errors]);
}
`;
    expect(focusEffectsKeyedOnErrors(planted)).toHaveLength(1);
  });

  it('the guard finds a dependency named like the errors (fieldErrors) and ignores unrelated names', () => {
    expect(focusEffectsKeyedOnErrors('useEffect(() => { focus(); }, [fieldErrors, other]);')).toHaveLength(1);
    expect(focusEffectsKeyedOnErrors('useEffect(() => { focus(); }, [request]);')).toEqual([]);
    expect(focusEffectsKeyedOnErrors('useEffect(() => { focus(); }, [terrorist]);')).toEqual([]);
  });

  it('the guard does not mistake the shared hook\'s own effect (keyed on the request) for a fault', () => {
    expect(focusEffectsKeyedOnErrors(readFileSync(join(MASTERS, '..', '..', 'shared', 'use-focus-on-refusal.ts'), 'utf8'))).toEqual([]);
  });
});
