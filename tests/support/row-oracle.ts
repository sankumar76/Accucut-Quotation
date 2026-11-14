/**
 * The invented row of STORY-03.03 and its hand-worked outputs (SPEC section 7.4 and section 14 item 2), shared by the unit test of the row
 * calculator and the integration test of the calculation service, so the two cannot drift. Every expected figure was worked out BEFORE the
 * code, in exact fractions (not with the portal's code and not with floating point), from the SPEC formulas. Nothing here is a real rate,
 * price or exchange rate (ADR-014, NFR-006).
 *
 * The row: a plate 200 x 100 x 2 of invented material (gravity 7.85, 60 a kg, scrap rate 25), a part weight of 0.2 kg, a count of 3 for
 * the whole order, and a mix of processes.
 */

/** Invented rates, typed as the Admin types them: a rate named "... %" is typed as a percentage (12 means 12 %). */
export const TYPED_RATES: Readonly<Record<string, string>> = {
  'Cutting-Rate-per-Sec': '0.5',
  'Bending-Rate-per-stroke': '2',
  'Drilling-Tapping-Rate': '3',
  'Welding-rate-per-kg': '40',
  'Dip-Galvanizing-Cost-per-kg': '10',
  'Primer-rate-per-sqft': '6',
  'Shot-Blasting-rate-per-kg': '8',
  'Polishing-rate-per-sqin': '0.25',
  'Plating-rate-per-sqin': '0.1',
  'Powder-rate-per-sqft': '12',
  'Foam Cost': '9',
  'Soft-Anodize-rate-per-sqin': '0.2',
  'OH Profit %': '12',
  'Transport %': '5',
  'Inspection & Packing %': '2.5',
};

export const MATERIAL = { pricePerKg: '60', specificGravity: '7.85', scrapRate: '25' } as const;
export const NOT_APPLICABLE = { pricePerKg: '0', specificGravity: '0', scrapRate: '0' } as const;
export const EXCHANGE = { usd: '80', eur: '90' } as const;

/** The row's typed values by SPEC letter. Z to AG are the treatment flags: 1 selected, 0 not. */
export const ROW: Readonly<Record<string, string>> = {
  H: '3',
  J: '200',
  K: '100',
  L: '2',
  N: '0.2',
  P: '10',
  R: '4',
  T: '2',
  U: '5',
  V: '3',
  W: '2',
  X: '1',
  Y: '1',
  Z: '1',
  AA: '0',
  AB: '1',
  AC: '1',
  AE: '1',
  AF: '0',
  AG: '1',
  AP: '15',
  AU: '7',
};

/**
 * Stage by stage, to 2 decimals (SPEC section 14 item 2). The comment on a line is the hand working.
 */
export const WORKED_2DP: ReadonlyArray<readonly [string, string]> = [
  // Stage 1. M = (2 x 100 x 200 x 7.85) / 1,000,000 = 314,000 / 1,000,000 = 0.314. O = 0.314 - 0.2 = 0.114.
  ['M', '0.31'],
  ['O', '0.11'],
  // AH = (200 x 100 x 2) / 645 = 62.0155..., AI = AH / 144 = 0.43066...
  ['AH', '62.02'],
  ['AI', '0.43'],
  // Stage 2. AK = (0.314 x 60) - (0.114 x 25) = 18.84 - 2.85 = 15.99.
  ['AK', '15.99'],
  // Stage 3. AL = 10 x 0.5. AM = 4 x 2. AN = (2 + 1 + 1) x 3. AO = 0.2 x 40 x 3.
  ['AL', '5.00'],
  ['AM', '8.00'],
  ['AN', '12.00'],
  ['AO', '24.00'],
  // AQ = (0.2 x 10) x 1. AR = (AI x 6) x 0 (flag off). AS = (0.2 x 8) x 1. AT = 1 x ((AH / 2) x 0.25) = 7.7519.
  ['AQ', '2.00'],
  ['AR', '0.00'],
  ['AS', '1.60'],
  ['AT', '7.75'],
  // AV = 1 x (AI x 12) = 5.1680. AW = 0 x AI x 9 (flag off). AX = 1 x (AH x 0.2) = 12.4031.
  ['AV', '5.17'],
  ['AW', '0.00'],
  ['AX', '12.40'],
  // AY = 5 + 8 + 12 + 24 + AP 15 + 2 + 0 + 1.6 + 7.7519 + AU 7 + 5.1680 + 0 + 12.4031 = 99.9230.
  ['AY', '99.92'],
  // Stage 4. AZ = 2 x 5. BA = 15.99 + 99.9230 + 10 = 125.9130. BB = BA x 3 = 377.7390.
  ['AZ', '10.00'],
  ['BA', '125.91'],
  ['BB', '377.74'],
  // Stage 5. BC is seeded 0. BD = BB x 0.12. BE = BB x 0.025. BF = BB x 0.05.
  ['BC', '0.00'],
  ['BD', '45.33'],
  ['BE', '9.44'],
  ['BF', '18.89'],
  // Stage 6. BG = BB + 0 + 45.3287 + 9.4435 + 18.8870 = 451.3981. BJ = BG / 80, BK = BG / 90.
  ['BG', '451.40'],
  ['BH', '80.00'],
  ['BI', '90.00'],
  ['BJ', '5.64'],
  ['BK', '5.02'],
];

/** The figures that come out exactly in 6 decimals, which show that the 2 decimals above are not a rounding of a rounding. */
export const WORKED_6DP: ReadonlyArray<readonly [string, string]> = [
  ['M', '0.314000'],
  ['O', '0.114000'],
  ['AK', '15.990000'],
  ['AH', '62.015504'],
  ['AY', '99.922997'],
  ['BA', '125.912997'],
  ['BB', '377.738992'],
  ['BG', '451.398096'],
  ['BJ', '5.642476'],
  ['BK', '5.015534'],
];
