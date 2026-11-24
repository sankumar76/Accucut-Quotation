import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { DownloadChip } from '@/components/shared/download-chip';
import { FOLDER_LINK_NOTE, FolderPath } from '@/components/shared/folder-path';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RoleName } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import { taskStatusOf } from '@/lib/estimate/task-status';
import type { DownloadMarkers } from '@/lib/tasks/download-markers-client';
import type { QueueRowData } from '@/lib/tasks/queue-client';
import { remarksPreview } from '@/lib/tasks/remarks-preview';
import { formatIst } from '@/lib/time';

import { lateTextFor, OVERDUE_CARD_CLASS, OVERDUE_ROW_CLASS, OVERDUE_TINT_CLASS, OverdueMarker } from './overdue-marker';
import {
  CARD_DEADLINE_LABEL,
  CLOSED_ROW_WORD,
  COLUMNS,
  DEADLINE_COLUMN,
  LIST_LABEL,
  NOT_CHOSEN_YET,
  OPEN_TO_RESTORE,
  openToRestoreLabel,
  READ_ALL_REMARKS,
  readAllRemarksLabel,
  REASSIGN_ACTION,
  reassignActionLabel,
  TABLE_CAPTION,
  TABLE_REGION_LABEL,
} from './queue-texts';

/**
 * The tasks of SCR-03 (STORY-04.02 AC-3, AC-6, AC-7): a table from 768 px, which scrolls inside its own container only, and one card for each task below it.
 * Both are drawn from the same rows, in the order the server sent them (deadline, then code). **The task code is the one link of a row that goes to the task**
 * (rows are not clickable as a whole, so a keyboard and a screen reader meet one link for the task); the folder is the shared `FolderPath` (its `file:` link
 * and Copy path), whose explanation is said once above the list. An Engineer's list has no Engineer or Customer column, and its Folder and Assigned by columns drop out of the table below 1024 px.
 * A Lead's and an Admin's table has five columns at every width, the last of them the sticky Actions column (`ManagerTable`, DEF-077). Deadlines are shown in IST.
 * A Lead and an Admin have one action on an open row, "Reassign or change deadline" (STORY-04.07 AC-1): a link to SCR-04 in edit mode for that task, with the task's code in its
 * accessible name. A closed row says "Closed" in place of it (STORY-04.05 AC-5, UX-20; an approved task cannot be reassigned, A-14). So the Actions column is drawn for a Lead and an
 * Admin whatever the rows are, every row having one or the other, and an Engineer's list has no action column. "Closed" is the word of that column and never a second status badge. An open row past its deadline carries the three cues of FR-036 together (STORY-04.03: clock icon, "Overdue by …",
 * amber bar and tint; `overdue-marker.tsx`), judged at `asOf`.
 */

export interface QueueListProps {
  readonly role: RoleName;
  readonly tasks: ReadonlyArray<QueueRowData>;
  /** The server's instant (UTC text) that overdue is judged at (`QueuePageData.asOf`). */
  readonly asOf: string;
  /**
   * The download markers of the Closed tab's rows (STORY-CR01.7E AC-5), **for a Lead and an Admin only**: `undefined` draws none (an Engineer's list, and every other tab), and `'unavailable'` says the markers could not be
   * read, so a row never says "Not downloaded" for a marker it does not have.
   */
  readonly markers?: DownloadMarkers | 'unavailable' | undefined;
}

/** Cells of the Lead's table take 12 px at the sides, so the five columns fit a 710 px region (DEF-077, UX 13044 item 3). */
const MANAGER_CELL = 'px-s-3';
/** The text of a row action wraps to two lines, so the Actions column is 200 px and not the 219 px of one line plus padding (UX 13044 item 6). */
const ACTION_BUTTON_WRAPS = 'h-auto min-h-(--control-h) py-s-2 text-center leading-snug whitespace-normal';
/** The chip's badge may wrap inside the 200 px column; it keeps its 20 px as the least height. */
const CHIP_WRAPS = '[&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:min-h-s-5 [&_[data-slot=badge]]:py-s-1 [&_[data-slot=badge]]:whitespace-normal';

