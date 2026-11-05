import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * STORY-10.10 AC-6: the Lighthouse configuration is read and checked. The Wi-Fi profile is the pass-or-fail one, the
 * Slow 4G profile is report only, the browser is Playwright's Chromium, the reports stay on disk, and the dependency is
 * pinned exactly and brings no install script. Lighthouse itself is not run here (the nightly workflow runs it).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const CONFIG_PATH = require.resolve('../../lighthouserc.cjs');

interface Screen {
  readonly path: string;
  readonly role: string;
}
interface Loaded {
  readonly ci: {
    readonly collect: {
      readonly url: ReadonlyArray<string>;
      readonly numberOfRuns: number;
      readonly chromePath: string;
      readonly puppeteerScript: string;
      readonly settings: Record<string, unknown>;
    };
    readonly assert?: { readonly assertMatrix: ReadonlyArray<{ readonly matchingUrlPattern: string; readonly assertions: Record<string, unknown> }> };
    readonly upload: Record<string, unknown>;
  };
  readonly buildConfig: (input: { profile: string; baseUrl: string; keyScreens: ReadonlyArray<Screen>; reportedPages: ReadonlyArray<Screen>; env: Record<string, string> }) => Loaded;
  readonly KEY_SCREENS: ReadonlyArray<Screen>;
  readonly REPORTED_PAGES: ReadonlyArray<Screen>;
}

const SETTINGS = ['LHCI_PROFILE', 'LHCI_BASE_URL', 'LHCI_CHROME_PATH'] as const;

