# Plan : nouveau biome marin « Les Hautes-Eaux de la Lune Montante » (`marees`)

Statut : **préparation, rien n'est implémenté.** Dossier narratif rédigé par l'agent Scénario (§5), faisabilité technique vérifiée dans le code (§2).
Décisions de l'utilisateur : le sort requis est le **Pas de Yu existant** (quête `sq_pas_de_yu`, Gui à Hekou) ; la région se place **entre `fusang` (niv. 37) et `lune` (niv. 40)**, niveau conseillé **38**.

## 1. Cahier des charges

- Biome 100 % marin : sans le Pas de Yu le joueur ne peut ni traverser ni quitter l'entrée.
- Un PNJ près de l'entrée donne un **indice incomplet** sur la manière d'obtenir le Pas de Yu (utile à qui a ignoré la quête annexe).
- Toute l'eau se comporte comme de la **haute herbe** : rencontres aléatoires, ennemis forcément aquatiques.
- De **petits pontons chinois** (sans rencontre) permettent de souffler et d'avancer.
- Un **village de pêcheurs à demi submergé**, maisons sur pilotis (type *diaojiaolou* / *ganlan*, cohérent avec la Chine antique du Sud).

## 2. Faisabilité technique (déjà vérifiée)

**Le moteur sait presque tout faire.**
- `exploration.js` `encounterOf` : l'eau (`screen.liquids`) déclenche déjà des rencontres avec la table de hautes herbes de `<région>_wild` quand le héros la franchit. Aucun nouveau mécanisme de rencontre.
- Les cases non liquides (pontons `=`, village, digue) ne déclenchent rien : ce sont les « zones de repos ». Les écrans `safe` / intérieurs n'ont aucune rencontre.
- `canWalkOnWater` (= quête `sq_pas_de_yu` terminée) autorise les liquides. **Le verrou est donc gratuit** : sans le sort, l'eau bloque.

**Point d'attention majeur (écart avec l'agent Scénario).** Ne PAS marquer `marees_wild` `aquatic: true` : un écran aquatique rend l'eau toujours franchissable (`isTerrainBlocked`, exploration.js ~l.171) et casserait le verrou voulu. On utilise une carte ordinaire dont les `liquids` sont l'eau, avec la table de rencontres de la carte.

**Chaîne d'écrans proposée.**
`fusang` (sanctuaire) → `marees_road` (**Digue des Dernières Racines**, sûre, PNJ d'indice) → `marees_wild` (**Haute Mer des Pontons**, eau + pontons) → `marees_village` (**Shuiyu-sous-l'Eau**) → `marees` (**Autel de Mazu**, petit sanctuaire sans soleil, comme `lune`) → `lune_village`.
Sans Pas de Yu, le joueur ne dépasse pas la digue ni les pontons d'entrée : il reste l'indice du PNJ, un message de verrou clair et le voyage rapide vers `fleuve_village`.

**Points de contact à modifier** (11 régions au lieu de 10) :

| Zone | Fichiers |
|---|---|
| Ordre, niveaux, rebranchement des sanctuaires | `world/index.js` (`REGION_ORDER`, `BASE_CHAIN`, `REGION_LEVEL`), `merchants.js`, `story.js` (`REGION_UNLOCK_LEVEL`, écran `marees`, sortie fusang → marees → lune) |
| Données de région | `world/manifest.js` / `manifest2.js`, `world/maps/marees.js` + `maps/index.js`, `world/text/marees.js` (+ `text/extra/`) + `text/index.js` |
| Aspect du biome | `terrain.js` (table région → biome), `decor.js`, `tilePainter.js` (sol, **pilotis et pontons**, lanternes), `explorationView.js` (rendu des maisons sur pilotis) |
| Monde / progression | `worldMap.js`, `worldMapView.js` (nœud `marees`, `unlockLevel` 38), `junctions.js` (gardes de niveau), `collars.js`, `arena.js` (`ARENA_REGIONS`), `companions.js`, `weapons.js` (régions de butin), `underground.js` si cave |
| Musique | `musicTracks.js` (`BIOMES`), `tools/audio/acestep/catalog.mjs` (+ génération ACE-Step) |
| Ennemis | `enemies.catalog.json`, `tools/bestiary-data.mjs` + `bestiary.js` (notices), sprites (`gen-sprites-gm.mjs`) |
| Tests / docs | tests qui comptent les régions, `SPECS.md`, `UNIVERS.md`, `precache-manifest.json` |

## 3. Étapes

1. **Squelette de région** : ids, `REGION_*`, écrans vides reliés, tests de monde verts (`world.test`, `story`).
2. **Cartes** : `marees_road` (digue), `marees_wild` (eau `~`, pontons `=`, 4 pontons nommés + autel), `marees_village` (liquides entre pilotis), intérieurs. Test d'atteignabilité avec `canWalkOnWater` = vrai ; sans le sort, vérifier que seuls la digue et le premier ponton sont accessibles.
3. **Rendu** : tuiles d'eau-herbe (légère ondulation distincte pour signaler les rencontres), pontons de bois, pilotis, lanternes rouges.
4. **PNJ, textes, quêtes annexes** (§5) ; message de verrou ; suggestion de `sq_pas_de_yu` au journal.
5. **Ennemis** : réutiliser 6 gabarits existants, créer 4 nouveaux (+ boss optionnel) ; table de rencontres de la carte.
6. **Sprites** (pile locale `gm`) puis **musique** ACE-Step (1 thème région, 1 thème combat + variantes `-b`, boss si retenu).
7. **Tests** (jest + Playwright), `SPECS.md`, `UNIVERS.md`, manifeste de précache, PR.

