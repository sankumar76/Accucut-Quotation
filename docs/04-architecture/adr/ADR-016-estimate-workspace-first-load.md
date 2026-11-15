# ADR-016: First-load JavaScript on `/estimates/[code]`: what stays, what loads lazily

| Field | Value |
|-------|-------|
| Status | Accepted (2026-11-15, solution-architect; for `master` to log) |
| Date | 2026-11-15 |
| Deciders | solution-architect (+ Santhosh, delivery lead, at G8 or on request) |
| Related | NFR-009, NFR-016, NFR-018, RISK-020 (GitHub #61), #36, AQP-188 (architecture section 10, overlay rule), AQP-302 (STORY-05.02), AQP-317, AQP-315, AQP-318 (PR #416); tracking issue [#418](https://github.com/sankumar76/Accucut-Quotation/issues/418) |

## Context

NFR-009 limits every route's first-load JavaScript to **200,000 bytes gzip**. `scripts/check-js-budget.ts` checks this in CI stage 11b on every pull request. This ADR does not change that limit, which is a product decision.

**Where the route stands (CI, stage 11b):**

| Commit | `/estimates/[code]` | Headroom | Source |
|---|---|---|---|
| master 5c89585 | 199,556 | 444 | run 43677252797 |
| PR #416 head fb02beb (AQP-318, with the quantity-warning dialog lazy) | **199,997** | **3** | run 43678739905 |
| `/` (the portal shell and nothing else) | 163,283 | 36,717 | run 43677252797 |

So the shell costs about 163.3 KB on every signed-in route. This route's own client code is about **36.7 KB** at fb02beb. Every other route has 9.7 KB or more of headroom (`/masters/materials` is the next tightest at 190,273). AQP-320 (06.03), AQP-321 (06.04), AQP-313 (05.05) and wave 2 all add to this route. Once #416 merges, the next of them fails stage 11b.

**Why the Lead's and the Admin's page carries the Engineer's code.** The budget check measures every page as the Admin. On this route the Admin gets SCR-06 (`review-page.tsx` and `components/features/estimate-review/**`), which has no `'use client'` module. But Next.js names every client module in the page's module graph in the HTML, whichever branch renders. So the Engineer's workspace (SCR-05) is the whole 36.7 KB on both branches. AQP-318 changed only Engineer code and still raised the Admin's number by 441 bytes.

**How the per-item sizes were measured.** No local `next build` was run, because the PC had about 1.2 GB of free memory. The route's client graph (`estimate-workspace.tsx` and everything it imports statically) was bundled from a clean copy of each commit with esbuild 0.28.2: minified, ESM, code splitting on. React, Next.js and what the shell already loads at first paint were left out: Button and its Slot, the icons, `cn` with `tailwind-merge`, `clsx` and `cva`, and `Icon`. Each first-load chunk was compressed with `gzip -9`, as stage 11b does. A "cut" turns one static import into a lazy one, and its saving is the first-load gzip that leaves. **Calibration:** esbuild gives 33,899 bytes on master and 34,236 at fb02beb, against 36,273 and 36,714 in CI (each minus the shell). That is a steady factor of **1.07**, and the AQP-318 increase is reproduced (+337 in esbuild, +441 in CI). Expected CI savings below are the esbuild figure × 1.07, rounded. The scripts are not in the repository. They were throw-away measurement tools, and E1's pull request gives the real figure.

**Largest client modules in the route's first load (fb02beb, esbuild gzip share):**

| # | Item | Modules | gzip | Visible at first paint? |
|---|------|---------|------|-------------------------|
| 1 | Radix Dialog stack behind `ui/sheet` | `@radix-ui/react-dialog`, `-focus-scope`, `-dismissable-layer`, `-portal`, `-presence`, `react-remove-scroll`, `aria-hidden` and helpers, `components/ui/sheet.tsx` | **≈ 14.1 KB** (13.8 KB on its own) | **No.** It is the drawer for the parts tree below 768 px, opened by the "Parts tree" button. `parts-tree-area.tsx` imports it statically (AQP-302, #384), so desktop and tablet pay for it too. **This breaks the existing section 10 overlay rule (AQP-188)**: no test checks that rule statically |
| 2 | Part fields | `part-fields`, `field-renderer`, `section-card`, `section-strip`, `placeholder-fields`, `picture-slot`, `use-part-form` (values), `form-client`, `form-values`, `native-select`, `input`, `textarea`, `unit-input`, `form-field` + Radix Label | ≈ 5.9 KB | No. They show only after the tree has loaded (after mount) and a part is chosen. Until then the form shows a sentence or skeletons |
| 3 | Part form shell | `part-form`, `useFormDefinition` | ≈ 1.2 KB beyond item 2 | Sentence or skeleton only |
| 4 | Tree panel | `tree-panel`, `tree-node`, `tree-moves`, part of `estimate-texts` | ≈ 1.6 KB | Skeleton only: `usePartsTree` fetches the tree after mount |
| 5 | Header | `workspace-header`, `folder-path` (copy button), `status-badge`, `page-header` | ≈ 1.4 KB | Yes, but it is display apart from the copy button and the badge |
| 6 | Customer field | `customer-picker`, `use-customer-choice`, `estimates-client` | ≈ 0.9 KB | Yes, and it is interactive |
| 7 | Workspace root, Calculate hook, save gate, texts, state machine, `alert`, `card`, `badge` | | ≈ 4 KB | Yes |
| | Already lazy (not in the first load): picture control 3.7 KB, Calculate bar 1.3 KB, quantity-warning dialog and Calculate client ≈ 2.5 KB, blocked summary 0.7 KB, change-customer dialog 0.8 KB, delete-part dialog 0.6 KB | | | |

## Decision Drivers
- NFR-009: 200,000 bytes gzip per route, fixed. The work needs a reserve that lasts through EPIC-05, EPIC-06 and wave 2, not one story at a time.
- Fast track (CLAUDE.md section 9): the fix must be one small enabler story that one developer can ship in a day. It must be test-first and green in CI, with no refactor of the estimate workspace's state.
- NFR-016, NFR-018: the phone drawer keeps its focus trap, Escape and focus return. The form keeps its skeletons and announcements. A load that fails can be retried (the same reason `use-lazy-component.ts` and `use-first-open.ts` exist).
- NFR-002: no change to what a role receives. These are client code moves only, and no figure enters any client module.
- Simplest design: reuse the two loaders already in the code (`useFirstOpen` for overlays, `useLazyComponent` for in-page parts) and add no dependency.

## Considered Options

### Option A: Lazy-load what is not usable at first paint, starting with the phone drawer and the part fields (chosen)
- Pros: the largest item (14 KB) is a breach of an existing rule, and the fix is mechanical through `useFirstOpen`. The part fields cannot show before two client fetches (tree, then form definition), so fetching their code during the same time costs nothing a person sees. Together they give about 20.7 KB. For scale, AQP-318 added 441 bytes, and the lazy parts already split off are 0.6 to 3.7 KB each, so this is room for many stories, not one. No dependency changes.
- Cons: two more small chunks to request after mount. The phone drawer's first open waits for its code (the early-tap script of AQP-188 already handles a tap made before then).
- Cost / effort: E1 about 2 points.

### Option B: Move the Engineer's whole edit area (tree, form and their hooks) behind one lazy boundary
- Pros: the largest single saving, about 26.6 KB (it includes Option A).
- Cons: `usePartsTree` and the save gate are shared with Calculate and the blocked summary (`estimate-workspace.tsx`), so the state would have to move or be passed through a new boundary. That is a refactor of tested behaviour in the middle of EPIC-05/06, with merge conflicts against AQP-320, AQP-321 and AQP-313. It gains only about 5.5 KB more than Option A with E2 to E4.
- Cost / effort: about 5 points; conflict-prone. Kept as reserve E5.

### Option C: Swap heavy client dependencies (for example replace Radix Dialog in `Sheet`, or drop `tailwind-merge` from `cn`)
- Pros: `tailwind-merge` (about 9 KB, RISK-020) would help every route.
- Cons: Radix gives the drawer its accessibility (NFR-018). A hand-rolled drawer is new risk for a saving that lazy loading already gets. Dropping `tailwind-merge` changes class-conflict behaviour across every component and needs a project-wide review. Neither is needed while Option A is enough.
- Cost / effort: large; not now. `tailwind-merge` stays the cross-route reserve under RISK-020.

### Option D: Raise the route's limit through `ROUTE_LIMITS`
- Rejected. That is the product-manager's decision with a Lighthouse run (STORY-10.10 AC-3), and the brief rules it out.

### Option E: Split the Engineer's and the Lead's pages into two routes
- Pros: the Admin's measured page would lose all 36.7 KB.
- Cons: one address per task is a UX and route-manifest decision (SCR-05/SCR-06, FR-089, `authorizePage`). The Engineer's page, which is the one that grows, would not get any smaller. Out of scope here.

## Decision

We take **Option A**, in this order. The savings are expected CI figures at fb02beb.

| Rank | Change | Expected saving | Owner |
|------|--------|-----------------|-------|
| **E1** | **Enabler story, one developer, about 2 points, ahead of AQP-320, AQP-321 and AQP-313.** (a) The phone tree drawer on first open: `parts-tree-area.tsx` imports `Sheet` only as a type. A new `parts-tree-drawer.tsx` holds `Sheet`/`SheetContent` with the tree, and is loaded through `useFirstOpen` (`id` `parts-tree`, `data-early-intent` on the "Parts tree" button, which stays a plain first-load button). The panel stays mounted once loaded, and the tree's state stays in the workspace. (b) The part fields lazy: `part-form.tsx` loads `PartFields` through `useLazyComponent` (requested on mount; the existing skeleton until it arrives; the existing "Try again" notice if it fails). `focusFirstField` moves from `part-fields.tsx` to `focus-field.ts`, so `estimate-workspace.tsx` no longer imports `part-fields`. (c) The static overlay-import test (Verification) | (a) ≈ 14.5 KB, (b) ≈ 6.2 KB, **together ≈ 20.7 KB** (esbuild 19,407 B): **about 179.3 KB afterwards** | New enabler, for the scrum-master to write under EPIC-05 (proposed STORY-05.13, "Estimate workspace first-load headroom"); tracked on #418 |
| E2 | The whole `PartForm` column lazy (`useFormDefinition` with it), behind the same sentence or skeleton | ≈ 1.3 KB more than E1 | The first EPIC-05/06 story that adds a form section, or a follow-up on #418 |
| E3 | `TreePanel` lazy behind the tree skeleton (`usePartsTree` already fetches after mount) | ≈ 1.7 KB | Follow-up on #418 |
| E4 | `WorkspaceHeader` rendered by `page.tsx` as a Server Component. The status badge, which changes on Submit, and the folder path's copy button stay as small client islands | ≈ 1.5 KB | Follow-up on #418 |
| E5 (reserve) | Option B, the whole edit area behind one boundary. Only if headroom falls under 10 KB again | ≈ 5.5 KB after E1 to E4 | Not scheduled |

Each of E2 to E5 is measured again in its pull request. The rule in architecture section 10 ("`/estimates/[code]` first load") applies from now on to every story that touches the route.

## Consequences
- Positive: about 20 KB of headroom after E1, enough for the rest of EPIC-05/06 and wave 2 at today's rate. The AQP-188 rule gets a static test, so the next overlay import into a first-load module fails stage 6 instead of stage 11b. Desktop and tablet stop downloading a phone-only drawer.
- Negative / trade-offs accepted: two more requests after mount. The first open of the phone drawer waits for about 14 KB, as every other overlay already does. The early-tap script covers a press made before hydration. A failed chunk shows the existing "Try again" path, which is already tested for the picture and the Calculate bar.
- The Lead's and the Admin's SCR-06 keeps carrying the Engineer's client code (Option E not taken). It shrinks with every step above.
- Follow-up actions (with owners): scrum-master writes E1 and orders it before AQP-320, AQP-321 and AQP-313. The developer reports the stage 11b figure for `/estimates/[code]` in the PR's Dev Record. solution-architect updates this ADR with the measured E1 figure. `master` logs the ADR and links RISK-020.

## Verification
- **Stage 11b:** `/estimates/[code]` at or under **185,000** bytes once E1 merges (expected about 179,300). Each later story's PR states the route's figure before and after.
- **New unit test (stage 6, in E1):** for every module under `src/components/features/**` that imports `@/components/ui/{sheet,dialog,alert-dialog,dropdown-menu,popover}` statically, every importer of that module may reach it only through `import()` or `import type`. The same check applies to the modules listed as lazy in architecture section 10. It must fail on today's `parts-tree-area.tsx`.
- **E2E, three widths (stage 12):** the phone drawer opens, traps focus, closes on Escape, and Enter on a part sends focus to the form (STORY-05.02 AC-9). The early tap on "Parts tree" is kept (AQP-188 AC-10). The part form shows skeletons and then the fields, and its failure shows "Try again".
- **Review date:** at the G8 full review, or when headroom on this route falls under 10,000 bytes, whichever comes first.
