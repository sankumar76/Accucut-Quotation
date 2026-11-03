import { describe, expect, it } from 'vitest';

import { deepFreeze } from '@/lib/deep-freeze';

import { defined } from '../../support/defined';
import { cloneSeedConfig, seedConfig } from '../../support/seed-config';

/** QLT-07: the seed is one object shared by production and every test, so it is frozen. */

describe('the shared seed is deep-frozen (QLT-07)', () => {
  it('freezes the document and everything inside it', () => {
    expect(Object.isFrozen(seedConfig)).toBe(true);
    expect(Object.isFrozen(seedConfig.fields)).toBe(true);
    expect(Object.isFrozen(defined(seedConfig.fields[0]))).toBe(true);
    expect(Object.isFrozen(defined(seedConfig.stages[2]).subHeadings)).toBe(true);
  });

  it('refuses a write, so a test that edits it by mistake fails at once', () => {
    expect(() => {
      defined(seedConfig.fields[0]).label = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      seedConfig.fields.push(defined(seedConfig.fields[0]));
    }).toThrow(TypeError);
  });

  it('cloneSeedConfig gives a copy that can be edited without touching the seed', () => {
    const copy = cloneSeedConfig();
    expect(Object.isFrozen(copy)).toBe(false);
    defined(copy.fields[0]).label = 'changed';
    expect(defined(seedConfig.fields[0]).label).not.toBe('changed');
  });
});

describe('deepFreeze', () => {
  it('freezes nested objects and arrays, returns the same value, and leaves primitives alone', () => {
    const value = { list: [{ inner: 1 }], name: 'x' };
    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value.list[0])).toBe(true);
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze(null)).toBeNull();
  });

  it('QLT-12: does not stop at a parent that is already frozen (a shallow freeze is not enough)', () => {
    const shallow = Object.freeze({ inner: { deep: [{ leaf: 1 }] } });
    const frozen = deepFreeze(shallow);
    expect(Object.isFrozen(frozen.inner)).toBe(true);
    expect(Object.isFrozen(frozen.inner.deep)).toBe(true);
    expect(Object.isFrozen(defined(frozen.inner.deep[0]))).toBe(true);
  });

  it('QLT-12: freezes a shared child once and still ends on a cycle', () => {
    const shared = { n: 1 };
    const value: { a: unknown; b: unknown; loop?: unknown } = { a: shared, b: shared };
    value.loop = value;
    deepFreeze(value);
    expect(Object.isFrozen(shared)).toBe(true);
  });

  it('copes with a value that is already frozen and with a cycle', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => deepFreeze(cyclic)).not.toThrow();
    expect(Object.isFrozen(cyclic)).toBe(true);
    expect(deepFreeze(Object.freeze({ a: 1 }))).toEqual({ a: 1 });
  });
});
