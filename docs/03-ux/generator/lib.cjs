'use strict';
/* Generator helpers for the review mock-ups (see README.md in this folder).
   Output is plain static HTML that opens by double-click.
   Output folder: ../screens/ next to this folder, or the folder in SCREENS_OUT. */

const fs = require('fs');
const path = require('path');
const OUT = path.resolve(process.env.SCREENS_OUT || path.join(__dirname, '..', 'screens')) + path.sep;

/* ---------------- icons (Lucide-style, 24 grid) ---------------- */
const P = {
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  alertc: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8"/><rect x="7" y="13" width="10" height="8"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 5-5.9M9.9 4.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  arrowup: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowdown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowright: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  tree: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  half: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
  home: '<path d="M3 12l9-9 9 9M5 10v10h14V10"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  grip: '<path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" stroke-width="3"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  star: '<path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9 9.1 9z"/>',
  sigma: '<path d="M18 7V4H6l6 8-6 8h12v-3"/>',
  arrowleft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  wifioff: '<path d="M1 1l22 22M16.7 11.1A11 11 0 0 1 21.5 14M5 12.6a11 11 0 0 1 5.2-2.5M8.5 16.4a6 6 0 0 1 7 0M12 20h.01"/>',
};
function icon(n, s = 18, cls = '') {
  if (!P[n]) throw new Error('icon ' + n);
  return `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]}</svg>`;
}

/* ---------------- fictional data ---------------- */
const SIG = '<span class="sigma" aria-hidden="true"><svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg></span>';
const ARR = '<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-2px"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span class="sr-only"> to </span>';
const NOW = { label: 'Thu 05 Nov 2026, 11:00 IST' };
const PEOPLE = {
  engineer: { name: 'Priya Nair', email: 'priya.nair@example.test', initials: 'PN', role: 'Engineer', bell: 2 },
  lead: { name: 'Kiran Bose', email: 'kiran.bose@example.test', initials: 'KB', role: 'Lead', bell: 3 },
  admin: { name: 'Meera Iyer', email: 'meera.iyer@example.test', initials: 'MI', role: 'Admin', bell: 4 },
};
const RATES = {
  'Cutting-Rate-per-Sec': 0.47, 'Bending-Rate-per-stroke': 3.15, 'Drilling-Tapping-Rate': 2.35,
  'Welding-rate-per-kg': 13.6, 'Dip-Galvanizing-Cost-per-kg': 9.4, 'Primer-rate-per-sqft': 6.85,
  'Shot-Blasting-rate-per-kg': 4.3, 'Polishing-rate-per-sqin': 0.93, 'Powder-rate-per-sqft': 8.1,
  'Foam Cost': 21.5, 'Soft-Anodize-rate-per-sqin': 1.75, 'OH Profit %': 11, 'Transport %': 2.5, 'Inspection & Packing %': 3,
};
const MAT = {
  MS: { name: 'MS sheet, cold rolled', considered: 'Mild steel', price: 58, sg: 7.85, scrap: 22 },
  SS: { name: 'SS sheet, grade A', considered: 'Stainless steel', price: 214, sg: 7.9, scrap: 95 },
  AL: { name: 'Aluminium sheet, 5-series', considered: 'Aluminium', price: 236, sg: 2.7, scrap: 110 },
  NA: { name: 'Not applicable', considered: '', price: 0, sg: 0, scrap: 0 },
};
const FX = { usd: 81.25, eur: 88.75 };
const TREAT = ['Hot Dip Galvanizing', 'Primer', 'Shot Blasting', 'Polishing', 'Plating', 'Powder Coating', 'Foam', 'Soft Anodize'];
const TCOL = ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'];

