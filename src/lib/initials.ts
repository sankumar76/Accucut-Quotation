const MAX_INITIALS = 2;

/**
 * Up to two capital letters from a person's name, for the avatar ("Meera Iyer" gives "MI"). The first and
 * last words are used, so a middle name does not change them. An empty name gives "?" so the avatar is never blank.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word !== '');
  const first = words[0];
  if (first === undefined) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => word !== undefined)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, MAX_INITIALS);
}