/** The page address of a task: its code, in the workspace's path (SCR-05). */
const taskHref = (code: string): string => `/estimates/${encodeURIComponent(code)}`;

/** The folder as a link and Copy path, or the path as plain text for a stored path that has no link. */
function Folder({ task }: { readonly task: QueueRowData }) {
  return task.folderUrl === null ? <span className={cn('font-mono', BREAK_LONG_NAMES)}>{task.folderPath}</span> : <FolderPath path={task.folderPath} url={task.folderUrl} showNote={false} />;
}

function TaskCell({ task }: { readonly task: QueueRowData }) {
  return (
    <>
      <Link href={taskHref(task.code)} className="font-semibold text-primary-ink underline-offset-2 hover:underline">
        {task.code}
      </Link>
      {task.title === null ? null : <div className={cn('text-body text-ink', BREAK_LONG_NAMES)}>{task.title}</div>}
    </>
  );
}

const Customer = ({ task }: { readonly task: QueueRowData }) =>
  task.customerName === null ? <span className="text-ink-2">{NOT_CHOSEN_YET}</span> : <span className={BREAK_LONG_NAMES}>{task.customerName}</span>;

/** The deadline in IST and, when the task is overdue, how late it is. */
function DeadlineCell({ task, late, wrap = false }: { readonly task: QueueRowData; readonly late: string | null; readonly wrap?: boolean }) {
  return (
    <>
      <div className={cn('tabular-nums', !wrap && 'whitespace-nowrap')}>{formatIst(new Date(task.deadlineAt))}</div>
      {late === null ? null : <OverdueMarker late={late} />}
    </>
  );
}

/** The page address of a task's edit mode: SCR-04 with the task chosen by its ID (STORY-04.07). */
const reassignHref = (task: QueueRowData): string => `/assign?task=${encodeURIComponent(task.id)}`;

/**
 * What a Lead and an Admin find in the action column: the action for an open row, the word "Closed" for a closed one, and for an Ignored row the link **Open to restore** (CR-01 item 7D; no Reassign, DL-304, and not a
 * Restore button: the link restores nothing, so it does not say so). `taskStatusOf(...).closed` is built on `isTaskClosed`, the one rule, shared with the tabs and the overdue cue, so a task is offered the action exactly
 * when it is in the Open tab.
 */
function RowAction({ task, className }: { readonly task: QueueRowData; readonly className?: string }) {
  if (task.status === 'IGNORED') {
    return (
      <Button variant="secondary" asChild className={className}>
        <Link href={taskHref(task.code)} data-restore-link="" aria-label={openToRestoreLabel(task.code)}>
          {OPEN_TO_RESTORE}
        </Link>
      </Button>
    );
  }
  return taskStatusOf(task.status).closed ? (
    <span data-closed-action="" className="font-semibold text-ink-2">
      {CLOSED_ROW_WORD}
    </span>
  ) : (
    <Button variant="secondary" asChild className={className}>
      <Link href={reassignHref(task)} data-reassign-action="" aria-label={reassignActionLabel(task.code)}>
        {REASSIGN_ACTION}
      </Link>
    </Button>
  );
}

/** The download chip under "Closed" for a Lead and an Admin (never drawn without `markers`, which an Engineer's list never has). */
function DownloadMarker({ task, markers, className }: { readonly task: QueueRowData; readonly markers: QueueListProps['markers']; readonly className?: string }) {
  // An ignored row is not closed (its display status is IGNORED), so it draws no marker.
  if (markers === undefined || !taskStatusOf(task.status).closed) return null;
  // A marker that is not in the answer reads as unavailable, never as "Not downloaded".
  return <DownloadChip marker={markers === 'unavailable' ? 'unavailable' : (markers[task.id] ?? 'unavailable')} className={cn('mt-s-1', className)} />;
}

