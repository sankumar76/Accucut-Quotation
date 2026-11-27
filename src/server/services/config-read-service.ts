import { totalFormulaNote } from '../../lib/config/field-notes';
import { isProtectedField } from '../../lib/fields/protected';
import { fieldLetter, findFieldByKey, findSystemField, referenceContext } from '../../lib/fields/registry';
import type { FieldDefinition, SectionDefinition, StageDefinition } from '../../lib/fields/field-schema';
import type { ConfigDocument } from '../../lib/fields/schema';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY, type FieldKind, type SystemRole } from '../../lib/fields/types';
import { toDisplayForm, type RateReference, type ReferenceContext } from '../../lib/formula';
import type { ConfigRepository } from '../repositories/config-repository';
import type { MasterRepository } from '../repositories/master-repository';

import { getCurrentVersion, type ConfigVersionCache } from './config-service';

/**
 * The read side of the field registry for SCR-17 "Fields and formulas" (STORY-08.01; FR-072; architecture sections 4.5 and 6, "Configuration"): every field with
 * its column letter, kind and formula, and the line that says which configuration version is current.
 *
 * **This is Restricted data.** A formula, and the name of a rate in it, must never reach an Engineer (NFR-002, ADR-008). Who may call is decided before this file
 * is reached: the two routes and the page are in the manifest for the Admin and the Lead only, and `withRoute` and `authorizePage` refuse every other role before
 * anything is read. This file is classed as blocked for an Engineer view (`tests/security/engineer-import-rule.test.ts`).
 *
 * The rows are built from the unprojected document of the current version (`getCurrentVersion`, which validates and caches it per version). Letters are derived from
 * positions and a formula is turned from its stored form to display form with the Process Master's rate names, so a re-lettering or a rate rename is followed at the next
 * read, and nothing here caches a letter or a name (FR-021, coding standards section 10). A formula that names a rate the Process Master no longer has cannot be shown;
 * the read fails (`FormulaError`, whose message never holds a word of the formula) and the screen shows its error state, rather than a half-true list.
 */

/** One row of the table: the fields a Lead or an Admin reads, and the two flags the Admin's actions (STORY-08.02 onward) are drawn from. */
export interface ConfigFieldRow {
  readonly id: string;
  /** The Excel column letter, derived from the field's position in the current version. */
  readonly letter: string;
  readonly label: string;
  /** "Section 2: Material and Dimensions" or "Stage 3: Process Costs"; a field in a section shows its section, one only in a stage shows the stage. */
  readonly place: string | null;
  readonly kind: FieldKind;
  /** The formula in display form (column letters and rate names), or `null` for a field that has none. */
  readonly formula: string | null;
  /** The role that makes this a System field (lock tag, no delete), or `null`. */
  readonly systemRole: SystemRole | null;
  /** One sentence that explains the formula (the estimate total, UX-09), or `null`. */
  readonly note: string | null;
  /** For an auto field whose value is found rather than typed or worked out: the words that say where it comes from ("From tree position", "Material-Considered for E"), or `null` (AQP-473, DEF-118). The letter in them is derived here, never typed into a screen. */
  readonly lookup: string | null;
  /** True for an output that has a formula: the one kind of field "Edit formula" is offered on (UX-08: not on A, F, I, BO). */
  readonly canEditFormula: boolean;
  /** True for a field the Admin may never delete (STORY-08.04 AC-5): a System field, or one the code finds by key and cannot do without. It has the lock tag "System" and no Delete. */
  readonly isProtected: boolean;
}

export interface ConfigFieldsView {
  readonly fields: ReadonlyArray<ConfigFieldRow>;
}

/** `GET /api/v1/config/current`: the version line (STORY-08.01 AC-6). */
export interface ConfigCurrentView {
  readonly number: number;
  /** The person who made the version; `null` for version 1, the seed, which no person saved. */
  readonly savedBy: string | null;
  /** An ISO 8601 instant in UTC; the screen shows IST. */
  readonly savedAt: string;
  /** Estimates whose current stored calculation was worked out with this version. */
  readonly estimatesInUse: number;
}

