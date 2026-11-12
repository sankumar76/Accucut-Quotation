'use client';

import { PageHeader } from '@/components/shared/page-header';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MaterialRow } from '@/lib/masters/materials-client';

import { EXCHANGE_ERROR_TITLE, EXCHANGE_LOADING_LABEL, EXCHANGE_TAB } from './exchange-rate-texts';
import type { ExchangeRatesPanelProps } from './exchange-rates-panel';
import { LazyTabSlot } from './lazy-tab-slot';
import { MASTERS_DESCRIPTION, MASTERS_TITLE, MATERIALS_TAB, TABS_LABEL } from './material-texts';
import { MaterialsPanel } from './materials-panel';
import type { TreatmentPanelProps } from './treatment-panel';
import { TREATMENT_ERROR_TITLE, TREATMENT_LOADING_LABEL, TREATMENT_SKELETON_ROWS, TREATMENT_TAB } from './treatment-texts';

/**
 * SCR-13 "Materials and lists" (STORY-02.03): the page header and the tab shell. The tabs are the screen's three lists (UX spec SCR-13): Materials
 * is story 02.03's, **Exchange rates story 02.04's** and **Treatment / Color story 02.05's**, in that order. The screen does not show a tab it
 * cannot open.
 *
 * The Materials panel is part of the page (its list is rendered on the server for the first paint). The Exchange rates and Treatment / Color panels
 * are not: the code of each is fetched the first time its tab is opened, and it then reads its own data from its GET route (PRF-01 of GitHub issue
 * 121, NFR-009), so the first load of the page grows by the tab buttons and the loaders and nothing else.
 */

export interface MastersScreenProps {
  readonly initialMaterials: ReadonlyArray<MaterialRow>;
}

const MATERIALS_TAB_VALUE = 'materials';
const EXCHANGE_TAB_VALUE = 'exchange-rates';
const TREATMENT_TAB_VALUE = 'treatment';

/** The panels' code: a bare `import()` that the loader can try again after a failure (architecture section 10, AQP-188). */
const loadExchangeRatesPanel = () => import('./exchange-rates-panel').then((module) => module.ExchangeRatesPanel);
const loadTreatmentPanel = () => import('./treatment-panel').then((module) => module.TreatmentPanel);

export function MastersScreen({ initialMaterials }: MastersScreenProps) {
  const exchangeRates = useFirstOpen<ExchangeRatesPanelProps>({ id: 'exchange-rates-panel', load: loadExchangeRatesPanel });
  const treatments = useFirstOpen<TreatmentPanelProps>({ id: 'treatment-panel', load: loadTreatmentPanel });
  return (
    <>
      <PageHeader title={MASTERS_TITLE} description={MASTERS_DESCRIPTION} />
      <Card>
        <Tabs
          defaultValue={MATERIALS_TAB_VALUE}
          onValueChange={(value) => {
            if (value === EXCHANGE_TAB_VALUE) exchangeRates.activate(false);
            if (value === TREATMENT_TAB_VALUE) treatments.activate(false);
          }}
        >
          <TabsList aria-label={TABS_LABEL}>
            <TabsTrigger value={MATERIALS_TAB_VALUE}>{MATERIALS_TAB}</TabsTrigger>
            <TabsTrigger value={EXCHANGE_TAB_VALUE}>{EXCHANGE_TAB}</TabsTrigger>
            <TabsTrigger value={TREATMENT_TAB_VALUE}>{TREATMENT_TAB}</TabsTrigger>
          </TabsList>
          <TabsContent value={MATERIALS_TAB_VALUE}>
            <MaterialsPanel initialItems={initialMaterials} />
          </TabsContent>
          <TabsContent value={EXCHANGE_TAB_VALUE}>
            <LazyTabSlot loader={exchangeRates} errorTitle={EXCHANGE_ERROR_TITLE} loadingLabel={EXCHANGE_LOADING_LABEL} />
          </TabsContent>
          <TabsContent value={TREATMENT_TAB_VALUE}>
            <LazyTabSlot loader={treatments} errorTitle={TREATMENT_ERROR_TITLE} loadingLabel={TREATMENT_LOADING_LABEL} skeletonRows={TREATMENT_SKELETON_ROWS} />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
