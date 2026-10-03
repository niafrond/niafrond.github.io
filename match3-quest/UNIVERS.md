# Univers de Match3-Quest : « Hou Yi et les Dix Soleils »

Fantasy chinoise inspirée de la légende de **Hou Yi** (l'archer divin), de **Chang'e** (sa femme, qui s'envole vers la
Lune après avoir bu l'élixir d'immortalité) et des **dix soleils**. Le puzzle match-3 reste le moteur de combat ; les gemmes
deviennent des **gâteaux de lune**. Ce document est la source de vérité : identifiants, ton, direction artistique.

## 1. Pitch

Dix soleils, fils de Di Jun, se sont levés ensemble : rivières taries, rizières brûlées, bêtes devenues folles. L'empereur
Yao charge Hou Yi, archer sans égal, d'abattre **neuf** soleils et d'en épargner un, sans quoi la Terre serait sans jour.
Hou Yi traverse **neuf régions** dévastées, chacune sous l'emprise d'un Soleil-Boss. Il aide les villageois, récolte des
composants (eau sacrée, vent céleste, pierre de glace…) pour de meilleures flèches, puis affronte le soleil de la région.
Son disciple **Fengmeng**, jaloux, le suit comme un rival récurrent. Chang'e garde à la maison l'Élixir d'Immortalité, offert
par la Reine Mère de l'Occident, que Fengmeng convoite. Après le neuvième soleil, Fengmeng trahit. Chang'e boit l'élixir pour
le sauver de ses mains et s'envole vers la Lune. Épilogue tragique : Hou Yi dépose des gâteaux de lune au sommet d'une
montagne sous la pleine lune. La **Nouvelle Partie +** se débloque.

Ton : épique, poétique, mélancolique ; humour léger chez les villageois ; tout public (pas de gore). Vouvoiement pour les
anciens et dignitaires, tutoiement pour les proches et les enfants. Français soigné, avec quelques termes chinois usuels
(hanfu, yaoguai, qi, jade, Fusang…). Les noms propres : Hou Yi, Chang'e, Fengmeng, Yao, Di Jun, Reine Mère de l'Occident.

## 2. Régions, soleils, identifiants (FIXES)

Une région = **un écran** (14×10) contenant un coin village (PNJ, quêtes) et un sanctuaire (le Soleil-Boss). Identifiant d'écran
= identifiant de région. Ordre linéaire du monde : chaque région est reliée à la précédente et à la suivante.

| # | id (écran = région) | Nom | Niveau d'accès | Biome (voir §6) | Soleil-Boss (id d'ennemi) | Particularité |
|---|---|---|---|---|---|---|
| 1 | `rizieres` | Rizières Desséchées | 1 | `paddy` | `sun_1` Soleil Ardent | Tutoriel. Maison de Hou Yi et Chang'e. **Fengmeng, rencontre 1** (duel d'entraînement) |
| 2 | `fleuve` | Lit du Fleuve Jaune | 2 | `riverbed` | `sun_2` Soleil des Eaux Taries | Fleuve asséché, passeur |
| 3 | `bambous` | Forêt de Bambous Calcinée | 3 | `bamboo` | `sun_3` Soleil de Cendres | Moine, herboriste |
| 4 | `gobi` | Désert de Gobi | 5 | `gobi` | `sun_4` Soleil des Mirages | **Illusions** : le vrai soleil parmi des doubles |
| 5 | `tonnerre` | Monts du Tonnerre | 7 | `storm` | `sun_5` Soleil des Orages | Forgeron, ermite |
| 6 | `volcan` | Gorges du Volcan | 9 | `volcano` | `sun_6` Soleil de Magma | **Fengmeng, rencontre 2** (embuscade, duel d'archers) sur la route du 6ᵉ soleil |
| 7 | `fauves` | Plaine des Fauves | 11 | `savanna` | `sun_7` Soleil des Bêtes Folles | Meutes embrasées : le soleil est **protégé** tant que la meute n'est pas abattue |
| 8 | `mer` | Rivage de la Mer Orientale | 13 | `coast` | `sun_8` Soleil des Marées | Pêcheurs, envoyé du Roi-Dragon |
| 9 | `fusang` | Cime du Fusang | 15 | `fusang` | `sun_9` Soleil Lâche | Il utilise le 10ᵉ soleil (PNJ `sun_ten`) comme bouclier : tir de précision, **ne pas toucher le dernier soleil** |
| 10 | `lune` | Pic de la Lune | 16 | `moon` | — | Finale : Chang'e, **Fengmeng, boss final en 2 phases**, autel des gâteaux de lune, épilogue, NG+ |

Niveaux des soleils (`boss.level`, en pratique ≥ niveau du joueur) : `sun_1` 3, `sun_2` 4, `sun_3` 5, `sun_4` 7, `sun_5` 9,
`sun_6` 11, `sun_7` 13, `sun_8` 15, `sun_9` 17.

### Fengmeng (rival, ids d'ennemis FIXES)
- `fengmeng_1` : rencontre 1, duel d'entraînement à `rizieres` (le disciple agressif, jaloux).
- `fengmeng_2` : rencontre 2, embuscade à l'entrée de `volcan` (duel d'archers, il veut devancer Hou Yi).
- `fengmeng_3a` : boss final, phase 1 « L'Archer Miroir », à `lune` (il veut l'élixir ; mêmes techniques d'arc que le joueur).
- `fengmeng_3b` : phase 2 « Rage et Désespoir », n'apparaît qu'**après** la défaite de `fengmeng_3a` (scène : Chang'e boit
  l'élixir pour le sauver et s'envole vers la Lune ; Fengmeng entre en fureur, tirs rapides, pièges de zone).