/* SPEC section 7.4, implemented exactly so every figure on every screen agrees. */
function calc(n) {
  const m = MAT[n.E], R = RATES;
  const f = (k) => (n.flags && n.flags.includes(k) ? 1 : 0);
  const o = {};
  o.M = (n.L * n.K * n.J * m.sg) / 1e6;
  o.O = o.M - n.N;
  o.AH = (n.J * n.K * 2) / 645;
  o.AI = o.AH / 144;
  o.AK = o.M * m.price - o.O * m.scrap;
  o.AL = n.P * R['Cutting-Rate-per-Sec'];
  o.AM = n.R * R['Bending-Rate-per-stroke'];
  o.AN = (n.W + n.X + n.Y) * R['Drilling-Tapping-Rate'];
  o.AO = n.N * R['Welding-rate-per-kg'] * n.V;
  o.AQ = n.N * R['Dip-Galvanizing-Cost-per-kg'] * f('Z');
  o.AR = o.AI * R['Primer-rate-per-sqft'] * f('AA');
  o.AS = n.N * R['Shot-Blasting-rate-per-kg'] * f('AB');
  o.AT = f('AC') * ((o.AH / 2) * R['Polishing-rate-per-sqin']);
  o.AV = f('AE') * (o.AI * R['Powder-rate-per-sqft']);
  o.AW = f('AF') * o.AI * R['Foam Cost'];
  o.AX = f('AG') * (o.AH * R['Soft-Anodize-rate-per-sqin']);
  o.AP = n.AP; o.AU = n.AU;
  o.AY = o.AL + o.AM + o.AN + o.AO + o.AP + o.AQ + o.AR + o.AS + o.AT + o.AU + o.AV + o.AW + o.AX;
  o.AZ = n.T * n.U;
  o.BA = o.AK + o.AY + o.AZ;
  o.BB = o.BA * n.H;
  o.BC = 0;
  o.BD = o.BB * (R['OH Profit %'] / 100);
  o.BE = o.BB * (R['Inspection & Packing %'] / 100);
  o.BF = o.BB * (R['Transport %'] / 100);
  o.BG = o.BB + o.BC + o.BD + o.BE + o.BF;
  o.BH = FX.usd; o.BI = FX.eur; o.BJ = o.BG / FX.usd; o.BK = o.BG / FX.eur;
  return o;
}
const z = { J: 0, K: 0, L: 0, N: 0, P: 0, Q: 0, R: 0, S: 'None', T: 0, U: 0, V: 0, W: 0, X: 0, Y: 0, AP: 0, AU: 0, BM: 0 };
const NODES = [
  { no: '1', name: 'Control cabinet assembly', d: 0, st: 'done', n: { ...z, H: 2, E: 'NA', G: 'Not applicable', B: 'XP-1000', D: 'Assembly, control cabinet CC-40', AJ: 'Assembly row, nothing of its own' } },
  { no: '1.1', name: 'Base frame', d: 1, st: 'done', n: { ...z, H: 4, E: 'MS', G: 'Textured grey', B: 'XP-1101', D: 'Base frame, laser cut, 4 bends', J: 720, K: 480, L: 3, N: 5.6, P: 96, Q: 2300, R: 4, S: 'M6 insert nut', T: 4, U: 3.2, V: 2, W: 6, X: 2, Y: 0, flags: ['AA', 'AE'], BM: 2800, AJ: 'Deburr all edges' } },
  { no: '1.1.1', name: 'Corner gusset', d: 2, st: 'done', n: { ...z, H: 16, E: 'MS', G: 'Textured grey', B: 'XP-1111', D: 'Corner gusset', J: 120, K: 120, L: 3, N: 0.28, P: 12, Q: 260, R: 1, W: 2, flags: ['AE'], AJ: 'None' } },
  { no: '1.1.2', name: 'Cross brace', d: 2, st: 'done', n: { ...z, H: 8, E: 'MS', G: 'Textured grey', B: 'XP-1112', D: 'Cross brace', J: 420, K: 60, L: 2, N: 0.33, P: 20, Q: 640, R: 2, V: 1, flags: ['AE'], AJ: 'None' } },
  { no: '1.2', name: 'Side panel', d: 1, st: 'done', n: { ...z, H: 4, E: 'MS', G: 'Textured grey', B: 'XP-1102', D: 'Side panel', J: 900, K: 500, L: 1.5, N: 5.2, P: 140, Q: 3600, R: 4, W: 4, flags: ['AA', 'AE'], AJ: 'None' } },
  { no: '1.3', name: 'Door', d: 1, st: 'part', n: { ...z, H: 2, E: 'SS', G: 'Brushed finish', B: 'XP-1103', D: 'Door with window cut-out', J: 800, K: 450, L: 1.5, N: 4.1, P: 120, Q: 3000, R: 4, S: 'Hinge set', T: 2, U: 18.5, W: 6, Y: 2, flags: ['AC'], AP: 120, BM: 1500, AJ: 'Fit gasket after finish' } },
  { no: '1.4', name: 'Top cover', d: 1, st: 'done', n: { ...z, H: 2, E: 'MS', G: 'Textured grey', B: 'XP-1104', D: 'Top cover with vent opening', J: 600, K: 400, L: 1.5, N: 2.4, P: 80, Q: 2200, R: 4, W: 8, flags: ['AE'], AJ: 'None' } },
  { no: '1.4.1', name: 'Vent grille', d: 2, st: 'done', n: { ...z, H: 12, E: 'AL', G: 'Anodised natural', B: 'XP-1141', D: 'Vent grille, aluminium', J: 100, K: 80, L: 1.2, N: 0.02, P: 18, Q: 300, flags: ['AG'], AJ: 'None' } },
  { no: '2', name: 'Mounting bracket kit', d: 0, st: 'part', n: { ...z, H: 3, E: 'NA', G: 'Not applicable', B: 'XP-2000', D: 'Assembly, mounting bracket kit', AJ: 'Assembly row, nothing of its own' } },
  { no: '2.1', name: 'Bracket plate', d: 1, st: 'todo', n: { ...z, H: 3, E: 'MS', G: 'Textured grey', B: 'XP-2101', D: 'Bracket plate', J: 200, K: 100, L: 4, N: 0.55, P: 22, Q: 520, R: 2, flags: [], BM: 600, AJ: 'None' } },
];
NODES.forEach((x) => { x.o = calc(x.n); x.bg = x.o.BG; });
/* Quantity rule in force (settled by the delivery lead, AQP-26): the Engineer types the count for the WHOLE ORDER on every row
   (2 frames, 6 pipes, 24 lids). BG of a row already carries that count (BB = BA * H). BL is the sum of every row's BG.
   Nothing is multiplied down the tree. The comment below describes the superseded roll-up and is kept only as history.
   (Superseded) every level's quantity applies.
   BG of a row already carries that row's own H (BB = BA * H). BL multiplies each row's BG by the H of
   every row above it, and never applies a row's own H a second time.
   T(row) = BG(row) + H(row) * SUM(T(child)); the estimate total is the sum of T over the items.
   `sigma` is kept as the name of T(row): what a parent shows on screen (working ASSUMPTION-52, Q-35). */
