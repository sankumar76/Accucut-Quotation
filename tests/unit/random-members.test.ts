import { describe, expect, it } from 'vitest';

import { forbiddenProblem, newRequestId, originRefusedProblem, problemResponse, unauthorizedProblem } from '@/server/http/problem';

import { withoutRequestId, withoutUuids } from '../support/random-members';

/**
 * DEF-028 (AQP-273): a test that scans an answer for the digits of a rate must not read the random request ID or UUID in it.
 * The pattern below is the one the AQP-123 AC-6 decision table uses (and `/838|839/` is its Origin-refusal sibling).
 */

const RATE_SCAN = /838|839|1\.23|4\.56|inr|usd|eur/i;
/** Request IDs that hold the canary digits, the first one the body that failed run 42873078338. */
const UNLUCKY_IDS = ['req-0839e75b', 'req-a838c0de', 'req-83983983', 'req-1838aaaa'];

const textOf = (body: ReturnType<typeof forbiddenProblem>): Promise<string> => problemResponse(body).text();

describe('[DEF-028] withoutRequestId', () => {
  it('a 403, a 401 and an Origin 403 whose request ID holds 838 or 839 fail the raw scan and pass the scan of the rest', async () => {
    for (const id of UNLUCKY_IDS) {
      for (const make of [forbiddenProblem, unauthorizedProblem, originRefusedProblem]) {
        const text = await textOf(make(id));
        expect(text, `the raw body of ${id} is what failed in CI`).toMatch(RATE_SCAN);
        expect(withoutRequestId(text)).not.toMatch(RATE_SCAN);
        expect(withoutRequestId(text)).not.toMatch(/838|839/);
        expect(withoutRequestId(text)).not.toContain('req-');
      }
    }
  });

  it('whatever request ID the server makes, the rest of the body is the same fixed text', async () => {
    const fixed = withoutRequestId(await textOf(forbiddenProblem('req-00000000')));
    for (let run = 0; run < 2000; run += 1) {
      const text = await textOf(forbiddenProblem(newRequestId()));
      expect(withoutRequestId(text)).toBe(fixed);
    }
  });

  it('a rate anywhere else in the body is still found, in a member of the body and in a second member', async () => {
    const withRate = JSON.stringify({ ...forbiddenProblem('req-0839e75b'), rate: '1.23' });
    expect(withoutRequestId(withRate)).toMatch(RATE_SCAN);
    expect(withoutRequestId(withRate)).toContain('1.23');
    const echoed = JSON.stringify({ ...forbiddenProblem('req-0123abcd'), detail: 'usd 839.73' });
    expect(withoutRequestId(echoed)).toMatch(/839/);
  });

  it('only the exact member is removed: an ID of another shape, or a second member, stays in what is scanned', async () => {
    for (const odd of ['req-0839e75b9', 'req-0839E75B', 'req-839', '839', 'REQ-0839e75b', 'req-0839e75g']) {
      const text = JSON.stringify({ ...forbiddenProblem('req-0123abcd'), requestId: odd });
      expect(withoutRequestId(text), odd).toContain('"requestId"');
    }
    const twice = '{"requestId":"req-0123abcd","other":{"requestId":"req-0839e75b"}}';
    expect(withoutRequestId(twice)).toBe('{,"other":{"requestId":"req-0839e75b"}}');
    expect(withoutRequestId('no member here 839')).toBe('no member here 839');
  });
});

describe('[DEF-028] withoutUuids', () => {
  it('a UUID that holds 717, 737 or 917 is removed, and the text around it is kept', () => {
    const text = JSON.stringify([{ id: '7170737a-9171-4737-8917-717737917abc', name: 'Options-material', materialConsidered: 'Invented options' }]);
    expect(text).toMatch(/917|737|717/);
    expect(withoutUuids(text)).not.toMatch(/917|737|717/);
    expect(withoutUuids(text)).toBe('[{"id":"","name":"Options-material","materialConsidered":"Invented options"}]');
  });

  it('a number in any other member is still found, and so is an ID that is not a well-formed UUID', () => {
    const planted = JSON.stringify([{ id: '7170737a-9171-4737-8917-717737917abc', name: 'Options-material', pricePerKg: '917.37' }]);
    expect(withoutUuids(planted)).toMatch(/917/);
    for (const odd of ['7170737a-9171-4737-8917-717737917abcd', '7170737a-9171-4737-8917-717737917ab', '717', 'x7170737a-9171-4737-8917-717737917abc']) {
      expect(withoutUuids(JSON.stringify({ id: odd })), odd).toMatch(/717/);
    }
  });
});
