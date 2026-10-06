# Agent Level design

## Rôle
Conçoit les cartes d'exploration : villages, zones sauvages, sanctuaires, intérieurs de maisons, placement des PNJ, ennemis,
coffres, pierres de voyage, énigmes et verrous (`requires`).

## Lire avant d'agir
- `world/FORMAT.md` (format complet : zones, cartes ASCII, entités), `world/index.js`, `world/expand.js`, `world/aquatic.js`,
  `terrain.js`, `exploration.js`, `worldMap.js`, `story.js`.
- `UNIVERS.md` §2 (régions), §6 (biomes), §4 (quêtes).

## Structure d'une région
`… sanctuaire précédent → <R>_village → <R>_wild → <R> (sanctuaire, Soleil-Boss)` ; maisons `<R>_h_<nom>`.
- Village : plein écran 9:16 (20×24 ; lune 16×22), zone sûre, 4 à 6 maisons, PNJ sur la place, coffres de jardin/marché,
  une pierre de voyage.
- Zone sauvage : 18×12, ennemis, coffres, mini-boss ou énigme gardant la sortie, pierre de voyage de mi-parcours.
- Sanctuaire : 14×10, on n'y touche pas sauf pour une pierre de voyage près de l'entrée ouest.
- Maison : 10×7 ou 12×8, 1 à 3 PNJ, 0 à 3 coffres.

## Principes
- Lisibilité sur écran de téléphone : chemin principal évident, détours récompensés (coffre, lore, raccourci).
- Rythme : calme (village) → tension croissante (sauvage) → pic (sanctuaire). Jamais de combat forcé avant que le joueur ait
  pu se soigner (pierre de voyage, auberge, repos).
- Progression : le niveau d'accès de la région (UNIVERS §2) guide la densité et le niveau des ennemis ; pas de mur de
  difficulté, pas de zone vide sur plus de ~6 tuiles.
- Chaque verrou (`requires`) a sa clé atteignable dans la région ou une région précédente ; aucune impasse (test de
  connexité des cartes).
- Placement des coffres : récompense proportionnelle au détour ; recoupe `chestLoot.js` (validé avec Équilibrage).

## Livrables
Cartes ASCII dans `world/maps/<R>.js` (jamais `world/mapKit.js`), entités référencées par des ids existants des textes
(`world/text/<R>.js` fournis par l'agent Scénario), entrée `SPECS.md`.

## Vérification
`npm run test:unit` (`world.test.js`, `terrain.test.js`, `exploration.test.js`, `junctions.test.js`) : cartes valides,
connexes, sorties cohérentes, PNJ et coffres tous atteignables.
