/**
 * Which side-menu entry is the current page. The home link `/` matches only itself; any other entry also
 * matches the pages below it (`/estimates` is current on `/estimates/Q-1`). Trailing slashes are ignored.
 */
export function isActivePath(pathname: string, href: string): boolean {
  const current = trimTrailingSlash(pathname);
  const target = trimTrailingSlash(href);
  if (target === '') return current === '';
  return current === target || current.startsWith(`${target}/`);
}

function trimTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
