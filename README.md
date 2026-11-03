# OpenHASP Editor

Éditeur visuel de pages [openHASP](https://www.openhasp.com) : on dessine les pages à la souris, l'éditeur écrit le
`pages.jsonl` à envoyer sur la platine. Il sert à toute platine openHASP 0.7, quelle que soit la domotique qui la pilote
(Home Assistant, Node-RED, openHAB…), et à toute taille d'écran.

Il a aussi un mode dédié à [Krissvia](#mode-page-perso-krissvia), pour dessiner la page perso de ses platines.

Rien à installer ni à compiler : HTML, CSS et JavaScript, sans dépendance de build.

## Lancer

- Double-cliquer sur `index.html`, ou
- servir le dossier :

```bash
python -m http.server 8480
```

puis ouvrir <http://localhost:8480>.

Internet sert uniquement à la police Roboto Condensed ; celle des icônes (Material Design Icons) est dans `fonts/`.
Le projet est sauvegardé tout seul dans le navigateur (localStorage) à chaque modification.

## Mode pages.jsonl openHASP

Le mode par défaut d'un nouveau projet.

- **Pages** : autant que voulu, plus la page 0, commune à toutes et affichée par-dessus. Chaque page a ses propriétés
  (l'objet `id:0`) et un commentaire.
- **Écran** : rien de sélectionné, les propriétés de la page proposent les tailles courantes (320 × 240, 480 × 320,
  480 × 480, 800 × 480…), en paysage ou en portrait, ou une taille libre.
- **Export** : toutes les pages, avec la clé `page`, commentaires en `{"comment"}`. À téléverser sur la platine sous le
  nom `pages.jsonl` (page HTTP de la platine, onglet *File Editor*), ou à envoyer en commande `jsonl`.
- **Vérif** : ids de 1 à 254, ids en double, parents introuvables, objets hors de l'écran, icônes absentes du firmware.

Polices : le firmware a Roboto Condensed en 12, 16, 24 et 32 px ; toute autre taille passe par sa version TrueType
(openHASP 0.7, PSRAM conseillée).

## Mode page perso Krissvia

Pour la page 5 des platines Guition 480 × 480 pilotées par Krissvia (plugin OpenHasp).

| Ce qui est exporté | Contraintes vérifiées |
|---|---|
| les lignes de la page perso, sans `page` (Krissvia la force à 5), commentaires en `//` | id de 1 à 254, **id 50 refusé** (fond), polices 16/20/24/28/32/48/84, rien sous la barre de navigation (y ≥ 435) |

La toile montre ce que le plugin ajoute de lui-même, sans l'exporter : le **fond** (objet 50, couleur des réglages
« Affichage ») et la **barre de navigation** (nombre de pages présentes et nom de la page perso réglables).

Chaque objet peut recevoir une **liaison** (panneau Propriétés) :

- **Affiche une valeur** : entité, attribut `text` ou `val`, format (`Salon {} °C`), champ (`temperature`, `target`).
- **Commande** : un bouton qui allume ou éteint un interrupteur ou une lumière. Seulement un `btn` : Krissvia ne
  réagit qu'à l'événement `up`, qu'un `switch` ou une case n'envoient pas. Choisir ce rôle coche `toggle` et donne une
  couleur `bg_color01` (vert) si le bouton n'en a pas : il reste enfoncé, de cette couleur, tant que l'entité est allumée.

L'onglet **JSONL** donne alors deux choses : le JSONL à coller dans « Page perso » des réglages de la platine, et le
fragment complet (`NomPagePerso`, `PagePerso`, `AffichagesPerso`, `BoutonsPerso`) pour `appsettings.Local.json`.

## Utilisation

- **Composants** : un clic ajoute au centre, un glisser pose à l'endroit voulu.
- **Toile** : aimantation à la grille et aux bords ou centres des autres objets (guides roses) ; `Alt` pendant le
  glisser pour la couper, `Maj` sur une poignée d'angle pour garder les proportions.
- **Clavier** : flèches (1 px, `Maj` : un pas de grille), `Suppr`, `Ctrl+C/V/X/D`, `Ctrl+Z/Y`, `Ctrl+A`, `Ctrl+S`
  (enregistre le projet), `Ctrl+molette` (zoom), `Espace` + glisser (défiler), `0` (ajuster).
- **Icônes** : bouton 😊 à côté d'un texte. Le sélecteur propose les 146 icônes MDI de la police du firmware openHASP
  0.7, par thème, utilisables à toutes les tailles. Elles s'écrivent `\uExxx` (codepoint F0xxx) ou `\uFxxx` (F1xxx),
  comme sur les platines. Une autre icône MDI ne s'afficherait pas : l'onglet Vérif la signale.
- **Retour à la ligne** dans un texte : `\n`.
- **Boutons à bascule** : `toggle` coché, la couleur « Fond enfoncé » (`bg_color01`) montre l'état `val` = 1.
- **Arcs** : openHASP 0.7 dessine l'arc dans le carré en haut à gauche de l'objet ; l'aperçu, l'alignement et
  l'aimantation suivent ce cercle. Un arc carré évite les surprises.
- **Plan** : l'ordre du fichier, qui est aussi l'ordre d'empilement (le premier est dessous), et l'œil pour `hidden`.
- **JSON brut** (en bas des propriétés) : toutes les propriétés de l'objet, y compris celles que l'éditeur ne propose
  pas (`text_font` d'une autre partie…). Elles sont gardées et exportées.
- **Ouvrir** : un projet `.ohe.json`, ou n'importe quel `pages.jsonl` / page perso. On peut aussi déposer le fichier
  sur la fenêtre, ou coller du JSONL via « Importer… » (onglet JSONL).

Une propriété laissée vide n'est pas écrite : la platine applique celle de son thème. Les objets ajoutés depuis la
palette portent leurs couleurs explicitement, et boutons et panneaux sortent en fond uni (sans le dégradé du thème),
pour que l'aperçu et la platine se ressemblent.

## Fichiers

```
index.html       la page
css/app.css      l'interface
js/schema.js     objets openHASP, propriétés, icônes du firmware, valeurs à la création
js/render.js     aperçu HTML/SVG des objets (approximation de LVGL)
js/jsonl.js      export, import, vérifications, réglages Krissvia
js/app.js        état, toile, sélection, panneaux, historique
fonts/           police Material Design Icons 7.4.47 (copie locale, Apache 2.0)
```

## Limites connues

- L'aperçu est une approximation : polices, marges internes et styles du thème openHASP peuvent différer de quelques
  pixels. La vérité reste la platine.
- Écrit pour openHASP 0.7 (LVGL 7) : la 0.6 et les versions suivantes peuvent dessiner autrement.
- `tabview`/`tab` et `msgbox` ne sont pas dans la palette (ils s'importent et s'exportent quand même, via le JSON brut).
- Pas d'envoi direct à la platine : télécharger le JSONL, puis le téléverser (ou le coller dans les réglages Krissvia).
- Interface en français.
