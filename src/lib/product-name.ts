/**
 * The name of the product, written once (AQP-389, CR-01 item 2; UX spec section 0.9 row 2). "ACCUCUT LASERS" is the company and does not change; the product
 * beneath it is the "RFQ Portal". The page titles, the sharing tags, the About text, the e-mails and the brand lockup all read the name from here, so a later rename
 * is one edit. `tests/unit/product-name.test.ts` fails when another file of `src` writes the words, or brings the old name back.
 */

/** The product, as the brand lockup shows it beneath "ACCUCUT LASERS". */
export const PRODUCT_NAME = 'RFQ Portal';

/** The product inside a sentence ("... the RFQ portal"): the same words with a lower-case "portal", for the descriptions of pages. */
export const PRODUCT_NAME_IN_A_SENTENCE = PRODUCT_NAME.replace(/ Portal$/, ' portal');

/** The company and the product, as a tab title, an Open Graph site name, a page heading and an e-mail footer say it. */
export const COMPANY_AND_PRODUCT_NAME = `Accucut ${PRODUCT_NAME}`;
