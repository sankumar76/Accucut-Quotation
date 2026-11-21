'use client';

import { useCallback, useRef, useState } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import { listCheckpoints, readCurrentVersion, type CheckpointRow, type CurrentVersion } from '@/lib/config/checkpoints-client';

import type { ReadStatus } from '../masters/use-read-again';

/**
 * What SCR-21 reads from the server (STORY-08.06 AC-3): the checkpoints and the current version line, read together so the screen never shows a list of one moment beside a version of another. Latest read wins
 * (an older read that answers late is dropped, as in `useMasterList`), a failed read keeps what was shown and sets the status to `error`, and the skeleton waits 300 ms when there is something to replace. The first
 * read is started by the screen (`read()`, in an effect), so the status is `loading` from the first render.
 */

export interface CheckpointData {
  readonly status: ReadStatus;
  /** The rows of the last good read, newest first, or `null` before the first one. */
  readonly rows: ReadonlyArray<CheckpointRow> | null;
  readonly current: CurrentVersion | null;
  readonly showSkeleton: boolean;
  /** Reads both and settles the status. Sets nothing before the answer: for the first read, whose status is already `loading`. */
  readonly read: () => Promise<void>;
  /** Reads both again after a change or "Try again": the status goes to `loading` at once. */
  readonly refresh: () => Promise<void>;
}

interface Loaded {
  readonly rows: ReadonlyArray<CheckpointRow>;
  readonly current: CurrentVersion;
}

export function useCheckpointData(): CheckpointData {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<ReadStatus>('loading');
  // The number of the newest read: an older read that answers late must not replace what a newer one showed.
  const newest = useRef(0);
  const showSkeleton = useAfterDelay(status === 'loading' && loaded !== null, SKELETON_DELAY_MS);

  const read = useCallback(async (): Promise<void> => {
    newest.current += 1;
    const mine = newest.current;
    const [rows, current] = await Promise.all([listCheckpoints(), readCurrentVersion()]);
    if (mine !== newest.current) return;
    if (rows.status === 'ok' && current.status === 'ok') {
      setLoaded({ rows: rows.value, current: current.value });
      setStatus('ready');
    } else {
      setStatus('error');
    }
  }, []);

  const refresh = useCallback((): Promise<void> => {
    setStatus('loading');
    return read();
  }, [read]);

  return { status, rows: loaded?.rows ?? null, current: loaded?.current ?? null, showSkeleton, read, refresh };
}
