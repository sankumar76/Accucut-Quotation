import { Calculator, Pencil, Plus, Trash2 } from 'lucide-react';

import { ColumnTag } from '@/components/shared/column-tag';
import { FormField } from '@/components/shared/form-field';
import { UnitInput } from '@/components/shared/unit-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { DsSection } from './section';
import { SwitchDemo } from './switch-demo';

const ICON = 18;

/** SCR-00 section 05: one button size, four variants and the icon-only square. */
export function ButtonsSection() {
  return (
    <DsSection number="05" id="ds-buttons" title="Buttons" aside="One size: 44 px high, 16 px side padding, 8 px radius, 14 / 600">
      <div className="flex flex-wrap items-center gap-s-3">
        <Button>
          <Calculator aria-hidden="true" focusable="false" size={ICON} />
          Calculate
        </Button>
        <Button variant="secondary">
          <Plus aria-hidden="true" focusable="false" size={ICON} />
          Add part
        </Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">
          <Trash2 aria-hidden="true" focusable="false" size={ICON} />
          Delete
        </Button>
        <Button variant="secondary" size="icon" aria-label="Edit part">
          <Pencil aria-hidden="true" focusable="false" size={ICON} />
        </Button>
        <Button variant="secondary" size="icon-row" aria-label="Edit row">
          <Pencil aria-hidden="true" focusable="false" size={16} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-s-3">
        <Button loading>Calculating</Button>
        <Button disabled>Approve and lock</Button>
        <Button variant="secondary" disabled>
          Download Excel
        </Button>
        <p className="text-label text-ink-3">
          A button that starts work shows a spinner, uses the verb in the present tense and is disabled.
        </p>
      </div>
      <p className="text-label text-ink-3">
        Primary is the one main action on a screen (red). Secondary is for other actions. Ghost is low emphasis, inline. Danger is for
        deletes only, with a trash icon and the word &quot;Delete&quot;. The 36 px square is for rows of a dense table. Icon-only buttons always carry an
        accessible name. Focus ring: 3 px graphite, 2 px offset (white on the dark menu).
      </p>
    </DsSection>
  );
}

/** SCR-00 section 06: form controls and column letters, with invented values only. */
export function FormControlsSection() {
  return (
    <DsSection number="06" id="ds-forms" title="Form controls and column letters">
      <div className="grid grid-cols-1 gap-x-s-5 gap-y-s-4 md:grid-cols-2 xl:grid-cols-3">
        <FormField id="ds-length" label="Length" tag={<ColumnTag letter="J" />}>
          {(control) => <UnitInput unit="mm" inputMode="decimal" required defaultValue="720.00" {...control} />}
        </FormField>
        <FormField
          id="ds-thickness"
          label="Thickness"
          tag={<ColumnTag letter="L" />}
          hint="Enter this value. Use 0 if the part does not need it."
          error="Enter the thickness to calculate."
        >
          {(control) => <UnitInput unit="mm" inputMode="decimal" required defaultValue="" {...control} />}
        </FormField>
        <FormField id="ds-material-considered" label="Material Considered" tag={<ColumnTag letter="F" kind="auto" />} hint="Fills automatically from Material in Drawing.">
          {(control) => <Input readOnly defaultValue="Mild steel" {...control} />}
        </FormField>
        <FormField id="ds-material" label="Material in Drawing" tag={<ColumnTag letter="E" />}>
          {(control) => (
            <Select defaultValue="ms-cold">
              <SelectTrigger id={control.id} aria-describedby={control["aria-describedby"]} aria-invalid={control["aria-invalid"]}>
                <SelectValue placeholder="Choose material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ms-cold">MS sheet, cold rolled</SelectItem>
                <SelectItem value="ss-a">SS sheet, grade A</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="ds-disabled" label="Disabled field" tag={<ColumnTag letter="H" />} hint="Read-only after Submit or approval.">
          {(control) => <Input disabled defaultValue="1.00" {...control} />}
        </FormField>
        <div className="flex min-w-0 flex-col gap-s-2">
          <span className="flex items-center gap-s-2 text-label font-semibold text-ink-2">
            Output (Lead and Admin only) <ColumnTag letter="BG" kind="output" />
          </span>
          <p className="flex min-h-(--control-h) items-center rounded-md border border-dashed border-border-strong bg-surface-2 px-s-3 text-ink-2 tabular-nums">
            ₹ 1,234.50
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-s-6 gap-y-s-2">
        <div className="flex items-center">
          <Checkbox id="ds-check" defaultChecked aria-labelledby="ds-check-label" />
          <span id="ds-check-label" className="text-body text-ink">
            Include the setup cost
          </span>
        </div>
        <SwitchDemo />
      </div>
    </DsSection>
  );
}
