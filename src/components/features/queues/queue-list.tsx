import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { DownloadChip } from '@/components/shared/download-chip';
import { FOLDER_LINK_NOTE, FolderPath } from '@/components/shared/folder-path';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RoleName } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import { isTaskClosed } from '@/lib/estimate/task-status';
import type { DownloadMarkers } from '@/lib/tasks/download-markers-client';
import type { QueueRowData } from '@/lib/tasks/queue-client';
import { formatIst } from '@/lib/time';

import { lateTextFor, OVERDUE_CARD_CLASS, OVERDUE_ROW_CLASS, OverdueMarker } from './overdue-marker';
import {
  CARD_DEADLINE_LABEL,
  CLOSED_ROW_WORD,
  COLUMNS,
  DEADLINE_COLUMN,
  DOWNLOAD_STATUS_UNAVAILABLE,
  LIST_LABEL,
  NOT_CHOSEN_YET,
  REASSIGN_ACTION,
  reassignActionLabel,
  TABLE_CAPTION,
  TABLE_REGION_LABEL,
} from './queue-texts';

/**
 * The tasks of SCR-03 (STORY-04.02 AC-3, AC-6, AC-7): a table from 768 px, which scrolls inside its own container only, and one card for each task below it.
 * Both are drawn from the same rows, in the order the server sent them (deadline, then code). **The task code is the one link of a row that goes to the task**
 * (rows are not clickable as a whole, so a keyboard and a screen reader meet one link for the task); the folder is the shared `FolderPath` (its `file:` link
 * and Copy path), whose explanation is said once above the list. An Engineer's list has no Engineer or Customer column, and the Customer, Folder and
 * Assigned by columns drop out of the table below 1024 px, so at 768 px it keeps Task, Engineer, Deadline and Status. Deadlines are shown in IST.
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
function DeadlineCell({ task, late }: { readonly task: QueueRowData; readonly late: string | null }) {
  return (
    <>
      <div className="whitespace-nowrap tabular-nums">{formatIst(new Date(task.deadlineAt))}</div>
      {late === null ? null : <OverdueMarker late={late} />}
    </>
  );
}

/** The page address of a task's edit mode: SCR-04 with the task chosen by its ID (STORY-04.07). */
const reassignHref = (task: QueueRowData): string => `/assign?task=${encodeURIComponent(task.id)}`;

/**
 * What a Lead and an Admin find in the action column: the action for an open row, the word "Closed" for a closed one. `isTaskClosed` is the one rule, shared with the tabs and
 * the overdue cue, so a task is offered the action exactly when it is in the Open tab.
 */
function RowAction({ task }: { readonly task: QueueRowData }) {
  return isTaskClosed(task.status) ? (
    <span data-closed-action="" className="font-semibold text-ink-2">
      {CLOSED_ROW_WORD}
    </span>
  ) : (
    <Button variant="secondary" asChild>
      <Link href={reassignHref(task)} data-reassign-action="" aria-label={reassignActionLabel(task.code)}>
        {REASSIGN_ACTION}
      </Link>
    </Button>
  );
}

/** The download chip under "Closed" for a Lead and an Admin (never drawn without `markers`, which an Engineer's list never has). */
function DownloadMarker({ task, markers }: { readonly task: QueueRowData; readonly markers: QueueListProps['markers'] }) {
  if (markers === undefined || !isTaskClosed(task.status)) return null;
  const marker = markers === 'unavailable' ? undefined : markers[task.id];
  if (marker === undefined) return <p className="text-label text-ink-2">{DOWNLOAD_STATUS_UNAVAILABLE}</p>;
  return <DownloadChip marker={marker} className="mt-s-1" />;
}

function TaskTable({ role, tasks, asOf, markers }: QueueListProps) {
  const manager = role !== 'ENGINEER';
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>{COLUMNS.task}</TableHead>
          {manager ? <TableHead>{COLUMNS.engineer}</TableHead> : null}
          {manager ? <TableHead className="hidden lg:table-cell">{COLUMNS.customer}</TableHead> : null}
          <TableHead className="hidden lg:table-cell">{COLUMNS.folder}</TableHead>
          <TableHead>{DEADLINE_COLUMN}</TableHead>
          <TableHead>{COLUMNS.status}</TableHead>
          <TableHead className="hidden lg:table-cell">{COLUMNS.assignedBy}</TableHead>
          {manager ? <TableHead>{COLUMNS.actions}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} data-task-code={task.code} className={lateTextFor(task, asOf) === null ? undefined : OVERDUE_ROW_CLASS}>
            <TableCell>
              <TaskCell task={task} />
            </TableCell>
            {manager ? <TableCell className={BREAK_LONG_NAMES}>{task.engineerName}</TableCell> : null}
            {manager ? (
              <TableCell className="hidden lg:table-cell">
                <Customer task={task} />
              </TableCell>
            ) : null}
            <TableCell className="hidden lg:table-cell">
              <Folder task={task} />
            </TableCell>
            <TableCell>
              <DeadlineCell task={task} late={lateTextFor(task, asOf)} />
            </TableCell>
            <TableCell>
              <StatusBadge status={task.status} iconSize="hint" />
            </TableCell>
            <TableCell className={cn('hidden lg:table-cell', BREAK_LONG_NAMES)}>{task.assignedByName}</TableCell>
            {manager ? (
              <TableCell>
                <RowAction task={task} />
                <DownloadMarker task={task} markers={markers} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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
