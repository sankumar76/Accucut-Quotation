'use strict';
const L = require('./lib.cjs');
const { icon, page, badge, notice, crumbs, pageHead, field, selectField, skeletonRows, emptyState, reviewNote, esc, fmt, inr, NODES, get, sigma, isParent, MAT, RATES } = L;

const TASK = { id: 'Q-2026-0318', title: 'Control cabinet CC-40', cust: 'Brightwater Controls', due: '06 Nov 2026, 17:00', notes: 'Quote the cabinet and the mounting bracket kit together. The drawings are in the task folder.', path: '\\\\fileserver\\rfq\\RFQ-2026-031', eng: 'Priya Nair', by: 'Kiran Bose' };
const MATOPTS = ['Choose material', MAT.MS.name, MAT.SS.name, MAT.AL.name, 'Not applicable'];
const TREATOPTS = ['Choose treatment or colour', 'Textured grey', 'Brushed finish', 'Anodised natural', 'Not applicable', 'Other'];

/* ---------------- parts tree ---------------- */
function treePanel(role, active, o = {}) {
  const lead = role !== 'engineer';
  const miss = o.miss || [];
  const items = NODES.map((n) => {
    const st = o.allDone ? 'done' : miss.includes(n.no) ? 'miss' : n.st;
    const fig = lead ? `<span class="tree-fig"><span class="tree-h"><span class="sr-only">Count for the whole order: </span>${n.n.H} nos</span><span class="fig-val">${fmt(n.bg)}</span><span class="fig-none" aria-label="No figure yet">&mdash;</span><span class="fig-clr">Cleared</span></span>` : '';
    const eN = (o.errNodes || []).includes(n.no);
    const ico = eN ? `<span data-hide="error">${L.stIcon(st)}</span><span data-show="error" hidden>${L.stIcon('miss')}</span>` : L.stIcon(st);
    return `<li role="none"><a role="treeitem" aria-level="${n.d + 1}" aria-selected="${n.no === active}" ${n.no === active ? 'aria-current="true"' : ''} ${eN ? 'data-err ' : ''}class="tree-item${n.no === active ? ' is-active' : ''}${st === 'miss' ? ' has-error' : ''}" style="--lvl:${n.d}" href="#" tabindex="${n.no === active ? 0 : -1}">${ico}<span class="tree-no">${n.no}</span><span class="tree-name">${n.name}</span>${fig}${st === 'miss' ? '<span class="sr-only">has missing inputs</span>' : ''}${eN ? '<span class="sr-only" data-show="error" hidden>has missing inputs</span>' : ''}</a></li>`;
  }).join('');
  return `<aside class="card ws-tree tree-panel" id="tree" aria-labelledby="tree-title">
   <div class="card-head"><h2 id="tree-title" class="t-sub">Parts tree</h2><span class="spacer"></span><span class="t-label t-muted">${NODES.length} rows</span><button class="btn btn-secondary btn-icon show-mobile" type="button" data-toggle="tree-open" aria-label="Close parts tree" style="width:36px;height:36px">${icon('x', 18)}</button></div>
   <div class="card-body stack"><ul class="tree" role="tree" aria-label="Items and parts, ${NODES.length} rows">${items}</ul>
    <hr class="divider">
    <div class="row" data-hide="submitted approved"><button class="btn btn-ghost" type="button">${icon('plus', 18)} New item</button></div>
    ${lead ? `<p class="t-label t-muted">Each figure is that row's own BG. The count for the whole order (QTY per Assy) is shown beside it and is already included. The estimate total adds every row's BG.</p><p class="t-label t-muted" data-show="cleared unlockedcleared" hidden>${icon('clock', 14)} Every calculated figure is cleared because an input changed. Press Recalculate to see them again.</p><p class="t-label t-muted" data-show="draft" hidden>No figures yet. They appear after Calculate.</p>` : ''}
    <div class="tree-legend" aria-label="Legend"><span>${L.stIcon('done')} Complete</span><span>${L.stIcon('part')} In progress</span><span>${L.stIcon('todo')} Not started</span><span>${L.stIcon('miss')} Missing data</span></div></div>
   <button class="tree-handle hide-mobile" type="button" role="separator" aria-orientation="vertical" aria-label="Resize parts tree. Use left and right arrow keys." aria-valuemin="240" aria-valuemax="400" aria-valuenow="288"></button>
  </aside>`;
}

/* ---------------- guided form sections ---------------- */
const U = { H: 'nos', J: 'mm', K: 'mm', L: 'mm', N: 'kg', P: 'sec', Q: 'mm', R: 'nos', T: 'nos', U: '₹ / pc', V: 'nos', W: 'holes', X: 'holes', Y: 'holes', AP: '₹', AU: '₹', BM: '₹', I: '₹ / kg' };
const NAMES = { B: 'Part No.', D: 'Description', G: 'Treatment / Color', H: 'QTY per Assy', E: 'Material in Drawing', F: 'Material Considered', I: 'Material Rate / Kg', J: 'Length', K: 'Width', L: 'Thickness', N: 'Part Weight', P: 'Cutting Time', Q: 'Cutting Length', R: 'No. of Bend', S: 'Fasteners', T: 'Fasteners Qty', U: 'Fasteners Cost', V: 'Weld', W: 'Drilling', X: 'Tapping', Y: 'CSK', AP: 'Machining Cost', AU: 'Plating Cost', BM: 'Tool Cost', AJ: 'Remarks' };
const num = (v) => (v === '' || v === undefined ? '' : Number(v).toFixed(2));

function sectionCards(n, o = {}) {
  /* n: node; o: role, errors (set of letters), imgState, blank (set of letters shown blank) */
  const lead = o.role !== 'engineer';
  const err = o.errors || new Set();
  const blank = o.blank || new Set();
  const v = n.n;
  const val = (k) => (blank.has(k) ? '' : num(v[k]));
  const E = 'Enter this value. Use 0 if the part does not need it.';
  const bad = o.badfmt || {};
  const nf = (k, hint = '') => field({ id: 'f-' + k, label: NAMES[k], col: k, unit: U[k], value: bad[k] ? bad[k][0] : val(k), mode: 'decimal', error: bad[k] ? bad[k][1] : err.has(k) ? E : '', hint });
  const fastOn = v.S && v.S.toLowerCase() !== 'none';
  const secs = [];
  const done = (letters) => letters.filter((k) => !blank.has(k)).length;
  const count = (arr) => `${done(arr)} of ${arr.length}`;
  const hdr = (no, title, range, cnt, st) => `<div class="card-head"><span class="section-no${st === 'done' ? ' is-done' : st === 'error' ? ' is-error' : ''}">${no}</span><h3 class="t-sub" id="sec-${no}-t">${title}</h3><span class="spacer"></span><span class="range-tag">${range}</span><span class="t-label ${st === 'error' ? '' : 't-muted'}" style="${st === 'error' ? 'color:var(--danger);font-weight:600' : ''}">${st === 'error' ? icon('alert', 12) + ' ' : ''}${cnt}</span></div>`;
  const stOf = (letters) => (letters.some((k) => err.has(k) || bad[k]) ? 'error' : letters.every((k) => !blank.has(k)) ? 'done' : '');
  const card = (no, title, range, letters, inner, cls = '') => `<section class="card section-card ${cls}" id="sec-${no}" aria-labelledby="sec-${no}-t">${hdr(no, title, range, count(letters), stOf(letters))}<div class="card-body stack">${inner}</div></section>`;

  /* 01 Part details */
  const imgBlock = o.imgState === 'error'
    ? `<div class="dropzone is-error" role="group" aria-label="Part Model picture"><span class="thumb" aria-hidden="true">${icon('x', 24)}</span><span><span class="field-error" id="f-C-e">${icon('alertc', 14)}<span>"cabinet-photo.png" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture.</span></span><span class="t-label">Also accepted: PNG, JPG, GIF or WebP.</span></span></div>`
    : `<div class="dropzone" role="group" aria-label="Part Model picture"><span class="thumb"><svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="14" width="36" height="22" rx="2" fill="none" stroke="#4A4D57" stroke-width="2"/><circle cx="14" cy="22" r="2" fill="#4A4D57"/><circle cx="34" cy="22" r="2" fill="#4A4D57"/><path d="M6 30h36" stroke="#4A4D57" stroke-width="2"/></svg></span><span><span class="t-body t-strong">base-frame.png</span><span class="t-label" style="display:block">84 KB<span data-hide="submitted approved">. Paste, drop a picture here, or <a href="#">choose a file</a>.</span></span><span class="t-label" style="display:block" data-hide="submitted approved"><a href="#">Replace</a> &middot; <a href="#">Remove</a></span><span class="t-label hide-mobile" style="display:block;color:var(--ink-3)" data-hide="submitted approved">Ctrl+V pastes a copied picture.</span><span class="t-label show-mobile" style="display:none;color:var(--ink-3)" data-hide="submitted approved">On a phone, choose a file to take a photo or pick from the gallery.</span></span></div>`;
  secs.push(card('01', 'Part details', 'A–D, G, H', ['B', 'D', 'G', 'H'], `<div class="grid-fields" style="grid-template-columns:1fr">
    ${field({ id: 'f-A', label: 'Sl. No', col: 'A', auto: true, value: n.no, hint: 'From the position in the parts tree.' })}
    ${field({ id: 'f-B', label: NAMES.B, col: 'B', value: v.B })}
    <div class="field"><span class="field-label" id="f-C-l">Part Model <span class="t-faint" style="font-weight:400">Optional</span> <span class="col-tag"><span class="sr-only">Excel column </span>C</span></span>${imgBlock}<span class="field-hint">PNG, JPG, GIF or WebP, under 200 KB.</span></div>
    ${field({ id: 'f-D', label: NAMES.D, col: 'D', value: v.D })}
    ${selectField({ id: 'f-G', label: NAMES.G, col: 'G', options: TREATOPTS, value: v.G, hint: 'Choose "Not applicable" if this row has no treatment or colour.' }).replace('<select class="select"', '<select data-other="g-other" class="select"')}
    <div class="field" id="g-other" hidden><label class="field-label" for="f-Gother">Treatment / Color, in your words <span class="col-tag"><span class="sr-only">Excel column </span>G</span></label><input class="input" id="f-Gother" required placeholder="Type the treatment or colour"><span class="field-hint">Saved and exported as typed.</span></div>
    ${field({ id: 'f-H', label: NAMES.H, col: 'H', unit: 'nos', value: val('H'), mode: 'decimal', hint: 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.' })}</div>`));
  /* 02 Material */
  secs.push(card('02', 'Material and dimensions', lead ? 'E, F, I, J–L, N' : 'E, F, J–L, N', ['E', 'J', 'K', 'L', 'N'], `<div class="grid-fields" style="grid-template-columns:1fr">
    ${selectField({ id: 'f-E', label: NAMES.E, col: 'E', options: MATOPTS, value: MAT[v.E].name, hint: 'From the Material Master. Choose "Not applicable" if this row has no material.' })}
    ${field({ id: 'f-F', label: NAMES.F, col: 'F', auto: true, value: v.E === 'NA' ? '' : MAT[v.E].considered })}
    ${lead ? field({ id: 'f-I', label: NAMES.I, col: 'I', auto: true, value: v.E === 'NA' ? '' : '₹ ' + fmt(MAT[v.E].price), hint: 'Lead and Admin only.' }) : ''}
    ${nf('J')}${nf('K')}${nf('L')}${nf('N', 'Finished part weight.')}</div>`));
  secs.push(card('03', 'Cutting process', 'P–Q', ['P', 'Q'], `<div class="grid-fields" style="grid-template-columns:1fr">${nf('P')}${nf('Q')}</div>`));
  secs.push(card('04', 'Bending', 'R', ['R'], `<div class="grid-fields" style="grid-template-columns:1fr">${nf('R')}</div>`));
  /* 05 Fasteners */
  secs.push(card('05', 'Fasteners', 'S–U', fastOn ? ['S', 'T', 'U'] : ['S'], `<div class="grid-fields" style="grid-template-columns:1fr">
    ${field({ id: 'f-S', label: NAMES.S, col: 'S', value: v.S, hint: 'Type "None" if the part has no fasteners.' })}
    ${fastOn ? `${nf('T')}${nf('U', 'Cost of one piece.')}` : `<div class="field"><span class="field-label">Fasteners Qty and Cost <span class="col-tag is-auto">T</span><span class="col-tag is-auto">U</span></span><div class="output">Not needed. Saved as 0.</div></div>`}</div>`));
  secs.push(card('06', 'Welding, drilling and tapping', 'V–Y', ['V', 'W', 'X', 'Y'], `<div class="grid-fields" style="grid-template-columns:1fr">${nf('V')}${nf('W')}${nf('X')}${nf('Y')}</div>`));
  /* 07 Surface */
  const selected = v.flags || [];
  const chips = selected.length ? selected.map((c) => `<span class="chip is-on">${L.TREAT[L.TCOL.indexOf(c)]} <span class="t-mono">${c} = 1</span></span>`).join('') : '<span class="placeholder">None selected (all eight = 0)</span>';
  secs.push(card('07', 'Surface treatment', 'Z–AG', ['Z'], `<div class="field"><span class="field-label" id="tr-l">Surface treatments <span class="col-tag">Z</span><span class="t-faint">to</span><span class="col-tag">AG</span></span>
    <button class="multiselect" type="button" data-multiselect aria-haspopup="listbox" aria-expanded="false" aria-controls="tr-panel" id="tr-btn" aria-labelledby="tr-l tr-btn">${chips}</button>
    <div class="popover" id="tr-panel" role="group" aria-label="Surface treatment options" hidden>${L.TREAT.map((t, i) => `<label class="opt"><input type="checkbox" data-name="${t}" data-col="${L.TCOL[i]}"${selected.includes(L.TCOL[i]) ? ' checked' : ''}><span style="flex:1">${t}</span><span class="col-tag">${L.TCOL[i]}</span></label>`).join('')}</div>
    <span class="field-hint">Selected = 1, not selected = 0. You can select none.</span></div>`, ''));
  /* 08 Other */
  secs.push(card('08', 'Other costs and remarks', 'AJ, AP, AU, BM', ['AP', 'AU', 'BM', 'AJ'], `<div class="grid-fields" style="grid-template-columns:1fr">
    ${nf('AP', 'Enter 0 if there is none.')}${nf('AU', 'Enter 0 if there is none.')}${nf('BM', 'Enter 0 if this part has no tooling.')}
    <div class="field"><label class="field-label" for="f-AJ">Remarks <span class="col-tag"><span class="sr-only">Excel column </span>AJ</span></label><textarea class="textarea${err.has('AJ') ? ' is-error' : ''}" id="f-AJ" name="f-AJ" required aria-describedby="f-AJ-h">${blank.has('AJ') ? '' : esc(v.AJ)}</textarea><span class="field-hint" id="f-AJ-h">Write "None" if there is nothing to add. Enter moves to the next field; Shift+Enter starts a new line.</span></div></div>`));
  return secs.join('\n');
}

