import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';

import { PROCESS_CANARY_RATES } from './canary-masters';
import { CUSTOMER_CANARIES } from './customer-canary';

/**
 * The page-tag rules of STORY-10.03 (AQP-308), written once for the two places that apply them: the unit tests, which read the `metadata`
 * objects of the pages and parse sample HTML, and the end-to-end check (`tests/e2e/metadata.spec.ts`), which reads the HTML of the built
 * app. A rule is a function that answers the list of its problems, so an empty list is a pass and a failure says what is wrong.
 * Every name is invented. No test here asserts a layout.
 */

// Written out here and not imported from `src/lib/page-metadata.ts`, so a change to the helper's constants is caught by the rules, not followed by them.
export const SITE_NAME = 'Accucut Quotation Portal';
export const TITLE_SUFFIX = ` · ${SITE_NAME}`;
export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 160;

/** The invented people of the E2E database (`tests/e2e/support/auth.ts`): a person's name or e-mail address never belongs in a tag. */
const E2E_PEOPLE: ReadonlyArray<string> = [
  'E2E Lead',
  'e2e.lead@example.test',
  'E2E Engineer',
  'e2e.engineer@example.test',
  'E2E Admin',
  'e2e.admin@example.test',
  'E2E Canary Person',
  'e2e.canary.person@example.test',
  'example.test',
];

/**
 * AC-4: text that must never be in a tag (NFR-002, NFR-022). The names of the process rates (the canary and the seeded ones), the rupee
 * sign, the prefix of a material's name, the customer canary names and the invented person of the E2E users with their e-mail. A page's
 * tags are the same for everyone and name a screen, never a record.
 */
export const FORBIDDEN_IN_TAGS: ReadonlyArray<string> = [
  '₹',
  'Material-',
  ...PROCESS_CANARY_RATES.map((rate) => rate.name),
  ...SEED_PROCESS_ITEMS.map((item) => item.name),
  ...CUSTOMER_CANARIES.map((customer) => customer.name),
  ...E2E_PEOPLE,
];

const normal = (text: string): string => text.toLowerCase();

/** The forbidden strings that `text` holds, compared without regard to letter case. */
export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_IN_TAGS.filter((forbidden) => normal(text).includes(normal(forbidden)));
}

/** The tags of one page that the rules read. `metas` is keyed by the `name` or `property` attribute; a key can repeat. */
export interface HeadTags {
  readonly title: string | null;
  readonly metas: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly links: ReadonlyArray<{ readonly rel: string; readonly href: string }>;
}

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };
const decode = (text: string): string => text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity);

function attributesOf(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attributes.set((match[1] ?? '').toLowerCase(), decode(match[2] ?? ''));
  return attributes;
}

/**
 * Reads the tags of a page's HTML. Next.js streams a page's tags, so on some requests they are not inside `<head>`; the whole document is
 * read and each tag is unique anyway, so the place does not matter. Only the tags the rules need are parsed.
 */
export function parseHeadTags(html: string): HeadTags {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const metas = new Map<string, string[]>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = attributesOf(tag);
    const key = attributes.get('name') ?? attributes.get('property');
    if (key === undefined) continue;
    metas.set(key, [...(metas.get(key) ?? []), attributes.get('content') ?? '']);
  }
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => {
    const attributes = attributesOf(tag);
    return { rel: (attributes.get('rel') ?? '').toLowerCase(), href: attributes.get('href') ?? '' };
  });
  return { title: title === null ? null : decode((title[1] ?? '').trim()), metas, links };
}

const first = (tags: HeadTags, key: string): string | undefined => tags.metas.get(key)?.[0];

/** AC-1: a title of 60 or fewer that ends with the site name, a description of 160 or fewer, and the four Open Graph tags. */
export function presenceProblems(tags: HeadTags): string[] {
  const problems: string[] = [];
  if (tags.title === null || tags.title === '') problems.push('no <title>');
  else {
    if (tags.title.length > MAX_TITLE_LENGTH) problems.push(`title is ${tags.title.length} characters, over ${MAX_TITLE_LENGTH}`);
    if (!tags.title.endsWith(TITLE_SUFFIX)) problems.push(`title "${tags.title}" does not end with "${TITLE_SUFFIX}"`);
  }
  const description = first(tags, 'description');
  if (description === undefined || description === '') problems.push('no meta description');
  else if (description.length > MAX_DESCRIPTION_LENGTH) problems.push(`description is ${description.length} characters, over ${MAX_DESCRIPTION_LENGTH}`);
  for (const key of ['og:title', 'og:description', 'og:site_name', 'og:type']) {
    if ((first(tags, key) ?? '') === '') problems.push(`no ${key}`);
  }
  return problems;
}