/**
 * The status and, on a row of the Ignored tab, the Lead's remarks under it (CR-01 item 7D, AC-3): plain text nodes (never markup, so `<b>x</b>` shows as typed), line breaks as spaces, up to 140 code points whole and
 * longer cut at a word with "Read all remarks", a link to the task page where the whole text is. No new component and no client code: the cut is a pure function.
 */
function IgnoredRemarks({ task, width = 'max-w-[280px]' }: { readonly task: QueueRowData; readonly width?: string | undefined }) {
  if (task.ignoredRemarks === null) return null;
  const preview = remarksPreview(task.ignoredRemarks);
  return (
    <div data-ignored-remarks="" className={cn('mt-s-2 text-body text-ink-2', width, BREAK_LONG_NAMES)}>
      <p>{preview.text}</p>
      {preview.cut ? (
        <Link href={taskHref(task.code)} aria-label={readAllRemarksLabel(task.code)} className="font-semibold text-primary-ink underline-offset-2 hover:underline">
          {READ_ALL_REMARKS}
        </Link>
      ) : null}
    </div>
  );
}

function StatusCell({ task, remarksWidth }: { readonly task: QueueRowData; readonly remarksWidth?: string }) {
  return (
    <>
      <StatusBadge status={task.status} iconSize="hint" />
      <IgnoredRemarks task={task} width={remarksWidth} />
    </>
  );
}