const SECTION_STEPS = [['01', 'Part details'], ['02', 'Material'], ['03', 'Cutting'], ['04', 'Bending'], ['05', 'Fasteners'], ['06', 'Welding'], ['07', 'Surface'], ['08', 'Other']];
function stepper(errSecs = [], doneAll = false) {
  return `<nav class="stepper" aria-label="Sections of this part">${SECTION_STEPS.map((s, i) => `<a class="step${i === 0 ? ' is-current' : ''}" href="#sec-${s[0]}" ${i === 0 ? 'aria-current="step"' : ''}>${errSecs.includes(s[0]) ? icon('alert', 14) : doneAll || i < 2 ? icon('check', 14) : ''}<span class="t-mono">${s[0]}</span> ${s[1]}${errSecs.includes(s[0]) ? '<span class="sr-only"> has missing inputs</span>' : ''}</a>`).join('')}</nav>`;
}

/* ============================ SCR-05 Estimate workspace (Engineer) ============================ */
function scr05() {
  const n = get('1.1');
  const sections = sectionCards(n, { role: 'engineer', errors: new Set(), blank: new Set(['Q']), imgState: 'ok' });
  const sectionsErr = sectionCards(n, { role: 'engineer', errors: new Set(['Q', 'L']), blank: new Set(['Q', 'L']), imgState: 'ok', badfmt: { W: ['-2', 'Enter 0 or more, with up to 2 decimals.'] } });
  const sectionsImg = sectionCards(n, { role: 'engineer', errors: new Set(), blank: new Set(['Q']), imgState: 'error' });
  const sectionsOk = sectionCards(n, { role: 'engineer', errors: new Set(), blank: new Set(), imgState: 'ok' });
  const customerCard = `<section class="card" aria-labelledby="cust-t"><div class="card-body row" style="align-items:flex-end">
    <div class="field" style="flex:0 1 320px"><label class="field-label" id="cust-t" for="cust">Customer <span class="t-faint" style="font-weight:400">Choose this first</span></label>
     <select class="select" id="cust" name="cust" required><option data-show="nocustomer" hidden>Choose the customer</option><option selected>${TASK.cust}</option><option>Marlow Agro Systems</option><option>Orchid Rail Works</option><option>Ridgeline Pumps</option><option>Tamarind Switchgear</option></select></div>
    <p class="t-body t-muted" style="flex:1 1 280px">Choose the customer this estimate is for. Changing it later asks you to confirm.</p></div></section>`;
  const blocks = `
   <div data-show="nocustomer" hidden>${notice('info', 'info', '<strong>Choose the customer to start.</strong><span>The form opens as soon as you pick one.</span>', 'status')}</div>
   <div data-show="error" hidden>${notice('danger', 'xc', `<strong>Nothing was submitted. 3 parts have missing inputs.</strong><ul style="padding-left:var(--s-4);list-style:disc"><li><a href="#f-L">1.1 Base frame</a>: Thickness, Cutting Length</li><li><a href="#">1.3 Door</a>: Cutting Time, Tapping</li><li><a href="#">2.1 Bracket plate</a>: Length, Width, Thickness, Remarks</li></ul><span>Parts with missing inputs are marked in the tree. Fill them in, or enter 0 where a part needs nothing, then press Calculate again.</span>`, 'alert')}</div>
   <div data-show="submitted" hidden>${notice('success', 'checkc', '<strong>Submitted.</strong><span>Cost will be calculated based on the input fields and sent for review/approval.</span>', 'status')}${''}</div>
   <div data-show="submitted" hidden>${notice('info', 'lock', '<strong>Your inputs are now read-only.</strong><span>A Lead or Admin reviews them. If something has to change, ask them.</span>')}</div>
   <div data-show="approved" hidden>${notice('success', 'lock', '<strong>Approved and locked.</strong><span>This estimate is closed and the task has moved to Closed. Inputs cannot be changed.</span>')}</div>
   <div data-show="saved" hidden>${notice('success', 'checkc', 'Draft saved at 10:42 IST.', 'status')}</div>`;
  const stateForm = (cls, secs, tail = '') => `<fieldset class="form-lock" ${tail} style="border:0;padding:0;margin:0;min-width:0"><div class="grid-sections">${secs}</div></fieldset>`;
  const formArea = `
   <div data-show="default saved nocustomer leave deletepart changecust">${`<fieldset class="form-lock" data-lock="nocustomer" style="border:0;padding:0;margin:0;min-width:0"><div class="grid-sections">${sections}</div></fieldset>`}</div>
   <div data-show="error" hidden><div class="grid-sections">${sectionsErr}</div></div>
   <div data-show="imgerror" hidden><div class="grid-sections">${sectionsImg}</div></div>
   <div data-show="submitted approved" hidden><fieldset class="form-lock" disabled style="border:0;padding:0;margin:0;min-width:0"><div class="grid-sections">${sectionsOk}</div></fieldset></div>
   <div data-show="loading" hidden aria-busy="true"><p class="sr-only" role="status">Loading this part</p><div class="grid-sections">${[1, 2, 3].map(() => `<div class="card"><div class="card-head"><span class="skeleton" style="width:32px;height:32px"></span><span class="skeleton sk-line" style="width:50%"></span></div><div class="card-body stack"><span class="skeleton" style="height:44px"></span><span class="skeleton" style="height:44px"></span><span class="skeleton" style="height:44px"></span></div></div>`).join('')}</div></div>`;
  const dialogs = `
   <div class="backdrop" data-show="changecust" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="d1-t" aria-describedby="d1-d"><div class="modal-head">${icon('alert', 20)}<h2 id="d1-t" class="t-sub">Change the customer?</h2></div><div class="modal-body"><p id="d1-d" class="t-body">You are changing the customer from Brightwater Controls to Marlow Agro Systems. Nothing you typed is lost. The new customer applies the next time the estimate is calculated.</p></div><div class="modal-foot"><button class="btn btn-secondary" type="button">Keep Brightwater Controls</button><button class="btn btn-primary" type="button">Change customer</button></div></div></div>
   <div class="backdrop" data-show="leave" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="d2-t" aria-describedby="d2-d"><div class="modal-head">${icon('alert', 20)}<h2 id="d2-t" class="t-sub">Leave without saving?</h2></div><div class="modal-body"><p id="d2-d" class="t-body">You have changes that are not saved. If you leave now they are lost.</p></div><div class="modal-foot"><button class="btn btn-secondary" type="button">Leave without saving</button><button class="btn btn-primary" type="button">${icon('save', 18)} Save draft and leave</button></div></div></div>
   ${qtyDialog('qw', 'Calculate', false)}
   <div class="backdrop" data-show="deletepart" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="d3-t" aria-describedby="d3-d"><div class="modal-head">${icon('trash', 20)}<h2 id="d3-t" class="t-sub">Delete 1.1 Base frame?</h2></div><div class="modal-body"><p id="d3-d" class="t-body">This also deletes its 2 sub-parts (1.1.1 Corner gusset, 1.1.2 Cross brace) and everything you entered for them. The remaining parts are renumbered. This cannot be undone.</p></div><div class="modal-foot"><button class="btn btn-secondary" type="button">Keep it</button><button class="btn btn-danger" type="button">${icon('trash', 18)} Delete 3 parts</button></div></div></div>`;
  const actionbar = `<div class="actionbar" role="region" aria-label="Estimate actions">
    <span class="t-label t-muted hide-mobile" data-show="default saved error nocustomer leave deletepart changecust imgerror loading" role="status"><span data-show="saved" hidden>Saved 10:42 IST</span><span data-hide="saved">Last saved 10:41 IST. Auto-save every 30 seconds.</span></span>
    <span class="t-label t-muted" data-show="submitted approved" hidden>${icon('lock', 14)} Read-only</span><span class="spacer"></span>
    <button class="btn btn-secondary" type="button" data-show="default saved error nocustomer leave deletepart changecust imgerror loading">${icon('save', 18)} Save draft</button>
    <button class="btn btn-primary" type="submit" data-after-last data-show="default saved error nocustomer leave deletepart changecust imgerror loading">${icon('calc', 18)} Calculate</button>
    <button class="btn btn-primary" type="button" disabled data-show="submitted approved" hidden>${icon('lock', 18)} Submitted</button></div>`;
  const main = `<main class="page" id="main" style="padding-bottom:var(--s-5)">
   <div class="page-head"><div class="stack-sm">${crumbs([['My tasks', 'SCR-03-engineer.html'], [TASK.id]])}
     <div class="row"><h1 class="t-heading">Estimate ${TASK.id}</h1><span data-show="default saved error nocustomer leave deletepart changecust imgerror loading">${badge('neutral', 'Draft', 'edit')}</span><span data-show="submitted" hidden>${badge('info', 'Submitted', 'send')}</span><span data-show="approved" hidden>${badge('success', 'Approved and locked', 'lock')}</span></div>
     <p class="t-body t-muted">${TASK.title} &middot; Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals.</p></div>
    <div class="row"><span class="badge badge-neutral">${icon('clock', 12)} Due ${TASK.due} IST</span></div></div>
   <div class="card"><div class="card-body row"><span class="row">${icon('folder', 18)}<span class="t-label t-caps t-muted">Task folder</span></span><a class="mono" href="file:///fileserver/rfq/RFQ-2026-031">${esc(TASK.path)}</a><button class="btn btn-secondary" type="button" data-copy="${esc(TASK.path)}" style="height:36px">${icon('copy', 16)}<span class="copy-label">Copy path</span></button><span class="t-label t-muted" style="flex:1 1 260px">${L.TIP_COPY}</span></div><div class="card-body row" style="border-top:1px solid var(--border)"><span class="row">${icon('file', 18)}<span class="t-label t-caps t-muted">Notes from ${TASK.by}</span></span><span class="t-body" style="flex:1 1 280px">${TASK.notes}</span></div></div>
   ${blocks}
   ${customerCard}
   <form class="guided-form" novalidate aria-label="Part inputs for 1.1 Base frame" onsubmit="return false">
   <div class="ws" id="ws">
    <div class="tree-scrim" data-scrim="tree-open"></div>
    ${treePanel('engineer', '1.1', { errNodes: ['1.1', '1.3', '2.1'] })}
    <div class="ws-form">
     <button class="btn btn-secondary tree-toggle-mobile show-mobile" type="button" data-toggle="tree-open" aria-controls="tree" aria-expanded="false" style="justify-content:flex-start;width:100%">${icon('tree', 18)} <span style="flex:1;text-align:left">Parts tree</span><span class="t-label t-muted">1.1 Base frame</span></button>
     <button class="btn btn-secondary tree-toggle hide-mobile" type="button" data-toggle="tree-collapsed" aria-controls="tree" aria-expanded="true" style="align-self:flex-start">${icon('tree', 18)} Parts tree</button>
     <div class="row" style="align-items:flex-start">
      <div class="stack-sm" style="flex:1 1 280px"><span class="t-label t-caps t-muted">Part &middot; level 2, under 1 Control cabinet assembly</span><h2 class="t-sub"><span class="t-mono">1.1</span> &middot; Base frame</h2>
       <div class="row" style="gap:var(--s-3)"><div class="progress" role="progressbar" aria-label="Inputs complete for this part" aria-valuemin="0" aria-valuemax="24" aria-valuenow="23" style="width:160px"><span style="width:96%"></span></div><span class="t-label t-muted"><span data-show="default saved nocustomer leave deletepart changecust imgerror loading">23 of 24 inputs complete</span><span data-show="error" hidden>22 of 24 inputs complete</span><span data-show="submitted approved" hidden>24 of 24 inputs complete</span></span></div></div>
      <div class="row" role="group" aria-label="Part actions" data-hide="submitted approved"><button class="btn btn-ghost" type="button">${icon('plus', 18)} Sub-part</button><button class="btn btn-ghost" type="button">${icon('plus', 18)} Part beside</button><button class="btn btn-ghost btn-icon" type="button" aria-label="Move 1.1 up">${icon('arrowup', 18)}</button><button class="btn btn-ghost btn-icon" type="button" aria-label="Move 1.1 down">${icon('arrowdown', 18)}</button><a class="btn btn-ghost" href="#state=deletepart" style="color:var(--danger)">${icon('trash', 18)} Delete</a></div></div>
     ${stepper([], false)}
     ${formArea}
     <!-- Reserved region: the grid track to the right of this column is where a drawing viewer docks in a later release (FR-087). -->
    </div>
    <div class="ws-drawing" aria-hidden="true"><div class="drawing-slot"><div class="stack-sm"><span class="empty-ic" style="margin:0 auto;display:flex;width:56px;height:56px;border-radius:50%;background:#fff;align-items:center;justify-content:center">${icon('panel', 24)}</span><p class="t-body t-strong">Reserved region</p><p class="t-label t-muted">A drawing viewer docks here in the next release. The form columns reflow beside it with no redesign.</p></div></div></div>
   </div>
   ${actionbar}
   </form>
   ${reviewNote(`<strong>Quantity warning (FR-104, D-22, Q-41).</strong> A 0 in QTY per Assy is allowed. At Calculate, if any row has 0, this dialog names each such row with its Sl. No and part and says that the row will cost 0 in this estimate. "Go back" is the safe choice and holds focus; "Calculate anyway" runs the calculation. If it opens again with a new list because something changed meanwhile, it shows the new list (state "Warning, list changed"). It carries no figure beyond that 0 and none of the words rate, price or formula (UX-24). The field rule stays "0 or more". <strong>Part Model is optional:</strong> it is not counted as a required input and there is no missing-picture message (UX-61).`)}
   ${reviewNote(`Engineer view: no cost, rate, formula or preview anywhere (FR-008). Tool Cost, Machining Cost and Plating Cost are inputs, so they appear. Enter moves to the next field; try it in the form. The three views of this screen: <a href="SCR-05-phone.html">phone</a> (tree opens as a drawer), <a href="SCR-05-tablet.html">tablet</a>, and this desktop view. <button class="rb-toggle" type="button" data-toggle="show-drawing-slot" aria-expanded="false">Show reserved drawing region</button> to see the form reflow.`)}
  </main>${dialogs}`;
  return page({ id: 'SCR-05', file: 'SCR-05.html', name: 'Estimate workspace (Engineer)', title: 'Estimate workspace', desc: 'Enter part details section by section for an estimation task at Accucut Lasers.', role: 'engineer', active: 'queue', states: ['default', 'saved:Saved', 'error:Calculate blocked', 'imgerror:Picture too large', 'nocustomer:No customer', 'changecust:Change customer', 'leave:Unsaved changes', 'deletepart:Delete part', 'loading', 'qtywarn:Quantity warning', 'qtywarn2:Warning with a new list', 'submitted:Submitted', 'approved:Approved'], bases: 'qtywarn=default,qtywarn2=default', roleLabel: 'Engineer', release: 'R1', frs: 'FR-042 to 057, 087, 102, 104', body: main });
}

