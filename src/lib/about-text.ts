/**
 * The words of SCR-24 "About" (STORY-01.08, FR-010, SPEC section 9, UX spec section 6). One file, so each sentence is written once and a test can compare it
 * with the approved text. The description is the delivery lead's own wording ("The wording is fine.", D-18), including the word "cost", which is descriptive text
 * and not a cost value (the Engineer-page check allows it, NFR-002). Never reword, re-quote or re-space a line here: `tests/unit/about-text.test.ts` fails on a
 * single character.
 *
 * The version is its own constant, as the SPEC fixes it: it is not read from `package.json`, so a release of the package does not change what the page says (AC-4).
 * The copyright sign below is U+00A9.
 */

export const ABOUT_TITLE = 'About';
/** The description of the page in a tab and a link preview (STORY-10.03): generic words, no name, no figure. */
export const ABOUT_META_DESCRIPTION = 'About the Accucut Quotation Portal, version and copyright.';

export const ABOUT_DESCRIPTION =
  'The Accucut Quotation Portal helps Accucut Lasers prepare, review and approve manufacturing cost estimates. Engineers enter part details, the portal does the calculation, and a Lead or Admin reviews and approves the estimate.';
export const ABOUT_VERSION = 'Version No: 1.0';
export const ABOUT_COPYRIGHT = '\u00a9 Accucut Lasers Pvt Ltd. All rights reserved.';
