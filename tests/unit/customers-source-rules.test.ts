import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DL-153 (GitHub issue 245) for the Customers list (STORY-02.02): "no story copies a list hook". The list body is the items, the query, the status, the
 * delayed skeleton (`useAfterDelay`, 300 ms) and the read and refresh of a list, and it lives in `useMasterList`. A Customers hook that keeps its own state for any of
 * them, with its own refresh, is the copy, whatever it imports. The rule is held at the source: `use-customers.ts` calls `useMasterList` once, takes the
 * focus after a read from `useReadAgain`, and none of the Customers files holds the pieces of a list body. A fault planted back, a hook with its own
 * `useState` for the items and its own skeleton, is found by `listBodyCopies` (the planted sources in the last tests), so the guard is shown able to fail.
 *
 * The files are every `customer-*` file and the two Customers hooks of the folder, not a fixed list, so a new file is held to the rule too.
 */

const MASTERS = join(__dirname, '..', '..', 'src', 'components', 'features', 'masters');
const read = (file: string): string => readFileSync(join(MASTERS, file), 'utf8');

const FILES = readdirSync(MASTERS).filter((file) => /^(customer-.*\.tsx?|use-customers\.ts|use-customer-edit\.ts)$/.test(file));

/** What a list body is made of, as it is written when a hook keeps its own: the state of the rows and of the status, the delayed skeleton and the newest-read counter. */
const LIST_BODY_PIECES: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ['state for the rows', /useState<(?:ReadonlyArray|readonly)\b/],
  ['state for the read status', /useState<ReadStatus>/],
  ['the delayed skeleton', /\buseAfterDelay\b/],
  ['the skeleton delay', /\bSKELETON_DELAY_MS\b/],
  ['a counter of the newest read', /\bnewest\b/],
  ['its own call to the list read', /\blistCustomers\(\)/],
];

/** The pieces of a list body found in a source. */
export function listBodyCopies(source: string): string[] {
  return LIST_BODY_PIECES.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

describe('the Customers list is useMasterList, not a copy (DL-153)', () => {
  it('use-customers.ts calls useMasterList once, with the list function of the client module, and takes focus after a read from useReadAgain', () => {
    const hook = read('use-customers.ts');
    expect(hook).toContain("import { useMasterList } from './use-master-list';");
    expect(hook.match(/useMasterList\(/g)).toHaveLength(1);
    expect(hook).toContain('readList: listCustomers');
    expect(hook).toContain('useReadAgain(');
  });

  it('the guard looks at the whole screen: the hooks, the list, the results, the dialogs and the texts', () => {
    expect(FILES).toEqual(
      expect.arrayContaining([
        'use-customers.ts',
        'use-customer-edit.ts',
        'customer-screen.tsx',
        'customer-list.tsx',
        'customer-results.tsx',
        'customer-form-dialog.tsx',
        'customer-reset-dialog.tsx',
        'customer-texts.ts',
      ]),
    );
  });

  it.each(FILES)('%s holds no piece of a list body', (file) => {
    expect(listBodyCopies(read(file))).toEqual([]);
  });

  it('the guard can fail: a hook with its own rows, status, skeleton and newest-read counter is found', () => {
    const planted = `export function useCustomers(initial) {
  const [items, setItems] = useState<ReadonlyArray<CustomerSummaryRow>>(initial);
  const [status, setStatus] = useState<ReadStatus>('ready');
  const showSkeleton = useAfterDelay(status === 'loading', SKELETON_DELAY_MS);
  const newest = useRef(0);
  async function read() { newest.current += 1; const outcome = await listCustomers(); setItems(outcome.value); }
}`;
    expect(listBodyCopies(planted)).toEqual(
      expect.arrayContaining(['state for the rows', 'state for the read status', 'the delayed skeleton', 'the skeleton delay', 'a counter of the newest read']),
    );
  });

  it('the guard does not mistake the screen\'s own state (an open flag, a notice) for a list body', () => {
    expect(listBodyCopies('const [open, setOpen] = useState(false);\nconst [notice, setNotice] = useState<PageNotice | null>(null);')).toEqual([]);
  });
});