/* ============================ Lead / Admin review ============================ */
const money = (x) => inr(x);
const ROUNDNOTE = 'Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.';
const CALC_AT = '05 Nov 2026, 10:42 IST';
const APPROVED_AT = '05 Nov 2026, 11:20 IST';
const CL = 'cleared unlockedcleared';
/* ---- Quantity warning (FR-104, D-22, Q-41; UX-36, 44 to 50) ----
   Under the whole-order rule a 0 in QTY per Assy makes that ROW cost 0 and nothing else. The sample estimate has no row with 0
   and its figures must not change, so the Lead and Admin side is shown as a labelled WORDING PREVIEW with example rows that are
   not in the sample tree. The Engineer dialog names rows of the sample tree: it shows no figure. */
const WARN_ROWS = [['2.2', 'Support arm'], ['2.3', 'Spacer']];
const previewHead = (what) => `<div class="row" style="gap:var(--s-2)"><span class="badge badge-neutral">${icon('eye', 12)} Wording preview</span><span class="t-label t-muted">${what} Example rows, not in the sample tree: the sample estimate has no row with 0 in QTY per Assy.</span></div>`;
function warnNoticePreview(extra) {
  return `<section class="card preview" aria-label="Wording preview: quantity warning on this calculation"><div class="card-body stack">${previewHead('How the quantity warning reads for a Lead or Admin, and how such a row is marked.')}
   ${notice('warn', 'alert', `<strong>Quantity warning on this calculation.</strong><span>${TASK.eng} went ahead on ${CALC_AT} with 0 in QTY per Assy on 2 rows: ${WARN_ROWS.map((r) => r[0] + ' ' + r[1]).join(' and ')}. Each of these rows costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.</span>`, 'status')}
   <ul class="stack-sm" style="list-style:none;padding:0">${WARN_ROWS.map((r) => `<li class="row" style="gap:var(--s-3)"><span class="tree-no">${r[0]}</span><span class="t-strong">${r[1]}</span><span class="badge badge-warn">${icon('alert', 12)} Quantity 0</span><span class="spacer"></span><span class="t-muted">0 nos &middot; 0.00</span></li>`).join('')}</ul>
   <p class="t-label t-muted">The same tag, "Quantity 0", marks the row in the parts tree and in "How the total is built", as an icon and as words. ${extra || ''}</p></div></section>`;
}
function qtyDialog(id, action, lead) {
  const li = (r, extra) => `<li${extra || ''}>QTY per Assy is 0 on <a class="t-strong" href="#">${r[0]} ${r[1]}</a>. That row will cost 0 in this estimate.</li>`;
  return `<div class="backdrop" data-show="qtywarn qtywarn2" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-d"><div class="modal-head">${icon('alert', 20)}<h2 id="${id}-t" class="t-sub"><span data-hide="qtywarn2">Check the quantity on 2 rows</span><span data-show="qtywarn2" hidden>Check the quantity on 3 rows</span></h2></div>
   <div class="modal-body stack"><div data-show="qtywarn2" hidden>${notice('info', 'info', '<strong>The list changed.</strong><span>Something changed after you pressed ' + action + ', so this is the new list. Check it again.</span>', 'status')}</div>
    <p id="${id}-d" class="t-body">You can go back and change the count, or go ahead.${lead ? ' You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead.' : ''}</p>
    <ul class="stack-sm" style="list-style:none;padding:0">${li(['1.4', 'Top cover'])}${li(['2.1', 'Bracket plate'])}${li(['1.2', 'Side panel'], ' data-show="qtywarn2" hidden')}</ul></div>
   <div class="modal-foot"><button class="btn btn-secondary" type="button">${action} anyway</button><button class="btn btn-primary" type="button" data-autofocus>Go back</button></div></div></div>`;
}
const RATE_COUNTS = '2 rates and 1 material price changed since this was calculated';
const DIFF = L.BL - L.APPROVED;
const diffText = (d) => `${money(Math.abs(d))} ${d >= 0 ? 'lower' : 'higher'} than the calculated total`;
function summaryTiles() {
  const tile = (letter, title, fig, sub, primary) => `<div class="card stat${primary ? ' is-primary' : ''}"><div class="row" style="gap:var(--s-2)"><span class="t-label t-caps t-muted">${title}</span><span class="col-tag">${letter}</span></div><div class="fig">${fig}</div><div class="t-label t-muted">${sub}</div></div>`;
  const dash = '<span class="t-faint" aria-label="Not available">&mdash;</span>';
  const notSet = (sub) => tile('BO', 'Approved Quote Price', '<span class="t-faint">Not set yet</span>', sub);
  const earlier = (label, sub) => tile('BO', 'Approved Quote Price', `${money(L.APPROVED)}<span class="t-label" style="display:block">${label}</span>`, sub);
  return `<div class="grid-stats" aria-label="Estimate totals, shown once for the whole estimate">
   <div data-show="draft" hidden>${tile('BL', 'Total Unit Production Price', '<span class="t-faint">Not calculated</span>', 'The Engineer has not pressed Calculate yet. File cell BL2 is left empty.', true)}</div>
   <div data-show="${CL}" hidden>${tile('BL', 'Total Unit Production Price (INR)', '<span class="t-faint">Cleared</span>', 'An input changed, so every calculated figure is cleared. Press Recalculate to see them again.', true)}</div>
   <div data-hide="draft ${CL}">${tile('BL', 'Total Unit Production Price (INR)', money(L.BL), 'Whole estimate: the sum of every row\'s BG. File cell BL2.', true)}</div>
   <div data-show="notool" hidden>${tile('BN', 'BL / total Tool Cost (INR)', '<span aria-label="Not available">&mdash;</span>', 'No Tool Cost entered on any part, so there is nothing to divide by. File cell BN2 is left empty.')}</div>
   <div data-hide="notool draft ${CL}">${tile('BN', 'BL / total Tool Cost (INR)', fmt(L.BN), `Total Tool Cost ${money(L.TOOL)} from 3 parts. File cell BN2.`)}</div>
   <div data-show="draft" hidden>${tile('BN', 'BL / total Tool Cost (INR)', dash, 'Available after Calculate.')}</div>
   <div data-show="${CL}" hidden>${tile('BN', 'BL / total Tool Cost (INR)', dash, 'Cleared with the total.')}</div>
   <div data-show="approved" hidden>${tile('BO', 'Approved Quote Price', money(L.APPROVED), `Approved by Kiran Bose, ${APPROVED_AT}. File cell BO2.<span class="ov-reason"><strong>${diffText(DIFF)} (${money(L.BL)}).</strong> Reason given: ${L.OVERRIDE_REASON}</span>`)}</div>
   <div data-show="cancelled" hidden>${earlier('Approval cancelled', 'Cancelled by Meera Iyer, 05 Nov 2026, 12:05 IST. The price stays on screen until the Admin removes it. It is not in the Excel file.')}</div>
   <div data-show="unlocked unlockedcleared earlier" hidden>${earlier('Approved earlier', `Approved by Kiran Bose, ${APPROVED_AT}. It stays until a new approval replaces it. File cell BO2.`)}</div>
   <div data-show="removed" hidden>${notSet('The Admin removed the earlier price on 05 Nov 2026, 12:20 IST. A new approval, after Recalculate, sets one. File cell BO2 is left empty.')}</div>
   <div data-show="cleared" hidden>${notSet('You set it when you approve, after Recalculate. File cell BO2.')}</div>
   <div data-show="default notool draft" data-hide="earlier" hidden>${notSet('You set it when you approve. File cell BO2.')}</div></div>`;
}
function roundExplain() {
  const lines = [];
  const contribShown = L.NODES.reduce((s, x) => s + L.shown(x.bg), 0);
  const contribCase = Math.abs(contribShown - L.shown(L.BL)) > 0.004 ? ` The lines of the table above add to ${fmt(contribShown)} as shown, and the total is ${fmt(L.BL)}.` : '';
  return `<p class="t-label t-muted">${ROUNDNOTE}${lines.length ? ' ' + lines.join(' ') : ''}${contribCase}</p>`;
}
function howBL() {
  const rows = L.NODES.map((x) => `<tr><td class="mono">${x.no}</td><td style="padding-left:calc(var(--s-4) + ${x.d * 20}px)">${x.name}</td><td class="num">${x.n.H}</td><td class="num t-strong">${fmt(x.bg)}</td></tr>`).join('');
  return `<details class="card"><summary class="card-head" style="cursor:pointer;list-style:none"><h2 class="t-sub">How the total is built</h2><span class="spacer"></span><span class="t-label t-muted">${icon('down', 14)} Show</span></summary><div class="card-body stack"><p class="t-body t-muted">The Engineer types the count for the whole order on every row (QTY per Assy, column H). Each row's cost (column BG) already includes its own count, so the total is the BG of every row added together. Nothing is multiplied by the rows above. For example, for 2 frames with 6 pipes and 24 lids in all, the Engineer types 2, 6 and 24. If one lid costs 1, one pipe costs 1 and the frame row holds nothing, the lid row shows 24, the pipe row 6 and the frame row 0, and the total is 24 + 6 + 0 = 30.</p>
   <p class="t-body t-muted">In this estimate, row 1.1.1 has a count of ${get('1.1.1').n.H}: 2 control cabinet assemblies, 2 base frames in each and 4 corner gussets on each frame, typed as ${get('1.1.1').n.H} on that row.</p>
   <div class="table-wrap" tabindex="0" role="region" aria-label="How each row counts in the Total Unit Production Price, scrollable"><table class="table"><caption class="sr-only">How each row counts in the Total Unit Production Price</caption><thead><tr><th scope="col">Sl. No</th><th scope="col">Part</th><th scope="col" class="num">Count for the whole order (H)</th><th scope="col" class="num">BG, this row (count included)</th></tr></thead><tbody>${rows}<tr class="is-total"><td colspan="3">Total Unit Production Price (BL), the sum of every row's BG</td><td class="num">${fmt(L.BL)}</td></tr></tbody></table></div>${roundExplain()}</div></details>`;
}
function figPair(no) {
  const n = get(no);
  const empty = `<p class="t-body t-muted" data-show="draft" hidden>No figures yet. They appear after the first Calculate.</p>`;
  const cleared = `<div class="fig-box is-screen" data-show="${CL}" hidden><span class="fig-tag">${icon('clock', 12)} This row</span><span class="fig t-faint">Cleared</span><span class="t-label t-muted">An input changed, so every calculated figure is cleared, on every row. Press Recalculate to see them again.</span></div>`;
  return `${empty}<div data-hide="draft"><div class="fig-pair">${cleared}<div class="fig-box is-screen" data-hide="${CL}"><span class="fig-tag">${icon('eye', 12)} This row, on screen and in the Excel row</span><span class="fig">${money(n.bg)}</span><span class="t-label t-muted">Unit Production Price (BG) for this row. Its count for the whole order, QTY per Assy ${n.n.H}, is already included. The estimate total adds every row's BG; nothing is multiplied by the rows above.</span><span class="t-label t-muted">In US dollars <strong>${L.usd(n.o.BJ)}</strong>, in euros <strong>${L.eur(n.o.BK)}</strong> (BJ and BK of this row).</span><span class="t-label t-muted">${ROUNDNOTE}</span></div></div></div>`;
}

