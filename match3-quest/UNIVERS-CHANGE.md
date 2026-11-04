# Chang'e, gardienne de la mémoire : l'histoire parallèle (futur mode Chang'e)

Document de conception du mode où l'on incarne **Chang'e**. Il complète `UNIVERS.md` (source de vérité de la campagne de Hou Yi) sans rien
y contredire : mêmes régions, mêmes PNJ, mêmes dates ; seule la façon d'y être change. **On ne joue Chang'e que trois fois** (§2). **Implémenté** dans `change/` (voir §10).

## 1. Intention : un but à elle

Dans la campagne de Hou Yi, presque tout ce que fait Chang'e tient en une phrase : elle aime son mari. Dans son mode, elle a **son propre
objectif** :

> **Chang'e veut préserver la mémoire des gens ordinaires.**

Pendant que Hou Yi sauve le monde à coups de flèches, elle aide les familles déplacées, soigne les blessés, distribue des provisions et
recueille les histoires des villages. Elle ne veut pas être immortelle, elle ne veut pas devenir une déesse : elle veut que les gens puissent
retrouver **une vie normale**.

> Hou Yi sauve des milliers de vies. Chang'e, elle, **connaît leurs noms**.

Conséquences de cet objectif :

- **Les gâteaux de lune changent de sens.** Ils ne sont plus seulement le symbole de son amour conjugal : ils sont sa manière de prendre soin
  du monde.
- **Chaque gâteau a une particularité.** Elle se souvient du goût de chaque personne à qui elle en a offert un (voir §4).
- **Sa dynamique est inverse de celle de Hou Yi.** Pas d'ennemi, pas de tête de mort, pas de dégâts : les PNJ ont **peu de vie**, et c'est elle qui
  combine des tuiles pour leur en rendre.

### 1.1 D'où vient son don