const get = (no) => NODES.find((x) => x.no === no);
const children = (no) => NODES.filter((x) => x.no.startsWith(no + '.') && x.d === get(no).d + 1);
function descendants(no) { return NODES.filter((x) => x.no === no || x.no.startsWith(no + '.')); }
/* sigma = the figure a parent shows on screen: its own BG plus the BG of every row below it */
function sigma(no) { return descendants(no).reduce((s, x) => s + x.bg, 0); }
const ITEMS = NODES.filter((x) => x.d === 0);
const BL = ITEMS.reduce((s, it) => s + sigma(it.no), 0);
const TOOL = NODES.reduce((s, x) => s + x.n.BM, 0);
const BN = BL / TOOL;
const isParent = (no) => NODES.some((x) => x.no.startsWith(no + '.'));
/* The approved price used on SCR-06, 08, 10 and 16: the calculated total rounded down to a whole hundred (an override). */
const APPROVED = Math.floor(BL / 100) * 100;
const OVERRIDE_REASON = 'Rounded down to a whole hundred for the customer quote.';
/* Shown figure of a number, as a number (what a person adding the shown figures would use). */
const shown = (x) => Number(Number(x).toFixed(2));
/* Rounding case for a parent: the written-out sum from shown figures against the figure the portal shows. */
function roundCase(no) {
  const rows = descendants(no);
  if (rows.length < 2) return '';
  const byHand = rows.reduce((s, x) => s + shown(x.bg), 0);
  const real = shown(sigma(no));
  return Math.abs(byHand - real) > 0.004 ? { no, byHand: Number(byHand.toFixed(2)), real } : '';
}

function fmt(n, d = 2) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
const inr = (n) => '₹ ' + fmt(n);
const usd = (n) => '$ ' + fmt(n);
const eur = (n) => '€ ' + fmt(n);

