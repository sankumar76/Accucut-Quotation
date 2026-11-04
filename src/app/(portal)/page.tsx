import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';

// Placeholder home until sign-in and the task queue arrive (STORY-01.01, STORY-03.xx).
export default function HomePage() {
  return (
    <>
      <PageHeader title="Accucut Quotation Portal" description="The portal is being built one screen at a time." />
      {isDesignSystemAvailable() ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-s-4">
            <p className="w-full min-w-0 text-ink-2 md:w-auto md:flex-1">
              The design system page shows the colours, type, buttons and states every screen is built from.
            </p>
            <Button asChild>
              <Link href="/design-system">Open the design system</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
