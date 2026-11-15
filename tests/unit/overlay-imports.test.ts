import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describeBreach, lazyModules, overlayBreaches, overlayHolders, readSources } from '../support/overlay-imports';

/**
 * AQP-339 AC-6 (ADR-016, architecture section 10, the overlay rule of AQP-188): no module that holds an overlay (Sheet, Dialog, AlertDialog, DropdownMenu, Popover), and no module that a
 * component fetches with `import()`, is reachable from a route by plain imports. Until now only the bundle-size check of CI stage 11b noticed a breach, after the fact: `parts-tree-area.tsx`
 * imported `Sheet` statically and put Radix Dialog (about 14 KB gzip) in the first load of `/estimates/[code]` at every width. The analysis is in `tests/support/overlay-imports.ts`; the
 * planted sources below show it able to fail.
 */

const sources = readSources(join(__dirname, '..', '..'));

/** The paths of a small planted tree: a route page, a first-load component and what it imports. */
const PAGE = 'src/app/(portal)/demo/page.tsx';
const SCREEN = 'src/components/features/demo/demo-screen.tsx';
const DRAWER = 'src/components/features/demo/demo-drawer.tsx';
const PANEL = 'src/components/features/demo/demo-panel.tsx';
const SHEET = 'src/components/ui/sheet.tsx';

const planted = (screen: string, extra: Readonly<Record<string, string>> = {}): Record<string, string> => ({
  [PAGE]: "import { DemoScreen } from '@/components/features/demo/demo-screen';\nexport default function Page() { return DemoScreen; }\n",
  [SCREEN]: screen,
  [SHEET]: 'export const Sheet = 1;\n',
  [DRAWER]: "import { Sheet } from '@/components/ui/sheet';\nexport const DemoDrawer = Sheet;\n",
  [PANEL]: "import { DemoDrawer } from './demo-drawer';\nexport const DemoPanel = DemoDrawer;\n",
  ...extra,
});

describe('overlay imports (AQP-339 AC-6)', () => {
  it('finds no overlay holder and no lazy module in the first load of any route', () => {
    expect(overlayBreaches(sources).map(describeBreach)).toEqual([]);
  });

  it('is not passing for want of anything to check: the overlays and lazy modules of architecture section 10 are all seen', () => {
    const holders = overlayHolders(sources);
    for (const name of [
      'src/components/shared/menu-drawer.tsx',
      'src/components/shared/account-menu-panel.tsx',
      'src/components/features/estimate-workspace/change-customer-dialog.tsx',
      'src/components/features/estimate-workspace/delete-part-dialog.tsx',
      'src/components/features/estimate-workspace/parts-tree-drawer.tsx',
    ]) {
      expect(holders, name).toContain(name);
    }
    const lazy = lazyModules(sources);
    for (const name of [
      'src/components/shared/menu-drawer.tsx',
      'src/components/features/masters/exchange-rates-panel.tsx',
      'src/components/features/masters/treatment-panel.tsx',
      'src/components/features/auth/portal-account-panel.tsx',
      'src/components/features/estimate-workspace/change-customer-dialog.tsx',
      'src/components/features/estimate-workspace/delete-part-dialog.tsx',
      'src/components/features/estimate-workspace/parts-tree-drawer.tsx',
      'src/components/features/estimate-workspace/part-fields.tsx',
    ]) {
      expect(lazy, name).toContain(name);
    }
  });

  it('fails when a first-load component imports an overlay holder with a plain import, and names the file and line', () => {
    const breaches = overlayBreaches(planted("import { DemoDrawer } from './demo-drawer';\nexport const DemoScreen = DemoDrawer;\n"));
    expect(breaches).toEqual([{ module: DRAWER, reason: 'holds-an-overlay', importer: SCREEN, line: 1, root: PAGE }]);
    expect(breaches.map(describeBreach).join('\n')).toContain(`${SCREEN}:1`);
  });

  it('fails when the plain import is two steps away (the chain is followed, not only the direct importer)', () => {
    const breaches = overlayBreaches(planted("import { DemoPanel } from './demo-panel';\nexport const DemoScreen = DemoPanel;\n"));
    // The panel holds no overlay itself: the breach is the panel's own plain import of the drawer, found because the walk goes through the panel.
    expect(breaches).toEqual([{ module: DRAWER, reason: 'holds-an-overlay', importer: PANEL, line: 1, root: PAGE }]);
  });

  it('fails when a first-load component imports a module that another component fetches with import()', () => {
    const lazyPanel = 'src/components/features/demo/lazy-panel.tsx';
    const breaches = overlayBreaches(
      planted("import { LazyPanel } from './lazy-panel';\nexport const loadLater = () => import('./lazy-panel');\nexport const DemoScreen = LazyPanel;\n", {
        [lazyPanel]: 'export const LazyPanel = 1;\n',
      }),
    );
    expect(breaches).toEqual([{ module: lazyPanel, reason: 'is-loaded-lazily', importer: SCREEN, line: 1, root: PAGE }]);
  });

  it('fails when a first-load component imports a shadcn overlay module directly', () => {
    const breaches = overlayBreaches(planted("import { Sheet } from '@/components/ui/sheet';\nexport const DemoScreen = Sheet;\n"));
    expect(breaches.map((breach) => breach.module)).toEqual([SCREEN]);
  });

  it('passes when the holder is reached only through import() or import type', () => {
    const screen = [
      "import type { DemoDrawerProps } from './demo-drawer';",
      "const loadDrawer = () => import('./demo-drawer').then((module) => module.DemoDrawer);",
      'export const DemoScreen = [loadDrawer] as unknown as DemoDrawerProps;',
      '',
    ].join('\n');
    expect(overlayBreaches(planted(screen, { [DRAWER]: "import { Sheet } from '@/components/ui/sheet';\nexport interface DemoDrawerProps { x: 1 }\nexport const DemoDrawer = Sheet;\n" }))).toEqual([]);
  });

  it('passes for a lazy panel that holds its own dialogs with plain imports, because no route reaches the panel by one', () => {
    const screen = "export const loadPanel = () => import('./demo-panel');\nexport const DemoScreen = loadPanel;\n";
    expect(overlayBreaches(planted(screen))).toEqual([]);
  });
});
