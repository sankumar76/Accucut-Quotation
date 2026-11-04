/** The skip link: the first stop on every page, hidden until it has focus. The page's `main` must have `id="main"`. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute -top-s-7 left-s-3 z-(--z-skip-link) rounded-md bg-ink px-s-4 py-s-2 text-on-fill focus:top-s-2 focus:text-on-fill"
    >
      Skip to main content
    </a>
  );
}
