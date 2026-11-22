import { describe, expect, it } from 'vitest';

import { checkPasswordRule } from '../../src/lib/auth/password-rule';
import { PHASES, inventedPassword, readConfig, LoadConfigError } from '../perf/load/config';

/** STORY-10.09 AC-1, AC-3, AC-10 (test strategy 8.2): the load script's settings. The defaults are the figures of NFR-010 and NFR-011; a message names a variable, never a value; no password is printed. */

const ADMIN = { MEASUREMENT_ADMIN_EMAIL: 'perf-admin@example.test', MEASUREMENT_ADMIN_PASSWORD: 'an-invented-admin-password-1!' } as const;

describe('AC-1 and AC-3: the defaults are the loads and the volume the PRD names', () => {
  const config = readConfig(ADMIN);

  it('is 25 then 50 users, 40 requests per line each, 1 s think time', () => {
    expect([config.usersLow, config.usersHigh, config.requestsPerLine, config.thinkMs]).toEqual([25, 50, 40, 1_000]);
  });

  it('is 500 customers, 50 Process Master items in all, 200 materials, 50 treatments and two estimates of 500 parts', () => {
    expect([config.customers, config.processItemsTotal, config.materials, config.treatments, config.parts]).toEqual([500, 50, 200, 50, 500]);
    expect(config.saveEstimates).toBe(5);
  });

  it('runs 20 own-password changes in series, at least two exports and for at least 30 s with 50 pictures, every phase, on localhost:3000', () => {
    expect(config.passwordRuns).toBe(20);
    expect(config.exportRuns).toBe(2);
    expect(config.exportMinSeconds).toBe(30);
    expect(config.exportPictures).toBe(50);
    expect([...config.phases]).toEqual([...PHASES]);
    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(config.passwordReportOnly).toBe(false);
  });
});

describe('AC-10: the Admin comes from the environment and nothing prints a password', () => {
  it('names the missing variable and not a value', () => {
    expect(() => readConfig({})).toThrow('MEASUREMENT_ADMIN_EMAIL is not set');
    expect(() => readConfig({ MEASUREMENT_ADMIN_EMAIL: 'perf-admin@example.test' })).toThrow('MEASUREMENT_ADMIN_PASSWORD is not set');
  });

  it('does not put the Admin password, or either own-password password, in the message of any refusal', () => {
    const secrets = { ...ADMIN, LOAD_PASSWORD_A: 'secret-a-1!', LOAD_PASSWORD_B: 'secret-b-2!' };
    for (const bad of [{ LOAD_USERS_LOW: 'x' }, { LOAD_BASE_URL: 'ftp://host' }, { LOAD_PHASES: 'nope' }, { LOAD_PARTS: '3', LOAD_USERS_HIGH: '60' }]) {
      let message = '';
      try {
        readConfig({ ...secrets, ...bad });
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }
      expect(message, JSON.stringify(bad)).not.toBe('');
      for (const secret of ['an-invented-admin-password-1!', 'secret-a-1!', 'secret-b-2!']) expect(message).not.toContain(secret);
    }
  });

  it('makes two different invented passwords at random when none are given, and refuses two that are the same', () => {
    const config = readConfig(ADMIN);
    expect(config.passwordA).not.toBe(config.passwordB);
    expect(() => readConfig({ ...ADMIN, LOAD_PASSWORD_A: 'same-1!-same', LOAD_PASSWORD_B: 'same-1!-same' })).toThrow(LoadConfigError);
  });

  it('makes passwords that pass the portal\'s own rule (length, a number, a symbol, not the e-mail)', () => {
    for (let n = 0; n < 20; n += 1) expect(checkPasswordRule(inventedPassword(), { email: 'load-engineer-x@example.test', subject: 'self' })).toBeNull();
  });
});

describe('AC-1: the base address, the sizes and the phases are checked', () => {
  it('takes the origin only: a trailing slash goes, a path or another protocol is refused', () => {
    expect(readConfig({ ...ADMIN, LOAD_BASE_URL: 'https://portal.example.test/' }).baseUrl).toBe('https://portal.example.test');
    expect(() => readConfig({ ...ADMIN, LOAD_BASE_URL: 'https://portal.example.test/app' })).toThrow('origin only');
    expect(() => readConfig({ ...ADMIN, LOAD_BASE_URL: 'ftp://portal.example.test' })).toThrow('http:// or https://');
    expect(() => readConfig({ ...ADMIN, LOAD_BASE_URL: 'not a url' })).toThrow('not a web address');
  });

  it('refuses a size that is not a whole number in its range', () => {
    expect(() => readConfig({ ...ADMIN, LOAD_USERS_LOW: '2.5' })).toThrow('LOAD_USERS_LOW must be a whole number from 1 to 200');
    expect(() => readConfig({ ...ADMIN, LOAD_THINK_MS: '-1' })).toThrow('LOAD_THINK_MS');
    expect(() => readConfig({ ...ADMIN, LOAD_PROCESS_ITEMS: '14' })).toThrow('LOAD_PROCESS_ITEMS');
  });

  it('runs the phases it is given and refuses a name it does not know', () => {
    expect([...readConfig({ ...ADMIN, LOAD_PHASES: 'volume, export' }).phases]).toEqual(['volume', 'export']);
    expect(() => readConfig({ ...ADMIN, LOAD_PHASES: 'volume,soak' })).toThrow('"soak"');
  });

  it('needs at least as many parts (over the estimates the saves go to) as virtual users, so no two users save into one part', () => {
    expect(() => readConfig({ ...ADMIN, LOAD_PARTS: '8' })).toThrow('LOAD_PARTS times LOAD_SAVE_ESTIMATES must be at least as many as the virtual users');
    expect(readConfig({ ...ADMIN, LOAD_PARTS: '10' }).parts).toBe(10);
    expect(readConfig({ ...ADMIN, LOAD_PARTS: '50', LOAD_SAVE_ESTIMATES: '1' }).saveEstimates).toBe(1);
  });

  it('refuses more export pictures than parts', () => {
    expect(() => readConfig({ ...ADMIN, LOAD_PARTS: '100', LOAD_EXPORT_PICTURES: '101' })).toThrow('LOAD_EXPORT_PICTURES must not be more than LOAD_PARTS');
    expect(readConfig({ ...ADMIN, LOAD_PARTS: '100', LOAD_EXPORT_PICTURES: '100' }).exportPictures).toBe(100);
  });

  it('reports the own-password line only when it is told so (the CI runner)', () => {
    expect(readConfig({ ...ADMIN, LOAD_PASSWORD_REPORT_ONLY: '1' }).passwordReportOnly).toBe(true);
  });
});