**Chang'e a bu une goutte de l'élixir par accident**, en le rangeant : c'est ce qui lui donne le don de soigner. Elle le dit elle-même au tout début
du premier épisode (« je n'ai pas voulu l'immortalité, et je ne l'ai pas eue »). **Ce ne sont donc pas encore des pouvoirs liés à la lune** : elle n'y est
pas (elle n'y montera qu'en buvant le reste de l'élixir, au Pic de la Lune). Dans ce mode, rien n'est « lunaire » : les énergies s'appellent jade, lotus,
perles de nacre, eau claire et énergie argentée, le joker est une **goutte d'élixir** et le pouvoir du plateau est le **souffle de l'élixir**. Seuls les
**gâteaux de lune** gardent leur nom : ce sont des gâteaux, pas des pouvoirs.

### Ton

Chaleureux, discret, concret. Les victoires de Chang'e sont minuscules (une soupe chaude, un nom retrouvé, un enfant qui rit) et c'est ce qui les
rend grandes. Humour léger des villageois conservé ; vouvoiement des anciens, tutoiement des proches et des enfants ; aucun gore, **aucune mort**.

## 2. Trois épisodes seulement

**On ne joue Chang'e que trois fois.** Chang'e est toujours **deux régions derrière** Hou Yi : quand il est dans la région 3, elle est dans la 1 ;
quand il est en 6, elle est en 4 ; quand il est en 9, elle est en 7. Elle arrive dans les villages qu'il vient de délivrer : la menace est tombée,
les dégâts restent.

| Épisode | Déclencheur : Hou Yi vient de tuer… | Chang'e est en… | Village | Ce que Hou Yi vient de faire |
|---|---|---|---|---|
| 1 | le soleil de la région 3 `gobi` (`sun_4`, Soleil des Mirages) | région 1 `rizieres` | Hameau de Dongqiao (le village de leur maison) | Premier soleil abattu, Fengmeng croisé, les mirages du désert |
| 2 | le soleil de la région 6 `tonnerre` (`sun_5`, Soleil des Orages) | région 4 `fleuve` | Port-à-Sec de Hekou | Eaux taries, cendres, orages |
| 3 | le soleil de la région 9 `fusang` (`sun_9`, Soleil Lâche) | région 7 `fauves` | Enclos de Caoyuan | Meutes embrasées, marées, soleil lâche |

(Les numéros sont ceux de `UNIVERS.md` §2.) Les régions 2, 3, 5, 6, 8, 9 et les Hautes-Eaux ne sont jamais visitées par Chang'e ; la région 10 reste
exclusivement dans la campagne de Hou Yi (l'élixir).

### 2.1 Déroulé d'un épisode

1. **Entrée** : Hou Yi **vient d'abattre le soleil** de la région 3, 6 ou 9. Le miroir s'éclaire et Hou Yi **parle un moment avec Chang'e**
   (il lui raconte ce qui vient de se passer, elle lui dit où elle est). **Quand il a fini de parler, la transition par le miroir se lance** :
   le reflet du miroir s'ouvre en cercle et révèle Chang'e (animation « reflet circulaire » : `sprites/change/mirror-in.gif`, et `mirror-out.gif` pour le retour) et le joueur arrive chez Chang'e, dans le
   village deux régions plus tôt.
2. **Exploration du village** : le joueur **explore la carte du village avec Chang'e, comme avec Hou Yi** (mêmes déplacements, même vue), **de personne
   blessée en personne blessée, cinq au plus**. Pas d'ennemi, pas de coffre, pas de hautes herbes à rencontres, pas de compagnon ; chaque blessé est
   marqué d'un anneau doux (une coche verte une fois soigné), jamais d'une croix rouge. **Chang'e reste dans le village** : si elle touche une sortie ou
   le bord de la carte, **le narrateur rappelle qu'il reste du monde à soigner**. Au tout début de l'épisode 1, elle avoue la goutte d'élixir (§1.1).
3. **Soin** : toucher un blessé (marcher vers lui) ouvre son **puzzle de soin** (§5). Un PNJ guéri se lève, remercie, reçoit son gâteau et entre dans le **Livre des noms**.
4. **Fin d'épisode** : **une fois que tout le monde est soigné**, Chang'e **parle à Hou Yi** à travers le miroir (courte scène, §2.3), puis
   **retour au monde normal** (même animation à l'envers). **Épisode 3** : c'est la **dernière fois** qu'ils se parlent par le miroir ; Chang'e le
   **coupe elle-même** à la fin de la scène (§2.4).
5. **Sortie anticipée** : sinon, le joueur peut toucher le **bouton miroir** de l'interface pour activer la transition, **après confirmation**
   (« Revenir auprès de Hou Yi ? Les soins déjà faits sont conservés. »). Les PNJ non soignés **restent accessibles** (§5.5) : on peut y retourner.

### 2.2 Les blessés de chaque village

Tous les blessés sont des **habitants déjà présents** dans `world/text/<région>.js` (aucun nom inventé) : c'est le principe du mode, Chang'e connaît
les gens que Hou Yi a croisés (ou jamais croisés). Cinq par village. **Énergie** = la couleur de tuile que le PNJ demande ; X points de soin en N coups (une tuile de la couleur = 1 point, +1 pour un alignement de quatre, +2 pour cinq) ;
**gâteau** = saveur et particularité (§4), à affiner avec l'agent Scénario selon le caractère de chacun. Xihe la colporteuse (`hua_riz`,
`hua_fleuve`, `hua_fauves`), animaux (Dahei, Gui, Tian…) et PNJ de quête de Hou Yi ne sont **pas** des blessés.

**Épisode 1 : hameau de Dongqiao (`rizieres`)**

| Blessé (id) | État | Énergie, X / N | Gâteau (goût, particularité) |
|---|---|---|---|
| Lin (`farmer_lin`) | Coup de chaleur, désespéré | Jade, 24 / 12 | Haricot rouge, un peu de gingembre (mains froides) |
| Doyen Wen (`elder_wen`) | Épuisé d'avoir porté le village | Eau claire, 24 / 12 | Peau de neige, sans sucre |
| Ping (`ping`, épouse de Lin) | Évanouie à la rizière sèche | Lotus, 26 / 12 | Taro, une fleur de lotus |
| Petit Bao (`xiaobao`) | Enfant déshydraté | Perles de nacre, 26 / 11 | Jaune d'œuf salé, **très petit** (il n'en a jamais fini un) |
| Grand-mère Tao (`grandma_tao`) | Doyenne des commères, malaise | Énergie argentée, 28 / 12 | Matcha, double croûte |

**Épisode 2 : Port-à-Sec de Hekou (`fleuve`)**

| Blessé (id) | État | Énergie, X / N | Gâteau |
|---|---|---|---|
| Gu (`ferryman_gu`) | Soif, bateau échoué | Eau claire, 34 / 12 | Peau de neige, pas de sucre |
| Mei (`weaver_mei`) | Fièvre de boue | Lotus, 34 / 12 | Haricot rouge, un fil de soie dans le ruban |
| Hu (`salt_hu`) | Marchand de sel, poumons pris | Jade, 38 / 12 | Matcha, salé comme son entrepôt |
| Lian (`girl_lian`) | Enfant fiévreuse | Perles de nacre, 36 / 11 | Taro, en forme de coquillage |
| Vieux Rao (`fleuve_village_old_caulker`) | Calfat sans coque, épuisé | Énergie argentée, 40 / 12 | Jaune d'œuf salé, deux jaunes |

**Épisode 3 : Enclos de Caoyuan (`fauves`)**

| Blessé (id) | État | Énergie, X / N | Gâteau |
|---|---|---|---|
| Zi (`shepherd_zi`) | Bergère, troupeau dispersé | Jade, 44 / 13 | Matcha, un brin de menthe sauvage |
| Wu (`hunter_wu`) | Morsures, fièvre | Lotus, 46 / 13 | Haricot rouge, grosse part |
| Dame Sa (`cheese_sa`) | Marchande de lait caillé, coup de chaleur | Perles de nacre, 48 / 13 | Taro, au lait |
| Bai (`old_nomad_bayan`) | Vieux nomade, cœur fatigué | Eau claire, 50 / 13 | Peau de neige, tout doux |
| Mulan (`fauves_village_khulan`) | Jeune archère mordue | Énergie argentée, 54 / 13 | Jaune d'œuf salé, un petit arc de pâte |

À la fin des trois épisodes, **15 noms** sont dans le Livre des noms.

**Fin du mode** : Chang'e n'est pas devenue déesse par désir. Au Pic de la Lune, elle boit l'élixir avant que Fengmeng ne s'en empare ; elle ne
sacrifie pas sa vie mais sa présence auprès de son mari, et sur la Lune elle garde ce qu'elle a toujours fait : elle se souvient. Pour le joueur
qui a soigné les quinze blessés, l'épilogue ajoute un détail : sur le Pic de la Lune, le Livre des noms est ouvert à ses pieds, et chaque lumière de
village en dessous est un nom (le joueur qui n'a pas joué Chang'e voit la même scène, sans le Livre).

### 2.3 Ce que Chang'e dit à Hou Yi (une fois tous soignés)

Courtes scènes, vues à travers le miroir (Hou Yi la voit dans le sien, elle le voit dans le sien). Elles répondent à la conversation d'entrée (§2.1, étape 1). Elle donne des **noms**, pas des chiffres.

- **Épisode 1** : « Tu as chassé le soleil du désert, Hou Yi. Ici, Lin a retrouvé ses mains, Wen sa voix, Song sa fille, Bao son sourire. Hua a mangé son gâteau. Mange aussi. »
- **Épisode 2** : « Pei m'a demandé si le fleuve reviendrait. Je lui ai dit que tu faisais ce qu'il fallait. Il a ri. C'est la première fois depuis longtemps. »
- **Épisode 3** : « Je connais le nom de chaque bête de Zi. Toi, tu en as sauvé des milliers que tu ne connaîtras pas. Moi, je connais leurs noms. On se complète. Hou Yi… écoute-moi. Fengmeng sait que c'est moi qui garde l'élixir. S'il te suit assez longtemps, il me trouvera par ce miroir. Je ne le laisserai pas faire. Pardonne-moi. »

Hou Yi répond brièvement (un mot, un remerciement, une inquiétude pour elle), puis le miroir s'éteint. Dans l'épisode 3, il **n'a pas le temps de répondre** : le lien est coupé (§2.4).

### 2.4 Cohérence avec la campagne de Hou Yi (refonte du scénario du 2026-11-03)

- Dans `UNIVERS.md`, **après le soleil 9, le miroir se tait : c'est Chang'e qui a coupé le lien**, et le **lièvre de jade** (`moon_messenger`) vient
  l'expliquer à Hou Yi sur la carte du Fusang. L'**épisode 3 est donc l'ultime conversation** : Hou Yi tue le soleil de la région 9 (il épargne l'autre
  par compassion), parle à Chang'e, la transition se lance, elle soigne Caoyuan, lui dit au revoir et **éteint le miroir**. Le bronze froid et le
  lièvre de jade, déjà dans le jeu, viennent ensuite comme **suite** de cette scène.
- Au Pic de la Lune (campagne de Hou Yi), Chang'e boit l'élixir parce que Fengmeng ne reculera devant rien et que son époux est en danger de mort :
  elle ne sacrifie pas sa vie mais sa présence. Le mode Chang'e ne change rien à cette fin ; il lui donne seulement **une raison de plus** (les 15 noms).
- Xihe la colporteuse (mère des dix soleils) peut figurer comme **spectatrice** dans chaque village ; elle n'est jamais blessée.

## 3. Personnages

- **Chang'e** : voir `sprites/png/change_*.png` (PNJ) et `change_jouable` (sprite jouable, quatre directions, marche, geste de soin).
  Boulangère de gâteaux de lune, calme, observatrice, jamais pressée. Parle peu, écoute beaucoup. Elle n'a pas d'arme.
- **Hou Yi** : n'est jamais au centre. Il apparaît de loin (un soleil qui tombe, une flèche, un village qui respire de nouveau). Les deux se
  parlent à travers **le demi-miroir** (voir §7).
- **Les gens ordinaires** : les habitants existants des trois villages (voir §2.2) y gagnent une histoire et un **goût**. Les autres blessés sont aussi des habitants
  nommés du jeu : c'est le cœur du mode, **chaque PNJ soigné entre dans le Livre des noms**.
- **Fengmeng** : absent du gameplay, présent dans les marges (un village qu'il a pillé, une rumeur). Jamais d'affrontement.

## 4. Les gâteaux de lune de Chang'e et le Livre des noms

- Chaque personne soignée reçoit **un gâteau préparé pour elle** : une saveur (haricot rouge, neige bleue, matcha, jaune d'œuf salé, taro) et une
  **petite particularité** (une pincée de gingembre pour Lin qui a froid aux mains, pas de sucre pour Gu, une fleur de lotus pour la petite Mei…).
- Chaque gâteau est écrit dans le **Livre des noms** : nom, village, goût, une phrase de ce que la personne a dit. C'est une collection (comme le
  bestiaire côté Hou Yi) et la mesure de la progression du mode.
- Le Livre garde la mémoire d'une personne tant qu'on le feuillette : un PNJ déjà soigné qui revoit Chang'e la salue par son goût
  (« Le gâteau au gingembre ! »), c'est la récompense émotionnelle du mode.
- Effet de jeu (proposé) : chaque gâteau offert donne un **petit bonus passif** lié à son goût (voir §5, pouvoirs) ; plus on connaît de noms,
  plus le plateau s'enrichit de « tuiles de souvenir ».

## 5. Gameplay : un puzzle de soin, sans ennemi

### 5.1 Principe général

Contrairement à Hou Yi, Chang'e **ne combat pas**. Elle utilise son don de soigner (une goutte d'élixir bue par accident, voir §1.1) pour soigner les PNJ victimes des coups de chaleur
provoqués par les dix soleils et les créatures associées. Le gameplay reprend le principe de Puzzle Quest mais **inverse sa finalité** : les
combinaisons de tuiles **restaurent des points de vie** au lieu d'infliger des dégâts.

### 5.2 Le plateau

Même grille que le jeu de base (`board.js`, `matchMechanics.js`). Les tuiles représentent des **énergies curatives** :

| Énergie | Tuile actuelle (visuel à rethématiser) | Rôle |
|---|---|---|
| Jade | `tile-green` | soin standard |
| Lotus | `tile-red` | soin standard |
| Perles de nacre | `tile-purple` | soin standard |
| Eau claire | `tile-blue` | soin standard |
| Énergie argentée | `tile-yellow` | soin standard |
| Goutte d'élixir (joker) | `tile-joker` | joker ; un 5 en ligne le crée |

**Retirés** de ce mode : `tile-skull` (soleil ardent) et `tile-combat` (flèche). Il n'y a ni tuile de dégât, ni attaque d'adversaire.

> **Taux d'apparition : 0 % de crânes et 0 % de flèches.** Ni au tirage initial du plateau, ni au remplissage après une combinaison, ni par un
> pouvoir, un bonus ou un gâteau. Les tables de tirage du mode ne contiennent que les cinq énergies de soin (et le joker créé par un 5 en ligne) ;
> aucune case ne peut contenir un crâne ou une flèche, même transformée ou héritée de la campagne de Hou Yi. Test attendu : sur un grand nombre de
> tirages et de cascades, **zéro** `tile-skull` et **zéro** `tile-combat`.

- **3 tuiles** alignées : soin de base.
- **4 ou 5 tuiles** : bonus (soin multiplié, tuile spéciale créée).
- **Certaines tuiles** déclenchent un **pouvoir** : par exemple, une tuile « goutte d'élixir » qui soigne tous les PNJ d'un point, une tuile
  « lotus » qui ajoute un coup. Les pouvoirs viennent des gâteaux déjà offerts (§4).

### 5.3 Objectif d'un niveau : les PNJ blessés

Chaque niveau présente **un ou plusieurs PNJ blessés**, chacun avec **sa propre barre de vie**. **Chaque PNJ impose de collecter X tuiles d'une
couleur en N coups** pour le soigner : la barre se remplit à chaque tuile de la bonne couleur retirée (les autres couleurs servent à préparer des
combinaisons et à charger les pouvoirs).

Exemples d'objectifs :

- Soigner entièrement **un villageois** (X tuiles d'une couleur en N coups).
- Restaurer la santé de **plusieurs habitants** (une couleur par PNJ).
- Atteindre un **seuil de santé** pour chacun.
- Soigner un personnage **particulièrement affaibli** (un seul PNJ, X élevé, N serré).

Les valeurs X / N de chaque PNJ sont fixées dans le tableau de l'épisode correspondant (§2.2). **Points de soin** : chaque tuile de la couleur demandée
retirée vaut 1 point, +1 pour un alignement de quatre et +2 pour cinq (qui laisse aussi un joker « goutte d'élixir »). Les tuiles des autres couleurs chargent
la jauge du **souffle de l'élixir** (10 tuiles) : un bouton qui convertit 5 tuiles en la couleur demandée, sans dépenser de coup. Réglage mesuré par simulation
(joueur au hasard / joueur glouton) : épisode 1 de 78-93 % / 95-99 % de réussite par tentative, épisode 2 de 49-67 % / 79-93 %, épisode 3 de 23-45 % / 58-82 % ;
comme les soins sont conservés entre les tentatives, aucun blessé ne reste inguérissable. Un village compte **cinq blessés**, chacun avec une barre de vie
individuelle et une couleur imposée.

### 5.4 Réussite et échec

| Réussite | Échec |
|---|---|
| Les objectifs de soin sont atteints | Le nombre de coups disponibles est épuisé |
| Les PNJ retrouvent la santé demandée | Les objectifs de soin ne sont pas remplis |

- **Aucun chronomètre. Aucun adversaire pendant le puzzle. Aucune attaque supplémentaire. Aucun PNJ ne meurt définitivement.**

### 5.5 Progression après un échec

Pour ne jamais bloquer le joueur :

- Le puzzle peut être **recommencé**.
- Les soins déjà obtenus sont **conservés** entre les tentatives.
- Le plateau est **réinitialisé** à chaque nouvelle tentative.
- Les PNJ restent **accessibles** jusqu'à leur guérison complète.
- **Aucune quête ni récompense** ne devient définitivement inaccessible.

Le joueur peut **à tout moment** toucher le **bouton miroir** de l'interface : après **confirmation**, la transition le ramène au jeu de base (les soins restent acquis ; un épisode inachevé se reprend plus tard).

## 6. Pourquoi ça marche avec le jeu de base

- Même moteur de plateau, objectifs différents : réutilise `board.js`, `matchMechanics.js`, l'affichage des barres de vie (une par PNJ),
  les tuiles existantes (rethématisées), les effets de combo.
- Mode **facultatif** : un joueur qui n'aime pas le puzzle de soin le laisse de côté et ne perd rien de la campagne de Hou Yi.
- Aucun risque : pas de mort, pas d'ennemi, pas de défaite définitive, pas d'argent perdu.

## 7. Le miroir : passage entre les deux histoires

Le **demi-miroir** qu'ils se partagent est la **porte** entre les deux modes : Hou Yi y voit Chang'e, Chang'e y voit Hou Yi.
L'animation de transition retenue est le **reflet circulaire** (`sprites/change/mirror-in.gif`, 6,5 s, générée par
`tools/gen-change-mirror-transition.py`) ; la rotation de caméra par Wan et la rotation de l'image, essayées pendant la conception, n'ont pas été retenues (données de travail non versionnées dans `sprites/cinematics-change/`). La transition de retour joue la même animation à l'envers.

- **Aller** : Hou Yi **tue le soleil** de la région 3, 6 puis 9 ; il **finit de parler avec Chang'e** (dialogue à travers le miroir) ; **la transition se lance**
  et ouvre l'épisode. L'entrée est donc automatique et liée à la mort du soleil ; le **bouton miroir** de l'interface permet de rouvrir ensuite un épisode laissé en cours.
- **Retour** : soit **automatique** une fois les blessés soignés et la conversation faite, soit par le **bouton miroir** avec **confirmation**.
- Le bouton miroir est visible dans l'interface de la campagne de Hou Yi **seulement quand un épisode est disponible** ; dans le mode Chang'e il
  est toujours visible.

### 7.1 Revoir un épisode : le miroir de la maison

La **maison de Hou Yi et Chang'e** (Rizières) contient un **miroir** de bronze, près de Chang'e. **Y regarder propose de retourner dans un village déjà soigné**
(« Revoir : <village> ») de **reprendre** l'épisode resté ouvert (« Reprendre : <village> ») ou de **découvrir** un épisode jamais joué dont le soleil est déjà abattu (« Découvrir : <village> » : parties commencées avant le mode Chang'e ; il se joue comme au premier jour, conversation avec Hou Yi comprise). Rejeu : les cinq habitants sont de nouveau blessés, sans
conversation d'entrée ni d'adieu (le miroir ne se coupe qu'une fois : l'épisode 3 rejoué ne rejoue pas la coupure) ; les gâteaux déjà offerts restent au Livre
des noms ; l'épisode reste « terminé » et un épisode laissé ouvert n'est pas touché. Le miroir de la maison garde le **reflet** des villages (il fonctionne même
après la coupure du lien : ce ne sont pas des appels, mais des souvenirs). Avant le premier épisode, Hou Yi (le héros) dit seulement : « Le miroir favori de Chang'e… Il a une lueur irréelle. »

## 8. Direction artistique et audio (pistes)

- **Sprite jouable** : `change_jouable` (quatre directions, marche `walk_*`, geste de soin en `attack_*`), voir `SPECS.md`.
- **Palette** : blanc nacré, argent, lilas, or ; lumière de lune. Les décors restent ceux de la campagne.
- **Effets** : poussière dorée, pétales, anneaux argentés à chaque soin ; **jamais** de flammes ni de rouge agressif.
- **Musique** : un thème doux au piano et à la flûte (agent Musique) ; **effets** : tintements de jade, souffles d'eau (agent Effets sonores).

## 9. Reste à faire

1. Valider le choix des blessés (§2.2), la cohérence de l'épisode 3 avec le miroir coupé (§2.4) et les courbes de §5.3 (agent Équilibrage).
2. Relire les textes (dialogues d'entrée et de sortie, remerciements, gâteaux) avec l'agent Scénario ; ajouter les effets sonores et la musique propres au mode (agents Effets sonores et Musique).
3. Bonus passifs liés aux gâteaux (§4) et « tuiles de souvenir » : non implémentés.
4. Contrôle visuel sur appareil réel de la fenêtre (mise en page téléphone) : seul un parcours automatisé en DOM simulé a été fait.

## 10. Implémentation (état au 2026-11-03)

- **`change/engine.js`** : moteur pur du puzzle de soin (plateau 8×8, alignements avec joker, cascades, points de soin, jauge du souffle de l'élixir, soins conservés).
  Les tuiles possibles sont exactement `ENERGIES` + `JOKER` : **0 % de crâne et de flèche** par construction (tirage initial, remplissage, pouvoir).
- **`change/data.js`** : les trois épisodes (village, habitants réels, énergie, points et coups, gâteaux, remerciements, conversations d'entrée et de sortie, aveu de la goutte
  d'élixir à l'arrivée de l'épisode 1, finale de l'épisode 3) ; **`change/art.js`** : tuiles SVG ; **`change/state.js`** : état sauvegardé `session.data.change`
  (`done`, `pending`, `hp`, `healed`, `return` = place de Hou Yi pendant l'épisode) ; **`change/view.js`** : transition par le miroir, puzzle de soin, Livre des noms.
- **Moteur d'exploration** (`exploration.js`) : `startChangeMode` / `endChangeMode` téléportent le héros dans l'écran du village (`rizieres_village`, `fleuve_village`,
  `fauves_village`) et l'y enferment (`changeStay` sur toute sortie ou bord) ; ni ennemi, ni coffre, ni rencontre d'herbe, ni compagnon, ni monture ; les cinq blessés sont des PNJ
  virtuels (`rt.changeMode.npcs`, à leur place d'origine si l'habitant est sur cet écran, sinon sur une case libre). Il émet `changeEpisode` à la mort de `sun_4`, `sun_5`, `sun_9`
  (avant l'arrivée du messager du Fusang).
- **Vue** (`explorationView.js`) : Chang'e est dessinée à la place du héros (`change_jouable`, marche animée) ; toucher un blessé ouvre `openHeal` ; `changeStay` fait parler le
  narrateur ; bouton miroir du HUD (retour après confirmation, ou reprise d'un épisode inachevé) ; musique `change-village` / `change-farewell` (`main.js`).
- **Audio** (gm) : musiques ACE-Step `change-village`, `change-puzzle`, `change-farewell` (`tools/audio/acestep/catalog.mjs`, `composer.js` pour le repli procédural) et sept effets
  `change-swap`, `change-match`, `change-heal`, `change-cake`, `change-breath`, `change-mirror`, `change-cut` (`sfx_generate.py`, modèle gm/MMAudio, `sfxCatalog.js`).
- **Assets** : sprite `change_jouable` (marche, geste de soin), transitions `sprites/change/mirror-in.gif` et `mirror-out.gif`, tuiles dessinées en code. Précache mis à jour.
- **Tests** : `tests/unit/change.test.js` (moteur, données, déclencheur, sauvegarde, mode village dans le moteur d'exploration) et `tests/unit/changeView.test.js` (fenêtres, en jsdom).
