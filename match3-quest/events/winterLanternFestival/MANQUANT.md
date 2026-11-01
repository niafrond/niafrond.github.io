# Ce qui manque — La Fête des lanternes d'hiver

Inventaire au 2026-11-01 (décors mis à jour le jour même), branche `ccr-5545d7a6-mj3nev`, établi en comparant `prompts-gm.md` (la liste de ressources prévues) avec ce qui existe dans
`sprites/winter-decor.js`, `sprites/winterFloor.js`, `sprites/generated.js` (clés `wlm_*`), `audio/manifest.json`, `decor.js` et `events/winterLanternFestival/`.
L'événement reste **inactif** (`events/config.js` : `enabled: false`) ; il se teste avec `?events=winterLanternFestival`.

## Résumé

| Catégorie (section de `prompts-gm.md`) | Prévu | Fait | Manque |
|---|---|---|---|
| 2. Décors du biome | 28 | 28 | 0 (à valider, voir ci-dessous) |
| 3. Portes et architecture | 7 | 1 (`wlm_gate`) | **6** |
| 4. Tuiles de sol | 12 | 2 | **10** |
| 4. Reliefs | 8 | 0 | **8** |
| 5. Personnages, créatures, ennemis, boss | 13 | 13 | 0 (deux réserves ci-dessous) |
| 6. Objets et icônes d'inventaire | 16 | à vérifier | **à vérifier** |
| 7. Skins et récompenses cosmétiques | 9 | 0 | **9** (pas de système de skins) |
| 8. Animation d'arrivée dans le biome | 1 | 0 (scène procédurale en repli) | **1** |
| 9. Musique | 2 | 2 | 0 |

## 2. Décors du biome (28 sur 28 générés, à valider)

Les 17 derniers ont été générés le 2026-11-01 en 64 × 64 (`tools/gen-winter-decor.mjs --detail --cell=64`, `sprites/winter-decor.js`) : `frozen_bamboo`, `fallen_log_snow`,
`ice_stalagmite`, `ice_crystal`, `lantern_gold`, `lantern_white`, `lantern_jade`, `silk_ribbons`, `jade_ornament`, `snow_hare`, `glowing_crystal_lamp` (ajoutés à
`BIOME_DECOR.winter_lantern_mountain`), puis `smoke_chimney`, `feast_table`, `paper_cutting`, `frozen_door`, `ice_bridge`, `slippery_ice_tile`.

Reste à faire : **valider visuellement** chaque décor (aperçu publié en artifact), et **poser** ceux qui ne sont pas des décors de remplissage : `lantern_unlit`,
`tangyuan_basket`, `hot_spring`, `feast_table`, `paper_cutting`, `smoke_chimney` (village), `frozen_door`, `ice_bridge`, `slippery_ice_tile` (énigmes). Ils sont
générés mais aucun écran de `data.js` ne les référence encore.

## Intérieur et terrains (ajouté le 2026-11-01)

Fait : 8 meubles d'intérieur sans neige (`kang`, `brazier`, `tea_shelf`, `calligraphy_scroll`, `lacquer_chest`, `floor_rug`, `indoor_lantern`, `firewood_basket`), une maison (`wlm_maison`, bâtiment « A » du village), col 64 × 28 et sanctuaire 52 × 28 avec grandes poudreuses. Reste : un seul intérieur et sans PNJ ni coffre (les autres bâtiments du village n'existent pas), `floor_rug` non utilisé (le tapis de la pièce est dessiné par le moteur), village toujours 28 × 13, rien vérifié en jeu.

## 3. Portes et architecture (6 manquants)

Fait : `wlm_gate` (64 × 64). À générer : `wlm_house` (3 cases), `wlm_pavilion` (3), `wlm_pagoda` (2), `wlm_inn` (3), `wlm_shrine` (3), `wlm_bridge_wood`.
Tant qu'ils n'existent pas, le village garde les maisons du moteur.

## 4. Sols et reliefs (18 manquants)

