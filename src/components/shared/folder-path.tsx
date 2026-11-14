'use client';

import { Copy } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { BREAK_LONG_NAMES } from './break-long-names';
import { Icon } from './icon';

/** The sentence that says why a link to a network folder may not open (UX spec SCR-04, FR-033). It is text on the page, not only a tooltip. */
export const FOLDER_LINK_NOTE = 'Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer.';
export const COPY_PATH_LABEL = 'Copy path';
export const PATH_COPIED_MESSAGE = 'Path copied to the clipboard.';
export const PATH_NOT_COPIED_MESSAGE = 'The path could not be copied. Select it and copy it yourself.';

export interface FolderPathProps {
  /** The network folder path exactly as it was typed: this is what Copy path copies. */
  readonly path: string;
  /** The `file:` link, built on the server from a valid UNC path. The browser never builds one (architecture section 8). */
  readonly url: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** What the live region says in each state; it is empty until a copy has been tried, so nothing is announced on load. */
const COPY_MESSAGES: Readonly<Record<CopyState, string>> = { idle: '', copied: PATH_COPIED_MESSAGE, failed: PATH_NOT_COPIED_MESSAGE };

/**
 * The folder of a task as everyone sees it (STORY-04.01 AC-4; FR-033): the path as a link, a **Copy path** button, and the sentence that explains a link that
 * does not open. Shared by the assign screen, the queue and the workspace. The copy is announced in a polite live region ("Path copied to the clipboard.").
 * The path is shown as plain text (React encodes it); the link comes from the server and is only used as given.
 */
export function FolderPath({ path, url }: FolderPathProps) {
  const noteId = useId();
  const [state, setState] = useState<CopyState>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(path);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <div className="flex flex-wrap items-center gap-s-3">
        <a href={url} title={FOLDER_LINK_NOTE} aria-describedby={noteId} className={cn('min-w-0 font-mono text-body text-primary-ink underline-offset-2 hover:underline', BREAK_LONG_NAMES)}>
          {path}
        </a>
        <Button variant="secondary" onClick={() => void copy()}>
          <Icon icon={Copy} />
          {COPY_PATH_LABEL}
        </Button>
      </div>
      <p id={noteId} className="text-label text-ink-2">
        {FOLDER_LINK_NOTE}
      </p>
      <p role="status" className="text-label font-semibold text-ink">
        {COPY_MESSAGES[state]}
      </p>
    </div>
  );
}
