import { z } from 'zod';

import { assertNever } from '../assert-never';

import type { FieldDefinition, SectionDefinition, StageDefinition } from './field-schema';
import { extractReferences, FormulaReferenceError } from './formula-references';
import {
  EXCHANGE_CURRENCIES,
  MATERIAL_OPERAND_KEYS,
  SYSTEM_ROLES,
  type FieldKind,
  type SystemRole,
} from './types';
import { isEngineerVisibleAllowed } from './visibility';

/**
 * The rules that look across fields (architecture section 4.5, ADR-004). A document that breaks one is
 * refused whole and nothing is stored (STORY-03.01 AC-6). Each function checks one rule and returns
 * its problems, with the path of the offending value so the message can point at it.
 *
 * Not here: cycles between formulas and the grammar of a formula. They belong to the formula engine
 * (STORY-03.02), which runs on every edit.
 */

export interface DocumentParts {
  readonly sections: ReadonlyArray<SectionDefinition>;
  readonly stages: ReadonlyArray<StageDefinition>;
  readonly fields: ReadonlyArray<FieldDefinition>;
}

export interface DocumentIssue {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/** The kind each system role must have (architecture section 4.5). */
const SYSTEM_ROLE_KIND: Readonly<Record<SystemRole, FieldKind>> = {
  'sl-no': 'auto',
  quantity: 'input',
  'unit-price': 'output',
  total: 'output',
  'tool-cost': 'input',
  'approved-price': 'output',
};

function duplicateIssues<T>(
  items: ReadonlyArray<T>,
  collection: string,
  property: string,
  pick: (item: T) => string | number | null,
): DocumentIssue[] {
  const seen = new Set<string | number>();
  const issues: DocumentIssue[] = [];
  items.forEach((item, index) => {
    const value = pick(item);
    if (value === null) return;
    if (seen.has(value)) issues.push({ path: [collection, index, property], message: `Two ${collection} have the same ${property}.` });
    seen.add(value);
  });
  return issues;
}

function uniquenessIssues({ sections, stages, fields }: DocumentParts): DocumentIssue[] {
  return [
    ...duplicateIssues(fields, 'fields', 'id', (field) => field.id),
    ...duplicateIssues(fields, 'fields', 'key', (field) => field.key),
    ...duplicateIssues(fields, 'fields', 'formOrder', (field) => field.formOrder),
    ...duplicateIssues(sections, 'sections', 'id', (section) => section.id),
    ...duplicateIssues(sections, 'sections', 'number', (section) => section.number),
    ...duplicateIssues(stages, 'stages', 'id', (stage) => stage.id),
    ...duplicateIssues(stages, 'stages', 'number', (stage) => stage.number),
  ];
}

/** Positions are 1 to N in list order, so a letter is always the place in the list. */
function positionIssues({ fields }: DocumentParts): DocumentIssue[] {
  return fields.flatMap((field, index) =>
    field.position === index + 1
      ? []
      : [{ path: ['fields', index, 'position'], message: `Position must be ${index + 1}: positions run 1 to N in list order.` }],
  );
}

function engineerVisibleIssues({ fields }: DocumentParts): DocumentIssue[] {
  return fields.flatMap((field, index) =>
    field.engineerVisible && !isEngineerVisibleAllowed(field)
      ? [{ path: ['fields', index, 'engineerVisible'], message: 'engineerVisible is allowed only on input fields and on Material Considered.' }]
      : [],
  );
}

/** `multiline` describes how text is entered, so only a text input may carry it, true or false. */
function multilineIssues({ fields }: DocumentParts): DocumentIssue[] {
  return fields.flatMap((field, index) =>
    field.kind === 'input' && field.multiline !== undefined && field.dataType !== 'text'
      ? [{ path: ['fields', index, 'multiline'], message: 'multiline is allowed only on a text input.' }]
      : [],
  );
}

function placementIssues({ sections, stages, fields }: DocumentParts): DocumentIssue[] {
  const sectionIds = new Set(sections.map((section) => section.id));
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
  return fields.flatMap((field, index): DocumentIssue[] => {
    const issues: DocumentIssue[] = [];
    if (field.sectionId !== null && !sectionIds.has(field.sectionId)) {
      issues.push({ path: ['fields', index, 'sectionId'], message: 'sectionId names no section.' });
    }
    const stage = field.stageId === null ? undefined : stagesById.get(field.stageId);
    if (field.stageId !== null && stage === undefined) {
      issues.push({ path: ['fields', index, 'stageId'], message: 'stageId names no stage.' });
    }
    if (field.group !== null && (stage === undefined || !stage.subHeadings.includes(field.group))) {
      issues.push({ path: ['fields', index, 'group'], message: 'group must be one of the sub-headings of the field\'s stage.' });
    }
    return issues;
  });
}

function rowScopeIssues({ fields }: DocumentParts): DocumentIssue[] {
  return fields.flatMap((field, index) =>
    field.rowScope === 'product' && field.kind !== 'output'
      ? [{ path: ['fields', index, 'rowScope'], message: 'Only an output can have the product scope.' }]
      : [],
  );
}

/** `hideWhenZero`, `visibleWhen` and stage totals are references: each must name a field that exists. */
function fieldReferenceIssues({ stages, fields }: DocumentParts): DocumentIssue[] {
  const ids = new Set(fields.map((field) => field.id));
  const issues: DocumentIssue[] = [];
  fields.forEach((field, index) => {
    if (field.kind === 'output' && field.hideWhenZero !== null && (!ids.has(field.hideWhenZero) || field.hideWhenZero === field.id)) {
      issues.push({ path: ['fields', index, 'hideWhenZero'], message: 'hideWhenZero must name another field of the registry.' });
    }
    if (field.kind === 'input' && field.visibleWhen !== null && (!ids.has(field.visibleWhen.fieldId) || field.visibleWhen.fieldId === field.id)) {
      issues.push({ path: ['fields', index, 'visibleWhen', 'fieldId'], message: 'visibleWhen must name another field of the registry.' });
    }
  });
  stages.forEach((stage, stageIndex) => {
    stage.totalFieldIds.forEach((fieldId, index) => {
      if (!ids.has(fieldId)) issues.push({ path: ['stages', stageIndex, 'totalFieldIds', index], message: 'A stage total names a field that is not in the registry.' });
    });
  });
  return issues;
}

function formulaProblems(formula: string, fieldIds: ReadonlySet<string>): string[] {
  try {
    return extractReferences(formula).flatMap((reference) => {
      switch (reference.kind) {
        case 'field':
          return fieldIds.has(reference.id) ? [] : ['A formula refers to a field that is not in the registry.'];
        case 'rate':
          return z.uuid().safeParse(reference.id).success ? [] : ['A formula holds a rate reference that is not an ID.'];
        case 'material':
          return MATERIAL_OPERAND_KEYS.some((key) => key === reference.key) ? [] : ['A formula refers to a material value that does not exist.'];
        case 'exchange':
          return EXCHANGE_CURRENCIES.some((currency) => currency === reference.currency) ? [] : ['A formula refers to an exchange rate that does not exist.'];
        default:
          return assertNever(reference);
      }
    });
  } catch (error) {
    if (error instanceof FormulaReferenceError) return [error.message];
    throw error;
  }
}

function formulaIssues({ fields }: DocumentParts): DocumentIssue[] {
  const ids = new Set(fields.map((field) => field.id));
  return fields.flatMap((field, index) =>
    field.kind === 'output' && field.formula !== null
      ? formulaProblems(field.formula, ids).map((message) => ({ path: ['fields', index, 'formula'], message }))
      : [],
  );
}

function systemRoleIssues({ fields }: DocumentParts): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  fields.forEach((field, index) => {
    if (field.systemRole === null) return;
    if (field.kind !== SYSTEM_ROLE_KIND[field.systemRole]) {
      issues.push({ path: ['fields', index, 'systemRole'], message: `The ${field.systemRole} role belongs to a ${SYSTEM_ROLE_KIND[field.systemRole]} field.` });
    }
    if (field.systemRole === 'approved-price' && field.kind === 'output' && field.formula !== null) {
      issues.push({ path: ['fields', index, 'formula'], message: 'The approved price is entered at approval and has no formula.' });
    }
  });
  for (const role of SYSTEM_ROLES) {
    const holders = fields.filter((field) => field.systemRole === role).length;
    if (holders !== 1) issues.push({ path: ['fields'], message: `The ${role} role must belong to exactly one field (found ${holders}).` });
  }
  return issues;
}

/** Every cross-field problem of a document, in a stable order. Empty means the document is valid. */
export function collectDocumentIssues(parts: DocumentParts): DocumentIssue[] {
  return [
    ...uniquenessIssues(parts),
    ...positionIssues(parts),
    ...engineerVisibleIssues(parts),
    ...multilineIssues(parts),
    ...placementIssues(parts),
    ...rowScopeIssues(parts),
    ...fieldReferenceIssues(parts),
    ...formulaIssues(parts),
    ...systemRoleIssues(parts),
  ];
}