Bloqué par le moteur : `tilePainter.js` choisit une dalle au hasard dans `WINTER_FLOOR.tiles` sans distinguer neige, glace ou pierre, et `tools/gen-winter-floor.mjs` prévoit 5 variantes (3 neige, 2 pierre) alors que `sprites/winterFloor.js` n'en contient que 2. Il faut d'abord associer chaque type de terrain à sa famille de dalles, sinon des dalles de pierre apparaîtraient au milieu de la neige.

`sprites/winterFloor.js` contient **2 dalles de neige** sur les 12 prévues. Manquent : neige tassée, neige poudreuse, glace translucide, glace fissurée, pierre
enneigée, terre gelée, herbe hivernale, chemin de pierre, bois givré, flaque gelée, sol illuminé (la dalle « neige blanche » est faite ; vérifier laquelle des deux
dalles correspond à quoi). Les glaces et le sol illuminé sont les plus utiles aux énigmes.

Reliefs, tous à faire : `snow_mountain`, `ice_cliff`, `frozen_waterfall`, `snow_ledge`, `ice_cave_mouth`, `stone_stairs_snow`, `rope_bridge_snow`, `rock_peak`.
Bordure du biome : toujours les sapins du moteur (`BORDER_KIND = 'pine'`).

## 5. Personnages (13 sur 13 faits, deux réserves)

Les 13 clés `wlm_*` existent avec 4 directions. Réserves :

- **`wlm_famille`** (groupe de trois) : Qwen ne sait pas le tourner, les vues gauche/droite sont les anciennes vues SDXL, de qualité inférieure.
- **`wlm_ancien`** : garde un petit pompon de bonnet ajouté par Qwen sur le profil.
- Des candidats de `wlm_famille` (`sprites/png/back-cand/fam_a0*`, `fam_a1*`) sont en cours dans l'arbre de travail, non adoptés.

## 6. Objets et icônes d'inventaire (à vérifier)

`data.js` référence des objets (`wlm_lanterne_1` à `_3`, `wlm_fragment_3`, `wlm_riz_gluant`, `wlm_sesame_noir`, `wlm_clochette`, `wlm_jade_hiver`, `wlm_source_chaude`,
`wlm_miroirs`, `wlm_blocs_glace`, `wlm_gardiens_de_glace`, caches). Je n'ai trouvé **aucune icône dédiée** dans `sprites/`. Les objets prévus à la section 6
(`qi_wlm_*`, `tangyuan_*`, `the_chaud`, `ruban_bonheur`, `encens_montagne`) restent à générer, ou à confirmer comme remplacés par des icônes existantes.

## 7. Skins et récompenses cosmétiques (rien de fait)

Dépend de la couche C du moteur événementiel, qui n'existe pas (aucun système de skins). À faire dans l'ordre : concevoir le système de skins, puis générer :
skin Hou Yi hivernal, skin de montagne, arc de jade et rubans, accessoire de lanterne, effet de flocons (8 images), compagnon renardeau des neiges (4 directions
+ sommeil), variantes givrées d'ennemis, décoration de village, ornements d'interface.

## 8. Animation d'arrivée (1 manquante)

`biome_winter_lantern_mountain` n'est pas générée (`tools/gen-biome-intros.py`) ; le jeu joue la scène procédurale de `cinematics.js` (`playRegionDiscovery`).

## Autres points à régler

- **Tests** : `tests/unit/winterLanternFestival.test.js` couvre les quêtes ; rien ne vérifie que chaque `wlm_*` et chaque décor référencé existe réellement.
- **Précache** : après toute génération, relancer `npm run precache:build` (sa péremption a déjà fait échouer la CI de la PR #607).
- **Journal** : `prompts-gm.md` indique « 12 décors générés » et doit être recompté (11 décors + `wlm_gate`) ; mettre à jour la table « Substitutions actuelles ».
- **Activation** : l'événement reste inactif tant que rien n'est décidé ; l'activer demande `enabled: true` dans `events/config.js` puis un commit.
