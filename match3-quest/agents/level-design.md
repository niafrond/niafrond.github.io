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

- **Lecture à la Pokémon** : le pourtour d'une carte extérieure est dessiné en arbres serrés (`tilePainter.js`), les chemins en terre
  bordée guident vers les sorties, les rochers (`rock`) servent de barrières visibles ; éviter les obstacles isolés au milieu d'un
  chemin et laisser des couloirs de 2 tuiles minimum.
- Bâtiments d'époque : habitations en terre damée à toit de chaume, jamais de fenêtres vitrées ni de portes modernes (voir `agents/animation-pixel-art.md`).
- Salles d'arène : un rocher ou une colonne = un obstacle d'une case, estrade et allée centrale en chemin (voir `arena.js`).

## Chemins multiples (règles de profondeur)
- Chaque sanctuaire de soleil offre trois approches lisibles : **risque** (gardes à abattre, direct), **relationnel** (PNJ `parley` posé
  près des gardes, visible après une quête annexe : `showWhen` ; ses gardes portent `hideWhen` le même id), **découverte** (secrets,
  coffres, quêtes annexes de la région qui affaiblissent le soleil : `weakenedBy`). Les coordonnées de `story.js` sont celles de la carte
  14×10 d'origine, redisposées automatiquement par `world/expand.js` ; poser sur des cases libres, hors de la case du soleil.
- Les gardes sont `permanent` et en `group` ; un chemin ne doit jamais devenir une impasse (le PNJ `parley` et les gardes restent
  atteignables sans traverser l'aura du soleil). Voir `agents/scenario.md` pour les règles narratives.

## Contraintes de level design (à la Pokémon GBA)
Catalogue de contraintes de parcours à appliquer (ou à dessiner à la main dans les grilles natives) pour que les routes ne soient pas
des champs uniformes. Le générateur `world/levelDesign.js` en applique une partie automatiquement ; tout nouveau dessin doit les respecter.
- **Tracé sans retour** : corniche (`screen.ledges`) franchie d'un saut dans un seul sens ; au moins une par route ou zone sauvage ; le retour impose un détour d'au moins 20 pas ;
  jamais de zone réservée au saut (tout reste atteignable à pied).
- **Passage obligé par les herbes** : haie percée d'un unique passage de 2 à 5 cases planté de hautes herbes ; une route tracée (`=`) reste sûre.
- **Motifs d'obstacles** pour rompre la monotonie : chevron qui indique le sens, verger en quinconce, slalom, clairière d'herbes cernée, losange
  à entrée, peigne d'alcôves, diagonale, escalier, haie, îlot. Couloirs de 2 cases au moins, aucune poche inatteignable.
- **Caches invisibles** (`hidden`, 8 par route ou zone sauvage) nichées contre le relief, repérées par la Perception du qì (gǎn qì, niveau 8 ; « aura » est un terme occidental à éviter dans les textes) ; **coffres-pièges** (`mimic`, au moins 3 par carte de plein air, villages et sanctuaires compris) posés près d'un chemin,
  butin maigre : la récompense d'un vrai détour reste supérieure (30 · rang contre 4 · rang).
- **Coffres refermés** : au retour sur une carte, quelques coffres déjà ouverts se referment en mimiques (jamais ceux dont dépend une quête ou une condition) ; **perception du qì** : on touche le héros, 5 s, flèche rouge vers la cache la plus proche.
- **Cartes vastes et contour irrégulier** : routes et zones sauvages natives agrandies par `world/enlarge.js` (64 de large, excroissances et coins rognés) ; ne pas dessiner de grille native au-delà de 64×64 / 1500 cases, l'agrandissement s'applique par-dessus.
- **Entrées et sorties variées** : `world/index.js` `TURNS` fait entrer ou sortir certaines routes par le haut ou le bas (jamais toujours ouest → est) ; un village a quatre ancres `<` `>` `^` `v`, une zone sauvage mène toujours au sanctuaire par l'est.
- **Brouillard de guerre** : la minimap grise les cases jamais vues ; prévoir des repères visibles de loin (tours, arbres remarquables).
- À envisager ensuite : cartes plus vastes et silhouettes non rectangulaires (grilles natives à redessiner), portes à clé de biome, ponts à sens unique.

## Livrables
Cartes ASCII dans `world/maps/<R>.js` (jamais `world/mapKit.js`), entités référencées par des ids existants des textes
(`world/text/<R>.js` fournis par l'agent Scénario), entrée `SPECS.md`.

## Vérification
`npm run test:unit` (`world.test.js`, `terrain.test.js`, `exploration.test.js`, `junctions.test.js`) : cartes valides,
connexes, sorties cohérentes, PNJ et coffres tous atteignables.
