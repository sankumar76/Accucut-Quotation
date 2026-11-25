# UX ruling: `/forgot-password` while e-mail is off (G-2; DL-379, DL-380; release plan KG-2b)

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-24 |
| Asked by | Coordinator, for the emergency-command PR (delivery lead chose option B for G-1, DL-380). Words needed by Fri 27 Nov 2026 |
| Defect class | Wording defect, Sev-3 proposed (DL-379 (C)), not a G8 blocker. Architecture v0.70 section 4.7, "G-2" |
| Read from | `records-u` at `b9031df3`: `ux-spec.md` SCR-02 (line 557), `generator/s1.cjs` `scr02()`, `src/app/(public)/forgot-password/page.tsx`, `forgot-password-form.tsx`, `reset-password/page.tsx`, `invalid-link-notice.tsx`, `sign-in/page.tsx`, `sign-in-form.tsx`, `public-page-frame.tsx`, `notice.tsx`, `src/lib/auth/password-reset.ts`; architecture v0.70 section 4.7 |
| Not done | No browser or test run. Nothing in `generator/**`, `SCR-*.html`, `screens.css` or `ux-spec.md` is edited (the CR-01 session owns them); the exact changes are listed below |

## The problem

With `FEATURE_EMAIL` off the sign-in page says "Forgot your password? Ask the Admin to reset it." and links nowhere. But `/forgot-password` still opens when its address is typed or bookmarked, shows the e-mail form, and after "Send reset link" says "Check your e-mail. If that address is registered, a reset link is on its way. It can be used once." No mail is sent and no token exists. The person waits for a mail that never comes.

## Ruling

**Show a static explanation instead of the form** while e-mail is off. Do not keep the form and answer truthfully.

Why static, not a truthful form:

1. **Nothing is asked that cannot be used.** A form that collects an e-mail address and then says "we cannot send it" asks for personal data for nothing and costs a round trip.
2. **Account enumeration (FR-001) holds with no effort.** The page is the same for everyone, makes no request and reads no account, so it cannot differ by address, by timing or by anything else. A truthful form would need the route to answer "not available" for every address; that is safe too (the switch is server-wide), but it changes a security-sensitive route for no gain. The route stays as it is: it already answers every address the same.
3. **It matches the sign-in page**, which already decides on the server, never in the browser, and shows the Release 1 sentence. One rule, one source (`loadEmailFeature()`), two pages that agree.
4. **Less to build and test:** one state, no form, no error cases.

What this reverses: decision D-1 ("the page reads no setting") applies to the **route**, which keeps it. The **page** now reads the flag, as the sign-in page does. The solution-architect updates section 4.7, row "`/forgot-password` page (SCR-02)", and G-2.

## The copy (exact)

With the flag off (absent, empty or `off`), `/forgot-password` shows, in the public page frame (skip link, white top bar with the brand, one narrow column, footer):

