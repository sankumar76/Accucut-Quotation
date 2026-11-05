import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BrandSection } from '@/components/features/design-system/brand-section';
import { ColourSection } from '@/components/features/design-system/colour-section';
import { ComponentMapSection } from '@/components/features/design-system/component-map-section';
import { ButtonsSection, FormControlsSection } from '@/components/features/design-system/controls-sections';
import { BadgesNoticesSection, NodeIconsSection, StatesSection } from '@/components/features/design-system/feedback-sections';
import { SpacingSection, TypeSection } from '@/components/features/design-system/type-spacing-sections';
import { PageHeader } from '@/components/shared/page-header';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { authorizePage } from '@/server/http/page-access';

const DESCRIPTION = 'Design tokens, brand, components and states used on every screen of the Accucut Quotation Portal.';

export const metadata: Metadata = {
  title: 'Design system',
  description: DESCRIPTION,
  openGraph: { title: 'Design system · Accucut Quotation Portal', description: DESCRIPTION },
};

/**
 * SCR-00, the single reference for tokens, brand, components and state patterns (FR-085, FR-086, FR-088).
 * Invented figures only. It exists in every environment except a production build, where it answers
 * "not found" (STORY-10.02, AC-7).
 */
export default async function DesignSystemPage() {
  if (!isDesignSystemAvailable()) notFound();
  // Like every page, it checks the person and the role itself and does not rely on the portal layout (STD-09).
  await authorizePage('/design-system');

  return (
    <>
      <PageHeader
        title="Design system"
        description='One set of tokens drives every screen: four type sizes, a 4-point spacing scale, one button size in four variants and one palette. "Red Leads" brand, delivery lead decision of 2026-10-31.'
      />
      <BrandSection />
      <ColourSection />
      <div className="grid grid-cols-1 gap-s-5 xl:grid-cols-[2fr_1fr]">
        <TypeSection />
        <SpacingSection />
      </div>
      <ButtonsSection />
      <FormControlsSection />
      <div className="grid grid-cols-1 gap-s-5 xl:grid-cols-[2fr_1fr]">
        <BadgesNoticesSection />
        <NodeIconsSection />
      </div>
      <StatesSection />
      <ComponentMapSection />
    </>
  );
}
