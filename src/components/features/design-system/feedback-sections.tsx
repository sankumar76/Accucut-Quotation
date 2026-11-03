import { CircleCheck, Contrast, Circle, Clock, FilePen, ListChecks, Send, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { DsSection } from './section';

interface StatusBadge {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly icon: LucideIcon;
}

const STATUS_BADGES: ReadonlyArray<StatusBadge> = [
  { label: 'Draft', tone: 'neutral', icon: FilePen },
  { label: 'Submitted', tone: 'info', icon: Send },
  { label: 'Overdue', tone: 'warn', icon: Clock },
  { label: 'Approved', tone: 'success', icon: CircleCheck },
  { label: 'Calculation blocked', tone: 'danger', icon: TriangleAlert },
  { label: 'Release 2', tone: 'brand', icon: ListChecks },
];

/** SCR-00 section 07: status badges (icon and text) and the four notices. */
export function BadgesNoticesSection() {
  return (
    <DsSection number="07" id="ds-badges" title="Status badges and notices">
      <ul className="flex flex-wrap items-center gap-s-2">
        {STATUS_BADGES.map(({ label, tone, icon: Glyph }) => (
          <li key={label}>
            <Badge tone={tone}>
              <Icon icon={Glyph} size="badge" />
              {label}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-s-3">
        <Notice tone="info">Neutral information. Graphite on grey.</Notice>
        <Notice tone="success">Saved at 10:42 IST.</Notice>
        <Notice tone="warn">Attention. Amber is used for overdue and for changes that need a decision.</Notice>
        <Notice tone="danger" title="Something needs fixing.">
          <span>Errors always use an icon, a thick left border and written text, never colour alone.</span>
        </Notice>
      </div>
    </DsSection>
  );
}

interface NodeIcon {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly className: string;
}

const NODE_ICONS: ReadonlyArray<NodeIcon> = [
  { label: 'Complete', icon: CircleCheck, className: 'text-success' },
  { label: 'In progress', icon: Contrast, className: 'text-ink-2' },
  { label: 'Not started', icon: Circle, className: 'text-ink-3' },
  { label: 'Missing data after Calculate', icon: TriangleAlert, className: 'text-danger' },
];

/** SCR-00 section 08: the status icons of the parts tree. Shape differs as well as colour. */
export function NodeIconsSection() {
  return (
    <DsSection number="08" id="ds-nodes" title="Node status icons">
      <ul className="flex flex-col gap-s-2">
        {NODE_ICONS.map(({ label, icon: Glyph, className }) => (
          <li key={label} className="flex items-center gap-s-3">
            <Icon icon={Glyph} className={className} />
            {label}
          </li>
        ))}
      </ul>
      <p className="text-label text-ink-3">Shape differs as well as colour: check, half circle, empty circle, triangle.</p>
    </DsSection>
  );
}

/** SCR-00 section 09: the loading, empty and error patterns (FR-088). */
export function StatesSection() {
  return (
    <DsSection number="09" id="ds-states" title="Loading, empty and error patterns (FR-088)">
      <div className="grid grid-cols-1 gap-s-4 md:grid-cols-3">
        <Card className="shadow-none" role="group" aria-label="Loading example">
          <SkeletonBlock delayMs={0} rows={4} />
        </Card>
        <Card className="shadow-none">
          <EmptyState
            as="h3"
            icon={<Icon icon={ListChecks} size="state" />}
            title="Nothing here yet"
            description="Say what is missing and what to do next, in one sentence."
            action={<Button variant="secondary">One clear action</Button>}
          />
        </Card>
        <Card className="shadow-none">
          <ErrorState
            as="h3"
            title="We could not load this"
            action={<Button variant="secondary">Try again</Button>}
          />
        </Card>
      </div>
      <p className="text-label text-ink-3">
        Loading: grey skeleton rows in the shape of the content, shown after 300 ms and announced as &quot;Loading&quot; to screen readers. No spinner on
        pages. The shimmer stops when the person has asked their device for less motion.
      </p>
    </DsSection>
  );
}
