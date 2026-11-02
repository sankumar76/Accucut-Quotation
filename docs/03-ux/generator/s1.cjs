'use strict';
const L = require('./lib.cjs');
const { cr } = require('./contrast.cjs');
const { icon, page, badge, notice, crumbs, pageHead, field, selectField, skeletonRows, emptyState, reviewNote, pathLink, esc } = L;

const copyright = '© Accucut Lasers Pvt Ltd. All rights reserved.';

/* ============================ SCR-00 Design system ============================ */
function scr00() {
  const sw = (name, hex, use, fg, bg) => {
    const ratio = fg ? cr(fg, bg).toFixed(2) : '';
    return `<div class="stack-sm"><div style="height:56px;border-radius:var(--radius);background:${hex};border:1px solid var(--border)"></div><span class="t-label t-strong">${name}</span><span class="t-label t-mono t-muted">${hex}</span><span class="t-label t-muted">${use}</span>${ratio ? `<span class="t-label t-muted">${ratio}:1 ${fg === '#FFFFFF' ? 'white text' : 'on ' + bg}</span>` : ''}</div>`;
  };
  const body = `<main class="page" id="main" style="gap:var(--s-6)">
  ${pageHead({ title: 'Design system', sub: 'One set of tokens drives every screen: four type sizes, a 4-point spacing scale, one button size in four variants and one palette. All values are in screens.css. "Red Leads" brand, delivery lead decision of 2026-10-31.' })}

  <section class="card" aria-labelledby="ds-brand"><div class="card-head"><span class="section-no">01</span><h2 id="ds-brand" class="t-sub">Brand: Red Leads</h2><span class="spacer"></span><span class="badge badge-neutral">Delivery lead decision</span></div>
   <div class="card-body stack-lg">
    <div class="split">
     <div class="split-side" style="flex-basis:360px"><div class="card" style="box-shadow:none"><div class="topbar" style="position:static;border:0;border-radius:var(--radius-lg)"><a class="brand" href="#"><img src="../assets/accucut-logo.jpg" width="56" height="56" alt="AccuCut logo"><span><span class="brand-name">ACCUCUT LASERS</span> <span class="brand-sub">Quotation Portal</span></span></a></div></div>
      <p class="field-hint mt-2">White top bar. The logo is the supplied file, shown unaltered at 56 px (44 px on phones). The name is Tinos Bold, which is the closest match to the company board, in logo red.</p></div>
     <div class="split-main"><ul class="stack-sm t-body"><li>${icon('check', 16)} Logo file used as supplied; never redrawn, recoloured, cropped or stretched. It needs a light background, so the top bar is white.</li><li>${icon('check', 16)} "ACCUCUT LASERS" in logo red (#DE3030, 4.6:1 on white), 18 px bold serif with wide letter spacing.</li><li>${icon('check', 16)} Dark graphite side menu (#17181C). Active item: lighter graphite plus a red marker.</li><li>${icon('check', 16)} Red main buttons. Overdue and attention use amber, never red. Errors use a separate darker red and always carry an icon, a thick border and text.</li><li>${icon('check', 16)} The logo is 200 &times; 200 px. A sharper original (open question Q-16) will replace the file; nothing else changes.</li></ul></div>
    </div>
   </div></section>

  <section class="card" aria-labelledby="ds-color"><div class="card-head"><span class="section-no">02</span><h2 id="ds-color" class="t-sub">Colour tokens</h2><span class="spacer"></span><span class="t-label t-muted">Ratios computed from the hex values</span></div>
   <div class="card-body grid-auto" style="grid-template-columns:repeat(auto-fill,minmax(168px,1fr))">
    ${sw('Primary (logo red)', '#DE3030', 'Main buttons, active markers, brand name', '#FFFFFF', '#DE3030')}
    ${sw('Primary hover', '#BF2626', 'Button hover and pressed', '#FFFFFF', '#BF2626')}
    ${sw('Primary ink', '#B52424', 'Red as text or link colour', '#B52424', '#FFFFFF')}
    ${sw('Graphite (menu)', '#17181C', 'Side menu, focus ring, dark badge', '#FFFFFF', '#17181C')}
    ${sw('Ink', '#17181C', 'Body text', '#17181C', '#FFFFFF')}
    ${sw('Ink 2', '#4A4D57', 'Secondary text', '#4A4D57', '#FFFFFF')}
    ${sw('Ink 3', '#5E616C', 'Hints, placeholders (lowest grey)', '#5E616C', '#EEEEF0')}
    ${sw('Border strong', '#85888F', 'Control boundaries (UI 3:1)', '#85888F', '#FFFFFF')}
    ${sw('Amber (overdue)', '#B45309', 'Overdue bar, count badge', '#B45309', '#FFFFFF')}
    ${sw('Amber ink', '#8A3F05', 'Text on amber tint', '#8A3F05', '#FFF4E5')}
    ${sw('Success', '#157F3B', 'Approved, complete', '#FFFFFF', '#157F3B')}
    ${sw('Error red', '#B3261E', 'Errors and delete only', '#FFFFFF', '#B3261E')}
    ${sw('Neutral info ink', '#333945', 'Notices and Submitted badge', '#333945', '#ECEEF2')}
    ${sw('Canvas', '#F4F4F5', 'Page ground')}
    ${sw('Surface', '#FFFFFF', 'Cards')}
    ${sw('Auto-filled', '#EEEEF0', 'Read-only and auto fields')}
   </div></section>

  <div class="split">
   <section class="card split-main" aria-labelledby="ds-type"><div class="card-head"><span class="section-no">03</span><h2 id="ds-type" class="t-sub">Type scale</h2><span class="spacer"></span><span class="badge badge-neutral">IBM Plex Sans &middot; Plex Mono &middot; Tinos</span></div>
    <div class="card-body stack" style="gap:0">
     ${[['Heading &middot; 28 / 36 &middot; 600', '<span class="t-heading">Estimate Q-2026-0318</span>'], ['Subheading &middot; 18 / 26 &middot; 600', '<span class="t-sub">02 Material and dimensions</span>'], ['Body &middot; 14 / 22 &middot; 400', '<span class="t-body">Every field is required to Calculate. Enter 0 where a part needs nothing.</span>'], ['Label &middot; 12 / 16 &middot; 500', '<span class="field-label">Material in Drawing <span class="col-tag">E</span></span>']].map((r) => `<div class="row" style="padding:var(--s-4) 0;border-bottom:1px solid var(--border);gap:var(--s-5)"><span class="t-label t-muted t-mono" style="width:190px">${r[0]}</span>${r[1]}</div>`).join('')}
     <p class="field-hint" style="padding-top:var(--s-3)">Phones (up to 767 px) step the heading down to 24 / 32. Nothing else changes. Column letters use Plex Mono at label size.</p>
    </div></section>
   <section class="card split-side" aria-labelledby="ds-space"><div class="card-head"><span class="section-no">04</span><h2 id="ds-space" class="t-sub">Spacing</h2></div>
    <div class="card-body stack-sm">${[['s-1 &middot; 4', 4, 'icon and text in a badge'], ['s-2 &middot; 8', 8, 'label and input'], ['s-3 &middot; 12', 12, 'items in a row'], ['s-4 &middot; 16', 16, 'field and field; phone page margin'], ['s-5 &middot; 24', 24, 'card padding, section gap'], ['s-6 &middot; 32', 32, 'page padding'], ['s-7 &middot; 48', 48, 'large separation']].map((s) => `<div class="row"><span class="t-label t-mono t-muted" style="width:72px">${s[0]}</span><span style="width:${s[1]}px;height:16px;background:var(--nav);border-radius:2px"></span><span class="field-hint">${s[2]}</span></div>`).join('')}</div></section>
  </div>

  <section class="card" aria-labelledby="ds-btn"><div class="card-head"><span class="section-no">05</span><h2 id="ds-btn" class="t-sub">Buttons</h2><span class="spacer"></span><span class="t-label t-muted">One size: 44 px high, 16 px side padding, 8 px radius, 14 / 600</span></div>
   <div class="card-body stack">
    <div class="row"><button class="btn btn-primary" type="button">${icon('calc', 18)} Calculate</button><button class="btn btn-secondary" type="button">${icon('save', 18)} Save draft</button><button class="btn btn-ghost" type="button">${icon('plus', 18)} Add sub-part</button><button class="btn btn-danger" type="button">${icon('trash', 18)} Delete part</button><button class="btn btn-primary" type="button" disabled>Disabled</button><button class="btn btn-primary" type="button" aria-busy="true">${icon('loader', 18, 'ic-spin')} Calculating</button><button class="btn btn-secondary btn-icon" type="button" aria-label="More actions">${icon('more', 18)}</button></div>
    <p class="field-hint">Primary = the one main action on a screen (red). Secondary = other actions. Ghost = low-emphasis, inline. Danger = deletes only, in the error red with a trash icon and the word "Delete". Icon-only buttons always carry an accessible name. Focus ring: 3 px graphite, 2 px offset (white on the dark menu).</p>
   </div></section>

  <section class="card" aria-labelledby="ds-form"><div class="card-head"><span class="section-no">06</span><h2 id="ds-form" class="t-sub">Form controls and column letters</h2></div>
   <div class="card-body grid-fields">
    ${field({ id: 'ds-1', label: 'Length', col: 'J', unit: 'mm', value: '720.00', mode: 'decimal' })}
    ${field({ id: 'ds-2', label: 'Thickness', col: 'L', unit: 'mm', value: '', error: 'Enter this value. Use 0 if the part does not need it.', mode: 'decimal' })}
    ${field({ id: 'ds-3', label: 'Material Considered', col: 'F', auto: true, value: 'Mild steel', hint: 'Fills automatically from Material in Drawing.' })}
    ${selectField({ id: 'ds-4', label: 'Material in Drawing', col: 'E', options: ['Choose material', 'MS sheet, cold rolled', 'SS sheet, grade A'], value: 'MS sheet, cold rolled' })}
    <div class="field"><label class="field-label" for="ds-5">Disabled field <span class="col-tag">H</span></label><input id="ds-5" class="input" disabled value="1.00"><span class="field-hint">Read-only after Submit or approval.</span></div>
    <div class="field"><span class="field-label">Output (Lead and Admin only) <span class="col-tag is-out">BG</span></span><div class="output">${L.inr(1234.5)}</div></div>
   </div></section>

  <div class="split">
   <section class="card split-main" aria-labelledby="ds-badge"><div class="card-head"><span class="section-no">07</span><h2 id="ds-badge" class="t-sub">Status badges and notices</h2></div>
    <div class="card-body stack">
     <div class="row">${badge('neutral', 'Draft', 'edit')}${badge('info', 'Submitted', 'send')}${badge('success', 'Approved and locked', 'lock')}${badge('warn', 'Overdue by 2 d 4 h', 'clock')}${badge('danger', 'Missing data', 'alert')}${badge('brand', 'Release 2', 'star')}</div>
     ${notice('info', 'info', 'Neutral information. Graphite on grey.')}
     ${notice('success', 'checkc', 'Saved at 10:42 IST.', 'status')}
     ${notice('warn', 'clock', 'Attention. Amber is used for overdue and for changes that need a decision.')}
     ${notice('danger', 'xc', '<strong>Something needs fixing.</strong><span>Errors always use an icon, a thick left border and written text, never colour alone.</span>', 'alert')}
    </div></section>
   <section class="card split-side" aria-labelledby="ds-tree"><div class="card-head"><span class="section-no">08</span><h2 id="ds-tree" class="t-sub">Node status icons</h2></div>
    <div class="card-body stack-sm">${[['done', 'Complete'], ['part', 'In progress'], ['todo', 'Not started'], ['miss', 'Missing data after Calculate']].map((s) => `<div class="row">${L.stIcon(s[0])}<span>${s[1]}</span></div>`).join('')}<p class="field-hint">Shape differs as well as colour: check, half circle, empty circle, triangle.</p></div></section>
  </div>

  <section class="card" aria-labelledby="ds-states"><div class="card-head"><span class="section-no">09</span><h2 id="ds-states" class="t-sub">Loading, empty and error patterns (FR-088)</h2></div>
   <div class="card-body grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
    <div class="card" style="box-shadow:none" aria-label="Loading example" aria-busy="true">${skeletonRows(3, 3)}<p class="field-hint" style="padding:var(--s-3) var(--s-4)">Loading: grey skeleton rows in the shape of the content. Shown after 300 ms; announced as "Loading" to screen readers. No spinner on pages.</p></div>
    <div class="card" style="box-shadow:none">${emptyState({ ic: 'list', title: 'Nothing here yet', text: 'Say what is missing and what to do next, in one sentence.', action: '<button class="btn btn-secondary" type="button">One clear action</button>' })}</div>
    <div class="card" style="box-shadow:none">${emptyState({ ic: 'alert', title: 'We could not load this', text: 'Check your connection and try again. Your work is not lost.', action: '<button class="btn btn-secondary" type="button">' + icon('undo', 18) + ' Try again</button>' })}</div>
   </div></section>

  <section class="card" aria-labelledby="ds-map"><div class="card-head"><span class="section-no">10</span><h2 id="ds-map" class="t-sub">Component map for shadcn/ui</h2></div>
   <div class="card-body table-wrap"><table class="table"><thead><tr><th scope="col">Pattern here</th><th scope="col">shadcn/ui component</th><th scope="col">Notes</th></tr></thead><tbody>
    ${[['Buttons', 'Button (variants default, secondary, ghost, destructive)', 'Default variant takes the primary red token'], ['Fields, units, column letters', 'Input, Label, InputGroup pattern, Badge for letter', 'Letter badge is part of the Label'], ['Select, treatment multi-select', 'Select; Popover + Command with checkboxes for the multi-select', 'Keyboard type-ahead'], ['Tabs (queues, masters)', 'Tabs', 'Counts in Badge'], ['Tables, cards on phones', 'Table; Card', 'Scroll only inside the table container'], ['Parts tree', 'Collapsible + custom tree (role=tree); ResizablePanelGroup on desktop', 'Sheet on phones'], ['Dialogs', 'Dialog; AlertDialog for destructive and password steps', 'Focus returns to the trigger'], ['Drawers (menu, tree)', 'Sheet; Sidebar for the side menu', ''], ['Notices', 'Alert', 'Always icon plus text'], ['Loading', 'Skeleton', ''], ['Toasts', 'Sonner', 'Also announced in a live region'], ['Stage list (cost details)', 'Accordion', 'All open on desktop'], ['Date and time', 'Calendar in Popover; time Input', 'IST shown explicitly'], ['Switch (alerts)', 'Switch', 'Label states ON or OFF in words']].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="t-muted">${r[2]}</td></tr>`).join('')}
   </tbody></table></div></section>
  </main>`;
  return page({ id: 'SCR-00', file: 'SCR-00.html', name: 'Design system', desc: 'Design tokens, brand, components and states used on every screen of the Accucut Quotation Portal.', role: 'admin', active: '', noSide: true, roleLabel: 'all', release: 'R1', frs: 'FR-085, FR-086, FR-088', body });
}

/* ============================ SCR-01 Sign in ============================ */
function scr01() {
  const err = (id, t) => `<span class="field-error" id="${id}">${icon('alertc', 14)}<span>${t}</span></span>`;
  const body = `<div class="auth">
  <header class="auth-top"><a class="brand" href="#" aria-label="Accucut Lasers Quotation Portal"><img src="../assets/accucut-logo.jpg" width="56" height="56" alt="AccuCut logo"><span><span class="brand-name">ACCUCUT LASERS</span> <span class="brand-sub">Quotation Portal</span></span></a></header>
  <main id="main" class="auth-main"><div class="auth-card stack-lg">
   <div class="stack-sm"><h1 class="t-heading">Sign in</h1><p class="t-body t-muted">Use the e-mail and password you were given.</p></div>
   <div data-show="expired" hidden>${notice('info', 'info', 'Your session ended. Sign in again to continue where you left off.', 'status')}</div>
   <div data-show="error" hidden>${notice('danger', 'xc', '<strong>E-mail or password is not correct.</strong><span>Check both and try again.</span>', 'alert')}</div>
   <div data-show="locked" hidden>${notice('danger', 'lock', '<strong>Too many attempts.</strong><span>Try again in 15 minutes, or ask the Admin to reset your password.</span>', 'alert')}</div>
   <form class="card" novalidate aria-label="Sign in"><div class="card-body stack">
    <div class="field"><label class="field-label" for="email">E-mail</label><input class="input" id="email" name="email" type="email" autocomplete="username" inputmode="email" required placeholder="name@company.com" value="priya.nair@example.test"></div>
    <div class="field"><label class="field-label" for="password">Password</label><div class="input-icon"><input class="input" id="password" name="password" type="password" autocomplete="current-password" required value="placeholder-only" style="padding-left:var(--s-3);padding-right:48px"><button class="btn btn-ghost btn-icon" type="button" data-reveal="password" aria-pressed="false" aria-label="Show password">${icon('eye', 18)}</button></div></div>
    <button class="btn btn-primary btn-block" type="submit" data-show="default error locked expired" >Sign in</button>
    <button class="btn btn-primary btn-block" type="submit" aria-busy="true" disabled data-show="loading" hidden>${icon('loader', 18, 'ic-spin')} Signing in</button>
    <p class="t-body"><a href="SCR-02.html">Forgot your password?</a></p>
   </div></form>
   ${reviewNote('Release 1 shows "Forgot your password? Ask the Admin to reset it." as plain text; the link above arrives in Release 2 (FR-003). The same error text is used for a wrong e-mail, a wrong password and a deactivated account, so the page never says which part was wrong (FR-001). Field errors on submit: empty e-mail "Enter your e-mail address."; not an e-mail "Enter an e-mail address like name@company.com."; empty password "Enter your password." The page is marked "do not index" like every other page, and carries no sharing image (FR-089).')}
  </div></main>
  <footer class="auth-foot">${copyright}</footer></div>`;
  return page({ id: 'SCR-01', file: 'SCR-01.html', name: 'Sign in', desc: 'Sign in to the Accucut Quotation Portal to prepare, review and approve manufacturing cost estimates.', role: 'engineer', noShell: true, states: ['default', 'loading', 'error:Wrong e-mail or password', 'locked:Locked out', 'expired:Session ended'], roleLabel: 'all (signed out)', release: 'R1', frs: 'FR-001, FR-003 link in R2', body });
}

/* ============================ SCR-02 Forgot / reset password ============================ */
function scr02() {
  const head = `<div class="auth"><header class="auth-top"><a class="brand" href="SCR-01.html" aria-label="Accucut Lasers Quotation Portal"><img src="../assets/accucut-logo.jpg" width="56" height="56" alt="AccuCut logo"><span><span class="brand-name">ACCUCUT LASERS</span> <span class="brand-sub">Quotation Portal</span></span></a></header><main id="main" class="auth-main"><div class="auth-card stack-lg">`;
  const body = head + `
   <div data-show="request sent">
    <div class="stack-sm"><h1 class="t-heading">Reset your password</h1><p class="t-body t-muted">Enter your e-mail. If it is registered, we send a link that works once.</p></div></div>
   <div data-show="reset toocommon nonumsym invalid done" hidden><div class="stack-sm"><h1 class="t-heading">Choose a new password</h1></div></div>
   <div data-show="sent" hidden>${notice('success', 'checkc', '<strong>Check your e-mail.</strong><span>If that address is registered, a reset link is on its way. It can be used once.</span>', 'status')}</div>
   <div data-show="invalid" hidden>${notice('danger', 'xc', '<strong>This link has already been used or has expired.</strong><span><a href="SCR-02.html#state=request">Ask for a new link</a></span>', 'alert')}</div>
   <div data-show="done" hidden>${notice('success', 'checkc', '<strong>Your password has been changed.</strong><span><a href="SCR-01.html">Sign in with the new password</a></span>', 'status')}</div>
   <form class="card" data-show="request sent" novalidate><div class="card-body stack">
    <div class="field"><label class="field-label" for="r-email">E-mail</label><input class="input" id="r-email" type="email" autocomplete="username" required placeholder="name@company.com"></div>
    <button class="btn btn-primary btn-block" type="submit">Send reset link</button><a class="btn btn-ghost btn-block" href="SCR-01.html">Back to sign in</a></div></form>
   <form class="card" data-show="reset toocommon nonumsym" hidden novalidate><div class="card-body stack">
    <div class="field"><label class="field-label" for="n-pw">New password</label><input class="input" id="n-pw" type="password" autocomplete="new-password" required aria-describedby="n-pw-h n-pw-e" data-error-in="toocommon nonumsym"><span class="field-hint" id="n-pw-h">${L.PW.hint}</span><span class="field-error" id="n-pw-e" data-show="toocommon" hidden>${icon('alertc', 14)}<span>${L.PW.common}</span></span><span class="field-error" id="n-pw-e2" data-show="nonumsym" hidden>${icon('alertc', 14)}<span>${L.PW.both}</span></span></div>
    <div class="field"><label class="field-label" for="n-pw2">Repeat new password</label><input class="input" id="n-pw2" type="password" autocomplete="new-password" required></div>
    <button class="btn btn-primary btn-block" type="submit">Save new password</button></div></form>
   ${reviewNote('Release 2 (FR-003). The reply on the first step is always the same, whether or not the e-mail is registered. Until Release 2 the Admin resets passwords from the Users screen (FR-004). Password rule (their answer, AQP-1 10490, D-19): 10 to 128 characters, at least one number and one symbol, not the e-mail address, not a common password. Other messages for this field: "The new password must be at least 10 characters.", "Use 128 characters or fewer.", "Add at least one number.", "Add at least one symbol, such as ! # $ or %." and "The password cannot be the same as your e-mail address." The page carries noindex because its address holds a single-use token (UX-12).')}
  </div></main><footer class="auth-foot">${copyright}</footer></div>`;
  return page({ id: 'SCR-02', file: 'SCR-02.html', name: 'Forgot and reset password', title: 'Reset password', desc: 'Reset your Accucut Quotation Portal password with a single-use link sent to your e-mail.', role: 'engineer', noShell: true, states: ['request:Ask for link', 'sent:Link sent', 'reset:New password', 'toocommon:Password too common', 'nonumsym:Needs number and symbol', 'invalid:Link used or expired', 'done:Done'], roleLabel: 'all (signed out)', release: 'R2', frs: 'FR-003', robots: 'noindex, nofollow', body });
}

/* ============================ Queue rows ============================ */
const closedTask = { id: 'Q-2026-0299', title: 'Gearbox housing', eng: 'Divya Shah', cust: 'Marlow Agro Systems', by: 'Sunita Pillai', due: '28 Oct 2026, 17:00', st: 'Approved', path: '\\\\fileserver\\rfq\\RFQ-2026-021' };
const stBadge = (s) => (s === 'Draft' ? badge('neutral', 'Draft', 'edit') : s === 'Submitted' ? badge('info', 'Submitted', 'send') : badge('success', 'Approved', 'lock'));
const overTxt = (t) => (t.over ? `<div class="row" style="gap:var(--s-1);color:var(--accent-ink)">${icon('clock', 14)}<strong class="t-label">Overdue by ${t.over}</strong></div>` : '');
function rowsFor(list, role, closed) {
  const eng = role === 'engineer';
  return list.map((t) => `<tr${t.over ? ' class="is-overdue"' : ''}>
   <td><a class="t-strong" href="${role === 'engineer' ? 'SCR-05.html' : 'SCR-06.html'}">${t.id}</a><div class="t-body">${t.title}</div></td>
   ${eng ? '' : `<td>${t.eng}</td>`}
   ${eng ? '' : `<td class="hide-md">${t.cust || '<span class="t-faint">Not chosen yet</span>'}</td>`}
   <td class="hide-md"><span class="mono">${esc(t.path)}</span><div class="row" style="gap:var(--s-2);margin-top:var(--s-1)"><a href="file:///${esc(t.path.replace(/^\\\\/, '').replace(/\\/g, '/'))}">Open folder</a><button class="btn btn-ghost" type="button" data-copy="${esc(t.path)}" style="height:32px;padding:0 var(--s-2)">${icon('copy', 14)}<span class="copy-label">Copy path</span></button></div></td>
   <td class="nowrap"><span class="t-num">${t.due}</span>${overTxt(t)}</td>
   <td>${stBadge(t.st)}</td>
   ${eng ? `<td class="hide-md">${t.by}</td>` : `<td class="hide-md">${t.by}</td>`}
   <td class="t-right">${eng ? `<a class="btn btn-secondary" href="SCR-05.html" style="height:36px">Open</a>` : closed ? '<span class="t-label t-muted">Closed</span>' : `<a class="btn btn-secondary btn-icon" href="SCR-04.html#state=edit" aria-label="Reassign or change deadline for ${t.id}" style="width:36px;height:36px">${icon('edit', 16)}</a>`}</td></tr>`).join('');
}
function cardsFor(list, role) {
  const eng = role === 'engineer';
  return list.map((t) => `<article class="card task-card${t.over ? ' is-overdue' : ''}" aria-label="${t.id} ${t.title}">
   <div class="row-nowrap"><a class="t-strong" href="${eng ? 'SCR-05.html' : 'SCR-06.html'}">${t.id}</a><span class="spacer"></span>${stBadge(t.st)}</div>
   <div class="t-sub">${t.title}</div>
   <div class="stack-sm t-body"><div class="row" style="gap:var(--s-2)">${icon('clock', 16)}<span>Due ${t.due} IST</span></div>${overTxt(t)}${eng ? `<div class="t-muted">Assigned by ${t.by}</div>` : `<div class="t-muted">${t.eng} &middot; ${t.cust || 'Customer not chosen yet'}</div>`}</div>
   <div class="row"><button class="btn btn-secondary" type="button" data-copy="${esc(t.path)}">${icon('copy', 18)}<span class="copy-label">Copy path</span></button><a class="btn btn-primary" href="${eng ? 'SCR-05.html' : 'SCR-06.html'}" style="flex:1">Open</a></div></article>`).join('');
}
function queueBody(role) {
  const eng = role === 'engineer';
  const open = L.TASKS.filter((t) => (eng ? t.eng === 'Priya Nair' || true : true));
  const engList = eng ? [L.TASKS[2], L.TASKS[4], { id: 'Q-2026-0316', title: 'Cable duct clips', eng: 'Priya Nair', cust: null, by: 'Sunita Pillai', due: '04 Nov 2026, 09:00', over: '2 h', st: 'Draft', path: '\\\\fileserver\\rfq\\RFQ-2026-030' }].sort((a, b) => (a.over ? -1 : 1)) : open;
  const overdue = engList.filter((t) => t.over);
  const closed = eng ? [{ ...closedTask, eng: 'Priya Nair' }] : [closedTask];
  const cols = eng
    ? ['Task', 'Folder', 'Deadline (IST)', 'Status', 'Assigned by', '']
    : ['Task', 'Engineer', 'Customer', 'Folder', 'Deadline (IST)', 'Status', 'Assigned by', ''];
  const hideMd = eng ? [1, 4] : [2, 3, 6];
  const thead = `<thead><tr>${cols.map((c, i) => `<th scope="col"${hideMd.includes(i) ? ' class="hide-md"' : ''}>${c || '<span class="sr-only">Actions</span>'}</th>`).join('')}</tr></thead>`;
  const table = (list, isClosed) => `<div class="table-wrap hide-mobile"><table class="table">${thead}<tbody>${rowsFor(list, role, isClosed)}</tbody></table></div><div class="stack show-mobile" style="padding:var(--s-4)">${cardsFor(list, role)}</div>`;
  const tabs = `<div class="tabs" role="tablist" aria-label="Task queues">
   <a class="tab" role="tab" href="#state=open" data-tab-for="open default">Open <span class="badge badge-neutral">${engList.length}</span></a>
   <a class="tab" role="tab" href="#state=closed" data-tab-for="closed">Closed <span class="badge badge-neutral">${closed.length}</span></a>
   <a class="tab" role="tab" href="#state=overdue" data-tab-for="overdue">${icon('clock', 16)} Overdue <span class="badge badge-warn">${overdue.length}</span></a></div>`;
  const filters = eng
    ? `<div class="row"><div class="input-icon" style="flex:1 1 260px"><span class="sr-only"><label for="q">Search tasks</label></span>${icon('search', 18)}<input class="input" id="q" type="search" placeholder="Search by task ID or title" aria-label="Search by task ID or title"></div></div>`
    : `<div class="row" style="align-items:flex-end">
     <div class="field" style="flex:1 1 220px"><label class="field-label" for="q">Search</label><div class="input-icon">${icon('search', 18)}<input class="input" id="q" type="search" placeholder="Task ID or title"></div></div>
     <div class="field" style="flex:1 1 160px"><label class="field-label" for="f-eng">Engineer</label><select class="select" id="f-eng"><option>All Engineers</option><option>Priya Nair</option><option>Arjun Rao</option><option>Divya Shah</option></select></div>
     <div class="field" style="flex:1 1 180px"><label class="field-label" for="f-cust">Customer</label><select class="select" id="f-cust"><option>All customers</option><option>Brightwater Controls</option><option>Orchid Rail Works</option><option>Ridgeline Pumps</option><option>Tamarind Switchgear</option></select></div>
     <div class="field" style="flex:1 1 150px"><label class="field-label" for="f-from">Deadline from</label><input class="input" id="f-from" type="date"></div>
     <div class="field" style="flex:1 1 150px"><label class="field-label" for="f-to">Deadline to</label><input class="input" id="f-to" type="date"></div></div>
     ${role === 'lead' ? `<div class="row"><span class="t-label t-muted">Filter:</span><span class="chip">Assigned by me <button class="x" type="button" aria-label="Remove filter Assigned by me">${icon('x', 14)}</button></span></div>` : ''}`;
  const sortNote = `<p class="t-label t-muted">${icon('arrowdown', 12)} Sorted by deadline, earliest first. Overdue tasks stay in Open as well.</p>`;
  const panel = (st, list, extra = '') => `<div data-show="${st}"${st === 'open default' ? '' : ' hidden'}>${list.length ? table(list) : ''}</div>`;
  const mainContent = `
  <div data-show="open default">${table(engList)}</div>
  <div data-show="closed" hidden>${table(closed, true)}</div>
  <div data-show="overdue" hidden>${table(overdue)}</div>
  <div data-show="loading" hidden aria-busy="true"><p class="sr-only" role="status">Loading tasks</p>${skeletonRows(5, 5)}</div>
  <div data-show="empty" hidden>${eng ? emptyState({ ic: 'list', title: 'Nothing assigned to you right now', text: 'When a Lead assigns you a task it appears here, with its folder and deadline.' }) : emptyState({ ic: 'list', title: 'No open tasks', text: 'Assign a task to an Engineer and it appears here.', action: '<a class="btn btn-primary" href="SCR-04.html">' + icon('plus', 18) + ' Assign task</a>' })}</div>
  <div data-show="nomatch" hidden>${eng ? emptyState({ ic: 'search', title: 'No tasks match your search', text: 'Try a different task ID or part of the title.', action: '<button class="btn btn-secondary" type="button">Clear search</button>' }) : emptyState({ ic: 'search', title: 'No tasks match these filters', text: 'Try a different Engineer, customer or date range.', action: '<button class="btn btn-secondary" type="button">Clear filters</button>' })}</div>
  <div data-show="error" hidden>${emptyState({ ic: 'alert', title: 'We could not load the tasks', text: 'Check your connection and try again. Nothing has been changed.', action: '<button class="btn btn-secondary" type="button">' + icon('undo', 18) + ' Try again</button>' })}</div>`;
  const states = eng ? ['open:Open', 'closed:Closed', 'overdue:Overdue', 'loading:Loading', 'empty:Empty', 'nomatch:No match', 'error:Error'] : ['open:Open', 'closed:Closed', 'overdue:Overdue', 'loading:Loading', 'empty:Empty', 'nomatch:No match', 'error:Error'];
  const main = `<main class="page" id="main">
   ${pageHead({ title: eng ? 'My tasks' : 'Task queue', sub: eng ? 'Tasks assigned to you. Open one to start entering part data.' : role === 'lead' ? 'All tasks. Filtered to the ones you assigned; remove the filter to see everyone\'s.' : 'All tasks across Engineers and Leads.', actions: eng ? '' : `<a class="btn btn-primary" href="SCR-04.html">${icon('plus', 18)} Assign task</a>` })}
   <div data-show="overdue" hidden>${notice('warn', 'clock', `<strong>${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} overdue.</strong><span>Overdue tasks are marked with a clock, the words "Overdue by", an amber bar and a tinted row. They also stay in Open.</span>`, 'status')}</div>
   <section class="card" aria-label="Tasks"><div class="card-body stack">${tabs}${filters}${sortNote}</div><div style="border-top:1px solid var(--border)">${mainContent}</div></section>
   ${reviewNote(eng ? 'Engineer view. An Engineer sees only their own tasks, no Engineer or customer filter, and never a price. The bell in the top bar opens the Overdue tab (FR-037). The same screen at 360 px is shown as <a href="SCR-03-phone.html">SCR-03-phone</a>.' : `${role === 'lead' ? 'Lead view: opens filtered to "Assigned by me" (FR-035, R1+). ' : 'Admin view: the same screen with no default filter. '}At 768 px the table keeps its priority columns (Task, Engineer, Deadline, Status); on phones it becomes cards. Row action: reassign or change deadline (FR-040, Release 2). Tablet frame: <a href="SCR-03-tablet.html">SCR-03-tablet</a>.`)}
  </main>`;
  return { main, states };
}
function scr03() {
  const q = queueBody('lead');
  return page({ id: 'SCR-03', file: 'SCR-03.html', name: 'Task queue (Lead, Admin)', title: 'Task queue', desc: 'Open, closed and overdue estimation tasks for Accucut Lasers, sorted by deadline.', role: 'lead', active: 'queue', states: q.states, roleLabel: 'Lead, Admin', release: 'R1, R1+ filters', frs: 'FR-034 to 039, 041', body: q.main });
}
function scr03e() {
  const q = queueBody('engineer');
  return page({ id: 'SCR-03', file: 'SCR-03-engineer.html', name: 'My tasks (Engineer)', title: 'My tasks', desc: 'Your assigned estimation tasks at Accucut Lasers, sorted by deadline.', role: 'engineer', active: 'queue', states: q.states, roleLabel: 'Engineer', release: 'R1', frs: 'FR-033, 034, 036, 037', body: q.main });
}

/* ============================ SCR-04 Assign task ============================ */
function scr04() {
  const err = (t) => t;
  const body = `<main class="page" id="main">
   ${crumbs([['Task queue', 'SCR-03.html'], ['Assign task']])}
   <div data-show="default error submitting success alertsoff" >${pageHead({ title: 'Assign task', sub: 'Creates an empty estimate and puts the task in the Engineer\'s Open queue.' })}</div>
   <div data-show="edit" hidden>${pageHead({ title: 'Reassign or change deadline', sub: 'Q-2026-0314 · Pump skid frame', badgeHtml: badge('warn', 'Overdue by 23 h', 'clock') })}</div>
   <div data-show="success" hidden>${notice('success', 'checkc', '<strong>Task Q-2026-0324 assigned to Arjun Rao.</strong><span><a href="SCR-03.html">View in the task queue</a> or assign another task below.</span>', 'status')}</div>
   <div data-show="alertsoff" hidden>${notice('warn', 'mail', '<span class="badge badge-brand">Release 2</span><strong>E-mail alerts are OFF.</strong><span>Arjun Rao will not be e-mailed about this task. It still appears in their queue. The Admin can turn alerts on in Settings.</span>')}</div>
   <div data-show="error" hidden>${notice('danger', 'xc', '<strong>3 things need fixing before this task can be assigned.</strong><ul style="padding-left:var(--s-4);list-style:disc"><li><a href="#engineer">Choose an Engineer</a></li><li><a href="#path">Enter the network folder path</a></li><li><a href="#date">Choose a deadline later than now</a></li></ul>', 'alert')}</div>
   <div data-show="edit" hidden>${notice('info', 'history', '<strong>Changes are logged.</strong><span>The log records your name, the time, and the old and new values. Only the Engineer and the deadline can be changed here.</span>')}</div>
   <div class="split"><form class="card split-main" id="assign-form" novalidate aria-label="Assign task" style="flex-basis:520px"><div class="card-body stack">
     <div class="field"><label class="field-label" for="engineer">Engineer</label><select class="select" id="engineer" name="engineer" required data-error-in="error"><option>Choose an Engineer</option><option>Priya Nair</option><option selected>Arjun Rao</option><option>Divya Shah</option></select>
       <span class="field-error" data-show="error" hidden>${icon('alertc', 14)} Choose an Engineer.</span></div>
     <div class="field"><label class="field-label" for="path">Network folder path</label><input class="input mono" id="path" name="path" required data-error-in="error" value="\\\\fileserver\\rfq\\RFQ-2026-033" aria-describedby="path-h" style="font-size:var(--fs-body)"><span class="field-hint" id="path-h">The folder with the drawings and requirements, for example \\\\server\\share\\RFQ-123.</span>
       <span class="field-error" data-show="error" hidden>${icon('alertc', 14)} Enter the network folder path. It starts with two backslashes, like \\\\server\\share\\RFQ-123.</span></div>
     <div class="grid-2"><div class="field"><label class="field-label" for="date">Deadline date</label><input class="input" id="date" name="date" type="date" required value="2026-11-09" data-error-in="error"><span class="field-error" data-show="error" hidden>${icon('alertc', 14)} Choose a deadline later than now.</span></div>
      <div class="field"><label class="field-label" for="time">Deadline time</label><div class="input-group"><input class="input" id="time" name="time" type="time" required value="10:00"><span class="addon">IST</span></div><span class="field-hint">India Standard Time (UTC+5:30).</span></div></div>
     <div data-show="default error submitting success alertsoff">
     <div class="field"><label class="field-label" for="title">Title <span class="t-faint" style="font-weight:400">(optional)</span></label><input class="input" id="title" name="title" maxlength="120" value="Hopper cover" aria-describedby="title-h"><span class="field-hint" id="title-h">Up to 120 characters. Shown in the queue next to the task ID.</span></div>
     <div class="field mt-4"><label class="field-label" for="notes">Notes <span class="t-faint" style="font-weight:400">(optional)</span></label><textarea class="textarea" id="notes" name="notes" maxlength="1000">Customer wants the sheet-metal parts only. Fasteners are supplied.</textarea><span class="field-hint">Up to 1,000 characters.</span></div></div>
     <div data-show="edit" hidden><div class="field"><span class="field-label">Folder, title and notes</span><div class="output">Locked. Only the Engineer and deadline can change.</div></div></div>
    </div>
    <div class="card-foot"><a class="btn btn-secondary" href="SCR-03.html">Cancel</a><span class="spacer"></span>
      <button class="btn btn-primary" type="submit" data-show="default error success alertsoff edit">${icon('send', 18)} <span data-show="edit" hidden>Save changes</span><span data-hide="edit">Assign task</span></button>
      <button class="btn btn-primary" type="button" disabled aria-busy="true" data-show="submitting" hidden>${icon('loader', 18, 'ic-spin')} Assigning</button></div></form>
    <aside class="card split-side" aria-labelledby="next"><div class="card-head"><h2 id="next" class="t-sub">What happens next</h2></div><div class="card-body stack">
     <ol class="stack-sm" style="list-style:decimal;padding-left:var(--s-5)"><li>An empty estimate is created in Draft with a task ID like Q-2026-0324.</li><li>It appears in the Engineer's Open queue, sorted by deadline.</li><li>The Engineer chooses the customer and enters the part data.</li><li>If e-mail alerts are ON, the Engineer is e-mailed and you are copied (Release 2).</li></ol>
     <hr class="divider"><div class="stack-sm"><span class="t-label t-caps t-muted">How the folder link works</span><p class="t-body">Everyone sees the path as a link plus a <strong>Copy path</strong> button. Browsers often block links to network folders; the button always works.</p><div class="tip-bubble" id="tip-copy" role="note">${L.TIP_COPY}</div></div></div></aside></div>
   ${reviewNote('Create screen is Release 1 (FR-032, FR-033). The "Reassign or change deadline" mode and its log are Release 2 (FR-040); there is no cancel action. Validation runs on submit; the date-time is checked again on the server. Title and notes limits (120 and 1,000 characters) are proposals.')}
  </main>`;
  return page({ id: 'SCR-04', file: 'SCR-04.html', name: 'Assign task', desc: 'Assign an estimation task to an Engineer with a folder path and a deadline.', role: 'lead', active: 'assign', states: ['default', 'error:Validation errors', 'submitting:Saving', 'success:Assigned', 'alertsoff:Alerts OFF (R2)', 'edit:Edit (R2)'], roleLabel: 'Lead, Admin', release: 'R1; edit R2', frs: 'FR-032, FR-033, FR-040', body });
}

module.exports = { scr00, scr01, scr02, scr03, scr03e, scr04, queueBody };
