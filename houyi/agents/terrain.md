# Agent Terrain

## Rôle
Possède la **géométrie et l'habillage des bords de carte** : quelles bordures se traversent (connexions de bordure), quelles
bordures sont fermées et par quel élément (eau, rochers, arbres, falaises, cristaux…) selon le biome, et la cohérence visuelle
entre les cartes voisines (même sol, même rive, passages alignés).

## Lire avant d'agir
- `mapConnections.js` (connexions : `dir`, `offset` / `align`, `range`, `requires`), `world/connections.js` (données),
  `world/barriers.js` (`addBorderBarriers`, `WATER_BIOMES`, `openRim`), `world/expand.js` (`addWaterBorder`, passages de bord),
  `terrain.js`, `tilePainter.js` (`BORDER_KIND`), `explorationView.js` (`BIOMES.decor`), `world/FORMAT.md`.

## Règles
- **Une bordure sans connexion est toujours fermée visuellement** : eau pour `coast`, `riverbed`, `paddy` (franchissable seulement avec le
  Pas de Yu à l'intérieur de la carte), sinon obstacle décoré par le biome (cactus du Gobi, pics du Volcan, acacias, arbres dorés,
  cristaux de la Lune, stalagmites des souterrains, pins par défaut). Jamais de rangée de bord praticable qui mène nulle part.
- Une connexion ouvre une portion de bordure (`range`, 3 cases par défaut pour les passages existants) : le reste du côté est fermé.
  Les cases ouvertes restent de la terre, alignées avec la carte voisine (`offset` / `align`), et la case d'arrivée est libre.
- Fermer une case ne doit rien rendre inaccessible : toute case, entité ou sortie atteignable à pied le reste (`addBorderBarriers`
  le vérifie case par case). Entités, bâtiments, apparition et trajets de patrouille ne sont jamais recouverts.
- Pas de barrière sur les intérieurs, l'arène ni les cartes de mer (`aquatic`), qui ont leurs propres bords.
- Un nouveau biome = une entrée dans `BIOMES` (`explorationView.js`), `BORDER_KIND` (`tilePainter.js`) et, si c'est un biome d'eau,
  dans `WATER_BIOMES`.
- Lisibilité mobile : couloirs d'au moins 2 cases, pas d'obstacle isolé au milieu d'un chemin (voir `agents/level-design.md`).

## Vérifications
- `tests/unit/mapConnections.test.js`, `tests/unit/barriers.test.js`, `tests/unit/expand.test.js` ; `npm run test:unit` reste vert.
- Mettre à jour `SPECS.md` (entrée datée en tête).
