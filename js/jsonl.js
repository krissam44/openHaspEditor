// Passage projet <-> pages.jsonl, et vérifications avant envoi à la platine.
window.OHE = window.OHE || {};

(function (OHE) {
  'use strict';

  // Krissvia : la page perso est la page 5, le fond commun est l'objet 50 (PagePerso.cs, MiseEnPage.cs).
  OHE.KRISSVIA_PAGE = 5;
  OHE.KRISSVIA_FOND = 50;
  OHE.KRISSVIA_NAV_TOP = 435;

  const ORDER = ['page', 'id', 'obj', 'parentid', 'x', 'y', 'w', 'h'];

  // Les icônes (Exxx, Fxxx) sortent en \uExxx : lisibles et sûres quel que soit l'éditeur qui rouvre le fichier.
  function stringify(obj) {
    return JSON.stringify(obj).replace(/[\uE000-\uFAFF]/g, c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  }

  // Objet de l'éditeur -> objet du JSONL : clés « _ » retirées, clés d'identité en tête.
  OHE.exportObject = function (o, page) {
    const out = {};
    if (page !== null && page !== undefined) out.page = page;
    const keys = Object.keys(o).filter(k => !k.startsWith('_') && k !== 'page');
    keys.sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    keys.forEach(k => {
      let v = o[k];
      if (v === undefined || v === null || v === '') return;
      if (k === 'parentid' && !v) return;
      if (k === 'points' && typeof v === 'string') { try { v = JSON.parse(v); } catch { /* laissé tel quel */ } }
      out[k] = v;
    });
    return out;
  };

  // Les parents avant leurs enfants, sinon openHASP ne trouve pas le parentid ; l'ordre reste celui d'empilement.
  OHE.orderedObjects = function (objects) {
    const ids = new Set();
    const done = new Set();
    const result = [];
    let rest = objects.slice();
    while (rest.length) {
      const next = [];
      rest.forEach(o => {
        const pid = Number(o.parentid) || 0;
        const parentPresent = objects.some(p => p !== o && Number(p.id) === pid);
        if (!pid || !parentPresent || ids.has(pid)) { result.push(o); ids.add(Number(o.id)); done.add(o); } else next.push(o);
      });
      if (next.length === rest.length) { result.push(...next); break; }
      rest = next;
    }
    return result;
  };

  // Le thème openHASP donne aux boutons et panneaux un dégradé vertical vers le bleu, que bg_color seul ne retire pas.
  // Sans dégradé choisi, le fond est donc écrit uni, comme dans l'aperçu : bg_grad_color égal à bg_color et
  // bg_grad_dir à 0 (MiseEnPage.Fond de Krissvia fait de même), et pareil pour l'état enfoncé (01).
  const THEME_GRADIENT = new Set(['btn', 'obj']);
  function plainBackground(out, o) {
    if (!THEME_GRADIENT.has(o.obj) || Number(out.bg_grad_dir) > 0) return out;
    if (out.bg_color !== undefined) { out.bg_grad_color = out.bg_color; out.bg_grad_dir = 0; }
    if (out.bg_color01 !== undefined && !(Number(out.bg_grad_dir01) > 0)) out.bg_grad_color01 = out.bg_color01;
    return out;
  }

  OHE.exportJsonl = function (project) {
    const lines = [];
    if (project.mode === 'krissvia') {
      lines.push(`// ${project.name || 'Page perso'} — page perso Krissvia (page ${OHE.KRISSVIA_PAGE}), générée par OpenHASP Editor`);
      const page = project.pages[0];
      OHE.orderedObjects(page.objects).forEach(o => {
        if (o._comment) String(o._comment).split('\n').forEach(c => lines.push('// ' + c));
        lines.push(stringify(plainBackground(OHE.exportObject(o, null), o)));
      });
      return lines.join('\n') + '\n';
    }
    project.pages.forEach((page, i) => {
      if (i > 0) lines.push('');
      if (page.comment) lines.push(stringify({ page: page.page, comment: page.comment }));
      const props = OHE.exportObject(page.props || {}, null);
      if (Object.keys(props).length) lines.push(stringify(Object.assign({ page: page.page, id: 0 }, props)));
      OHE.orderedObjects(page.objects).forEach(o => {
        if (o._comment) String(o._comment).split('\n').forEach(c => lines.push(stringify({ page: page.page, comment: c })));
        lines.push(stringify(plainBackground(OHE.exportObject(o, page.page), o)));
      });
    });
    return lines.join('\n') + '\n';
  };

  // Ce qu'il faut recopier dans les réglages de la platine Krissvia (Reglages.cs, classe Platine).
  OHE.exportKrissviaSettings = function (project) {
    const objects = project.pages[0].objects;
    const affichages = [], boutons = [];
    objects.forEach(o => {
      const b = o._bind;
      if (!b || !b.entite) return;
      if (b.kind === 'btn') boutons.push({ Objet: Number(o.id), Entite: b.entite });
      else {
        const a = { Objet: Number(o.id), Entite: b.entite };
        if (b.attribut === 'val') a.Attribut = 'val';
        if (b.format) a.Format = b.format;
        if (b.champ) a.Champ = b.champ;
        affichages.push(a);
      }
    });
    const jsonl = OHE.exportJsonl(project).split('\n').filter(l => l && !l.startsWith('//')).join('\n');
    return JSON.stringify({
      NomPagePerso: project.krissvia.navName || 'Perso',
      PagePerso: jsonl,
      AffichagesPerso: affichages,
      BoutonsPerso: boutons,
    }, null, 2);
  };

  // JSONL -> pages. Commentaires (// ou {"comment"}) rattachés à l'objet qui suit ; sans page : la page par défaut.
  OHE.parseJsonl = function (text, defaultPage) {
    const pages = new Map();
    const errors = [];
    let pendingComment = null;
    const pageOf = n => {
      if (!pages.has(n)) pages.set(n, { page: n, props: {}, objects: [], comment: '' });
      return pages.get(n);
    };
    text.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const remember = c => { pendingComment = pendingComment === null ? c : pendingComment + '\n' + c; };
      if (line.startsWith('//')) { remember(line.replace(/^\/\/\s?/, '')); return; }
      let o;
      try { o = JSON.parse(line); } catch (e) { errors.push(`ligne ${i + 1} : JSON illisible`); return; }
      if (!o || typeof o !== 'object' || Array.isArray(o)) { errors.push(`ligne ${i + 1} : pas un objet JSON`); return; }
      const n = o.page !== undefined ? Number(o.page) : defaultPage;
      const page = pageOf(n);
      if (o.comment !== undefined && o.id === undefined) {
        // Le premier commentaire d'une page la décrit ; les suivants vont à l'objet qui suit.
        if (!page.objects.length && !page.comment && pendingComment === null) page.comment = String(o.comment);
        else remember(String(o.comment));
        return;
      }
      delete o.page;
      if (Number(o.id) === 0 && !o.obj) { delete o.id; Object.assign(page.props, o); return; }
      if (o.id === undefined) { errors.push(`ligne ${i + 1} : « id » manquant`); return; }
      if (!o.obj) o.obj = 'btn';
      if (Array.isArray(o.points)) o.points = JSON.stringify(o.points);
      if (o.w === undefined || o.h === undefined) {
        const def = OHE.TYPES[o.obj];
        if (o.obj === 'line') OHE.fitLine(o);
        else { o.w = o.w ?? (def ? def.size[0] : 100); o.h = o.h ?? (def ? def.size[1] : 40); }
      }
      o.x = Number(o.x) || 0;
      o.y = Number(o.y) || 0;
      if (pendingComment) { o._comment = pendingComment; pendingComment = null; }
      page.objects.push(o);
    });
    return { pages: [...pages.values()].sort((a, b) => a.page - b.page), errors };
  };

  // Une ligne prend la taille de ses points.
  OHE.fitLine = function (o) {
    let pts = [];
    try { pts = typeof o.points === 'string' ? JSON.parse(o.points) : o.points || []; } catch { pts = []; }
    const lw = Number(o.line_width) || 2;
    o.w = Math.max(1, ...pts.map(p => p[0] + lw / 2));
    o.h = Math.max(1, ...pts.map(p => p[1] + lw / 2));
  };

  OHE.FONTS_OK = new Set(OHE.KRISSVIA_FONTS);

  // Ce qui serait écarté, ignoré ou mal affiché sur la platine.
  OHE.validate = function (project) {
    const issues = [];
    const kv = project.mode === 'krissvia';
    const W = project.width, H = project.height;
    project.pages.forEach(page => {
      const seen = new Map();
      const where = kv ? '' : `p${page.page} `;
      page.objects.forEach(o => {
        const id = Number(o.id);
        const tag = `${where}b${o.id} (${(OHE.TYPES[o.obj] || {}).name || o.obj})`;
        const add = (level, msg) => issues.push({ level, uid: o._uid, msg: `${tag} : ${msg}` });
        if (!Number.isInteger(id) || id < 1 || id > 254) add('error', 'id hors de 1 à 254 — ligne ignorée');
        if (kv && id === OHE.KRISSVIA_FOND) add('error', `l'id ${OHE.KRISSVIA_FOND} est réservé au fond de la page — ligne écartée par Krissvia`);
        if (seen.has(id)) add('error', `id déjà pris par un autre objet — le second écrase le premier`);
        seen.set(id, o);
        if (!OHE.TYPES[o.obj]) add('warn', `type « ${o.obj} » inconnu de l'éditeur (exporté tel quel)`);
        if (o.parentid && !page.objects.some(p => Number(p.id) === Number(o.parentid))) add('error', `parent ${o.parentid} introuvable`);
        if (!o.parentid) {
          if (o.x < 0 || o.y < 0 || o.x + o.w > W || o.y + o.h > H) add('warn', 'déborde de l\'écran');
          if (kv && project.krissvia.showNav && o.y + o.h > OHE.KRISSVIA_NAV_TOP - 2 && o.obj !== 'obj') add('warn', 'chevauche la barre de navigation (y ≥ 435)');
        }
        if (kv && o.text_font !== undefined && !OHE.FONTS_OK.has(Number(o.text_font))) add('warn', `police ${o.text_font} hors de la liste Krissvia (${OHE.KRISSVIA_FONTS.join(', ')})`);
        if ((o.obj === 'btn' || o.obj === 'label') && (o.text === '' || o.text === undefined)) add('info', 'texte vide');
        if ((o.obj === 'arc' || o.obj === 'spinner') && Number(o.w) !== Number(o.h)) add('info', `pas carré : l'arc est dessiné dans le carré en haut à gauche (${Math.min(o.w, o.h)} × ${Math.min(o.w, o.h)}), ce qui reste ne sert à rien`);
        if (typeof o.text === 'string' && /[·•…–—]/.test(o.text)) add('warn', 'caractère typographique (· • … –) souvent absent de la police : préférer l\'ASCII');
        if (typeof o.text === 'string') {
          const absentes = [...new Set(o.text.match(OHE.ICON_RANGE) || [])].filter(c => !OHE.FIRMWARE_ICONS.has(c.charCodeAt(0)));
          if (absentes.length) add('warn', `icône ${absentes.map(c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase()).join(', ')} absente de la police du firmware — rien ne s'affichera`);
        }
        // Krissvia ne commande que sur « up », que seul un btn envoie (un switch envoie « on »/« off »).
        if (kv && o._bind && o._bind.entite && o._bind.kind === 'btn' && o.obj !== 'btn') add('error', 'liaison « Commande » sur autre chose qu\'un bouton (btn) — Krissvia l\'ignore');
        if (kv && o._bind && o._bind.entite && o._bind.kind === 'btn' && o.obj === 'btn' && !o.toggle) add('info', 'bouton de commande sans toggle : il ne montrera pas l\'état de l\'entité');
      });
    });
    return issues;
  };
})(window.OHE);
