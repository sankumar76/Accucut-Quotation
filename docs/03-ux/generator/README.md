# Screen generator (review mock-ups)

This folder makes the HTML pages in `../screens/`, the pages the delivery lead reviews before
development starts. **Change a screen here, not in the HTML:** the pages are output, and the next
build overwrites any hand edit. `../ux-spec.md` is the rule book; where the two differ, the spec wins
and the generator is the defect.

It uses Node's built-in modules only (`fs`, `path`). There is no `package.json`, no install and no new
dependency. The files end in `.cjs` so that they keep working when the application's own
`package.json` sets `"type": "module"`. If the application's lint run covers `docs/`, exclude this folder.

## Files

| File | What it holds |
|------|---------------|
| `lib.cjs` | Icons, page shell, the invented sample data (`PEOPLE`, `RATES`, `MAT`, `FX`, `NODES`, `TASKS`) and the calculation every figure on every screen comes from (SPEC section 7.4) |
| `s1.cjs` | SCR-00 to 04: design system, sign in, forgot password, queues, assign |
| `s2.cjs` | SCR-05 to 10: estimate workspace, review, cost details, approve, unlock, export |
| `s3.cjs` | SCR-11 to 16 and 23 to 26: masters, users, settings, audit log, account, about, menu, system pages |
| `s4.cjs` | SCR-17 to 22: fields, formula editor, insert, delete, checkpoints, e-mail previews |
| `s5.cjs` | Phone and tablet frames, and `index.html` (every screen and state) |
| `build.cjs` | Runs all of the above in order |
| `contrast.cjs` | WCAG contrast of every token pair (`node docs/03-ux/generator/contrast.cjs`) |
| `check-figures.cjs` | Needs Node only. Every number with 2 to 4 decimals on the money pages must come from the data model (a parent shows only its own row, so no sum of rows below may appear), and the identities of the quantity rule must hold (BL is the sum of every row's BG; BN; the override difference) |
| `check-screens.cjs` | Browser checks on the built pages: no horizontal scroll at 360, 768 and 1280 px, no script errors, axe-core (WCAG 2.0 to 2.2 A and AA), and a scan of the Engineer pages for amounts, rates and formulas. For every page that has a masters table (`.table-wrap.is-master`, ux-spec section 6.0) it also checks that every row action lies inside the visible region at 768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366 and 1440 px, with the region scrolled to its start and to its end, and again with the table forced to 1000 px wide (DEF-021) |

Not generated, edited by hand: `../screens/screens.css` (tokens and components, including the `.is-master` and `.col-actions` rules of the masters table), `../screens/screens.js`
(the state switcher and small interactions) and `../screens/fonts/`.

## Build

From the repository root:

```
node docs/03-ux/generator/build.cjs
```

It writes every page and `index.html` into `docs/03-ux/screens/` and prints the number of pages and
state links. To build elsewhere, for a comparison, set `SCREENS_OUT`:

```
SCREENS_OUT=/tmp/screens-check node docs/03-ux/generator/build.cjs
diff -rq /tmp/screens-check docs/03-ux/screens     # only screens.css, screens.js and fonts/ should differ
```

The output is deterministic: the same generator gives byte-identical pages. That is how a change is
confirmed. Build to a scratch folder before the edit, edit, build again, and read `diff -r`: only the
pages and states you meant to change should differ.

## Check

Figures, from the repository root, no install needed:

```
node docs/03-ux/generator/check-figures.cjs
```

Browser checks:

These need `playwright-core`, `axe-core` and a Chrome or Chromium. They are **not**
dependencies of this repository. Install them outside it (a scratch folder will do) and point to them:

```
QA_MODULES=/path/holding/node_modules CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" \
  node docs/03-ux/generator/check-screens.cjs
```

Options: `--pages SCR-06.html,SCR-10.html` for some pages, `--no-axe` for layout and script errors alone, `--skip-masters` to leave out the slow masters-table action check (about 950 page loads for the five pages that have one).
It prints one line per problem and exits 1 if there is one. axe cannot judge focus order or the meaning
of text; the manual rules in `ux-spec.md` section 8 still apply. The script does not use the Playwright or
chrome-devtools tools of a Claude session, which may be unavailable.

## Rules for the data and the text

- **Invented data only.** Names, part numbers, customers, rates, prices and e-mail addresses (`@example.test`)
  are made up. Do not paste anything from the sample workbook (`AMADA-20261006.xlsx`) or from a real
  quotation. The repository is public.
- **No secrets.** No passwords, keys, tokens, real contact details or local paths. The one password value
  on SCR-01 is the word `placeholder-only`.
- **Engineer pages show no amount, rate, formula or price** (FR-008). `check-screens.cjs` scans for it.
- **Letters and cell names in copy come from the field registry**, never typed by hand (UX-23).
- **Figures come from the model.** A worked line that does not reproduce its result within 0.005 makes
  the build throw. If a figure looks wrong, fix the data or formula in `lib.cjs`, not the text.

## What was checked when this folder was filed (2026-11-02, G3 condition 13)

- **Complete.** It builds all 40 pages and `index.html` and needs no other file. Built to a scratch
  folder it matched the committed pages byte for byte (41 files; only `screens.css`, `screens.js` and
  `fonts/` are not generated).
- **Secrets and personal data.** A scan for key and token patterns, private keys and long random strings,
  and a search for e-mail addresses, phone numbers, web addresses and local paths, found none. The only
  addresses are `@example.test` and the placeholder `name@company.com`; the phone numbers are the obvious
  dummies `+91 98765 0000n`.
- **Sample workbook values.** The text in the generator was compared with the text cells of the sample
  workbook. No customer, part number, description or person matches. What matches are column names and
  surface-treatment names, which the SPEC publishes, and the acceptance-tree numbering (1.1.1 and so on).
  The numbers were compared too. Of 82 decimal or larger numbers in the sample data block, 10 also occur
  somewhere in the workbook: 58, 95, 96, 60, 1.5 (three times), 18.5, 1.2 and 300. They are ordinary
  shop-floor magnitudes, so coincidence is likely. **The check did not establish which workbook columns they
  come from, so it cannot rule out that some are the real values.** The delivery lead decides whether to
  replace them. Replacing them changes every figure on the screens, so it means a rebuild and a refresh of
  the figures quoted in `ux-spec.md`.
