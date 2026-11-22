/**
 * The tags of one page (STORY-10.03, FR-089, NFR-022): the one place that fills a page's title, description and Open Graph tags, so no page
 * writes them in its own way and none forgets one. The root layout (`src/app/layout.tsx`) holds what every page shares: the title template,
 * `robots: noindex, nofollow`, the Twitter card type and the icon. A page adds only its own words, and this helper builds them.
 *
 * Why the Open Graph block is built here and not inherited: Next.js replaces a parent's `openGraph` object whole when a page sets one, and
 * leaves the parent's when it sets none. A page that inherited the root's block would share the site's title in a link preview, and a page
 * that set a bare `openGraph.title` would lose the site name and the type. The helper therefore always writes all four fields.
 *
 * No image is named (FR-089, OQ-UX-03): no `images`, no `og:image`, no `twitter:image`. The words are generic: pass a screen's name and a
 * sentence about what the screen is for, never a customer, a rate, a price, a person or a task code (NFR-002; architecture section 8).
 * `tests/unit/metadata-coverage.test.ts` reads every page, and `tests/e2e/metadata.spec.ts` reads the HTML of the built app.
 */

import { COMPANY_AND_PRODUCT_NAME } from './product-name';

export const SITE_NAME = COMPANY_AND_PRODUCT_NAME;

/** The root layout's title template: `%s` is the page's own title. Kept next to `renderedTitle`, which must say the same. */
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;

/** NFR-022: the longest title as shown in a tab or a link preview, and the longest description. PROPOSED in the PRD, assumption A-1 of the story. */
export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 160;

/**
 * The metadata a page exports. It is a plain shape that `Metadata` of Next.js accepts (`src/lib` is pure and imports nothing from `next`, architecture section 10),
 * and it names no image field, so a page that uses it cannot carry one by this route.
 */
export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly openGraph: {
    readonly type: 'website';
    readonly siteName: string;
    readonly title: string;
    readonly description: string;
  };
}

/** A page title as the root template renders it (what a browser tab and `og:title` show). */
export function renderedTitle(title: string): string {
  return TITLE_TEMPLATE.replace('%s', title);
}

/**
 * The metadata of a page: `title` (the root template adds the site name), `description`, and the Open Graph title, description, site name and type.
 * Next.js applies a parent's template to a page's `title` but not to `openGraph.title`, so the rendered form is written there.
 */
export function pageMetadata(title: string, description: string): PageMetadata {
  return {
    title,
    description,
    openGraph: { type: 'website', siteName: SITE_NAME, title: renderedTitle(title), description },
  };
}