## 4. Décisions encore ouvertes

- Boss de région **Shen, Seigneur du Mirage (蜃)** : oui / non (le plan le prévoit gardant l'accès à l'autel).
- Un collier de région `marees` (« Perle de Mazu ») : oui / non.
- Interlude du miroir de Chang'e : **à supprimer** (après le neuvième soleil le bronze reste froid, cf. §5-8) ; ne garder que Sœur Mo.
- Ordre village / sauvage : ici `road → wild → village → autel` (le village est le prix de la traversée, non un point de départ) ; l'ordre habituel des autres régions est village → wild.

## 5. Dossier narratif (agent Scénario, résumé)

**Pitch.** Le neuvième soleil est tombé au Fusang ; la nuit est entière. La Lune libre tire la mer : la Grande Marée a noyé les basses terres entre le Fusang et le Pic. Fengmeng est passé avant (il a volé la dernière jonque ; les barques restantes sont brisées) : seul le Pas de Yu permet la traversée. Ton mélancolique et doux, dernier souffle avant le finale, sans soleil à abattre.

**Lieux.** Digue des Dernières Racines (entrée) ; Haute Mer des Pontons ; pontons nommés : *Dernière Racine* (entrée), *Trois Lanternes* (coffre d'anneau), *Cormoran Veuf*, *Sel Rouge* (four à sel flottant, marchand secondaire) ; **Autel de Mazu et du Dragon-Roi** (sanctuaire). Village **Shuiyu-sous-l'Eau (水寓)** : maisons sur pilotis aux rez-de-chaussée engloutis, passerelles de bambou, jonques-étages, bateaux-lanternes, fours à sel sur radeaux, cormorans sur les faîtages. Intérieurs : Cabane des Cormorans, Four à sel, Petit temple de Mazu, Atelier des bateaux-lanternes, Jonque-maison.

**PNJ.**
- **Vieux Xu, passeur de la Digue** (entrée) — indice volontairement incomplet : « un homme marchait sur ces eaux, trois pas devant, trois sur le côté, un derrière… ça venait d'une tortue, une vieille qui parle trop lentement… là où le fleuve s'est tari, un quai qui donne sur du vide ». Aucun nom (Gui, Hekou), ni rouleau, ni stèle. Réplique alternative une fois `sq_pas_de_yu` faite.
- Ling (dresseuse de cormorans, quête), Maître Tang (saunier, marchand), Sœur Mo (gardienne de l'autel, cadette de Dame Mo de `mer`), Vieille Canne (pêcheur aveugle, rumeurs sur Fengmeng), Xiao Deng (fillette, bateaux-lanternes, quête), Père Hu (charpentier, jonque volée), Sage Jiaoxia (crabe marchand).
- Conditions de dialogue : uniquement `sun_9`, `sq_pas_de_yu` et les quêtes de la région (les `talk` conditionnés par `fengmeng_3a/3b` du brouillon sont **à retirer** : le Pic est postérieur).

**Quêtes annexes.** `sq_cormoran` (anneau de Pointe-de-Neige : coffre + 3 crabes, 120 or, 90 xp) ; `sq_bateaux_lanternes` (mèches de cire + 4 méduses-lanternes, 100 or, 80 xp) ; `sq_offrande_mazu` (urne de riz + Tortue des Récifs, 140 or, 100 xp). Quête principale suggérée : `sq_traversee_marees` (atteindre l'autel, ouvre la porte vers la Lune).

**Ennemis (10).** Existants : crabe-soldat, carpe dorée, serpent des tourbillons (`hai_she`), sirène chantante (`ren_yu`), tortue des récifs (`hai_gui`), jiaolong. Nouveaux : méduse-lanterne (`shuimu_denglong`), poisson-épée de tempête, cormoran-fantôme, hippocampe-lancier. Boss optionnel : Shen, palourde-dragon qui projette des mirages de cités.

**Musique.** Région « Haute Mer sous la Lune » : ~70 bpm, mi/ré pentatonique mineur, guzheng en glissandi de vagues, xiao, erhu discret, carillon de bronze, motif de trois notes montantes + une descendante (écho du « 3 pas, 3 côté, 1 arrière » du Pas de Yu). Combat « Tourbillon des Eaux » : 128-136 bpm en 6/8, pipa en trémolo, tangu, gongs, suona ; boss : demi-ton au-dessus, chœur étouffé.

**Risques relevés.** Ne pas dupliquer la Mer des Mille Îlots (`mer_archipel` reste l'archipel de la Tortue-Dragon) ni réutiliser ses PNJ ; éviter les motifs déjà pris dans `mer.js` (beignets de crevette, phare, plongeuse de perles) ; vérifier les tests qui comptent les régions ; le joueur qui a ignoré `sq_pas_de_yu` doit pouvoir revenir (voyage rapide vers Hekou).
