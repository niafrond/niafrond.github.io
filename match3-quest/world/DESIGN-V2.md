# Grand Monde v2 — conception des cartes « à la Kanto GBA »

Sources : `inspiration/pokemon-red-green-and-blue-versions-full-overworld-and-interiors-guide-game-boy-map.webp` (tout Kanto, extérieurs +
intérieurs) et surtout `inspiration/pokemon-firered-and-leafgreen-versions-kanto-gba-map.webp` (le plein air seul, continu, retenu comme référence).

Ce document est le **contrat** de la refonte. Il complète `world/FORMAT.md` (format des cartes ASCII, toujours valable) ; en cas de
divergence, ce document l'emporte pour tout ce qui concerne la taille, la topologie, les routes et les hautes herbes.

## 1. Ce que la carte FireRed nous apprend

1. **Un monde extérieur continu** : chaque écran se prolonge dans le suivant par ses bords, sans écran de transition ; seuls les intérieurs sont des warps.
2. **Deux types d'écrans bien distincts** : les *villes* (blocs compacts, ceinturés d'arbres, bâtiments, places dallées, 2 à 4 portes de sortie)
   et les *routes* (couloirs longs et étroits, 6 à 12 cases de large, bordés de falaises, d'arbres ou d'eau, qui tournent et se rejoignent).
3. **Une boucle, pas une ligne** : le monde est un anneau avec des cordes (raccourcis) et un grand carrefour central à 4 sorties.
4. **Du relief lisible** : rebords, lacs, ponts, culs-de-sac cachés avec un coffre, grandes nappes d'herbe, et au bout de chaque route la ville suivante.
5. **De longues distances** : on marche ; une route fait plusieurs écrans de téléphone de long (la caméra défile, tuile ≥ 44 px).

## 2. Macro-carte

### 2.1 Chaîne principale (phase 1 — livrée avec ce travail)

Avant : `sanctuaire(R-1) ─► <R>_village ─► <R>_wild ─► <R>` (village collé au sanctuaire précédent).
Après : une **route d'accès** `<R>_road` s'intercale (ex. « Route 2 » de Kanto) :

```
 <R-1> (sanctuaire) ──E──► <R>_road ──E──► <R>_village ──E──► <R>_wild ──E──► <R> (sanctuaire, Soleil-Boss) ──E──► <R+1>_road …
                                                │                  └──S──► <R>_hamlet (hameau, sans ennemi)
                                                └─ portes ► maisons (intérieurs inchangés)
```

