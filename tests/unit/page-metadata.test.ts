import { describe, expect, it } from 'vitest';

import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, pageMetadata, renderedTitle, SITE_NAME } from '@/lib/page-metadata';

import {
  contentProblems,
  forbiddenIn,
  headProblems,
  imageProblems,
  metadataProblems,
  parseHeadTags,
  presenceProblems,
  robotsProblems,
  type PageMetadataLike,
} from '../support/head-tags';

/**
 * STORY-10.03 (AQP-308) AC-1 to AC-4 at the unit level: the `pageMetadata` helper, and the rules that the coverage test and the end-to-end check apply
 * (`tests/support/head-tags.ts`). Each rule is shown red on a plant (a "negative control"), so a rule that quietly passes everything cannot hide.
 * Every name is invented.
 */

const DESCRIPTION = 'Assign an estimation task to an Engineer with a folder path and a deadline.';

/** The tags of a good page, as Next.js renders them for a page that uses the helper under the root layout. */
function goodHtml(overrides: { readonly extra?: string; readonly title?: string; readonly robots?: string } = {}): string {
  const title = overrides.title ?? `Assign task${' · '}${SITE_NAME}`;
  const robots = overrides.robots ?? 'noindex, nofollow';
  return [
    '<html lang="en-IN"><head>',
    `<title>${title}</title>`,
    `<meta name="description" content="${DESCRIPTION}"/>`,
    `<meta name="robots" content="${robots}"/>`,
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:description" content="${DESCRIPTION}"/>`,
    `<meta property="og:site_name" content="${SITE_NAME}"/>`,
    '<meta property="og:type" content="website"/>',
    '<meta name="twitter:card" content="summary"/>',
    '<link rel="icon" href="/accucut-logo.jpg"/>',
    overrides.extra ?? '',
    '</head><body></body></html>',
  ].join('');
}

describe('pageMetadata (AC-1)', () => {
  it('AC-1: fills the title, the description and the Open Graph title, description, site name and type', () => {
    const metadata = pageMetadata('Assign task', DESCRIPTION);
    expect(metadata.title).toBe('Assign task');
    expect(metadata.description).toBe(DESCRIPTION);
    expect(metadata.openGraph).toMatchObject({ type: 'website', siteName: SITE_NAME, title: `Assign task · ${SITE_NAME}`, description: DESCRIPTION });
  });

  it('AC-1: the Open Graph title is the title as the root template renders it, so a shared link reads like the tab', () => {
    expect(renderedTitle('Users')).toBe('Users · Accucut RFQ Portal');
    expect(pageMetadata('Users', DESCRIPTION).openGraph).toMatchObject({ title: renderedTitle('Users') });
  });

  it('AC-1: the object passes the rules, and the limits are 60 and 160 characters (NFR-022)', () => {
    expect(MAX_TITLE_LENGTH).toBe(60);
    expect(MAX_DESCRIPTION_LENGTH).toBe(160);
    expect(metadataProblems(pageMetadata('Assign task', DESCRIPTION))).toEqual([]);
  });

  it('AC-1: names no image anywhere (AC-3)', () => {
    const metadata = pageMetadata('Assign task', DESCRIPTION) as { openGraph: Record<string, unknown>; images?: unknown };
    expect(metadata.openGraph['images']).toBeUndefined();
    expect(metadata.images).toBeUndefined();
  });

  it('AC-1: a title that fills the limit exactly is allowed, and one character more is refused', () => {
    const room = MAX_TITLE_LENGTH - renderedTitle('').length;
    expect(metadataProblems(pageMetadata('T'.repeat(room), DESCRIPTION))).toEqual([]);
    expect(metadataProblems(pageMetadata('T'.repeat(room + 1), DESCRIPTION)).join(' ')).toContain('over 60');
  });

  it('AC-1: a description of exactly 160 characters is allowed, and one character more is refused', () => {
    expect(metadataProblems(pageMetadata('Users', 'D'.repeat(MAX_DESCRIPTION_LENGTH)))).toEqual([]);
    expect(metadataProblems(pageMetadata('Users', 'D'.repeat(MAX_DESCRIPTION_LENGTH + 1))).join(' ')).toContain('over 160');
  });
});

