# Prompts game-maker (`gm`) — La Fête des lanternes d'hiver

Prompts prêts à coller pour générer en local les ressources visuelles de l'événement (`events/winterLanternFestival/`) avec la pile
`tools/gm up pixel` (WSL, SDXL + LoRA Pixel Art XL), comme `tools/gen-souls-decor.mjs` et `tools/gen-puzzle-sprites.mjs`.
Aucun de ces dessins n'existe encore : l'événement tourne aujourd'hui avec des **décors et sprites de remplacement déjà présents dans le jeu**
(voir « Substitutions actuelles » en bas). Chaque section dit quel identifiant remplacer une fois le dessin généré.

## Mode d'emploi

1. Copier `tools/gen-souls-decor.mjs` en `tools/gen-winter-decor.mjs`, remplacer la liste `SPRITES` par celle de la section 2 (champs `id`, `w`, `gen`,
   `view`, `desc`), garder `STYLE`/`NEGATIVE` de la section 1 et écrire dans `sprites/winter-decor.js` (nouveau fichier, **ne pas toucher** `souls-decor.js`).
2. Lancer dans WSL : `tools/gm up pixel`, puis `node tools/gen-winter-decor.mjs --cand=4` ; choisir la meilleure piste avec `--use=<id>:<k>`.
3. Déclarer les nouveaux noms dans `sprites/decor.js` (`DECOR_NAMES`) puis dans `BIOME_DECOR.winter_lantern_mountain` (`decor.js`) ; ajouter
   `winter-decor.js` à l'import map d'`index.html`, lancer `npm run precache:build` et `npm run test:unit`.
4. Mettre à jour `SPECS.md` (journal de session) avec ce qui a été généré.

Contraintes communes : 32 × 32 px par case (génération 8 px par bloc sur fond gris uni, comme les autres décors), contour sombre unique,
ombrage plat, palette limitée, **aucun texte**, **aucun emoji**, pas de caractère non ASCII dans les SVG. Respecter la palette de l'événement :

| Couleur | Code | Usage |
|---|---|---|
| Rouge impérial | `#B52B32` | lanternes, portes, rubans |
| Or chaleureux | `#D4A94E` | lumières, ornements, récompenses |
| Blanc neige | `#E8EDF0` | neige, paysages |
| Bleu glacier | `#A5CEDD` | glace, cristaux |
| Bleu nuit | `#293B59` | ciel, ombres |
| Vert jade | `#438675` | jade, objets précieux |
| Brun bois | `#79553B` | maisons, ponts |
| Orange flamme | `#E68A3A` | feux, sources chaudes |

Les couleurs chaudes (lanternes, fenêtres, feux) doivent toujours contraster avec les fonds froids. À éviter : Père Noël, traîneau, rennes, lutins,
chaussettes, houx, boules de sapin, bonhomme de neige à carotte, maison en pain d'épices, sucre d'orge, architecture européenne, symboles japonais ou chrétiens.

## 1. Style commun

**STYLE** (préfixe de chaque prompt, `${view}` = champ `view`) :

```
pixel art, ${view}, one single small object alone, centered with a wide empty margin all around, plain solid flat medium gray (#808080) background, clean bold dark outline, flat shading, limited color palette, warm festive Chinese winter mountain style, snow, red and gold lanterns, jade green accents, cozy and magical, video game item
```

**NEGATIVE** :

```
3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, western christmas, santa claus, reindeer, sleigh, elf, christmas tree with baubles, stocking, holly wreath, gingerbread house, candy cane, snowman with carrot nose, european medieval castle, japanese torii, church, cross, dark, gloomy, horror, skull
```

## 2. Décors du biome `winter_lantern_mountain` (32 × 32, `gen: [512, 512]`)