* 9 nouvelles cartes `<R>_road` pour `fleuve … lune` (rizieres n'en a pas : c'est le début du jeu, il garde son village comme point d'apparition).
* La zone sauvage `<R>_wild` devient la **route principale** de la région (grande, tortueuse, avec les hautes herbes les plus riches).
* Tous les ids existants (écrans, PNJ, coffres, ennemis, quêtes, jonctions) sont **conservés** ; seuls la géométrie et les contenus ajoutés changent.

### 2.2 Cordes et donjons (phase 2 — après la phase 1, hors périmètre de ce lot)

* 3 **raccourcis** qui ferment la boucle et font des villages des carrefours à 4 sorties (ancres `^` et `v`) :
  `rizieres_village ^↔v mer_village`, `fleuve_village ^↔v fauves_village`, `bambous_village ^↔v volcan_village`, fermés par `requires`
  tant que le Soleil de la région la plus avancée n'est pas tombé.
  **Dès la phase 1, chaque village dessine déjà ses 4 ancres `<` `>` `^` `v`** (les deux inutilisées sont fermées par les barrières de bordure).
* Donjons à étages (grottes / cryptes / tours : 2 à 3 niveaux reliés par escaliers), portes à énigme, salles de maître de région (intérieurs).

## 3. Gabarits d'écran (phase 1)

Contraintes communes : `w·h ≤ 1500` et `w, h ≤ 64` (calque de sol mis en cache ≤ 16 Mpx) ; couronne extérieure de 2 cases fermée par `#` (ou eau
selon le biome) ; une seule ancre par bord (`<` ouest, `>` est, `^` nord, `v` sud) avec **une tuile libre juste à l'intérieur** ; tous les
passages sont centrés sur leur ancre, alignés avec la carte voisine automatiquement (`linkGates`), donc la hauteur de `<` d'une carte
n'a pas besoin d'être celle de `>` de la précédente.

| Gabarit | id | Taille native | Rôle | Contenu |
|---|---|---|---|---|
| Ville (village) | `<R>_village` | 32×28 | zone sûre, 4 ancres de bord, place centrale, 6 à 8 bâtiments (`A`–`H`), marché | PNJ existants + nouveaux (≥ 8), 4–5 coffres, `W` pierre de voyage, 1 *cul-de-sac* caché avec coffre |
| Route d'accès (`road`) | `<R>_road` | 44×16 (ou 16×44 si l'auteur la fait tourner : `<` et `>` restent sur les bords ouest / est, donc en pratique 44×16 à 52×18) | couloir de transition ; hautes herbes ; rencontres | 3 à 6 ennemis (≥ 1 patrouilleur), 2–3 coffres, 1 PNJ de route, 0–1 pierre de voyage |
| Route principale (`wild`) | `<R>_wild` | 48×24 (`lune` : 40×22) | cœur de la région, gate du sanctuaire | 8 à 14 ennemis (≥ 3 patrouilleurs, mini-boss `permanent` du gate), 6–9 coffres, 3+ PNJ, `W`, ancre `v` du hameau |
| Hameau | `<R>_hamlet` | 28×22 | zone sûre | 3+ PNJ, 2–3 coffres, 2–3 bâtiments |
| Sanctuaire | `<R>` | 30×22 (grille native, `sanctuary.grid`) | arène du Soleil-Boss | entités de `story.js` conservées (placées par ancre), approche par couloir étroit |

### Les bâtiments et les intérieurs
Les intérieurs (`interiors`) ne sont **pas** refaits en phase 1 (ids, grilles, textes inchangés). Une lettre de bâtiment du village / du hameau
peut être réaffectée tant que `interiors[].house` suit et que la porte reste sur la rangée du bas. Les nouveaux bâtiments décoratifs (sans porte
fonctionnelle) ne sont pas autorisés : tout bâtiment `A`–`H` a un intérieur.

## 4. Vocabulaire de terrain (dessiner comme sur la carte FireRed)

Légende ASCII de `FORMAT.md` + **`"` = hautes herbes** (nouveau). Rappels de composition :

* **Ville** : un « bloc » dense entouré d'une ceinture de `#` (arbres, roseaux, rochers selon le biome) de 2 cases ; une place (`=`) en croix ou en
  anneau ; bâtiments sur 2 rangées ; une ouverture par ancre de bord ; ruelles de 2 cases ; un étang ou un jardin clos.
* **Route** : couloir de 6 à 12 cases de large dont les parois sont **irrégulières** (falaises de `#` de 2 à 5 cases d'épaisseur, jamais une
  droite parfaite) ; alternent goulets (3 à 4 cases), bassins (10 à 16 cases), coudes ; un lac ou une rivière `~` traversé par un pont `=` d'1 à
  2 cases ; chemin `=` qui serpente mais n'est pas obligatoire ; 1 ou 2 **niches de coffre** accessibles seulement par un détour.