describe('metadataProblems (AC-1, AC-3, AC-4), each rule shown red', () => {
  const good = pageMetadata('Users', DESCRIPTION) as PageMetadataLike;

  it('AC-1: refuses a page with no description, no Open Graph block, or an Open Graph title that is not the rendered title', () => {
    expect(metadataProblems({ title: 'Users', openGraph: good.openGraph })).toContain('no description');
    expect(metadataProblems({ title: 'Users', description: DESCRIPTION })).toContain('no openGraph');
    expect(metadataProblems({ ...good, openGraph: { ...good.openGraph, title: 'Users' } }).join(' ')).toContain('og:title');
  });

  it('AC-1: refuses a missing site name or type, and a title that is not a text', () => {
    expect(metadataProblems({ ...good, openGraph: { ...good.openGraph, siteName: undefined } })).toContain('no og:site_name');
    expect(metadataProblems({ ...good, openGraph: { ...good.openGraph, type: undefined } })).toContain('no og:type');
    expect(metadataProblems({ description: DESCRIPTION })).toEqual(['the title is not a text']);
    expect(metadataProblems({ title: { absolute: 'Users' }, description: DESCRIPTION })).toEqual(['the title is not a text']);
  });

  it('AC-3: refuses an image named in the Open Graph block, the Twitter block or the page', () => {
    expect(metadataProblems({ ...good, openGraph: { ...good.openGraph, images: ['/x.png'] } })).toContain('openGraph names an image');
    expect(metadataProblems({ ...good, twitter: { card: 'summary_large_image', images: ['/x.png'] } })).toContain('twitter names an image');
    expect(metadataProblems({ ...good, images: ['/x.png'] })).toContain('names an image');
    expect(metadataProblems({ ...good, twitter: { card: 'summary' } })).toEqual([]);
  });

  it('AC-4: refuses a forbidden string in the title or the description', () => {
    expect(metadataProblems(pageMetadata('Rates in ₹', DESCRIPTION)).join(' ')).toContain('₹');
    expect(metadataProblems(pageMetadata('Users', 'Edit Canary-Customer-Alpha')).join(' ')).toContain('Canary-Customer-Alpha');
  });
});

describe('forbidden strings (AC-4)', () => {
  it.each([
    ['the rupee sign', 'Cost ₹ 100'],
    ['a material name prefix', 'Material-1 sheet'],
    ['a customer name of the canary data', 'Quote for Canary-Customer-Alpha'],
    ['a seeded rate name, in any letter case', 'cutting-rate-per-sec'],
    ['an invented person', 'Signed in as E2E Lead'],
    ['an e-mail address of the E2E users', 'Contact e2e.engineer@example.test'],
  ])('AC-4: finds %s', (_name, text) => {
    expect(forbiddenIn(text)).not.toEqual([]);
  });

  it('AC-4: finds nothing in the words of a screen', () => {
    expect(forbiddenIn('Task queue')).toEqual([]);
    expect(forbiddenIn('Manage portal users, roles and passwords.')).toEqual([]);
  });

  it('AC-4: the list holds the process rate names of the canary data, so a renamed canary is still caught', () => {
    expect(forbiddenIn('Primer-rate-per-sqft').length).toBeGreaterThan(0);
  });
});

