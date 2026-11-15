import { formatFigure } from '@/lib/money';
import type { NodeCostsLine, NodeCostsStage } from '@/server/views/schemas/node-costs';

import { hiddenLinesNote, roundingNote, STAGE_TOTAL_LABEL } from './cost-details-texts';
import { WorkingLineItem } from './working-line';

/**
 * One of the six stages of SCR-07 (STORY-06.03 AC-1, AC-3; UX spec SCR-07 "Layout", "Rules", "Accessibility"): a `details` panel, open, whose `summary` holds the stage's number and name and its total, and
 * whose body lists the lines under the stage's sub-headings. The treatment lines whose flag is not selected are **not drawn**; one sentence under the stage says how many are hidden and that they are still
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
    <details open data-stage={stage.number} className="rounded-md border border-border bg-surface-2">
      <summary className="flex min-h-(--control-h) cursor-pointer flex-wrap items-center justify-between gap-x-s-4 gap-y-s-1 px-s-4 py-s-2 text-body font-semibold text-ink">
        <span>{`${stage.number}. ${stage.name}`}</span>
        {total === null ? null : <span className="tabular-nums">{`${STAGE_TOTAL_LABEL}: ${formatFigure(total.value)}`}</span>}
      </summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        {groupsOf(stage, shown).map((group) => (
          <section key={group.heading ?? 'lines'} className="flex flex-col gap-s-2">
            {group.heading === null ? null : <h3 className="text-label font-semibold text-ink-2">{group.heading}</h3>}
            <ul className="flex flex-col gap-s-2">
              {group.lines.map((line) => (
                <WorkingLineItem key={line.letter} line={line} highlighted={line.letter === unitPriceLetter} />
              ))}
            </ul>
          </section>
        ))}
        {hiddenCount === 0 ? null : <p className="text-label text-ink-2">{hiddenLinesNote(hiddenCount)}</p>}
        {total === null || total.shownLinesSum === null ? null : (
          <p className="text-label text-ink-2">{roundingNote(total.letters.length, formatFigure(total.shownLinesSum), formatFigure(total.value))}</p>
        )}
      </div>
    </details>
  );
}
