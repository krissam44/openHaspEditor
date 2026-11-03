// L'éditeur : état du projet, toile, sélection, panneaux, historique.
(function (OHE) {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => k !== null && k !== undefined && e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return e;
  };
  const icon = name => el('span', { class: 'mdi mdi-' + name });
  const clone = o => JSON.parse(JSON.stringify(o));
  const STORAGE = 'ohe.project';

  // ── État ──────────────────────────────────────────────────────────────────

  const S = {
    project: null,
    pageIndex: 0,
    sel: [],            // _uid des objets sélectionnés, le premier est la référence
    zoom: 1,
    grid: { show: true, snap: true, size: 5 },
    clipboard: null,
    history: [], hIndex: -1,
    savedSnapshot: null,
    tab: 'props',
  };

  let uidSeq = 1;
  const newUid = () => 'u' + (uidSeq++) + Math.random().toString(36).slice(2, 6);

  function newProject(mode) {
    return {
      version: 1,
      name: mode === 'krissvia' ? 'Page perso' : 'Mes pages',
      mode,
      width: 480,
      height: 480,
      krissvia: { bgColor: '#1C1C1E', navCount: 5, navName: 'Perso', showNav: true },
      pages: [{ page: mode === 'krissvia' ? OHE.KRISSVIA_PAGE : 1, props: {}, objects: [], comment: '' }],
    };
  }

  function ensureUids(project) {
    project.pages.forEach(p => {
      p.props = p.props || {};
      p.objects.forEach(o => { if (!o._uid) o._uid = newUid(); });
    });
    project.krissvia = Object.assign({ bgColor: '#1C1C1E', navCount: 5, navName: 'Perso', showNav: true }, project.krissvia || {});
    return project;
  }

  const page = () => S.project.pages[S.pageIndex] || S.project.pages[0];
  const objects = () => page().objects;
  const byUid = uid => objects().find(o => o._uid === uid);
  const byId = id => objects().find(o => Number(o.id) === Number(id));
  const selected = () => S.sel.map(byUid).filter(Boolean);
  const isKv = () => S.project.mode === 'krissvia';

  function parentOf(o) {
    if (!o.parentid) return null;
    const p = byId(o.parentid);
    return p && p !== o ? p : null;
  }

  // Position absolue sur l'écran (les enfants sont placés relativement à leur parent).
  function absPos(o, depth) {
    const p = depth > 20 ? null : parentOf(o);
    if (!p) return { x: Number(o.x) || 0, y: Number(o.y) || 0 };
    const pp = absPos(p, (depth || 0) + 1);
    return { x: pp.x + (Number(o.x) || 0), y: pp.y + (Number(o.y) || 0) };
  }
  const absBox = o => { const p = absPos(o); return { x: p.x, y: p.y, w: Number(o.w) || 1, h: Number(o.h) || 1 }; };

  function descendants(o) {
    const out = [];
    const walk = parent => objects().forEach(c => {
      if (c !== parent && Number(c.parentid) === Number(parent.id) && !out.includes(c)) { out.push(c); walk(c); }
    });
    walk(o);
    return out;
  }

  // Les sélectionnés sans ceux dont un ancêtre est aussi sélectionné (ils suivent leur parent).
  function selectionRoots() {
    const sel = selected();
    return sel.filter(o => { let p = parentOf(o); while (p) { if (sel.includes(p)) return false; p = parentOf(p); } return true; });
  }

  function nextId() {
    const used = new Set(objects().map(o => Number(o.id)));
    if (isKv()) used.add(OHE.KRISSVIA_FOND);
    for (let i = 1; i <= 254; i++) if (!used.has(i)) return i;
    return 255;
  }

  // ── Historique ────────────────────────────────────────────────────────────

  const snapshot = () => JSON.stringify({ project: S.project, pageIndex: S.pageIndex });

  function commit() {
    const snap = snapshot();
    if (S.history[S.hIndex] === snap) return;
    S.history = S.history.slice(0, S.hIndex + 1);
    S.history.push(snap);
    if (S.history.length > 200) S.history.shift();
    S.hIndex = S.history.length - 1;
    autosave();
    renderAll({ keepProps: true });
  }

  function restore(snap) {
    const s = JSON.parse(snap);
    S.project = ensureUids(s.project);
    S.pageIndex = Math.min(s.pageIndex, S.project.pages.length - 1);
    S.sel = S.sel.filter(u => byUid(u));
    autosave();
    renderAll();
  }

  function undo() { if (S.hIndex > 0) { S.hIndex--; restore(S.history[S.hIndex]); } }
  function redo() { if (S.hIndex < S.history.length - 1) { S.hIndex++; restore(S.history[S.hIndex]); } }

  function resetHistory() {
    S.history = [snapshot()];
    S.hIndex = 0;
    S.savedSnapshot = JSON.stringify(S.project);
  }

  function autosave() {
    try { localStorage.setItem(STORAGE, JSON.stringify(S.project)); } catch { /* stockage indisponible : rien de grave */ }
  }

  // ── Toile ─────────────────────────────────────────────────────────────────

  const screenEl = $('#screen'), overlayEl = $('#overlay'), stageEl = $('#stage'), viewportEl = $('#viewport');
  const MARGIN = 60;

  function renderScreen() {
    const W = S.project.width, H = S.project.height;
    screenEl.innerHTML = '';
    Object.assign(screenEl.style, { width: W + 'px', height: H + 'px', transform: `scale(${S.zoom})`, left: MARGIN + 'px', top: MARGIN + 'px' });
    stageEl.style.width = W * S.zoom + MARGIN * 2 + 'px';
    stageEl.style.height = H * S.zoom + MARGIN * 2 + 'px';

    // Fond : celui que Krissvia ajoute (objet 50), ou celui de la page.
    const bg = el('div', { class: 'screen-bg' });
    if (isKv()) bg.style.background = S.project.krissvia.bgColor;
    else {
      const pr = page().props;
      const c = pr.bg_color || '#1C1C1E';
      bg.style.background = pr.bg_grad_color && Number(pr.bg_grad_dir) === 1 ? `linear-gradient(${c}, ${pr.bg_grad_color})`
        : pr.bg_grad_color && Number(pr.bg_grad_dir) === 2 ? `linear-gradient(to right, ${c}, ${pr.bg_grad_color})` : c;
    }
    screenEl.appendChild(bg);

    buildTree(objects(), screenEl, false);

    // Page 0 d'openHASP : par-dessus toutes les pages, non éditable depuis une autre page.
    if (!isKv() && page().page !== 0) {
      const p0 = S.project.pages.find(p => p.page === 0);
      if (p0) {
        const layer = el('div', { class: 'ghost-layer' });
        buildTree(p0.objects, layer, true);
        screenEl.appendChild(layer);
      }
    }

    if (isKv() && S.project.krissvia.showNav) screenEl.appendChild(krissviaNav());

    if (S.grid.show) {
      const g = el('div', { class: 'grid-layer' });
      const step = S.grid.size < 5 ? S.grid.size * Math.ceil(5 / S.grid.size) : S.grid.size;
      const major = step * (step >= 10 ? 5 : 10);
      g.style.backgroundImage = `linear-gradient(to right, #ffffff10 1px, transparent 1px), linear-gradient(to bottom, #ffffff10 1px, transparent 1px),
        linear-gradient(to right, #ffffff22 1px, transparent 1px), linear-gradient(to bottom, #ffffff22 1px, transparent 1px)`;
      g.style.backgroundSize = `${step}px ${step}px, ${step}px ${step}px, ${major}px ${major}px, ${major}px ${major}px`;
      screenEl.appendChild(g);
    }
    $('#statusScreen').textContent = `${W}×${H} · ${isKv() ? 'Krissvia page ' + OHE.KRISSVIA_PAGE : 'page ' + page().page}`;
  }

  function buildTree(list, container, ghost) {
    const els = new Map();
    const ids = new Map(list.map(o => [Number(o.id), o]));
    list.forEach(o => { const e = OHE.renderObject(o); if (ghost) e.classList.add('ghost'); els.set(o, e); });
    list.forEach(o => {
      const p = o.parentid ? ids.get(Number(o.parentid)) : null;
      (p && p !== o ? els.get(p) : container).appendChild(els.get(o));
    });
  }

  // La barre que Krissvia ajoute en page 0 : boutons de 42 px de haut à y = 435, répartis sur la largeur.
  function krissviaNav() {
    const k = S.project.krissvia;
    const n = Math.max(1, Math.min(5, Number(k.navCount) || 5));
    const W = S.project.width;
    const layer = el('div', { class: 'reserved', style: { inset: 0 } });
    layer.appendChild(el('div', { class: 'reserved-zone', style: { top: OHE.KRISSVIA_NAV_TOP - 5 + 'px', bottom: 0 } }));
    const marge = 5, ecart = 5;
    const w = Math.floor((W - 2 * marge - ecart * (n - 1)) / n);
    const names = n >= 5 ? ['Thermo', 'Sondes', 'Heure', 'Alarme'] : ['Thermostat', n === 4 ? 'Sondes' : 'Températures', 'Horloge', 'Alarme'];
    const labels = names.slice(0, n - 1).concat([k.navName || 'Perso']);
    labels.forEach((t, i) => {
      const b = el('div', { class: 'nav-btn', style: { left: marge + i * (w + ecart) + 'px', top: OHE.KRISSVIA_NAV_TOP + 'px', width: w + 'px', height: '42px', fontSize: (n >= 5 ? 16 : 20) + 'px' } }, t);
      if (i === n - 1) b.style.boxShadow = 'inset 0 0 0 2px #64B5F6';
      layer.appendChild(b);
    });
    return layer;
  }

  function renderOverlay(extra) {
    overlayEl.innerHTML = '';
    const z = S.zoom;
    const sel = selected();
    sel.forEach((o, i) => {
      const b = absBox(o);
      const box = el('div', { class: 'sel-box' + (i === 0 ? ' primary' : ''), style: { left: MARGIN + b.x * z + 'px', top: MARGIN + b.y * z + 'px', width: b.w * z + 'px', height: b.h * z + 'px' } });
      if (i === 0) box.appendChild(el('div', { class: 'tag' }, `b${o.id} ${(OHE.TYPES[o.obj] || {}).name || o.obj}`));
      overlayEl.appendChild(box);
      if (sel.length === 1) {
        const pts = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
        Object.entries(pts).forEach(([dir, [fx, fy]]) => {
          overlayEl.appendChild(el('div', { class: 'handle', 'data-dir': dir, style: { left: MARGIN + (b.x + b.w * fx) * z + 'px', top: MARGIN + (b.y + b.h * fy) * z + 'px' } }));
        });
      }
    });
    if (extra) extra.forEach(e => overlayEl.appendChild(e));
    const o = sel[0];
    $('#statusSel').textContent = sel.length === 1 ? `b${o.id} · x ${o.x} y ${o.y} · ${o.w}×${o.h}` : sel.length ? `${sel.length} objets` : '';
  }

  // ── Règles ────────────────────────────────────────────────────────────────

  let cursorPos = null;
  function drawRulers() {
    const vr = viewportEl.getBoundingClientRect();
    const sr = screenEl.getBoundingClientRect();
    [['#rulerH', true], ['#rulerV', false]].forEach(([sel, horiz]) => {
      const c = $(sel);
      const dpr = window.devicePixelRatio || 1;
      const len = horiz ? vr.width : vr.height;
      c.width = (horiz ? len : 20) * dpr;
      c.height = (horiz ? 20 : len) * dpr;
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = '#20272f';
      g.fillRect(0, 0, horiz ? len : 20, horiz ? 20 : len);
      const origin = horiz ? sr.left - vr.left : sr.top - vr.top;
      const z = S.zoom;
      const step = [2, 5, 10, 20, 50, 100].find(s => s * z >= 6) || 100;
      const labelEvery = [10, 20, 50, 100, 200, 500].find(s => s * z >= 45) || 500;
      const max = horiz ? S.project.width : S.project.height;
      g.fillStyle = '#ffffff10';
      if (horiz) g.fillRect(origin, 0, max * z, 20); else g.fillRect(0, origin, 20, max * z);
      g.strokeStyle = '#8a97a6';
      g.fillStyle = '#b8c3d0';
      g.font = '10px Segoe UI, sans-serif';
      const startV = Math.floor(-origin / z / step) * step;
      const endV = (len - origin) / z;
      g.beginPath();
      for (let v = startV; v <= endV; v += step) {
        const p = Math.round(origin + v * z) + .5;
        const size = v % labelEvery === 0 ? 20 : v % (step * 5) === 0 ? 9 : 5;
        if (horiz) { g.moveTo(p, 20); g.lineTo(p, 20 - size); } else { g.moveTo(20, p); g.lineTo(20 - size, p); }
        if (v % labelEvery === 0) {
          if (horiz) g.fillText(String(v), p + 3, 10);
          else { g.save(); g.translate(10, p + 3); g.rotate(-Math.PI / 2); g.fillText(String(v), -g.measureText(String(v)).width, 0); g.restore(); }
        }
      }
      g.stroke();
      if (cursorPos) {
        g.strokeStyle = '#ffcc00';
        g.beginPath();
        const p = Math.round(origin + (horiz ? cursorPos.x : cursorPos.y) * z) + .5;
        if (horiz) { g.moveTo(p, 0); g.lineTo(p, 20); } else { g.moveTo(0, p); g.lineTo(20, p); }
        g.stroke();
      }
    });
  }

  // ── Interaction souris ────────────────────────────────────────────────────

  function toScreen(ev) {
    const r = screenEl.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / S.zoom, y: (ev.clientY - r.top) / S.zoom };
  }

  const snapV = v => (S.grid.snap ? Math.round(v / S.grid.size) * S.grid.size : Math.round(v));

  // Lignes d'accroche : bords et centres des autres objets, de l'écran, et le haut de la barre Krissvia.
  function snapLines(exclude) {
    const xs = [0, S.project.width / 2, S.project.width], ys = [0, S.project.height / 2, S.project.height];
    if (isKv() && S.project.krissvia.showNav) ys.push(OHE.KRISSVIA_NAV_TOP - 5);
    objects().forEach(o => {
      if (exclude.includes(o)) return;
      const b = absBox(o);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    });
    return { xs, ys };
  }

  function guideEls(gx, gy) {
    const z = S.zoom, out = [];
    if (gx !== null) out.push(el('div', { class: 'guide v', style: { left: MARGIN + gx * z + 'px', top: 0, height: stageEl.style.height } }));
    if (gy !== null) out.push(el('div', { class: 'guide h', style: { top: MARGIN + gy * z + 'px', left: 0, width: stageEl.style.width } }));
    return out;
  }

  // Décalage à appliquer à une boîte pour qu'un de ses bords/centre tombe sur une ligne d'accroche.
  function nearest(vals, lines, tol) {
    let best = null;
    vals.forEach(v => lines.forEach(l => { const d = l - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: l }; }));
    return best;
  }

  let drag = null;
  let spaceDown = false;

  viewportEl.addEventListener('mousedown', ev => {
    if (ev.button === 1 || (ev.button === 0 && spaceDown)) {
      drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, sl: viewportEl.scrollLeft, st: viewportEl.scrollTop };
      ev.preventDefault();
      return;
    }
    if (ev.button !== 0) return;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const p = toScreen(ev);
    const handle = ev.target.closest('.handle');
    if (handle) {
      const o = selected()[0];
      drag = { kind: 'resize', dir: handle.dataset.dir, o, start: p, box: { x: Number(o.x), y: Number(o.y), w: Number(o.w), h: Number(o.h) }, abs: absBox(o), points: o.points };
      ev.preventDefault();
      return;
    }
    const objEl = ev.target.closest('.ohe-obj:not(.ghost)');
    if (objEl && screenEl.contains(objEl)) {
      const uid = objEl.dataset.uid;
      if (ev.shiftKey || ev.ctrlKey) {
        S.sel = S.sel.includes(uid) ? S.sel.filter(u => u !== uid) : S.sel.concat(uid);
        renderAll({ keepCanvas: true });
        return;
      }
      if (!S.sel.includes(uid)) { S.sel = [uid]; renderAll({ keepCanvas: true }); }
      const roots = selectionRoots();
      drag = { kind: 'move', start: p, items: roots.map(o => ({ o, x: Number(o.x), y: Number(o.y), abs: absBox(o) })), moved: false };
      ev.preventDefault();
      return;
    }
    // Clic dans le vide : rectangle de sélection.
    if (!ev.shiftKey && S.sel.length) { S.sel = []; renderAll({ keepCanvas: true }); }
    drag = { kind: 'marquee', start: p, base: S.sel.slice() };
    ev.preventDefault();
  });

  window.addEventListener('mousemove', ev => {
    if (viewportEl.contains(ev.target) || drag) {
      const p = toScreen(ev);
      cursorPos = { x: Math.round(p.x), y: Math.round(p.y) };
      $('#statusCursor').textContent = `x ${cursorPos.x}  y ${cursorPos.y}`;
      drawRulers();
    }
    if (!drag) return;
    const p = toScreen(ev);
    if (drag.kind === 'pan') {
      viewportEl.scrollLeft = drag.sl - (ev.clientX - drag.sx);
      viewportEl.scrollTop = drag.st - (ev.clientY - drag.sy);
    } else if (drag.kind === 'move') moveDrag(p, ev);
    else if (drag.kind === 'resize') resizeDrag(p, ev);
    else if (drag.kind === 'marquee') marqueeDrag(p);
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.kind === 'move' && d.moved) commit();
    else if (d.kind === 'resize') commit();
    renderAll({ keepCanvas: d.kind === 'marquee' || d.kind === 'pan' || (d.kind === 'move' && !d.moved) });
  });

  function moveDrag(p, ev) {
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved && Math.abs(dx) * S.zoom < 3 && Math.abs(dy) * S.zoom < 3) return;
    drag.moved = true;
    // Boîte englobante des objets déplacés.
    const bx = Math.min(...drag.items.map(i => i.abs.x)), by = Math.min(...drag.items.map(i => i.abs.y));
    const bx2 = Math.max(...drag.items.map(i => i.abs.x + i.abs.w)), by2 = Math.max(...drag.items.map(i => i.abs.y + i.abs.h));
    let gx = null, gy = null;
    if (!ev.altKey) {
      const moving = drag.items.map(i => i.o).flatMap(o => [o, ...descendants(o)]);
      const lines = snapLines(moving);
      const tol = 6 / S.zoom;
      const sx = nearest([bx + dx, (bx + bx2) / 2 + dx, bx2 + dx], lines.xs, tol);
      const sy = nearest([by + dy, (by + by2) / 2 + dy, by2 + dy], lines.ys, tol);
      if (sx) { dx += sx.d; gx = sx.line; } else dx = snapV(bx + dx) - bx;
      if (sy) { dy += sy.d; gy = sy.line; } else dy = snapV(by + dy) - by;
    } else { dx = Math.round(dx); dy = Math.round(dy); }
    drag.items.forEach(i => { i.o.x = Math.round(i.x + dx); i.o.y = Math.round(i.y + dy); });
    renderScreen();
    renderOverlay(guideEls(gx, gy));
  }

  function resizeDrag(p, ev) {
    const { dir, o, box, abs } = drag;
    let x1 = abs.x, y1 = abs.y, x2 = abs.x + abs.w, y2 = abs.y + abs.h;
    let gx = null, gy = null;
    const lines = ev.altKey ? null : snapLines([o, ...descendants(o)]);
    const tol = 6 / S.zoom;
    const fit = (v, axis) => {
      if (!lines) return Math.round(v);
      const s = nearest([v], axis === 'x' ? lines.xs : lines.ys, tol);
      if (s) { if (axis === 'x') gx = s.line; else gy = s.line; return Math.round(v + s.d); }
      return snapV(v);
    };
    if (dir.includes('w')) x1 = Math.min(fit(p.x, 'x'), x2 - 1);
    if (dir.includes('e')) x2 = Math.max(fit(p.x, 'x'), x1 + 1);
    if (dir.includes('n')) y1 = Math.min(fit(p.y, 'y'), y2 - 1);
    if (dir.includes('s')) y2 = Math.max(fit(p.y, 'y'), y1 + 1);
    if (ev.shiftKey && dir.length === 2) {
      // Garder les proportions.
      const r = box.w / box.h;
      const w = x2 - x1, h = y2 - y1;
      if (w / h > r) { const nh = Math.round(w / r); if (dir.includes('n')) y1 = y2 - nh; else y2 = y1 + nh; }
      else { const nw = Math.round(h * r); if (dir.includes('w')) x1 = x2 - nw; else x2 = x1 + nw; }
    }
    o.x = box.x + (x1 - abs.x);
    o.y = box.y + (y1 - abs.y);
    o.w = x2 - x1;
    o.h = y2 - y1;
    if (o.obj === 'line') scaleLine(o, drag.points, box.w, box.h);
    renderScreen();
    const tip = el('div', { class: 'size-tip', style: { left: MARGIN + x2 * S.zoom + 6 + 'px', top: MARGIN + y2 * S.zoom + 6 + 'px' } }, `${o.w} × ${o.h}`);
    renderOverlay(guideEls(gx, gy).concat(tip));
  }

  function scaleLine(o, points, w0, h0) {
    let pts;
    try { pts = JSON.parse(points); } catch { return; }
    const fx = w0 > 1 ? o.w / w0 : 1, fy = h0 > 1 ? o.h / h0 : 1;
    o.points = JSON.stringify(pts.map(([x, y]) => [Math.round(x * fx), Math.round(y * fy)]));
  }

  function marqueeDrag(p) {
    const x1 = Math.min(p.x, drag.start.x), y1 = Math.min(p.y, drag.start.y);
    const x2 = Math.max(p.x, drag.start.x), y2 = Math.max(p.y, drag.start.y);
    const inside = objects().filter(o => { const b = absBox(o); return b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2; });
    S.sel = [...new Set(drag.base.concat(inside.map(o => o._uid)))];
    const z = S.zoom;
    renderOverlay([el('div', { class: 'marquee', style: { left: MARGIN + x1 * z + 'px', top: MARGIN + y1 * z + 'px', width: (x2 - x1) * z + 'px', height: (y2 - y1) * z + 'px' } })]);
  }

  viewportEl.addEventListener('wheel', ev => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    const before = toScreen(ev);
    setZoom(S.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15));
    const r = screenEl.getBoundingClientRect();
    viewportEl.scrollLeft += r.left + before.x * S.zoom - ev.clientX;
    viewportEl.scrollTop += r.top + before.y * S.zoom - ev.clientY;
    drawRulers();
  }, { passive: false });
  viewportEl.addEventListener('scroll', drawRulers);
  window.addEventListener('resize', drawRulers);

  // Palette : glisser un composant sur la toile.
  viewportEl.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('application/x-ohe-type')) ev.preventDefault(); });
  viewportEl.addEventListener('drop', ev => {
    const type = ev.dataTransfer.getData('application/x-ohe-type');
    if (!type) return;
    ev.preventDefault();
    const p = toScreen(ev);
    const [w, h] = OHE.TYPES[type].size;
    addObject(type, snapV(p.x - w / 2), snapV(p.y - h / 2));
  });

  function setZoom(z) {
    S.zoom = Math.max(0.25, Math.min(8, z));
    $('#zoomLabel').textContent = Math.round(S.zoom * 100) + ' %';
    renderScreen();
    renderOverlay();
    drawRulers();
  }

  function zoomFit() {
    const vr = viewportEl.getBoundingClientRect();
    const z = Math.min((vr.width - MARGIN * 2) / S.project.width, (vr.height - MARGIN * 2) / S.project.height);
    setZoom(Math.max(0.25, Math.floor(z * 20) / 20));
    viewportEl.scrollLeft = (stageEl.offsetWidth - vr.width) / 2;
    viewportEl.scrollTop = (stageEl.offsetHeight - vr.height) / 2;
    drawRulers();
  }

  // ── Opérations sur les objets ─────────────────────────────────────────────

  function addObject(type, x, y) {
    const def = OHE.TYPES[type];
    const [w, h] = def.size;
    if (x === undefined) {
      // Au centre, décalé tant qu'un objet du même type occupe déjà la place.
      x = snapV((S.project.width - w) / 2);
      y = snapV((Math.min(S.project.height, isKv() ? OHE.KRISSVIA_NAV_TOP : S.project.height) - h) / 2);
      while (objects().some(o => Number(o.x) === x && Number(o.y) === y)) { x += 10; y += 10; }
    }
    const o = Object.assign({ id: nextId(), obj: type, x, y, w, h }, clone(def.defaults), { _uid: newUid() });
    if (type === 'line') o.points = JSON.stringify([[0, Math.round(h / 2)], [w, Math.round(h / 2)]]);
    objects().push(o);
    S.sel = [o._uid];
    commit();
    renderProps();
  }

  function deleteSelection() {
    const sel = selected();
    if (!sel.length) return;
    const gone = new Set(sel.flatMap(o => [o, ...descendants(o)]));
    page().objects = objects().filter(o => !gone.has(o));
    S.sel = [];
    commit();
    renderProps();
  }

  function copySelection() {
    const roots = selectionRoots();
    if (!roots.length) return;
    S.clipboard = clone(roots.flatMap(o => [o, ...descendants(o)]));
    toast(`${S.clipboard.length} objet(s) copié(s)`);
  }

  function paste(offset) {
    if (!S.clipboard || !S.clipboard.length) return;
    const items = clone(S.clipboard);
    const map = new Map();
    items.forEach(o => { const nid = nextIdExcluding(map); map.set(Number(o.id), nid); });
    const pastedIds = new Set(items.map(o => Number(o.id)));
    items.forEach(o => {
      const old = Number(o.id);
      o.id = map.get(old);
      o._uid = newUid();
      if (o.parentid && pastedIds.has(Number(o.parentid))) o.parentid = map.get(Number(o.parentid));
      else { if (o.parentid && !byId(o.parentid)) delete o.parentid; o.x = Number(o.x) + offset; o.y = Number(o.y) + offset; }
      objects().push(o);
    });
    const newIds = new Set(map.values());
    S.sel = items.filter(o => !o.parentid || !newIds.has(Number(o.parentid))).map(o => o._uid);
    S.clipboard = S.clipboard.map(o => Object.assign(o, { x: Number(o.x) + offset, y: Number(o.y) + offset }));
    commit();
    renderProps();
  }

  function nextIdExcluding(map) {
    const used = new Set(objects().map(o => Number(o.id)).concat([...map.values()]));
    if (isKv()) used.add(OHE.KRISSVIA_FOND);
    for (let i = 1; i <= 254; i++) if (!used.has(i)) return i;
    return 255;
  }

  function nudge(dx, dy) {
    const roots = selectionRoots();
    if (!roots.length) return;
    roots.forEach(o => { o.x = Number(o.x) + dx; o.y = Number(o.y) + dy; });
    commit();
    renderProps();
  }

  function align(kind) {
    const roots = selectionRoots();
    if (!roots.length) return;
    let ref;
    if (roots.length === 1) {
      const p = parentOf(roots[0]);
      ref = p ? absBox(p) : { x: 0, y: 0, w: S.project.width, h: isKv() && S.project.krissvia.showNav ? OHE.KRISSVIA_NAV_TOP - 5 : S.project.height };
    } else {
      const bs = roots.map(absBox);
      const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
      ref = { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
    }
    roots.forEach(o => {
      const b = absBox(o);
      let nx = b.x, ny = b.y;
      if (kind === 'left') nx = ref.x;
      if (kind === 'hcenter') nx = Math.round(ref.x + (ref.w - b.w) / 2);
      if (kind === 'right') nx = ref.x + ref.w - b.w;
      if (kind === 'top') ny = ref.y;
      if (kind === 'vcenter') ny = Math.round(ref.y + (ref.h - b.h) / 2);
      if (kind === 'bottom') ny = ref.y + ref.h - b.h;
      o.x = Number(o.x) + nx - b.x;
      o.y = Number(o.y) + ny - b.y;
    });
    commit();
    renderProps();
  }

  function distribute(horiz) {
    const roots = selectionRoots();
    if (roots.length < 3) { toast('Sélectionner au moins 3 objets'); return; }
    const k = horiz ? 'x' : 'y', s = horiz ? 'w' : 'h';
    const items = roots.map(o => ({ o, b: absBox(o) })).sort((a, b) => a.b[k] - b.b[k]);
    const first = items[0].b, last = items[items.length - 1].b;
    const total = items.reduce((t, i) => t + i.b[s], 0);
    const gap = (last[k] + last[s] - first[k] - total) / (items.length - 1);
    let pos = first[k];
    items.forEach(i => { i.o[k] = Math.round(Number(i.o[k]) + pos - i.b[k]); pos += i.b[s] + gap; });
    commit();
    renderProps();
  }

  function sameSize(key) {
    const sel = selected();
    if (sel.length < 2) { toast('Sélectionner au moins 2 objets'); return; }
    sel.slice(1).forEach(o => { o[key] = sel[0][key]; });
    commit();
    renderProps();
  }

  function zOrder(kind) {
    const list = objects();
    const sel = selected();
    if (!sel.length) return;
    let arr = list.slice();
    if (kind === 'to-front') arr = arr.filter(o => !sel.includes(o)).concat(arr.filter(o => sel.includes(o)));
    if (kind === 'to-back') arr = arr.filter(o => sel.includes(o)).concat(arr.filter(o => !sel.includes(o)));
    if (kind === 'forward') for (let i = arr.length - 2; i >= 0; i--) if (sel.includes(arr[i]) && !sel.includes(arr[i + 1])) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    if (kind === 'backward') for (let i = 1; i < arr.length; i++) if (sel.includes(arr[i]) && !sel.includes(arr[i - 1])) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    page().objects = arr;
    commit();
  }

  // ── Panneau des propriétés ────────────────────────────────────────────────

  // Texte affiché dans un champ : icônes en \uExxx, retours à la ligne en \n.
  const toField = s => String(s ?? '').replace(/[\uE000-\uFAFF]/g, c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/\n/g, '\\n');
  const fromField = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n');

  function setProp(targets, key, value) {
    targets.forEach(o => {
      if (value === undefined) { delete o[key]; return; }
      if (key === 'parentid') {
        const before = absPos(o);
        if (value) o.parentid = value; else delete o.parentid;
        const p = parentOf(o);
        const pp = p ? absPos(p) : { x: 0, y: 0 };
        o.x = before.x - pp.x;
        o.y = before.y - pp.y;
        return;
      }
      o[key] = value;
      if (key === 'points' || (o.obj === 'line' && key === 'line_width')) OHE.fitLine(o);
    });
    renderScreen();
    renderOverlay();
  }

  function fieldFor(prop, targets, ctx) {
    const vals = targets.map(o => o[prop.key]);
    const same = vals.every(v => JSON.stringify(v) === JSON.stringify(vals[0]));
    const value = same ? vals[0] : undefined;
    const isSet = value !== undefined && value !== '';
    const mixed = !same;
    const apply = ctx.apply || ((v, final) => { setProp(targets, prop.key, v); if (final) commit(); });
    const ph = mixed ? '(plusieurs)' : 'défaut';
    const wrap = el('div', { class: 'field' + (isSet ? ' set' : '') });
    const clearBtn = () => el('button', { class: 'mini', title: 'Revenir à la valeur du thème (retirer la propriété)', onclick: () => { apply(undefined, true); renderProps(); } }, icon('close'));

    switch (prop.type) {
      case 'int': {
        const i = el('input', { type: 'number', value: isSet ? value : '', placeholder: ph, min: prop.min, max: prop.max });
        const read = () => (i.value === '' ? undefined : Math.round(Number(i.value)));
        i.addEventListener('input', () => apply(read(), false));
        i.addEventListener('change', () => apply(read(), true));
        wrap.appendChild(i);
        break;
      }
      case 'font': {
        const listId = 'fonts-list';
        const i = el('input', { type: 'number', value: isSet ? value : '', placeholder: ph, list: listId, min: 8, max: 120 });
        const read = () => (i.value === '' ? undefined : Math.round(Number(i.value)));
        i.addEventListener('input', () => apply(read(), false));
        i.addEventListener('change', () => apply(read(), true));
        const s = el('select', { title: 'Tailles Krissvia', onchange: () => { if (s.value) { i.value = s.value; apply(Number(s.value), true); renderProps(); } } },
          el('option', { value: '' }, '▾'), ...OHE.KRISSVIA_FONTS.map(f => el('option', { value: f }, String(f))));
        s.style.flex = 'none'; s.style.width = '44px';
        wrap.append(i, s);
        break;
      }
      case 'text': {
        const i = el('input', { type: 'text', value: isSet ? toField(value) : '', placeholder: ph, spellcheck: 'false' });
        i.addEventListener('input', () => apply(i.value === '' ? undefined : fromField(i.value), false));
        i.addEventListener('change', () => apply(i.value === '' ? undefined : fromField(i.value), true));
        wrap.appendChild(i);
        if (prop.key === 'text') {
          wrap.appendChild(el('button', { class: 'mini', title: 'Insérer une icône MDI', onclick: () => iconPicker(code => {
            const pos = i.selectionStart ?? i.value.length;
            const ins = '\\u' + code.toString(16).toUpperCase();
            i.value = i.value.slice(0, pos) + ins + i.value.slice(i.selectionEnd ?? pos);
            apply(fromField(i.value), true);
            renderProps();
          }) }, icon('emoticon-outline')));
        }
        break;
      }
      case 'textarea': {
        const t = el('textarea', { rows: 4, spellcheck: 'false', placeholder: ph });
        t.value = isSet ? value : '';
        t.addEventListener('input', () => apply(t.value === '' ? undefined : t.value, false));
        t.addEventListener('change', () => apply(t.value === '' ? undefined : t.value, true));
        wrap.appendChild(t);
        break;
      }
      case 'matrix': {
        const t = el('textarea', { rows: 6, spellcheck: 'false' });
        let arr = value;
        if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = [arr]; } }
        t.value = Array.isArray(arr) ? arr.map(b => (b === '\n' ? '' : toField(b))).join('\n') : '';
        const read = () => t.value.split('\n').map(l => (l === '' ? '\n' : fromField(l)));
        t.addEventListener('input', () => apply(read(), false));
        t.addEventListener('change', () => apply(read(), true));
        wrap.appendChild(t);
        break;
      }
      case 'points': {
        const i = el('input', { type: 'text', value: typeof value === 'string' ? value : JSON.stringify(value || []), spellcheck: 'false' });
        const ok = () => { try { const p = JSON.parse(i.value); return Array.isArray(p) && p.every(q => Array.isArray(q) && q.length === 2); } catch { return false; } };
        i.addEventListener('input', () => { i.style.borderColor = ok() ? '' : 'var(--error)'; if (ok()) apply(i.value, false); });
        i.addEventListener('change', () => { if (ok()) apply(i.value, true); });
        wrap.appendChild(i);
        break;
      }
      case 'color': {
        const hex = isSet ? String(value) : '';
        const c = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000' });
        const i = el('input', { type: 'text', value: hex, placeholder: ph, spellcheck: 'false' });
        c.addEventListener('input', () => { i.value = c.value.toUpperCase(); apply(i.value, false); });
        c.addEventListener('change', () => { apply(c.value.toUpperCase(), true); renderProps(); });
        i.addEventListener('change', () => {
          let v = i.value.trim();
          if (v && !v.startsWith('#')) v = '#' + v;
          if (v === '' || /^#[0-9a-f]{6}$/i.test(v)) { apply(v ? v.toUpperCase() : undefined, true); renderProps(); }
          else i.style.borderColor = 'var(--error)';
        });
        wrap.append(c, i);
        if (isSet) wrap.appendChild(clearBtn());
        ctx.after = el('div', { class: 'swatches' }, ...OHE.PALETTE.map(p => el('span', { title: p, style: { background: p }, onclick: () => { apply(p, true); renderProps(); } })));
        break;
      }
      case 'opa': {
        const r = el('input', { type: 'range', min: 0, max: 255, value: isSet ? value : 255 });
        const n = el('input', { type: 'number', class: 'num-sm', min: 0, max: 255, value: isSet ? value : '', placeholder: mixed ? '…' : '255' });
        r.addEventListener('input', () => { n.value = r.value; apply(Number(r.value), false); });
        r.addEventListener('change', () => apply(Number(r.value), true));
        n.addEventListener('change', () => { apply(n.value === '' ? undefined : Math.max(0, Math.min(255, Number(n.value))), true); renderProps(); });
        wrap.append(r, n);
        break;
      }
      case 'bool': {
        const s = el('select', {}, el('option', { value: '' }, mixed ? '(plusieurs)' : '(défaut)'), el('option', { value: 'true' }, 'oui (true)'), el('option', { value: 'false' }, 'non (false)'));
        s.value = value === true ? 'true' : value === false ? 'false' : '';
        s.addEventListener('change', () => apply(s.value === '' ? undefined : s.value === 'true', true));
        wrap.appendChild(s);
        break;
      }
      case 'select': {
        const s = el('select', {}, el('option', { value: '' }, mixed ? '(plusieurs)' : '(défaut)'), ...prop.options.map(o => el('option', { value: String(o.value) }, o.label)));
        s.value = isSet ? String(value) : '';
        s.addEventListener('change', () => {
          const o = prop.options.find(x => String(x.value) === s.value);
          apply(o ? o.value : undefined, true);
        });
        wrap.appendChild(s);
        break;
      }
      case 'parent': {
        const self = targets.length === 1 ? targets[0] : null;
        const banned = self ? new Set([self, ...descendants(self)]) : new Set(targets);
        const s = el('select', {}, el('option', { value: '' }, '(écran)'),
          ...objects().filter(o => !banned.has(o)).map(o => el('option', { value: String(o.id) }, `b${o.id} ${(OHE.TYPES[o.obj] || {}).name || o.obj}`)));
        s.value = isSet ? String(value) : '';
        s.addEventListener('change', () => { apply(s.value === '' ? undefined : Number(s.value), true); renderProps(); });
        wrap.appendChild(s);
        break;
      }
      case 'image': {
        const f = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        f.addEventListener('change', () => {
          const file = f.files[0];
          if (!file) return;
          const rd = new FileReader();
          rd.onload = () => {
            targets.forEach(o => { o._preview = rd.result; if (!o.src || o.src === 'L:/image.png') o.src = 'L:/' + file.name; });
            commit(); renderProps();
          };
          rd.readAsDataURL(file);
        });
        wrap.append(f, el('button', { onclick: () => f.click() }, icon('image-plus'), 'Choisir…'));
        if (isSet) wrap.appendChild(clearBtn());
        break;
      }
      default:
        wrap.appendChild(el('span', { class: 'muted' }, String(value ?? '')));
    }
    return wrap;
  }

  function groupEl(group, targets, opts) {
    opts = opts || {};
    const d = el('details', { class: 'group', open: !group.collapsed || undefined });
    d.appendChild(el('summary', {}, group.title));
    const rows = el('div', { class: 'rows' });
    group.props.forEach(p => {
      if (opts.skip && opts.skip.has(p.key)) return;
      const ctx = { apply: opts.apply ? (v, final) => opts.apply(p.key, v, final) : null };
      const field = fieldFor(p, targets, ctx);
      const wide = p.type === 'textarea' || p.type === 'matrix';
      const row = el('div', { class: 'row' + (p.half ? ' half' : '') + (wide ? ' wide' : '') }, el('label', { title: p.key }, p.label), field);
      rows.appendChild(row);
      if (ctx.after) rows.appendChild(ctx.after);
    });
    d.appendChild(rows);
    return d;
  }

  function renderProps() {
    const panel = $('#panel-props');
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    const sel = selected();
    if (!sel.length) renderPageProps(panel);
    else if (sel.length === 1) renderObjectProps(panel, sel[0]);
    else renderMultiProps(panel, sel);
    panel.scrollTop = scroll;
  }

  function renderObjectProps(panel, o) {
    const def = OHE.TYPES[o.obj];
    panel.appendChild(el('div', { class: 'panel-title' }, icon(def ? def.glyph : 'help-box'), `b${o.id}`, el('small', {}, def ? def.name + ' · ' + o.obj : o.obj)));
    panel.appendChild(groupEl(OHE.COMMON_GROUP, [o]));
    (def ? def.groups : []).forEach(g => panel.appendChild(groupEl(g, [o])));
    if (isKv()) panel.appendChild(bindingGroup(o));
    panel.appendChild(rawGroup(o));
  }

  // Liaison Krissvia : un objet qui montre une entité, ou un bouton qui la commande (réglages de la platine).
  function bindingGroup(o) {
    const b = o._bind || {};
    const d = el('details', { class: 'group', open: true });
    d.appendChild(el('summary', {}, 'Liaison Krissvia'));
    const rows = el('div', { class: 'rows' });
    const save = (k, v) => {
      o._bind = Object.assign({}, o._bind || {}, { [k]: v });
      if (!o._bind.kind) delete o._bind;
      commit();
    };
    // Krissvia ne commande que sur l'événement « up », que seul un btn envoie (Evenements.cs) : pas de switch ni de case.
    const cmd = el('option', { value: 'btn' }, 'Commande (interrupteur / lumière)');
    if (o.obj !== 'btn' && b.kind !== 'btn') cmd.disabled = true;
    // Krissvia montre l'état par val : sans toggle ni couleur d'état enfoncé, le bouton ne change pas d'aspect.
    const kind = el('select', {
      onchange: () => {
        if (kind.value === 'btn' && o.obj === 'btn') {
          o.toggle = true;
          if (!o.bg_color01) o.bg_color01 = '#30D158';
        }
        save('kind', kind.value);
        renderAll();
      },
    },
      el('option', { value: '' }, '(aucune)'), el('option', { value: 'aff' }, 'Affiche une valeur'), cmd);
    kind.value = b.kind || '';
    rows.appendChild(el('div', { class: 'row' }, el('label', {}, 'Rôle'), el('div', { class: 'field' }, kind)));
    if (b.kind === 'btn' && o.obj !== 'btn') rows.appendChild(el('p', { class: 'note warn', style: { gridColumn: '1 / 3' } }, 'Seul un bouton (btn) commande : Krissvia ignore les switch et les cases.'));
    else if (b.kind === 'btn' && !o.toggle) rows.appendChild(el('p', { class: 'note', style: { gridColumn: '1 / 3' } }, 'Avec toggle coché, le bouton reste enfoncé tant que l\'entité est allumée.'));
    else if (o.obj !== 'btn' && !b.kind) rows.appendChild(el('p', { class: 'note', style: { gridColumn: '1 / 3' } }, 'Pour commander une entité, utiliser un bouton (btn) : Krissvia ignore les switch et les cases.'));
    if (b.kind) {
      const text = (key, label, ph) => {
        const i = el('input', { type: 'text', value: b[key] || '', placeholder: ph, spellcheck: 'false', onchange: () => save(key, i.value.trim()) });
        rows.appendChild(el('div', { class: 'row' }, el('label', {}, label), el('div', { class: 'field' }, i)));
      };
      text('entite', 'Entité', b.kind === 'btn' ? 'switch.salon_lampe' : 'sensor.salon_temperature');
      if (b.kind === 'aff') {
        const at = el('select', { onchange: () => save('attribut', at.value) }, el('option', { value: 'text' }, 'text (texte)'), el('option', { value: 'val' }, 'val (entier : arc, barre…)'));
        at.value = b.attribut || 'text';
        rows.appendChild(el('div', { class: 'row' }, el('label', {}, 'Attribut'), el('div', { class: 'field' }, at)));
        text('format', 'Format', 'Salon {} °C');
        text('champ', 'Champ', 'temperature, target…');
      }
    }
    rows.appendChild(el('p', { class: 'note', style: { gridColumn: '1 / 3' } }, 'Recopiée dans les réglages de la platine (onglet JSONL), pas dans le JSONL.'));
    d.appendChild(rows);
    return d;
  }

  function rawGroup(o) {
    const d = el('details', { class: 'group' });
    d.appendChild(el('summary', {}, 'JSON brut'));
    const t = el('textarea', { rows: 8, spellcheck: 'false', style: { width: '100%' } });
    t.value = JSON.stringify(OHE.exportObject(o, null), null, 1);
    const msg = el('div', { class: 'note' }, 'Toutes les propriétés, même celles que l\'éditeur ne connaît pas.');
    t.addEventListener('change', () => {
      let n;
      try { n = JSON.parse(t.value); } catch { msg.textContent = 'JSON illisible'; msg.style.color = 'var(--error)'; return; }
      Object.keys(o).forEach(k => { if (!k.startsWith('_')) delete o[k]; });
      Object.assign(o, n);
      if (o.obj === 'line' && Array.isArray(o.points)) o.points = JSON.stringify(o.points);
      commit();
      renderProps();
    });
    d.appendChild(el('div', { class: 'rows' }, el('div', { class: 'row wide' }, t), msg));
    return d;
  }

  function renderMultiProps(panel, sel) {
    panel.appendChild(el('div', { class: 'panel-title' }, icon('select-group'), `${sel.length} objets`, el('small', {}, 'valeurs communes')));
    const btns = el('div', { class: 'btnrow' },
      ...[['align-left', 'align-horizontal-left'], ['align-hcenter', 'align-horizontal-center'], ['align-right', 'align-horizontal-right'],
        ['align-top', 'align-vertical-top'], ['align-vcenter', 'align-vertical-center'], ['align-bottom', 'align-vertical-bottom'],
        ['dist-h', 'distribute-horizontal-center'], ['dist-v', 'distribute-vertical-center']].map(([c, i]) => el('button', { title: c, onclick: () => run(c) }, icon(i))));
    panel.appendChild(btns);
    // Groupes du premier objet, réduits aux propriétés que tous les sélectionnés connaissent.
    const known = sel.map(o => OHE.knownKeys(o.obj));
    const types = new Set(sel.map(o => o.obj));
    const firstDef = OHE.TYPES[sel[0].obj];
    const groups = [OHE.COMMON_GROUP].concat(types.size === 1 && firstDef ? firstDef.groups : (firstDef ? firstDef.groups : []));
    const seen = new Set(['id', '_comment']);
    groups.forEach(g => {
      const props = g.props.filter(p => !seen.has(p.key) && known.every(k => k.has(p.key)) && p.type !== 'image');
      props.forEach(p => seen.add(p.key));
      if (props.length) panel.appendChild(groupEl(Object.assign({}, g, { props }), sel));
    });
  }

  function renderPageProps(panel) {
    if (isKv()) {
      const k = S.project.krissvia;
      panel.appendChild(el('div', { class: 'panel-title' }, icon('home-automation'), 'Page perso Krissvia', el('small', {}, 'page ' + OHE.KRISSVIA_PAGE)));
      const setK = (key, v, final) => { k[key] = v; renderScreen(); if (final) commit(); };
      panel.appendChild(groupEl({ title: 'Platine', props: [
        { key: 'bgColor', label: 'Couleur de fond', type: 'color' },
        { key: 'navName', label: 'Nom dans la barre', type: 'text' },
        { key: 'navCount', label: 'Pages présentes', type: 'int', min: 1, max: 5 },
        { key: 'showNav', label: 'Montrer la barre', type: 'bool' },
      ] }, [k], { apply: (key, v, final) => setK(key, v === undefined ? (key === 'showNav' ? true : key === 'navCount' ? 5 : '') : v, final) }));
      panel.appendChild(el('div', { class: 'note' },
        el('p', {}, 'Ce que Krissvia ajoute de lui-même : le ', el('b', {}, 'fond'), ' (objet 50, couleur « Affichage » des réglages) et la ', el('b', {}, 'barre de navigation'), ' en bas (y ≥ 435). Les deux sont dessinés ici pour mémoire, sans être exportés.'),
        el('p', {}, 'Le numéro de page est forcé à 5 ; un id doit être entre 1 et 254, et 50 est refusé. Polices conseillées : ' + OHE.KRISSVIA_FONTS.join(', ') + '.')));
    } else {
      const p = page();
      panel.appendChild(el('div', { class: 'panel-title' }, icon('file-outline'), `Page ${p.page}`, el('small', {}, p.page === 0 ? 'visible sur toutes les pages' : '')));
      panel.appendChild(groupEl(OHE.PAGE_GROUP, [p.props]));
      const c = el('input', { type: 'text', value: p.comment || '', placeholder: 'Commentaire de la page', onchange: () => { p.comment = c.value; commit(); } });
      panel.appendChild(el('div', { class: 'group' }, el('div', { class: 'rows', style: { paddingTop: '8px' } }, el('div', { class: 'row' }, el('label', {}, 'Commentaire'), el('div', { class: 'field' }, c)))));
    }
    const size = el('div', { class: 'group' }, el('div', { class: 'rows', style: { paddingTop: '8px' } },
      el('div', { class: 'row' }, el('label', {}, 'Écran'), el('div', { class: 'field' },
        numInput(S.project.width, v => { S.project.width = v; commit(); zoomFit(); }), el('span', {}, '×'),
        numInput(S.project.height, v => { S.project.height = v; commit(); zoomFit(); })))));
    panel.appendChild(size);
    panel.appendChild(el('p', { class: 'note' }, 'Guition ESP32-S3 4848S040 : 480 × 480. Rien de sélectionné : propriétés de la page.'));
  }

  function numInput(v, onChange) {
    const i = el('input', { type: 'number', value: v, min: 50, max: 2000 });
    i.addEventListener('change', () => onChange(Math.max(50, Number(i.value) || v)));
    return i;
  }

  // ── Plan, pages, code, vérification ───────────────────────────────────────

  function textOf(o) {
    if (o.text !== undefined) return OHE.displayText(o.text).replace(/\n/g, ' ');
    if (o.options !== undefined) return Array.isArray(o.options) ? o.options.filter(x => x !== '\n').join(' ') : String(o.options).replace(/\n/g, ' · ');
    if (o.val !== undefined) return 'val ' + o.val;
    return '';
  }

  function renderOutline() {
    const panel = $('#panel-outline');
    panel.innerHTML = '';
    panel.appendChild(el('p', { class: 'note' }, 'Ordre du fichier = ordre d\'empilement : le premier est dessous.'));
    if (isKv()) panel.appendChild(el('div', { class: 'outline-item reserved-row' }, icon('rectangle'), el('span', { class: 'oid' }, 'b50'), el('span', { class: 'otext' }, 'Fond (ajouté par Krissvia)')));
    const list = objects();
    const ids = new Set(list.map(o => Number(o.id)));
    const walk = (parentId, depth) => list.filter(o => (parentId === null ? !o.parentid || !ids.has(Number(o.parentid)) || Number(o.parentid) === Number(o.id) : Number(o.parentid) === parentId && Number(o.id) !== parentId)).forEach(o => {
      const def = OHE.TYPES[o.obj];
      const row = el('div', { class: 'outline-item' + (S.sel.includes(o._uid) ? ' selected' : ''), style: { paddingLeft: 6 + depth * 16 + 'px' }, title: o._comment || '' },
        icon(def ? def.glyph : 'help-box'), el('span', { class: 'oid' }, 'b' + o.id), el('span', { class: 'otext' }, (o._bind && o._bind.entite ? '⚡ ' : '') + (textOf(o) || (def ? def.name : o.obj))),
        el('span', { class: 'eye mdi mdi-' + (o.hidden ? 'eye-off-outline' : 'eye-outline'), title: 'hidden', onclick: ev => { ev.stopPropagation(); if (o.hidden) delete o.hidden; else o.hidden = true; commit(); renderProps(); } }));
      row.addEventListener('click', ev => {
        S.sel = ev.shiftKey || ev.ctrlKey ? (S.sel.includes(o._uid) ? S.sel.filter(u => u !== o._uid) : S.sel.concat(o._uid)) : [o._uid];
        renderAll();
      });
      panel.appendChild(row);
      if (depth < 20) walk(Number(o.id), depth + 1);
    });
    walk(null, 0);
    if (!list.length) panel.appendChild(el('p', { class: 'muted' }, 'Page vide : cliquer un composant à gauche.'));
    if (isKv() && S.project.krissvia.showNav) panel.appendChild(el('div', { class: 'outline-item reserved-row' }, icon('dock-bottom'), el('span', { class: 'oid' }, 'p0'), el('span', { class: 'otext' }, 'Barre de navigation (Krissvia)')));
  }

  function renderPages() {
    const panel = $('#panel-pages');
    panel.innerHTML = '';
    if (isKv()) {
      panel.appendChild(el('p', { class: 'note' }, 'En mode Krissvia, la page perso est une seule page (la 5). Passer en mode « pages.jsonl openHASP complet » pour gérer plusieurs pages et la page 0.'));
      return;
    }
    S.project.pages.forEach((p, i) => {
      const row = el('div', { class: 'page-item' + (i === S.pageIndex ? ' active' : ''), onclick: () => { S.pageIndex = i; S.sel = []; renderAll(); } },
        icon(p.page === 0 ? 'layers-outline' : 'file-outline'), el('span', { class: 'pnum' }, 'Page ' + p.page),
        el('span', { class: 'muted' }, p.comment || (p.page === 0 ? 'toutes les pages' : '')),
        el('span', { class: 'pcount' }, p.objects.length + ' obj.'),
        el('button', { class: 'mini', title: 'Supprimer la page', onclick: ev => {
          ev.stopPropagation();
          if (S.project.pages.length === 1) return;
          if (p.objects.length && !confirm(`Supprimer la page ${p.page} et ses ${p.objects.length} objets ?`)) return;
          S.project.pages.splice(i, 1);
          S.pageIndex = Math.min(S.pageIndex, S.project.pages.length - 1);
          S.sel = [];
          commit(); renderAll();
        } }, icon('delete-outline')));
      panel.appendChild(row);
    });
    const used = new Set(S.project.pages.map(p => p.page));
    const add = n => {
      S.project.pages.push({ page: n, props: {}, objects: [], comment: '' });
      S.project.pages.sort((a, b) => a.page - b.page);
      S.pageIndex = S.project.pages.findIndex(p => p.page === n);
      S.sel = [];
      commit(); renderAll();
    };
    const next = [...Array(12).keys()].map(i => i + 1).find(n => !used.has(n));
    panel.appendChild(el('div', { class: 'btnrow' },
      next ? el('button', { onclick: () => add(next) }, icon('plus'), 'Page ' + next) : null,
      !used.has(0) ? el('button', { onclick: () => add(0) }, icon('layers-plus'), 'Page 0 (commune)') : null));
    panel.appendChild(el('p', { class: 'note' }, 'La page 0 se superpose à toutes les autres : barre de navigation, horloge… Elle est montrée en transparence sous les autres pages.'));
  }

  function renderCode() {
    const panel = $('#panel-code');
    panel.innerHTML = '';
    const jsonl = OHE.exportJsonl(S.project);
    const t = el('textarea', { class: 'code', readonly: true, rows: 16, spellcheck: 'false' });
    t.value = jsonl;
    panel.appendChild(el('div', { class: 'btnrow' },
      el('button', { class: 'primary', onclick: () => run('export') }, icon('download'), isKv() ? 'page-perso.jsonl' : 'pages.jsonl'),
      el('button', { onclick: () => run('copy-jsonl') }, icon('content-copy'), 'Copier'),
      el('button', { onclick: importDialog }, icon('import'), 'Importer…')));
    panel.appendChild(t);
    if (isKv()) {
      panel.appendChild(el('h3', { style: { marginTop: '14px' } }, 'Réglages de la platine'));
      panel.appendChild(el('p', { class: 'note' }, 'Le JSONL va dans « Page perso » des réglages de la platine (page Services). Les liaisons, elles, vont dans « Affichages » et « Boutons ». Fragment complet pour appsettings.Local.json :'));
      const s = el('textarea', { class: 'code', readonly: true, rows: 10, spellcheck: 'false', style: { minHeight: '160px' } });
      s.value = OHE.exportKrissviaSettings(S.project);
      panel.appendChild(s);
      panel.appendChild(el('div', { class: 'btnrow' }, el('button', { onclick: () => copyText(s.value, 'Réglages copiés') }, icon('content-copy'), 'Copier les réglages')));
    } else {
      panel.appendChild(el('p', { class: 'note' }, 'Déposer pages.jsonl sur la platine : interface web → Fichiers → envoyer, puis redémarrer (ou commande « jsonl » / « run L:/pages.jsonl »).'));
    }
  }

  function renderIssues() {
    const panel = $('#panel-check');
    panel.innerHTML = '';
    const issues = OHE.validate(S.project);
    const badge = $('#issueBadge');
    const errs = issues.filter(i => i.level === 'error').length, warns = issues.filter(i => i.level === 'warn').length;
    badge.textContent = errs || warns || '';
    badge.className = 'badge' + (!errs && warns ? ' warn' : '');
    if (!issues.length) { panel.appendChild(el('div', { class: 'ok-msg' }, icon('check-circle-outline'), ' Rien à signaler.')); return; }
    issues.forEach(i => panel.appendChild(el('div', { class: 'issue ' + i.level, onclick: () => {
      const pi = S.project.pages.findIndex(p => p.objects.some(o => o._uid === i.uid));
      if (pi >= 0) S.pageIndex = pi;
      S.sel = [i.uid];
      renderAll();
    } }, i.msg)));
  }

  // ── Rendu global ──────────────────────────────────────────────────────────

  function renderAll(opts) {
    opts = opts || {};
    if (!opts.keepCanvas) renderScreen();
    renderOverlay();
    if (!opts.keepProps) renderProps();
    else if (!document.activeElement || !$('#panel-props').contains(document.activeElement)) renderProps();
    renderOutline();
    renderPages();
    if (S.tab === 'code') renderCode();
    renderIssues();
    $('#projectName').value = S.project.name;
    $('#modeSelect').value = S.project.mode;
    $('#dirty').textContent = JSON.stringify(S.project) !== S.savedSnapshot ? '● modifié' : '';
    document.querySelector('[data-tab=pages]').style.display = isKv() ? 'none' : '';
    if (isKv() && S.tab === 'pages') switchTab('props');
    $('[data-cmd=undo]').disabled = S.hIndex <= 0;
    $('[data-cmd=redo]').disabled = S.hIndex >= S.history.length - 1;
    drawRulers();
  }

  function switchTab(tab) {
    S.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
    if (tab === 'code') renderCode();
  }

  // ── Fichiers ──────────────────────────────────────────────────────────────

  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const slug = () => (S.project.name || 'page').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'page';

  function copyText(text, msg) {
    navigator.clipboard.writeText(text).then(() => toast(msg || 'Copié'), () => toast('Copie refusée par le navigateur'));
  }

  function loadProject(p) {
    S.project = ensureUids(p);
    S.pageIndex = 0;
    S.sel = [];
    resetHistory();
    autosave();
    renderAll();
    zoomFit();
  }

  function openFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const text = String(rd.result);
      if (/\.json$/i.test(file.name) && !/\.jsonl$/i.test(file.name)) {
        try {
          const p = JSON.parse(text);
          if (p && Array.isArray(p.pages)) { loadProject(p); toast('Projet ouvert'); return; }
        } catch { /* pas un projet : on tente le JSONL */ }
      }
      importJsonl(text, 'replace', file.name);
    };
    rd.readAsText(file);
  }

  function importJsonl(text, how, name) {
    const kv = isKv();
    const { pages, errors } = OHE.parseJsonl(text, kv ? OHE.KRISSVIA_PAGE : page().page);
    if (!pages.length) { toast('Aucun objet trouvé' + (errors.length ? ' : ' + errors[0] : '')); return; }
    if (how === 'replace') {
      const p = newProject(kv && pages.length === 1 ? 'krissvia' : (kv && pages.every(x => x.page === OHE.KRISSVIA_PAGE) ? 'krissvia' : 'openhasp'));
      if (name) p.name = name.replace(/\.(jsonl|json|txt)$/i, '');
      p.pages = p.mode === 'krissvia' ? [Object.assign(pages[0], { page: OHE.KRISSVIA_PAGE })] : pages;
      if (p.mode === 'krissvia') p.pages[0].objects = pages.flatMap(x => x.objects);
      loadProject(p);
    } else {
      pages.forEach(src => {
        const target = kv ? page() : (S.project.pages.find(p => p.page === src.page) || (S.project.pages.push({ page: src.page, props: {}, objects: [], comment: '' }), S.project.pages[S.project.pages.length - 1]));
        Object.assign(target.props, src.props);
        src.objects.forEach(o => { o._uid = newUid(); target.objects.push(o); });
      });
      S.project.pages.sort((a, b) => a.page - b.page);
      commit();
      renderAll();
    }
    toast(`${pages.reduce((t, p) => t + p.objects.length, 0)} objet(s) importé(s)` + (errors.length ? ` · ${errors.length} ligne(s) écartée(s)` : ''));
    if (errors.length) console.warn('Import JSONL :', errors);
  }

  function modal(content) {
    const m = $('#modal'), box = m.querySelector('.modal-box');
    box.innerHTML = '';
    box.append(...content);
    m.classList.remove('hidden');
    const close = () => m.classList.add('hidden');
    m.onclick = ev => { if (ev.target === m) close(); };
    return close;
  }

  function importDialog() {
    const t = el('textarea', { rows: 14, spellcheck: 'false', placeholder: '{"page":1,"id":1,"obj":"btn",...}\n…' });
    let close;
    close = modal([
      el('h2', {}, 'Importer du JSONL'),
      el('p', { class: 'note' }, 'Coller des lignes pages.jsonl (ou une page perso Krissvia). Les commentaires // et {"comment"} sont repris.'),
      t,
      el('div', { class: 'btnrow' },
        el('button', { class: 'primary', onclick: () => { importJsonl(t.value, 'append'); close(); } }, icon('plus'), 'Ajouter à la page'),
        el('button', { onclick: () => { if (confirm('Remplacer tout le projet ?')) { importJsonl(t.value, 'replace'); close(); } } }, icon('file-replace-outline'), 'Remplacer le projet'),
        el('span', { class: 'spacer' }),
        el('button', { onclick: () => close() }, 'Annuler')),
    ]);
    t.focus();
  }

  // Icônes : seulement celles de la police du firmware (OHE.ICON_GROUPS), les autres ne s'afficheraient pas.
  function iconPicker(onPick) {
    const search = el('input', { type: 'search', placeholder: 'Rechercher (anglais : lightbulb, fan, door…)' });
    const list = el('div', { class: 'icon-list' });
    const info = el('p', { class: 'note' }, 'Les 146 icônes de la police du firmware openHASP, utilisables à toutes les tailles. Les autres icônes MDI ne s\'affichent pas sur la platine.');
    let close;
    const button = ([name, code]) => el('button', { title: `${name} · \\u${code.toString(16).toUpperCase()}`, onclick: () => { close(); onPick(code); } },
      el('span', { class: 'mdi' }, OHE.displayText(String.fromCharCode(code))), el('span', { class: 'n' }, name));
    const show = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      OHE.ICON_GROUPS.forEach(g => {
        const icons = g.icons.filter(([n]) => n.includes(q));
        if (!icons.length) return;
        list.appendChild(el('h3', {}, g.title));
        list.appendChild(el('div', { class: 'icon-grid' }, ...icons.map(button)));
      });
      if (!list.children.length) list.appendChild(el('p', { class: 'muted' }, 'Aucune icône.'));
    };
    search.addEventListener('input', show);
    close = modal([el('h2', {}, 'Insérer une icône'), search, info, list, el('div', { class: 'btnrow' }, el('span', { class: 'spacer' }), el('button', { onclick: () => close() }, 'Fermer'))]);
    show();
    search.focus();
  }

  function newDialog() {
    let close;
    const start = mode => { close(); loadProject(newProject(mode)); };
    close = modal([
      el('h2', {}, 'Nouveau projet'),
      el('p', { class: 'note' }, 'Le projet en cours est remplacé (Ctrl+Z ne le ramènera pas : l\'enregistrer d\'abord si besoin).'),
      el('div', { class: 'btnrow' },
        el('button', { class: 'primary', onclick: () => start('krissvia') }, icon('home-automation'), 'Page perso Krissvia'),
        el('button', { onclick: () => start('openhasp') }, icon('file-multiple-outline'), 'pages.jsonl openHASP'),
        el('span', { class: 'spacer' }),
        el('button', { onclick: () => close() }, 'Annuler')),
    ]);
  }

  function setMode(mode) {
    if (mode === S.project.mode) return;
    if (mode === 'krissvia') {
      const others = S.project.pages.filter(p => p !== page() && p.objects.length).length;
      if (others && !confirm(`Le mode Krissvia ne garde qu'une page : seule la page ${page().page} sera conservée. Continuer ?`)) { $('#modeSelect').value = S.project.mode; return; }
      S.project.pages = [Object.assign(page(), { page: OHE.KRISSVIA_PAGE })];
      S.pageIndex = 0;
    }
    S.project.mode = mode;
    commit();
    renderAll();
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ── Commandes ─────────────────────────────────────────────────────────────

  function run(cmd) {
    switch (cmd) {
      case 'new': newDialog(); break;
      case 'open': $('#fileInput').click(); break;
      case 'save':
        download(slug() + '.ohe.json', JSON.stringify(S.project, null, 1), 'application/json');
        S.savedSnapshot = JSON.stringify(S.project);
        renderAll({ keepCanvas: true, keepProps: true });
        break;
      case 'export': download(isKv() ? slug() + '.jsonl' : 'pages.jsonl', OHE.exportJsonl(S.project)); break;
      case 'copy-jsonl': copyText(OHE.exportJsonl(S.project), 'JSONL copié'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'zoom-in': setZoom(S.zoom * 1.25); break;
      case 'zoom-out': setZoom(S.zoom / 1.25); break;
      case 'zoom-fit': zoomFit(); break;
      case 'zoom-100': setZoom(1); break;
      case 'delete': deleteSelection(); break;
      case 'duplicate': copySelection(); paste(10); break;
      case 'to-front': case 'to-back': case 'forward': case 'backward': zOrder(cmd); break;
      case 'dist-h': distribute(true); break;
      case 'dist-v': distribute(false); break;
      case 'same-w': sameSize('w'); break;
      case 'same-h': sameSize('h'); break;
      default:
        if (cmd.startsWith('align-')) align(cmd.slice(6));
    }
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-cmd]');
    if (b && !b.disabled) run(b.dataset.cmd);
    const t = ev.target.closest('#tabs button');
    if (t) switchTab(t.dataset.tab);
  });

  document.addEventListener('keydown', ev => {
    const typing = ev.target.matches('input, textarea, select');
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 's') { ev.preventDefault(); run('save'); return; }
    if (ev.key === 'Escape') { if (!$('#modal').classList.contains('hidden')) $('#modal').classList.add('hidden'); else if (!typing) { S.sel = []; renderAll({ keepCanvas: true }); } return; }
    if (typing) return;
    if (ev.key === ' ') { spaceDown = true; viewportEl.classList.add('panning'); ev.preventDefault(); return; }
    const k = ev.key.toLowerCase();
    if (ctrl && k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if (ctrl && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); }
    else if (ctrl && k === 'c') copySelection();
    else if (ctrl && k === 'x') { copySelection(); deleteSelection(); }
    else if (ctrl && k === 'v') paste(10);
    else if (ctrl && k === 'd') { ev.preventDefault(); run('duplicate'); }
    else if (ctrl && k === 'a') { ev.preventDefault(); S.sel = objects().map(o => o._uid); renderAll({ keepCanvas: true }); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSelection(); }
    else if (ev.key.startsWith('Arrow')) {
      ev.preventDefault();
      const s = ev.shiftKey ? S.grid.size : 1;
      nudge(ev.key === 'ArrowLeft' ? -s : ev.key === 'ArrowRight' ? s : 0, ev.key === 'ArrowUp' ? -s : ev.key === 'ArrowDown' ? s : 0);
    } else if (k === '+' || k === '=') setZoom(S.zoom * 1.25);
    else if (k === '-') setZoom(S.zoom / 1.25);
    else if (k === '0') zoomFit();
  });
  document.addEventListener('keyup', ev => { if (ev.key === ' ') { spaceDown = false; viewportEl.classList.remove('panning'); } });

  $('#fileInput').addEventListener('change', ev => { const f = ev.target.files[0]; if (f) openFile(f); ev.target.value = ''; });
  $('#projectName').addEventListener('change', ev => { S.project.name = ev.target.value; commit(); });
  $('#modeSelect').addEventListener('change', ev => setMode(ev.target.value));
  $('#gridShow').addEventListener('change', ev => { S.grid.show = ev.target.checked; renderScreen(); saveGrid(); });
  $('#gridSnap').addEventListener('change', ev => { S.grid.snap = ev.target.checked; saveGrid(); });
  $('#gridSize').addEventListener('change', ev => { S.grid.size = Math.max(1, Number(ev.target.value) || 5); renderScreen(); saveGrid(); });
  function saveGrid() { try { localStorage.setItem('ohe.grid', JSON.stringify(S.grid)); } catch { /* idem */ } }

  // Un fichier lâché n'importe où : projet ou JSONL.
  document.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); });
  document.addEventListener('drop', ev => { if (ev.dataTransfer.files.length) { ev.preventDefault(); openFile(ev.dataTransfer.files[0]); } });
  window.addEventListener('beforeunload', ev => { if (JSON.stringify(S.project) !== S.savedSnapshot) { autosave(); } void ev; });

  // ── Démarrage ─────────────────────────────────────────────────────────────

  function buildPalette() {
    const pal = $('#palette');
    OHE.TYPE_ORDER.forEach(type => {
      const def = OHE.TYPES[type];
      const b = el('button', { draggable: 'true', title: `${def.name} (${type})`, onclick: () => addObject(type) }, icon(def.glyph), def.name);
      b.addEventListener('dragstart', ev => { ev.dataTransfer.setData('application/x-ohe-type', type); ev.dataTransfer.effectAllowed = 'copy'; });
      pal.appendChild(b);
    });
    document.body.appendChild(el('datalist', { id: 'fonts-list' }, ...OHE.KRISSVIA_FONTS.map(f => el('option', { value: f }))));
  }

  function demoProject() {
    const p = newProject('krissvia');
    p.name = 'Salon';
    const objs = [
      { id: 1, obj: 'label', x: 20, y: 16, w: 440, h: 40, text: '\uE50F Salon', text_font: 32, text_color: '#64B5F6', align: 'center', bg_opa: 0, border_width: 0 },
      { id: 2, obj: 'obj', x: 20, y: 70, w: 210, h: 170, bg_color: '#2C2C2E', radius: 18, border_width: 0, click: false },
      { id: 3, obj: 'arc', x: 35, y: 80, w: 180, h: 150, min: 0, max: 35, val: 21, start_angle: 135, end_angle: 45, line_width: 14, line_color: '#3A3A3C', line_width10: 14, line_color10: '#FF9F0A', bg_opa: 0, border_width: 0, _bind: { kind: 'aff', entite: 'sensor.salon_temperature', attribut: 'val' } },
      { id: 4, obj: 'label', x: 55, y: 135, w: 140, h: 48, text: '21,5 °C', text_font: 32, text_color: '#FFFFFF', align: 'center', bg_opa: 0, border_width: 0, _bind: { kind: 'aff', entite: 'sensor.salon_temperature', format: '°C' } },
      { id: 5, obj: 'btn', x: 250, y: 70, w: 210, h: 80, text: '\uE425 Lampe', text_font: 24, text_color: '#FFFFFF', bg_color: '#3A3A3C', radius: 14, border_width: 0, toggle: true, _bind: { kind: 'btn', entite: 'light.salon' } },
      { id: 6, obj: 'btn', x: 250, y: 160, w: 210, h: 80, text: '\uE238 Radiateur', text_font: 24, text_color: '#FFFFFF', bg_color: '#3A3A3C', radius: 14, border_width: 0, toggle: true },
      { id: 7, obj: 'label', x: 20, y: 262, w: 300, h: 30, text: 'Volets', text_font: 20, text_color: '#999999', align: 'left', bg_opa: 0, border_width: 0 },
      { id: 8, obj: 'slider', x: 30, y: 310, w: 420, h: 16, min: 0, max: 100, val: 60, bg_color: '#3A3A3C', bg_color10: '#0A84FF', bg_color20: '#FFFFFF', radius: 8 },
      { id: 9, obj: 'switch', x: 380, y: 360, w: 80, h: 40, val: 1, bg_color: '#3A3A3C', bg_color10: '#30D158', bg_color20: '#FFFFFF', radius: 20 },
      { id: 10, obj: 'label', x: 20, y: 365, w: 300, h: 30, text: 'Mode nuit', text_font: 20, text_color: '#FFFFFF', align: 'left', bg_opa: 0, border_width: 0 },
    ];
    p.pages[0].objects = objs;
    return p;
  }

  function init() {
    buildPalette();
    try { Object.assign(S.grid, JSON.parse(localStorage.getItem('ohe.grid') || '{}')); } catch { /* défaut */ }
    $('#gridShow').checked = S.grid.show;
    $('#gridSnap').checked = S.grid.snap;
    $('#gridSize').value = S.grid.size;
    let p = null;
    try { p = JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch { p = null; }
    S.project = ensureUids(p && Array.isArray(p.pages) ? p : demoProject());
    resetHistory();
    if (p) S.savedSnapshot = null;
    renderAll();
    requestAnimationFrame(zoomFit);
    // La police de l'écran arrive après le premier rendu : redessiner pour mesurer juste.
    if (document.fonts) document.fonts.ready.then(() => renderScreen());
  }

  OHE.app = { state: S, run, importJsonl };
  init();
})(window.OHE);
