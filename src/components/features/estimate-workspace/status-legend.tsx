import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';

import { STATUS_LEGEND } from './completeness-look';

/** The accessible name of the status legend: told apart from the legend of the kinds ("Row kinds"). */
export const STATUS_LEGEND_TITLE = 'Row status';

/**
 * The status legend under the legend of the kinds (DEF-081 ruling item 14; SCR-05): the four status icons of a row at 18 px in the inks of the rows, each with the words a row speaks to a screen reader ("All inputs
 * entered", "Some inputs entered", "No inputs yet", "Missing inputs"; STORY-05.11 AC-4), so the key matches what is heard. The icons are decorative: the words stand beside each one.
 */
export function StatusLegend() {
  return (
    <section aria-label={STATUS_LEGEND_TITLE} data-status-legend="">
      <ul className="flex flex-wrap gap-x-s-4 gap-y-s-2">
        {STATUS_LEGEND.map(({ key, icon, ink, words }) => (
          <li key={key} className="flex items-center gap-s-2 text-label text-ink-2">
            <Icon icon={icon} size="default" className={cn('shrink-0', ink)} />
            {words}
          </li>
        ))}
      </ul>
    </section>
  );
}
