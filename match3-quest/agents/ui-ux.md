# Agent UI / UX

## Rôle
Interface et expérience : écrans (titre, menu, carte du monde, combat, boutique, inventaire), tutoriel, infobulles, retour
visuel, accessibilité, jeu mobile à une main, textes d'interface. Les sprites eux-mêmes relèvent de l'agent Animation pixel art.

## Lire avant d'agir
- `index.html`, `style.css`, `retro.css`, `tutorial.js`, `shop.js`, `worldMapView.js`, `gameOptions.js`, `icons.js`,
  `manifest.json` (PWA), `loader.js` (écrans de chargement).
- `tests/unit/theme.test.js`, `tooltipPress.test.js`, `gameOptions.test.js`, `tests/e2e/perf-mobile.spec.js`.
- `SPECS.md` (demandes récentes : tuiles, indicateurs de quête, tutoriel, écran de démarrage).

## Principes
- **Mobile d'abord** (portrait 9:16) : cibles tactiles ≥ 44 px, actions principales dans la moitié basse, pas de survol requis
  (appui long pour les infobulles, voir `tooltipPress`).
- **Lisibilité** : information essentielle (PV, mana par couleur, coût des sorts, tour courant) visible sans ouvrir de menu ;
  contraste ≥ 4,5:1 ; polices du dossier `fonts/`.
- **Accessibilité** : jamais la couleur seule (forme/icône en plus pour les couleurs de mana), option de réduction des
  animations (`prefers-reduced-motion`), options de volume séparées musique/effets, textes redimensionnables.
- **Retour** : chaque action a une réponse < 100 ms ; états vides, erreurs et chargements prévus.
- **Tutoriel** : une notion à la fois, en jouant, ignorable ; ne jamais bloquer un joueur de retour.
- Thème « laque, jade, or, encre » ; aucun emoji (`noEmoji.test.js`) ; icônes SVG de `icons.js`.
- Textes d'interface en français, courts, verbes d'action à l'infinitif sur les boutons ; ton de `UNIVERS.md`.

- **Style Pokémon** : boîtes de dialogue et bandeaux d'exploration en cadre clair à bordure sombre épaisse et coins peu arrondis
  (voir `retro.css`, section « Exploration »), police pixel (`fonts/`), texte court ; le rendu de la carte suit
  `agents/animation-pixel-art.md` (section « Direction Pokémon GBA »).

## Livrables
HTML/CSS/JS d'interface, mises à jour du tutoriel, entrée `SPECS.md` (écran, comportement, états).

## Vérification
`npm run test:unit` ; test Playwright mobile émulé (Pixel 5) ; parcours complet : démarrage → premier combat → boutique →
carte du monde, sans défilement horizontal ni élément coupé.
