import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  FieldRenderer,
  type FieldRendererProps,
} from "@/components/features/estimate-workspace/field-renderer";
import type { FormField, FormRule } from "@/lib/estimates/form-client";

/**
 * QLT-F-08 (GitHub #690), FR-052 (decimal keyboard): a number field of the part form asks a phone for the decimal keyboard, with or without a unit beside it. The attribute is read as rendered
 * (the first paint, no browser). Losing it in a refactor would otherwise pass CI and give phone users the full keyboard.
 */

const field = (id: string, rule: FormRule, unit: string | null): FormField => ({
  id: `00000000-0000-4000-8000-00000000e0${id}`,
  letter: "J",
  label: "Length",
  kind: "input",
  unit,
  hint: null,
  defaultValue: null,
  required: false,
  editable: true,
  visibleWhen: null,
  rule,
});

const render = (
  formField: FormField,
  overrides: Partial<FieldRendererProps> = {},
): string =>
  renderToStaticMarkup(
    createElement(FieldRenderer, {
      field: formField,
      text: "12.5",
      error: undefined,
      editable: true,
      materials: { status: "ready", value: [] },
      onChange: () => undefined,
      onCommit: () => undefined,
      ...overrides,
    }),
  );

/** The attributes of every `<input ...>` in the markup, name to value, so the test reads what was rendered and not a guess at its spelling. */
const inputs = (markup: string): ReadonlyArray<ReadonlyMap<string, string>> =>
  [...markup.matchAll(/<input\b([^>]*)>/g)].map(
    ([, attributes]) =>
      new Map(
        [...(attributes ?? "").matchAll(/([\w-]+)="([^"]*)"/g)].map(
          ([, name, value]) =>
            [(name ?? "").toLowerCase(), value ?? ""] as const,
        ),
      ),
  );

describe("FR-052: a number field asks for the decimal keyboard", () => {
  it('a number with no unit (a quantity or a price) renders one input with inputmode="decimal"', () => {
    const [input, ...others] = inputs(
      render(field("01", { type: "number", decimals: 2 }, null)),
    );
    expect(others).toHaveLength(0);
    expect(input?.get("inputmode")).toBe("decimal");
  });

  it('a number with a unit (a dimension in mm, a weight in kg) renders its input with inputmode="decimal", the unit beside it', () => {
    const markup = render(field("02", { type: "number", decimals: 1 }, "mm"));
    const [input, ...others] = inputs(markup);
    expect(others).toHaveLength(0);
    expect(input?.get("inputmode")).toBe("decimal");
    expect(markup).toContain("mm");
  });

  it('a number the person may not change keeps inputmode="decimal" too (read-only, not another keyboard)', () => {
    const [input] = inputs(
      render(field("03", { type: "number", decimals: 2 }, "kg"), {
        editable: false,
      }),
    );
    expect(input?.get("readonly")).toBeDefined();
    expect(input?.get("inputmode")).toBe("decimal");
  });
});

describe("FR-052: a field that is not a number does not ask for the decimal keyboard", () => {
  it("a text field has no inputmode, so words get the full keyboard", () => {
    const [input] = inputs(
      render(
        field("04", { type: "text", maxLength: 40, multiline: false }, null),
        { text: "Bracket" },
      ),
    );
    expect(input).toBeDefined();
    expect(input?.get("inputmode")).toBeUndefined();
  });

  it("a derived field has no inputmode", () => {
    const [input] = inputs(
      render(field("05", { type: "derived", from: null }, null), { text: "1" }),
    );
    expect(input).toBeDefined();
    expect(input?.get("inputmode")).toBeUndefined();
  });
});
