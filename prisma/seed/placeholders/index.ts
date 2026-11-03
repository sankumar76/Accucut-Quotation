/**
 * Invented master data for development, CI and staging. NEVER real data (NFR-006, ADR-014).
 *
 * Every number here must follow the pattern `n.37` (for example `12.37`); a test fails otherwise, so a
 * real rate pasted in by mistake stands out. This repository is public.
 *
 * The collections are empty at scaffold. The stories that own the masters (EPIC-02) add invented
 * entries; real values are typed in by the Admin at first use and never come through this folder.
 */

export interface PlaceholderMasters {
  readonly processRates: ReadonlyArray<{ readonly id: string; readonly name: string; readonly rate: number }>;
  readonly materials: ReadonlyArray<{ readonly name: string; readonly pricePerKg: number }>;
  readonly exchangeRates: ReadonlyArray<{ readonly currency: string; readonly rate: number }>;
}

export const placeholderMasters: PlaceholderMasters = {
  processRates: [],
  materials: [],
  exchangeRates: [],
};
