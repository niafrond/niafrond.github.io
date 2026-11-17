# Plan : nouveau biome marin « Les Hautes-Eaux de la Lune Montante » (`marees`)

Statut : **implémenté (23/10/2026), voir SPECS.md.** Écarts avec ce plan : zone 1 = `marees_road`, zone 3 = `marees_wild` (le format de région impose route → village → zone sauvage → sanctuaire) ; gate de la zone 3 = coffre `marees_compass_chest` ; quête principale `q_changxi`. Dossier narratif rédigé par l'agent Scénario (§5), faisabilité technique vérifiée dans le code (§2).
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

**Chaîne d'écrans proposée (trois zones, comme les autres régions).**
`fusang` (sanctuaire) → **zone 1, exploration + combat** `marees_wild` (**Haute Mer des Pontons** : démarre par la **Digue des Dernières Racines**, bande sûre avec le PNJ d'indice Vieux Xu, puis eau-herbe et pontons de repos) → **zone 2, village sans combat** `marees_village` (**Shuiyu-sous-l'Eau**, écran `safe`, intérieurs sans rencontre) → **zone 3, exploration + combat vers le boss** `marees_deep` (**Gouffre des Mirages** : eau plus dense, moins de pontons, ennemis plus forts, chemin de pontons qui mène à l'autel) → `marees` (sanctuaire **Autel de Mazu**, gardé par Shen s'il est retenu ; petit sanctuaire sans soleil, comme `lune`) → `lune_village`.
Chaque zone de combat a sa propre table de rencontres (`marees_wild`, `marees_deep`) et reste une carte ordinaire à `liquids` (jamais `aquatic`). Sans Pas de Yu, le joueur ne dépasse pas la digue ni le premier ponton de la zone 1 : il reste l'indice du PNJ, un message de verrou clair et le voyage rapide vers `fleuve_village`. Le village est le ravitaillement entre les deux zones de combat (marchand, repos, quêtes annexes).

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
2. **Cartes** : `marees_wild` (digue sûre au départ, eau `~`, pontons `=` : *Dernière Racine*, *Trois Lanternes*), `marees_village` (`safe`, liquides décoratifs entre pilotis, intérieurs), `marees_deep` (eau dense, pontons *Cormoran Veuf* et *Sel Rouge*, passage vers l'autel), `marees` (autel). Test d'atteignabilité avec `canWalkOnWater` = vrai ; sans le sort, vérifier que seuls la digue et le premier ponton sont accessibles.
3. **Rendu** : tuiles d'eau-herbe (légère ondulation distincte pour signaler les rencontres), pontons de bois, pilotis, lanternes rouges.
4. **PNJ, textes, quêtes annexes** (§5) ; message de verrou ; suggestion de `sq_pas_de_yu` au journal.
5. **Ennemis** : réutiliser 6 gabarits existants, créer 4 nouveaux (+ boss optionnel) ; table de rencontres de la carte.
6. **Sprites** (pile locale `gm`) puis **musique** ACE-Step (1 thème région, 1 thème combat + variantes `-b`, boss si retenu).
7. **Tests** (jest + Playwright), `SPECS.md`, `UNIVERS.md`, manifeste de précache, PR.

## 4. Décisions encore ouvertes

- **Boss de région : tranché (23/10/2026).** La divinité est **Changxi (常羲), mère des douze lunes**, sans lien avec la mer : c’est elle qui peut porter Hou Yi jusqu’à la Lune. Elle se repose sur l’autel maintenant que les soleils sont abattus. Le combat est une épreuve de bravoure et de courage, non un duel à mort (§6). Shen est abandonné comme boss.
- Un collier de région `marees` : oui / non ; s’il est retenu, le rebaptiser (« Éclat de Changxi » plutôt que « Perle de Mazu », la divinité n’étant plus Mazu).
- Interlude du miroir de Chang'e : **à supprimer** (après le neuvième soleil le bronze reste froid, cf. §5-8) ; ne garder que Sœur Mo.
- Ordre des zones : **tranché** par l'utilisateur (23/10/2026), trois zones : exploration/combat → village sans combat → exploration/combat vers le boss (§2). Le boss (divinité, §6) garde l'autel au bout de la zone 3.

## 5. Dossier narratif (agent Scénario, résumé)

**Pitch.** Le neuvième soleil est tombé au Fusang ; la nuit est entière. La Lune libre tire la mer : la Grande Marée a noyé les basses terres entre le Fusang et le Pic. Fengmeng est passé avant (il a volé la dernière jonque ; les barques restantes sont brisées) : seul le Pas de Yu permet la traversée. Ton mélancolique et doux, dernier souffle avant le finale, sans soleil à abattre.

**Lieux.** Digue des Dernières Racines (entrée) ; Haute Mer des Pontons ; pontons nommés : *Dernière Racine* (entrée), *Trois Lanternes* (coffre d'anneau), *Cormoran Veuf*, *Sel Rouge* (four à sel flottant, marchand secondaire) ; **Autel de Mazu et du Dragon-Roi** (sanctuaire). Village **Shuiyu-sous-l'Eau (水寓)** : maisons sur pilotis aux rez-de-chaussée engloutis, passerelles de bambou, jonques-étages, bateaux-lanternes, fours à sel sur radeaux, cormorans sur les faîtages. Intérieurs : Cabane des Cormorans, Four à sel, Petit temple de Mazu, Atelier des bateaux-lanternes, Jonque-maison.

**PNJ.**
- **Vieux Xu, passeur de la Digue** (entrée) — indice volontairement incomplet : « un homme marchait sur ces eaux, trois pas devant, trois sur le côté, un derrière… ça venait d'une tortue, une vieille qui parle trop lentement… là où le fleuve s'est tari, un quai qui donne sur du vide ». Aucun nom (Gui, Hekou), ni rouleau, ni stèle. Réplique alternative une fois `sq_pas_de_yu` faite.
- Ling (dresseuse de cormorans, quête), Maître Tang (saunier, marchand), Sœur Mo (gardienne de l'autel, cadette de Dame Mo de `mer`), Vieille Canne (pêcheur aveugle, rumeurs sur Fengmeng), Xiao Deng (fillette, bateaux-lanternes, quête), Père Hu (charpentier, jonque volée), Sage Jiaoxia (crabe marchand).
- Conditions de dialogue : uniquement `sun_9`, `sq_pas_de_yu` et les quêtes de la région (les `talk` conditionnés par `fengmeng_3a/3b` du brouillon sont **à retirer** : le Pic est postérieur).

**Quêtes annexes.** `sq_cormoran` (anneau de Pointe-de-Neige : coffre + 3 crabes, 120 or, 90 xp) ; `sq_bateaux_lanternes` (mèches de cire + 4 méduses-lanternes, 100 or, 80 xp) ; `sq_offrande_mazu` (urne de riz + Tortue des Récifs, 140 or, 100 xp). Quête principale suggérée : `sq_traversee_marees` (atteindre l'autel, ouvre la porte vers la Lune).

**Ennemis (10).** Existants : crabe-soldat, carpe dorée, serpent des tourbillons (`hai_she`), sirène chantante (`ren_yu`), tortue des récifs (`hai_gui`), jiaolong. Nouveaux : méduse-lanterne (`shuimu_denglong`), poisson-épée de tempête, cormoran-fantôme, hippocampe-lancier. Boss : la divinité de l'autel (§6) ; Shen (palourde-dragon) est abandonné comme boss, il peut rester un ennemi ordinaire de la zone 3 (mirages).

**Musique.** Région « Haute Mer sous la Lune » : ~70 bpm, mi/ré pentatonique mineur, guzheng en glissandi de vagues, xiao, erhu discret, carillon de bronze, motif de trois notes montantes + une descendante (écho du « 3 pas, 3 côté, 1 arrière » du Pas de Yu). Combat « Tourbillon des Eaux » : 128-136 bpm en 6/8, pipa en trémolo, tangu, gongs, suona ; boss (épreuve) : demi-ton au-dessus, chœur étouffé, mais plus solennel que menaçant (gongs lents, xiao, pas de suona agressif).

**Risques relevés.** Ne pas dupliquer la Mer des Mille Îlots (`mer_archipel` reste l'archipel de la Tortue-Dragon) ni réutiliser ses PNJ ; éviter les motifs déjà pris dans `mer.js` (beignets de crevette, phare, plongeuse de perles) ; vérifier les tests qui comptent les régions ; le joueur qui a ignoré `sq_pas_de_yu` doit pouvoir revenir (voyage rapide vers Hekou).

## 6. Boss : Changxi et l’épreuve de bravoure

**Rôle.** Au bout de la zone 3, Changxi, mère des douze lunes, est allongée près de l’Autel de Mazu (Sœur Mo la laisse dormir : elle n’est pas d’ici). Elle n’a rien à voir avec la mer ; ce qu’elle peut, c’est faire voyager vers la Lune, et c’est le dernier verrou avant `lune_village`. Fatiguée, elle ne veut plus rien porter : les soleils tués, ses lunes n’ont plus de rivales et elle se repose enfin. Elle ne cherche pas à tuer Hou Yi, elle juge s’il ose.

**Déroulé proposé (à valider).**
1. Dialogue d’approche : Changxi, assoupie, demande pourquoi on la dérange ; elle ne donne rien gratuitement (l’archer a abattu neuf soleils, mais il a peur de ce qu’il va retrouver là-haut).
2. Combat en phases, chacune une peur à affronter : la **tempête** (grosses vagues, dégâts élevés mais lisibles), le **mirage** (illusions de Chang'e et du village, dont une seule est réelle), le **gouffre** (la divinité s'efface, le joueur tient seul face à l'eau noire).
3. Fuir n'est pas puni par la mort mais le combat reprend à la phase atteinte : la bravoure se prouve en restant.
4. Victoire : Changxi ne meurt pas, elle se lève, sourit et ouvre le chemin de lune (porte vers `lune_village`), puis récompense (collier de région éventuel « Éclat de Changxi »).

**Points d'attention techniques.** Vérifier dans le moteur de combat ce qui est possible pour des phases à intentions scénarisées (mécanique d'illusions, reprise de phase) avant de s'engager ; sinon se limiter à un boss à seuils de PV avec dialogues, sans changer les règles.

**Pas de conflit avec le reste.** Sœur Mo garde l’autel mais n’est pas le boss ; le combat se déclenche en parlant à Changxi après la zone 3. Vérifier la cohérence avec `lune` (Changxi n’y apparaît pas déjà) et avec le chant de Chang’e.