* **Nappes d'herbe** : ellipses ou blobs de `"` de 12 à 60 cases, posés sur les bassins des routes, jamais sur le chemin principal sur plus de la
  moitié de sa longueur (on doit pouvoir traverser sans rencontre en prenant le chemin, au prix d'un détour).
* **Tailles** : pas de grille remplie à plus de 55 % d'obstacles ; au moins 40 % de cases franchissables ; le chemin `S`/`<` → `>` mesure au
  moins la largeur de la carte (pas de ligne droite : 1,2 × la distance à vol d'oiseau minimum).
* Les écrans de **mer** (`mer_archipel`, `mer_ile_dragon`), les grottes/cryptes (`underground.js`) et l'aquatique (`aquatic.js`) ne sont pas touchés.

## 5. Hautes herbes et rencontres aléatoires

### Données (par carte `wild`, `road`, `sanctuary` — jamais village, hameau, intérieur, arène)
```js
grass: {
    rate: 0.12,          // probabilité par pas sur une case d'herbe, après `safeSteps` pas (défaut 0.12)
    safeSteps: 3,        // pas d'herbe sans rencontre, après l'arrivée sur la carte ou après un combat (défaut 3)
    table: [             // 3 à 5 entrées ; `templateId` ∈ enemies.catalog.json
        { templateId: 'fungal_horror', name: 'Crapaud de boue',      weight: 5, offset: -1 },
        { templateId: 'goblin_saboteur', name: 'Voleur d\'eau',        weight: 4, offset:  0 },
        { templateId: 'forest_guardian', name: 'Esprit des diguettes', weight: 1, offset:  1 }   // la « rare »
    ]
}
```
Les cases sont posées dans la grille avec `"` ; le moteur les lit en `screen.grass = { cells: [[x,y,w,h],…], rate, safeSteps, table }`.

### Règles de jeu
* Un pas sur une case `"` (arrivée comprise) avance un compteur ; au-delà de `safeSteps`, tirage `rate` : succès → combat contre une créature
  du `table` (tirage pondéré), niveau = niveau de région + `offset` (jamais < 1, jamais de `boss`).
* Combat **non persistant** : le rencontré n'est pas inscrit dans `defeated`, ne compte pour aucune quête de zone, ne réapparaît pas sur la carte.
  L'or et l'XP du combat s'appliquent normalement ; la défaite se comporte comme celle d'un ennemi de la carte.
* Rien en zone sûre, ni tant que `session.rt.grace > 0`, ni dans les maisons / arènes. Le tirage utilise un RNG injectable (`ctx.random`)
  pour des tests déterministes ; l'état `session.rt.grassSteps` n'est pas sauvegardé.
* Rendu : touffes hautes et plus sombres que l'herbe normale (`tilePainter.js`), léger frémissement au passage du héros ; l'ancienne `tallGrass`
  de `terrain.js` (case unique sous un patrouilleur) est conservée telle quelle.
* Densité cible (part des cases franchissables) : rizieres 6 %, fleuve 7 %, bambous 9 %, gobi 8 %, tonnerre 9 %, volcan 10 %, fauves 18 %
  (grande plaine façon Zone Safari), mer 8 %, fusang 10 %, lune 6 %. Les `road` ont la moitié de la densité de leur `wild`.
* Première rencontre de la partie : toast d'explication « Des créatures se cachent dans les hautes herbes. »

## 6. Briefs par région (inspiration Kanto → identité de la route)

| Région | Analogue Kanto | `road` | `wild` (route principale) |
|---|---|---|---|
| rizieres | Bourg Palette / Route 1 | — (le village est le départ) | digues en damier, marais craquelé, premières hautes herbes (leçon) |
| fleuve | Jadielle / Route 2 | passerelle sur méandres | lit asséché, ponts, îlots de vase, longue berge |
| bambous | Forêt de Jadielle / Argenta | sentier de moines | forêt-labyrinthe (parois de bambous), clairières d'herbe |
| gobi | Routes 3-4 / Mont Sélénite | piste caravanière | canyon de dunes, falaises, oasis, cul-de-sac à coffre |
| tonnerre | Azuria / pont Pépite | escalier de crêtes | terrasses à étages en lacets, ponts de corde |
| volcan | Carmin / Centrale | galerie de basalte | rivières de lave, cendres hautes (herbes de cendre) |
| fauves | Parc Safari / Cyclo-route | piste des troupeaux | vaste plaine : grandes nappes d'herbe, bosquets |
| mer | Routes 19-20 / Cramois'Île | jetée | côte, pontons, bancs de sable, criques |
| fusang | Route Victoire | racines géantes | terrasses montantes, escaliers, nuages bas |
| lune | Plateau Indigo | sentier lunaire | sentier court, marches de jade, lac de lune |

## 7. Propriété des fichiers (agents en parallèle)

| Lot | Agent | Fichiers (exclusifs) |
|---|---|---|
| A1 | Moteur herbes hautes | `exploration.js`, `explorationView.js`, `tilePainter.js`, `terrain.js` (en lecture), `game.js` si nécessaire, `tests/unit/grass.test.js` |
| A2 | Moteur routes / grilles natives / outil d'aperçu | `world/index.js`, `world/mapKit.js`, `world/expand.js`, `world/spots.js`, `world/FORMAT.md`, `story.js` (REGION_ENTRY_SCREEN uniquement), `tools/map-preview.mjs`, tests `world`, `expand`, `mapBorders`, `junctions`… |
| B1–B5 | Régions (2 par agent) | `world/maps/<R>.js`, `world/text/<R>.js` de leurs 2 régions, rien d'autre |
| C | Intégrateur (le chef) | `SPECS.md`, `world/DESIGN-V2.md`, `world/connections.js`, `world/maps/index.js`, `world/text/index.js`, tests transverses |

Vérification de chaque région : `node tools/map-preview.mjs <screenId>` (aperçu ASCII de la carte assemblée + atteignabilité) puis
`npx jest match3-quest/tests/unit/<fichier> -t <regionId>` sous WSL (Ubuntu-22.04, nvm Node 22). La suite complète est lancée par l'intégrateur.

## 8. Critères de réussite
1. Les 47 suites existantes restent vertes (contraintes de nombre d'ennemis / tailles adaptées dans les tests, jamais supprimées).
2. Chaque carte est connexe : toute ancre, entité et passage atteignable à pied depuis l'apparition sans passer par le gate.
3. Aucune bordure ouverte hors passage ; couloirs d'arrivée dégagés (`mapBorders.test.js`).
4. Chaque `wild` et `road` a une table de hautes herbes valide et au moins une nappe ≥ 12 cases, atteignable.
5. Aucun id existant retiré ; aucun emoji ; textes en français, ton de `UNIVERS.md`.

## 9. Précisions issues du moteur livré (A1 / A2) — prioritaires sur ce qui précède

Syntaxe exacte : `world/FORMAT.md` §9 « Format v2 ». Aperçu d'une carte assemblée : `tools/map-preview.mjs <screenId> [--routes]` (sous WSL).

* **Couronne de bordure** : le pipeline recalcule le pourtour (eau ou barrière de biome, `openPerimeter` / `addWaterBorder` / `addBorderBarriers`). La ceinture de `#`
  dessinée sur le bord est remplacée : on ne garde que 2 cases libres d'entités sur chaque bord, le relief se dessine à l'intérieur (≥ 3 cases du bord).
* **Nombre d'ennemis** = celui de la carte assemblée (gardiens ajoutés par `junctions.js` compris, notamment `*_hamlet_guardian` à bambous, tonnerre, fauves, fusang) :
  une wild native avec hameau gardé déclare au plus 13 ennemis.
* **Boss et passages verrouillés** : un ennemi cité par un `requires` de sortie est ramené 2 cases devant le passage (`guardLockedGates`) ; garder un couloir dégagé devant `>`.
  Les sentinelles `level_guard_*` se posent 4 à 6 cases à l'intérieur du passage est du sanctuaire précédent (donc à l'ouest de la `road`, à l'est du sanctuaire).
* **Sanctuaire** : `places` couvre TOUTES les entités de `story.js` de la région (PNJ, coffres, ennemis dont le Soleil-Boss, `spawn`, `waypoint`, sorties) ; forme
  `ancre` | `[x, y]` | `{ at, patrol: [...] }` (un patrouilleur se donne toujours en `{ at, patrol }`). L'erreur d'assemblage liste les entités manquantes.
* `"` sans `grass.table` est une erreur d'assemblage ; `grass.cells` est purgé des cases devenues bloquées (eau de bordure, décor, bâtiment).
* Une road non native serait étirée à 28×22 : toujours `native: true`.
* `REGION_ENTRY_SCREEN` reste `<R>_village`. Le texte d'arrivée historique du sanctuaire passe au village s'il n'en a pas.
* Le hameau de `mer` déclare lui-même sa sortie vers `mer_archipel` (`exits: [{ x: w - 1, y, to: 'mer_archipel' }]`, `aquatic.js` complète verrou et libellé).
* Créature des hautes herbes : le combat affiche le nom de la table (`encounter.name`, `enemies.js`).
