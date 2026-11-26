import { CalendarClock } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';

/** The due pill of the head of SCR-05 and SCR-06 (the mock-up: a neutral badge with the calendar and "Due <date>"). */
export function DuePill({ label }: { readonly label: string }) {
  return (
    <Badge tone="neutral" className="text-body">
      <Icon icon={CalendarClock} size="small" />
      {`Due ${label}`}
    </Badge>
  );
}
