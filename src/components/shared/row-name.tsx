import { hasRowName, NO_DESCRIPTION_YET } from '@/lib/estimates/row-name';

export interface RowNameProps {
  /** What the row's name is when it has one (its Description, else its Part No.), or an empty text. */
  readonly label: string;
  /** The name of the row's kind (`nodeKindLabel`: Part or Sub-part follows the siblings), drawn when the row has no name yet. */
  readonly kindLabel: string;
}

/**
 * The name of a row of a parts tree or a table (AQP-446, DEF-089; UX ruling `parts-tree-scr05-conformance-2026-11-26.md` item 1): the label as typed, or, with none, the kind's own name in the muted style of a
 * placeholder: `--ink-2` (never `--ink-3`), italic and at normal weight, so colour is not the only cue (WCAG 1.4.1). For a screen reader the kind's name is followed by ", no description yet". Server code
 * with no hook, so SCR-06 draws it with no script.
 */
export function RowName({ label, kindLabel }: RowNameProps) {
  if (hasRowName(label)) return <>{label}</>;
  return (
    <span className="font-normal text-ink-2 italic">
      {kindLabel}
      <span className="sr-only">{NO_DESCRIPTION_YET}</span>
    </span>
  );
}