describe('the rules on HTML (AC-1 to AC-4), each shown red on a plant', () => {
  it('a good page passes every rule', () => {
    expect(headProblems(goodHtml())).toEqual([]);
  });

  it('AC-1: reads the tags wherever they are, and decodes the entities Next.js writes', () => {
    const tags = parseHeadTags('<body><div hidden><title>Users &amp; roles · Accucut RFQ Portal</title><meta name="description" content="It&#x27;s fine"/></div></body>');
    expect(tags.title).toBe('Users & roles · Accucut RFQ Portal');
    expect(tags.metas.get('description')).toEqual(["It's fine"]);
  });

  it('AC-1: refuses a page with no title, an over-long title, and a title without the site name', () => {
    expect(presenceProblems(parseHeadTags(goodHtml().replace(/<title>.*<\/title>/, '')))).toContain('no <title>');
    expect(presenceProblems(parseHeadTags(goodHtml({ title: `${'T'.repeat(40)} · ${SITE_NAME}` }))).join(' ')).toContain('over 60');
    expect(presenceProblems(parseHeadTags(goodHtml({ title: 'Assign task' }))).join(' ')).toContain('does not end with');
  });

  it('AC-1: refuses a page that lacks the description or any of the four Open Graph tags', () => {
    expect(presenceProblems(parseHeadTags(goodHtml().replace(/<meta name="description"[^>]*>/, '')))).toContain('no meta description');
    for (const key of ['og:title', 'og:description', 'og:site_name', 'og:type']) {
      const without = goodHtml().replace(new RegExp(`<meta property="${key}"[^>]*>`), '');
      expect(presenceProblems(parseHeadTags(without)), key).toContain(`no ${key}`);
    }
  });

  it('AC-1: refuses a description of 161 characters', () => {
    const long = goodHtml().replace(`name="description" content="${DESCRIPTION}"`, `name="description" content="${'D'.repeat(161)}"`);
    expect(presenceProblems(parseHeadTags(long)).join(' ')).toContain('description is 161');
  });

  it('AC-2: refuses a page with no robots tag, one that allows indexing, and one that does not say nofollow', () => {
    expect(robotsProblems(parseHeadTags(goodHtml().replace(/<meta name="robots"[^>]*>/, '')))).toEqual(['no robots tag']);
    expect(robotsProblems(parseHeadTags(goodHtml({ robots: 'index, follow' }))).join(' ')).toContain('does not say noindex');
    expect(robotsProblems(parseHeadTags(goodHtml({ robots: 'noindex, follow' }))).join(' ')).toContain('allows indexing or following');
    expect(robotsProblems(parseHeadTags(goodHtml({ robots: 'noindex' })))).toEqual(['no robots tag says nofollow']);
  });

  it('AC-2: accepts a second robots tag that says only noindex, as Next.js adds on a "not found" page, when one tag says nofollow', () => {
    expect(robotsProblems(parseHeadTags(goodHtml({ extra: '<meta name="robots" content="noindex"/>' })))).toEqual([]);
  });

  it('AC-3: refuses og:image, twitter:image, and an image link, and allows the icon link', () => {
    expect(imageProblems(parseHeadTags(goodHtml()))).toEqual([]);
    expect(imageProblems(parseHeadTags(goodHtml({ extra: '<meta property="og:image" content="/a.png"/>' })))).toEqual(['has og:image']);
    expect(imageProblems(parseHeadTags(goodHtml({ extra: '<meta property="og:image:width" content="10"/>' })))).toEqual(['has og:image:width']);
    expect(imageProblems(parseHeadTags(goodHtml({ extra: '<meta name="twitter:image" content="/a.png"/>' })))).toEqual(['has twitter:image']);
    expect(imageProblems(parseHeadTags(goodHtml({ extra: '<link rel="apple-touch-icon" href="/a.png"/>' })))[0]).toContain('apple-touch-icon');
    expect(imageProblems(parseHeadTags(goodHtml({ extra: '<link rel="image_src" href="/a.png"/>' })))[0]).toContain('image_src');
  });

  it('AC-4: refuses a forbidden string in the title, the description or an Open Graph tag', () => {
    expect(contentProblems(parseHeadTags(goodHtml({ title: `Canary-Customer-Alpha · ${SITE_NAME}` }))).length).toBeGreaterThan(0);
    const inDescription = goodHtml().replaceAll(DESCRIPTION, 'Rates in ₹ for Material-1');
    expect(contentProblems(parseHeadTags(inDescription)).length).toBeGreaterThanOrEqual(2);
    expect(headProblems(goodHtml({ extra: '<meta property="og:title" content="E2E Admin"/>' })).join(' ')).toContain('E2E Admin');
  });
});