/** AC-2: every robots tag says `noindex` and the page says `nofollow` somewhere, and none allows indexing. */
export function robotsProblems(tags: HeadTags): string[] {
  const contents = tags.metas.get('robots') ?? [];
  if (contents.length === 0) return ['no robots tag'];
  const problems: string[] = [];
  for (const content of contents) {
    const words = content.toLowerCase().split(',').map((word) => word.trim());
    if (!words.includes('noindex')) problems.push(`robots "${content}" does not say noindex`);
    if (words.includes('index') || words.includes('follow') || words.includes('all')) problems.push(`robots "${content}" allows indexing or following`);
  }
  if (!contents.some((content) => content.toLowerCase().includes('nofollow'))) problems.push('no robots tag says nofollow');
  return problems;
}

const IMAGE_LINK_RELS = ['image_src', 'apple-touch-icon', 'apple-touch-icon-precomposed'];

/** AC-3: no `og:image`, `twitter:image` or image link. The `icon` link is allowed. */
export function imageProblems(tags: HeadTags): string[] {
  const problems: string[] = [];
  for (const key of tags.metas.keys()) {
    if (key.startsWith('og:image') || key.startsWith('twitter:image')) problems.push(`has ${key}`);
  }
  for (const link of tags.links) {
    if (link.rel.split(/\s+/).some((rel) => IMAGE_LINK_RELS.includes(rel))) problems.push(`has a link rel="${link.rel}"`);
  }
  return problems;
}

/** AC-4: nothing forbidden in the title or any description, Open Graph or Twitter tag. */
export function contentProblems(tags: HeadTags): string[] {
  const texts = [tags.title ?? '', ...[...tags.metas].filter(([key]) => key === 'description' || key.startsWith('og:') || key.startsWith('twitter:')).flatMap(([, values]) => values)];
  return texts.flatMap((text) => forbiddenIn(text).map((found) => `"${found}" is in "${text}"`));
}

/** AC-1 to AC-4 for the HTML of one page. */
export function headProblems(html: string): string[] {
  const tags = parseHeadTags(html);
  return [...presenceProblems(tags), ...robotsProblems(tags), ...imageProblems(tags), ...contentProblems(tags)];
}

/** The shape of the `metadata` export of a page that the object-level rules read (a subset of Next.js's `Metadata`). */
export interface PageMetadataLike {
  readonly title?: unknown;
  readonly description?: unknown;
  readonly openGraph?: Readonly<Record<string, unknown>> | null | undefined;
  readonly twitter?: Readonly<Record<string, unknown>> | null | undefined;
  readonly images?: unknown;
  readonly icons?: unknown;
}

/**
 * AC-1, AC-3 and AC-4 for a page's `metadata` object, as Next.js will render it under the root template: the title is a string whose
 * rendered form fits the limit, the description fits, the Open Graph tags are there with the rendered title and no image is named.
 */
export function metadataProblems(metadata: PageMetadataLike): string[] {
  const problems: string[] = [];
  const { title, description, openGraph } = metadata;
  if (typeof title !== 'string' || title === '') return ['the title is not a text'];
  const rendered = `${title}${TITLE_SUFFIX}`;
  if (rendered.length > MAX_TITLE_LENGTH) problems.push(`rendered title is ${rendered.length} characters, over ${MAX_TITLE_LENGTH}`);
  if (typeof description !== 'string' || description === '') problems.push('no description');
  else if (description.length > MAX_DESCRIPTION_LENGTH) problems.push(`description is ${description.length} characters, over ${MAX_DESCRIPTION_LENGTH}`);
  if (openGraph === undefined || openGraph === null) problems.push('no openGraph');
  else {
    if (openGraph['title'] !== rendered) problems.push(`og:title is ${JSON.stringify(openGraph['title'])}, not the rendered title "${rendered}"`);
    if (openGraph['description'] !== description) problems.push('og:description is not the description');
    if (openGraph['siteName'] !== SITE_NAME) problems.push('no og:site_name');
    if (typeof openGraph['type'] !== 'string' || openGraph['type'] === '') problems.push('no og:type');
    if (openGraph['images'] !== undefined) problems.push('openGraph names an image');
  }
  const { twitter } = metadata;
  if (twitter !== undefined && twitter !== null && twitter['images'] !== undefined) problems.push('twitter names an image');
  if (metadata.images !== undefined) problems.push('names an image');
  const texts = [typeof title === 'string' ? title : '', typeof description === 'string' ? description : ''];
  for (const text of texts) problems.push(...forbiddenIn(text).map((found) => `"${found}" is in "${text}"`));
  return problems;
}
