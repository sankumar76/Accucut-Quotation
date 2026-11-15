'use client';

import { ListTree } from 'lucide-react';
import { useRef, useState } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { Icon } from '@/components/shared/icon';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { useViewport } from '@/components/shared/use-viewport';
import { Button } from '@/components/ui/button';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import { TREE_HIDE, treeButtonLabel } from './estimate-texts';
import type { PartsTreeDrawerProps } from './parts-tree-drawer';
import { TreePanel } from './tree-panel';
import type { PartsTreeState } from './use-parts-tree';

export interface PartsTreeAreaProps {
  /** The tree and what its buttons do: it lives in the workspace, because the part form beside it follows the part chosen here. */
  readonly tree: PartsTreeState;
  readonly editable: boolean;
  /** Enter on a part: its form takes the focus (STORY-05.03, review SQR-11). On a phone the drawer closes first, and the focus goes to the form when it has. */
  readonly onOpenPart: () => void;
  /** The parts Calculate found a missing input in (STORY-05.09). */
  readonly missingIds?: ReadonlySet<string>;
}

const DRAWER_FAILURE_ID = 'parts-tree-first-open-failure';
const DRAWER_FAILURE_MESSAGE = 'The parts tree did not open. Check your connection and try again.';

/** The drawer's code: a bare `import()` behind a type-only import above, so a failed request can be tried again and none of it is in the first load (AQP-188, NFR-009, ADR-016 E1). */
const loadDrawer = () => import('./parts-tree-drawer').then((module) => module.PartsTreeDrawer);

/**
 * The parts tree where it belongs at each width (STORY-05.02 AC-9; UX spec SCR-05 "Responsive"): from 1024 px a persistent panel beside the form; from 768 px a collapsible
 * panel that the "Parts tree" button shows and hides; below 768 px that button opens the tree as a left drawer (`PartsTreeDrawer`) with a scrim and a focus trap. The button names the
 * current part ("Parts tree, part 1.1"). The tree is one component in one place at a time, so its ids and roles are never in the page twice. What the tree holds survives the
 * panel closing, because it lives here and not in the drawer.
 *
 * The drawer is not in the first load (AQP-188, ADR-016 E1): its code is fetched on the first press of the button, through the loader every overlay uses (`useFirstOpen`), and stays mounted
 * afterwards. The button is plain and owns `open`; a press before the page was interactive is kept (`data-early-intent`). Nothing of the drawer is requested at 768 px or wider.
 */
export function PartsTreeArea({ tree, editable, onOpenPart, missingIds }: PartsTreeAreaProps) {
  const viewport = useViewport();
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
  const panel = <TreePanel tree={tree} editable={editable} onOpen={open} {...(missingIds === undefined ? {} : { missingIds })} />;
  const label = treeButtonLabel(tree.selected?.slNo ?? null);

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
            <Icon icon={ListTree} />
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
            {panel}
          </Drawer>
        )}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-s-3 lg:w-(--tree-w) lg:shrink-0">
      {viewport === 'tablet' ? (
        <Button variant="secondary" className="justify-start" aria-expanded={panelOpen} aria-controls="parts-tree-panel" onClick={() => setPanelOpen((open) => !open)}>
          <Icon icon={ListTree} />
          {panelOpen ? TREE_HIDE : label}
        </Button>
      ) : null}
      {viewport === 'desktop' || panelOpen ? (
        <div id="parts-tree-panel" className="min-w-0">
          {panel}
        </div>
      ) : null}
    </div>
  );
}
