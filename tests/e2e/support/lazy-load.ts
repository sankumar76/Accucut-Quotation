import type { Locator, Page } from '@playwright/test';

import { isDesktopProject, waitUntilAccountMenuIsLive, waitUntilMenuButtonIsLive } from './design-system';

/**
 * Shared by `shell-lazy-load.spec.ts` (AQP-188): the production server, signed in; a gate that holds, delays or fails the
 * page's scripts; and the pieces of the two controls that load on their first open. No tests here.
 */

/** Every script the build serves. Stylesheets, fonts and images are not held. */
const SCRIPT_URL = /\/_next\/static\/.*\.js(\?.*)?$/;

/** How long a "slow" request waits. The delay is the scenario (AC-8), not a limit on speed. */
export const SLOW_REQUEST_MILLISECONDS = 3_000;

/** Strings that only the lazy modules contain: the drawer's close button label and the account menu's sign-out item. */
export const DRAWER_MARKER = 'Close menu';
export const ACCOUNT_MARKER = 'Sign out';

export const ACCOUNT_FAILURE = 'The account menu did not open. Check your connection and try again.';
export const MENU_FAILURE = 'The menu did not open. Check your connection and try again.';

type Mode = 'pass' | 'hold' | 'slow' | 'fail';

/** Sits in front of every script request of a page: records it and, depending on the mode, lets it through, holds it, delays it or fails it. */
export class ScriptGate {
  mode: Mode = 'pass';
  readonly urls: string[] = [];
  /** Requests that have been let through after a hold or a delay. */
  completed = 0;
  private readonly held: Array<() => void> = [];

  async install(page: Page): Promise<void> {
    await page.route(SCRIPT_URL, async (route) => {
      this.urls.push(route.request().url());
      switch (this.mode) {
        case 'hold':
          await new Promise<void>((resolve) => this.held.push(resolve));
          break;
        case 'slow':
          await new Promise((resolve) => setTimeout(resolve, SLOW_REQUEST_MILLISECONDS));
          break;
        case 'fail':
          await route.abort('failed');
          return;
        case 'pass':
          break;
      }
      await route.continue();
      this.completed += 1;
    });
  }

  /** Lets every held request go, and every later one. */
  release(): void {
    this.mode = 'pass';
    this.held.splice(0).forEach((resolve) => resolve());
  }
}

export const ROUTES = ['/', '/queue'] as const;

/** Opens a signed-in route and waits until it is interactive and quiet, so what is measured next is the first open alone. */
export async function openRouteAndSettle(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await waitUntilAccountMenuIsLive(page);
  if (await page.locator('button[aria-label="Open menu"]').isVisible()) await waitUntilMenuButtonIsLive(page);
  await page.waitForLoadState('networkidle');
}

export interface FirstOpenControl {
  readonly name: 'account menu' | 'menu drawer';
  readonly button: Locator;
  /** What shows when it is open. */
  readonly panel: Locator;
  readonly failureText: string;
  readonly marker: string;
}

/** The account trigger (every width) and the menu button (below 1024 px). */
export function controlsOf(page: Page, projectName: string): FirstOpenControl[] {
  const account: FirstOpenControl = {
    name: 'account menu',
    button: page.getByRole('button', { name: /^Account menu/ }),
    panel: page.getByRole('menu'),
    failureText: ACCOUNT_FAILURE,
    marker: ACCOUNT_MARKER,
  };
  const drawer: FirstOpenControl = {
    name: 'menu drawer',
    button: page.getByRole('button', { name: 'Open menu' }),
    panel: page.getByRole('dialog', { name: 'Menu' }),
    failureText: MENU_FAILURE,
    marker: DRAWER_MARKER,
  };
  return isDesktopProject(projectName) ? [account] : [account, drawer];
}

/** The URLs, of those given, whose script text contains the marker. A script that cannot be read counts as not containing it. */
const scriptTexts = new Map<string, string>();

export async function urlsContaining(page: Page, urls: ReadonlyArray<string>, marker: string): Promise<string[]> {
  const found: string[] = [];
  for (const url of new Set(urls)) {
    let text = scriptTexts.get(url);
    if (text === undefined) {
      const response = await page.request.get(url);
      text = response.ok() ? await response.text() : '';
      scriptTexts.set(url, text);
    }
    if (text.includes(marker)) found.push(url);
  }
  return found;
}

/** Without the query string (the build's deployment id), so a preload link and a request can be compared. */
export const pathOf = (url: string): string => new URL(url, 'http://localhost').pathname;

/** The scripts the HTML names, in `<script src>` and in script preloads. */
export async function scriptsNamedInHtml(page: Page, route: string): Promise<string[]> {
  const html = await (await page.request.get(route)).text();
  const names: string[] = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
    const isScript = tag.startsWith('<script');
    const isScriptPreload = /rel="(?:preload|modulepreload)"/.test(tag) && (/as="script"/.test(tag) || /rel="modulepreload"/.test(tag));
    const address = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if ((isScript || isScriptPreload) && address !== undefined) names.push(pathOf(address));
  }
  return names;
}

/** Collects `layout-shift` entries from now on. */
export async function watchLayoutShift(page: Page): Promise<void> {
  await page.evaluate(() => {
    const entries: number[] = [];
    Reflect.set(window, '__layoutShifts', entries);
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => entries.push(Reflect.get(entry, 'value') as number))).observe({ type: 'layout-shift' });
  });
}

export async function layoutShifts(page: Page): Promise<number[]> {
  // Entries are delivered asynchronously; a frame later they are in.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => Array.from(Reflect.get(window, '__layoutShifts') as number[]));
}

export type Boxes = Record<string, { x: number; y: number; width: number; height: number } | null>;

/** The bounding boxes AC-7 compares: the top bar, the menu button, the account trigger, `main` and the side menu. */
export async function boxesOf(page: Page): Promise<Boxes> {
  const selectors: Record<string, string> = {
    'top bar': 'header',
    'menu button': 'button[aria-label="Open menu"]',
    'account trigger': 'button[aria-label^="Account menu"]',
    main: 'main',
    'side menu': 'aside',
  };
  const boxes: Boxes = {};
  for (const [name, selector] of Object.entries(selectors)) boxes[name] = await page.locator(selector).first().boundingBox();
  return boxes;
}
