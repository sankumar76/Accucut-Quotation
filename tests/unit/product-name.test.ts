import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ABOUT_DESCRIPTION, ABOUT_META_DESCRIPTION } from '@/lib/about-text';
import { COMPANY_AND_PRODUCT_NAME, PRODUCT_NAME, PRODUCT_NAME_IN_A_SENTENCE } from '@/lib/product-name';
import { SITE_NAME } from '@/lib/page-metadata';
import { PORTAL_NAME } from '@/server/mail/layout';

/**
 * AQP-389 (CR-01 item 2): the product is called "RFQ Portal". The name is written once, in `src/lib/product-name.ts`, and the site name, the
 * e-mail name and the About text read from it (AC-1). No tracked file under `src` carries the old name (AC-8).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BRAND_FILE = 'src/lib/product-name.ts';

/** Every tracked file of `src` (text only; the fonts and images are binary and are skipped by the extension). */
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((file) => /\.(ts|tsx|css|json|md|mjs|cjs|js|html|svg)$/.test(file));

const contents = new Map<string, string>();
for (const file of sourceFiles) contents.set(file, readFileSync(join(ROOT, file), 'utf8'));
const read = (file: string): string => contents.get(file) ?? '';

describe('the product name is written once, AQP-389 AC-1', () => {
  it('AC-1: PRODUCT_NAME is "RFQ Portal"', () => {
    expect(PRODUCT_NAME).toBe('RFQ Portal');
  });

  it('AC-1: the sentence form is the same words with a lower-case "portal"', () => {
    expect(PRODUCT_NAME_IN_A_SENTENCE).toBe('RFQ portal');
  });

  it('AC-3: the site name, the company-and-product name and the e-mail name are all "Accucut RFQ Portal", built from PRODUCT_NAME', () => {
    expect(COMPANY_AND_PRODUCT_NAME).toBe(`Accucut ${PRODUCT_NAME}`);
    expect(SITE_NAME).toBe(COMPANY_AND_PRODUCT_NAME);
    expect(PORTAL_NAME).toBe(COMPANY_AND_PRODUCT_NAME);
    expect(SITE_NAME).toBe('Accucut RFQ Portal');
  });

  it('AC-5: the About texts name the product with the new name', () => {
    expect(ABOUT_META_DESCRIPTION).toContain(COMPANY_AND_PRODUCT_NAME);
    expect(ABOUT_DESCRIPTION.startsWith(`The ${COMPANY_AND_PRODUCT_NAME} helps Accucut Lasers prepare, review and approve manufacturing cost estimates`)).toBe(true);
  });

  it('AC-1: no other file of src writes the words "RFQ Portal", so a rename is one edit', () => {
    const writers = sourceFiles.filter((file) => file !== BRAND_FILE && /rfq[\s_-]+portal/i.test(read(file)));
    expect(writers).toEqual([]);
  });
});

describe('the old name is gone from src, AQP-389 AC-8', () => {
  it('AC-8: the tracked source lists are not empty (the check would pass on nothing)', () => {
    expect(sourceFiles.length).toBeGreaterThan(200);
    expect(sourceFiles).toContain(BRAND_FILE);
  });

  it('AC-8: no tracked file of src says "quotation portal" or "quotation-portal", in any case or spacing, even over two lines', () => {
    const offenders = sourceFiles.filter((file) => /quotation[\s_-]+portal/i.test(read(file)));
    expect(offenders).toEqual([]);
  });
});
