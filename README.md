# OpenHASP Editor

Éditeur visuel de pages [openHASP](https://www.openhasp.com) : on dessine la page à la souris, l'éditeur écrit le
JSONL. Pensé pour la **page perso (page 5) des platines Guition 480×480 de Krissvia**, il sait aussi produire un
`pages.jsonl` openHASP complet (plusieurs pages, page 0 commune).

Rien à installer ni à compiler : HTML, CSS et JavaScript, sans dépendance de build.

## Lancer

- Double-cliquer sur `index.html`, ou
- servir le dossier (conseillé, la liste complète des icônes MDI se charge alors sans souci) :

```bash
python -m http.server 8480
```

puis ouvrir <http://localhost:8480>.

Internet sert uniquement aux polices (Roboto Condensed, Material Design Icons). Le projet est sauvegardé tout seul dans
le navigateur (localStorage) à chaque modification.

## Les deux modes

| Mode | Ce qui est exporté | Contraintes vérifiées |
|---|---|---|
| **Page perso Krissvia** | les lignes de la page perso, sans `page` (Krissvia la force à 5), commentaires en `//` | id de 1 à 254, **id 50 refusé** (fond), polices 16/20/24/28/32/48/84, rien sous la barre de navigation (y ≥ 435) |
| **pages.jsonl openHASP** | toutes les pages, l'objet `id:0` de chaque page, commentaires en `{"comment"}` | id de 1 à 254, ids en double, parents introuvables |

En mode Krissvia, la toile montre ce que le plugin ajoute de lui-même, sans l'exporter : le **fond** (objet 50, couleur
des réglages « Affichage ») et la **barre de navigation** (nombre de pages présentes et nom de la page perso réglables).

### Liaisons Krissvia

Chaque objet peut recevoir une **liaison** (panneau Propriétés) :

- **Affiche une valeur** : entité, attribut `text` ou `val`, format (`Salon {} °C`), champ (`temperature`, `target`).
- **Commande** : un bouton qui allume ou éteint un interrupteur ou une lumière. Seulement un `btn` : Krissvia ne
  réagit qu'à l'événement `up`, qu'un `switch` ou une case n'envoient pas. Avec `toggle` coché, le bouton reste enfoncé
  tant que l'entité est allumée (couleur de cet état : `bg_color01`).

L'onglet **JSONL** donne alors deux choses : le JSONL à coller dans « Page perso » des réglages de la platine, et le
fragment complet (`NomPagePerso`, `PagePerso`, `AffichagesPerso`, `BoutonsPerso`) pour `appsettings.Local.json`.

## Utilisation

- **Composants** : un clic ajoute au centre, un glisser pose à l'endroit voulu.
- **Toile** : aimantation à la grille et aux bords ou centres des autres objets (guides roses) ; `Alt` pendant le
  glisser pour la couper, `Maj` sur une poignée d'angle pour garder les proportions.
- **Clavier** : flèches (1 px, `Maj` : un pas de grille), `Suppr`, `Ctrl+C/V/X/D`, `Ctrl+Z/Y`, `Ctrl+A`, `Ctrl+S`
  (enregistre le projet), `Ctrl+molette` (zoom), `Espace` + glisser (défiler), `0` (ajuster).
- **Icônes** : bouton 😊 à côté d'un texte. Les icônes MDI s'écrivent `\uExxx` (codepoint F0xxx sans le « F0 »), comme
  sur les platines. Les icônes « vérifiées » sont celles qu'affichent déjà les pages Krissvia ; pour les autres, le
  firmware n'embarque qu'un sous-ensemble : à essayer sur la platine.
- **Retour à la ligne** dans un texte : `\n`.
- **Plan** : l'ordre du fichier, qui est aussi l'ordre d'empilement (le premier est dessous), et l'œil pour `hidden`.
- **JSON brut** (en bas des propriétés) : toutes les propriétés de l'objet, y compris celles que l'éditeur ne propose
  pas (`bg_color01`, `text_font` d'une autre partie…). Elles sont gardées et exportées.
- **Ouvrir** : un projet `.ohe.json`, ou n'importe quel `pages.jsonl` / page perso. On peut aussi déposer le fichier
  sur la fenêtre, ou coller du JSONL via « Importer… » (onglet JSONL).

Une propriété laissée vide n'est pas écrite : la platine applique celle de son thème. Les objets ajoutés depuis la
palette portent leurs couleurs explicitement, pour que l'aperçu et la platine se ressemblent.

## Fichiers

```
index.html       la page
css/app.css      l'interface
js/schema.js     objets openHASP, propriétés, valeurs à la création
js/render.js     aperçu HTML/SVG des objets (approximation de LVGL)
js/jsonl.js      export, import, vérifications, réglages Krissvia
js/app.js        état, toile, sélection, panneaux, historique
```

## Limites connues

- L'aperçu est une approximation : polices, marges internes et styles du thème openHASP peuvent différer de quelques
  pixels. La vérité reste la platine.
- `tabview`/`tab` et `msgbox` ne sont pas dans la palette (ils s'importent et s'exportent quand même, via le JSON brut).
- Pas d'envoi direct à la platine : télécharger le JSONL, ou le coller dans les réglages Krissvia.