/* ---------------- tasks (queue) ---------------- */
const TASKS = [
  { id: 'Q-2026-0311', title: 'Switchgear door set', eng: 'Arjun Rao', cust: 'Tamarind Switchgear', by: 'Kiran Bose', due: '03 Nov 2026, 17:00', over: '1 d 18 h', st: 'Draft', path: '\\\\fileserver\\rfq\\RFQ-2026-027' },
  { id: 'Q-2026-0314', title: 'Pump skid frame', eng: 'Divya Shah', cust: 'Ridgeline Pumps', by: 'Sunita Pillai', due: '04 Nov 2026, 12:00', over: '23 h', st: 'Draft', path: '\\\\fileserver\\rfq\\RFQ-2026-029' },
  { id: 'Q-2026-0318', title: 'Control cabinet CC-40', eng: 'Priya Nair', cust: 'Brightwater Controls', by: 'Kiran Bose', due: '06 Nov 2026, 17:00', st: 'Draft', path: '\\\\fileserver\\rfq\\RFQ-2026-031' },
  { id: 'Q-2026-0320', title: 'Hopper cover', eng: 'Arjun Rao', cust: null, by: 'Kiran Bose', due: '09 Nov 2026, 10:00', st: 'Draft', path: '\\\\fileserver\\rfq\\RFQ-2026-033' },
  { id: 'Q-2026-0322', title: 'Rail bracket family', eng: 'Priya Nair', cust: 'Orchid Rail Works', by: 'Kiran Bose', due: '12 Nov 2026, 15:30', st: 'Submitted', path: '\\\\fileserver\\rfq\\RFQ-2026-034' },
];

/* ---------------- page shell ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV = {
  engineer: [
    { g: 'Work', items: [{ id: 'queue', label: 'My tasks', icon: 'list', href: 'SCR-03-engineer.html' }] },
    { g: 'Help', items: [{ id: 'about', label: 'About', icon: 'info', href: 'SCR-24.html' }] },
  ],
  lead: [
    { g: 'Work', items: [{ id: 'queue', label: 'Task queue', icon: 'list', href: 'SCR-03.html' }, { id: 'assign', label: 'Assign task', icon: 'plus', href: 'SCR-04.html' }] },
    { g: 'Configuration', items: [{ id: 'fields', label: 'Fields and formulas', icon: 'sliders', href: 'SCR-17-lead.html', ro: 'View only' }] },
    { g: 'Help', items: [{ id: 'about', label: 'About', icon: 'info', href: 'SCR-24.html' }] },
  ],
  admin: [
    { g: 'Work', items: [{ id: 'queue', label: 'Task queue', icon: 'list', href: 'SCR-03.html' }, { id: 'assign', label: 'Assign task', icon: 'plus', href: 'SCR-04.html' }] },
    { g: 'Masters', items: [{ id: 'process', label: 'Process master', icon: 'db', href: 'SCR-11.html' }, { id: 'customers', label: 'Customers', icon: 'users', href: 'SCR-12.html' }, { id: 'materials', label: 'Materials and lists', icon: 'layers', href: 'SCR-13.html' }] },
    { g: 'Configuration', items: [{ id: 'fields', label: 'Fields and formulas', icon: 'sliders', href: 'SCR-17.html' }, { id: 'versions', label: 'Checkpoints', icon: 'history', href: 'SCR-21.html' }] },
    { g: 'Administration', items: [{ id: 'users', label: 'Users', icon: 'user', href: 'SCR-14.html' }, { id: 'settings', label: 'Settings', icon: 'mail', href: 'SCR-15.html' }, { id: 'audit', label: 'Audit log', icon: 'shield', href: 'SCR-16.html' }] },
    { g: 'Help', items: [{ id: 'about', label: 'About', icon: 'info', href: 'SCR-24.html' }] },
  ],
};
P.layers = '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>';

function sidebar(role, active) {
  let h = `<aside class="app-side" id="app-side" aria-label="Main menu"><nav class="side-nav" aria-label="Main">`;
  NAV[role].forEach((g) => {
    h += `<div class="side-label">${g.g}</div>`;
    g.items.forEach((i) => {
      h += `<a class="nav-item${i.id === active ? ' is-active' : ''}" href="${i.href}"${i.id === active ? ' aria-current="page"' : ''}>${icon(i.icon, 20)}<span>${i.label}</span>${i.ro ? `<span class="tag-ro">${i.ro}</span>` : ''}</a>`;
    });
  });
  h += `</nav><div class="side-foot">Version 1.0<br>&copy; Accucut Lasers Pvt Ltd</div></aside>`;
  return h;
}
/* The two first-open failure lines, word for word from UX spec SCR-25 (version 0.11; the solution-architect's wording,
   AQP-188 AC-8). */
