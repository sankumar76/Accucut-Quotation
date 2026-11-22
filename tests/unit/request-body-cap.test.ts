import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import { MAX_UPLOAD_BODY_BYTES } from '@/lib/images/picture-rules';
import { PROPAGATION_MAX_CHOICES } from '@/lib/masters/default-propagation';
import { MAX_TYPED_VALUE_LENGTH, MAX_VALUES_PER_SAVE, saveInputsBodySchema } from '@/server/views/schemas/form';
import { propagationBodySchema } from '@/server/views/schemas/process-items';

/**
 * #410 (PRF-F-06), ADR-017 decision 3: the app caps the request body it will pass to a route. Next.js reads up to 10 MB of a request into memory before a route's own checks run
 * when a proxy (`src/proxy.ts`) is configured; `experimental.proxyClientMaxBodySize` lowers that. The cap is twice the largest body the portal legitimately sends, between
 * 512 KB and the reverse proxy's 1 MB (`deploy/windows/README.md`, P5), so the app normally decides first. "Legitimate" is what the schemas accept, sized here from the real schemas
 * and constants, so a schema that grows past the cap fails this test and the cap is raised together with the proxy's.
 */

const KB = 1024;
const MB = 1024 * KB;
/** The most bytes one character of typed text takes in UTF-8 (Indian-language text, the rupee sign). */
const UTF8_BYTES_PER_CHARACTER = 3;

function bodyBytes(body: unknown): number {
  return Buffer.byteLength(JSON.stringify(body), 'utf8');
}

/** The biggest save of part inputs the schema accepts: the most values, each at the longest typed length, in text that takes the most bytes. */
function largestSaveInputs(): unknown {
  const values: Record<string, string> = {};
  for (let index = 0; index < MAX_VALUES_PER_SAVE; index += 1) values[randomUUID()] = '₹'.repeat(MAX_TYPED_VALUE_LENGTH);
  return { revision: 2_147_483_647, values };
}

/** The biggest save of choices after a changed default: the most customers, each with the longest value that is shown. */
function largestPropagation(): unknown {
  const choices = Array.from({ length: PROPAGATION_MAX_CHOICES }, () => ({ customerId: randomUUID(), choice: 'apply', shownValue: '999999999999.9999' }));
  return { newDefault: '99.99', choices };
}

const configured = (): unknown => nextConfig.experimental?.proxyClientMaxBodySize;

describe('the largest legitimate bodies, from the real schemas', () => {
  it('a save of part inputs at the schema limits is accepted by the schema, so it is a legitimate body', () => {
    const body = largestSaveInputs();
    expect(saveInputsBodySchema.safeParse(body).success).toBe(true);
    // 64 values of 2,000 characters of 3 bytes each: the figure the cap is sized from.
    expect(bodyBytes(body)).toBeGreaterThan(MAX_VALUES_PER_SAVE * MAX_TYPED_VALUE_LENGTH * UTF8_BYTES_PER_CHARACTER);
  });

  it('a save of 1,000 customer choices at the schema limits is accepted by the schema, and is smaller', () => {
    const body = largestPropagation();
    expect(propagationBodySchema.safeParse(body).success).toBe(true);
    expect(bodyBytes(body)).toBeLessThan(bodyBytes(largestSaveInputs()));
  });
});

describe('experimental.proxyClientMaxBodySize', () => {
  it('is set, as a number of bytes (Next.js would otherwise read 10 MB)', () => {
    expect(typeof configured()).toBe('number');
  });

  it('is between 512 KB and the 1 MB the reverse proxy allows', () => {
    const cap = Number(configured());
    expect(cap).toBeGreaterThanOrEqual(512 * KB);
    expect(cap).toBeLessThanOrEqual(1 * MB);
  });

  it('is at least twice the largest JSON body a person can legitimately send', () => {
    const cap = Number(configured());
    expect(cap).toBeGreaterThanOrEqual(2 * bodyBytes(largestSaveInputs()));
    expect(cap).toBeGreaterThanOrEqual(2 * bodyBytes(largestPropagation()));
  });

  it('is at least twice the picture upload ceiling, which has its own cap while it reads (upload.ts)', () => {
    expect(Number(configured())).toBeGreaterThanOrEqual(2 * MAX_UPLOAD_BODY_BYTES);
  });
});
