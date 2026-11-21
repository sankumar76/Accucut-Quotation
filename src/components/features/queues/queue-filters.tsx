import { Search, X } from 'lucide-react';
import type { FormEvent, Ref } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { QUEUE_SEARCH_MAX_LENGTH, dateRangeProblem, type QueueFilters } from '@/lib/tasks/queue-filters';

import {
  ALL_CUSTOMERS,
  ALL_ENGINEERS,
  ASSIGNED_BY_ME,
  CUSTOMER_LABEL,
  ENGINEER_LABEL,
  FILTERS_LABEL,
  FROM_LABEL,
  REMOVE_ASSIGNED_BY_ME,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  TO_LABEL,
} from './queue-texts';

/**
 * The filter row of SCR-03 (STORY-04.06 AC-3, AC-5, AC-9; FR-035, FR-039): search by task ID or title, Engineer, Customer, and the deadline From and To, with the removable chip
 * "Assigned by me" and, for a Lead who removed it, the control that puts it back. An Engineer is offered the search alone (UX spec SCR-03 "Differences by role"). Every control has
 * a visible label; a change of Engineer, Customer or date is applied at once, the search after a pause or on Enter (`onSearchSubmit`), so there is no Apply button. It holds no state
 * of its own: the screen owns the filters and asks the server, and a range that ends before it begins is said in words under To and not sent.
 */

export interface FilterOption {
  readonly id: string;
  readonly name: string;
}

export interface QueueFiltersBarProps {
  /** A Lead or an Admin: the Engineer, Customer and date filters and the chip are theirs. */
  readonly manager: boolean;
  /** Only a Lead is offered the control that puts the chip back (decision D-1). */
  readonly canRestoreAssignedBy: boolean;
  readonly filters: QueueFilters;
  /** What is in the search box: ahead of `filters.q` until the pause or Enter applies it. */
  readonly searchText: string;
  readonly engineers: ReadonlyArray<FilterOption>;
  readonly customers: ReadonlyArray<FilterOption>;
  readonly onSearchText: (text: string) => void;
  readonly onSearchSubmit: () => void;
  readonly onChange: (next: QueueFilters) => void;
  readonly onRemoveAssignedBy: () => void;
  readonly onRestoreAssignedBy: () => void;
  readonly searchRef: Ref<HTMLInputElement>;
  readonly restoreRef: Ref<HTMLButtonElement>;
  readonly removeRef: Ref<HTMLButtonElement>;
}

function Choice({ id, label, all, value, options, onChange }: { readonly id: string; readonly label: string; readonly all: string; readonly value: string; readonly options: ReadonlyArray<FilterOption>; readonly onChange: (value: string) => void }) {
  return (
    <FormField id={id} label={label}>
      {(control) => (
        <NativeSelect {...control} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{all}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

export function QueueFiltersBar({
  manager,
  canRestoreAssignedBy,
  filters,
  searchText,
  engineers,
  customers,
  onSearchText,
  onSearchSubmit,
  onChange,
  onRemoveAssignedBy,
  onRestoreAssignedBy,
  searchRef,
  restoreRef,
  removeRef,
}: QueueFiltersBarProps) {
  const range = dateRangeProblem(filters);

  function submit(event: FormEvent<HTMLFormElement>): void {
    // Enter in the search box asks at once; the page does not reload.
    event.preventDefault();
    onSearchSubmit();
  }

  return (
    <form role="search" aria-label={FILTERS_LABEL} onSubmit={submit} className="flex flex-col gap-s-4">
      <div className={manager ? 'grid grid-cols-1 gap-s-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]' : 'max-w-120'}>
        <FormField id="queue-search" label={SEARCH_LABEL}>
          {(control) => (
            <div className="relative">
              <Icon icon={Search} size="small" className="pointer-events-none absolute top-1/2 left-s-3 -translate-y-1/2 text-ink-2" />
              <Input
                {...control}
                ref={searchRef}
                type="search"
                autoComplete="off"
                maxLength={QUEUE_SEARCH_MAX_LENGTH}
                placeholder={SEARCH_PLACEHOLDER}
                className="pl-s-7"
                value={searchText}
                onChange={(event) => onSearchText(event.target.value)}
              />
            </div>
          )}
        </FormField>
        {manager ? (
          <>
            <Choice id="queue-engineer" label={ENGINEER_LABEL} all={ALL_ENGINEERS} value={filters.engineer} options={engineers} onChange={(engineer) => onChange({ ...filters, engineer })} />
            <Choice id="queue-customer" label={CUSTOMER_LABEL} all={ALL_CUSTOMERS} value={filters.customer} options={customers} onChange={(customer) => onChange({ ...filters, customer })} />
            <FormField id="queue-from" label={FROM_LABEL}>
              {(control) => <Input {...control} type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />}
            </FormField>
            <FormField id="queue-to" label={TO_LABEL} {...(range === null ? {} : { error: range })}>
              {(control) => <Input {...control} type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />}
            </FormField>
          </>
        ) : null}
      </div>
      {filters.assignedBy === 'me' ? (
        <div className="flex">
          <span className="inline-flex items-center gap-s-1 rounded-full border border-primary-line bg-primary-soft pl-s-3 text-label font-semibold text-primary-ink">
            {ASSIGNED_BY_ME}
            <Button ref={removeRef} type="button" variant="ghost" size="icon-row" className="rounded-full" aria-label={REMOVE_ASSIGNED_BY_ME} onClick={onRemoveAssignedBy}>
              <Icon icon={X} size="small" />
            </Button>
          </span>
        </div>
      ) : null}
      {canRestoreAssignedBy && filters.assignedBy === 'anyone' ? (
        <div className="flex">
          <Button ref={restoreRef} type="button" variant="secondary" onClick={onRestoreAssignedBy}>
            {ASSIGNED_BY_ME}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
