/**
 * Stands in for the `server-only` package inside Vitest (architecture section 10). The real package throws
 * unless it is loaded under the `react-server` export condition, which Vitest does not set for packages it
 * leaves to Node. Every `src/lib/formula/**` file imports it, so without this a unit test could not load the
 * engine. `vitest.config.ts` aliases `server-only` to this file.
 *
 * What the real package does is proved separately: `tests/unit/formula/server-only.test.ts` loads the engine in a
 * plain Node process (it must throw) and with `--conditions=react-server` (it must load), and
 * `tests/integration/config/ensure-seed-version-script.test.ts` runs the real script that way.
 */
export {};
