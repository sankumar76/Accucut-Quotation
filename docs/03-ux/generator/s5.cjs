'use strict';
const L = require('./lib.cjs');
const { icon, esc, fs, OUT } = L;

/* Phone and tablet review frames: the real responsive screen inside a device-sized frame.
   Because the frame is a real browser viewport of that width, the layout you see is the
   layout the CSS produces at that width. */
const DEVICES = [
  { file: 'SCR-01-phone.html', id: 'SCR-01', type: 'phone', src: 'SCR-01.html', name: 'Sign in on a phone', variants: [['Default', 'state=default'], ['Wrong password', 'state=error'], ['Locked out', 'state=locked']] },
  { file: 'SCR-03-phone.html', id: 'SCR-03', type: 'phone', src: 'SCR-03-engineer.html', name: 'My tasks (Engineer) on a phone', variants: [['Open', 'state=open'], ['Overdue', 'state=overdue'], ['Menu open', 'state=open&drawer=nav'], ['Loading', 'state=loading'], ['Empty', 'state=empty']] },
  { file: 'SCR-03-tablet.html', id: 'SCR-03', type: 'tablet', src: 'SCR-03.html', name: 'Task queue (Lead) on a tablet', variants: [['Open', 'state=open'], ['Overdue', 'state=overdue'], ['Menu open', 'state=open&drawer=nav'], ['Loading', 'state=loading']] },
  { file: 'SCR-04-phone.html', id: 'SCR-04', type: 'phone', src: 'SCR-04.html', name: 'Assign task on a phone', variants: [['Default', 'state=default'], ['Validation errors', 'state=error'], ['Assigned', 'state=success']] },
  { file: 'SCR-05-phone.html', id: 'SCR-05', type: 'phone', src: 'SCR-05.html', name: 'Estimate workspace (Engineer) on a phone', variants: [['Default', 'state=default'], ['Parts tree drawer', 'state=default&drawer=tree'], ['Calculate blocked', 'state=error'], ['Picture too large', 'state=imgerror'], ['No customer', 'state=nocustomer'], ['Submitted', 'state=submitted']] },
  { file: 'SCR-05-tablet.html', id: 'SCR-05', type: 'tablet', src: 'SCR-05.html', name: 'Estimate workspace (Engineer) on a tablet', variants: [['Default', 'state=default'], ['Calculate blocked', 'state=error'], ['Submitted', 'state=submitted']] },
  { file: 'SCR-06-phone.html', id: 'SCR-06', type: 'phone', src: 'SCR-06.html', name: 'Estimate review (Lead, Admin) on a phone', variants: [['Submitted', 'state=default'], ['Total cleared', 'state=cleared'], ['Approved', 'state=approved'], ['Parts tree drawer', 'state=default&drawer=tree']] },
  { file: 'SCR-06-tablet.html', id: 'SCR-06', type: 'tablet', src: 'SCR-06.html', name: 'Cost review on a tablet', variants: [['Submitted', 'state=default'], ['Total cleared', 'state=cleared'], ['Approved', 'state=approved']] },
  { file: 'SCR-07-phone.html', id: 'SCR-07', type: 'phone', src: 'SCR-07.html', name: 'Cost details on a phone (stages as accordion)', variants: [['Default', 'state=default'], ['Loading', 'state=loading'], ['Error', 'state=error']] },
  { file: 'SCR-11-tablet.html', id: 'SCR-11', type: 'tablet', src: 'SCR-11.html', name: 'Process master on a tablet', variants: [['Default', 'state=default'], ['Customers differ prompt', 'state=sync']] },
  { file: 'SCR-25-phone.html', id: 'SCR-25', type: 'phone', src: 'SCR-25.html', name: 'Navigation drawer on a phone', variants: [['Drawer open', 'state=default&drawer=nav'], ['Drawer closed', 'state=default'], ['Menu button pending', 'state=menupending'], ['Menu button failed', 'state=menufailed'], ['Account trigger pending', 'state=acctpending'], ['Account trigger failed', 'state=acctfailed']] },
];

