// Aperçu des objets openHASP en HTML/SVG : une approximation de LVGL, assez fidèle pour placer et doser.
window.OHE = window.OHE || {};

(function (OHE) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';

  // Valeur d'un objet, ou celle du thème quand la propriété n'est pas écrite.
  const THEME = {
    bg_color: '#2C2C2E', text_color: '#FFFFFF', text_font: 20, border_color: '#0A84FF',
    line_color: '#3A3A3C', line_color10: '#0A84FF', bg_color10: '#0A84FF', bg_color20: '#FFFFFF',
  };
  const get = (o, k, d) => (o[k] !== undefined && o[k] !== null && o[k] !== '' ? o[k] : (d !== undefined ? d : THEME[k]));
  const num = (o, k, d) => { const v = Number(get(o, k, d)); return Number.isFinite(v) ? v : d; };

  OHE.rgba = function (hex, opa) {
    if (!hex) return 'transparent';
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return hex;
    const a = opa === undefined || opa === null || opa === '' ? 1 : Math.max(0, Math.min(255, Number(opa))) / 255;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // Le firmware écrit l'icône MDI F0xxx en Exxx : on la remet à son vrai codepoint pour la police web.
  OHE.displayText = function (s) {
    if (s === undefined || s === null) return '';
    let out = '';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      out += c >= 0xE000 && c <= 0xEFFF ? String.fromCodePoint(0xF0000 + (c - 0xE000)) : ch;
    }
    return out;
  };

  function applyBox(el, o, opts) {
    opts = opts || {};
    const s = el.style;
    const bgOpa = get(o, 'bg_opa', opts.bgOpa !== undefined ? opts.bgOpa : 255);
    const bg = get(o, 'bg_color', opts.bg);
    const dir = Number(get(o, 'bg_grad_dir', 0));
    const grad = get(o, 'bg_grad_color', null);
    if (grad && dir === 1) s.background = `linear-gradient(to bottom, ${OHE.rgba(bg, bgOpa)}, ${OHE.rgba(grad, bgOpa)})`;
    else if (grad && dir === 2) s.background = `linear-gradient(to right, ${OHE.rgba(bg, bgOpa)}, ${OHE.rgba(grad, bgOpa)})`;
    else s.background = OHE.rgba(bg, bgOpa);
    s.borderRadius = Math.min(num(o, 'radius', opts.radius || 0), Math.min(o.w, o.h) / 2) + 'px';
    const bw = num(o, 'border_width', opts.borderWidth || 0);
    if (bw > 0) s.boxShadow = `inset 0 0 0 ${bw}px ${OHE.rgba(get(o, 'border_color'), get(o, 'border_opa', 255))}`;
    const sw = num(o, 'shadow_width', 0);
    if (sw > 0) {
      const sh = `${num(o, 'shadow_ofs_x', 0)}px ${num(o, 'shadow_ofs_y', 0)}px ${sw}px ${OHE.rgba(get(o, 'shadow_color', '#000000'), get(o, 'shadow_opa', 255))}`;
      s.boxShadow = s.boxShadow ? s.boxShadow + ', ' + sh : sh;
    }
  }

  function applyText(el, o, defAlign) {
    const s = el.style;
    s.color = OHE.rgba(get(o, 'text_color'), get(o, 'text_opa', 255));
    s.fontSize = num(o, 'text_font', 20) + 'px';
    s.letterSpacing = num(o, 'text_letter_space', 0) + 'px';
    s.textAlign = get(o, 'align', defAlign || 'left');
    s.paddingTop = num(o, 'pad_top', 0) + 'px';
    s.paddingBottom = num(o, 'pad_bottom', 0) + 'px';
    s.paddingLeft = num(o, 'pad_left', 0) + 'px';
    s.paddingRight = num(o, 'pad_right', 0) + 'px';
  }

  function div(cls, parent) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }

  function svg(w, h, parent) {
    const e = document.createElementNS(SVGNS, 'svg');
    e.setAttribute('width', w);
    e.setAttribute('height', h);
    e.setAttribute('viewBox', `0 0 ${w} ${h}`);
    e.classList.add('fill');
    parent.appendChild(e);
    return e;
  }

  function sv(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    parent.appendChild(e);
    return e;
  }

  // Angles LVGL : 0° à 3 h, sens horaire.
  function polar(cx, cy, r, deg) {
    const a = deg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function arcPath(cx, cy, r, start, span) {
    if (span >= 359.99) {
      const [x1, y1] = polar(cx, cy, r, start);
      const [x2, y2] = polar(cx, cy, r, start + 180);
      return `M${x1},${y1} A${r},${r} 0 1 1 ${x2},${y2} A${r},${r} 0 1 1 ${x1},${y1}`;
    }
    const [x1, y1] = polar(cx, cy, r, start);
    const [x2, y2] = polar(cx, cy, r, start + span);
    return `M${x1},${y1} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${x2},${y2}`;
  }

  const ratio = o => {
    const min = num(o, 'min', 0), max = num(o, 'max', 100);
    return max === min ? 0 : Math.max(0, Math.min(1, (num(o, 'val', 0) - min) / (max - min)));
  };

  const renderers = {
    btn(el, o) {
      applyBox(el, o, { bg: '#0A84FF', radius: 10 });
      // Bascule enfoncée : la couleur de l'état 01 (checked) si elle est donnée, sinon un fond éclairci.
      if (o.toggle && Number(o.val) === 1) {
        if (o.bg_color01) el.style.background = OHE.rgba(o.bg_color01, get(o, 'bg_opa', 255));
        else el.style.filter = 'brightness(1.35)';
      }
      const t = div('txt center', el);
      applyText(t, o, 'center');
      t.textContent = OHE.displayText(get(o, 'text', ''));
    },
    label(el, o) {
      applyBox(el, o, { bgOpa: 0 });
      const t = div('txt', el);
      applyText(t, o, 'left');
      const mode = get(o, 'mode', 'break');
      t.classList.add('mode-' + mode);
      t.textContent = OHE.displayText(get(o, 'text', ''));
    },
    obj(el, o) { applyBox(el, o, { radius: 0 }); },
    switch(el, o) {
      const on = Number(get(o, 'val', 0)) === 1;
      const track = div('fill', el);
      applyBox(track, Object.assign({}, o, on ? { bg_color: get(o, 'bg_color10') } : {}), { radius: o.h / 2 });
      track.style.borderRadius = o.h / 2 + 'px';
      const d = o.h - 6;
      const k = div('knob', el);
      Object.assign(k.style, { width: d + 'px', height: d + 'px', top: '3px', left: (on ? o.w - d - 3 : 3) + 'px', background: get(o, 'bg_color20'), borderRadius: num(o, 'radius20', d / 2) + 'px' });
    },
    checkbox(el, o) {
      const f = num(o, 'text_font', 20);
      const sz = Math.round(f * 1.2);
      const box = div('cbox', el);
      Object.assign(box.style, { width: sz + 'px', height: sz + 'px', top: (o.h - sz) / 2 + 'px', borderColor: get(o, 'bg_color10') });
      if (Number(get(o, 'val', 0)) === 1) {
        box.style.background = get(o, 'bg_color10');
        box.textContent = '✓';
        box.style.fontSize = sz * 0.8 + 'px';
      }
      const t = div('txt', el);
      applyText(t, o, 'left');
      t.style.left = sz + 8 + 'px';
      t.classList.add('vcenter');
      t.textContent = OHE.displayText(get(o, 'text', ''));
    },
    led(el, o) {
      const c = get(o, 'bg_color', '#30D158');
      const v = num(o, 'val', 255) / 255;
      applyBox(el, o, { radius: Math.min(o.w, o.h) / 2 });
      el.style.background = OHE.rgba(c, 80 + v * 175);
      el.style.boxShadow = `0 0 ${4 + v * 12}px ${OHE.rgba(c, v * 255)}`;
    },
    spinner(el, o) {
      applyBox(el, o, { bgOpa: 0 });
      const lw = num(o, 'line_width', 8), lw10 = num(o, 'line_width10', lw);
      const s = svg(o.w, o.h, el);
      const r = Math.min(o.w, o.h) / 2 - Math.max(lw, lw10) / 2;
      sv('circle', { cx: o.w / 2, cy: o.h / 2, r, fill: 'none', stroke: get(o, 'line_color'), 'stroke-width': lw }, s);
      const p = sv('path', { d: arcPath(o.w / 2, o.h / 2, r, 0, num(o, 'angle', 60)), fill: 'none', stroke: get(o, 'line_color10'), 'stroke-width': lw10, 'stroke-linecap': 'round' }, s);
      p.style.transformOrigin = `${o.w / 2}px ${o.h / 2}px`;
      p.style.animation = `ohe-spin ${num(o, 'speed', 1000)}ms linear infinite`;
    },
    arc(el, o) {
      applyBox(el, o, { bgOpa: 0 });
      const lw = num(o, 'line_width', 16), lw10 = num(o, 'line_width10', lw);
      const rot = num(o, 'rotation', 0);
      const start = num(o, 'start_angle', 135) + rot;
      let span = ((num(o, 'end_angle', 45) - num(o, 'start_angle', 135)) % 360 + 360) % 360;
      if (span === 0) span = 360;
      const s = svg(o.w, o.h, el);
      const r = Math.min(o.w, o.h) / 2 - Math.max(lw, lw10) / 2;
      const cap = get(o, 'line_rounded', true) === false ? 'butt' : 'round';
      sv('path', { d: arcPath(o.w / 2, o.h / 2, r, start, span), fill: 'none', stroke: get(o, 'line_color'), 'stroke-width': lw, 'stroke-linecap': cap, 'stroke-opacity': num(o, 'line_opa', 255) / 255 }, s);
      const vs = span * ratio(o);
      if (vs > 0.5) sv('path', { d: arcPath(o.w / 2, o.h / 2, r, start, vs), fill: 'none', stroke: get(o, 'line_color10'), 'stroke-width': lw10, 'stroke-linecap': cap }, s);
      if (o.adjustable) {
        const [kx, ky] = polar(o.w / 2, o.h / 2, r, start + vs);
        sv('circle', { cx: kx, cy: ky, r: lw10 / 2 + 3, fill: get(o, 'bg_color20') }, s);
      }
    },
    bar(el, o) {
      applyBox(el, o, { radius: Math.min(o.w, o.h) / 2 });
      const ind = div('ind', el);
      const v = ratio(o);
      const vertical = o.h > o.w;
      Object.assign(ind.style, vertical ? { left: 0, right: 0, bottom: 0, height: v * 100 + '%' } : { top: 0, bottom: 0, left: 0, width: v * 100 + '%' });
      ind.style.background = OHE.rgba(get(o, 'bg_color10'), get(o, 'bg_opa10', 255));
      ind.style.borderRadius = el.style.borderRadius;
      return { vertical, v };
    },
    slider(el, o) {
      const { vertical, v } = renderers.bar(el, o);
      const d = Math.min(o.w, o.h) + 12;
      const k = div('knob', el);
      const pos = vertical ? { left: (o.w - d) / 2 + 'px', top: (o.h * (1 - v) - d / 2) + 'px' } : { top: (o.h - d) / 2 + 'px', left: (o.w * v - d / 2) + 'px' };
      Object.assign(k.style, pos, { width: d + 'px', height: d + 'px', background: get(o, 'bg_color20'), borderRadius: num(o, 'radius20', d / 2) + 'px' });
    },
    gauge(el, o) {
      applyBox(el, o, { radius: Math.min(o.w, o.h) / 2 });
      const s = svg(o.w, o.h, el);
      const cx = o.w / 2, cy = o.h / 2, R = Math.min(o.w, o.h) / 2 - 6;
      const angle = num(o, 'angle', 240);
      const start = 90 + (360 - angle) / 2 + num(o, 'rotation', 0);
      const min = num(o, 'min', 0), max = num(o, 'max', 100), crit = num(o, 'critical_value', 80);
      const lines = Math.max(2, num(o, 'line_count', 21));
      for (let i = 0; i < lines; i++) {
        const a = start + angle * i / (lines - 1);
        const val = min + (max - min) * i / (lines - 1);
        const [x1, y1] = polar(cx, cy, R, a), [x2, y2] = polar(cx, cy, R - 10, a);
        sv('line', { x1, y1, x2, y2, stroke: val >= crit ? '#FF453A' : get(o, 'line_color', '#888888'), 'stroke-width': 2 }, s);
      }
      const labels = num(o, 'label_count', 6);
      const fs = num(o, 'text_font', 16);
      for (let i = 0; labels > 1 && i < labels; i++) {
        const a = start + angle * i / (labels - 1);
        const [x, y] = polar(cx, cy, R - 14 - fs * 0.6, a);
        const t = sv('text', { x, y, fill: get(o, 'text_color'), 'font-size': fs * 0.75, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, s);
        t.textContent = Math.round(min + (max - min) * i / (labels - 1));
      }
      const [nx, ny] = polar(cx, cy, R - 16, start + angle * ratio(o));
      sv('line', { x1: cx, y1: cy, x2: nx, y2: ny, stroke: get(o, 'line_color10', '#FF453A'), 'stroke-width': 3, 'stroke-linecap': 'round' }, s);
      sv('circle', { cx, cy, r: 6, fill: get(o, 'line_color10', '#FF453A') }, s);
    },
    dropdown(el, o) {
      applyBox(el, o, { radius: 8 });
      const opts = String(get(o, 'options', '')).split('\n');
      const t = div('txt vcenter', el);
      applyText(t, o, 'left');
      t.style.paddingLeft = Math.max(10, num(o, 'pad_left', 10)) + 'px';
      t.style.paddingRight = '28px';
      t.classList.add('mode-dots');
      t.textContent = OHE.displayText(opts[num(o, 'val', 0)] || opts[0] || '');
      const c = div('caret', el);
      c.textContent = '▾';
      c.style.color = get(o, 'text_color');
      c.style.fontSize = num(o, 'text_font', 20) + 'px';
    },
    roller(el, o) {
      applyBox(el, o, { radius: 10 });
      const opts = String(get(o, 'options', '')).split('\n');
      const rows = Math.max(1, num(o, 'rows', 3));
      const rh = o.h / rows;
      const sel = num(o, 'val', 0);
      const band = div('ind', el);
      Object.assign(band.style, { left: 0, right: 0, top: (o.h - rh) / 2 + 'px', height: rh + 'px', background: get(o, 'bg_color10') });
      const half = Math.floor(rows / 2);
      for (let i = -half; i <= half; i++) {
        const text = opts[sel + i];
        if (text === undefined) continue;
        const t = div('txt', el);
        applyText(t, o, 'center');
        Object.assign(t.style, { top: (o.h - rh) / 2 + i * rh + 'px', height: rh + 'px', bottom: 'auto', lineHeight: rh + 'px', padding: 0, opacity: i === 0 ? 1 : 0.5 });
        t.classList.add('mode-dots');
        t.textContent = OHE.displayText(text);
      }
    },
    btnmatrix(el, o) {
      applyBox(el, o, { bgOpa: 0 });
      let options = o.options;
      if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = [options]; } }
      if (!Array.isArray(options)) options = [];
      const rows = [[]];
      options.forEach(b => (b === '\n' ? rows.push([]) : rows[rows.length - 1].push(b)));
      const gap = 6;
      const rh = (o.h - gap * (rows.length - 1)) / rows.length;
      rows.forEach((row, ri) => {
        const bw = (o.w - gap * (row.length - 1)) / Math.max(1, row.length);
        row.forEach((label, bi) => {
          const b = div('mbtn', el);
          Object.assign(b.style, { left: bi * (bw + gap) + 'px', top: ri * (rh + gap) + 'px', width: bw + 'px', height: rh + 'px', background: get(o, 'bg_color10', '#3A3A3C'), borderRadius: num(o, 'radius10', 6) + 'px' });
          const t = div('txt center', b);
          applyText(t, o, 'center');
          t.textContent = OHE.displayText(label);
        });
      });
    },
    cpicker(el, o) {
      const sw = num(o, 'scale_width', 24);
      const d = Math.min(o.w, o.h);
      const ring = div('ring', el);
      Object.assign(ring.style, { width: d + 'px', height: d + 'px', left: (o.w - d) / 2 + 'px', top: (o.h - d) / 2 + 'px', background: 'conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)', WebkitMask: `radial-gradient(circle, transparent ${d / 2 - sw}px, #000 ${d / 2 - sw + 1}px)`, mask: `radial-gradient(circle, transparent ${d / 2 - sw}px, #000 ${d / 2 - sw + 1}px)` });
      const c = div('ring', el);
      const cd = (d - sw * 2) * 0.55;
      Object.assign(c.style, { width: cd + 'px', height: cd + 'px', left: (o.w - cd) / 2 + 'px', top: (o.h - cd) / 2 + 'px', background: '#FF0000' });
    },
    line(el, o) {
      let pts = [];
      try { pts = typeof o.points === 'string' ? JSON.parse(o.points) : (o.points || []); } catch { pts = []; }
      const s = svg(o.w, o.h, el);
      s.style.overflow = 'visible';
      if (pts.length > 1) sv('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: get(o, 'line_color', '#888888'), 'stroke-width': num(o, 'line_width', 2), 'stroke-linecap': o.line_rounded === false ? 'butt' : 'round', 'stroke-linejoin': 'round' }, s);
    },
    img(el, o) {
      if (o._preview) {
        const im = document.createElement('img');
        im.src = o._preview;
        im.className = 'fill';
        im.draggable = false;
        el.appendChild(im);
      } else {
        el.classList.add('placeholder');
        const t = div('txt center', el);
        t.style.fontSize = '12px';
        t.style.color = '#bbb';
        t.textContent = '🖼 ' + (o.src || '');
      }
    },
    qrcode(el, o) {
      el.style.background = get(o, 'bg_color', '#FFFFFF');
      const c = document.createElement('canvas');
      const n = 25;
      c.width = n; c.height = n;
      c.className = 'fill pixelated';
      const g = c.getContext('2d');
      g.fillStyle = get(o, 'text_color', '#000000');
      let seed = 0;
      for (const ch of String(o.text || '')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) & 1;
      const finder = (x, y) => { g.fillRect(x, y, 7, 7); g.clearRect(x + 1, y + 1, 5, 5); g.fillRect(x + 2, y + 2, 3, 3); };
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
        if (!inF && rnd()) g.fillRect(x, y, 1, 1);
      }
      finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
      el.appendChild(c);
    },
  };

  // Élément positionné de l'objet (coordonnées relatives au parent), sans ses enfants.
  OHE.renderObject = function (o) {
    const el = document.createElement('div');
    el.className = 'ohe-obj';
    el.dataset.uid = o._uid;
    el.dataset.type = o.obj;
    const w = Math.max(1, Number(o.w) || 1), h = Math.max(1, Number(o.h) || 1);
    Object.assign(el.style, { left: (Number(o.x) || 0) + 'px', top: (Number(o.y) || 0) + 'px', width: w + 'px', height: h + 'px' });
    const oo = Object.assign({}, o, { w, h });
    const r = renderers[o.obj];
    if (r) r(el, oo);
    else {
      el.classList.add('placeholder');
      const t = div('txt center', el);
      t.style.fontSize = '12px';
      t.textContent = o.obj || '?';
    }
    if (o.opacity !== undefined && o.opacity !== '') el.style.opacity = Number(o.opacity) / 255;
    if (o.hidden === true) el.classList.add('is-hidden');
    return el;
  };
})(window.OHE);
