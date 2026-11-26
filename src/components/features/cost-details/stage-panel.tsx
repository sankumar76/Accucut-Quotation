import { ChevronDown } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { formatFigure } from '@/lib/money';
import type { NodeCostsLine, NodeCostsStage } from '@/server/views/schemas/node-costs';

import { hiddenLinesNote, roundingNote, STAGE_TOTAL_LABEL } from './cost-details-texts';
import { WorkingLineItem } from './working-line';

/**
 * One of the six stages of SCR-07 (STORY-06.03 AC-1, AC-3; UX spec SCR-07 "Layout", "Rules", "Accessibility"): a `details` card, open, whose `summary` holds a numbered badge, the heading "N · Name" (the stored
 * name, as stored: ux-expert ruling, option A), the stage's total at the right and a chevron that turns when the card is open (AQP-475, DEF-114: the mock-up's `.stage`; the words "Stage total" stay for a screen
 * reader), and whose body lists the lines as rows under the stage's sub-headings, which are written in capitals by style. The treatment lines whose flag is not selected are **not drawn**; one sentence under the stage says how many are hidden and that they are still
 * calculated and exported as 0. Where the stage total differs from the lines as shown by a few hundredths, the stage says so with the numbers. `details` and `summary` are keyboard operable and announce
 * expanded or collapsed with no script (the phone's "only stage 1 open" is `PhoneStages`).
 */

interface LineGroup {
  readonly heading: string | null;
  readonly lines: ReadonlyArray<NodeCostsLine>;
}

/** The lines under no sub-heading first, then each sub-heading of the stage in its order with its own lines; a sub-heading with no line shown is left out. */
function groupsOf(stage: NodeCostsStage, lines: ReadonlyArray<NodeCostsLine>): LineGroup[] {
  const known = new Set(stage.subHeadings);
  const loose = lines.filter((line) => line.group === null || !known.has(line.group));
  const groups: LineGroup[] = loose.length === 0 ? [] : [{ heading: null, lines: loose }];
  for (const heading of stage.subHeadings) {
    const under = lines.filter((line) => line.group === heading);
    if (under.length > 0) groups.push({ heading, lines: under });
  }
  return groups;
}

export interface StagePanelProps {
  readonly stage: NodeCostsStage;
  /** The letter of the row's own price (BG): its line is drawn highlighted. */
  readonly unitPriceLetter: string;
}

export function StagePanel({ stage, unitPriceLetter }: StagePanelProps) {
  const shown = stage.lines.filter((line) => !line.hidden);
  const hiddenCount = stage.lines.length - shown.length;
  const { total } = stage;
  return (
    <details open data-stage={stage.number} className="group/stage overflow-hidden rounded-lg border border-border bg-surface">
      <summary className="flex min-h-13 cursor-pointer list-none items-center gap-s-3 bg-surface-2 px-s-3 py-s-2 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" data-stage-number="" className="inline-flex size-8 flex-none items-center justify-center rounded-md bg-nav font-mono text-label font-medium text-on-fill">
          {stage.number}
        </span>
        <span className="min-w-0 flex-1">{`${stage.number} · ${stage.name}`}</span>
        {total === null ? null : (
          <span className="tabular-nums">
            <span className="sr-only">{`${STAGE_TOTAL_LABEL}: `}</span>
            {formatFigure(total.value)}
          </span>
        )}
        <Icon icon={ChevronDown} size="default" aria-hidden="true" className="flex-none text-ink-2 transition-transform group-open/stage:rotate-180" />
      </summary>
      <ul className="flex flex-col">
        {groupsOf(stage, shown).flatMap((group) => [
          group.heading === null ? null : (
            <li key={`${group.heading}-heading`} className="border-t border-border bg-bg px-s-3 py-s-2">
              <h3 className="text-label font-semibold tracking-wide text-ink-2 uppercase">{group.heading}</h3>
            </li>
          ),
          ...group.lines.map((line) => (
            <WorkingLineItem
              key={line.letter}
              line={line}
              highlighted={line.letter === unitPriceLetter}
              isTotal={total !== null && line.letter !== unitPriceLetter && total.letters.includes(line.letter)}
            />
          )),
        ])}
      </ul>
      {hiddenCount === 0 && (total === null || total.shownLinesSum === null) ? null : (
        <div className="flex flex-col gap-s-2 border-t border-border px-s-3 py-s-3">
          {hiddenCount === 0 ? null : <p className="text-label text-ink-2">{hiddenLinesNote(hiddenCount)}</p>}
          {total === null || total.shownLinesSum === null ? null : (
            <p className="text-label text-ink-2">{roundingNote(total.letters.length, formatFigure(total.shownLinesSum), formatFigure(total.value))}</p>
          )}
        </div>
      )}
    </details>
  );
}
