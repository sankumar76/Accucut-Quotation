'use client';

import { ArrowLeftRight } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { clampTreeWidth } from '@/lib/ui/tree-width';
import { presetFits, presetOfWidth, TREE_WIDTH_PRESETS } from '@/lib/ui/tree-width-gestures';

import { TREE_WIDTH_BUTTON, TREE_WIDTH_DEFAULT_NOTE, TREE_WIDTH_NO_ROOM, treeWidthAnnouncement, treeWidthChoiceLabel } from './tree-width-texts';
import type { TreeWidth } from './use-tree-width';

export interface TreeWidthMenuProps {
  readonly resize: TreeWidth;
  /** Said politely after a choice (the tree's live region); focus does not move. */
  readonly announce: (text: string) => void;
}

/**
 * "Tree width" (AQP-426, STORY-CR01.3E, UX-AC-15.7, 15.13): the way to change the tree's width **without dragging**, which WCAG 2.2 SC 2.5.7 requires and the arrow keys do not give a person who only points. An icon button in
 * the tree card's head, after the row count (32 px square with a mouse, 44 px with a coarse pointer), that opens a shadcn `Popover` holding a `RadioGroup` of Narrow (256 px), Standard (320 px, the default) and Wide (400 px).
 * A choice applies and is stored at once, and is announced; the popover stays open until Escape or a click outside, and focus returns to the button. A choice larger than the effective maximum is turned off, with its reason.
 */
export function TreeWidthMenu({ resize, announce }: TreeWidthMenuProps) {
  const { width, workspaceWidth, commit } = resize;
  const choose = (id: string): void => {
    const preset = TREE_WIDTH_PRESETS.find((candidate) => candidate.id === id);
    if (preset === undefined) return;
    // Standard is the reset: it removes the stored number, so a later change of the default reaches this person.
    const shown = clampTreeWidth(preset.width, workspaceWidth);
    commit(shown, preset.id === 'standard');
    announce(treeWidthAnnouncement(preset.id, shown));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={TREE_WIDTH_BUTTON} title={TREE_WIDTH_BUTTON} data-tree-width-button="" className="fine-wide:h-[32px] fine-wide:w-[32px]">
          <Icon icon={ArrowLeftRight} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={TREE_WIDTH_BUTTON} className="w-auto">
        <RadioGroup aria-label={TREE_WIDTH_BUTTON} value={presetOfWidth(width)?.id ?? ''} onValueChange={choose} className="gap-s-1">
          {TREE_WIDTH_PRESETS.map((preset) => {
            const fits = presetFits(preset, workspaceWidth);
            const itemId = `tree-width-${preset.id}`;
            const noteId = `${itemId}-note`;
            const note = !fits ? TREE_WIDTH_NO_ROOM : preset.id === 'standard' ? TREE_WIDTH_DEFAULT_NOTE : null;
            return (
              <div key={preset.id} className="flex min-h-(--control-h) items-center gap-s-1 rounded-md hover:bg-surface-2">
                <RadioGroupItem value={preset.id} id={itemId} disabled={!fits} {...(note === null ? {} : { 'aria-describedby': noteId })} />
                <Label htmlFor={itemId} className="min-h-(--control-h) min-w-0 cursor-pointer text-body font-normal text-ink">
                  {treeWidthChoiceLabel(preset.id, preset.width)}
                </Label>
                {note === null ? null : (
                  <span id={noteId} className="pr-s-3 text-label text-ink-3">
                    {note}
                  </span>
                )}
              </div>
            );
          })}
        </RadioGroup>
      </PopoverContent>
    </Popover>
  );
}