/** An Engineer's list: no Actions column, so the Folder and Assigned by columns still drop out below 1024 px (DEF-077 leaves it as it was). */
function EngineerTable({ tasks, asOf }: Pick<QueueListProps, 'tasks' | 'asOf'>) {
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>{COLUMNS.task}</TableHead>
          <TableHead className="hidden lg:table-cell">{COLUMNS.folder}</TableHead>
          <TableHead>{DEADLINE_COLUMN}</TableHead>
          <TableHead>{COLUMNS.status}</TableHead>
          <TableHead className="hidden lg:table-cell">{COLUMNS.assignedBy}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} data-task-code={task.code} className={lateTextFor(task, asOf) === null ? undefined : OVERDUE_ROW_CLASS}>
            <TableCell>
              <TaskCell task={task} />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Folder task={task} />
            </TableCell>
            <TableCell>
              <DeadlineCell task={task} late={lateTextFor(task, asOf)} />
            </TableCell>
            <TableCell>
              <StatusCell task={task} />
            </TableCell>
            <TableCell className={cn('hidden lg:table-cell', BREAK_LONG_NAMES)}>{task.assignedByName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The Lead's and the Admin's table (DEF-077, DL-357, UX 13044; UX spec 6.0 "Masters tables" binds it, OQ-UX-20): five columns at every width from 768 px, the last one the sticky, opaque Actions column of the masters tables,
 * 200 px wide (`actionButtons="wide"`), so a row action and the Downloaded chip are inside the region whatever the names are. The Customer, the Folder and "Assigned by", which used to be columns that dropped out below
 * 1024 px (and were still too wide above it), are lines of the Task and Engineer cells: shown once each as text, never hidden. Cells take 12 px at the sides, headings and the deadline wrap, and the Actions cell repeats
 * the overdue tint so the row's colour is unbroken under it.
 */
function ManagerTable({ tasks, asOf, markers }: Omit<QueueListProps, 'role'>) {
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION} actionButtons="wide">
      <TableHeader>
        <TableRow>
          <TableHead className={MANAGER_CELL}>{COLUMNS.task}</TableHead>
          <TableHead className={MANAGER_CELL}>{COLUMNS.engineer}</TableHead>
          <TableHead className={MANAGER_CELL}>{DEADLINE_COLUMN}</TableHead>
          <TableHead className={MANAGER_CELL}>{COLUMNS.status}</TableHead>
          <TableActionsHead className={cn(MANAGER_CELL, 'text-left')}>{COLUMNS.actions}</TableActionsHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const late = lateTextFor(task, asOf);
          return (
            <TableRow key={task.id} data-task-code={task.code} className={late === null ? undefined : OVERDUE_ROW_CLASS}>
              <TableCell className={MANAGER_CELL}>
                <TaskCell task={task} />
                <div className={cn('text-body text-ink-2', BREAK_LONG_NAMES)}>
                  {COLUMNS.customer}: <Customer task={task} />
                </div>
                <div className="mt-s-2">
                  <Folder task={task} />
                </div>
              </TableCell>
              <TableCell className={cn(MANAGER_CELL, BREAK_LONG_NAMES)}>
                {task.engineerName}
                <div className="text-label text-ink-2">
                  {COLUMNS.assignedBy}: {task.assignedByName}
                </div>
              </TableCell>
              <TableCell className={MANAGER_CELL}>
                <DeadlineCell task={task} late={late} wrap />
              </TableCell>
              <TableCell className={MANAGER_CELL}>
                <StatusCell task={task} remarksWidth="max-w-[240px]" />
              </TableCell>
              <TableActionsCell className={cn(MANAGER_CELL, late !== null && OVERDUE_TINT_CLASS)}>
                <RowAction task={task} className={ACTION_BUTTON_WRAPS} />
                <DownloadMarker task={task} markers={markers} className={CHIP_WRAPS} />
              </TableActionsCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function TaskTable({ role, tasks, asOf, markers }: QueueListProps) {
  return role === 'ENGINEER' ? <EngineerTable tasks={tasks} asOf={asOf} /> : <ManagerTable tasks={tasks} asOf={asOf} markers={markers} />;
}

/** The overdue line of a phone's card, or nothing for a task that is not overdue. */
function CardOverdueMarker({ task, asOf }: { readonly task: QueueRowData; readonly asOf: string }) {
  const late = lateTextFor(task, asOf);
  return late === null ? null : <OverdueMarker late={late} />;
}

function TaskCards({ role, tasks, asOf, markers }: QueueListProps) {
  const manager = role !== 'ENGINEER';
  return (
    <ul aria-label={LIST_LABEL} className="flex flex-col md:hidden">
      {tasks.map((task) => (
        <li
          key={task.id}
          data-task-code={task.code}
          className={cn('flex flex-col gap-s-2 border-b border-border p-s-4 last:border-b-0', lateTextFor(task, asOf) !== null && OVERDUE_CARD_CLASS)}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-s-3 gap-y-s-1">
            <div className="min-w-0">
              <TaskCell task={task} />
            </div>
            <StatusBadge status={task.status} iconSize="hint" />
          </div>
          <IgnoredRemarks task={task} />
          <div className="text-body text-ink-2 tabular-nums">
            {CARD_DEADLINE_LABEL}: {formatIst(new Date(task.deadlineAt))}
          </div>
          <CardOverdueMarker task={task} asOf={asOf} />
          {manager ? (
            <div className={cn('text-body text-ink-2', BREAK_LONG_NAMES)}>
              {COLUMNS.engineer}: {task.engineerName}
              {' · '}
              {COLUMNS.customer}: <Customer task={task} />
            </div>
          ) : null}
          <div className={cn('text-label text-ink-2', BREAK_LONG_NAMES)}>
            {COLUMNS.assignedBy}: {task.assignedByName}
          </div>
          <Folder task={task} />
          {manager ? <RowAction task={task} /> : null}
          {manager ? <DownloadMarker task={task} markers={markers} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function QueueList({ role, tasks, asOf, markers }: QueueListProps) {
  return (
    <>
      <p className="px-s-4 pt-s-4 text-label text-ink-2">{FOLDER_LINK_NOTE}</p>
      <div className="hidden md:block">
        <TaskTable role={role} tasks={tasks} asOf={asOf} markers={markers} />
      </div>
      <TaskCards role={role} tasks={tasks} asOf={asOf} markers={markers} />
    </>
  );
}