const FO_TEXT = { acct: 'The account menu did not open. Check your connection and try again.', menu: 'The menu did not open. Check your connection and try again.' };
function topbar(role, opts = {}) {
  const u = PEOPLE[role];
  const bellHref = role === 'engineer' ? 'SCR-03-engineer.html#state=overdue' : 'SCR-03.html#state=overdue';
  const open = opts.menuOpen ? ' open' : '';
  /* First-open controls (UX 7.3.1 rule 11, SCR-25, AQP-188): only a page that passes firstOpen gets the wrappers, the
     busy hooks and the two failure lines, so every other page is built exactly as before. */
  const fo = !!opts.firstOpen;
  const failLine = (id, cls, show, text) => `<div class="fo-fail ${cls}" id="${id}" role="alert" data-show="${show}" hidden>${icon('alert', 16)}<span>${text}</span></div>`;
  const menuBtn = `<button class="btn btn-secondary btn-icon nav-toggle" type="button" data-toggle="nav-open" aria-controls="app-side" aria-expanded="false" aria-label="Open menu"${fo ? ' aria-haspopup="dialog" data-busy-when="menupending"' : ''}>${icon('menu', 20)}</button>`;
  const menuCtl = fo ? `<span class="fo-wrap fo-wrap-nav">${menuBtn}${failLine('fo-menu-fail', 'fo-fail-menu', 'menufailed', FO_TEXT.menu)}</span>` : menuBtn;
  return `<header class="topbar">
  ${menuCtl}
  <a class="brand" href="${role === 'engineer' ? 'SCR-03-engineer.html' : 'SCR-03.html'}" aria-label="Accucut Lasers, Quotation Portal, home">
    <img src="../assets/accucut-logo.jpg" width="56" height="56" alt="AccuCut logo">
    <span><span class="brand-name">ACCUCUT LASERS</span> <span class="brand-sub">Quotation Portal</span></span>
  </a>
  <span class="spacer"></span>
  <a class="bell" href="${bellHref}" aria-label="Overdue tasks: ${u.bell}">${icon('bell', 20)}<span class="count" aria-hidden="true">${u.bell}</span></a>
  ${fo ? '<span class="fo-wrap">' : ''}<details class="usermenu"${open}${fo ? ' data-open-in="default"' : ''}>
    <summary${fo ? ' aria-haspopup="menu" data-busy-when="acctpending"' : ''}><span class="avatar" aria-hidden="true">${u.initials}</span><span class="um-text"><span class="t-body t-strong" style="display:block;line-height:16px">${u.name}</span> <span class="t-label t-muted" style="display:block">${u.role}</span></span><span class="um-chev">${icon('down', 16)}</span><span class="sr-only"> account menu</span></summary>
    <div class="menu-panel" role="menu" aria-label="Account">
      <div class="menu-head"><div class="t-body t-strong">${u.name}</div><div class="t-label t-muted">${u.email}</div><div class="t-label t-muted">${u.role}</div></div>
      <a class="menu-item" role="menuitem" href="SCR-23.html">${icon('key', 18)} Change password</a>
      <a class="menu-item" role="menuitem" href="SCR-01.html">${icon('logout', 18)} Sign out</a>
    </div>
  </details>${fo ? failLine('fo-acct-fail', 'fo-fail-acct', 'acctfailed', FO_TEXT.acct) + '</span>' : ''}
</header>`;
}

function reviewBar(m) {
  const sts = m.states && m.states.length > 1 ? `<span class="rb-states" role="group" aria-label="Screen state"></span>` : '';
  return `<div class="review-bar" role="region" aria-label="Review information, not part of the product">
  <a href="index.html">${icon('arrowleft', 14)} All screens</a>
  <span class="rb-id">${m.id}</span><strong>${esc(m.name)}</strong>
  <span>Role: ${m.roleLabel || 'all'} &middot; ${m.release || 'R1'} &middot; ${m.frs || ''}</span>
  ${sts}
  <span style="margin-left:auto">Review mock-up &middot; fictional data</span>
</div>`;
}

function page(m) {
  /* m: id, file, name, title, desc, role, active, states, release, frs, roleLabel, body, noShell, bodyClass, menuOpen, robots,
     bases (overlay states that reuse another state's content, e.g. 'qtywarn=cleared': a dialog shown over that state) */
  const title = `${m.title || m.name} · Accucut Quotation Portal`;
  if (title.length > 60) console.warn('TITLE >60', m.id, title.length);
  if (m.desc.length > 160) console.warn('DESC >160', m.id, m.desc.length);
  const statesAttr = (m.states || ['default']).join(',');
  const robots = m.robots || 'noindex, nofollow';
  const head = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(m.desc)}">
