import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { describeBreach, firstLoadModules, lazyModules, overlayBreaches, overlayHolders, readSources } from '../support/overlay-imports';

/**
 * AQP-339 AC-6 (ADR-016, architecture section 10, the overlay rule of AQP-188): no module that holds an overlay (Sheet, Dialog, AlertDialog, DropdownMenu, Popover), and no module that a
 * component fetches with `import()`, is reachable from a route by plain imports. Until now only the bundle-size check of CI stage 11b noticed a breach, after the fact: `parts-tree-area.tsx`
 * imported `Sheet` statically and put Radix Dialog (about 14 KB gzip) in the first load of `/estimates/[code]` at every width. The analysis is in `tests/support/overlay-imports.ts`; the
 * planted sources below show it able to fail.
 */

/** What the real tree gives. The whole of `src` is parsed once, in `beforeAll` under the hook limit (vitest.config.ts, DL-057), not in a test with the 5 s default: a loaded CI worker takes longer than that. */
interface RealTree {
  readonly breaches: ReadonlyArray<string>;
  readonly holders: ReadonlyArray<string>;
  readonly lazy: ReadonlyArray<string>;
  readonly firstLoad: ReadonlySet<string>;
}
let real: RealTree;

beforeAll(() => {
  const sources = readSources(join(__dirname, '..', '..'));
  real = { breaches: overlayBreaches(sources).map(describeBreach), holders: overlayHolders(sources), lazy: lazyModules(sources), firstLoad: firstLoadModules(sources) };
});

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
    expect(real.breaches).toEqual([]);
  });

  it('is not passing for want of anything to check: the overlays and lazy modules of architecture section 10 are all seen', () => {
    const holders = real.holders;
    for (const name of [
      'src/components/shared/menu-drawer.tsx',
      'src/components/shared/account-menu-panel.tsx',
      'src/components/features/estimate-workspace/change-customer-dialog.tsx',
      'src/components/features/estimate-workspace/delete-part-dialog.tsx',
      // The quantity-warning dialog (STORY-05.12, STORY-06.10): the one AlertDialog of the Engineer's SCR-05 and the Lead's SCR-06 is the shared view; each page's own file wraps it and is lazy.
      'src/components/shared/quantity-warning-dialog.tsx',
      'src/components/features/estimate-workspace/parts-tree-drawer.tsx',
      // The multi-select of the surface treatments (STORY-05.06) holds a Popover; it is reached only through part-fields.tsx, which is lazy.
      'src/components/features/estimate-workspace/surface-treatments.tsx',
      // "Leave without saving?" (STORY-05.08): an AlertDialog, reached only through leave-guard.tsx, which is lazy.
      'src/components/features/estimate-workspace/leave-dialog.tsx',
      // "Approve and lock" (STORY-06.06): a Dialog, fetched on the first press of the Approve button, which imports its props as a type only.
      'src/components/features/estimate-approve/approve-dialog.tsx',
    ]) {
      expect(holders, name).toContain(name);
    }
    const lazy = real.lazy;
    for (const name of [
      'src/components/shared/menu-drawer.tsx',
      'src/components/features/masters/exchange-rates-panel.tsx',
      'src/components/features/masters/treatment-panel.tsx',
      'src/components/features/auth/portal-account-panel.tsx',
      'src/components/features/estimate-workspace/change-customer-dialog.tsx',
      'src/components/features/estimate-workspace/delete-part-dialog.tsx',
      'src/components/features/estimate-workspace/parts-tree-drawer.tsx',
      'src/components/features/estimate-workspace/part-fields.tsx',
      // The Calculate bar holds the quantity-warning dialog of AQP-318 with a plain import, so the bar must stay lazy.
      'src/components/features/estimate-workspace/calculate-bar.tsx',
      // The warning on leaving holds the AlertDialog of STORY-05.08 with a plain import, so the guard must stay lazy.
      'src/components/features/estimate-workspace/leave-guard.tsx',
      // The dialog of "Approve and lock" is fetched on the first press (STORY-06.06, ADR-016).
      'src/components/features/estimate-approve/approve-dialog.tsx',
      // The Lead's quantity warning is fetched when the server answers a Recalculate with the 409 (STORY-06.10, ADR-016).
      'src/components/features/estimate-recalculate/recalculate-warning-dialog.tsx',
    ]) {
      expect(lazy, name).toContain(name);
    }
  });

  it('keeps the part form fields out of the first load of the estimate page (AQP-339 AC-4, AC-5: focus-field.ts reaches them through field-ids.ts only)', () => {
    const firstLoad = real.firstLoad;
    const folder = 'src/components/features/estimate-workspace';
    expect(firstLoad, 'the page itself is in the first load').toContain(`${folder}/estimate-workspace.tsx`);
    expect(firstLoad, 'the focus helper is in the first load').toContain(`${folder}/focus-field.ts`);
    expect(firstLoad, 'and so are the ids it uses').toContain(`${folder}/field-ids.ts`);
    expect(firstLoad, 'PartForm reads the definition through a module of its own').toContain(`${folder}/use-form-definition.ts`);
    for (const name of ['part-fields', 'field-renderer', 'section-card', 'section-strip', 'surface-treatments', 'treatment-select', 'picture-slot', 'parts-tree-drawer']) {
      expect(firstLoad, name).not.toContain(`${folder}/${name}.tsx`);
    }
    // What reads and saves a part's values goes with the fields: `use-part-form.ts` may not come back into the first load through the definition hook.
    for (const path of [`${folder}/use-part-form.ts`, 'src/lib/estimates/form-values.ts']) {
      expect(firstLoad, path).not.toContain(path);
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
