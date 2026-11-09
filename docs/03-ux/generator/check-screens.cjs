'use strict';
/* Checks on the review screens in ../screens/ (see README.md in this folder).
   Needs two packages that are NOT dependencies of this repository: playwright-core and axe-core,
   and a Chrome or Chromium on the machine. Point to them with:
     QA_MODULES  folder whose node_modules holds playwright-core and axe-core (default: current folder)
     CHROME_PATH full path of chrome.exe or chromium (default: Playwright's own lookup)
     SCREENS_DIR screens folder to check (default: ../screens)
   Run:  node docs/03-ux/generator/check-screens.cjs [--pages SCR-06.html,SCR-10.html] [--no-axe]
   Prints one line per problem and a summary; exit code 1 if any problem. */
const fs = require('fs');
const path = require('path');

const mods = [process.env.QA_MODULES || process.cwd()];
const { chromium } = require(require.resolve('playwright-core', { paths: mods }));
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: mods }), 'utf8');
const dir = path.resolve(process.env.SCREENS_DIR || path.join(__dirname, '..', 'screens'));
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const only = arg('--pages') ? arg('--pages').split(',') : null;
const useAxe = !process.argv.includes('--no-axe');
const WIDTHS = [[360, 800], [768, 1024], [1280, 800]];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && (!only || only.includes(f)));
const url = (f, st) => 'file:///' + dir.replace(/\\/g, '/') + '/' + f + (st ? '#state=' + st : '');

/* Engineer pages must show no amount, rate, formula or price (FR-008). Review notes are excluded. */
const ENGINEER = ['SCR-01.html', 'SCR-02.html', 'SCR-03-engineer.html', 'SCR-05.html', 'SCR-23.html', 'SCR-24.html', 'SCR-26.html'];
const FORBID = /(₹\s?\d|\$\s?\d|€\s?\d|\bBG\b|\bBL\b|\bBN\b|\bBO\b|\bBJ\b|\bBK\b|Material Rate|exchange rate|formula|\brate\b|\bprice\b|unit production|screen figure|Excel row)/i;

(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const problems = []; const axeAgg = {}; let loads = 0;
  for (const f of files) {
    const isDev = /-(phone|tablet)\.html$/.test(f);
    const probe = await b.newPage(); await probe.goto(url(f));
    const states = (await probe.evaluate(() => document.body.getAttribute('data-states') || 'default')).split(',').map((s) => s.split(':')[0]);
    await probe.close();
    for (const [w, h] of WIDTHS) {
      if (isDev && w !== 1280) continue;
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error' && !/CORS|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      for (const st of (isDev ? ['default'] : states)) {
        await p.goto(url(f, st)); await p.reload(); await p.waitForTimeout(80); loads++;
        const r = await p.evaluate(() => {
          const de = document.documentElement; const bad = [];
          document.querySelectorAll('body *').forEach((el) => { const q = el.getBoundingClientRect(); if (q.width && q.right > de.clientWidth + 1 && !el.closest('.table-wrap,.stepper,.tabs,[hidden],.device,.device-frame,.sr-only')) bad.push(el.tagName + '.' + String(el.className).slice(0, 30)); });
          return { over: de.scrollWidth - de.clientWidth, bad: bad.slice(0, 3) };
        });
        if (r.over > 1) problems.push(`OVERFLOW ${f} state=${st} w=${w}: page +${r.over}px ${r.bad.join(' | ')}`);
        if (useAxe && !isDev) {
          await p.addScriptTag({ content: axeSrc });
          const ax = await p.evaluate(async () => { const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }); return res.violations.map((v) => ({ id: v.id, n: v.nodes.length, ex: v.nodes[0] && v.nodes[0].target.join(' ').slice(0, 80) })); });
          ax.forEach((v) => { const k = `${f} ${v.id} w=${w}`; axeAgg[k] = axeAgg[k] || { ...v, states: [] }; axeAgg[k].states.push(st); });
        }
        if (ENGINEER.includes(f) && w === 1280) {
          const txt = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('script,style,.review-note,.review-bar,[hidden],.sr-only').forEach((e) => e.remove()); return c.innerText; });
          const m = txt.match(FORBID); if (m) problems.push(`ENGINEER-TEXT ${f} state=${st}: "${m[0]}"`);
        }
      }
      if (errs.length) problems.push(`SCRIPT-ERRORS ${f} w=${w}: ${[...new Set(errs)].slice(0, 2).join(' | ')}`);
      await ctx.close();
    }
  }
  /* Masters tables (ux-spec 6.0, DEF-021): at every width from 768 to 1440 px, with the region at its start and at its far end, every row action of a
     table.is-master lies inside the visible region. Run again with the table forced wider than any region (1000 px) to prove the sticky column, not the fit. */
  const MT_WIDTHS = [768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440];
  let mtChecks = 0;
  for (const f of (process.argv.includes('--skip-masters') ? [] : files).filter((x) => !/-(phone|tablet)\.html$/.test(x) && /is-master/.test(fs.readFileSync(path.join(dir, x), 'utf8')))) {
    const probe = await b.newPage(); await probe.goto(url(f));
    const states = (await probe.evaluate(() => document.body.getAttribute('data-states') || 'default')).split(',').map((s) => s.split(':')[0]);
    await probe.close();
    for (const w of MT_WIDTHS) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
      const p = await ctx.newPage();
      for (const st of states) for (const stress of [0, 1000]) {
        await p.goto(url(f, st)); await p.reload(); await p.waitForTimeout(40); mtChecks++;
        const r = await p.evaluate((stressPx) => {
          const out = [];
          document.querySelectorAll('.table-wrap.is-master').forEach((wrap) => {
            if (!wrap.offsetParent || wrap.closest('[hidden],.modal')) return;
            if (stressPx) wrap.querySelector('table').style.minWidth = stressPx + 'px';
            for (const at of [0, 99999]) {
              wrap.scrollLeft = at; const q = wrap.getBoundingClientRect();
              wrap.querySelectorAll('.col-actions .btn').forEach((x) => { const bb = x.getBoundingClientRect(); if (bb.width && (bb.left < q.left - 0.5 || bb.right > q.right + 0.5)) out.push((x.getAttribute('aria-label') || '').slice(0, 30) + ' scrollLeft=' + at); });
            }
          });
          return out.slice(0, 2);
        }, stress);
        if (r.length) problems.push(`TABLE-ACTIONS ${f} state=${st} w=${w}${stress ? ' stressed' : ''}: outside the region: ${r.join(' | ')}`);
      }
      await ctx.close();
    }
  }
  await b.close();
  Object.entries(axeAgg).forEach(([k, v]) => problems.push(`AXE ${k}: ${v.n} node(s), states ${[...new Set(v.states)].join(',')}, e.g. ${v.ex}`));
  problems.forEach((x) => console.log(x));
  console.log(`checked ${files.length} pages, ${loads} page-state loads at ${WIDTHS.map((x) => x[0]).join('/')} px; axe ${useAxe ? 'on' : 'off'}; masters-table action checks: ${mtChecks} loads at ${MT_WIDTHS.length} widths from ${MT_WIDTHS[0]} to ${MT_WIDTHS[MT_WIDTHS.length - 1]} px; problems: ${problems.length}`);
  process.exit(problems.length ? 1 : 0);
})();