/** Loads the file afresh with the given settings in the environment (and no others), as `lhci` does. */
function load(environment: Partial<Record<(typeof SETTINGS)[number], string>> = {}): Loaded {
  const saved = Object.fromEntries(SETTINGS.map((name) => [name, process.env[name]]));
  const apply = (values: Partial<Record<string, string | undefined>>): void => {
    for (const name of SETTINGS) {
      const value = values[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  apply(environment);
  delete require.cache[CONFIG_PATH];
  try {
    const loaded: Loaded = require(CONFIG_PATH);
    return loaded;
  } finally {
    apply(saved);
    delete require.cache[CONFIG_PATH];
  }
}

const WIFI_THROTTLING = { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 4 };
const SLOW_4G_THROTTLING = { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 };

describe('the Wi-Fi profile (pass or fail)', () => {
  const { ci } = load();

  it('uses the mobile form factor at 360 by 800, simulated throttling and only the performance category', () => {
    expect(ci.collect.settings).toEqual({
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 1.75, disabled: false },
      throttlingMethod: 'simulate',
      throttling: WIFI_THROTTLING,
      onlyCategories: ['performance'],
      disableStorageReset: true,
    });
  });

  it('takes 5 runs per page', () => {
    expect(ci.collect.numberOfRuns).toBe(5);
  });

  it('is the default when no profile is named', () => {
    expect(load({ LHCI_PROFILE: 'wifi' }).ci.collect.settings).toEqual(ci.collect.settings);
  });
});

describe('the Slow 4G profile (report only)', () => {
  const { ci } = load({ LHCI_PROFILE: 'slow4g' });

  it('is the same settings with the slower network', () => {
    expect(ci.collect.settings).toEqual({ ...load().ci.collect.settings, throttling: SLOW_4G_THROTTLING });
    expect(ci.collect.numberOfRuns).toBe(5);
  });

  it('has no assertions, even for a key screen', () => {
    expect(ci.assert).toBeUndefined();
    const { buildConfig } = load();
    const withScreen = buildConfig({ profile: 'slow4g', baseUrl: 'http://localhost:3999', keyScreens: [{ path: '/queue', role: 'ADMIN' }], reportedPages: [], env: {} });
    expect(withScreen.ci.assert).toBeUndefined();
  });

  it('writes its reports to its own folder', () => {
    expect(ci.upload).toEqual({ target: 'filesystem', outputDir: 'lighthouse-reports/slow4g' });
  });
});

describe('the pages and the assertions', () => {
  it('lists no key screen when the story merges, and reports "/" without an assertion', () => {
    const loaded = load({ LHCI_BASE_URL: 'http://localhost:3999/' });
    expect(loaded.KEY_SCREENS).toEqual([]);
    expect(loaded.REPORTED_PAGES).toEqual([{ path: '/', role: 'ADMIN' }]);
    expect(loaded.ci.collect.url).toEqual(['http://localhost:3999/']);
    expect(loaded.ci.assert).toBeUndefined();
  });

  it('asserts LCP at most 2,000 ms and TBT at most 200 ms, each as the median, on every key screen and on no other page', () => {
    const { buildConfig } = load();
    const { ci } = buildConfig({
      profile: 'wifi',
      baseUrl: 'http://localhost:3999',
      keyScreens: [{ path: '/queue', role: 'LEAD' }, { path: '/masters', role: 'ADMIN' }],
      reportedPages: [{ path: '/', role: 'ADMIN' }],
      env: {},
    });
    expect(ci.collect.url).toEqual(['http://localhost:3999/queue', 'http://localhost:3999/masters', 'http://localhost:3999/']);
    expect(ci.assert?.assertMatrix).toHaveLength(2);
    for (const entry of ci.assert?.assertMatrix ?? []) {
      expect(entry.assertions).toEqual({
        'largest-contentful-paint': ['error', { maxNumericValue: 2000, aggregationMethod: 'median' }],
        'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
      });
    }
    const patterns = (ci.assert?.assertMatrix ?? []).map((entry) => new RegExp(entry.matchingUrlPattern));
    expect(patterns.some((pattern) => pattern.test('http://localhost:3999/queue'))).toBe(true);
    expect(patterns.some((pattern) => pattern.test('http://localhost:3999/'))).toBe(false);
    expect(patterns.some((pattern) => pattern.test('http://localhost:3999/queue2'))).toBe(false);
    expect(patterns.some((pattern) => pattern.test('http://localhost:3999/queue?x=1'))).toBe(false);
  });

  it('refuses a profile it does not know', () => {
    expect(() => load({ LHCI_PROFILE: 'fast' })).toThrow('LHCI_PROFILE must be one of: wifi, slow4g');
  });
});

describe('the browser, the sign-in and the reports', () => {
  it('uses the Chromium that Playwright installs, unless the path is set', () => {
    expect(load().ci.collect.chromePath).toBe(chromium.executablePath());
    expect(load({ LHCI_CHROME_PATH: '/opt/chromium/chrome' }).ci.collect.chromePath).toBe('/opt/chromium/chrome');
  });

  it('signs in through a script that exists, and keeps the reports on disk with nothing uploaded to a server', () => {
    const { ci } = load();
    expect(ci.collect.puppeteerScript).toBe('./scripts/lighthouse-sign-in.cjs');
    expect(existsSync(`${ROOT}scripts/lighthouse-sign-in.cjs`)).toBe(true);
    expect(ci.upload).toEqual({ target: 'filesystem', outputDir: 'lighthouse-reports/wifi' });
    expect(JSON.stringify(ci)).not.toMatch(/token|serverBaseUrl|temporary-public-storage/i);
  });
});

describe('the dependency', () => {
  const manifest = z.object({ devDependencies: z.record(z.string(), z.string()), dependencies: z.record(z.string(), z.string()) }).parse(JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')));
  const lock = z.object({ packages: z.record(z.string(), z.object({ version: z.string().optional(), hasInstallScript: z.boolean().optional() })) }).parse(JSON.parse(readFileSync(`${ROOT}package-lock.json`, 'utf8')));

  it('is @lhci/cli 0.15.1, exact, and a development dependency only', () => {
    expect(manifest.devDependencies['@lhci/cli']).toBe('0.15.1');
    expect(manifest.dependencies['@lhci/cli']).toBeUndefined();
    expect(lock.packages['node_modules/@lhci/cli']?.version).toBe('0.15.1');
  });

  it('runs Lighthouse 12.6.1', () => {
    expect(lock.packages['node_modules/lighthouse']?.version).toBe('12.6.1');
  });

  it('brings no install script, so the allowScripts list stays as it is', () => {
    const withScripts = Object.entries(lock.packages)
      .filter(([path, entry]) => entry.hasInstallScript === true && /node_modules\/(@lhci\/|lighthouse$|puppeteer-core$|chrome-launcher$)/.test(path))
      .map(([path]) => path);
    expect(withScripts).toEqual([]);
  });
});
