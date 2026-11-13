'use client';

import { TriangleAlert } from 'lucide-react';

import { FormField } from '@/components/shared/form-field';
import { Icon } from '@/components/shared/icon';
import { UnitInput } from '@/components/shared/unit-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { rateErrorKey, typedDiffers, type EditErrors, type RateInputs } from '@/lib/masters/customer-form';
import type { CustomerRate } from '@/lib/masters/customers';
import { formatDefaultValue, valueSymbol } from '@/lib/masters/process-items';

import { DIFFERS_TAG, RATE_HEADINGS, rateInputLabel, rateRegionLabel, SAME_AS_DEFAULT } from './customer-texts';
import { BREAK_LONG_NAMES } from './master-texts';

/**
 * The rates of one customer on SCR-12's edit page (STORY-02.02 AC-2, AC-8): a table that scrolls inside its own container only (the page never
 * scrolls sideways), with the Process Master's default, the customer's own value in an input, and a status. A value that differs from the default has the
 * tag "Differs from default" with an icon and the words, never colour alone; the status follows what is typed, so the Admin sees it before saving. Each
 * input has an accessible name that holds both the rate and the customer ("Cutting-Rate-per-Sec for Brightwater Controls"), the unit beside it
 * (rupee or percent), and, when the server or the form refused it, its message under it. The inputs are the usual 44 px high (ux-spec section 6.0
 * "Controls"). It decides nothing: whether a value is allowed is `rateProblem`, and the server judges it again.
 */

export interface CustomerRatesTableProps {
  readonly customerName: string;
  readonly rates: ReadonlyArray<CustomerRate>;
  readonly inputs: RateInputs;
  readonly errors: EditErrors;
  readonly onChange: (processItemId: string, value: string) => void;
}

/** The element id of a rate's input: tied to its label and its message, and the place focus goes to after a refusal. */
export const rateInputId = (processItemId: string): string => `rate-${processItemId}`;

function Status({ rate, typed }: { readonly rate: CustomerRate; readonly typed: string | undefined }) {
  return typedDiffers(rate, typed) ? (
    <Badge tone="warn">
      <Icon icon={TriangleAlert} size="hint" />
      {DIFFERS_TAG}
    </Badge>
  ) : (
    <span className="text-label text-ink-3">{SAME_AS_DEFAULT}</span>
  );
}

function RateInput({ rate, customerName, value, error, onChange }: { readonly rate: CustomerRate; readonly customerName: string; readonly value: string; readonly error: string | undefined; readonly onChange: (value: string) => void }) {
  return (
    <FormField id={rateInputId(rate.processItemId)} label={rateInputLabel(rate.name, customerName)} labelHidden {...(error === undefined ? {} : { error })}>
      {(control) => <UnitInput {...control} unit={valueSymbol(rate.unit)} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />}
    </FormField>
  );
}

export function CustomerRatesTable({ customerName, rates, inputs, errors, onChange }: CustomerRatesTableProps) {
  return (
    <Table regionLabel={rateRegionLabel(customerName)} caption={rateRegionLabel(customerName)}>
      <TableHeader>
        <TableRow>
          <TableHead>{RATE_HEADINGS.rate}</TableHead>
          <TableHead className="text-right">{RATE_HEADINGS.default}</TableHead>
          <TableHead>{RATE_HEADINGS.own}</TableHead>
          <TableHead>{RATE_HEADINGS.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rates.map((rate) => (
          <TableRow key={rate.processItemId} data-rate-id={rate.processItemId}>
            <TableHead scope="row" className={cn('bg-transparent text-body font-normal tracking-normal text-ink normal-case', BREAK_LONG_NAMES)}>
              {rate.name}
            </TableHead>
            <TableCell className="text-right text-ink-2 tabular-nums">{formatDefaultValue(rate.defaultValue, rate.unit)}</TableCell>
            <TableCell className="min-w-44 align-top">
              <RateInput
                rate={rate}
                customerName={customerName}
                value={inputs[rate.processItemId] ?? rate.value}
                error={errors[rateErrorKey(rate.processItemId)]}
                onChange={(value) => onChange(rate.processItemId, value)}
              />
            </TableCell>
            <TableCell>
              <Status rate={rate} typed={inputs[rate.processItemId]} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
