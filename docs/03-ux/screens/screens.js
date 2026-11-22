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
  /* An overlay state (body data-bases="qtywarn=cleared") shows the content of its base state and also
     the elements that name the overlay, for example a dialog over the Total cleared screen. */
  var bases = {};
  (doc.body.getAttribute('data-bases') || '').split(',').forEach(function (p) { var kv = p.split('='); if (kv[1]) bases[kv[0].trim()] = kv[1].trim(); });
  function applyState(overlay) {
    var name = bases[overlay] || overlay;
    root.setAttribute('data-state', name);
    root.setAttribute('data-overlay', overlay); // the overlay's own name, for CSS that draws only that state (CR-01 drag)
    doc.querySelectorAll('[data-show]').forEach(function (el) {
      var tokens = el.getAttribute('data-show').split(/\s+/);
      el.hidden = tokens.indexOf(name) === -1 && tokens.indexOf(overlay) === -1 && tokens.indexOf('*') === -1;
    });
    doc.querySelectorAll('[data-hide]').forEach(function (el) {
      var tokens = el.getAttribute('data-hide').split(/\s+/);
      var hit = tokens.indexOf(name) !== -1 || tokens.indexOf(overlay) !== -1;
      /* an element with both attributes is shown when data-show matches and data-hide does not */
      el.hidden = el.hasAttribute('data-show') ? (el.hidden || hit) : hit;
    });
    /* Fields that show as empty and invalid in a given state (data-error-in="error"). */
    doc.querySelectorAll('[data-error-in]').forEach(function (el) {
      var on = el.getAttribute('data-error-in').split(/\s+/).indexOf(name) !== -1;
      if (el.__orig === undefined) el.__orig = el.tagName === 'SELECT' ? el.selectedIndex : el.value;
      if (el.tagName === 'SELECT') el.selectedIndex = on ? 0 : el.__orig; else el.value = on ? '' : el.__orig;
      el.classList.toggle('is-error', on);
      if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
    doc.querySelectorAll('fieldset[data-lock]').forEach(function (fs) {
      fs.disabled = fs.getAttribute('data-lock').split(/\s+/).indexOf(name) !== -1;
    });
    doc.querySelectorAll('[data-tab-for]').forEach(function (t) {
      var on = t.getAttribute('data-tab-for').split(/\s+/).indexOf(name) !== -1;
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.classList.toggle('is-active', on);
    });
    /* The safe button of a dialog takes focus when the dialog shows (not inside a device frame: the browser blocks it there). */
    if (window.top === window) {
      var dlgBtn = doc.querySelector('.backdrop:not([hidden]) [data-autofocus]');
      if (dlgBtn) dlgBtn.focus();
    }
    doc.querySelectorAll('.rb-states button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-state') === overlay ? 'true' : 'false');
    });
    /* A details element that is open in some states only (SCR-25: the account menu is open in its default state, closed while the first-open states are shown). */
    doc.querySelectorAll('[data-open-in]').forEach(function (el) {
      el.open = el.getAttribute('data-open-in').split(/\s+/).indexOf(name) !== -1;
    });
    /* A menu button whose menu is drawn open in some states only (CR-01: the "+" of a parts-tree row, state "addmenu"). */
    doc.querySelectorAll('[data-expanded-in]').forEach(function (el) {
      var t = el.getAttribute('data-expanded-in').split(/\s+/);
      el.setAttribute('aria-expanded', t.indexOf(name) !== -1 || t.indexOf(overlay) !== -1 ? 'true' : 'false');
    });
    doc.querySelectorAll('[data-busy-when]').forEach(function (el) {
      el.setAttribute('aria-busy', el.getAttribute('data-busy-when').split(/\s+/).indexOf(name) !== -1 ? 'true' : 'false');
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

  /* Measured sticky offsets (WCAG 2.4.11): the top and bottom space that a focused field must stay clear of
     is read from the real bars, not fixed, because the phone action bar wraps and is taller than a desktop one. */
  function initSticky() {
    function measure() {
      var top = 0, bottom = 0;
      var tb = doc.querySelector('.topbar'); if (tb && getComputedStyle(tb).position === 'sticky') top += tb.getBoundingClientRect().height;
      var st = doc.querySelector('.stepper'); if (st && st.offsetParent !== null) top += st.getBoundingClientRect().height;
      var ab = doc.querySelector('.actionbar'); if (ab && ab.offsetParent !== null) bottom += ab.getBoundingClientRect().height;
      root.style.setProperty('--sticky-top', Math.ceil(top + 8) + 'px');
      root.style.setProperty('--sticky-bottom', Math.ceil(bottom + 8) + 'px');
    }
    measure();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measure);
      ['.topbar', '.stepper', '.actionbar'].forEach(function (s) { var e = doc.querySelector(s); if (e) ro.observe(e); });
    }
    window.addEventListener('resize', measure);
    window.addEventListener('hashchange', function () { setTimeout(measure, 0); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Tab') setTimeout(function () { var a = doc.activeElement; if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' }); }, 0); });
  }

  /* ---- Parts tree: an arrow opens or closes a branch (CR-01). A row is hidden while any row above it is closed. ---- */
  function initTree() {
    doc.querySelectorAll('.tree-twist[data-twist]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^(Open|Close) /, open ? 'Close ' : 'Open '));
        var list = btn.closest('ul');
        var closed = [];
        list.querySelectorAll('.tree-twist[aria-expanded="false"]').forEach(function (t) { closed.push(t.getAttribute('data-twist') + '.'); });
        list.querySelectorAll('.tree-row').forEach(function (li) {
          var no = li.getAttribute('data-no');
          li.hidden = closed.some(function (p) { return no.indexOf(p) === 0; });
        });
      });
    });

    /* Reorder (CR-01): a row moves with everything under it, only among rows with the same parent; then every row is
       renumbered from its place in the list. Drag the row, or use its move button: Move up / Move down. */
    var rows = function (list) { return Array.prototype.slice.call(list.querySelectorAll('.tree-row')); };
    var parentOf = function (no) { return no.indexOf('.') === -1 ? '' : no.slice(0, no.lastIndexOf('.')); };
    var block = function (li) {
      var no = li.getAttribute('data-no');
      return rows(li.parentNode).filter(function (r) { var n = r.getAttribute('data-no'); return n === no || n.indexOf(no + '.') === 0; });
    };
    var sibling = function (li, dir) {
      var no = li.getAttribute('data-no'), p = parentOf(no);
      var sibs = rows(li.parentNode).filter(function (r) { var n = r.getAttribute('data-no'); return n !== no ? parentOf(n) === p : true; });
      return sibs[sibs.indexOf(li) + dir] || null;
    };
    function renumber(list) {
      var count = [];
      rows(list).forEach(function (li) {
        var d = parseInt(li.style.getPropertyValue('--lvl'), 10) || 0;
        count[d] = (count[d] || 0) + 1; count.length = d + 1;
        var old = li.getAttribute('data-no'), no = count.join('.');
        if (old === no) return;
        var re = new RegExp('(^|\\s)' + old.replace(/\./g, '\\.') + '(?=\\s|$)');
        li.setAttribute('data-no', no);
        li.querySelector('.tree-no').textContent = no;
        li.querySelectorAll('[aria-label],[title]').forEach(function (el) {
          ['aria-label', 'title'].forEach(function (a) { if (el.hasAttribute(a)) el.setAttribute(a, el.getAttribute(a).replace(re, '$1' + no)); });
        });
        li.querySelectorAll('[data-twist],[data-move],[data-del]').forEach(function (el) {
          ['data-twist', 'data-move', 'data-del'].forEach(function (a) { if (el.hasAttribute(a)) el.setAttribute(a, no); });
        });
      });
    }
    function place(li, target, after) {
      var list = li.parentNode, moving = block(li), tb = block(target);
      var ref = after ? tb[tb.length - 1].nextSibling : target;
      moving.forEach(function (r) { list.insertBefore(r, ref); });
      renumber(list);
      var live = doc.getElementById('live-region');
      if (live) live.textContent = 'Moved. Now ' + li.getAttribute('data-no') + ' ' + li.querySelector('.tree-name').textContent + '.';
    }
    var locked = function () { return /^(submitted|approved)$/.test(root.getAttribute('data-state') || ''); };

    doc.querySelectorAll('ul.tree').forEach(function (list) {
      var dragged = null;
      var clear = function () { rows(list).forEach(function (r) { r.classList.remove('drop-before', 'drop-after', 'is-dragging'); }); };
      list.addEventListener('dragstart', function (e) {
        var li = e.target.closest && e.target.closest('.tree-row[draggable]');
        if (!li || locked()) { e.preventDefault(); return; }
        dragged = li; block(li).forEach(function (r) { r.classList.add('is-dragging'); });
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.getAttribute('data-no'));
      });
      list.addEventListener('dragover', function (e) {
        var t = e.target.closest && e.target.closest('.tree-row');
        if (!dragged || !t || t === dragged || block(dragged).indexOf(t) !== -1) return;
        if (parentOf(t.getAttribute('data-no')) !== parentOf(dragged.getAttribute('data-no'))) return; // same parent only
        e.preventDefault();
        var r = t.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        rows(list).forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
        (after ? block(t)[block(t).length - 1] : t).classList.add(after ? 'drop-after' : 'drop-before');
        t.setAttribute('data-drop-at', after ? 'after' : 'before');
      });
      list.addEventListener('drop', function (e) {
        var t = e.target.closest && e.target.closest('.tree-row');
        e.preventDefault();
        if (dragged && t && parentOf(t.getAttribute('data-no')) === parentOf(dragged.getAttribute('data-no')) && block(dragged).indexOf(t) === -1) {
          place(dragged, t, t.getAttribute('data-drop-at') === 'after');
        }
        clear(); dragged = null;
      });
      list.addEventListener('dragend', function () { clear(); dragged = null; });

      /* Move button: a click opens Move up / Move down (the single-pointer and keyboard way to reorder). */
      list.addEventListener('click', function (e) {
        var g = e.target.closest('.tree-grip'), m = e.target.closest('[data-move-dir]');
        if (m) {
          var li = m.closest('.tree-row'), dir = m.getAttribute('data-move-dir'), s = sibling(li, dir === 'up' ? -1 : 1);
          if (s) place(li, s, dir === 'down');
          var mm = m.closest('.move-menu'); if (mm.hasAttribute('data-show')) mm.hidden = true; else mm.remove(); li.querySelector('.tree-grip').setAttribute('aria-expanded', 'false');
          li.querySelector('.tree-grip').focus();
          return;
        }
        if (!g) return;
        var row = g.closest('.tree-row'), open = row.querySelector('.move-menu:not([hidden])');
        if (open) { if (open.hasAttribute('data-show')) open.hidden = true; else open.remove(); g.setAttribute('aria-expanded', 'false'); return; }
        var name = row.querySelector('.tree-name').textContent, no = row.getAttribute('data-no');
        var up = sibling(row, -1), down = sibling(row, 1);
        var drawn = row.querySelector('.move-menu[data-show]'); // the menu drawn for the review state "movemenu"
        if (drawn) {
          drawn.querySelector('[data-move-dir="up"]').disabled = !up; drawn.querySelector('[data-move-dir="down"]').disabled = !down;
          drawn.hidden = false; g.setAttribute('aria-expanded', 'true');
          var f = drawn.querySelector('button:not([disabled])'); if (f) f.focus();
          return;
        }
        var menu = doc.createElement('div');
        menu.className = 'add-menu move-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Move ' + no + ' ' + name);
        var head = doc.createElement('div');
        head.className = 'add-menu-label'; head.setAttribute('aria-hidden', 'true'); head.textContent = 'Move ' + no + ' ' + name;
        menu.appendChild(head);
        [['up', 'Move up', up], ['down', 'Move down', down]].forEach(function (o) {
          var b = doc.createElement('button');
          b.className = 'add-opt'; b.type = 'button'; b.setAttribute('role', 'menuitem'); b.setAttribute('data-move-dir', o[0]);
          b.disabled = !o[2];
          var s = doc.createElement('span'); s.className = 't-strong'; s.textContent = o[1];
          b.appendChild(s); menu.appendChild(b);
        });
        row.appendChild(menu); g.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('button:not([disabled])'); if (first) first.focus();
      });
    });

    /* "−" delete: fills the confirmation for that row and everything under it. */
    var pending = null;
    doc.querySelectorAll('.tree-del[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = doc.getElementById('d3-t'), d = doc.getElementById('d3-d'), n = doc.getElementById('d3-n');
        if (!t || !d) return;
        var li = btn.closest('.tree-row'), all = block(li), kids = all.slice(1);
        var nm = function (r) { return r.getAttribute('data-no') + ' ' + r.querySelector('.tree-name').textContent; };
        t.textContent = 'Delete ' + nm(li) + '?';
        d.textContent = (kids.length ? 'This also deletes the ' + kids.length + (kids.length === 1 ? ' row' : ' rows') + ' under it (' + kids.map(nm).join(', ') + ') and everything entered for them. ' : 'Everything entered for it is deleted. ') + 'The remaining parts are renumbered. This cannot be undone.';
        if (n) n.textContent = all.length === 1 ? 'Delete' : 'Delete ' + all.length + ' rows';
        pending = li;
        location.hash = 'state=deletepart';
      });
    });
    doc.querySelectorAll('[data-del-confirm],[data-del-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.hasAttribute('data-del-confirm') && pending) { var list = pending.parentNode; block(pending).forEach(function (r) { r.remove(); }); renumber(list); }
        pending = null;
        location.hash = 'state=default';
      });
    });
  }

  function init() {
    if (params().embed) root.classList.add('is-embed');
    initStates(); initToggles(); initTabs(); initEnterNext(); initCopy(); initPassword(); initResize(); initMulti(); initStages(); initOther(); initSticky(); initTree();
    window.addEventListener('hashchange', function () {
      if (params().embed) root.classList.add('is-embed');
      applyState(params().state || states[0].key);
      if (params().drawer === 'nav') root.classList.add('nav-open'); else if ('drawer' in params()) root.classList.remove('nav-open');
      if (params().drawer === 'tree') root.classList.add('tree-open'); else if ('drawer' in params()) root.classList.remove('tree-open');
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