function devicePage(d) {
  const title = `${d.id} ${d.type} frame · Accucut Quotation Portal`;
  const w = d.type === 'phone' ? '360 by 720 px' : '768 by 1024 px';
  const first = d.variants[0][1];
  const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Review frame showing a screen of the Accucut Quotation Portal at ${d.type} size.">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Accucut Quotation Portal">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Review frame showing a screen of the Accucut Quotation Portal at ${d.type} size.">
<link rel="icon" href="../assets/accucut-logo.jpg">
<link rel="stylesheet" href="screens.css">
</head>
<body class="device-page">
<div class="review-bar" role="region" aria-label="Review information, not part of the product"><a href="index.html">${icon('arrowleft', 14)} All screens</a><span class="rb-id">${d.id}</span><strong>${esc(d.name)}</strong><span>Frame: ${w} &middot; the real screen, so this is the layout the stylesheet produces at that width</span><span style="margin-left:auto">Review mock-up &middot; fictional data</span></div>
<main class="device-wrap" id="main">
 <div class="row" role="group" aria-label="Screen state" style="justify-content:center">
  ${d.variants.map((v, i) => `<button class="rb-toggle" type="button" data-hash="${v[1]}" aria-pressed="${i === 0}" style="min-height:36px">${esc(v[0])}</button>`).join('')}
  <a class="rb-toggle" href="${d.src}" style="text-decoration:none;display:inline-flex;align-items:center;min-height:36px">Open full size ${icon('ext', 14)}</a>
 </div>
 <div class="device ${d.type}"><iframe id="frame" title="${esc(d.name)}" src="${d.src}#embed=1&amp;${first}"></iframe></div>
</main>
<script>
(function () {
  var frame = document.getElementById('frame');
  var base = ${JSON.stringify(d.src)};
  document.querySelectorAll('[data-hash]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-hash]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var h = b.getAttribute('data-hash');
      /* A fresh load keeps drawers and states predictable; a hash-only change would not reset a drawer. */
      frame.src = base + '?r=' + Date.now() + '#embed=1&' + h;
    });
  });
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(OUT + d.file, html);
}

