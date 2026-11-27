import { PROGRESS_BAR_WIDTH, PROGRESS_ROW } from '@/components/shared/form-layout';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/cn';
import type { SectionProgress } from '@/lib/estimates/form-values';

import { inputsProgressLabel, inputsProgressText } from './estimate-texts';

export interface PartProgressProps {
  /** The part's Sl. No: it names the bar ("Inputs complete for part 1.1"). */
  readonly slNo: string;
  /** The sum of the cards' counts for what is typed (`sectionProgress`): Part Model and a hidden field are not in it. */
  readonly counts: SectionProgress;
}

/**
 * The completion line above the sections (STORY-05.11 AC-1, AC-7; UX spec SCR-05 "Content"): "23 of 24 inputs complete" for the open part, with a progress bar that carries the same
 * as text and as `role="progressbar"` with its value, maximum and name. It follows what is typed, as the cards do; the tree's icon follows what is saved (A-1). It says nothing about
 * editing, so it reads the same on a read-only estimate. A form with nothing to count draws nothing.
 */
export function PartProgress({ slNo, counts }: PartProgressProps) {
  if (counts.total === 0) return null;
  const text = inputsProgressText(counts.complete, counts.total);
  return (
    <div data-part-progress="" className={PROGRESS_ROW}>
      {/* A short black bar (160 px) with its words beside it, as in the SCR-05 mock-up (DEF-097): the fill is the dark navigation ink, not the red of the actions. */}
      <Progress value={counts.complete} max={counts.total} aria-label={inputsProgressLabel(slNo)} getValueLabel={() => text} className={cn(PROGRESS_BAR_WIDTH, '[&_[data-slot=progress-indicator]]:bg-nav')} />
      <p className="text-label text-ink-2">{text}</p>
    </div>
  );
}