<meta name="robots" content="${robots}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Accucut Quotation Portal">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(m.desc)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="../assets/accucut-logo.jpg">
<link rel="stylesheet" href="screens.css">
<script src="screens.js" defer></script>
</head>
<body data-states="${statesAttr}"${m.bases ? ` data-bases="${m.bases}"` : ''}${m.bodyClass ? ` class="${m.bodyClass}"` : ''}>
<a class="skip-link" href="#main">Skip to main content</a>
${reviewBar(m)}
`;
  let inner;
  if (m.noShell) inner = m.body;
  else {
    inner = `<div class="app${m.noSide ? ' no-side' : ''}">
${topbar(m.role, { menuOpen: m.menuOpen, firstOpen: m.firstOpen })}
${m.noSide ? '' : sidebar(m.role, m.active)}
<div class="nav-scrim" data-scrim="nav-open"></div>
<div class="app-main">
${m.body}
</div>
</div>`;
  }
  /* A table that can scroll sideways is a focusable, named region, so a keyboard user can scroll it (axe: scrollable-region-focusable) */
  const scrollable = (html) => html.replace(/<(div|section)( class="[^"]*\btable-wrap\b[^"]*")((?:(?!tabindex)[^>])*)>(\s*<table[^>]*>)(<caption class="sr-only">([^<]*)<\/caption>)?/g,
    (m, tag, cls, rest, tbl, cap, capText) => `<${tag}${cls}${rest} tabindex="0" role="region" aria-label="${(capText || 'Table').replace(/"/g, '')}, scrollable">${tbl}${cap || ''}`);
  const out = scrollable(head + inner + `\n<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>\n</body>\n</html>\n`);
  fs.writeFileSync(OUT + m.file, out);
  return m;
}