/* ---------------- index ---------------- */
const S = (file, label, hash) => `<a href="${file}#state=${hash}">${label}</a>`;
const GROUPS = [
  ['Foundation and access', [
    ['SCR-00', 'SCR-00.html', 'Design system', 'All', 'R1', 'FR-085, 086, 088', []],
    ['SCR-01', 'SCR-01.html', 'Sign in', 'Signed out', 'R1', 'FR-001', [['Wrong password', 'error'], ['Locked out', 'locked'], ['Session ended', 'expired'], ['Loading', 'loading']], [['Phone', 'SCR-01-phone.html']]],
    ['SCR-02', 'SCR-02.html', 'Forgot and reset password', 'Signed out', 'R2', 'FR-003', [['Link sent', 'sent'], ['New password', 'reset'], ['Password too common', 'toocommon'], ['Needs number and symbol', 'nonumsym'], ['Link used or expired', 'invalid'], ['Done', 'done']]],
    ['SCR-23', 'SCR-23.html', 'Account and change password', 'All signed in', 'R1', 'FR-002, 009', [['Errors', 'error'], ['Too long', 'toolong'], ['Needs number and symbol', 'nonumsym'], ['Same as e-mail', 'samemail'], ['Too common', 'toocommon'], ['Must change password', 'mustchange'], ['Success', 'success']]],
    ['SCR-24', 'SCR-24.html', 'About', 'All signed in', 'R1', 'FR-010', []],
    ['SCR-25', 'SCR-25.html', 'Navigation and account menu', 'All signed in', 'R1', 'FR-007, 009, 085', [['Account trigger pending', 'acctpending'], ['Account trigger failed', 'acctfailed'], ['Menu button pending', 'menupending'], ['Menu button failed', 'menufailed']], [['Phone, menu open', 'SCR-25-phone.html']]],
    ['SCR-26', 'SCR-26.html', 'No access, not found, error, session ended', 'All', 'R1', 'FR-007, 088', [['404', 'notfound'], ['Server error', 'error500'], ['Session ended', 'expired']]],
  ]],
  ['Work: queues and assignment', [
    ['SCR-03', 'SCR-03.html', 'Task queue (Lead, Admin)', 'Lead, Admin', 'R1 (filters R1+)', 'FR-034 to 039, 041', [['Closed', 'closed'], ['Overdue', 'overdue'], ['Loading', 'loading'], ['Empty', 'empty'], ['No match', 'nomatch'], ['Error', 'error']], [['Tablet', 'SCR-03-tablet.html']]],
    ['SCR-03', 'SCR-03-engineer.html', 'My tasks (Engineer)', 'Engineer', 'R1', 'FR-033, 034, 036, 037', [['Closed', 'closed'], ['Overdue', 'overdue'], ['Loading', 'loading'], ['Empty', 'empty'], ['No match', 'nomatch'], ['Error', 'error']], [['Phone', 'SCR-03-phone.html']]],
    ['SCR-04', 'SCR-04.html', 'Assign task, and reassign (R2)', 'Lead, Admin', 'R1; edit R2', 'FR-032, 033, 040', [['Validation errors', 'error'], ['Saving', 'submitting'], ['Assigned', 'success'], ['Alerts OFF notice (R2)', 'alertsoff'], ['Reassign (R2)', 'edit']], [['Phone', 'SCR-04-phone.html']]],
  ]],
  ['Estimate: enter, review, approve, export', [
    ['SCR-05', 'SCR-05.html', 'Estimate workspace, guided form (Engineer view: no costs)', 'Engineer', 'R1', 'FR-042 to 057, 087, 102, 104', [['Saved', 'saved'], ['Calculate blocked', 'error'], ['Picture too large', 'imgerror'], ['No customer', 'nocustomer'], ['Change customer', 'changecust'], ['Unsaved changes', 'leave'], ['Delete part', 'deletepart'], ['Loading', 'loading'], ['Quantity warning', 'qtywarn'], ['Warning, list changed', 'qtywarn2'], ['Submitted', 'submitted'], ['Approved', 'approved']], [['Phone', 'SCR-05-phone.html'], ['Tablet', 'SCR-05-tablet.html']]],
    ['SCR-06', 'SCR-06.html', 'Estimate review, cost view (Lead, Admin view)', 'Lead, Admin', 'R1', 'FR-058 to 065, 070, 100, 104, 106 to 108', [['Total cleared', 'cleared'], ['Not calculated', 'draft'], ['Draft after unlock', 'unlocked'], ['Unlocked and changed', 'unlockedcleared'], ['No Tool Cost', 'notool'], ['Rates changed', 'ratechanged'], ['Quantity warning (Recalculate)', 'qtywarn'], ['Warning on this calculation', 'qtywarned'], ['Approved (Lead)', 'approved'], ['Approved (Admin)', 'adminapproved'], ['Cancel approval (Admin)', 'cancel'], ['Approval cancelled (Admin)', 'cancelled'], ['Approval cancelled (Lead)', 'cancelledlead'], ['Remove price (Admin)', 'removeprice'], ['Price removed', 'removed'], ['Loading', 'loading'], ['Error', 'error']], [['Phone', 'SCR-06-phone.html'], ['Tablet', 'SCR-06-tablet.html']]],
    ['SCR-07', 'SCR-07.html', 'Cost details for one row, six stages with formulas', 'Lead, Admin', 'R1', 'FR-058, 059, 060, 026, 100', [['Assembly row (Not applicable)', 'assembly'], ['Total cleared', 'cleared'], ['Loading', 'loading'], ['Error', 'error']], [['Phone', 'SCR-07-phone.html']]],
    ['SCR-08', 'SCR-08.html', 'Approve and lock (dialog)', 'Lead, Admin', 'R1', 'FR-062, 101, 103, 104, 106', [['Price changed', 'override'], ['Price changed with reason', 'overridereason'], ['Reason too long', 'reasonlong'], ['Invalid price', 'error'], ['Saving', 'saving'], ['Estimate changed while open', 'stale'], ['Quantity warning on this calculation', 'qtywarned'], ['Rates changed', 'ratechanged'], ['After an unlock', 'earlier']]],
    ['SCR-09', 'SCR-09.html', 'Unlock (dialog)', 'Lead, Admin', 'R1', 'FR-063', [['Config or rates changed', 'changed'], ['Reason missing', 'error'], ['Saving', 'saving']]],
    ['SCR-10', 'SCR-10.html', 'Excel export, the rows in the file', 'Lead, Admin', 'R1', 'FR-066 to 071, 100, 104, 107', [['Total cleared', 'cleared'], ['Not calculated', 'nevercalc'], ['Building file', 'generating'], ['Error', 'error'], ['Empty', 'empty'], ['Approved', 'approved'], ['After an unlock', 'earlier'], ['Quantity warning on this calculation', 'qtywarned']]],
  ]],
  ['Masters and administration', [
    ['SCR-11', 'SCR-11.html', 'Process master', 'Admin', 'R1 (prompt R1+)', 'FR-012, 014', [['Saved', 'saved'], ['Add rate', 'add'], ['Customers differ', 'sync'], ['Delete blocked', 'blocked'], ['Loading', 'loading'], ['No match', 'nomatch'], ['Error', 'error']], [['Tablet', 'SCR-11-tablet.html']]],
    ['SCR-12', 'SCR-12.html', 'Customer master', 'Admin', 'R1', 'FR-013', [['Edit customer', 'edit'], ['New customer', 'new'], ['Reset dialog', 'reset'], ['Delete', 'delete'], ['Delete blocked', 'deleteblocked'], ['Loading', 'loading'], ['Empty', 'empty'], ['No match', 'nomatch'], ['Error', 'error']]],
    ['SCR-13', 'SCR-13.html', 'Materials, exchange rates, treatment list', 'Admin', 'R1', 'FR-015 to 018', [['Duplicate name', 'dup'], ['Specific gravity 0', 'sg'], ['Delete', 'delete'], ['Delete blocked', 'deleteblocked'], ['Loading', 'loading'], ['Error', 'error']]],
    ['SCR-14', 'SCR-14.html', 'Users', 'Admin', 'R1; hand-over R2', 'FR-004, 005, 006', [['Add user', 'add'], ['Second Admin refused', 'adminerror'], ['Password too common', 'toocommon'], ['Needs number and symbol', 'nonumsym'], ['Reset password', 'reset'], ['Password same as e-mail', 'samemail'], ['Reset: needs number and symbol', 'resetweak'], ['Deactivate', 'deactivate'], ['Hand over (R2)', 'handover'], ['Hand over: wrong password', 'handoverpw'], ['Loading', 'loading'], ['Error', 'error']]],
    ['SCR-16', 'SCR-16.html', 'Audit log and change history', 'Admin', 'R1; config events R2', 'FR-011, 079, 104, 107, 108', [['Configuration events', 'config'], ['Empty', 'empty'], ['Loading', 'loading'], ['Error', 'error']]],
    ['SCR-15', 'SCR-15.html', 'Settings: Last backup line, e-mail alerts', 'Admin', 'R1 core (Last backup); R2 (alerts)', 'FR-019, 105', [['OFF', 'off'], ['Test sent', 'testok'], ['Test failed', 'testfail'], ['Sender not allowed', 'testsender'], ['Backup late', 'backuplate'], ['Disk nearly full', 'diskfull'], ['Save failed', 'saveerr'], ['Loading', 'loading']]],
  ]],
  ['Release 2: configuration, settings, alerts', [
    ['SCR-17', 'SCR-17.html', 'Fields and formulas, column list (Admin)', 'Admin', 'R2', 'FR-072', [['Loading', 'loading'], ['Error', 'error']]],
    ['SCR-17', 'SCR-17-lead.html', 'Fields and formulas (Lead, view only)', 'Lead', 'R2', 'FR-072, 060', []],
    ['SCR-18', 'SCR-18.html', 'Formula editor', 'Admin', 'R2', 'FR-073, 022, 023, 080', [['Unknown name', 'unknown'], ['Syntax error', 'syntax'], ['Loop', 'cycle'], ['Edit BL (SUM)', 'bl'], ['No sample row', 'nosample'], ['Password step', 'pwd'], ['Wrong password', 'pwerr'], ['Too many attempts', 'pwlocked'], ['Saved', 'saved']]],
    ['SCR-19', 'SCR-19.html', 'Insert field, with letter preview', 'Admin', 'R2', 'FR-074, 075', [['Step 1', 'step1'], ['Step 2 errors', 'error'], ['Step 3 preview', 'preview'], ['Saved', 'saved']]],
    ['SCR-20', 'SCR-20.html', 'Delete field (dialogs)', 'Admin', 'R2', 'FR-076, 080', [['Blocked by formulas', 'blocked'], ['Confirm', 'confirm'], ['Wrong password', 'pwerr']]],
    ['SCR-21', 'SCR-21.html', 'Checkpoints and versions', 'Admin', 'R2', 'FR-077, 078, 080', [['Saved', 'saved'], ['Name missing', 'nameerr'], ['Revert dialog', 'revert'], ['After revert', 'reverted'], ['Empty', 'empty'], ['Loading', 'loading'], ['Error', 'error']]],
    ['SCR-22', 'SCR-22.html', 'E-mail alert previews', 'Engineer receives', 'R2', 'FR-081 to 084', [['Overdue', 'overdue'], ['Daily digest', 'digest'], ['Alerts OFF', 'off']]],
  ]],
];