## 3. PNJ (ids FIXES, un sprite chacun)

| Région | PNJ (id) | Rôle |
|---|---|---|
| `rizieres` | `change` Chang'e (épouse de Hou Yi, boulangère de gâteaux de lune), `elder_wen` (doyen du village, donne la mission de l'empereur), `farmer_lin` (paysan désespéré) |
| `fleuve` | `ferryman_gu` (passeur au bateau échoué), `weaver_mei` (tisserande) |
| `bambous` | `monk_zhen` (moine du temple brûlé), `herbalist_xu` (herboriste) |
| `gobi` | `merchant_ma` (marchand de caravane), `guide_dawa` (guide du désert : « le vrai soleil ne projette pas d'ombre ») |
| `tonnerre` | `smith_tie` (forgeron de flèches), `hermit_lei` (ermite qui parle au tonnerre) |
| `volcan` | `miner_shan` (mineur), `priestess_yan` (prêtresse du feu repentie) |
| `fauves` | `hunter_wu` (chasseur), `shepherd_zi` (bergère aux troupeaux enfuis) |
| `mer` | `fisher_hai` (pêcheur), `envoy_longwang` (envoyé du Roi-Dragon de la Mer Orientale) |
| `fusang` | `crane_envoy` (grue messagère de la Reine Mère de l'Occident), `sun_ten` (le Dixième Soleil, terrorisé, un petit être lumineux) |
| `lune` | `change_moon` (Chang'e à la Lune, vêtue de lumière lunaire) |

## 4. Quêtes

- **Principales** (ids `q_sun_1` … `q_sun_9`) : une par soleil (objectif : abattre `sun_n`). `q_fengmeng` : vaincre `fengmeng_3b`
  (après `fengmeng_3a`). `q_epilogue` : ouvrir l'autel `moon_altar` (coffre) à `lune` après la victoire sur Fengmeng
  et déposer les gâteaux de lune ; sa validation met `ended = true` et **débloque la Nouvelle Partie +**.
- **Secondaires** (`side: true`, jamais requises) : 1 à 2 par région, donneur parmi les PNJ de la région ; elles rapportent
  un **composant de flèche** (champ `reward.fragment`, texte libre) tel que « Eau sacrée », « Vent céleste »,
  « Pierre de glace », « Plume de grue », « Écaille de dragon », « Cendre de phénix »… Ennemis nommés = `permanent: true`.
- Les quêtes principales ne dépendent que de la progression linéaire (les soleils précédents) ; les quêtes secondaires sont
  facultatives. Le doyen `elder_wen` délivre la première mission (ordre de l'empereur Yao) ; les suivantes démarrent
  automatiquement ou par un PNJ de la région (au choix du scénariste), toujours cohérentes avec le texte.

## 5. Tuiles du plateau (art dans `sprites/tiles/*.svg`)

Les gemmes deviennent des **gâteaux de lune** (cinq saveurs = cinq couleurs de mana) ; les deux tuiles spéciales sont
rethématisées :

| Classe CSS | Ancien rôle | Nouveau visuel |
|---|---|---|
| `tile-red` | gemme rouge | gâteau de lune à la pâte de haricot rouge (croûte brun-rouge, motif de fleur en relief, ruban rouge) |
| `tile-blue` | gemme bleue | gâteau « peau de neige » bleu (lotus bleu, motif de lune) |
| `tile-green` | gemme verte | gâteau au thé matcha (vert jade, motif de bambou) |
| `tile-yellow` | gemme jaune | gâteau doré au jaune d'œuf salé (croûte dorée brillante, motif de soleil) |
| `tile-purple` | gemme violette | gâteau au taro violet (motif de nuage) |
| `tile-skull` | crâne (dégâts) | disque de **soleil ardent** (flammes), rouge-orangé |
| `tile-combat` | épées (points de combat) | **flèche** sacrée croisée sur un carquois |
| `tile-joker` | joker | gâteau de **pleine lune** nacré avec reflets arc-en-ciel |

## 6. Biomes d'exploration (ids FIXES, palettes dans `explorationView.js`)

`paddy` (rizières vert tendre et paille, décors 🌾🏮🛖), `riverbed` (boue craquelée ocre, rochers, 🪨🌾), `bamboo` (bambous
calcinés gris-vert, 🎋🔥), `gobi` (sable pâle, dunes, 🌵🪨), `storm` (roche violet-gris, éclairs, ⛰️🌩️), `volcano` (basalte noir et
magma, 🌋🪨), `savanna` (herbe sèche dorée, 🌾🪨), `coast` (sable humide, eau bleu profond, 🌊🪨), `fusang` (cime dorée, arbre
mythique, 🌳🏮), `moon` (nuit bleu-violet, sol de pierre pâle, 🌕🏮).

## 7. Direction artistique des sprites (charte commune)

Même charte que les sprites existants (voir `match3-quest/sprites/`) : SVG autonome, `viewBox="0 0 64 64"`, fond transparent,
style chibi de face (légèrement 3/4), grosse tête, contour foncé `#2b1b17` de 2 px (`stroke-linejoin/linecap` arrondis),
aplats + ombre portée décalée en bas à droite + 1 ou 2 reflets, pieds vers y ≈ 58, **sans ombre au sol**. Interdits :
`<text>`, emoji / caractères non ASCII, `<image>`, ressources externes, `<script>`, `style` externe, animations. Ids de
dégradés préfixés par la clé du sprite. Taille idéale ≤ 6 000 caractères (max 9 000).

Esthétique chinoise : hanfu et robes à larges manches, chignons (topknots) et épingles, chapeaux coniques, écailles, nuages
stylisés (xiangyun), motifs de vagues, rouge laqué, or, jade, bleu nuit, encre. Les créatures s'inspirent du bestiaire
chinois (yaoguai, jiangshi, dragons-longs sans ailes d'occidental…). Les **soleils** sont des disques/êtres de feu avec
flammes en volutes et un visage (chacun avec un élément et une couleur dominante distincts).

### Héros : Hou Yi sous quatre styles (les 4 classes existantes, ids FIXES)
`assassin` = **Hou Yi l'Archer** (le look « par défaut » : tunique rouge et or, grand arc rouge, carquois, chignon, regard
déterminé), `sorcerer` = **Hou Yi le Maître taoïste** (robe bleu nuit à nuages dorés, bâton à talisman, orbe de qi),
`templar` = **Hou Yi le Garde impérial** (armure lamellaire laquée, grand bouclier rond, lance), `barbarian` = **Hou Yi le
Guerrier des steppes** (fourrures, torse nu tatoué, grande hache). Même visage reconnaissable (cheveux noirs, chignon,
sourcils marqués) pour les quatre.

### Correspondance gabarits d'ennemis → créatures chinoises
Les ids de gabarits du catalogue restent inchangés (statistiques) ; seuls les noms et l'apparence changent.

| id de gabarit | Nouvelle identité |
|---|---|
| `goblin_saboteur` | Xiao Gui, petit démon-renard farceur à piège |
| `fungal_horror` | Champignon lingzhi maudit (chapeau rouge à spores) |
| `forest_guardian` | Esprit-arbre ancien (vieux pin/saule noueux) |
| `bone_reaver` | Guerrier-squelette à sabre rouillé |
| `crypt_lich` | Sorcier-squelette taoïste (bonnet de lettré, flamme verte) |
| `temple_warden` | Lion-gardien de pierre (shishi) |
| `arcane_scholar` | Lettré-sorcier (robe de mandarin, rouleau, pinceau-baguette) |
| `iron_gladiator` | Soldat de terre cuite en armure de fer |
| `shadow_assassin` | Assassin masqué de l'ombre (lames, voile noir) |
| `plague_doctor` | Docteur-démon à masque de bec et gourdes de poison |
| `storm_knight` | Général du tonnerre (armure bleu électrique, lance éclair) |
| `storm_wyrm` | Serpent-dragon du tonnerre (long, jaune/bleu, éclairs) |
| `orc_warmaster` | Général ogre-démon (peau rouge-verte, hache à lune) |
| `war_troll` | Ogre de guerre massif au gourdin clouté |
| `sand_colossus` | Golem d'argile du désert (fissures, yeux ambre) |
| `lava_behemoth` | Pixiu de magma (bête-chimère noire aux veines de feu) |
| `ice_witch` | Dame des neiges (robe de givre, éventail de glace) |
| `frost_dragon` | Long de givre (dragon chinois bleu glacé, longue barbe) |
| `ember_dragon` | Long de braise (dragon chinois rouge sombre, flammes) |
| `void_vampire` | Jiangshi (vampire sauteur, chapeau de mandarin, talisman sur le front) |
| `sun_paladin` | Garde solaire (armure blanche et or, emblème de soleil) |
| `deep_sea_serpent` | Serpent de rivière géant à nageoires |
| `crystal_sage` | Immortel de jade (être de jade et cristal) |
| `moon_priestess` | Prêtresse lunaire, servante de Chang'e (robe argentée, croissant) |
| `fire_tiger` (NOUVEAU) | Tigre embrasé (rayures de braise) |
| `flame_boar` (NOUVEAU) | Sanglier de flammes |
| `ember_wolf` (NOUVEAU) | Loup de braise |

## 8. Mécaniques de conception (hors périmètre du premier jet)

Le concept de départ évoque aussi un carquois limité et une jauge de stress thermique (insolation). Elles ne sont **pas**
implémentées dans cette refonte : le combat reste le puzzle match-3. Les extensions de l'exploration (illusions, soleil
protégé, scènes après victoire, ennemi qui n'apparaît qu'après un autre, Nouvelle Partie +) sont, elles, implémentées.
