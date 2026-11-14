/**
 * The fixed vocabularies of the field registry (SPEC section 8.1; architecture section 4.5; ADR-004).
 *
 * The registry is one JSON document per configuration version. Its shape is defined once, in `schema.ts`,
 * from the lists below; the TypeScript types are inferred from that schema, not written twice.
 */

/** `input` is typed by a person, `auto` is filled from a master or by the system, `output` is calculated. */
export const FIELD_KINDS = ['input', 'auto', 'output'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** Every data type SPEC section 8.1 names. Which kind may use which type is decided in `schema.ts`. */
export const DATA_TYPES = ['number', 'text', 'select', 'select_other', 'flag', 'image', 'auto_lookup'] as const;
export type DataType = (typeof DATA_TYPES)[number];

/** `row` fields have a value per node; `product` fields (BL, BN, BO) have one per estimate. */
export const ROW_SCOPES = ['row', 'product'] as const;
export type RowScope = (typeof ROW_SCOPES)[number];

/**
 * Fields the code depends on (architecture section 4.5). They cannot be deleted, and `sl-no` and
 * `approved-price` have no editable formula.
 */
export const SYSTEM_ROLES = ['sl-no', 'quantity', 'unit-price', 'total', 'tool-cost', 'approved-price'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** How a section is drawn: a card of fields, or (section 07) one multi-select drop-down. */
export const DISPLAY_MODES = ['cards', 'multi-select'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

/**
 * The `{{mat:<key>}}` operands (architecture section 4.5, D-39). The Admin cannot add a Material Master
 * column, so this set is fixed; each key is a Prisma field of `materials`.
 */
export const MATERIAL_OPERAND_KEYS = ['pricePerKg', 'specificGravity', 'scrapRate'] as const;
export type MaterialOperandKey = (typeof MATERIAL_OPERAND_KEYS)[number];

/** The `{{fx:<currency>}}` operands: the Exchange Rate Master rows (1 unit of the currency in INR). */
export const EXCHANGE_CURRENCIES = ['USD', 'EUR'] as const;
export type ExchangeCurrency = (typeof EXCHANGE_CURRENCIES)[number];

/**
 * Key of Material Considered (column F). It is the one non-input field an Engineer may see
 * (ADR-008), so the allow-list rule in `visibility.ts` names it.
 */
export const MATERIAL_CONSIDERED_KEY = 'material-considered';

/**
 * Key of Material in Drawing (column E): the drop-down whose choice is a Material Master row. A stored calculation keeps its words, resolved at the
 * moment of the calculation, so a rename later changes no stored estimate (STORY-03.05, NFR-026).
 */
export const MATERIAL_IN_DRAWING_KEY = 'material-in-drawing';

/**
 * Key of Material Rate / Kg (column I): an `auto_lookup` field filled from the Material Master's price (SPEC section 7.1). The row
 * calculator supplies its value to the formulas that read it (Material Cost, AK).
 */
export const MATERIAL_RATE_KEY = 'material-rate-per-kg';

/** Key of Total Unit Production Price / Tool Cost (column BN): the product-level field that is BL divided by the total Tool Cost. */
export const PRICE_PER_TOOL_COST_KEY = 'price-per-tool-cost';
