'use client';

import { PageHeader } from '@/components/shared/page-header';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MaterialRow } from '@/lib/masters/materials-client';

import { EXCHANGE_TAB } from './exchange-rate-texts';
import type { ExchangeRatesPanelProps } from './exchange-rates-panel';
import { ExchangeRatesSlot } from './exchange-rates-slot';
import { MASTERS_DESCRIPTION, MASTERS_TITLE, MATERIALS_TAB, TABS_LABEL } from './material-texts';
import { MaterialsPanel } from './materials-panel';

/**
 * SCR-13 "Materials and lists" (STORY-02.03): the page header and the tab shell. The tabs are the screen's three lists (UX spec SCR-13):
 * Materials is story 02.03's and **Exchange rates story 02.04's**; **Treatment / Color is story 02.05's**, and it adds its own `TabsTrigger`
 * here and a `TabsContent` with its panel. The screen does not show a tab it cannot open.
 *
 * The Materials panel is part of the page (its list is rendered on the server for the first paint). The Exchange rates panel is not: its code
 * is fetched the first time the tab is opened, and it then reads its own data from its GET route (STORY-02.04; PRF-01 of GitHub #121, NFR-009),
 * so the first load of the page grows by the tab button and the loader and nothing else.
 */

export interface MastersScreenProps {
  readonly initialMaterials: ReadonlyArray<MaterialRow>;
}

const MATERIALS_TAB_VALUE = 'materials';
const EXCHANGE_TAB_VALUE = 'exchange-rates';

/** The panel's code: a bare `import()` that the loader can try again after a failure (architecture section 10, AQP-188). */
const loadExchangeRatesPanel = () => import('./exchange-rates-panel').then((module) => module.ExchangeRatesPanel);

export function MastersScreen({ initialMaterials }: MastersScreenProps) {
  const exchangeRates = useFirstOpen<ExchangeRatesPanelProps>({ id: 'exchange-rates-panel', load: loadExchangeRatesPanel });
  return (
    <>
      <PageHeader title={MASTERS_TITLE} description={MASTERS_DESCRIPTION} />
      <Card>
        <Tabs
          defaultValue={MATERIALS_TAB_VALUE}
          onValueChange={(value) => {
            if (value === EXCHANGE_TAB_VALUE) exchangeRates.activate(false);
          }}
        >
          <TabsList aria-label={TABS_LABEL}>
            <TabsTrigger value={MATERIALS_TAB_VALUE}>{MATERIALS_TAB}</TabsTrigger>
            <TabsTrigger value={EXCHANGE_TAB_VALUE}>{EXCHANGE_TAB}</TabsTrigger>
          </TabsList>
          <TabsContent value={MATERIALS_TAB_VALUE}>
            <MaterialsPanel initialItems={initialMaterials} />
          </TabsContent>
          <TabsContent value={EXCHANGE_TAB_VALUE}>
            <ExchangeRatesSlot loader={exchangeRates} />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
