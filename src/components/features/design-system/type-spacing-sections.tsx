import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

import { DsSection } from './section';

interface TypeRow {
  readonly role: string;
  readonly spec: string;
  readonly sample: string;
  readonly className: string;
}

const TYPE_ROWS: ReadonlyArray<TypeRow> = [
  { role: 'Heading', spec: '28 / 36 · 600', sample: 'Estimate Q-2026-0318', className: 'text-heading font-semibold tracking-tight' },
  { role: 'Subheading', spec: '18 / 26 · 600', sample: '02 Material and dimensions', className: 'text-sub font-semibold' },
  { role: 'Body', spec: '14 / 22 · 400', sample: 'Every field is required to Calculate. Enter 0 where a part needs nothing.', className: 'text-body' },
  { role: 'Label', spec: '12 / 16 · 600', sample: 'Material in Drawing', className: 'text-label font-semibold tracking-wide' },
];

interface SpaceRow {
  readonly token: string;
  readonly pixels: string;
  readonly use: string;
  readonly barClass: string;
}

const SPACE_ROWS: ReadonlyArray<SpaceRow> = [
  { token: 's-1', pixels: '4', use: 'icon and text in a badge', barClass: 'w-s-1' },
  { token: 's-2', pixels: '8', use: 'label and input', barClass: 'w-s-2' },
  { token: 's-3', pixels: '12', use: 'items in a row', barClass: 'w-s-3' },
  { token: 's-4', pixels: '16', use: 'field and field; phone page margin', barClass: 'w-s-4' },
  { token: 's-5', pixels: '24', use: 'card padding, section gap', barClass: 'w-s-5' },
  { token: 's-6', pixels: '32', use: 'page padding', barClass: 'w-s-6' },
  { token: 's-7', pixels: '48', use: 'large separation', barClass: 'w-s-7' },
];

/** SCR-00 section 03: the four type sizes. */
export function TypeSection() {
  return (
    <DsSection
      number="03"
      id="ds-type"
      title="Type scale"
      aside={<Badge tone="neutral">IBM Plex Sans · Plex Mono · Tinos</Badge>}
    >
      <dl className="flex flex-col">
        {TYPE_ROWS.map((row) => (
          <div key={row.role} className="flex flex-wrap items-baseline gap-x-s-5 gap-y-s-1 border-b border-border py-s-4 first:pt-0">
            <dt className="w-full font-mono text-label text-ink-2 md:w-1/4">
              {row.role} · {row.spec}
            </dt>
            <dd className={cn('min-w-0', row.className)}>{row.sample}</dd>
          </div>
        ))}
      </dl>
      <p className="text-label text-ink-3">
        Phones (up to 767 px) step the heading down to 24 / 32. Nothing else changes. Column letters use Plex Mono at label size. Money is
        written <span className="font-semibold text-ink">₹ 1,23,456.78</span>, with the rupee sign from a project font.
      </p>
    </DsSection>
  );
}

/** SCR-00 section 04: the 4-point spacing scale. */
export function SpacingSection() {
  return (
    <DsSection number="04" id="ds-spacing" title="Spacing">
      <ul className="flex flex-col gap-s-2">
        {SPACE_ROWS.map((row) => (
          <li key={row.token} className="flex flex-wrap items-center gap-s-3">
            <span className="w-s-7 font-mono text-label text-ink-2">{row.token}</span>
            <span className="w-s-5 font-mono text-label text-ink-2">{row.pixels}</span>
            <span aria-hidden="true" className={cn('h-s-4 rounded-sm bg-nav', row.barClass)} />
            <span className="min-w-0 text-label text-ink-3">{row.use}</span>
          </li>
        ))}
      </ul>
    </DsSection>
  );
}
