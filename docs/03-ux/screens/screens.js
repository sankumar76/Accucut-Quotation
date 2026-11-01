/* Review mock-up behaviour. No dependencies, no build step, nothing is sent anywhere.
   - Review toolbar: switch between the states a screen can be in (hash: #state=empty).
   - #embed=1 hides the review toolbar (used by the phone and tablet frames).
   - Small interactions the spec describes: Enter moves to the next field, Copy path,
     menu drawer, parts-tree drawer, tabs, show/hide password, resizable tree.
   Production behaviour is specified in ux-spec.md; this file is not production code. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;

  function params() {
    var out = {};
    (location.hash || '').replace(/^#/, '').split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) out[kv[0]] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  /* ---- States ---- */
  var states = [];
  function applyState(name) {
    root.setAttribute('data-state', name);
    doc.querySelectorAll('[data-show]').forEach(function (el) {
      var tokens = el.getAttribute('data-show').split(/\s+/);
      el.hidden = tokens.indexOf(name) === -1 && tokens.indexOf('*') === -1;
    });
    doc.querySelectorAll('[data-hide]').forEach(function (el) {
      var tokens = el.getAttribute('data-hide').split(/\s+/);
      el.hidden = tokens.indexOf(name) !== -1;
    });
    /* Fields that show as empty and invalid in a given state (data-error-in="error"). */
    doc.querySelectorAll('[data-error-in]').forEach(function (el) {
      var on = el.getAttribute('data-error-in').split(/s+/).indexOf(name) !== -1;
      if (el.__orig === undefined) el.__orig = el.tagName === 'SELECT' ? el.selectedIndex : el.value;
      if (el.tagName === 'SELECT') el.selectedIndex = on ? 0 : el.__orig; else el.value = on ? '' : el.__orig;
      el.classList.toggle('is-error', on);
      if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
    doc.querySelectorAll('fieldset[data-lock]').forEach(function (fs) {
      fs.disabled = fs.getAttribute('data-lock').split(/s+/).indexOf(name) !== -1;
    });
    doc.querySelectorAll('[data-tab-for]').forEach(function (t) {
      var on = t.getAttribute('data-tab-for').split(/s+/).indexOf(name) !== -1;
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.classList.toggle('is-active', on);
    });
    doc.querySelectorAll('.rb-states button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-state') === name ? 'true' : 'false');
    });
    doc.querySelectorAll('[aria-busy-when]').forEach(function (el) {
      el.setAttribute('aria-busy', el.getAttribute('aria-busy-when').split(/\s+/).indexOf(name) !== -1 ? 'true' : 'false');
    });
  }
  function initStates() {
    var holder = doc.querySelector('.rb-states');
    var listed = (doc.body.getAttribute('data-states') || 'default').split(',');
    states = listed.map(function (s) { var p = s.split(':'); return { key: p[0].trim(), label: (p[1] || p[0]).trim() }; });
    if (holder) {
      holder.textContent = '';
      states.forEach(function (s) {
        var b = doc.createElement('button');
        b.type = 'button'; b.setAttribute('data-state', s.key); b.textContent = s.label;
        b.addEventListener('click', function () { history.replaceState(null, '', '#state=' + s.key + (params().embed ? '&embed=1' : '')); applyState(s.key); });
        holder.appendChild(b);
      });
    }
    var want = params().state || states[0].key;
    applyState(want);
  }

  /* ---- Layout toggles ---- */
  function initToggles() {
    doc.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cls = btn.getAttribute('data-toggle');
        var on = root.classList.toggle(cls);
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    });
    doc.querySelectorAll('[data-scrim]').forEach(function (el) {
      el.addEventListener('click', function () {
        root.classList.remove(el.getAttribute('data-scrim'));
        doc.querySelectorAll('[data-toggle="' + el.getAttribute('data-scrim') + '"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      });
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { root.classList.remove('nav-open', 'tree-open'); }
    });
    if (params().drawer === 'nav') root.classList.add('nav-open');
    if (params().drawer === 'tree') root.classList.add('tree-open');
    if (params().drawing === '1') root.classList.add('show-drawing-slot');
  }

  /* ---- Tabs ---- */
  function initTabs() {
    doc.querySelectorAll('[data-tabs]').forEach(function (group) {
      var tabs = group.querySelectorAll('[role="tab"]');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function (e) {
          if (tab.tagName === 'A' && tab.getAttribute('href') && tab.getAttribute('href').charAt(0) !== '#') return;
          e.preventDefault();
          tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); t.classList.toggle('is-active', t === tab); t.tabIndex = t === tab ? 0 : -1; });
          var scope = doc.querySelector(group.getAttribute('data-tabs'));
          (scope || doc).querySelectorAll('[role="tabpanel"]').forEach(function (p) { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
        });
        tab.addEventListener('keydown', function (e) {
          var arr = Array.prototype.slice.call(tabs), i = arr.indexOf(tab);
          if (e.key === 'ArrowRight') { arr[(i + 1) % arr.length].focus(); arr[(i + 1) % arr.length].click(); }
          if (e.key === 'ArrowLeft') { arr[(i - 1 + arr.length) % arr.length].focus(); arr[(i - 1 + arr.length) % arr.length].click(); }
        });
      });
    });
  }

  /* ---- Enter moves to the next field (FR-046) ---- */
  function initEnterNext() {
    doc.querySelectorAll('form.guided-form').forEach(function (form) {
      form.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        var t = e.target;
        var tag = t.tagName;
        if (tag === 'BUTTON' || tag === 'A' || t.type === 'submit' || t.type === 'button') return;
        if (tag === 'TEXTAREA' && e.shiftKey) return;           /* Shift+Enter = new line in Remarks */
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
        e.preventDefault();
        var fields = Array.prototype.slice.call(form.querySelectorAll('input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'))
          .filter(function (el) { return el.offsetParent !== null; });
        var i = fields.indexOf(t);
        var next = fields[i + 1];
        if (next) next.focus(); else { var sv = doc.querySelector('[data-after-last]'); if (sv) sv.focus(); }
      });
    });
  }

  /* ---- Copy path (FR-033) ---- */
  function initCopy() {
    doc.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        var done = function () {
          var live = doc.getElementById('live-region');
          if (live) { live.textContent = 'Path copied to the clipboard.'; setTimeout(function () { live.textContent = ''; }, 3000); }
          var old = btn.getAttribute('data-label') || btn.textContent;
          btn.setAttribute('data-label', old);
          var span = btn.querySelector('.copy-label');
          if (span) { span.textContent = 'Copied'; setTimeout(function () { span.textContent = old.trim(); }, 1800); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); } else { done(); }
      });
    });
  }

  /* ---- Show / hide password ---- */
  function initPassword() {
    doc.querySelectorAll('[data-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = doc.getElementById(btn.getAttribute('data-reveal'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ---- Resizable tree panel (desktop) ---- */
  function initResize() {
    var handle = doc.querySelector('.tree-handle');
    var ws = doc.querySelector('.ws');
    if (!handle || !ws) return;
    var min = 240, max = 400;
    function set(w) { w = Math.max(min, Math.min(max, w)); ws.style.setProperty('--tree-w', w + 'px'); handle.setAttribute('aria-valuenow', Math.round(w)); }
    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var startX = e.clientX, startW = ws.querySelector('.ws-tree').getBoundingClientRect().width;
      function move(ev) { set(startW + ev.clientX - startX); }
      function up() { doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', up); }
      doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', up);
    });
    handle.addEventListener('keydown', function (e) {
      var w = ws.querySelector('.ws-tree').getBoundingClientRect().width;
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(w - 16); }
      if (e.key === 'ArrowRight') { e.preventDefault(); set(w + 16); }
    });
  }

  /* ---- Surface treatment multi-select (FR-049) ---- */
  function initMulti() {
    doc.querySelectorAll('[data-multiselect]').forEach(function (btn) {
      var panel = doc.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = panel.hidden;
        panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      panel.addEventListener('change', function () {
        var boxes = panel.querySelectorAll('input[type=checkbox]'), count = 0;
        btn.textContent = '';
        boxes.forEach(function (b) {
          if (!b.checked) return;
          count++;
          var chip = doc.createElement('span'); chip.className = 'chip is-on';
          chip.appendChild(doc.createTextNode(b.getAttribute('data-name') + ' '));
          var col = doc.createElement('span'); col.className = 't-mono'; col.textContent = b.getAttribute('data-col') + ' = 1';
          chip.appendChild(col); btn.appendChild(chip);
        });
        if (!count) { var ph = doc.createElement('span'); ph.className = 'placeholder'; ph.textContent = 'None selected (all eight = 0)'; btn.appendChild(ph); }
      });
    });
  }

  /* Cost stages: on phones only the first stage starts open (accordion), as specified for SCR-07. */
  function initStages() {
    if (window.innerWidth >= 768) return;
    doc.querySelectorAll('details.stage').forEach(function (d, i) { if (i > 0) d.open = false; });
  }

  /* Treatment / Color: choosing "Other" reveals a text box (FR-050). */
  function initOther() {
    doc.querySelectorAll('select[data-other]').forEach(function (sel) {
      var box = doc.getElementById(sel.getAttribute('data-other'));
      function sync() { box.hidden = sel.value !== 'Other'; }
      sel.addEventListener('change', sync); sync();
    });
  }

  function init() {
    if (params().embed) root.classList.add('is-embed');
    initStates(); initToggles(); initTabs(); initEnterNext(); initCopy(); initPassword(); initResize(); initMulti(); initStages(); initOther();
    window.addEventListener('hashchange', function () {
      if (params().embed) root.classList.add('is-embed');
      applyState(params().state || states[0].key);
      if (params().drawer === 'nav') root.classList.add('nav-open'); else if ('drawer' in params()) root.classList.remove('nav-open');
      if (params().drawer === 'tree') root.classList.add('tree-open'); else if ('drawer' in params()) root.classList.remove('tree-open');
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
