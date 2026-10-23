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
montagne sous la pleine lune. Un générique de fin défile, puis le joueur continue sa partie ou exporte sa sauvegarde pour la **Nouvelle Partie +** (histoire rejouée, équipement gardé, arène ouverte dès le début).

Ton : épique, poétique, mélancolique ; humour léger chez les villageois ; tout public (pas de gore). Vouvoiement pour les
anciens et dignitaires, tutoiement pour les proches et les enfants. Français soigné, avec quelques termes chinois usuels
(hanfu, yaoguai, qi, jade, Fusang…). Les noms propres : Hou Yi, Chang'e, Fengmeng, Yao, Di Jun, Reine Mère de l'Occident.

## 2. Régions, soleils, identifiants (FIXES)

Une région = **un écran** (14×10) contenant un coin village (PNJ, quêtes) et un sanctuaire (le Soleil-Boss). Identifiant d'écran
= identifiant de région. Ordre linéaire du monde : chaque région est reliée à la précédente et à la suivante. **Ordre de progression : du plus chaud et chaotique (les dix soleils sont allumés : volcan, désert, lit de fleuve asséché, forêt calcinée, orages, plaine embrasée) au plus verdoyant (les soleils tombés, la mer revient, le Fusang fleurit).** Les ids de soleils (`sun_1`…`sun_9`) sont des identifiants fixes, ils ne suivent plus l'ordre : ordre d'abattage `sun_1, sun_6, sun_4, sun_2, sun_3, sun_5, sun_7, sun_8, sun_9`.

