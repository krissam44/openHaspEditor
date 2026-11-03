// Les objets openHASP (0.7) que l'éditeur sait poser, leurs propriétés et leurs valeurs à la création.
// Les clés sont celles du pages.jsonl : un objet de l'éditeur s'exporte tel quel, moins ses clés « _ » (internes).
window.OHE = window.OHE || {};

(function (OHE) {
  'use strict';

  // Les tailles de police des platines Krissvia (MiseEnPage.Polices) : une taille de plus, un cache de glyphes de plus.
  OHE.KRISSVIA_FONTS = [16, 20, 24, 28, 32, 48, 84];

  // Palette des pages générées par Krissvia, pour que la page perso s'accorde avec les autres.
  OHE.PALETTE = ['#1C1C1E', '#2C2C2E', '#3A3A3C', '#FFFFFF', '#999999', '#888888', '#64B5F6', '#0A84FF',
    '#30D158', '#FF9F0A', '#FF5722', '#FF453A', '#BF5AF2', '#133B34'];

  // Les 146 icônes MDI de la police du firmware openHASP 0.7 (openhasp.com, Design > Fonts), à toutes les tailles.
  // Codepoint MDI F0xxx écrit Exxx, F1xxx écrit Fxxx. Les autres icônes MDI ne s'affichent pas sur la platine.
  // human-greeting (E64A) s'appelle human-greeting-variant depuis MDI 7.
  const ICON_GROUPS = [
    ['Éclairage', 'ceiling-light E769 coach-lamp F020 desk-lamp E95F floor-lamp E8DD lamp E6B5 lightbulb E335 lightbulb-on E6E8 outdoor-lamp F054 string-lights F2BA vanity-light F1E1 wall-sconce E91C'],
    ['Énergie', 'power E425 power-plug E6A5 lightning-bolt F40B leaf E32A ev-station E5F1 battery-high F2A3 battery-medium F2A2 battery-low F2A1 battery-outline E08E solar-panel ED9B solar-panel-large ED9C solar-power EA72 solar-power-variant-outline FA74 transmission-tower ED3E transmission-tower-import F92D transmission-tower-export F92C'],
    ['Climat et météo', 'thermometer E50F fire E238 radiator E438 radiator-disabled EAD7 radiator-off EAD8 snowflake E717 air-conditioner E01B water E58C water-percent E58E cloud-search-outline E957 white-balance-sunny E5A8 weather-sunny E599 weather-partly-cloudy E595 weather-cloudy E590 weather-fog E591 weather-hazy EF30 weather-hail E592 weather-lightning E593 weather-lightning-rainy E67E weather-night E594 weather-night-partly-cloudy EF31 weather-pouring E596 weather-rainy E597 weather-snowy E598 weather-snowy-rainy E67F weather-windy E59D weather-windy-variant E59E'],
    ['Ouvrants', 'door-closed E81B door-open E81C door-closed-lock F0AF window-closed-variant F1DB window-shutter F11C window-shutter-open F11E window-shutter-alert F11D blinds E0AC blinds-open F011 garage-variant F2D3 garage-open-variant F2D4'],
    ['Sécurité', 'shield-home E68A shield-lock E99D shield-check E565 lock E33E lock-open-variant EFC6 key-variant E30B alert E026 cctv E7AE bell E09A'],
    ['Pièces', 'home E2DC home-outline E6A1 bed E2E3 sofa E4B9 silverware-fork-knife EA70 coffee E176 shower E9A0 toilet E9AB pool E606 car E10B'],
    ['Appareils', 'fan E210 television E502 laptop E322 cellphone E11C fridge-outline E28F stove E4DE microwave EC99 kettle E5FA dishwasher EAAC washing-machine E72A tumble-dryer E917 robot-vacuum E70D robot-mower-outline F1F3 water-pump E58F fountain E96B engine E1FA trash-can-outline EA7A recycle-variant F39D'],
    ['Présence', 'account E004 human-greeting-variant E64A run E70E'],
    ['Heure', 'clock-outline E150 calendar E0ED history E2DA timer-outline E51B'],
    ['Son', 'play E40A pause E3E4 stop E4DB skip-next E4AD skip-previous E4AE repeat E456 repeat-off E457 repeat-once E458 shuffle E49D shuffle-disabled E49E volume-high E57E volume-medium E580 volume-mute E75F speaker E4C3 monitor-speaker EF5F music E75A'],
    ['Commandes', 'plus E415 minus E374 check E12C close E156 cog E493 dots-vertical E1D9 bluetooth E0AF wifi E5A9'],
    ['Flèches', 'arrow-up E05D arrow-down E045 arrow-left E04D arrow-right E054 arrow-up-box E6C3 arrow-down-box E6C0 arrow-left-box E6C1 arrow-right-box E6C2 chevron-up E143 chevron-down E140 chevron-left E141 chevron-right E142 subdirectory-arrow-left E60C'],
  ];
  OHE.ICON_GROUPS = ICON_GROUPS.map(([title, list]) => {
    const t = list.split(' ');
    const icons = [];
    for (let i = 0; i < t.length; i += 2) icons.push([t[i], parseInt(t[i + 1], 16)]);
    return { title, icons };
  });
  OHE.FIRMWARE_ICONS = new Set(OHE.ICON_GROUPS.flatMap(g => g.icons.map(i => i[1])));

  const opt = (...v) => v.map(x => (Array.isArray(x) ? { value: x[0], label: x[1] } : { value: x, label: String(x) }));

  // Groupes de propriétés communs. type : int, text, textarea, color, bool, select, font, opa, options, points.
  const G = {
    fond: {
      title: 'Fond', props: [
        { key: 'bg_color', label: 'Couleur', type: 'color' },
        { key: 'bg_opa', label: 'Opacité', type: 'opa' },
        { key: 'bg_grad_color', label: 'Dégradé vers', type: 'color' },
        { key: 'bg_grad_dir', label: 'Sens dégradé', type: 'select', options: opt([0, '0 aucun'], [1, '1 vertical'], [2, '2 horizontal']) },
        { key: 'radius', label: 'Rayon', type: 'int', min: 0 },
      ],
    },
    bordure: {
      title: 'Bordure', props: [
        { key: 'border_width', label: 'Épaisseur', type: 'int', min: 0 },
        { key: 'border_color', label: 'Couleur', type: 'color' },
        { key: 'border_opa', label: 'Opacité', type: 'opa' },
      ],
    },
    ombre: {
      title: 'Ombre', collapsed: true, props: [
        { key: 'shadow_width', label: 'Largeur', type: 'int', min: 0 },
        { key: 'shadow_color', label: 'Couleur', type: 'color' },
        { key: 'shadow_ofs_x', label: 'Décalage x', type: 'int' },
        { key: 'shadow_ofs_y', label: 'Décalage y', type: 'int' },
      ],
    },
    marges: {
      title: 'Marges internes', collapsed: true, props: [
        { key: 'pad_top', label: 'Haut', type: 'int', min: 0 },
        { key: 'pad_bottom', label: 'Bas', type: 'int', min: 0 },
        { key: 'pad_left', label: 'Gauche', type: 'int', min: 0 },
        { key: 'pad_right', label: 'Droite', type: 'int', min: 0 },
      ],
    },
    texte: {
      title: 'Texte', props: [
        { key: 'text_font', label: 'Police', type: 'font' },
        { key: 'text_color', label: 'Couleur', type: 'color' },
        { key: 'text_opa', label: 'Opacité', type: 'opa' },
        { key: 'align', label: 'Alignement', type: 'select', options: opt('left', 'center', 'right') },
        { key: 'text_letter_space', label: 'Espacement', type: 'int' },
      ],
    },
    valeur: {
      title: 'Valeur', props: [
        { key: 'min', label: 'Min', type: 'int' },
        { key: 'max', label: 'Max', type: 'int' },
        { key: 'val', label: 'Valeur', type: 'int' },
      ],
    },
    indicateur: {
      title: 'Indicateur (partie 1)', props: [
        { key: 'bg_color10', label: 'Couleur', type: 'color' },
        { key: 'bg_opa10', label: 'Opacité', type: 'opa' },
      ],
    },
    bouton: {
      title: 'Bouton (partie 2)', props: [
        { key: 'bg_color20', label: 'Couleur', type: 'color' },
        { key: 'radius20', label: 'Rayon', type: 'int', min: 0 },
      ],
    },
  };

  // name : libellé de la palette ; glyph : icône MDI de la palette ; size : w/h à la création ; defaults : le reste.
  OHE.TYPES = {
    btn: {
      name: 'Bouton', glyph: 'gesture-tap-button', size: [140, 56],
      defaults: { text: 'Bouton', text_font: 20, text_color: '#FFFFFF', bg_color: '#3A3A3C', radius: 10, border_width: 0 },
      groups: [
        { title: 'Bouton', props: [
          { key: 'text', label: 'Texte', type: 'text' },
          { key: 'toggle', label: 'Bascule', type: 'bool' },
          { key: 'bg_color01', label: 'Fond enfoncé', type: 'color' },
          { key: 'val', label: 'Enfoncé (val)', type: 'int', min: 0, max: 1 },
        ] }, G.texte, G.fond, G.bordure, G.ombre, G.marges],
    },
    label: {
      name: 'Libellé', glyph: 'format-text', size: [200, 36],
      defaults: { text: 'Libellé', text_font: 20, text_color: '#FFFFFF', align: 'center', bg_opa: 0, border_width: 0 },
      groups: [
        { title: 'Libellé', props: [
          { key: 'text', label: 'Texte', type: 'text' },
          { key: 'mode', label: 'Débordement', type: 'select', options: opt(['expand', 'expand (agrandit)'], ['break', 'break (retour ligne)'], ['dots', 'dots (…)'], ['scroll', 'scroll'], ['loop', 'loop (défile)'], ['crop', 'crop (coupe)']) },
        ] }, G.texte, G.fond, G.bordure, G.marges],
    },
    obj: {
      name: 'Panneau', glyph: 'rectangle-outline', size: [200, 120],
      defaults: { bg_color: '#2C2C2E', radius: 14, border_width: 0, click: false },
      groups: [G.fond, G.bordure, G.ombre],
    },
    switch: {
      name: 'Interrupteur', glyph: 'toggle-switch-outline', size: [80, 40],
      defaults: { val: 0, bg_color: '#3A3A3C', bg_color10: '#0A84FF', bg_color20: '#FFFFFF', radius: 20 },
      groups: [
        { title: 'Interrupteur', props: [{ key: 'val', label: 'Allumé (val)', type: 'int', min: 0, max: 1 }] },
        G.fond, G.indicateur, G.bouton, G.bordure],
    },
    checkbox: {
      name: 'Case à cocher', glyph: 'checkbox-marked-outline', size: [180, 40],
      defaults: { text: 'Case', val: 0, text_font: 20, text_color: '#FFFFFF', bg_color10: '#0A84FF' },
      groups: [
        { title: 'Case', props: [
          { key: 'text', label: 'Texte', type: 'text' },
          { key: 'val', label: 'Cochée (val)', type: 'int', min: 0, max: 1 },
        ] }, G.texte, G.indicateur],
    },
    led: {
      name: 'LED', glyph: 'led-on', size: [32, 32],
      defaults: { val: 255, bg_color: '#30D158', radius: 16, border_width: 0 },
      groups: [
        { title: 'LED', props: [{ key: 'val', label: 'Luminosité', type: 'int', min: 0, max: 255 }] },
        G.fond, G.bordure, G.ombre],
    },
    spinner: {
      name: 'Spinner', glyph: 'loading', size: [80, 80],
      defaults: { speed: 1000, angle: 60, line_width: 8, line_color: '#3A3A3C', line_width10: 8, line_color10: '#0A84FF', bg_opa: 0, border_width: 0 },
      groups: [
        { title: 'Spinner', props: [
          { key: 'speed', label: 'Durée tour (ms)', type: 'int', min: 100 },
          { key: 'angle', label: 'Longueur arc', type: 'int', min: 1, max: 359 },
          { key: 'line_width', label: 'Épaisseur fond', type: 'int', min: 0 },
          { key: 'line_color', label: 'Couleur fond', type: 'color' },
          { key: 'line_width10', label: 'Épaisseur arc', type: 'int', min: 0 },
          { key: 'line_color10', label: 'Couleur arc', type: 'color' },
        ] }, G.fond],
    },
    arc: {
      name: 'Arc', glyph: 'progress-helper', size: [200, 200],
      defaults: { min: 0, max: 100, val: 50, start_angle: 135, end_angle: 45, line_width: 16, line_color: '#3A3A3C', line_width10: 16, line_color10: '#0A84FF', bg_opa: 0, border_width: 0 },
      groups: [
        G.valeur,
        { title: 'Arc', props: [
          { key: 'start_angle', label: 'Angle début', type: 'int', min: 0, max: 360 },
          { key: 'end_angle', label: 'Angle fin', type: 'int', min: 0, max: 360 },
          { key: 'rotation', label: 'Rotation', type: 'int', min: 0, max: 360 },
          { key: 'adjustable', label: 'Réglable', type: 'bool' },
          { key: 'line_width', label: 'Épaisseur fond', type: 'int', min: 0 },
          { key: 'line_color', label: 'Couleur fond', type: 'color' },
          { key: 'line_width10', label: 'Épaisseur valeur', type: 'int', min: 0 },
          { key: 'line_color10', label: 'Couleur valeur', type: 'color' },
          { key: 'line_rounded', label: 'Bouts arrondis', type: 'bool' },
        ] }, G.bouton, G.fond],
    },
    bar: {
      name: 'Barre', glyph: 'percent-box-outline', size: [240, 20],
      defaults: { min: 0, max: 100, val: 50, bg_color: '#3A3A3C', bg_color10: '#0A84FF', radius: 10 },
      groups: [G.valeur, G.fond, G.indicateur, G.bordure],
    },
    slider: {
      name: 'Curseur', glyph: 'tune-variant', size: [240, 16],
      defaults: { min: 0, max: 100, val: 50, bg_color: '#3A3A3C', bg_color10: '#0A84FF', bg_color20: '#FFFFFF', radius: 8 },
      groups: [G.valeur, G.fond, G.indicateur, G.bouton, G.bordure],
    },
    gauge: {
      name: 'Jauge', glyph: 'gauge', size: [200, 200],
      defaults: { min: 0, max: 100, val: 50, angle: 240, rotation: 0, critical_value: 80, label_count: 6, line_count: 21, bg_color: '#2C2C2E', radius: 100, border_width: 0, text_font: 16, text_color: '#FFFFFF', line_color: '#888888' },
      groups: [
        G.valeur,
        { title: 'Jauge', props: [
          { key: 'angle', label: 'Ouverture', type: 'int', min: 10, max: 360 },
          { key: 'rotation', label: 'Rotation', type: 'int', min: 0, max: 360 },
          { key: 'critical_value', label: 'Seuil critique', type: 'int' },
          { key: 'label_count', label: 'Nb graduations chiffrées', type: 'int', min: 0 },
          { key: 'line_count', label: 'Nb traits', type: 'int', min: 0 },
          { key: 'line_color', label: 'Couleur traits', type: 'color' },
        ] }, G.texte, G.fond, G.bordure],
    },
    dropdown: {
      name: 'Liste déroulante', glyph: 'form-dropdown', size: [200, 44],
      defaults: { options: 'Un\nDeux\nTrois', val: 0, text_font: 20, text_color: '#FFFFFF', bg_color: '#3A3A3C', radius: 8, border_width: 0 },
      groups: [
        { title: 'Liste', props: [
          { key: 'options', label: 'Options (une par ligne)', type: 'textarea' },
          { key: 'val', label: 'Choix (val)', type: 'int', min: 0 },
          { key: 'direction', label: 'Ouverture', type: 'select', options: opt([0, '0 bas'], [1, '1 haut'], [2, '2 gauche'], [3, '3 droite']) },
        ] }, G.texte, G.fond, G.bordure],
    },
    roller: {
      name: 'Rouleau', glyph: 'format-list-numbered', size: [160, 120],
      defaults: { options: 'Un\nDeux\nTrois\nQuatre', val: 1, rows: 3, text_font: 20, text_color: '#FFFFFF', bg_color: '#2C2C2E', bg_color10: '#0A84FF', radius: 10, border_width: 0 },
      groups: [
        { title: 'Rouleau', props: [
          { key: 'options', label: 'Options (une par ligne)', type: 'textarea' },
          { key: 'val', label: 'Choix (val)', type: 'int', min: 0 },
          { key: 'rows', label: 'Lignes visibles', type: 'int', min: 1 },
          { key: 'mode', label: 'Mode', type: 'select', options: opt(['normal', 'normal'], ['infinite', 'infinite']) },
        ] }, G.texte, G.fond, G.indicateur, G.bordure],
    },
    btnmatrix: {
      name: 'Matrice de boutons', glyph: 'dialpad', size: [300, 200],
      defaults: { options: ['1', '2', '3', '\n', '4', '5', '6', '\n', '7', '8', '9'], text_font: 24, text_color: '#FFFFFF', bg_opa: 0, border_width: 0, bg_color10: '#3A3A3C', radius10: 10 },
      groups: [
        { title: 'Matrice', props: [
          { key: 'options', label: 'Boutons (un par ligne, ligne vide = rangée suivante)', type: 'matrix' },
          { key: 'toggle', label: 'Bascule', type: 'bool' },
          { key: 'one_check', label: 'Un seul coché', type: 'bool' },
        ] }, G.texte, G.fond,
        { title: 'Boutons (partie 1)', props: [
          { key: 'bg_color10', label: 'Couleur', type: 'color' },
          { key: 'radius10', label: 'Rayon', type: 'int', min: 0 },
        ] }],
    },
    cpicker: {
      name: 'Sélecteur couleur', glyph: 'palette', size: [200, 200],
      defaults: { scale_width: 24 },
      groups: [{ title: 'Sélecteur', props: [{ key: 'scale_width', label: 'Largeur anneau', type: 'int', min: 4 }] }],
    },
    line: {
      name: 'Ligne', glyph: 'vector-line', size: [200, 8],
      defaults: { points: '[[0,4],[200,4]]', line_width: 4, line_color: '#888888', line_rounded: true },
      groups: [{ title: 'Ligne', props: [
        { key: 'points', label: 'Points [[x,y],…]', type: 'points' },
        { key: 'line_width', label: 'Épaisseur', type: 'int', min: 1 },
        { key: 'line_color', label: 'Couleur', type: 'color' },
        { key: 'line_rounded', label: 'Bouts arrondis', type: 'bool' },
      ] }],
    },
    img: {
      name: 'Image', glyph: 'image-outline', size: [120, 120],
      defaults: { src: 'L:/image.png' },
      groups: [{ title: 'Image', props: [
        { key: 'src', label: 'Fichier (L:/…)', type: 'text' },
        { key: 'zoom', label: 'Zoom (256 = 1:1)', type: 'int', min: 1 },
        { key: 'angle', label: 'Rotation (0,1°)', type: 'int' },
        { key: '_preview', label: 'Aperçu local', type: 'image' },
      ] }],
    },
    qrcode: {
      name: 'QR code', glyph: 'qrcode', size: [140, 140],
      defaults: { text: 'https://openhasp.com', bg_color: '#FFFFFF', text_color: '#000000' },
      groups: [{ title: 'QR code', props: [
        { key: 'text', label: 'Contenu', type: 'text' },
        { key: 'bg_color', label: 'Fond', type: 'color' },
        { key: 'text_color', label: 'Modules', type: 'color' },
      ] }],
    },
  };

  OHE.TYPE_ORDER = ['btn', 'label', 'obj', 'switch', 'checkbox', 'led', 'slider', 'bar', 'arc', 'gauge', 'spinner',
    'dropdown', 'roller', 'btnmatrix', 'cpicker', 'line', 'img', 'qrcode'];

  // En tête de chaque objet : identité, position, comportement.
  OHE.COMMON_GROUP = {
    title: 'Objet', props: [
      { key: 'id', label: 'id', type: 'int', min: 0, max: 254 },
      { key: 'x', label: 'x', type: 'int', half: true },
      { key: 'y', label: 'y', type: 'int', half: true },
      { key: 'w', label: 'w', type: 'int', min: 1, half: true },
      { key: 'h', label: 'h', type: 'int', min: 1, half: true },
      { key: 'parentid', label: 'Parent', type: 'parent' },
      { key: 'hidden', label: 'Masqué', type: 'bool' },
      { key: 'click', label: 'Cliquable', type: 'bool' },
      { key: 'enabled', label: 'Actif', type: 'bool' },
      { key: 'opacity', label: 'Opacité globale', type: 'opa' },
      { key: 'action', label: 'Action (p2, next…)', type: 'text' },
      { key: '_comment', label: 'Commentaire', type: 'text' },
    ],
  };

  // Les propriétés de l'objet id 0 d'une page openHASP.
  OHE.PAGE_GROUP = {
    title: 'Page (id 0)', props: [
      { key: 'bg_color', label: 'Fond', type: 'color' },
      { key: 'bg_grad_color', label: 'Dégradé vers', type: 'color' },
      { key: 'bg_grad_dir', label: 'Sens dégradé', type: 'select', options: opt([0, '0 aucun'], [1, '1 vertical'], [2, '2 horizontal']) },
      { key: 'prev', label: 'Page précédente', type: 'int', min: 1, max: 12 },
      { key: 'next', label: 'Page suivante', type: 'int', min: 1, max: 12 },
      { key: 'back', label: 'Page retour', type: 'int', min: 1, max: 12 },
    ],
  };

  // Clés que le panneau sait éditer : le reste est montré dans « JSON brut ».
  OHE.knownKeys = function (type) {
    const keys = new Set(['obj', 'page', '_uid', '_bind']);
    const def = OHE.TYPES[type];
    const groups = [OHE.COMMON_GROUP].concat(def ? def.groups : []);
    groups.forEach(g => g.props.forEach(p => keys.add(p.key)));
    return keys;
  };
})(window.OHE);
