import { describe, expect, it } from 'vitest';

import { withoutFilled } from '@/lib/estimates/calculate-missing';

/**
 * STORY-05.09 (AC-1): what the screen still shows as missing after a part was saved. The list is the server's from the blocked answer; the fields that now hold a value come off it, and a part
 * with none left is no longer listed. Every name and ID is invented.
 */

const PART = '00000000-0000-4000-8000-0000000000b1';
const FIELD = '00000000-0000-4000-8000-000100000010';

describe('withoutFilled (AC-1): what is still missing after a part is saved', () => {
  const LENGTH = { fieldId: FIELD, label: 'Length' };
  const WIDTH = { fieldId: '00000000-0000-4000-8000-000100000011', label: 'Width' };
  const parts = [
    { nodeId: PART, slNo: '1', name: null, fields: [LENGTH, WIDTH] },
    { nodeId: '00000000-0000-4000-8000-0000000000b2', slNo: '2', name: null, fields: [LENGTH] },
  ];

  it('takes the fields that now hold a value off that part, and no other part\'s', () => {
    expect(withoutFilled(parts, PART, { [FIELD]: '200.00' })).toEqual([
      { nodeId: PART, slNo: '1', name: null, fields: [WIDTH] },
      parts[1],
    ]);
  });

  it('a part with no field left is no longer listed, and nothing left is null', () => {
    const one = withoutFilled(parts, PART, { [FIELD]: '1.00', [WIDTH.fieldId]: '2.00' });
    expect(one?.map((part) => part.slNo)).toEqual(['2']);
    expect(withoutFilled(one ?? [], '00000000-0000-4000-8000-0000000000b2', { [FIELD]: '3.00' })).toBeNull();
  });

  it('a blank or spaces is no value, and a field that is not in the saved inputs is still missing', () => {
    expect(withoutFilled(parts, PART, { [FIELD]: '   ', [WIDTH.fieldId]: '' })).toEqual(parts);
    expect(withoutFilled(parts, PART, {})).toEqual(parts);
  });

  it('a part that is not on the list changes nothing', () => {
    expect(withoutFilled(parts, '00000000-0000-4000-8000-0000000000ff', { [FIELD]: '1.00' })).toEqual(parts);
  });
});

