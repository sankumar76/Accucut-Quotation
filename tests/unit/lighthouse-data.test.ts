import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import {
  COST_CODE,
  CUSTOMER_COUNT,
  INVENTED_EXCHANGE_RATES,
  INVENTED_MATERIAL,
  INVENTED_RATE,
  MATERIAL_COUNT,
  PROCESS_ITEM_TOTAL,
  QUEUE_CODE_PREFIX,
  QUEUE_ENGINEER_COUNT,
  QUEUE_TASK_COUNT,
  SEED_PROCESS_ITEM_COUNT,
  WORKSPACE_CODE,
  leadEmail,
  queueEngineerEmail,
  queueTaskCode,
} from '../../scripts/lib/lighthouse-data';

/**
 * G8-C-NFR9 (DL-251): the five key screens of `lighthouserc.cjs` and the data that the Lighthouse run's seed script makes for them are held to each other here, because the nightly run
 * is the only other place they meet. The seed's SQL is run by the nightly job on a pull request that changes it, not here.
 */

const require = createRequire(import.meta.url);
const rc: { readonly KEY_SCREENS: ReadonlyArray<{ readonly path: string; readonly role: string }> } = require('../../lighthouserc.cjs');

describe('the key screens of the Lighthouse run', () => {
  it('are the five of NFR-009 (queue, assign, masters, workspace, cost view), each as the role that uses it', () => {
    expect(rc.KEY_SCREENS).toEqual([
      { path: '/queue', role: 'ADMIN' },
      { path: '/assign', role: 'ADMIN' },
      { path: '/masters/customers', role: 'ADMIN' },
      { path: `/estimates/${WORKSPACE_CODE}`, role: 'ENGINEER' },
      { path: `/estimates/${COST_CODE}/costs/1`, role: 'ADMIN' },
    ]);
  });

  it('name two different tasks, with codes that no queue task has, in the shape of a task code', () => {
    expect(WORKSPACE_CODE).not.toBe(COST_CODE);
    for (const code of [WORKSPACE_CODE, COST_CODE]) {
      expect(code).toMatch(/^Q-\d{4}-\d{4}$/);
      expect(code.startsWith(QUEUE_CODE_PREFIX)).toBe(false);
    }
  });
});

describe('the planning volume (PRD NFR-011)', () => {
  it('is 500 customers with a rate for each of 50 Process Master items, 200 materials and fewer than 50 people', () => {
    expect(CUSTOMER_COUNT).toBe(500);
    expect(PROCESS_ITEM_TOTAL).toBe(50);
    expect(CUSTOMER_COUNT * PROCESS_ITEM_TOTAL).toBe(25_000);
    expect(MATERIAL_COUNT).toBe(200);
    // The Admin, the Lead, the queue's Engineers and the measurement Engineer.
    expect(1 + 1 + QUEUE_ENGINEER_COUNT + 1).toBeLessThan(50);
  });

  it('adds items to the 15 the migration makes, never below them', () => {
    expect(SEED_PROCESS_ITEM_COUNT).toBe(15);
    expect(PROCESS_ITEM_TOTAL).toBeGreaterThan(SEED_PROCESS_ITEM_COUNT);
  });

  it('gives every Engineer of the queue tasks, so the queue is not one person\'s', () => {
    expect(QUEUE_TASK_COUNT).toBeGreaterThanOrEqual(QUEUE_ENGINEER_COUNT);
  });
});

describe('the invented values', () => {
  it('follow the n.37 pattern of the placeholders, so a real number pasted in by mistake stands out (NFR-006)', () => {
    const numbers = [INVENTED_RATE, INVENTED_MATERIAL.pricePerKg, INVENTED_MATERIAL.scrapRate, ...INVENTED_EXCHANGE_RATES.map((rate) => rate.inrValue)];
    for (const text of numbers) expect(text, text).toMatch(/^\d+\.37$/);
  });

  it('have both exchange rates, USD and EUR', () => {
    expect(INVENTED_EXCHANGE_RATES.map((rate) => rate.currency)).toEqual(['USD', 'EUR']);
  });

  it('make e-mail addresses and task codes that are different for each person and task, on the reserved example domain', () => {
    const emails = [leadEmail(), ...Array.from({ length: QUEUE_ENGINEER_COUNT }, (_, index) => queueEngineerEmail(index + 1))];
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email).toMatch(/@example\.test$/);
    expect(queueTaskCode(1)).toBe('Q-2098-0001');
    expect(queueTaskCode(QUEUE_TASK_COUNT)).toBe('Q-2098-0300');
    expect(new Set(Array.from({ length: QUEUE_TASK_COUNT }, (_, index) => queueTaskCode(index + 1))).size).toBe(QUEUE_TASK_COUNT);
  });
});
