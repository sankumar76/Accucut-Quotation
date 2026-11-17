'use client';

import { useRef, useState } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

import { BUILDING_LINE, DOWNLOAD_LABEL, ERROR_BODY, ERROR_TITLE, REFERENCE_LINE } from './export-texts';

/**
 * The **Download .xlsx** button of SCR-10 (STORY-07.01 AC-6; UX spec SCR-10 "States"): the one piece of the export page that is a script, and as small as it can be (NFR-009). One press is one request, and a
 * press while one is under way is ignored. While the file is built the button is **disabled** and a polite line says how many parts and pictures it holds ("Building the file. 10 parts, 1 picture. This usually
 * takes a few seconds."); a failure shows the notice with the **reference** the server gave (its request ID), so a person can read it out.
 *
 * It decides nothing: who may download is the server's (the manifest row, `withRoute`), and the file is built there. The code that sends the request and offers the file (`lib/export/download-client.ts`)
 * is fetched by a bare `import()` on the **first press**, so the page does not carry it. No figure passes through here: the answer is a file, handed to the browser as it is.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is the same "no answer" as a network that fails, and the next press tries again. */
const loadClient = () => import('@/lib/export/download-client');

export interface DownloadButtonProps {
  readonly id: string;
  readonly estimateId: string;
  /** The name the page showed: used only when the server's own name cannot be read from the answer. */
  readonly fileName: string;
  readonly partCount: number;
  readonly pictureCount: number;
}

interface Problem {
  readonly title: string;
  readonly body: string;
  readonly reference: string | null;
}

export function DownloadButton({ id, estimateId, fileName, partCount, pictureCount }: DownloadButtonProps) {
  const [building, setBuilding] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // State is read after the render, so a second press in the same moment is stopped by a ref.
  const inFlight = useRef(false);

  async function press(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBuilding(true);
    setProblem(null);
    const client = await loadClient().catch(() => null);
    const outcome = client === null ? null : await client.downloadExport(estimateId, fileName);
    inFlight.current = false;
    setBuilding(false);
    if (outcome === null || outcome.status === 'failed') setProblem({ title: ERROR_TITLE, body: ERROR_BODY, reference: outcome === null ? null : outcome.reference });
    else if (outcome.status === 'refused') setProblem({ title: outcome.title, body: ERROR_BODY, reference: outcome.reference });
  }

  return (
    <div className="flex flex-col items-start gap-s-3">
      <Button id={id} disabled={building} aria-busy={building} onClick={() => void press()} className="w-full md:w-auto">
        {DOWNLOAD_LABEL}
      </Button>
      <p aria-live="polite" className={building ? 'text-label text-ink-2' : 'sr-only'}>
        {building ? BUILDING_LINE(partCount, pictureCount) : ''}
      </p>
      {problem === null ? null : (
        <Notice tone="danger" title={problem.title} className="w-full">
          {problem.body}
          {problem.reference === null ? null : <span className="mt-s-1 block tabular-nums">{REFERENCE_LINE(problem.reference)}</span>}
        </Notice>
      )}
    </div>
  );
}
