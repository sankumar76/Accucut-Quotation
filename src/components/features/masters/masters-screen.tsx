'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MaterialRow } from '@/lib/masters/materials-client';

import { MASTERS_DESCRIPTION, MASTERS_TITLE, MATERIALS_TAB, TABS_LABEL } from './material-texts';
import { MaterialsPanel } from './materials-panel';

/**
 * SCR-13 "Materials and lists" (STORY-02.03): the page header and the tab shell. The tabs are the screen's three lists (UX spec SCR-13):
 * Materials is this story's; **Exchange rates is story 02.04's and Treatment / Color story 02.05's**, and each adds its own
 * `TabsTrigger` here and a `TabsContent` with its panel, with the data its page loads. A tab bar with one tab is correct for now: the
 * screen does not show a tab it cannot open.
 */

export interface MastersScreenProps {
  readonly initialMaterials: ReadonlyArray<MaterialRow>;
}

const MATERIALS_TAB_VALUE = 'materials';

export function MastersScreen({ initialMaterials }: MastersScreenProps) {
  return (
    <>
      <PageHeader title={MASTERS_TITLE} description={MASTERS_DESCRIPTION} />
      <Card>
        <Tabs defaultValue={MATERIALS_TAB_VALUE}>
          <TabsList aria-label={TABS_LABEL}>
            <TabsTrigger value={MATERIALS_TAB_VALUE}>{MATERIALS_TAB}</TabsTrigger>
          </TabsList>
          <TabsContent value={MATERIALS_TAB_VALUE}>
            <MaterialsPanel initialItems={initialMaterials} />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
