import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { DsSection } from './section';

interface MapRow {
  readonly pattern: string;
  readonly component: string;
  readonly note: string;
  readonly built: boolean;
}

/** UX spec section 7.5. `built` marks what exists in `src/components` after STORY-10.02. */
const MAP_ROWS: ReadonlyArray<MapRow> = [
  { pattern: 'Buttons', component: 'Button (variants primary, secondary, ghost, danger; icon squares)', note: 'Primary takes the brand red token', built: true },
  { pattern: 'Fields, units, column letters', component: 'Input, Label, FormField, UnitInput, ColumnTag', note: 'The letter tag is part of the label', built: true },
  { pattern: 'Select', component: 'Select', note: 'Keyboard type-ahead', built: true },
  { pattern: 'Checkbox and switch', component: 'Checkbox, Switch', note: 'The switch states ON or OFF in words', built: true },
  { pattern: 'Tables, cards on phones', component: 'Table, Card', note: 'Scrolls only inside the table container', built: true },
  { pattern: 'Status', component: 'Badge', note: 'Icon and text, never colour alone', built: true },
  { pattern: 'Notices', component: 'Alert (as Notice)', note: 'Always icon plus text', built: true },
  { pattern: 'Loading', component: 'Skeleton (as SkeletonBlock)', note: 'Shown after 300 ms', built: true },
  { pattern: 'Drawer (menu)', component: 'Sheet; the side menu is a custom Nav', note: 'The shadcn Sidebar is not used: it adds state this app does not need', built: true },
  { pattern: 'Account menu', component: 'DropdownMenu', note: 'Focus returns to the trigger', built: true },
  { pattern: 'Tabs (queues, masters)', component: 'Tabs', note: 'Counts in Badge', built: false },
  { pattern: 'Dialogs', component: 'Dialog; AlertDialog for destructive and password steps', note: 'Focus returns to the trigger', built: false },
  { pattern: 'Multi-select (treatments)', component: 'Popover + Command with checkboxes', note: 'Keyboard type-ahead', built: false },
  { pattern: 'Parts tree', component: 'Collapsible + custom tree (role=tree); Resizable on desktop', note: 'Sheet on phones', built: false },
  { pattern: 'Toasts', component: 'Sonner', note: 'Also announced in a live region', built: false },
  { pattern: 'Stage list (cost details)', component: 'Accordion', note: 'All open on desktop', built: false },
  { pattern: 'Date and time', component: 'Calendar in Popover; time Input', note: 'IST shown explicitly', built: false },
];

/** SCR-00 section 10: which shadcn/ui component each pattern uses, and what exists yet. */
export function ComponentMapSection() {
  return (
    <DsSection number="10" id="ds-map" title="Component map for shadcn/ui">
      <Table regionLabel="Component map, scrollable" caption="Each pattern, the shadcn/ui component that builds it, and whether it exists yet">
        <TableHeader>
          <TableRow>
            <TableHead>Pattern here</TableHead>
            <TableHead>shadcn/ui component</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Built</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MAP_ROWS.map((row) => (
            <TableRow key={row.pattern}>
              <TableCell>{row.pattern}</TableCell>
              <TableCell>{row.component}</TableCell>
              <TableCell className="text-ink-2">{row.note}</TableCell>
              <TableCell>
                <Badge tone={row.built ? 'success' : 'neutral'}>{row.built ? 'Yes' : 'Later story'}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DsSection>
  );
}