/* ---------------- component helpers ---------------- */
const badge = (kind, text, ic) => `<span class="badge badge-${kind}">${ic ? icon(ic, 12) : ''}${text}</span>`;
const STATUS = {
  Draft: () => badge('neutral', 'Draft', 'edit'),
  Submitted: () => badge('info', 'Submitted', 'send'),
  Approved: () => badge('success', 'Approved and locked', 'lock'),
};
const notice = (kind, ic, html, role) => `<div class="notice notice-${kind}"${role ? ` role="${role}"` : ''}>${icon(ic, 18)}<div class="notice-body">${html}</div></div>`;
function crumbs(list) {
  return `<nav aria-label="Breadcrumb" class="row t-body">` + list.map((c, i) => (i === list.length - 1 ? `<span class="t-strong" aria-current="page">${c[0]}</span>` : `<a href="${c[1]}">${c[0]}</a><span class="t-muted" aria-hidden="true">/</span>`)).join('') + `</nav>`;
}
function pageHead({ title, sub, actions = '', badgeHtml = '', eyebrow = '' }) {
  return `<div class="page-head"><div class="stack-sm">${eyebrow ? `<span class="t-label t-caps t-muted">${eyebrow}</span>` : ''}<div class="row"><h1 class="t-heading">${title}</h1>${badgeHtml}</div>${sub ? `<p class="t-body t-muted">${sub}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;
}
function field({ id, label, col, type = 'text', value = '', unit = '', hint = '', error = '', auto = false, wide = false, placeholder = '', ro = false, mode = '', required = true, extra = '' }) {
  const tag = col ? ` <span class="col-tag${auto ? ' is-auto' : ''}"><span class="sr-only">Excel column </span>${col}</span>` : '';
  const hid = hint ? `${id}-h` : '', eid = error ? `${id}-e` : '';
  const desc = [hid, eid].filter(Boolean).join(' ');
  const attrs = `id="${id}" name="${id}"${desc ? ` aria-describedby="${desc}"` : ''}${error ? ' aria-invalid="true"' : ''}${required ? ' required' : ''}${ro ? ' readonly' : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}${mode ? ` inputmode="${mode}"` : ''}${extra ? ' ' + extra : ''}`;
  let control;
  if (auto) control = `<div class="output" id="${id}">${esc(value)}<span class="t-label t-faint" style="margin-left:auto">Auto</span></div>`;
  else if (unit) control = `<div class="input-group"><input class="input${error ? ' is-error' : ''}" type="text" ${attrs} value="${esc(value)}"><span class="addon">${unit}</span></div>`;
  else control = `<input class="input${error ? ' is-error' : ''}" type="${type}" ${attrs} value="${esc(value)}">`;
  return `<div class="field${wide ? ' field-wide' : ''}"><label class="field-label" for="${id}">${label}${tag}</label>${control}${hint ? `<span class="field-hint" id="${hid}">${hint}</span>` : ''}${error ? `<span class="field-error" id="${eid}">${icon('alertc', 14)}<span>${error}</span></span>` : ''}</div>`;
}
function selectField({ id, label, col, options, value, hint = '', error = '', wide = false, required = true }) {
  const tag = col ? ` <span class="col-tag"><span class="sr-only">Excel column </span>${col}</span>` : '';
  const hid = hint ? `${id}-h` : '', eid = error ? `${id}-e` : '';
  const desc = [hid, eid].filter(Boolean).join(' ');
  return `<div class="field${wide ? ' field-wide' : ''}"><label class="field-label" for="${id}">${label}${tag}</label><select class="select${error ? ' is-error' : ''}" id="${id}" name="${id}"${required ? ' required' : ''}${desc ? ` aria-describedby="${desc}"` : ''}${error ? ' aria-invalid="true"' : ''}>${options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>${hint ? `<span class="field-hint" id="${hid}">${hint}</span>` : ''}${error ? `<span class="field-error" id="${eid}">${icon('alertc', 14)}<span>${error}</span></span>` : ''}</div>`;
}
function stIcon(st) {
  const m = { done: ['checkc', 'st-done', 'Complete'], part: ['half', 'st-part', 'In progress'], todo: ['circle', 'st-todo', 'Not started'], miss: ['alert', 'st-miss', 'Missing data'] };
  const x = m[st];
  return `<span class="st ${x[1]}" role="img" aria-label="${x[2]}">${icon(x[0], 18)}</span>`;
}
function skeletonRows(n, cols = 4) {
  let h = '';
  for (let i = 0; i < n; i++) h += `<div class="sk-row">${Array.from({ length: cols }, (_, k) => `<span class="skeleton sk-line" style="flex:${k === 0 ? 2 : 1}"></span>`).join('')}</div>`;
  return h;
}
function emptyState({ ic = 'list', title, text, action = '' }) {
  return `<div class="empty"><span class="empty-ic">${icon(ic, 28)}</span><h2 class="t-sub">${title}</h2><p class="t-body t-muted">${text}</p>${action}</div>`;
}
function reviewNote(html) { return `<div class="review-note"><strong>Review note.</strong> ${html}</div>`; }
function pathLink(path, small = false) {
  const href = 'file:///' + path.replace(/^\\\\/, '').replace(/\\/g, '/');
  return `<span class="row" style="gap:var(--s-2)"><a class="mono" href="${esc(href)}">${esc(path)}</a><span class="tip"><button class="btn btn-secondary${small ? '' : ''}" type="button" data-copy="${esc(path)}" aria-describedby="tip-copy" style="height:36px">${icon('copy', 16)}<span class="copy-label">Copy path</span></button></span></span>`;
}
const TIP_COPY = 'Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer.';


/* Password rule (their answer, AQP-1 10490, D-19): 10 to 128 characters, at least one number and one symbol,
   not the e-mail address, not a common password. A symbol is any character that is not a letter or a number (ASSUMPTION-56). */
const PW = {
  hint: 'At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %.',
  short: 'The new password must be at least 10 characters.',
  long: 'Use 128 characters or fewer.',
  both: 'Add at least one number and one symbol, such as ! # $ or %.',
  number: 'Add at least one number.',
  symbol: 'Add at least one symbol, such as ! # $ or %.',
  common: 'That password is too common. Choose a different one.',
  same: 'The password cannot be the same as your e-mail address.',
  sameUser: "The password cannot be the same as the user's e-mail address.",
};

module.exports = { PW, SIG, ARR, OUT, fs, icon, P, PEOPLE, RATES, MAT, FX, TREAT, TCOL, NODES, ITEMS, BL, TOOL, BN, sigma, descendants, children, APPROVED, OVERRIDE_REASON, shown, roundCase, isParent, get, calc, fmt, inr, usd, eur, TASKS, NOW, esc, page, badge, STATUS, notice, crumbs, pageHead, field, selectField, stIcon, skeletonRows, emptyState, reviewNote, pathLink, TIP_COPY, sidebar, topbar, FO_TEXT };
