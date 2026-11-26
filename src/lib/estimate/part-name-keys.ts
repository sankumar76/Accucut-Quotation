/**
 * The keys of the two fields that name a part, in the order they are tried: Description, then Part No. (FR-029; AQP-446, DEF-089). In a file of its own, with no import, so the browser can read it (the part
 * form marks these two fields; `calculate-check.ts` pulls in the whole registry and must stay out of the first load, NFR-009).
 */
export const PART_NAME_KEYS = ['description', 'part-no'] as const;

export type PartNameKey = (typeof PART_NAME_KEYS)[number];

export const isPartNameKey = (key: string): key is PartNameKey => PART_NAME_KEYS.some((name) => name === key);