| # | id (écran = région) | Nom | Niveau d'accès | Biome (voir §6) | Soleil-Boss (id d'ennemi) | Particularité |
|---|---|---|---|---|---|---|
| 1 | `rizieres` | Rizières Desséchées | 1 | `paddy` | `sun_1` Soleil Ardent | Tutoriel. Maison de Hou Yi et Chang'e. **Fengmeng, rencontre 1** (duel d'entraînement) |
| 2 | `volcan` | Gorges du Volcan | 4 | `volcano` | `sun_6` Soleil de Magma | **Fengmeng, rencontre 2** (embuscade, duel d'archers) sur la route du 6ᵉ soleil |
| 3 | `gobi` | Désert de Gobi | 6 | `gobi` | `sun_4` Soleil des Mirages | **Illusions** : le vrai soleil parmi des doubles |
| 4 | `fleuve` | Lit du Fleuve Jaune | 11 | `riverbed` | `sun_2` Soleil des Eaux Taries | Fleuve asséché, passeur |
| 5 | `bambous` | Forêt de Bambous Calcinée | 17 | `bamboo` | `sun_3` Soleil de Cendres | Moine, herboriste |
| 6 | `tonnerre` | Monts du Tonnerre | 22 | `storm` | `sun_5` Soleil des Orages | Forgeron, ermite |
| 7 | `fauves` | Plaine des Fauves | 27 | `savanna` | `sun_7` Soleil des Bêtes Folles | Meutes embrasées : le soleil est **protégé** tant que la meute n'est pas abattue |
| 8 | `mer` | Rivage de la Mer Orientale | 32 | `coast` | `sun_8` Soleil des Marées | Pêcheurs, envoyé du Roi-Dragon |
| 9 | `fusang` | Cime du Fusang | 37 | `fusang` | `sun_9` Soleil Lâche | Il utilise le 10ᵉ soleil (PNJ `sun_ten`) comme bouclier : tir de précision, **ne pas toucher le dernier soleil** |
| 9 bis | `marees` | Hautes-Eaux de la Lune Montante | 38 | `coast` | `changxi` Changxi, mère des douze lunes (épreuve de bravoure, pas de soleil) | Région **marine** : digue, pontons de bois, village de pêcheurs sur pilotis (Shuiyu-sous-l'Eau). Toute l'eau déclenche des rencontres aquatiques et ne se franchit qu'avec le Pas de Yu (`sq_pas_de_yu`) ; le Vieux Xu, sur la digue, en donne un indice incomplet. Dossier : `world/PLAN-MAREES.md` |
| 10 | `lune` | Pic de la Lune | 40 | `moon` | — | Finale : Chang'e, **Fengmeng, boss final en 2 phases**, autel des gâteaux de lune, épilogue, NG+ |

Niveaux des soleils (`boss.level`, niveau de base ; `weakenedBy` en retire jusqu'à 2), dans l'ordre d'abattage : `sun_1` 6, `sun_6` 9, `sun_4` 14, `sun_2` 19, `sun_3` 24,
`sun_5` 30, `sun_7` 35, `sun_8` 40, `sun_9` 45 ; Fengmeng : 4, 8, 45 puis 48 (niveau maximal du joueur : 70). Échelle : l'aventure couvre
désormais les niveaux 1 à 48 (ancienne échelle × 2,6) ; gardes de sanctuaire = niveau de la région + 2, ennemis nommés de zone sauvage et
souterrains en proportion.

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

Les sanctuaires 2, 3, 5, 6, 8 et 9 abritent en plus un **PNJ de pourparlers** `parley_sunN` (ajouté, voir §9) ; il n'apparaît qu'après une
quête annexe de la région. Les ids FIXES ci-dessus ne changent pas.

## 4. Quêtes

- **Principales** (ids `q_sun_1` … `q_sun_9`) : une par soleil (objectif : abattre `sun_n`). `q_fengmeng` : vaincre `fengmeng_3b`
  (après `fengmeng_3a`). `q_epilogue` : ouvrir l'autel `moon_altar` (coffre) à `lune` après la victoire sur Fengmeng
  et déposer les gâteaux de lune ; sa validation met `ended = true` et **débloque la Nouvelle Partie +**.
- **Secondaires** (`side: true`, jamais requises) : 1 à 2 par région, donneur parmi les PNJ de la région ; elles rapportent
  un **composant de flèche** (champ `reward.fragment`, texte libre) tel que « Eau sacrée », « Vent céleste »,
  « Pierre de glace », « Plume de grue », « Écaille de dragon », « Cendre de phénix »… Ennemis nommés = `permanent: true`.
- Exception assumée : le passage vers la cime du Fusang est gardé par la quête annexe `sq_sceau_racines` (les trois morceaux du sceau de la Reine Mère) ; c'est la seule annexe obligatoire.
- Les quêtes principales ne dépendent que de la progression linéaire (les soleils précédents) ; les quêtes secondaires sont
  facultatives. Le doyen `elder_wen` délivre la première mission (ordre de l'empereur Yao) ; les suivantes démarrent
  automatiquement ou par un PNJ de la région (au choix du scénariste), toujours cohérentes avec le texte.
- **Légendes des Quatre Gardiens Célestes** (`world/legends.js`, ids FIXES) : quatre quêtes annexes qui rapportent chacune un **ultime utilisable par toutes les classes** (`spells.json`, `unlock.quest` ; le choix et la sauvegarde sont dans `ultimates.js` et `player.unlockedUltimates`). Les quatre Gardiens des points cardinaux ont perdu la mémoire sous la chaleur des neuf soleils ; un PNJ du village demande de retrouver leur relique dans la zone sauvage (coffre), puis de les affronter : le Gardien est un **boss unique nommé** (`boss: { name, level }`, permanent). Dessin de carte : PNG 64×64 du paquet `legends` (`tools/gen-legend-sprites.py`) ; cinématique : planche `sprites/ultimates/<ultime>-seq.png` (voir `SPECS.md`).

| Quête | Région (village, PNJ) | Relique (coffre) | Gardien (boss, niveau) | Ultime (niveau requis) |
|---|---|---|---|---|
| `sq_legend_zhuque` « Le feu du Sud » | Volcan (Hameau des Braises Sages, Rong) | `legend_zhuque_relic` plume de braise | `legend_zhuque_boss` Zhuque, niv. 10 | Renaissance de l'Oiseau Vermillon (10) : 1100 dégâts, soin 30 % |
| `sq_legend_xuanwu` « La carapace du Nord » | Fleuve (Port-à-Sec de Hekou, Bian) | `legend_xuanwu_relic` écaille de carapace | `legend_xuanwu_boss` Xuanwu, niv. 17 | Carapace de la Tortue Noire (16) : 900 dégâts, soin 25 %, +30 défense 4 tours |
| `sq_legend_baihu` « La chasse de l'Ouest » | Fauves (Enclos de Caoyuan, Hu Mu) | `legend_baihu_relic` griffe d'argent | `legend_baihu_boss` Baihu, niv. 33 | Chasse du Tigre Blanc (28) : 1250 dégâts, attaque ennemie −12 pendant 3 tours |
| `sq_legend_qinglong` « La tempête de l'Est » | Fusang (Terrasses de Fusang-le-Bas, Qing Yun) | `legend_qinglong_relic` perle d'azur | `legend_qinglong_boss` Qinglong, niv. 43 | Tempête du Dragon d'Azur (38) : 1050 dégâts, soin 20 %, +15 défense 3 tours |

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

**Cohérence historique** : le monde est la Chine mythique de Hou Yi, très ancienne. Aucun décor ni bâtiment anachronique (pas de verre,
volets, cheminées, portes modernes) : voir `agents/animation-pixel-art.md`. Les personnages sont rendus en pixel art 32 × 32 par `pixelate`.

**Décors d'exploration** : rendu inspiré de Pokémon GBA (tuiles de 16 unités, herbe à touffes, chemins bordés, eau à reflets,
sapins de bordure, rochers, maisons à grand toit) via `tilePainter.js`, dans les palettes de biome de §6.

Esthétique chinoise : hanfu et robes à larges manches, chignons (topknots) et épingles, chapeaux coniques, écailles, nuages
stylisés (xiangyun), motifs de vagues, rouge laqué, or, jade, bleu nuit, encre. Les créatures s'inspirent du bestiaire
chinois (yaoguai, jiangshi, dragons-longs sans ailes d'occidental…). Les **soleils** sont des disques/êtres de feu avec
flammes en volutes et un visage (chacun avec un élément et une couleur dominante distincts).

### Héros : Hou Yi sous quatre styles (les 4 classes existantes, ids FIXES)
`assassin` = **Hou Yi le Rôdeur errant, 游侠 Yóuxiá** (le look « par défaut » : tunique rouge et or, grand arc rouge, carquois, chignon, regard
déterminé), `sorcerer` = **Hou Yi le Mage antique, 方士 Fāngshì** (robe bleu nuit à nuages dorés, bâton à talisman, orbe de qi),
`templar` = **Hou Yi le Commandant, 武将 Wǔjiàng** (armure lamellaire laquée, grand bouclier rond, lance), `barbarian` = **Hou Yi le
Guerrier, 武士 Wǔshì** (fourrures, torse nu tatoué, grande hache). Noms affichés en jeu : « Français · pinyin » (`classes.js`). Même visage reconnaissable (cheveux noirs, chignon,
sourcils marqués) pour les quatre.

### Correspondance gabarits d'ennemis → créatures chinoises
Les ids de gabarits du catalogue restent inchangés (statistiques) ; seuls les noms et l'apparence changent. Les fiches de référence des créatures sont dans `bestiaire.csv`. Les ids des gabarits issus du bestiaire portent le nom de la créature (`chiyou`, `wen_shen`, `yinglong`, `pixiu`, `shanxiao`, `gui_esprit`) ; les 133 autres créatures du CSV sont dans `tools/bestiary-data.mjs` (source unique, intégrée par `tools/build-bestiary.mjs`).

| id de gabarit | Nouvelle identité |
|---|---|
| `huli_jing` | Huli Jing (esprit-renard),  petit démon-renard farceur à piège |
| `lingzhi_maudit` | Champignon lingzhi maudit (chapeau rouge à spores) |
| `crapaud_boue` | Crapaud de boue des rizières (dessin de `rizieres_w_toad`) |
| `shu_jing` | Shu Jing, esprit-arbre ancien (vieux pin/saule noueux) |
| `gui_guerrier` | Gui Guerrier, guerrier-squelette à sabre rouillé |
| `gui_esprit` | Gui, esprit errant des morts (silhouette pâle en robe fanée, lueur violette) |
| `suanni` | Suanni de pierre, lion-gardien de pierre (shishi) |
| `lettre_sorcier` | Lettré-sorcier (robe de mandarin, rouleau, pinceau-baguette) |
| `soldat_terre_cuite` | Soldat de terre cuite en armure de fer |
| `assassin_masque` | Assassin masqué de l'ombre (lames, voile noir) |
| `wen_shen` | Wen Shen, esprit de l'épidémie (fonctionnaire blême à chapeau d'officier, gourde de poison) |
| `lei_gong` | Lei Gong, général du tonnerre (armure bleu électrique, lance éclair) |
| `yinglong` | Yinglong, dragon ailé de la pluie (écailles bleu sombre, ailes de plumes, éclairs) |
| `chiyou` | Chiyou, chef de guerre mythique (casque à cornes de bœuf, armure de bronze, hache à lune) |
| `shanxiao` | Shanxiao, démon de montagne (petit humanoïde velu à une jambe, visage humain) |
| `hundun` | Hundun du Gobi, colosse d'argile du désert (fissures, yeux ambre) |
| `pixiu` | Pixiu, chimère ailée (tête de dragon, corps de lion noir aux veines de feu) |
| `dame_des_neiges` | Dame des neiges (robe de givre, éventail de glace) |
| `canglong` | Canglong de givre (Long) (dragon chinois bleu glacé, longue barbe) |
| `chilong` | Chilong de braise (Long) (dragon chinois rouge sombre, flammes) |
| `jiangshi` | Jiangshi (vampire sauteur, chapeau de mandarin, talisman sur le front) |
| `garde_solaire` | Garde solaire (armure blanche et or, emblème de soleil) |
| `jiaolong` | Jiaolong du fleuve, serpent de rivière géant à nageoires |
| `immortel_jade` | Immortel de jade (être de jade et cristal) |
| `pretresse_lunaire` | Prêtresse lunaire, servante de Chang'e (robe argentée, croissant) |
| `tigre_embrase` (NOUVEAU) | Tigre embrasé (rayures de braise) |
| `sanglier_flammes` (NOUVEAU) | Sanglier de flammes |
| `loup_braise` (NOUVEAU) | Loup de braise |

## 8. Mécaniques de conception (hors périmètre du premier jet)

Le concept de départ évoque aussi un carquois limité et une jauge de stress thermique (insolation). Elles ne sont **pas**
implémentées dans cette refonte : le combat reste le puzzle match-3. Les extensions de l'exploration (illusions, soleil
protégé, scènes après victoire, ennemi qui n'apparaît qu'après un autre, Nouvelle Partie +) sont, elles, implémentées.

## 9. Trois chemins vers chaque soleil, et les compagnons de route

Les soleils 2, 3, 5, 6, 8 et 9 sont protégés par deux gardes d'élite (`sunN_wardens_a` / `_b`, ids FIXES). Le soleil 7 (meute) reste un
combat ; les soleils 1 et 4 n'ont pas de garde. Pour chacun des six, trois chemins, qui laissent chacun une trace différente :

- **Risque** : abattre les deux gardes (combat d'élite, expérience) ; le soleil reste à son niveau plein ; une réplique de compagnon
  « gardes abattus » (`whenDone` sur les deux ids de gardes, `unless` le pourparler).
- **Relationnel** : la quête annexe de la région une fois faite, un PNJ `parley_sunN` apparaît dans le sanctuaire ; la 1re conversation est
  un pourparler (`parley`) qui lève le bouclier sans combat (`unsealedBy`) et fait disparaître les gardes (`hideWhen`). Le PNJ reste
  comme allié (répliques `talk`, dont une après la chute du soleil) ; réplique de compagnon « pourparlers » (`whenDone: 'parley_sunN'`).
- **Découverte** : les deux quêtes annexes de la région retirent chacune un niveau au soleil (`weakenedBy`, 2 au plus). La quête qui ouvre
  le pourparler est l'une de ces deux quêtes : elle sert donc les deux chemins, et l'autre quête n'affaiblit que le soleil.

| Soleil | Problème de la zone | Pourparler (PNJ, condition `showWhen`) | Ce que dit le pourparler | Affaiblissement (`weakenedBy`) |
|---|---|---|---|---|
| `sun_2` (fleuve) | le fleuve bu ; les noyés-gardes n'ont plus de lit pour dormir | `parley_sun2` Yuan, doyen des noyés (`sq_drowned`) | les gardes veillent l'eau perdue, pas le soleil ; il les rappelle contre la promesse de rendre le fleuve | `sq_river_serpent`, `sq_drowned` |
| `sun_3` (bambous) | la cloche muette ; deux « échos » errent autour du soleil | `parley_sun3` Tintement, âme de la cloche (`sq_bell`) | les esprits sont ses échos, perdus faute de cloche ; la voix rendue, ils se rendorment | `sq_bell`, `sq_old_pine` |
| `sun_5` (tonnerre) | le tonnerre sans tambour ; ses fils gardent la cage d'éclairs | `parley_sun5` Rongrong, petite voix du tonnerre (`sq_lei_drum`) | le foudre-garde est son grand frère, le lion de pierre son compagnon ; il leur ordonne de lâcher la cage | `sq_thunder_wyrm`, `sq_lei_drum` |
| `sun_6` (volcan) | le brasero éteint ; les derniers servants du temple du feu attisent le soleil | `parley_sun6` Chi, vieil attiseur (`sq_ember`) | les forgerons soufflent par habitude ; la cendre sauvée, il leur fait poser les soufflets | `sq_ore`, `sq_ember` |
| `sun_8` (mer) | la cloche d'eau retenue sur ordre du Roi-Dragon ; sa perle perdue | `parley_sun8` Amiral Xie, escadre du Roi-Dragon (`sq_pearl`) | les gardes-marée attendent un archer digne de confiance ; la perle rendue, il lève la consigne | `sq_nets`, `sq_pearl` |
| `sun_9` (fusang) | les grues-lige couvrent le Dixième Soleil, pas le Neuvième | `parley_sun9` Hegui, sœur de la messagère (`sq_crane`) | les grues redoutent un tir maladroit ; le nid retrouvé, elle les rappelle sur la branche haute | `sq_crane`, `sq_sceau_racines` |

Les trois chemins ne mènent jamais au même combat avec un simple coffre différent : le risque coûte un combat mais rapporte de
l'expérience, le relationnel épargne le combat et garde un allié (le PNJ reste, son texte change après la chute du soleil), la découverte
affaiblit le boss. Les `shieldLines` de chaque soleil et les `hint` de sa quête principale (`q_sun_N`) annoncent les trois chemins.

### Compagnons (`companions.js`)

Trois compagnons facultatifs rejoignent le héros quand leur condition `joinWhen` est remplie. Ils réutilisent le dessin d'un PNJ existant
(`npc`) et commentent les lieux, les décisions (chemin pris), les événements (soleil tombé, Fengmeng) à travers `BANTER`, jouées une fois.

| Compagnon | Rejoint (`joinWhen`) | PNJ réutilisé | Voix | But personnel | Réaction à Fengmeng |
|---|---|---|---|---|---|
| **Xiao Gui**, démon-renard repenti | `sq_rice_thief` (région 1) | `huli_xia` | tutoie tout le monde, farceur, « hi hi » | gagner ses neuf queues (il en a trois) en rendant service, pas en volant | voit en lui son ancien reflet : il court après ce qu'il croit lui être dû (`fengmeng_1`, `fengmeng_2`, fin) |
| **Zhi**, jeune moine novice | `sq_bell` (région 3) | `young_monk_zhi` | vouvoie le héros (« seigneur »), cite Maître Zhen, tutoie Xiao Gui | entendre « l'heure qui n'existe pas encore » ; savoir si la compassion s'étend aux soleils | Maître Zhen a connu Fengmeng : « on guérit mal ce qu'on ne regarde pas » (`fengmeng_2`) |
| **Dawa**, guide du désert | `sq_oasis` (région 4) | `guide_dawa` | vouvoie le héros, pince-sans-rire, proverbes du Gobi | voir le Fusang, « un endroit où personne ne se perd » | « la même soif » que celle du mirage : il courait après un élixir (fin) |

Trois mécaniques :
- **Dialogues contextuels** : lieux (`screen`), décisions (chemin pris), événements (`whenDone: 'sun_N'`, `fengmeng_N`).
- **Relations qui évoluent** : deux répliques exclusives par soleil à pourparlers (`whenDone` les deux gardes + `unless: parley_sunN`, et
  `whenDone: parley_sunN` + `unless: sunN_wardens_a`) ; le ton change : admiration, malaise, prière, mise en garde. Dernier exemple :
  la quatrième queue de Xiao Gui pousse au bord de la mer si le pourparler du soleil 8 a eu lieu (`gui_mer_parley`, `gui_queues_quatre`),
  sinon il reste à trois queues et dit avoir « changé de bande » (`gui_queues_trois`).
- **Aptitudes narratives** : un compagnon suggère le pourparler quand la quête annexe est faite et que les gardes sont debout
  (Xiao Gui au fleuve, Zhi aux bambous et au volcan, Dawa au tonnerre et au Fusang, Xiao Gui à la mer).

Faits nouveaux : les noyés ont un doyen (Yuan) ; la cloche du temple brûlé a une âme (Tintement) dont les deux « esprits » sont des échos ;
le tonnerre a un enfant (Rongrong) ; le temple du feu avait un attiseur (Chi, maître de Yan) ; l'escadre du Roi-Dragon a un amiral (Xie), et
sa perle fait foi d'ordre ; les grues-lige du Fusang protègent le Dixième Soleil (Hegui, sœur de la messagère) ; Maître Zhen a reçu
Fengmeng en méditation, Xia la renarde a sept queues.

## Bordures de mer (post-Pas de Yu)

Chaque carte est entourée de mer. Une fois le Pas de Yu appris (`sq_pas_de_yu`, Gui à Hekou), le héros peut marcher sur cette mer et, en atteignant le bord nord ou sud de n'importe quelle carte de ces régions (route, village, zone sauvage ou hameau, sanctuaire), arriver sur le bord de la carte d'en face dans la région voisine sur la carte du monde : Volcan ↕ Mer Orientale, Gobi ↕ Plaine des Fauves, Lit du Fleuve ↕ Bambous ↕ Monts du Tonnerre, Rizières ↕ Fusang (`world/connections.js`). Pas de route ni de ponton : seulement l'eau. La Lune n'en a aucune : on n'y monte que depuis les Hautes-Eaux, par Changxi. Chaque bordure reste fermée par un courant contraire tant que le gardien de la route vers la plus avancée des deux régions n'est pas vaincu.
