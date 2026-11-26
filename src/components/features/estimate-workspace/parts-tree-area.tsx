'use client';

import { GitBranch } from 'lucide-react';
import { useRef, useState } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { Icon } from '@/components/shared/icon';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { useViewport } from '@/components/shared/use-viewport';
import { Button } from '@/components/ui/button';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import { TREE_HIDE } from './estimate-texts';
import type { PartsTreeDrawerProps } from './parts-tree-drawer';
import { TreeButtonLabel } from './tree-button-label';
import { TreePanel } from './tree-panel';
import { LazyTreeResizeHandle, LazyTreeWidthMenu } from './tree-resize-slots';
import { TREE_COLUMN_ID, useMounted, type TreeWidth } from './use-tree-width';
import type { PartsTreeState } from './use-parts-tree';

export interface PartsTreeAreaProps {
  /** The tree and what its buttons do: it lives in the workspace, because the part form beside it follows the part chosen here. */
  readonly tree: PartsTreeState;
  readonly editable: boolean;
  /** Enter on a part: its form takes the focus (STORY-05.03, review SQR-11). On a phone the drawer closes first, and the focus goes to the form when it has. */
  readonly onOpenPart: () => void;
  /** The parts Calculate found a missing input in (STORY-05.09). */
  readonly missingIds?: ReadonlySet<string>;
  /** The width of the column and what changes it (AQP-426): from 1024 px, in the browser, the column has its resize handle and the head its "Tree width" button. */
  readonly resize: TreeWidth;
  /** True once the part form has shown (or there is no part to show it for): only then are the handle's and the menu's code fetched, so it never competes with the form's. Their places are kept meanwhile. */
  readonly controlsReady: boolean;
}

const DRAWER_FAILURE_ID = 'parts-tree-first-open-failure';
const DRAWER_FAILURE_MESSAGE = 'The parts tree did not open. Check your connection and try again.';

/** The drawer's code: a bare `import()` behind a type-only import above, so a failed request can be tried again and none of it is in the first load (AQP-188, NFR-009, ADR-016 E1). */
const loadDrawer = () => import('./parts-tree-drawer').then((module) => module.PartsTreeDrawer);

/**
 * The parts tree where it belongs at each width (STORY-05.02 AC-9; UX spec SCR-05 "Responsive"): from 1024 px a persistent panel beside the form; from 768 px a collapsible
 * panel that the "Parts tree" button shows and hides; below 768 px that button opens the tree as a left drawer (`PartsTreeDrawer`) with a scrim and a focus trap. The button names the
 * current part (the branch icon, "Parts tree" and, muted, "1.1 Base frame": `TreeButtonLabel`, AQP-458). The tree is one component in one place at a time, so its ids and roles are never in the page twice. What the tree holds survives the
 * panel closing, because it lives here and not in the drawer.
 *
 * The drawer is not in the first load (AQP-188, ADR-016 E1): its code is fetched on the first press of the button, through the loader every overlay uses (`useFirstOpen`), and stays mounted
 * afterwards. The button is plain and owns `open`; a press before the page was interactive is kept (`data-early-intent`). Nothing of the drawer is requested at 768 px or wider.
 */
export function PartsTreeArea({ tree, editable, onOpenPart, missingIds, resize, controlsReady }: PartsTreeAreaProps) {
  const viewport = useViewport();
  // The handle and the button are drawn from 1024 px and only once the page is in the browser: the server assumes `desktop`, and a separator it drew would be announced at the wrong size on a phone (UX-AC-15.11).
  const resizable = useMounted() && viewport === 'desktop';
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerButton = useRef<HTMLButtonElement>(null);
  // Enter on a part in the drawer closes it, and the focus then goes to the form, not back to the "Parts tree" button.
  const focusFormOnClose = useRef(false);
  const first = useFirstOpen<PartsTreeDrawerProps>({ id: 'parts-tree', load: loadDrawer, onOpen: () => setDrawerOpen(true) });
  const open = (id: string): void => {
    tree.select(id);
    if (viewport === 'phone') {
      focusFormOnClose.current = true;
      setDrawerOpen(false);
    } else {
      onOpenPart();
    }
  };
  // The panel is a card of its own beside the form and above it on a tablet; in the phone drawer, which is a surface of its own, it keeps its head and has no card around it (DEF-081 item 10).
  // The button's place is held from the first paint at 1024 px and wider (the server draws the desktop shape): a box, then the button in it once the form has shown (DL-391 (1)).
  const headAction = viewport === 'desktop' ? <LazyTreeWidthMenu resize={resize} announce={tree.announce} ready={resizable && controlsReady} /> : undefined;
  const panel = <TreePanel tree={tree} editable={editable} onOpen={open} {...(missingIds === undefined ? {} : { missingIds })} {...(headAction === undefined ? {} : { headAction })} />;
  const drawerPanel = <TreePanel tree={tree} editable={editable} onOpen={open} framed={false} {...(missingIds === undefined ? {} : { missingIds })} />;
  const { selected } = tree;
  const label = <TreeButtonLabel slNo={selected?.slNo ?? null} name={selected?.label ?? ''} kindLabel={selected === null ? '' : nodeKindLabel(selected, tree.nodes ?? [])} />;

  if (viewport === 'phone') {
    const Drawer = first.Overlay;
    return (
      <>
        <div className="relative">
          <Button
            ref={drawerButton}
            variant="secondary"
            className="w-full justify-start"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-busy={first.pending || undefined}
            aria-describedby={first.failed ? DRAWER_FAILURE_ID : undefined}
            {...{ [EARLY_INTENT_ATTRIBUTE]: 'parts-tree' }}
            onClick={(event) => first.activate(event.detail === 0)}
          >
            {label}
          </Button>
          {first.failed ? <FirstOpenFailure id={DRAWER_FAILURE_ID} message={DRAWER_FAILURE_MESSAGE} align="left" /> : null}
        </div>
        {Drawer === null ? null : (
          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onCloseAutoFocus={(event) => {
              // Radix has no trigger to return focus to, so the button gets it back here, unless a part was chosen: then the form takes it.
              event.preventDefault();
              if (focusFormOnClose.current) {
                focusFormOnClose.current = false;
                onOpenPart();
              } else {
                drawerButton.current?.focus();
              }
            }}
          >
            {drawerPanel}
          </Drawer>
        )}
      </>
    );
  }

  return (
    <div id={TREE_COLUMN_ID} className="relative flex min-w-0 flex-col gap-s-3 lg:w-(--tree-w) lg:shrink-0">
      {viewport === 'tablet' ? (
        <Button variant="secondary" className="justify-start" aria-expanded={panelOpen} aria-controls="parts-tree-panel" onClick={() => setPanelOpen((open) => !open)}>
          {panelOpen ? (
            <>
              <Icon icon={GitBranch} />
              {TREE_HIDE}
            </>
          ) : (
            label
          )}
        </Button>
      ) : null}
      {viewport === 'desktop' || panelOpen ? (
        <div id="parts-tree-panel" className="min-w-0">
          {panel}
        </div>
      ) : null}
      {/* Outside the panel and after it, so the handle is next in the tab order after the tree's last control, and is not inside anything that scrolls or clips (UX-AC-15.2). */}
      {resizable ? <LazyTreeResizeHandle resize={resize} announce={tree.announce} ready={controlsReady} /> : null}
    </div>
  );
}
