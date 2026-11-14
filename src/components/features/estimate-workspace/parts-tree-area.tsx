'use client';

import { ListTree } from 'lucide-react';
import { useState } from 'react';

import { Icon } from '@/components/shared/icon';
import { useViewport } from '@/components/shared/use-viewport';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { TREE_CLOSE, TREE_HIDE, TREE_TITLE, treeButtonLabel } from './estimate-texts';
import { TreePanel } from './tree-panel';
import { usePartsTree } from './use-parts-tree';

export interface PartsTreeAreaProps {
  readonly estimateId: string;
  readonly editable: boolean;
}

/**
 * The parts tree where it belongs at each width (STORY-05.02 AC-9; UX spec SCR-05 "Responsive"): from 1024 px a persistent panel beside the form; from 768 px a collapsible
 * panel that the "Parts tree" button shows and hides; below 768 px that button opens the tree as a left drawer (`Sheet`) with a scrim and a focus trap. The button names the
 * current part ("Parts tree, part 1.1"). The tree is one component in one place at a time, so its ids and roles are never in the page twice. What the tree holds survives the
 * panel closing, because it lives here and not in the drawer.
 */
export function PartsTreeArea({ estimateId, editable }: PartsTreeAreaProps) {
  const tree = usePartsTree(estimateId);
  const viewport = useViewport();
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panel = <TreePanel tree={tree} editable={editable} />;
  const label = treeButtonLabel(tree.selected?.slNo ?? null);

  if (viewport === 'phone') {
    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button variant="secondary" className="w-full justify-start">
            <Icon icon={ListTree} />
            {label}
          </Button>
        </SheetTrigger>
        <SheetContent title={TREE_TITLE} closeLabel={TREE_CLOSE} className="overflow-y-auto bg-surface p-s-4 pt-s-7 text-ink">
          {panel}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-s-3 lg:w-72 lg:shrink-0">
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
