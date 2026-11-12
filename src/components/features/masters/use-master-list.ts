'use client';

import { useCallback, useRef, useState } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import type { Outcome } from '@/lib/api-client';

import type { ReadStatus } from './use-read-again';

/**
 * The list of a masters screen and everything the screen holds about it (DL-150 (5), DL-153; GitHub issue 245): the rows, the search text, the
 * status of the last read, the skeleton that waits 300 ms, and reading the list from the server. The Process Master (SCR-11), the Materials tab
 * and the Treatment / Color tab of SCR-13 each wrote this by hand; a screen that lists one master and reads it from its client module composes
 * this hook and does not write a fourth copy.
 *
 * Two ways in, because the screens differ in one fact only: whether the server already rendered the list.
 *   - `initialItems` is the list the page rendered (Process, Materials): the status starts `ready`, the rows are never `null`, and a read happens
 *     only after a change (`refresh`).
 *   - `initialItems` is `null` (Treatment / Color, a lazy tab that is not in the first load, NFR-009): the status starts `loading`, the rows are
 *     `null` until the first read answers, and that first load shows no skeleton of its own (the screen shows its own loading state for `null`).
 *     The screen starts the first read with `read()`.
 *
 * Latest read wins (QLT-04): a read that answers after a newer one was started changes nothing. Treatment / Color had this rule; Process and
 * Materials did not, and with this hook they have it too. It only matters when two reads overlap and the older one answers last.
 *
 * What the hook does not do: move focus (that is `useReadAgain`, which takes this hook's `status`, `items` and `refresh`), hold the notice, or
 * know any dialog.
 */

export interface MasterListOptions<Row, Initial extends ReadonlyArray<Row> | null> {
  /**
   * Reads the whole list from the server (the master's `list*` function in its client module). It must be the same function on every render, such
   * as an import: the hook's `read` and `refresh` keep their identity only while it does, and a screen puts `read` in an effect's dependencies.
   */
  readonly readList: () => Promise<Outcome<ReadonlyArray<Row>>>;
  /** The list the page rendered, or `null` for a list that is read after the screen has opened. */
  readonly initialItems: Initial;
  /** Which rows the search text keeps. Left out, the search keeps every row (the Treatment / Color tab has no search). */
  readonly filter?: (items: ReadonlyArray<Row>, query: string) => ReadonlyArray<Row>;
}

export interface MasterList<Row, Items extends ReadonlyArray<Row> | null> {
  /** The rows of the last good read, or `null` before the first one. A failed read leaves them as they were. */
  readonly items: Items;
  readonly status: ReadStatus;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  /** True once a read has been running for 300 ms and there are rows to replace; until then the rows that were there stay on screen. */
  readonly showSkeleton: boolean;
  /** `items` that the search keeps. */
  readonly shown: Items;
  /** Reads the list and settles the status. Sets nothing before the answer: use it for the first read, whose status is already `loading`. */
  readonly read: () => Promise<void>;
  /** Reads the list again because a change was saved or a person pressed Try again: the status goes to `loading` at once, then `read`. */
  readonly refresh: () => Promise<void>;
}

export function useMasterList<Row, Initial extends ReadonlyArray<Row> | null>({
  readList,
  initialItems,
  filter,
}: MasterListOptions<Row, Initial>): MasterList<Row, ReadonlyArray<Row> | Initial> {
  const [items, setItems] = useState<ReadonlyArray<Row> | Initial>(initialItems);
  const [status, setStatus] = useState<ReadStatus>(initialItems === null ? 'loading' : 'ready');
  const [query, setQuery] = useState('');
  // The number of the newest read: an older read that answers late must not replace what a newer one showed (QLT-04).
  const newest = useRef(0);
  const showSkeleton = useAfterDelay(status === 'loading' && items !== null, SKELETON_DELAY_MS);

  const read = useCallback(async (): Promise<void> => {
    newest.current += 1;
    const mine = newest.current;
    const outcome = await readList();
    if (mine > newest.current) return;
    if (outcome.status === 'ok') setItems(outcome.value);
    setStatus(outcome.status === 'ok' ? 'ready' : 'error');
  }, [readList]);

  const refresh = useCallback((): Promise<void> => {
    setStatus('loading');
    return read();
  }, [read]);

  const shown = items !== null && filter !== undefined ? filter(items, query) : items;
  return { items, status, query, setQuery, showSkeleton, shown, read, refresh };
}
