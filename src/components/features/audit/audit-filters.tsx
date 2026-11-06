import type { Ref } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { AUDIT_CATEGORIES } from '@/lib/audit/categories';
import { rangeProblem, type AuditFilters } from '@/lib/audit/filters';

import { ALL_EVENTS, EVENT_LABEL, EVERYONE, FROM_LABEL, TO_LABEL, WHO_LABEL } from './texts';

/**
 * The four filters of SCR-16: Who, Event, From and To. Each change is applied at once, so there is no "Apply" to find; the
 * labels are real labels, and a range that ends before it begins is said in words under the To field. It holds no state of its
 * own: the screen owns the filters and asks the server.
 */

export interface AuditPerson {
  readonly id: string;
  readonly name: string;
}

export interface AuditFiltersProps {
  readonly people: ReadonlyArray<AuditPerson>;
  readonly filters: AuditFilters;
  readonly onChange: (next: AuditFilters) => void;
  /** The Who list, which takes focus when Clear filters has cleared the filters and the button has gone (ux-spec v0.16). */
  readonly whoRef: Ref<HTMLSelectElement>;
}

export function AuditFiltersBar({ people, filters, onChange, whoRef }: AuditFiltersProps) {
  const range = rangeProblem(filters);
  return (
    <div className="grid grid-cols-1 gap-s-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField id="audit-who" label={WHO_LABEL}>
        {(control) => (
          <NativeSelect {...control} ref={whoRef} value={filters.who} onChange={(event) => onChange({ ...filters, who: event.target.value })}>
            <option value="">{EVERYONE}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="audit-event" label={EVENT_LABEL}>
        {(control) => (
          <NativeSelect {...control} value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value })}>
            <option value="">{ALL_EVENTS}</option>
            {AUDIT_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="audit-from" label={FROM_LABEL}>
        {(control) => <Input {...control} type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} />}
      </FormField>
      <FormField id="audit-to" label={TO_LABEL} {...(range === null ? {} : { error: range })}>
        {(control) => <Input {...control} type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} />}
      </FormField>
    </div>
  );
}