function buildIndex() {
  let rowsHtml = '';
  let count = 0, states = 0;
  GROUPS.forEach((g) => {
    rowsHtml += `<tr><th colspan="6" scope="colgroup" style="background:var(--nav);color:#fff;text-transform:none;letter-spacing:0;font-size:var(--fs-body)">${g[0]}</th></tr>`;
    g[1].forEach((r) => {
      count++;
      const st = (r[6] || []).map((s) => `<a href="${r[1]}#state=${s[1]}">${s[0]}</a>`).join(' &middot; ');
      states += (r[6] || []).length;
      const dev = (r[7] || []).map((d) => `<a href="${d[1]}">${d[0]}</a>`).join(' &middot; ');
      rowsHtml += `<tr><td class="mono t-strong nowrap">${r[0]}</td><td><a class="t-strong" href="${r[1]}">${r[2]}</a><div class="t-label t-muted">${r[3]} &middot; ${r[4]}</div></td><td class="hide-md">${r[5]}</td><td>${st || '<span class="t-faint">One state</span>'}</td><td>${dev || '<span class="t-faint">Responsive</span>'}</td></tr>`;
    });
  });
  const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screens for review · Accucut Quotation Portal</title>
<meta name="description" content="Review mock-ups of every screen of the Accucut Quotation Portal, with fictional data.">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Accucut Quotation Portal">
<meta property="og:title" content="Screens for review · Accucut Quotation Portal">
<meta property="og:description" content="Review mock-ups of every screen of the Accucut Quotation Portal, with fictional data.">
<link rel="icon" href="../assets/accucut-logo.jpg">
<link rel="stylesheet" href="screens.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="topbar" style="position:static"><a class="brand" href="index.html"><img src="../assets/accucut-logo.jpg" width="56" height="56" alt="AccuCut logo"><span><span class="brand-name">ACCUCUT LASERS</span> <span class="brand-sub">Quotation Portal &middot; screens for review</span></span></a></header>
<main class="page" id="main">
 <div class="stack-sm"><h1 class="t-heading">Screens for review (G3)</h1><p class="t-body t-muted">Review mock-ups, not production code. Developers rebuild them with shadcn/ui. All names, part numbers, rates and prices are invented. Version 0.5, 2026-11-02 (architecture v0.8 and SPEC v1.10: the whole-order rule with a parent showing only its own row, Warn for a row that costs 0, every calculated figure cleared on any input change, no Excel file until a calculation is current, the approved price kept until a new approval or the Admin removes it, Cancel approval and Remove price for the Admin, the rate-change notice, the optional Part Model and the Last backup line). Specification: <a href="../ux-spec.md">docs/03-ux/ux-spec.md</a>.</p></div>
 <section class="card"><div class="card-head"><h2 class="t-sub">How to review</h2></div><div class="card-body"><ul class="stack-sm">
  <li>${icon('check', 16)} Open any page by double-click. Nothing needs a server, a build or a sign-in.</li>
  <li>${icon('check', 16)} The yellow bar at the top of each screen is review-only. Its buttons switch the screen between its states: default, loading, empty, error, success, and the dialogs. Links in the table below open a state directly.</li>
  <li>${icon('check', 16)} Phone (360 px) and tablet (768 px) links open the real screen inside a device-sized frame. You can also narrow your browser window on any screen.</li>
  <li>${icon('check', 16)} Buttons and links between screens click through the main journeys: queue, estimate, cost details, approve, export.</li>
  <li>${icon('check', 16)} Engineer screens (SCR-03 Engineer, SCR-05, SCR-23, SCR-24 and the Engineer's e-mails) show no amount, rate or formula anywhere. The word &quot;cost&quot; appears only in field names, in the one message the specification fixes and in the About sentence the delivery lead approved as written.</li></ul></div></section>
 <section class="card" aria-label="Screen list"><div class="table-wrap"><table class="table index-table"><caption class="sr-only">All screens, by area</caption><thead><tr><th scope="col">ID</th><th scope="col">Screen, role and release</th><th scope="col" class="hide-md">FRs</th><th scope="col">States</th><th scope="col">Devices</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></section>
 <p class="t-label t-muted">27 screens on ${count} pages (Engineer and Lead variants are separate pages), ${DEVICES.length} phone and tablet frames, ${states} state links. Not designed, by decision: "Copy from part" and "Apply to selected" (rejected), a per-section "Not needed for this part" switch (their answer: no switch), a drawing viewer (next release; room is reserved on SCR-05, use the toggle there), offline use, dark mode and the sample's extras. Wording previews, labelled on the screens: the quantity warning notice on SCR-06, 08 and 10, which uses example rows because the sample estimate has no row with 0 in QTY per Assy.</p>
</main>
<footer class="auth-foot">&copy; Accucut Lasers Pvt Ltd. All rights reserved.</footer>
</body>
</html>
`;
  fs.writeFileSync(OUT + 'index.html', html);
  return { count, states };
}

module.exports = { DEVICES, devicePage, buildIndex };