| Part | Text |
|---|---|
| Page title (`title`) | Forgot your password (unchanged) |
| `h1` | **Forgot your password?** (unchanged) |
| Lead sentence under it | **Ask the Admin to reset it.** (the sign-in page's sentence, word for word, without its first question) |
| Notice (`Notice`, tone `info`, icon `Info`, **no live-region role**: it is page content, not an update) | Title: **Reset links are not sent by e-mail yet.** |
| Notice body, paragraph 1 | **The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own.** |
| Notice body, paragraph 2 | **If you are the Admin, ask Accucut IT.** |
| Action | **Back to sign in** (a link to `/sign-in`, styled as the page's existing link; at least 44 px high as a target) |
| Not shown | The e-mail field, the "Send reset link" button, the sentence "Enter your e-mail address and we will send you a link to choose a new one." |

Notes on the words:

- "Admin" is the PRD's role name and is capitalised as on the sign-in page; "Accucut IT" is the phrase the Settings and Dashboard screens already use for the people who look after the server (the Settings e-mail line and the backup and disk notices).
- Paragraph 1 is what FR-004 does today (the Admin resets the password and passes the temporary one on; the person must change it at first sign-in). It names no screen, no setting and no setup step.
- Paragraph 2 is for the Admin, who cannot reset their own password (409 `CANNOT_RESET_OWN_PASSWORD`). **It is true while the emergency command of G-1 option B is built, and also under the pre-ruled fall-back A**, where Accucut IT is the only way back. If option A is chosen and Accucut IT will not do a hand-made database change, the master or product-manager changes this sentence; the ux-expert will reword on request.
- Nothing says "e-mail is off", "FEATURE_EMAIL", "setting" or "server". The sentence "yet" is true while the flag is off; when it is switched on (after go-live), the page shows the form again with no release.

## What shows when e-mail is on

Unchanged: the form, "Send reset link", and after sending "Check your e-mail. If that address is registered, a reset link is on its way. It can be used once." (the same answer whether or not the address exists).

## Companion change G-2b (small, same PR if it is cheap; otherwise a follow-up)

The reset page (`/reset-password`) for a link that is used, expired or unknown says "This link has already been used or has expired. Ask for a new link." with an "Ask for a new link" link to `/forgot-password`. While e-mail is off no link is ever sent, so only an old link reaches it, and "Ask for a new link" promises something that does not exist. While the flag is off:

| Part | Text |
|---|---|
| Notice title | **This link has already been used or has expired.** |
| Notice body (plain text, no link) | **Ask the Admin to reset your password.** |

The same three-way answer stays (used, expired and unknown read the same). With the flag on, the page is unchanged. The API message `RESET_LINK_INVALID_MESSAGE` is not changed.

## Rules the build must keep

1. **The server decides**, per request, through `loadEmailFeature()`. The page must not be prerendered at build time with the flag baked in: today `forgot-password/page.tsx` reads no `searchParams`, so Next may build it statically. It needs `export const dynamic = 'force-dynamic'` (or another request-time read), so that switching e-mail on, then restarting the two services, changes the page with no new build. The `reset-password` page already reads `searchParams`.
2. **No browser decision.** No flag in a script, no cookie, no query value (a `?mail=on` does nothing).
3. **Same for everyone**: signed in or out, any address, any number of visits. The page makes no call to the forgot API and no lookup.
4. `noindex, nofollow`, the page's metadata and the layout's rules are unchanged.
5. The route `POST /api/v1/account/password/forgot` is **not changed** by this ruling (it already makes no token and no row, and answers every address alike). A script that posts to it still gets the fixed 202; no screen shows it.

## Accessibility (WCAG 2.2 AA), for this state

- One `h1`; the lead sentence is a paragraph; the notice is a landmark-free block with an icon and text, so meaning is not by colour alone. `info` tone uses the existing tokens (contrast already held by `CONTRAST_PAIRS`).
- No live region: nothing changes after load, so nothing is announced twice. Reached by a full page load, the browser starts at the top; no focus move is added. If it is reached by a client-side route change, the app's existing rule for a route change (focus to the `h1`) applies.
- Tab order: skip link, brand link, "Back to sign in". No keyboard trap, no hidden control.
- "Back to sign in" is a link, 44 px high (NFR-017, SC 2.5.8), visible 3 px focus ring.
- Reflow: no horizontal scroll at 320 CSS px or at 400 % zoom; the notice wraps (it already wraps long words).
- SC 3.2.6 (consistent help): the same sentence ("Ask the Admin to reset it") appears in the same words on both pages.
- SC 3.3.7 (redundant entry) and the 3.3.x input rules: no input on the page.

## Acceptance-criteria-ready wording (UX-AC-G2.n)

1. **UX-AC-G2.1** While `FEATURE_EMAIL` is off (absent, empty or `off`), `/forgot-password` shows the heading "Forgot your password?", the sentence "Ask the Admin to reset it.", an information notice titled "Reset links are not sent by e-mail yet." with the two paragraphs of the copy table, and a link "Back to sign in". It shows no e-mail field and no "Send reset link" button.
2. **UX-AC-G2.2** While the flag is off, no text of the page says or implies that a link is on its way, and the page never renders "Check your e-mail".
3. **UX-AC-G2.3** The page is identical for a signed-in and a signed-out visitor and for every visit; it makes no request to the forgot API and no account lookup (FR-001: nothing differs by address).
4. **UX-AC-G2.4** While the flag is on, `/forgot-password` is as it is today (form, "Send reset link", the fixed answer).
5. **UX-AC-G2.5** The page reads the flag on each request: after the flag is switched on and the services restarted, the form appears with no rebuild; switched off again, the explanation appears.
6. **UX-AC-G2.6** While the flag is off, `/reset-password` for a used, expired, unknown or missing link shows the title "This link has already been used or has expired." and the plain sentence "Ask the Admin to reset your password.", with no "Ask for a new link" link. With the flag on it is unchanged (G-2b).
7. **UX-AC-G2.7** The sign-in page's text "Forgot your password? Ask the Admin to reset it." is unchanged, and it and the explanation page use the same sentence for the instruction.
8. **UX-AC-G2.8** axe reports no violation on the explanation page at 360, 768 and 1366 px; the page has one `h1`, no live region, a "Back to sign in" target of at least 44 px, and no horizontal scroll at 320 CSS px.

## Tests to run

- **Unit (Vitest):** render the forgot-password page with `loadEmailFeature` mocked to off (and to absent and empty) and to on: off shows the copy table and no input or button; on shows the form. Render the invalid-link state for both settings (G-2b). Assert the page's exported `dynamic` is `force-dynamic` (or that it reads the request), so the static build trap is closed.
- **Integration / E2E (Playwright at mobile, tablet and desktop):** with the flag off, open `/forgot-password` by address: the copy is there, no form, "Back to sign in" works, axe is clean. If the E2E stack runs only with the flag on, run this one case on a second server started with `FEATURE_EMAIL=off`, or say plainly that it ran as a render test and add the go-live check below.
- **Existing tests:** the STORY-09.07 forgot-password specs run with the flag on and stay as they are. The enumeration test (`tests/security/password-reset-enumeration.test.ts`) stays green: the route is untouched.
- **Install check (suggested for `deploy/windows/README.md`, row 6 of the go-live checks):** add "(f) open `/forgot-password`: it shows 'Ask the Admin to reset it.' and no e-mail field".

## What the CR-01 session needs to change (mock-up and spec)

Line numbers are those of `records-u` at `b9031df3`; match on the quoted text.

| File and place | Current | New |
|---|---|---|
| `docs/03-ux/generator/s1.cjs` `scr02()` (~136-156), the `states` array in `page({ id: 'SCR-02', ... })` | `['request:Ask for link', 'sent:Link sent', 'reset:New password', 'toocommon:...', 'nonumsym:...', 'invalid:Link used or expired', 'done:Done']` | Add `'mailoff:E-mail off'` and `'invalidmailoff:Link used (e-mail off)'` |
| `s1.cjs` ~139-141: the heading blocks (`data-show="request sent"` with `h1` "Reset your password"; the lead "Enter your e-mail. If it is registered, we send a link that works once.") | Mock-up heading is "Reset your password"; the build's is "Forgot your password?" | Add a block `data-show="mailoff" hidden` with `h1` "Forgot your password?", the lead "Ask the Admin to reset it.", and (below) the notice; note in the review note that the mock-up heading "Reset your password" differs from the build's "Forgot your password?" (the CR-01 session decides whether to align the request state) |
| `s1.cjs` ~142-146 (the `notice(...)` blocks) | `sent`, `invalid`, `done` notices | Add `notice('info', 'info', '<strong>Reset links are not sent by e-mail yet.</strong><span>The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own.</span><span>If you are the Admin, ask Accucut IT.</span>')` with `data-show="mailoff"` (no live role), then `<a class="btn btn-ghost btn-block" href="SCR-01.html">Back to sign in</a>` in the same block. Add `data-show="invalidmailoff"` with `notice('danger', 'xc', '<strong>This link has already been used or has expired.</strong><span>Ask the Admin to reset your password.</span>', 'alert')`. Make sure the request form card (`data-show="request sent"`) and the "Choose a new password" heading are not in `mailoff` or `invalidmailoff` |
| `s1.cjs` ~153 (SCR-02 review note) | "Release 2 (FR-003)... Until Release 2 the Admin resets passwords from the Users screen (FR-004)." | Add: "While e-mail is off (the go-live setting), this page shows the 'E-mail off' state in place of the form, the same for every visitor (FR-001), and the used-link notice has no 'Ask for a new link' link. Decided by the server on each request." |
| `docs/03-ux/generator/s5.cjs` ~76 (state list of SCR-02 for the index) | `[['Link sent', 'sent'], ['New password', 'reset'], ...]` | Add `['E-mail off', 'mailoff']` and `['Link used (e-mail off)', 'invalidmailoff']`; regenerate `SCR-02.html` and `index.html` |
| `s1.cjs` ~130 (SCR-01 review note) | "Release 1 shows 'Forgot your password? Ask the Admin to reset it.' as plain text" | Add "A person who types the address of SCR-02 meanwhile sees its 'E-mail off' state." |
| `ux-spec.md` SCR-02 section (line 557) | The request, the fixed answer, the link states | Add a paragraph "**E-mail off (G-2, DL-379; 24 Nov 2026).** While `FEATURE_EMAIL` is off the request page shows no form. It shows the heading "Forgot your password?", the sentence "Ask the Admin to reset it.", an information notice 'Reset links are not sent by e-mail yet.' ("The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own." / "If you are the Admin, ask Accucut IT.") and "Back to sign in". It is the same for every visitor and makes no request, so FR-001 holds. A used, expired or unknown link then reads "This link has already been used or has expired." and "Ask the Admin to reset your password.", with no link. The server decides on each request." |
| `ux-spec.md` ~1466 (coverage table, FR-003 row: "SCR-02, SCR-01 (link)") | | Add "; SCR-02 state 'E-mail off'" |
| `ux-spec.md` change log (last row, ~1742 onward) | | Add a row for this version: G-2 state of SCR-02 and the used-link variant |

## Issues for other roles

- **solution-architect:** architecture v0.70 section 4.7, row "`/forgot-password` page (SCR-02)" says the page "reads no setting by design (D-1)" and G-2 lists a Minor follow-up "after G8". Both change: the page reads `loadEmailFeature()` per request and ships before G8 (DL-380); D-1 stays for the route only. Check the page is rendered per request (rule 1 above).
- **product-manager and scrum-master:** STORY-09.07 AC-1 says "The page itself reads no setting". It needs a new AC for the e-mail-off state (UX-AC-G2.1 to G2.8) in the emergency-command PR or a small story; the release notes' line "use the Admin, not the forgot-password page" can go once this ships.
- **qa-engineer:** the defect, if one is filed, takes the ruling above as its expected result.
