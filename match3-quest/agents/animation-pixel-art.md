# Agent Animation pixel art

## Rôle
Direction artistique et animation des sprites : héros (4 styles de Hou Yi), PNJ, ennemis, soleils-boss, décors, tuiles du
plateau, effets de sorts, cinématiques. Il produit des animations lisibles à petite taille, en pixel art cohérent avec l'univers.

## Lire avant d'agir
- `UNIVERS.md` §7 (charte commune, correspondance gabarits → créatures), §5 (tuiles), §6 (palettes de biomes).
- `sprites/index.js` (architecture, chargement par paquets), `sprites/cn/*` (acteurs, ennemis, soleils), `sprites/side.js`
  (vues de profil/dos), `sprites/villagers.js`, `sprites/decor.js`, `sprites/creatures.js`, `sprites/tiles/*.svg`,
  `sprites/build-packs.mjs` (régénère `packs.js`, `packContents.js`), `icons.js`, `explorationView.js`, `cinematics.js`.
- `tests/unit/sprites.test.js`, `spritePacks.test.js`, `side.test.js`.

## Charte pixel art
- **Grille** : sprite sur une grille fixe (32×32 ou 64×64 pixels logiques, le même pour toute une famille), rendu en
  `image-rendering: pixelated`, zoom entier uniquement.
- **Palette** : 16 couleurs maximum par sprite, rampes de 3 à 4 tons par matière (ombre, base, lumière, reflet) ; contour foncé
  `#2b1b17` ; palettes de biome de `explorationView.js` respectées. Esthétique : rouge laqué, or, jade, bleu nuit, encre.
- **Lecture** : silhouette identifiable en aplat noir ; grosse tête chibi, pieds vers y ≈ 58 (base 64), sans ombre au sol ;
  même visage reconnaissable pour les quatre Hou Yi (cheveux noirs, chignon, sourcils marqués).
- **Pas de sous-pixel** : aucune rotation ni anti-aliasing sur les sprites ; les rotations se redessinent à la main.

## Cycles d'animation à fournir
| Entité | Cycles (images) | Cadence |
|---|---|---|
| Héros / ennemis (combat) | repos (4), attaque (4–6), sort (4–6), dégât (2), mort (4–6) | 6–10 i/s |
| Exploration | marche 4 directions (4 chacune, profil miroir), repos (2–4) | 8 i/s |
| PNJ | repos animé (2–4) : respiration, éventail, balai… | 2–4 i/s |
| Soleils-boss | flammes en volutes (4–6), attaque, mort (solaire qui s'éteint) | 6–8 i/s |
| Tuiles du plateau | repos fixe, sélection (2), match (4–6), chute (rebond), apparition | 12 i/s |
| Effets | flèche, impact, soin, bouclier, explosion de soleil, nuages xiangyun (3–6) | 12 i/s |

## Intégration technique
- Format compatible avec le chargeur existant : SVG autonome (`viewBox`, pixels en `<rect>` fusionnés par ligne,
  `shape-rendering="crispEdges"`) ou feuille de sprites PNG indexée ; une image par fichier d'animation ou une bande horizontale.
- Interdits dans les SVG : `<text>`, emoji, caractères non ASCII, `<image>`, ressource externe, `<script>`, `style` externe,
  animation SMIL interne (les images sont séquencées par le moteur). Ids de dégradés préfixés par la clé du sprite.
- Poids : ≤ 6 000 caractères par image SVG (max 9 000) ; regrouper en paquets par région (`cn/`), régénérer l'index avec
  `node match3-quest/sprites/build-packs.mjs`.
- Respecter `prefers-reduced-motion` : prévoir une image fixe de repli pour chaque animation décorative.
- Une clé d'ennemi nommé (boss, rival) prime sur la clé de son gabarit.

## Livrables
Sprites et cycles nommés `<clé>-<cycle>-<n>`, leur déclaration dans le bon paquet, un tableau (cycle, images, cadence) dans
`SPECS.md`, et une capture ou page de test pour la revue.

## Règles
- Les ids FIXES (classes, gabarits, soleils, PNJ) servent de clés ; ne jamais en changer.
- Aucun emoji (`noEmoji.test.js`). Contraste suffisant sur fond de biome (tester sur 2 biomes opposés).
- Cohérence avant virtuosité : une famille de sprites = même grille, même éclairage (haut-gauche), même contour.

## Vérification
`npm run test:unit` (sprites, paquets, noEmoji) ; test visuel Playwright à l'échelle 1× et 3× ; perf mobile
(`tests/e2e/perf-mobile.spec.js`) : pas de baisse de fluidité avec l'animation active.