À créer dans `sprites/winter-decor.js`, puis à ajouter à `BIOME_DECOR.winter_lantern_mountain` (aujourd'hui : lanterne rouge, lanterne de pierre,
lion gardien, bol d'offrande, encensoir, fleurs pâles, jarre, panier).

| id | `view` | `desc` |
|---|---|---|
| `snow_pine` | front view | `tall pine tree heavily covered with thick white snow, dark green needles peeking through, small red silk ribbon tied on a low branch` |
| `frozen_bamboo` | front view | `cluster of bamboo stalks coated in frost and ice crystals, pale jade green stems, icicles hanging from the leaves` |
| `ice_block` | three-quarter view seen from slightly above | `translucent glacier blue ice cube block with white cracks and a faint golden glint inside, sitting on snow` |
| `snow_rock` | front view | `gray boulder with a thick cap of white snow, small icicles on the side, a few dry winter grass blades` |
| `stone_column_snow` | front view | `short carved stone column with a rounded top, dragon relief pattern, snow piled on the capital, faint red paint remaining` |
| `fallen_log_snow` | front view | `fallen tree trunk lying sideways under snow, brown bark, small frozen mushrooms, icicles` |
| `ice_stalagmite` | front view | `pointed pale blue ice stalagmite cluster rising from the ground, translucent crystals, white highlights` |
| `ice_crystal` | front view | `glowing glacier blue crystal cluster with a soft golden light inside, snow at the base` |
| `lantern_red` | front view | `round cinnabar red paper lantern on a wooden pole, golden tassels, warm orange glow, thin cap of snow on top` |
| `lantern_gold` | front view | `round golden yellow paper lantern on a wooden pole, red tassels, warm glow, snow on top` |
| `lantern_white` | front view | `white paper lantern with a soft pale blue glow, silver tassels, hanging from a wooden pole, snow on top` |
| `lantern_jade` | front view | `jade green paper lantern with gold floral cutouts, warm soft glow, hanging from a wooden pole` |
| `lantern_unlit` | front view | `dark unlit red paper lantern, dull dim colors, frost and a bit of snow on top, hanging from a wooden pole` |
| `silk_ribbons` | front view | `bundle of red and gold silk ribbons tied to a wooden post, fluttering in the wind, snow on the post` |
| `jade_ornament` | front view | `carved jade pendant shaped like a crane on a red cord hanging from a short stand, deep green translucent jade` |
| `bronze_bell` | front view | `small bronze temple bell hanging from a branch covered with frost, verdigris patina, red ribbon` |
| `snow_flowers` | front view | `winter plum blossoms with pink and white petals on a bare branch dusted with snow, tiny golden stamens` |
| `snow_hare` | front view | `small white winter hare sitting in snow, pale blue shadow, black eyes, cute` |
| `guardian_statue_snow` | front view | `stone guardian lion statue on a pedestal, snow on its head and back, red silk scarf tied around its neck` |
| `smoke_chimney` | front view | `traditional Chinese tile rooftop chimney with a gentle plume of white smoke rising, snow on the tiles` |
| `feast_table` | three-quarter view seen from slightly above | `low wooden festive table with steaming bowls, white pink and golden rice dumplings, red tablecloth, chopsticks` |
| `tangyuan_basket` | three-quarter view seen from slightly above | `bamboo basket full of round glutinous rice dumplings in white, pink and golden colors, steam rising` |
| `paper_cutting` | front view | `red paper cut window decoration with a pattern of plum blossoms and a crane, stuck on a wooden lattice window` |
| `glowing_crystal_lamp` | front view | `small floating crystal lamp with a warm golden light, glacier blue facets, sparkles` |
| `hot_spring` | three-quarter view seen from slightly above | `small round stone pool of hot spring water with white steam rising, orange glow under the surface, snow around the rim` |
| `frozen_door` | front view | `wooden double door of a mountain shrine covered by a thick layer of translucent ice, red paint underneath, icicles, snow` |
| `ice_bridge` | three-quarter view seen from slightly above | `short fragile bridge of pale blue ice over a chasm, cracks across the surface, wooden handrails with frost` |
| `slippery_ice_tile` | top-down view | `polished translucent glacier blue ice floor tile with white reflection streaks and fine cracks` |

## 3. Portes et architecture (taille propre)

| id (cible) | `w` / `cell` / `gen` | `desc` |
|---|---|---|
| `wlm_gate` (remplace `GATE_SPRITE = 'red_lantern'` dans `data.js`) | `w: 1, cell: 64, gen: [512, 512]`, front view | `ornate Chinese mountain paifang gate, two red lacquered pillars with gold dragon patterns, curved dark tiled roof topped with snow, two glowing red paper lanterns hanging, the doorway opening onto a snowy mountain path, warm and welcoming` |
| `wlm_house` | `w: 3`, front view | `traditional Chinese mountain village house, curved tiled roof thickly covered with snow, wooden brown walls, a lit red lantern at the door, warm yellow light in the paper windows, smoke from the chimney` |
| `wlm_pavilion` | `w: 3`, front view | `small Chinese mountain pavilion with a curved roof covered with snow, red pillars, hanging red and gold lanterns, open sides, warm light inside` |
| `wlm_pagoda` | `w: 2`, front view | `three-tier Chinese pagoda on a rocky base, snow on each curved roof, red and gold ornaments, small lanterns at the corners, glowing windows` |
| `wlm_inn` | `w: 3`, front view | `Chinese mountain inn with a signboard-less front, large red lantern at the door, steaming food stall next to it, snow roof, warm light` |
| `wlm_shrine` | `w: 3`, front view | `small mountain shrine with red doors, stone steps covered with snow, two stone guardian lions, a central altar with a tiny golden flame` |
| `wlm_bridge_wood` | top-down view | `wooden plank bridge section with frost, rope railings with red ribbons, snow on the edges` |

## 4. Sols et reliefs (tuiles 16 × 16, sur le modèle de `tools/gen-souls-floor.mjs`)

Générer 3 à 4 variantes par entrée (`--cand=4`), conserver la palette ci-dessus. Texture de dalle seulement, sans objet.

| Tuile | prompt (`top-down view, seamless 16x16 tile, pixel art, ...`) |
|---|---|
| Neige blanche | `fresh white snow, subtle pale blue shadows, tiny sparkles` |
| Neige tassée | `packed snow with footprints, slightly grayish blue tones` |
| Neige poudreuse (hautes herbes) | `deep powdery snow with soft mounds and a few frozen grass tips` |
| Glace translucide | `translucent glacier blue ice, white reflective streaks` |
| Glace fissurée | `cracked ice with dark blue fissures and white edges` |
| Pierre enneigée | `gray stone paving with patches of snow in the joints` |
| Terre gelée | `frozen brown soil with white frost crystals` |
| Herbe hivernale | `dry pale yellow winter grass with frost` |
| Chemin de pierre | `old stone path slabs with moss under thin snow` |
| Bois couvert de givre | `wooden planks brown with white frost on top` |
| Flaque gelée | `small frozen puddle, pale blue ice disc on dark soil` |
| Sol illuminé | `snow floor lit by warm orange light, golden reflections, soft glow` |

Reliefs (blocs de `32 × 32` au même format que les décors) : `snow_mountain` (sommet enneigé en dégradé bleu nuit à blanc), `ice_cliff` (falaise de
glace bleu glacier), `frozen_waterfall` (cascade gelée en colonnes de glace), `snow_ledge` (corniche de pierre enneigée), `ice_cave_mouth` (entrée de grotte
de glace avec lueur dorée), `stone_stairs_snow` (escalier de pierre enneigé), `rope_bridge_snow` (pont suspendu de cordes et de planches givrées), `rock_peak` (pic rocheux).

## 5. Personnages et créatures (sprites 4 directions, cycle de marche 2 images)

Style de personnage : voir `agents/animation-pixel-art.md` (« Direction Pokémon GBA », chibi). Ajouter à `STYLE` : `character sprite, chibi, 4 directions`.

| id | `desc` |
|---|---|
| `wlm_ancien` | `kind elderly Chinese village elder, thick quilted padded winter robe in dark blue with red trim, white beard, round fur hat, walking stick` |
| `wlm_cuisinier` | `round friendly Chinese cook with a white apron over a red padded jacket, big ladle, steaming pot beside him` |
| `wlm_artisan` | `Chinese craftswoman with a red padded jacket and brown apron, holding a half-finished bamboo lantern frame, paper scraps` |
| `wlm_gardien_sanctuaire` | `calm young shrine guardian in a long dark blue padded robe with gold embroidery, jade pendant, tall staff with a small red lantern` |
| `wlm_enfants` | `two Chinese village children in thick red and green padded clothes with round hats, throwing snowballs` |
| `wlm_esprit_village` | `small floating flame spirit inside a red paper lantern, warm orange glow, tiny face, sparkles` |
| `wlm_famille` | `Chinese family of three in padded winter clothes (red, blue, green), standing close together, holding bowls of rice dumplings` |
| `wlm_pelerin` | `traveling pilgrim in a straw rain cloak over a gray padded coat, carrying a lantern on a pole and a small pack` |
| `wlm_renard_neiges` | `white snow fox, pale blue and jade green markings, glowing blue eyes, big fluffy tail with a jade tip, sitting, side view` |
| `wlm_esprit_givre` (ennemi, modèle `dame_des_neiges`) | `translucent frost spirit with a body of ice and mist, pale blue glow, floating snow particles, flowing sleeves, calm and mysterious, not scary` |
| `wlm_oiseau_givre` (ennemi, modèle `xue_niao`) | `white and blue bird with crystal wings, trail of snowflakes, long tail feathers like ice shards, flying` |
| `wlm_gardien_glace` (élite, modèle `shi_jing`) | `imposing guardian in armor of stone and ice, jade ornaments, red cord details, huge stone halberd, frost on the shoulders, solemn` |
| `wlm_gardien_flamme` (boss, modèle `shan_shen`) | `ancient stone guardian statue come to life, red and gold ornaments, a warm flame burning in its chest, ice crystals growing on its shoulders and back, balance of fire and cold, majestic and sad` |

## 6. Objets et icônes d'inventaire (32 × 32)

| id | `desc` |
|---|---|
| `qi_wlm_lanterne` | `small red and gold celestial paper lantern held by a gold hook, flame with golden light, tiny stars` |
| `qi_wlm_riz` | `cloth sack of glutinous white rice tied with a red string, a few grains spilling` |
| `qi_wlm_sesame` | `small clay pot of black sesame filling with a lid, dark paste visible, red cloth tie` |
| `qi_wlm_clochette` | `small bronze mountain bell with a red ribbon, frost and golden highlights` |
| `qi_wlm_flamme_1`, `_2`, `_3` | `a shard of celestial flame trapped in a crystal, glowing orange and gold, three different shapes: tear drop, hexagon, and star` |
| `qi_wlm_jade` | `deep green jade pendant carved as a crane, gold rim, red cord` |
| `tangyuan_blanc` / `_rose` / `_dore` | `a small bowl of three round glutinous rice dumplings (white / pink / golden), steam rising, warm light` |
| `qi_wlm_cristal` | `glacier blue ice crystal with a faint warm glow` |
| `the_chaud` | `small steaming ceramic cup of hot tea on a saucer` |
| `ruban_bonheur` | `red silk ribbon tied in a knot with a gold charm` |
| `encens_montagne` | `bundle of three incense sticks with a thin smoke, red and gold wrapper` |

## 7. Récompenses et variantes cosmétiques (`agents/animation-pixel-art.md`, palettes de skins)

Ces prompts préparent la couche C du moteur événementiel ; le jeu n'a pas encore de système de skins (voir `SPECS.md`).

- **Skin Hou Yi hivernal** (4 directions, cycle de marche, même gabarit que `archer_walk_right_*`) : `Chinese archer hero in thick quilted winter clothes, dark blue padded coat with red trim and fur collar, red scarf, same pose and proportions as the base sprite`.
- **Skin de montagne** : `Chinese archer hero in a mountain traveler outfit, white fur cloak, jade green belt, small lantern hanging at the hip`.
- **Arc de jade et rubans** : `recurve bow carved from pale jade green wood, red silk ribbons tied at the grip, gold tips, small snowflake engraving`.
- **Accessoire de lanterne** (à la ceinture) : `small glowing red lantern hanging from a belt cord`.
- **Effet de flocons** : spritesheet 8 images, `soft white snowflakes slowly falling around the character, 3 sizes, transparent background`.
- **Compagnon animal** : `chibi white snow fox cub with a tiny red scarf, follows the player, 4 directions + sleeping pose`.
- **Variantes givrées d'ennemis existants** (palette seulement) : `same sprite recolored with frost: pale blue and white tones, ice crystals on shoulders, white rim light`.
- **Décoration de village** : `tiny red silk ribbons and paper cut-out window decoration, for village houses`.
- **Ornements d'interface** : `small gold and red corner ornament with a plum blossom, and a thin snowflake divider line` (2 petits PNG décoratifs, pas de texte).

## 8. Animation d'arrivée dans le biome (`tools/gen-biome-intros.py`)

Clé `biome_winter_lantern_mountain` (planche `sprites/ultimates/biome_winter_lantern_mountain-seq.png`). Panorama SDXL vu de côté, 1344 × 768, bandes
unies rognées automatiquement, boucle de 4 s :

```
side view panorama of a Chinese snowy mountain village at dusk, curved-roof houses covered with snow, hundreds of glowing red and gold paper lanterns strung between the roofs, stone steps and a wooden suspension bridge, deep blue night sky with soft stars, warm light windows, light snowfall, pixel art, warm and magical, cozy festival atmosphere
```

Négatif : `western christmas, santa, reindeer, european castle, dark, horror, text`.

## 9. Musique (`tools/audio/acestep/catalog.mjs`, piste `event-winter-lantern`)

À ajouter au catalogue ACE-Step (piste de zone sauvage, boucle) ; en attendant, le jeu retombe sur `wild-bamboo` :

```
gentle Chinese winter festival music, guzheng and dizi flute, soft erhu, light bells and wind chimes, warm pentatonic melody, slow tempo 70 bpm, peaceful, cozy, magical snowfall atmosphere, seamless loop
```

Piste de boss (`boss-gardien-de-la-flamme-hivernale`, repli `boss-a*`) :

```
epic yet warm Chinese orchestral boss music, taiko drums, pipa, erhu, low horns, crystalline bells, rising fire and ice duality, determined and noble, 110 bpm, loopable
```

## Substitutions actuelles (à remplacer au fil des générations)

| Ressource finale | Substitut dans le jeu aujourd'hui |
|---|---|
| `wlm_gate` | **généré** (`sprites/winter-decor.js`) |
| Décors du biome (section 2) | **12 générés** (`snow_pine`, `snow_rock`, `stone_column_snow`, `lantern_red`, `lantern_unlit`, `snow_flowers`, `ice_block`, `guardian_statue_snow`, `bronze_bell`, `tangyuan_basket`, `hot_spring`, `wlm_gate`) ; non retenus (paysage au lieu d'un objet, à relancer avec `--only` et un autre `--seed`) : `frozen_bamboo`, `ice_crystal`, `lantern_gold` ; le reste de la liste n'est pas généré |
| Sol du biome (section 4) | case procédurale `tilePainter.js` (`winter_lantern_mountain` : neige tassée, givre, étincelles dorées) |
| Bordure du biome | sapins du moteur (`BORDER_KIND = 'pine'`) |
| Renard des neiges / esprit du village | créatures `fox` et `lantern` de `sprites/creatures.js` |
| Ennemis et boss | sprites des modèles `dame_des_neiges`, `xue_niao`, `shi_jing`, `shan_shen` |
| Villageois | silhouettes de PNJ génériques |
| Musique | `wild-bamboo` |
| Animation d'arrivée | scène procédurale de `cinematics.js` (`playRegionDiscovery`, palette `winter_lantern_mountain`) |