export interface ConfigReadService {
  /** Every field in column order, with its formula in display form. Admin and Lead only (the route and the page say so). */
  getFields(): Promise<ConfigFieldsView>;
  /** The number, saver, time and use count of the current version. Admin and Lead only. */
  getCurrent(): Promise<ConfigCurrentView>;
}

export interface ConfigReadDependencies {
  readonly configurations: ConfigRepository;
  /** The Process Master: its rate names are what a formula shows in place of a stored `{{rate:...}}` reference. */
  readonly masters: Pick<MasterRepository, 'listProcessItems'>;
  /** The parsed-version cache; the process's own when none is given (`getCurrentVersion`). Tests pass one. */
  readonly cache?: ConfigVersionCache | undefined;
}

function placeOf(document: ConfigDocument, field: FieldDefinition): string | null {
  if (field.sectionId !== null) {
    const section: SectionDefinition | undefined = document.sections.find((candidate) => candidate.id === field.sectionId);
    if (section !== undefined) return `Section ${section.number}: ${section.name}`;
  }
  if (field.stageId !== null) {
    const stage: StageDefinition | undefined = document.stages.find((candidate) => candidate.id === field.stageId);
    if (stage !== undefined) return `Stage ${stage.number}: ${stage.name}`;
  }
  return null;
}

/** Where an auto field gets its value (the ux-expert's words, 2026-11-26, found by the field's key or role); `null` for every other field. The letter of the material in the drawing is the one found by its key. */
function lookupOf(document: ConfigDocument, field: FieldDefinition): string | null {
  if (field.kind !== 'auto') return null;
  if (field.systemRole === 'sl-no') return 'From tree position';
  const source = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  if (source === undefined) return null;
  if (field.key === MATERIAL_CONSIDERED_KEY) return `Material-Considered for ${fieldLetter(source)}`;
  if (field.key === MATERIAL_RATE_KEY) return `Material-Price-per-kg for ${fieldLetter(source)}`;
  return null;
}

function rowOf(document: ConfigDocument, field: FieldDefinition, context: ReferenceContext): ConfigFieldRow {
  const storedFormula = field.kind === 'output' ? field.formula : null;
  return {
    id: field.id,
    letter: fieldLetter(field),
    label: field.label,
    place: placeOf(document, field),
    kind: field.kind,
    formula: storedFormula === null ? null : toDisplayForm(storedFormula, context),
    systemRole: field.systemRole,
    note: noteOf(document, field),
    lookup: lookupOf(document, field),
    canEditFormula: storedFormula !== null,
    isProtected: isProtectedField(field),
  };
}

/** The sentence under the estimate total's formula (UX-09): it names the column of the per-row price, found by its role and never typed. */
function noteOf(document: ConfigDocument, field: FieldDefinition): string | null {
  if (field.systemRole !== 'total') return null;
  const unitPrice = findSystemField(document, 'unit-price');
  return unitPrice === undefined ? null : totalFormulaNote(fieldLetter(unitPrice));
}

/** The rows of a document in column order. Pure: the rates are passed in. */
export function configFieldRows(document: ConfigDocument, rates: ReadonlyArray<RateReference>): ReadonlyArray<ConfigFieldRow> {
  // The context is built once and shared by every row, not rebuilt per formula (the registry has about 70 fields; PRF-04).
  const context = referenceContext(document, rates);
  return [...document.fields].sort((a, b) => a.position - b.position).map((field) => rowOf(document, field, context));
}

export function createConfigReadService({ configurations, masters, cache }: ConfigReadDependencies): ConfigReadService {
  const currentVersion = () => getCurrentVersion(configurations, cache);
  return {
    async getFields() {
      const [version, items] = await Promise.all([currentVersion(), masters.listProcessItems()]);
      return { fields: configFieldRows(version.document, items.map(({ id, name }) => ({ id, name }))) };
    },

    async getCurrent() {
      const version = await currentVersion();
      const { savedByName, estimatesInUse } = await configurations.readVersionUse(version.id);
      return { number: version.number, savedBy: savedByName, savedAt: version.createdAt, estimatesInUse };
    },
  };
}
