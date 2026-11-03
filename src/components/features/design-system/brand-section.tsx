import { Check } from 'lucide-react';

import { BrandLockup } from '@/components/shared/brand-lockup';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';

import { DsSection } from './section';

const BRAND_RULES = [
  'The logo is the supplied file, used as it is: never redrawn, recoloured, cropped or stretched. It needs a light background, so the top bar is white.',
  'The company name is Tinos Bold in the logo red, with "Quotation Portal" beneath it in Plex Sans.',
  'The side menu is graphite, the main button is red, and the darker red (--primary-ink) is used wherever red is text or a link.',
  'The logo file is 200 × 200 px. A sharper original (open question Q-16) replaces the file; nothing else changes.',
] as const;

/** SCR-00 section 01: the brand lockup and the rules for using it. */
export function BrandSection() {
  return (
    <DsSection number="01" id="ds-brand" title="Brand: Red Leads" aside={<Badge tone="neutral">Delivery lead decision</Badge>}>
      <div className="flex flex-wrap items-start gap-s-5">
        <div className="min-w-0 basis-full md:basis-auto">
          <div className="rounded-lg border border-border bg-surface p-s-3">
            <BrandLockup />
          </div>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col gap-s-2">
          {BRAND_RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-s-2">
              <Icon icon={Check} size="small" className="mt-s-1 shrink-0 text-success" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </DsSection>
  );
}
