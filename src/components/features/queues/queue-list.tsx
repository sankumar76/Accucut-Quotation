import { Lock, Pencil, Send, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FOLDER_LINK_NOTE, FolderPath } from '@/components/shared/folder-path';
import { Icon } from '@/components/shared/icon';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RoleName } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import type { QueueRowData } from '@/lib/tasks/queue-client';
import type { TaskEstimateStatus } from '@/lib/tasks/queue';
import { formatIst } from '@/lib/time';

import { CARD_DEADLINE_LABEL, COLUMNS, DEADLINE_COLUMN, LIST_LABEL, NOT_CHOSEN_YET, STATUS_LABELS, TABLE_CAPTION, TABLE_REGION_LABEL } from './queue-texts';

/**
 * The tasks of SCR-03 (STORY-04.02 AC-3, AC-6, AC-7): a table from 768 px, which scrolls inside its own container only, and one card for each task below it.
 * Both are drawn from the same rows, in the order the server sent them (deadline, then code). **The task code is the one link of a row that goes to the task**
 * (rows are not clickable as a whole, so a keyboard and a screen reader meet one link for the task); the folder is the shared `FolderPath` (its `file:` link
 * and Copy path), whose explanation is said once above the list. An Engineer's list has no Engineer or Customer column, and the Customer, Folder and
 * Assigned by columns drop out of the table below 1024 px, so at 768 px it keeps Task, Engineer, Deadline and Status. Deadlines are shown in IST.
 * No row edits or reassigns anything (story 04.07), and no row is coloured for overdue (story 04.03).
 */

export interface QueueListProps {
  readonly role: RoleName;
  readonly tasks: ReadonlyArray<QueueRowData>;
}

const STATUS_TONE: Readonly<Record<TaskEstimateStatus, BadgeTone>> = { DRAFT: 'neutral', SUBMITTED: 'info', APPROVED: 'success' };
const STATUS_ICON: Readonly<Record<TaskEstimateStatus, LucideIcon>> = { DRAFT: Pencil, SUBMITTED: Send, APPROVED: Lock };

/** The page address of a task: its code, in the workspace's path (SCR-05). */
const taskHref = (code: string): string => `/estimates/${encodeURIComponent(code)}`;

function StatusBadge({ status }: { readonly status: TaskEstimateStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon icon={STATUS_ICON[status]} size="hint" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

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

function TaskTable({ role, tasks }: QueueListProps) {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} data-task-code={task.code}>
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
            <TableCell className="whitespace-nowrap tabular-nums">{formatIst(new Date(task.deadlineAt))}</TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell className={cn('hidden lg:table-cell', BREAK_LONG_NAMES)}>{task.assignedByName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TaskCards({ role, tasks }: QueueListProps) {
  const manager = role !== 'ENGINEER';
  return (
    <ul aria-label={LIST_LABEL} className="flex flex-col md:hidden">
      {tasks.map((task) => (
        <li key={task.id} data-task-code={task.code} className="flex flex-col gap-s-2 border-b border-border p-s-4 last:border-b-0">
          <div className="flex flex-wrap items-start justify-between gap-x-s-3 gap-y-s-1">
            <div className="min-w-0">
              <TaskCell task={task} />
            </div>
            <StatusBadge status={task.status} />
          </div>
          <div className="text-body text-ink-2 tabular-nums">
            {CARD_DEADLINE_LABEL}: {formatIst(new Date(task.deadlineAt))}
          </div>
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
        </li>
      ))}
    </ul>
  );
}

export function QueueList({ role, tasks }: QueueListProps) {
  return (
    <>
      <p className="px-s-4 pt-s-4 text-label text-ink-2">{FOLDER_LINK_NOTE}</p>
      <div className="hidden md:block">
        <TaskTable role={role} tasks={tasks} />
      </div>
      <TaskCards role={role} tasks={tasks} />
    </>
  );
}