function actionbarLead() {
  const CUR = 'default notool unlocked approved cancelled removed';
  return `<div class="actionbar" role="region" aria-label="Estimate actions">
   <span class="t-label t-muted hide-mobile" data-show="default notool">Calculated ${CALC_AT} &middot; configuration version 9</span><span class="t-label t-muted hide-mobile" data-show="cleared unlockedcleared" hidden>${icon('clock', 14)} Total cleared. Last calculated ${CALC_AT} &middot; configuration version 9</span><span class="t-label t-muted hide-mobile" data-show="unlocked cancelled removed" hidden>Figures from the approval of ${APPROVED_AT} &middot; configuration version 9</span><span class="t-label t-muted hide-mobile" data-show="draft" hidden>Not calculated yet</span><span class="t-label t-muted hide-mobile" data-show="approved" hidden>${icon('lock', 14)} Locked. Values stay as approved even if rates change later.</span>
   <span class="spacer"></span>
   <a class="btn btn-secondary" href="SCR-10.html" data-show="${CUR}">${icon('download', 18)} Download .xlsx</a>
   <button class="btn btn-secondary" type="button" disabled aria-describedby="why-dl" data-show="draft cleared unlockedcleared" hidden>${icon('download', 18)} Download .xlsx</button>
   <button class="btn btn-secondary" type="button" data-show="default notool" >${icon('calc', 18)} Recalculate</button>
   <button class="btn btn-primary" type="button" data-show="cleared unlocked unlockedcleared cancelled removed" hidden>${icon('calc', 18)} Recalculate</button>
   <button class="btn btn-primary" type="button" data-show="draft" hidden>${icon('calc', 18)} Calculate</button>
   <a class="btn btn-primary" href="SCR-08.html" data-show="default notool">${icon('lock', 18)} Approve and lock</a>
   <button class="btn btn-primary" type="button" disabled aria-describedby="why-approve" data-show="cleared draft unlocked unlockedcleared cancelled removed" hidden>${icon('lock', 18)} Approve and lock</button>
   <a class="btn btn-secondary" href="SCR-09.html" data-show="approved" hidden>${icon('unlock', 18)} Unlock</a>
   <button class="btn btn-danger" type="button" data-show="adminapproved cancel" hidden>${icon('x', 18)} Cancel approval</button>
   <button class="btn btn-danger" type="button" data-show="cancelled removeprice" data-hide="cancelledlead" hidden>${icon('trash', 18)} Remove price</button></div>`;
}
function adminDialogs() {
  const pw = (id) => `<div class="field"><label class="field-label" for="${id}">Your password</label><input class="input" id="${id}" type="password" autocomplete="current-password" required><span class="field-hint">We ask for your password again because this changes a price that was approved.</span></div>`;
  return `<div class="backdrop" data-show="cancel" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="ca-t" aria-describedby="ca-d"><div class="modal-head">${icon('x', 20)}<h2 id="ca-t" class="t-sub">Cancel the approval of ${TASK.id}?</h2></div>
   <div class="modal-body stack"><p id="ca-d" class="t-body">The estimate goes back to Draft and the task returns to ${TASK.eng}'s Open queue, as it does when it is unlocked. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval, after a Recalculate, brings a price back.</p>
    <div class="field"><label class="field-label" for="ca-reason">Reason for cancelling <span class="t-faint" style="font-weight:400">Required</span></label><textarea class="textarea" id="ca-reason" required placeholder="For example: the customer withdrew the order"></textarea><span class="field-hint">It is kept in the audit log.</span></div>${pw('ca-pw')}</div>
   <div class="modal-foot"><button class="btn btn-secondary" type="button" data-autofocus>Keep the approval</button><button class="btn btn-danger" type="button">${icon('x', 18)} Cancel approval</button></div></div></div>
  <div class="backdrop" data-show="removeprice" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="rp-t" aria-describedby="rp-d"><div class="modal-head">${icon('trash', 20)}<h2 id="rp-t" class="t-sub">Remove the approved price?</h2></div>
   <div class="modal-body stack"><p id="rp-d" class="t-body">The price ${money(L.APPROVED)} will be removed from every screen and from the Excel file. The audit log keeps it, and only you can read it. This cannot be undone. A new approval, after a Recalculate, is the way to set a price again.</p>${pw('rp-pw')}</div>
   <div class="modal-foot"><button class="btn btn-secondary" type="button" data-autofocus>Keep the price</button><button class="btn btn-danger" type="button">${icon('trash', 18)} Remove price</button></div></div></div>`;
}
function scr06() {
  const n = get('1.4');
  const sections = sectionCards(n, { role: 'lead', errors: new Set(), blank: new Set(), imgState: 'ok' });
  const DRAFTISH = 'draft unlocked unlockedcleared cancelled removed';
  const main = `<main class="page" id="main" style="padding-bottom:var(--s-5)">
   <div class="page-head"><div class="stack-sm">${crumbs([['Task queue', 'SCR-03.html'], [TASK.id]])}
    <div class="row"><h1 class="t-heading">Estimate ${TASK.id}</h1><span data-show="default notool cleared" >${badge('info', 'Submitted', 'send')}</span><span data-show="${DRAFTISH}" hidden>${badge('neutral', 'Draft', 'edit')}</span><span data-show="approved" hidden>${badge('success', 'Approved and locked', 'lock')}</span></div>
    <p class="t-body t-muted">${TASK.title} &middot; ${TASK.cust} &middot; Entered by ${TASK.eng} &middot; Assigned by ${TASK.by}</p></div>
    <div class="row"><span class="badge badge-neutral">${icon('clock', 12)} Due ${TASK.due} IST</span><a class="btn btn-secondary" href="file:///fileserver/rfq/RFQ-2026-031">${icon('folder', 18)} Open folder</a><button class="btn btn-secondary" type="button" data-copy="${esc(TASK.path)}">${icon('copy', 18)}<span class="copy-label">Copy path</span></button></div></div>
   <div class="card"><div class="card-body row"><span class="row">${icon('file', 18)}<span class="t-label t-caps t-muted">Notes from ${TASK.by}</span></span><span class="t-body" style="flex:1 1 280px">${TASK.notes}</span></div></div>
   <div data-show="cleared" hidden>${notice('warn', 'alert', `<strong>The total is cleared because an input changed.</strong><span>Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.</span>`, 'status')}</div>
   <p id="why-approve" class="sr-only"><span data-show="cleared unlocked unlockedcleared cancelled removed" hidden>Recalculate first. Approving is available once the figures have been calculated again.</span><span data-show="draft" hidden>Calculate first. Approving is available after the first calculation.</span></p>
   <p id="why-dl" class="sr-only"><span data-show="draft cleared unlockedcleared" hidden>Calculate or Recalculate first. There is no file until a calculation is current.</span></p>
   <div data-show="ratechanged" hidden>${notice('info', 'info', `<strong>Rates changed since this was calculated.</strong><span>${RATE_COUNTS} at 10:42 IST. <a href="#state=default">Recalculate</a> to use them. Approving is not blocked.</span>`, 'status')}</div>
   <div data-show="qtywarned" hidden>${warnNoticePreview('It shows only while the figures are current: Submitted, Approved and Draft after unlock. It is not shown when the total is cleared or not calculated.')}</div>
   <div data-show="draft" hidden>${notice('info', 'info', '<strong>The Engineer has not calculated this estimate yet.</strong><span>You can enter or correct inputs. Press Calculate to see costs. Approve and lock and the Excel download stay off until then.</span>')}</div>
   <div data-show="unlocked" hidden>${notice('warn', 'unlock', `<strong>Unlocked on 05 Nov 2026, 12:05 IST by Kiran Bose.</strong><span>Reason: customer revised the door cut-out. The figures below are still the ones from the approval. As soon as you change an input every calculated figure is cleared. Recalculate to bring them up to date: that uses the current rates and configuration. The price approved earlier stays until a new approval replaces it. The task is back in Priya Nair's Open queue.</span>`)}</div>
   <div data-show="unlockedcleared" hidden>${notice('warn', 'unlock', `<strong>Unlocked on 05 Nov 2026, 12:05 IST by Kiran Bose. An input has changed since, so every calculated figure is cleared.</strong><span>Reason: customer revised the door cut-out. The figures show again after you press Recalculate, which uses the current rates and configuration. The price approved earlier stays until a new approval replaces it. The task is back in Priya Nair's Open queue.</span>`, 'status')}</div>
   <div data-show="cancelled" hidden>${notice('warn', 'x', `<strong>Approval cancelled on 05 Nov 2026, 12:05 IST by Meera Iyer.</strong><span>Reason: the customer withdrew the order. The estimate is a Draft and the task is back in Priya Nair's Open queue. The price stays on screen, marked "Approval cancelled", and is not in the Excel file. <span data-hide="cancelledlead">Only the Admin can remove it.</span><span data-show="cancelledlead" hidden>Only the Admin can remove it; you cannot cancel or remove an approval.</span></span>`)}</div>
   <div data-show="removed" hidden>${notice('info', 'trash', `<strong>The approved price was removed on 05 Nov 2026, 12:20 IST by Meera Iyer.</strong><span>The audit log keeps it. Approve again, after a Recalculate, to set a price.</span>`)}</div>
   <div data-show="approved" hidden>${notice('success', 'lock', `<strong>Approved and locked on ${APPROVED_AT} by Kiran Bose.</strong><span>Inputs are read-only. This estimate keeps the formulas, rates and master values it was approved with. Unlock it to change anything.<span data-hide="adminapproved cancel"> Only the Admin can cancel an approval.</span></span>`)}</div>
   <div data-show="error" hidden>${notice('danger', 'xc', '<strong>We could not calculate this estimate.</strong><span>Nothing was changed. Try again; if it keeps failing, give the Admin this reference: req-7f3a91.</span><span><button class="btn btn-secondary" type="button" style="margin-top:var(--s-2)">' + icon('undo', 18) + ' Try again</button></span>', 'alert')}</div>
   <div data-show="loading" hidden aria-busy="true"><p class="sr-only" role="status">Calculating</p><div class="grid-stats">${[1, 2, 3].map(() => '<div class="card stat"><span class="skeleton sk-line" style="width:60%"></span><span class="skeleton" style="height:36px;width:70%"></span><span class="skeleton sk-line" style="width:80%"></span></div>').join('')}</div></div>
   <div data-hide="loading">${summaryTiles()}</div>
   <div data-hide="draft ${CL}">${howBL()}</div>
   <div class="ws" id="ws" style="--tree-w:328px">
    <div class="tree-scrim" data-scrim="tree-open"></div>
    ${treePanel('lead', '1.4', { allDone: true })}
    <div class="ws-form">
     <button class="btn btn-secondary tree-toggle-mobile show-mobile" type="button" data-toggle="tree-open" aria-controls="tree" aria-expanded="false" style="justify-content:flex-start;width:100%">${icon('tree', 18)} <span style="flex:1;text-align:left">Parts tree</span><span class="t-label t-muted">1.4 Top cover</span></button>
     <button class="btn btn-secondary tree-toggle hide-mobile" type="button" data-toggle="tree-collapsed" aria-controls="tree" aria-expanded="true" style="align-self:flex-start">${icon('tree', 18)} Parts tree</button>
     <div class="row" style="align-items:flex-start"><div class="stack-sm" style="flex:1 1 280px"><span class="t-label t-caps t-muted">Part &middot; level 2, under 1 Control cabinet assembly &middot; has 1 sub-part</span><h2 class="t-sub"><span class="t-mono">1.4</span> &middot; Top cover</h2></div>
      <a class="btn btn-primary" href="SCR-07.html">${icon('calc', 18)} View cost details</a></div>
     ${figPair('1.4')}
     <h3 class="t-sub" style="margin-top:var(--s-2)">Inputs</h3>
     <p class="t-body t-muted" data-hide="approved">You can correct inputs. Any change clears every calculated figure; press Recalculate to see them again.</p><p class="t-body t-muted" data-show="approved" hidden>Read-only while approved.</p>
     ${stepperLite()}
     <fieldset class="form-lock" data-lock="approved" style="border:0;padding:0;margin:0;min-width:0"><div class="grid-sections">${sections}</div></fieldset>
    </div>
   </div>
   ${actionbarLead()}
   ${qtyDialog('qw6', 'Recalculate', true)}
   ${adminDialogs()}
   ${reviewNote('Lead and Admin view. Every row has one box: its own BG, with the count for the whole order beside it. "View cost details" opens the six stages with formulas (SCR-07). The Engineer types the count for the whole order on every row (2 frames, 6 pipes, 24 lids) and the total is the sum of every row\'s BG (their answer, AQP-26). Any input change clears every calculated figure and Approve and lock and the Excel download stay off until Calculate or Recalculate is pressed (their answers, D-20 and Q-37). Phone and tablet frames: <a href="SCR-06-phone.html">phone</a>, <a href="SCR-06-tablet.html">tablet</a>.')}
   ${reviewNote('<strong>Settled by the delivery lead.</strong> <strong>Q-37:</strong> every calculated value on every row clears with the total; the Excel file is refused until a calculation is current; the approved price stays, marked "Approved earlier", until a new approval replaces it or the Admin removes it. <strong>Q-36:</strong> the words "Not applicable" show to everyone on a part, in the Material and Treatment / Color drop-downs; Material Rate and Material Considered stay blank for such a part. They are on no master list. <strong>Admin only:</strong> "Cancel approval" (reason and password), then "Remove price" (password): two dialogs, so one slip cannot remove a price. A Lead sees the state and no button (states "Approved", "Approval cancelled (Lead)"). Admin states show the same page as the Admin would see it; the top bar keeps the Lead name in this mock-up. <strong>Wording previews:</strong> the quantity warning notice is drawn with example rows, because the sample estimate has no row with 0.')}
  </main>`;
  return page({ id: 'SCR-06', file: 'SCR-06.html', name: 'Estimate review (Lead, Admin)', title: 'Estimate review', desc: 'Review inputs and totals for an estimate, then recalculate, approve and lock, or unlock it.', role: 'lead', active: 'queue', states: ['default:Submitted', 'cleared:Total cleared', 'draft:Not calculated', 'unlocked:Draft after unlock', 'unlockedcleared:Unlocked and changed', 'notool:No tool cost', 'ratechanged:Rates changed', 'qtywarn:Quantity warning (Recalculate)', 'qtywarned:Warning on this calculation', 'approved:Approved (Lead)', 'adminapproved:Approved (Admin)', 'cancel:Cancel approval (Admin)', 'cancelled:Approval cancelled (Admin)', 'cancelledlead:Approval cancelled (Lead)', 'removeprice:Remove price (Admin)', 'removed:Price removed', 'loading', 'error'], bases: 'qtywarn=cleared,qtywarned=default,ratechanged=default,adminapproved=approved,cancel=approved,cancelledlead=cancelled,removeprice=cancelled', roleLabel: 'Lead, Admin', release: 'R1', frs: 'FR-058 to 065, 070, 100, 104, 106 to 108', body: main });
}
function stepperLite() { return stepper([], true).replace('class="stepper"', 'class="stepper" style="top:var(--topbar-h)"'); }

/* ============================ SCR-07 Cost details ============================ */
function costDetails(no = '1.4') {
  const n = get(no), v = n.n, o = n.o, m = MAT[v.E], R = RATES;
  const f2 = (x) => fmt(x);
  const w = (x) => Number(x).toFixed(4);   // calculated operands in the working lines are shown to 4 decimals
  const chk = (id, calc, real) => { if (Math.abs(calc - real) >= 0.005) throw new Error('worked line does not reproduce ' + id + ': ' + calc + ' vs ' + real); };
  chk('AK', (+w(o.M) * m.price) - (+w(o.O) * m.scrap), o.AK); chk('BA', +w(o.AK) + +w(o.AY) + +w(o.AZ), o.BA); chk('BB', +w(o.BA) * v.H, o.BB);
  chk('BD', +w(o.BB) * RATES['OH Profit %'] / 100, o.BD); chk('BE', +w(o.BB) * RATES['Inspection & Packing %'] / 100, o.BE); chk('BF', +w(o.BB) * RATES['Transport %'] / 100, o.BF);
  chk('BG', +w(o.BB) + +w(o.BD) + +w(o.BE) + +w(o.BF), o.BG); chk('BJ', +w(o.BG) / L.FX.usd, o.BJ); chk('BK', +w(o.BG) / L.FX.eur, o.BK);
  if (o.AV) chk('AV', +w(o.AI) * RATES['Powder-rate-per-sqft'], o.AV);
  const row = (letter, name, formula, subst, val, cls = '', out = true) => `<div class="stage-row ${cls}"><span class="col-tag${out ? ' is-out' : ''}" style="justify-self:start">${letter}</span><div><div class="t-body t-strong">${name}</div><div class="formula">${formula}</div>${subst ? `<div class="subst">${subst}</div>` : ''}</div><div class="val">${val}</div></div>`;
  const grp = (t) => `<div class="stage-row" style="grid-template-columns:1fr;background:var(--bg);padding-top:var(--s-2);padding-bottom:var(--s-2)"><span class="t-label t-caps t-muted">${t}</span></div>`;
  const stg = (n_, title, total, inner, open = true) => `<details class="stage"${open ? ' open' : ''}><summary><span class="section-no">${n_}</span><span class="t-sub" style="flex:1">${title}</span><span class="t-body t-strong t-num">${total}</span>${icon('down', 18, 'chev')}</summary>${inner}</details>`;
  const sel = (c) => (v.flags || []).includes(c);
  const hidden = L.TCOL.filter((c) => !sel(c) && c !== 'AD').length;
  const NA = v.E === 'NA';   // "Not applicable" material (D-17, Q-36): no rate or material value is shown, so no worked line for M, O or AK
  const s1 = row('M', 'Blank Weight', '(L * K * J * Material-Specific-Gravity) / 1000000', NA ? '' : `(${f2(v.L)} × ${f2(v.K)} × ${f2(v.J)} × ${f2(m.sg)}) / 1000000`, f2(o.M) + ' kg') + row('O', 'Scrap Weight', 'IF(Material-Specific-Gravity > 0, M - N, 0)', NA ? '' : `Specific gravity ${f2(m.sg)} is above 0, so M − N: ${w(o.M)} − ${f2(v.N)}`, f2(o.O) + ' kg') + row('AH', 'Area in Sq. in', '(J * K * 2) / 645', `(${f2(v.J)} × ${f2(v.K)} × 2) / 645`, f2(o.AH)) + row('AI', 'Area in Sq. ft', 'AH / 144', `${w(o.AH)} / 144`, f2(o.AI));
  const s2 = row('I', 'Material Rate / Kg (from Material Master)', 'Material-Price-per-kg', '', NA ? '' : '₹ ' + f2(m.price), '', false) + row('AK', 'Material Cost', '(M * I) - (O * Material-Scrap-Rate)', NA ? '' : `(${w(o.M)} × ${f2(m.price)}) − (${w(o.O)} × ${f2(m.scrap)})`, money(o.AK), 'is-total');
  const treat = [['AQ', 'Hot Dip Galvanizing Cost', '(N * Dip-Galvanizing-Cost-per-kg) * Z', 'Z'], ['AR', 'Primer Cost', '(AI * Primer-rate-per-sqft) * AA', 'AA'], ['AS', 'Shot Blasting Cost', '(N * Shot-Blasting-rate-per-kg) * AB', 'AB'], ['AT', 'Polishing Cost', 'AC * ((AH / 2) * Polishing-rate-per-sqin)', 'AC'], ['AV', 'Powder Coating Cost', 'AE * (AI * Powder-rate-per-sqft)', 'AE'], ['AW', 'Foam Cost', 'AF * AI * Foam Cost', 'AF'], ['AX', 'Soft Anodize Cost', 'AG * (AH * Soft-Anodize-rate-per-sqin)', 'AG']];
  const treatRows = treat.filter((t) => sel(t[3])).map((t) => row(t[0], t[1], t[2], t[0] === 'AV' ? `1 × (${w(o.AI)} × ${f2(R['Powder-rate-per-sqft'])})` : '', money(o[t[0]]))).join('');
  const s3 = grp('Cutting') + row('AL', 'Cutting Cost', 'P * Cutting-Rate-per-Sec', `${f2(v.P)} × ${f2(R['Cutting-Rate-per-Sec'])}`, money(o.AL)) + grp('Bending') + row('AM', 'Bending Cost', 'R * Bending-Rate-per-stroke', `${f2(v.R)} × ${f2(R['Bending-Rate-per-stroke'])}`, money(o.AM)) + grp('Welding, drilling and tapping') + row('AN', 'Drilling / Tapping Cost', '(W + X + Y) * Drilling-Tapping-Rate', `(${f2(v.W)} + ${f2(v.X)} + ${f2(v.Y)}) × ${f2(R['Drilling-Tapping-Rate'])}`, money(o.AN)) + row('AO', 'Welding Cost', 'N * Welding-rate-per-kg * V', `${f2(v.N)} × ${f2(R['Welding-rate-per-kg'])} × ${f2(v.V)}`, money(o.AO)) + grp('Surface treatment') + (treatRows || '<div class="stage-row" style="grid-template-columns:1fr"><span class="t-muted">No treatment selected.</span></div>') + `<div class="stage-row" style="grid-template-columns:1fr;background:var(--info-soft)"><span class="t-label" style="color:var(--info-ink)">${icon('eye', 12)} ${hidden} treatment lines are hidden because they are not selected for this part. They are still calculated and exported as 0.</span></div>` + grp('Entered directly by the Engineer') + row('AP', 'Machining Cost', 'input', '', money(o.AP), '', false) + row('AU', 'Plating Cost', 'input', '', money(o.AU), '', false) + row('AY', 'Total Process Cost', 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX', '', money(o.AY), 'is-total');
  const s4 = row('AZ', 'BO Cost / Fasteners', 'T * U', `${f2(v.T)} × ${f2(v.U)}`, money(o.AZ)) + row('BA', 'Material Cost + Total Process Cost + Others', 'AK + AY + AZ', `${w(o.AK)} + ${w(o.AY)} + ${w(o.AZ)}`, money(o.BA)) + row('BB', 'Sub Total 1', 'BA * H', `${w(o.BA)} × ${f2(v.H)}`, money(o.BB), 'is-total');
  const s5 = row('BC', 'Rejection', '0', 'Seeded as 0 until the delivery lead defines it', money(o.BC)) + row('BD', 'OH Profit', 'BB * OH Profit %', `${w(o.BB)} × ${f2(R['OH Profit %'])}%`, money(o.BD)) + row('BE', 'Inspection & Packing', 'BB * Inspection & Packing %', `${w(o.BB)} × ${f2(R['Inspection & Packing %'])}%`, money(o.BE)) + row('BF', 'Transportation', 'BB * Transport %', `${w(o.BB)} × ${f2(R['Transport %'])}%`, money(o.BF));
  const s6 = row('BG', 'Unit Production Price (INR)', 'BB + BC + BD + BE + BF', `${w(o.BB)} + ${w(o.BC)} + ${w(o.BD)} + ${w(o.BE)} + ${w(o.BF)}`, money(o.BG), 'is-final') + row('BH', 'Exchange Rate USD', 'ExchangeRate-USD', '', '1 USD = ₹ ' + f2(L.FX.usd), '', false) + row('BI', 'Exchange Rate EUR', 'ExchangeRate-EUR', '', '1 EUR = ₹ ' + f2(L.FX.eur), '', false) + row('BJ', 'Unit Production Price (USD)', 'BG / BH', `${w(o.BG)} / ${f2(L.FX.usd)}`, L.usd(o.BJ)) + row('BK', 'Unit Production Price (EUR)', 'BG / BI', `${w(o.BG)} / ${f2(L.FX.eur)}`, L.eur(o.BK));
  const shownSum5 = [o.BD, o.BE, o.BF].reduce((s, x) => s + Number(fmt(x).replace(/,/g, '')), 0);
  const stage5Note = Math.abs(shownSum5 - (o.BD + o.BE + o.BF)) >= 0.005 ? `<div class="stage-row" style="grid-template-columns:1fr;background:var(--info-soft)"><span class="t-label" style="color:var(--info-ink)">${icon('info', 12)} The three lines above add to ${fmt(shownSum5)} as shown, and the stage total is ${fmt(o.BD + o.BE + o.BF + o.BC)}. The portal adds the unrounded values, then rounds once.</span></div>` : '';
  return `<div class="stack">
   <div class="stack-sm"><span class="t-label t-caps t-muted">Cost details for one row</span><h2 class="t-sub"><span class="t-mono">${no}</span> &middot; ${n.name}</h2></div>
   <div data-show="cleared" hidden>${emptyState({ ic: 'calc', title: 'Cleared. Press Recalculate', text: 'An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.', action: '<a class="btn btn-primary" href="SCR-06.html#state=cleared">' + icon('calc', 18) + ' Go to the estimate</a>' })}</div>
   <div class="stack" data-hide="cleared">${figPair(no)}
   ${stg('1', '1 · Weights and areas', '', s1)}${stg('2', '2 · Material cost', money(o.AK), s2)}${stg('3', '3 · Process costs', money(o.AY), s3)}${stg('4', '4 · Sub total', money(o.BB), s4)}${stg('5', '5 · Rejection, overheads and logistics', money(o.BD + o.BE + o.BF + o.BC), s5 + stage5Note)}${stg('6', '6 · Pricing', money(o.BG), s6)}
   <p class="t-label t-muted">${ROUNDNOTE} Working lines show calculated values to 4 decimals so that you can repeat the arithmetic and get the figure on the right.</p>
   <p class="t-label t-muted">Percentages are typed as whole numbers (11 means 11%) and used as 0.11. A divide by zero shows "—" here and an empty cell in the file. Estimate-level values BL, BN and BO are on the estimate screen, not per row.</p></div></div>`;
}
function scr07() {
  const main = `<main class="page" id="main">
   <div class="page-head"><div class="stack-sm">${crumbs([['Task queue', 'SCR-03.html'], [TASK.id, 'SCR-06.html'], ['Cost details 1.4']])}<h1 class="t-heading">Cost details</h1><p class="t-body t-muted">Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.</p></div><a class="btn btn-secondary" href="SCR-06.html">${icon('arrowleft', 18)} Back to the estimate</a></div>
   <div data-show="loading" hidden aria-busy="true"><p class="sr-only" role="status">Loading cost details</p>${skeletonRows(6, 3)}</div>
   <div data-show="error" hidden>${emptyState({ ic: 'alert', title: 'We could not load the cost details', text: 'Nothing was changed. Try again.', action: '<button class="btn btn-secondary" type="button">' + icon('undo', 18) + ' Try again</button>' })}</div>
   <div class="ws" style="--drawing-w:0px;--tree-w:328px" data-hide="loading error">
    <div style="display:contents" data-hide="assembly">${treePanel('lead', '1.4', { allDone: true })}</div><div style="display:contents" data-show="assembly" hidden>${treePanel('lead', '1', { allDone: true }).replace('id="tree"', 'id="tree2"').replace('id="tree-title"', 'id="tree2-title"').replace('aria-labelledby="tree-title"', 'aria-labelledby="tree2-title"')}</div>
    <div class="ws-form"><div class="card"><div class="card-body"><div data-hide="assembly">${costDetails('1.4')}</div><div data-show="assembly" hidden>${costDetails('1')}</div></div></div></div></div>
   ${reviewNote('Desktop: opens as a side panel beside the inputs (1280 px and wider), as a full column below that. Tablet and phone: the six stages are an accordion inside the page, all closed except the first on phones (<a href="SCR-07-phone.html">phone frame</a>). The hidden-zero rule applies to the seven treatment lines (AQ-AX except the unused Plating flag AD). State "Assembly row": a row whose material is "Not applicable" shows Material Rate blank and 0.00 for Blank Weight, Scrap Weight and Material Cost, with no worked line for them (Q-36, settled: the words show to everyone).')}
  </main>`;
  return page({ id: 'SCR-07', file: 'SCR-07.html', name: 'Cost details (per row)', title: 'Cost details', desc: 'Calculated values for one part, grouped in six stages with the formula next to each value.', role: 'lead', active: 'queue', states: ['default', 'assembly:Assembly row (Not applicable)', 'cleared:Total cleared', 'loading', 'error'], roleLabel: 'Lead, Admin', release: 'R1', frs: 'FR-058, 059, 060, 026, 100', body: main });
}

/* ============================ SCR-08 Approve, SCR-09 Unlock ============================ */
function behindEstimate(bannerText) {
  return `<main class="page behind" aria-hidden="true"><div class="page-head"><div class="stack-sm"><h1 class="t-heading">Estimate ${TASK.id}</h1><p class="t-body">${TASK.title} &middot; ${TASK.cust}</p></div></div>${summaryTiles()}${bannerText || ''}</main>`;
}
function scr08() {
  const priceVariant = (id, value, show, err) => `<div data-show="${show}"${show === 'default saving' ? '' : ' hidden'}><div class="field"><label class="field-label" for="${id}">Approved Quote Price <span class="col-tag">BO</span></label>
     <div class="input-group"><span class="addon" style="border:1px solid var(--border-strong);border-right:0;border-radius:var(--radius) 0 0 var(--radius)">₹</span><input class="input input-pre${err ? ' is-error' : ''}" id="${id}" inputmode="decimal" required aria-describedby="${id}-h${err ? ' ' + id + '-e' : ''}"${err ? ' aria-invalid="true"' : ''} value="${value}" style="border-radius:0 var(--radius) var(--radius) 0"></div>
     <span class="field-hint" id="${id}-h">Starts as the calculated total. Edit it to set a different price.</span>
     ${err ? `<span class="field-error" id="${id}-e">${icon('alertc', 14)} Enter a price in rupees, 0 or more, with up to 2 decimals.</span>` : ''}</div></div>`;
  const longText = 'The customer agreed a rounded price after a long call about the delivery schedule, the packing and the payment terms. '.repeat(5);
  const reasonField = (id, value, err) => `<div class="field"><label class="field-label" for="${id}">Reason for the different price <span class="t-faint" style="font-weight:400">Optional</span></label>
     <textarea class="textarea${err ? ' is-error' : ''}" id="${id}" aria-describedby="${id}-h${err ? ' ' + id + '-e' : ''}"${err ? ' aria-invalid="true"' : ''} placeholder="For example: rounded for the customer quote">${value}</textarea>
     <span class="field-hint" id="${id}-h">You can leave this empty. If you give one, it is kept with the override in the audit log and shown next to the Approved Quote Price. Up to 500 characters.</span>
     ${err ? `<span class="field-error" id="${id}-e">${icon('alertc', 14)} Use 500 characters or fewer.</span>` : ''}</div>`;
  const modal = `<div class="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ap-t" aria-describedby="ap-d">
   <div class="modal-head">${icon('lock', 20)}<h2 id="ap-t" class="t-sub">Approve and lock ${TASK.id}</h2></div>
   <div class="modal-body"><p id="ap-d" class="t-body">Set the Approved Quote Price. After you approve, inputs become read-only and the task moves to Closed.</p>
    <dl class="meta"><dt>Calculated total (BL)</dt><dd class="t-strong t-num">${money(L.BL)}</dd><dt>Customer</dt><dd>${TASK.cust}</dd></dl>
    ${priceVariant('price', fmt(L.BL), 'default saving')}${priceVariant('price-o', fmt(L.APPROVED), 'override overridereason reasonlong')}${priceVariant('price-x', '12,600.555', 'error', true)}
    <div data-show="override overridereason reasonlong" hidden>${notice('warn', 'alert', `<strong>This price is ${money(Math.abs(DIFF))} ${DIFF >= 0 ? 'lower' : 'higher'} than the calculated total.</strong><span>A different price is recorded as an override with your name, the time, the calculated total, the price you set and your reason, if you give one.</span>`, 'status')}</div>
    <div data-show="override" hidden>${reasonField('ov-reason', '', false)}</div>
    <div data-show="overridereason" hidden>${reasonField('ov-reason2', L.OVERRIDE_REASON, false)}</div>
    <div data-show="reasonlong" hidden>${reasonField('ov-reason3', longText, true)}</div>
    <div data-show="qtywarned" hidden>${notice('info', 'alert', `<strong>This calculation has a quantity warning.</strong><span>${WARN_ROWS.map((r) => r[0] + ' ' + r[1]).join(' and ')} cost 0 in this estimate (example rows, wording preview). Approving is not stopped, and there is no box to tick.</span>`)}</div>
    <div data-show="ratechanged" hidden>${notice('info', 'info', `<strong>Rates changed since this was calculated.</strong><span>${RATE_COUNTS}. Approving is not blocked. Close this window and Recalculate first if you want them used.</span>`)}</div>
    <div data-show="earlier" hidden>${notice('info', 'info', `<strong>A price approved earlier is on the estimate.</strong><span>${money(L.APPROVED)}, approved ${APPROVED_AT}. Approving now replaces it.</span>`)}</div>
    <div data-show="stale" hidden>${notice('danger', 'xc', '<strong>An input changed while this window was open.</strong><span>The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again.</span>', 'alert')}</div>
    <div data-show="default" >${notice('info', 'info', 'If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.')}</div></div>
   <div class="modal-foot"><a class="btn btn-secondary" href="SCR-06.html" data-hide="stale">Cancel</a><a class="btn btn-primary" href="SCR-06.html#state=cleared" data-show="stale" hidden>${icon('calc', 18)} Recalculate first</a><button class="btn btn-primary" type="button" data-show="default override overridereason reasonlong error" data-hide="stale">${icon('lock', 18)} Approve and lock</button><button class="btn btn-primary" type="button" disabled data-show="stale" hidden>${icon('lock', 18)} Approve and lock</button><button class="btn btn-primary" type="button" disabled aria-busy="true" data-show="saving" hidden>${icon('loader', 18, 'ic-spin')} Approving</button></div></div></div>`;
  const body = `<div id="main">${behindEstimate()}${modal}</div>`;
  return page({ id: 'SCR-08', file: 'SCR-08.html', name: 'Approve and lock (dialog)', title: 'Approve and lock', desc: 'Set the approved quote price for an estimate and lock its inputs.', role: 'lead', active: 'queue', states: ['default', 'override:Price changed', 'overridereason:Price changed with reason', 'reasonlong:Reason too long', 'error:Invalid price', 'saving', 'stale:Estimate changed while open', 'qtywarned:Quantity warning on this calculation', 'ratechanged:Rates changed', 'earlier:After an unlock'], bases: 'stale=default,qtywarned=default,ratechanged=default,earlier=default', roleLabel: 'Lead, Admin', release: 'R1', frs: 'FR-062, 101, 103, 104, 106', body });
}
function scr09() {
  const modal = `<div class="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="un-t" aria-describedby="un-d">
   <div class="modal-head">${icon('unlock', 20)}<h2 id="un-t" class="t-sub">Unlock ${TASK.id}</h2></div>
   <div class="modal-body"><p id="un-d" class="t-body">Unlocking returns the estimate to Draft so inputs can be changed, and reopens the task in ${TASK.eng}'s Open queue. The unlock is logged with your reason.</p>
    <div data-show="changed" hidden>${notice('warn', 'alert', '<strong>Things have changed since this estimate was approved.</strong><ul style="padding-left:var(--s-4);list-style:disc"><li>Field and formula configuration: version 7 at approval, version 9 now.</li><li>Rates: 2 customer rates, 1 material price and the USD rate have changed.</li></ul><span>If you recalculate after unlocking, the current values are used. Until then this estimate keeps its approved figures.</span>', 'status')}</div>
    <div data-show="default error saving">${notice('info', 'info', 'Nothing has changed in the configuration or the rates since approval. Recalculating gives the same result unless you change an input.')}</div>
    <div class="field"><label class="field-label" for="reason">Reason for unlocking</label><textarea class="textarea${''}" id="reason" required aria-describedby="reason-e" placeholder="For example: customer revised the door cut-out"></textarea>
     <span class="field-error" id="reason-e" data-show="error" hidden>${icon('alertc', 14)} Enter a reason. It is kept in the audit log.</span></div></div>
   <div class="modal-foot"><a class="btn btn-secondary" href="SCR-06.html#state=approved">Keep it locked</a><button class="btn btn-primary" type="button" data-show="default changed error">${icon('unlock', 18)} Unlock</button><button class="btn btn-primary" type="button" disabled aria-busy="true" data-show="saving" hidden>${icon('loader', 18, 'ic-spin')} Unlocking</button></div></div></div>`;
  const body = `<div id="main">${behindEstimate()}${modal}</div>`;
  return page({ id: 'SCR-09', file: 'SCR-09.html', name: 'Unlock (dialog)', title: 'Unlock estimate', desc: 'Unlock an approved estimate for changes, with a reason that is kept in the audit log.', role: 'lead', active: 'queue', states: ['default:No changes', 'changed:Config or rates changed', 'error:Reason missing', 'saving'], roleLabel: 'Lead, Admin', release: 'R1', frs: 'FR-063, 038, 064, 011', body });
}

/* ============================ SCR-10 Excel export ============================ */
function scr10() {
  const fname = 'Quotation_Brightwater_Controls_Q-2026-0318_2026-11-05.xlsx';
  const toolRow = NODES.length + 3;   // header row 1, parts in rows 2 to N+1, one empty row, then the total
  const rows = NODES.map((n) => `<tr><td class="mono">${n.no}</td><td style="padding-left:calc(var(--s-4) + ${n.d * 20}px)">${n.name}</td><td class="num">${n.n.H}</td><td class="num">${fmt(n.bg)}</td><td class="num">${fmt(n.n.BM)}</td></tr>`).join('');
  const main = `<main class="page" id="main">
   <div class="page-head"><div class="stack-sm">${crumbs([['Task queue', 'SCR-03.html'], [TASK.id, 'SCR-06.html'], ['Excel export']])}<h1 class="t-heading">Excel export</h1><p class="t-body t-muted">Download this estimate as an .xlsx file that follows the worksheet layout. The file is available once a calculation is current.</p></div></div>
   <div data-show="error" hidden>${notice('danger', 'xc', '<strong>We could not build the file.</strong><span>Nothing was changed. Try again. If it keeps failing, give the Admin this reference: req-2c81d0.</span>', 'alert')}</div>
   <div data-show="generating" hidden>${notice('info', 'loader', `<strong>Building the file.</strong><span>${NODES.length} parts, 1 picture. This usually takes a few seconds.</span>`, 'status')}</div>
   <div data-show="nevercalc" hidden>${notice('warn', 'alert', '<strong>There is no file to download yet.</strong><span>This estimate has not been calculated. The download stays off until a calculation is current.</span>', 'status')}${emptyState({ ic: 'calc', title: 'Calculate first', text: 'The file holds the rows and the totals of a calculation. There is none yet.', action: '<a class="btn btn-primary" href="SCR-06.html#state=draft">' + icon('calc', 18) + ' Go to the estimate to Calculate</a>' })}</div>
   <div data-show="cleared" hidden>${notice('warn', 'alert', `<strong>The total is cleared because an input changed.</strong><span>There is no file to download until you press Recalculate.</span>`, 'status')}${emptyState({ ic: 'calc', title: 'Recalculate first', text: 'The file would hold figures that no longer match the inputs, so the portal does not build one. After Recalculate the download comes back.', action: '<a class="btn btn-primary" href="SCR-06.html#state=cleared">' + icon('calc', 18) + ' Go to the estimate to Recalculate</a>' })}</div>
   <div data-show="qtywarned" hidden>${warnNoticePreview('The file holds no warning: it keeps the rows as they are, with H 0 and BG 0 (architecture A-24). The warning is shown here and on the estimate, and in the audit log.')}</div>
   <section class="card" aria-labelledby="dl-t" data-hide="cleared nevercalc"><div class="card-head"><h2 id="dl-t" class="t-sub">File</h2><span class="spacer"></span>${badge('info', 'Submitted', 'send')}</div>
    <div class="card-body stack">
     <div data-show="empty" hidden>${emptyState({ ic: 'file', title: 'Nothing to export yet', text: 'This estimate has no parts. Add parts first, or ask the Engineer.', action: '<a class="btn btn-secondary" href="SCR-06.html">Back to the estimate</a>' })}</div>
     <div data-hide="empty"><dl class="meta"><dt>File name</dt><dd class="mono" style="font-size:var(--fs-body)">${fname}</dd><dt>Rows</dt><dd>1 header row, then one row per part in tree order (${NODES.length} rows), then one empty row and the Total Tool Cost row</dd><dt>Columns</dt><dd>A to BO, in the worksheet's order and widths</dd></dl>
      <div class="row mt-4"><button class="btn btn-primary" type="button" data-show="default error approved">${icon('download', 18)} Download .xlsx</button><button class="btn btn-primary" type="button" disabled aria-busy="true" data-show="generating" hidden>${icon('loader', 18, 'ic-spin')} Building file</button></div></div>
    </div></section>
   <div data-hide="empty nevercalc cleared">
   <div class="stack-lg"><section class="card" aria-labelledby="rec-t"><div class="card-head"><h2 id="rec-t" class="t-sub">The rows in the file</h2></div>
    <div class="card-body stack"><p class="t-body">Every row holds its own count for the whole order (H) and its own BG. The file has no per-item totals and nothing is multiplied by the rows above.</p>
     <div class="table-wrap" tabindex="0" role="region" aria-label="Count (H), Unit Production Price (BG) and Tool Cost (BM) per row in the file, scrollable"><table class="table"><caption class="sr-only">Count (H), Unit Production Price (BG) and Tool Cost (BM) per row in the file</caption><thead><tr><th scope="col">Sl. No</th><th scope="col">Part</th><th scope="col" class="num">Qty (H), for the whole order</th><th scope="col" class="num">In the file: BG</th><th scope="col" class="num">In the file: Tool Cost (BM)</th></tr></thead><tbody>${rows}<tr class="is-total"><td colspan="3">BG column added up: BL2, the same as the total on screen</td><td class="num">${fmt(L.BL)}</td><td></td></tr><tr class="is-total"><td colspan="4">Total Tool Cost: file row ${toolRow}, one empty row below the last part, with the label in the cell to the left of the Tool Cost column</td><td class="num">${fmt(L.TOOL)}</td></tr></tbody></table></div>
     <p class="t-label t-muted">The Total Tool Cost sits below the parts so that no part's own Tool Cost cell is replaced (the first part's own Tool Cost is in the Tool Cost cell of row 2). BN2 divides BL2 by it.</p></div></section>
    <section class="card" aria-labelledby="rec2-t"><div class="card-head"><h2 id="rec2-t" class="t-sub">How BL2 is made</h2></div><div class="card-body stack">
     <div class="notice notice-info">${icon('info', 18)}<div class="notice-body"><strong>How to reconcile.</strong><span>Add the BG column of the file. That gives BL2, at any quantity. Each row's BG already holds the count for the whole order that the Engineer typed, so nothing is multiplied by the rows above. For example, for 2 frames, 6 pipes and 24 lids the Engineer types 2, 6 and 24.</span></div></div>
     ${roundExplain()}</div></section>
    <aside class="card" aria-labelledby="inc-t"><div class="card-head"><h2 id="inc-t" class="t-sub">What the file holds</h2></div><div class="card-body stack">
     <ul class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${['Header row 1; columns A to BO; same widths; every cell centred', 'Currency formats: ₹ for INR, $ for USD, € for EUR', 'Part picture in column C, scaled to fit', 'Sl. No kept as text, so 1.10 stays 1.10', 'Every column exported, including hidden treatment lines as 0', 'A divide by zero is an empty cell', 'Every part keeps its own Tool Cost in its own row', `One Total Tool Cost, in the Tool Cost column of row ${toolRow}, below the last part and labelled in the cell to its left`, 'No warning cell: a quantity warning is shown on the estimate and here, never in the file (A-24)', 'No file at all until a calculation is current: not for a never-calculated estimate and not while the total is cleared'].map((t) => `<li class="row-nowrap" style="align-items:flex-start">${icon('check', 16)}<span>${t}</span></li>`).join('')}</ul>
     <hr class="divider"><dl class="meta"><dt>BL2</dt><dd>${money(L.BL)}</dd><dt>BN2</dt><dd>${fmt(L.BN)}</dd><dt>BO2</dt><dd><span data-show="approved" hidden>${money(L.APPROVED)}</span><span data-show="earlier" hidden>${money(L.APPROVED)}, approved earlier on ${APPROVED_AT}. It stays until a new approval replaces it.</span><span data-hide="approved earlier" class="t-muted">Empty until approved, and empty after the Admin cancels an approval</span></dd><dt>Total Tool Cost</dt><dd>${money(L.TOOL)}, in the Tool Cost column of row ${toolRow}</dd></dl>
     <div data-show="approved" hidden>${notice('info', 'info', `<strong>${diffText(DIFF)}.</strong><span>The price ${money(L.APPROVED)} was set against the calculated total ${money(L.BL)}. Reason given: ${L.OVERRIDE_REASON}</span>`)}<p class="t-label t-muted" style="margin-top:var(--s-2)">The reason is shown here, on the estimate and in the audit log. It is not written into the file, because the file follows the worksheet layout (assumption, OQ-UX-19).</p></div>
     <p class="t-label t-muted">BL2, BN2 and BO2 appear once, in row 2, and the file has no per-item totals (their answer: one total only). The Total Tool Cost appears once, below the last part.</p></div></aside></div></div>
   ${reviewNote('Engineers cannot reach this screen or the file (FR-070); they see the 403 page (SCR-26). The file name pattern is Quotation_&lt;Customer&gt;_&lt;TaskId&gt;_&lt;date&gt;.xlsx; spaces in the customer name become underscores, other characters are removed, at most 60 characters, and the date is the IST date of download. <strong>No file until a calculation is current</strong> (their answers, Q-37 (b) and A-32): for a never-calculated estimate and while the total is cleared the page says why, links to Calculate or Recalculate, and shows no table and no file card. There is no out-of-date file, no marked file name and no confirmation any more. <strong>Position of the Total Tool Cost (agrees with architecture 4.6):</strong> row ' + toolRow + ' of the Tool Cost column, after one empty row, with its label in the cell to the left, leaves row 2 and every part\'s own Tool Cost cell untouched.')}
  </main>`;
  return page({ id: 'SCR-10', file: 'SCR-10.html', name: 'Excel export', title: 'Excel export', desc: 'Download an estimate as an Excel file that follows the Accucut worksheet layout.', role: 'lead', active: 'queue', states: ['default', 'cleared:Total cleared', 'nevercalc:Not calculated', 'generating:Building file', 'error', 'empty', 'approved:Approved estimate', 'earlier:After an unlock', 'qtywarned:Quantity warning on this calculation'], bases: 'earlier=default,qtywarned=default', roleLabel: 'Lead, Admin', release: 'R1', frs: 'FR-066 to 071, 100, 104, 107', body: main });
}

module.exports = { scr05, scr06, scr07, scr08, scr09, scr10, treePanel, sectionCards, costDetails, TASK, summaryTiles, figPair };
