# Sorts de Match3 Quest

161 sorts, générés depuis `spells.json`. Effets uniquement. « Ennemis » : l'ennemi peut aussi lancer le sort (pour les sorts de classe, les ennemis de la même classe ; un sort de plateau détruit sur le vrai plateau des lignes, colonnes ou gemmes tirées au hasard).


## Sorts communs (61)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Souffle du Dragon de Feu | `fireball` | 1 | 10 rouge | 25 dégâts |  | Joueur et ennemis |
| Frappe du Phénix | `flameStrike` | 5 | 20 rouge | 50 dégâts |  | Joueur et ennemis |
| Brasier du Fourneau Céleste | `inferno` | 10 | 35 rouge | 80 dégâts |  | Joueur et ennemis |
| Étoile Filante | `meteor` | 15 | 50 rouge | 120 dégâts |  | Joueur et ennemis |
| Éclats de Givre | `ice` | 1 | 12 bleu | 30 dégâts |  | Joueur et ennemis |
| Vague du Roi-Dragon | `frostNova` | 5 | 22 bleu | 55 dégâts |  | Joueur et ennemis |
| Tempête de Neige du Nord | `blizzard` | 10 | 38 bleu | 85 dégâts |  | Joueur et ennemis |
| Grand Gel du Kunlun | `iceAge` | 15 | 50 bleu | 120 dégâts |  | Joueur et ennemis |
| Talisman de Jade | `heal` | 1 | 8 vert | Restaure 16 PV |  | Joueur et ennemis |
| Rosée Céleste | `greatHeal` | 5 | 18 vert | Restaure 36 PV |  | Joueur et ennemis |
| Circulation du Qi | `revitalize` | 10 | 30 vert | Restaure 60 PV |  | Joueur et ennemis |
| Bénédiction de la Lune | `miracle` | 15 | 45 vert | Restaure 90 PV |  | Joueur et ennemis |
| Éclair de Lei Gong | `bolt` | 1 | 15 jaune | 35 dégâts |  | Joueur et ennemis |
| Foudre des Monts du Tonnerre | `thunderBolt` | 5 | 25 jaune | 60 dégâts |  | Joueur et ennemis |
| Orage des Cent Éclairs | `lightningStorm` | 10 | 40 jaune | 90 dégâts |  | Joueur et ennemis |
| Tribulation Céleste | `stormOfGods` | 15 | 50 jaune | 125 dégâts |  | Joueur et ennemis |
| Vapeur du Chaudron Céleste | `vaporBurst` | 3 | 8 rouge, 8 bleu | 38 dégâts |  | Joueur et ennemis |
| Rosée Dorée | `goldenDew` | 4 | 9 vert, 6 jaune | Restaure 30 PV |  | Joueur et ennemis |
| Poison du Lotus Noir | `lotusPoison` | 6 | 10 violet, 10 vert | Inflige 48 dégâts et empoisonne l'adversaire : 5 dégâts par tour pendant 3 tours |  | Joueur et ennemis |
| Foudre Ardente de Zhurong | `emberStorm` | 7 | 14 rouge, 14 jaune | 70 dégâts |  | Joueur et ennemis |
| Flamme des Ombres | `shadowFlame` | 8 | 12 violet, 12 rouge | 58 dégâts |  | Joueur et ennemis |
| Pluie du Printemps | `springRain` | 9 | 14 vert, 10 bleu | Restaure 48 PV |  | Joueur et ennemis |
| Orage Glacé des Hauts Monts | `frostLightning` | 11 | 20 bleu, 20 jaune | 96 dégâts |  | Joueur et ennemis |
| Souffle du Vide Glacé | `voidChill` | 13 | 22 violet, 22 bleu | 108 dégâts |  | Joueur et ennemis |
| Lame des Quatre Vents | `bladeWinds` | 8 | 6 rouge, 6 jaune, 6 bleu | Choisissez une ligne : elle est détruite, vous récupérez son qì et l'ennemi subit 4 dégâts par case des couleurs du sort |  | Joueur et ennemis |
| Brasier des Sceaux | `brasierSeals` | 9 | 8 rouge, 8 jaune, 6 violet | Toutes les gemmes rouges et jaunes deviennent des crânes. Recharge : 2 tours (inutilisable au tour suivant) | 2 t. | Joueur |
| Tempête des Trois Dragons | `threeDragons` | 10 | 7 bleu, 7 jaune, 7 vert | Choisissez 3 colonnes à détruire (aperçu avant destruction), récupère leur qì et inflige 3 dégâts par case bleue, jaune ou verte détruite |  | Joueur et ennemis |
| Croix du Dragon | `dragonCross` | 11 | 8 rouge, 8 jaune, 8 bleu, 8 vert | Choisissez une case : sa ligne et sa colonne sont détruites (qì récupéré, 4 dégâts par case des couleurs du sort) |  | Joueur et ennemis |
| Prison du Tonnerre Glacé | `thunderPrison` | 11 | 7 bleu, 7 jaune, 7 violet | Étourdit l'ennemi 1 tour et lui retire 6 qì de chaque couleur. Recharge : 4 tours | 4 t. | Joueur |
| Souffle de Jade Céleste | `jadeBreath` | 13 | 12 vert, 8 bleu, 8 jaune, 8 violet | Soigne 50 PV, retire les statuts négatifs et vous laisse rejouer. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Pluie des Mille Étoiles | `starRain` | 15 | 9 rouge, 9 bleu, 9 vert, 9 jaune, 9 violet | Choisissez 2 lignes puis 2 colonnes à détruire : qì récupéré et 3 dégâts par case des couleurs du sort |  | Joueur et ennemis |
| Harmonie des Cinq Éléments | `fiveHarmony` | 17 | 10 rouge, 10 bleu, 10 vert, 10 jaune, 10 violet | Inflige 100 dégâts, vous soigne de 40 PV et retire 5 qì de chaque couleur à l'ennemi |  | Joueur et ennemis |
| Frappe des Deux Dragons | `twinDragonsStrike` | 16 | 30 rouge, 30 bleu | 168 dégâts |  | Joueur et ennemis |
| Plongeon de l'Oiseau Vermillon | `vermilionBirdDive` | 20 | 35 rouge, 35 jaune | 205 dégâts |  | Joueur et ennemis |
| Rugissement du Dragon Azur | `azureDragonRoar` | 24 | 30 bleu, 30 vert, 30 violet | 270 dégâts |  | Joueur et ennemis |
| Griffe du Tigre Blanc | `whiteTigerClaw` | 28 | 40 rouge, 40 jaune, 30 vert | 340 dégâts |  | Joueur et ennemis |
| Colère du Duc du Tonnerre | `thunderDukeWrath` | 33 | 60 jaune, 60 bleu | 385 dégâts |  | Joueur et ennemis |
| Sceau des Cinq Phases | `fiveElementsSeal` | 38 | 25 rouge, 25 bleu, 25 vert, 25 jaune, 25 violet | 410 dégâts |  | Joueur et ennemis |
| Crue du Fleuve Céleste | `heavenlyRiverFlood` | 43 | 80 bleu, 60 vert | 490 dégâts |  | Joueur et ennemis |
| Chute des Neuf Soleils | `nineSunsFall` | 48 | 75 rouge, 75 jaune | 540 dégâts |  | Joueur et ennemis |
| Chute du Mont Kunlun | `kunlunMountainFall` | 54 | 60 vert, 60 violet, 60 rouge | 665 dégâts |  | Joueur et ennemis |
| Hache de Pangu | `pangusAxe` | 60 | 70 rouge, 70 jaune, 70 bleu | 820 dégâts |  | Joueur et ennemis |
| Décret de l'Empereur de Jade | `jadeEmperorDecree` | 66 | 50 rouge, 50 bleu, 50 vert, 50 jaune, 50 violet | 1000 dégâts |  | Joueur et ennemis |
| Fin de la Tribulation | `heavenTribulationEnd` | 70 | 70 rouge, 70 bleu, 70 jaune, 60 vert | 1260 dégâts |  | Joueur et ennemis |
| Bénédiction de la Source de Jade | `jadeSpringBlessing` | 20 | 30 vert, 20 bleu | Restaure 100 PV |  | Joueur et ennemis |
| Pêche d'Immortalité | `immortalPeach` | 40 | 50 vert, 30 violet | Restaure 168 PV |  | Joueur et ennemis |
| Élixir de la Reine Mère d'Occident | `queenMotherElixir` | 60 | 60 vert, 40 bleu, 40 violet | Restaure 294 PV |  | Joueur et ennemis |
| Faux de Braise | `emberScythe` | 2 | 4 rouge | Choisissez une ligne : elle est détruite, qì récupéré, 3 dégâts par case rouge |  | Joueur et ennemis |
| Fente de Givre | `frostCleave` | 2 | 4 bleu | Choisissez une colonne : elle est détruite, qì récupéré, 3 dégâts par case bleue |  | Joueur et ennemis |
| Entaille du Vent | `galeSlash` | 4 | 6 jaune | Choisissez une colonne : elle est détruite, qì récupéré, 4 dégâts par case jaune |  | Joueur et ennemis |
| Faille du Néant | `voidRift` | 6 | 7 violet | Choisissez une ligne : elle est détruite, qì récupéré, 4 dégâts par case violette |  | Joueur et ennemis |
| Purge Écarlate | `crimsonPurge` | 5 | 14 rouge | Détruit toutes les gemmes rouges du plateau : qì récupéré, 2 dégâts par gemme détruite |  | Joueur et ennemis |
| Purge des Marées | `tidalPurge` | 5 | 14 bleu | Détruit toutes les gemmes bleues du plateau : qì récupéré, 2 dégâts par gemme détruite |  | Joueur et ennemis |
| Purge de Jade | `jadePurge` | 5 | 14 vert | Détruit toutes les gemmes vertes du plateau : qì récupéré, 2 dégâts par gemme détruite |  | Joueur et ennemis |
| Purge d'Orage | `stormPurge` | 6 | 14 jaune | Détruit toutes les gemmes jaunes du plateau : qì récupéré, 2 dégâts par gemme détruite |  | Joueur et ennemis |
| Purge d'Ombre | `shadowPurge` | 7 | 16 violet | Détruit toutes les gemmes violettes du plateau : qì récupéré, 2 dégâts par gemme détruite |  | Joueur et ennemis |
| Croix de Braise Dorée | `emberGoldCross` | 9 | 9 rouge, 9 jaune | Choisissez une case : sa ligne et sa colonne sont détruites, qì récupéré, 3 dégâts par case rouge ou jaune |  | Joueur et ennemis |
| Rideau de Jade et d'Eau | `jadeCurtain` | 8 | 8 vert, 8 bleu | Choisissez une colonne : elle est détruite, qì récupéré, 4 dégâts par case verte ou bleue |  | Joueur et ennemis |
| Rasoir d'Orage Pourpre | `purpleRazor` | 10 | 9 jaune, 9 violet | Choisissez une ligne : elle est détruite, qì récupéré, 4 dégâts par case jaune ou violette |  | Joueur et ennemis |
| Marée Ardente | `burningTide` | 12 | 12 rouge, 12 bleu | Détruit toutes les gemmes rouges et bleues du plateau : qì récupéré, 3 dégâts par gemme détruite |  | Joueur et ennemis |
| Purge des Quatre Saisons | `seasonsPurge` | 14 | 14 vert, 14 jaune | Détruit toutes les gemmes vertes et jaunes du plateau : qì récupéré, 3 dégâts par gemme détruite |  | Joueur et ennemis |

## Sorcier (28)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Frappe du Maître Taoïste | `mageStrike` | 1 | 3 rouge, 5 bleu | Inflige 10 dégâts +1 pour chaque 3 qì bleu possédés |  | Joueur et ennemis |
| Qi Sauvage | `wildMana` | 3 | 5 bleu, 5 vert | Transforme un gâteau de lune en pleine lune (joker x2) ou augmente le multiplicateur d'un joker (+2, max x7) |  | Joueur et ennemis |
| Talisman de Scellement | `shadowCurse` | 4 | 4 violet | Scelle l'ennemi pendant 3 tours : il ne peut plus utiliser d'arme ni d'objet et perd 4 d'attaque |  | Joueur et ennemis |
| Méridiens Obscurs | `darkChannels` | 5 | 6 violet | Choisir une couleur → tous les gâteaux de lune de cette couleur sont détruits et donnent leur qì |  | Joueur et ennemis |
| Talismans Enflammés | `flameBolts` | 5 | 5 rouge | Tire 1 talisman de feu de 5 dégâts pour chaque 5 qì jaune, puis vide le qì jaune |  | Joueur et ennemis |
| Barrière de Givre | `iceShield` | 6 | 8 bleu | Les dégâts sont appliqués au qì bleu au lieu des PV |  | Joueur et ennemis |
| Lame de Feu Pourpre | `flameblade` | 6 | 6 rouge | Ajoute tout le qì rouge au prochain coup d'arme, puis vide le qì rouge |  | Joueur et ennemis |
| Sceau d'Affaiblissement | `weakness` | 5 | 5 violet | Réduit la puissance offensive de l'ennemi de 5 pendant 4 tours |  | Joueur et ennemis |
| Paume de Givre | `handOfIce` | 6 | 7 bleu | Gel ou ralentissement de l'ennemi pendant 2 tours |  | Joueur et ennemis |
| Doigt de la Mort | `fingerOfDeath` | 7 | 8 violet | Transforme un gâteau de lune en crâne +5 (attaque forte) |  | Joueur et ennemis |
| Fissure du Fleuve Jaune | `chasm` | 8 | 10 rouge, 10 bleu | Détruit une zone du plateau et donne le qì correspondant |  | Joueur et ennemis |
| Peau de Jade | `stoneskin` | 7 | 8 vert | Augmente la défense de 15 pendant 4 tours |  | Joueur et ennemis |
| Force du Tigre | `strength` | 5 | 6 rouge | Augmente temporairement les dégâts physiques de 8 pendant 4 tours |  | Joueur et ennemis |
| Sphère de Flammes | `flameSphere` | 8 | 8 rouge | Détruit une zone 3×3 de gâteaux de lune et inflige 20 dégâts |  | Joueur et ennemis |
| Miroir de Bronze | `mirrorShield` | 9 | 10 bleu | Renvoie 30% des dégâts subis pendant 5 tours |  | Joueur et ennemis |
| Aspiration du Qi | `manaSiphon` | 8 | 7 violet | Absorbe 10 qì ennemi (toutes couleurs) |  | Joueur et ennemis |
| Explosion des Cinq Éléments | `manaBlast` | 15 | 15 rouge, 15 bleu, 15 vert, 15 jaune | Grande attaque des cinq éléments consommant beaucoup de qì |  | Joueur et ennemis |
| Œil du Tigre | `tigerEye` | 9 | 6 bleu | Augmente l'attaque (chance de critique) de 30 % pendant 3 tours |  | Joueur et ennemis |
| Éveil du Qi | `awakenQi` | 8 | 6 bleu | Gagne +40 de rage |  | Joueur et ennemis |
| Marée d'Orage | `stormTide` | 40 | 21 bleu | Gagne +100 de rage |  | Joueur et ennemis |
| Conversion du Cinabre | `cinnabarTransmute` | 9 | 4 vert | Transforme toute la rage en qì : 12 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Creuset Intérieur | `innerCrucible` | 40 | 16 vert | Transforme toute la rage en qì : 30 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Éclair de Fureur | `furyBolt` | 12 | 6 bleu, 4 violet | Libère toute la rage en magie pure : 3 dégâts par point de rage |  | Joueur et ennemis |
| Tonnerre Intérieur | `innerThunder` | 30 | 14 bleu, 10 violet | Libère toute la rage en magie pure : 5 dégâts par point de rage |  | Joueur et ennemis |
| Jugement du Ciel | `skyJudgement` | 60 | 26 bleu, 19 violet | Libère toute la rage en magie pure : 7 dégâts par point de rage |  | Joueur et ennemis |
| Sceau du Silence | `silenceSeal` | 7 | 5 violet | Rend l'ennemi muet 3 tours : il ne peut plus lancer de sorts |  | Joueur et ennemis |
| Marque Maudite | `cursedMark` | 9 | 6 violet | Maudit l'ennemi 3 tours : il subit 30 % de dégâts en plus |  | Joueur et ennemis |
| Souffle Impur | `impureBreath` | 11 | 8 violet | Corrompt l'ennemi 3 tours : ses soins deviennent des dégâts |  | Joueur et ennemis |

## Archer (19)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Tir Furtif | `sneakAttack` | 1 | 5 bleu | 6 dégâts et vous donne un tour bonus. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Tir Rapide | `swiftStrike` | 3 | 8 jaune, 4 rouge | Transforme tous les gâteaux de lune jaunes en violets et inflige 2 dégâts par gâteau converti |  | Joueur et ennemis |
| Flèche de Brume | `confuse` | 5 | 5 bleu, 6 vert | Confond l'ennemi 4 tours : il ne gagne que 1 qì par combinaison et ses attaques peuvent se retourner contre lui |  | Joueur et ennemis |
| Voile de Brume | `stealth` | 6 | 6 violet | Pendant 3 tours, les dégâts subis sont appliqués au qì violet au lieu des PV |  | Joueur et ennemis |
| Flèche Empoisonnée | `poisonBlade` | 7 | 6 vert | Applique un poison infligeant 3 dégâts par tour pendant 5 tours |  | Joueur et ennemis |
| Flèche d'Ombre | `shadowStrike` | 10 | 4 rouge, 8 violet | Détruit tous les gâteaux de lune violets et inflige 2 dégâts par gâteau détruit |  | Joueur et ennemis |
| Mue d'Acier | `steelMoult` | 13 | 6 violet | Transforme toutes les flèches d'action en gâteaux de lune violets et donne 1 point d'action par flèche |  | Joueur et ennemis |
| Flèches Jumelles | `dualShot` | 15 | 16 rouge, 16 bleu, 16 vert, 16 jaune | Inflige des dégâts égaux à l'attaque combinée des deux armes |  | Joueur et ennemis |
| Pas de l'Ombre | `shadowStep` | 4 | 5 jaune | Augmente la défense (chance de blocage) de 25 % pendant 3 tours |  | Joueur et ennemis |
| Flèche Affûtée | `sharpenedBlade` | 8 | 6 jaune, 4 rouge | Augmente l'attaque (chance de critique) de 35 % pendant 3 tours |  | Joueur et ennemis |
| Soif de Sang | `bloodThirst` | 8 | 6 jaune | Gagne +40 de rage |  | Joueur et ennemis |
| Frisson du Chasseur | `hunterThrill` | 40 | 21 jaune | Gagne +100 de rage |  | Joueur et ennemis |
| Vol de Fureur | `furyTheft` | 9 | 4 violet | Transforme toute la rage en qì : 8 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Pillage Intérieur | `innerPlunder` | 40 | 16 violet | Transforme toute la rage en qì : 20 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Frappe de Rancœur | `spiteStrike` | 12 | 6 jaune, 4 rouge | Libère toute la rage en 2 tirs, chacun pouvant être critique ou bloqué : 2 dégâts par point de rage au total |  | Joueur et ennemis |
| Estocade Furieuse | `furiousLunge` | 30 | 14 jaune, 10 rouge | Libère toute la rage en 3 tirs, chacun pouvant être critique ou bloqué : 3 dégâts par point de rage au total |  | Joueur et ennemis |
| Coup de l'Ombre Absolue | `absoluteShadowBlow` | 60 | 26 jaune, 19 rouge | Libère toute la rage en 4 tirs, chacun pouvant être critique ou bloqué : 4 dégâts par point de rage au total |  | Joueur et ennemis |
| Poudre de Sommeil | `sleepDust` | 9 | 6 bleu | Endort l'ennemi jusqu'à 2 tours : il n'agit pas tant qu'il ne subit pas de dégâts. Recharge : 4 tours | 4 t. | Joueur et ennemis |
| Flèche d'Épuisement | `exhaustArrow` | 11 | 6 vert | Épuise l'ennemi 4 tours : il perd 3 qì d'une couleur au hasard à chaque tour |  | Joueur et ennemis |

## Templier (23)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Muraille Impériale | `defensiveWall` | 1 | 3 vert, 4 violet | Détruit tous les gâteaux de lune violets → +5 défense par gâteau |  | Joueur et ennemis |
| Coup de Bouclier Rond | `shieldBash` | 3 | 7 rouge | 5 dégâts +1 par 3 points de défense. Retire les statuts négatifs |  | Joueur et ennemis |
| Concentration du Qi | `focus` | 4 | 3 bleu, 3 jaune | Transforme un gâteau de lune en flèche (point d'action) |  | Joueur et ennemis |
| Forge des Légions | `legionForge` | 11 | 5 bleu, 5 jaune | Transforme 4 gâteaux de lune au hasard en flèches d'action |  | Joueur et ennemis |
| Regard Impérial | `intimidate` | 5 | 3 violet | Vole 5 points d'action à l'ennemi |  | Joueur et ennemis |
| Charge de Cavalerie | `rush` | 7 | 7 jaune, 3 vert | L'ennemi perd 2 tours. Recharge : 4 tours | 4 t. | Joueur et ennemis |
| Riposte du Garde | `counterAttack` | 8 | 8 rouge | Inflige 10 dégâts lorsque tu bloques pendant 4 tours |  | Joueur et ennemis |
| Renfort des Troupes | `reinforce` | 9 | 7 vert | Détruit les flèches d'action et soigne de 10 PV par flèche |  | Joueur et ennemis |
| Moisson d'Acier | `steelHarvest` | 13 | 5 vert | Détruit toutes les flèches d'action et donne 2 qì bleu par flèche |  | Joueur et ennemis |
| Rempart de Jade | `barrier` | 10 | 10 vert | Augmente fortement la défense de 25 pendant 3 tours |  | Joueur et ennemis |
| Mandat du Ciel | `divinePower` | 10 | 6 jaune | Génère du qì selon la défense (1 qì jaune par 5 défense) |  | Joueur et ennemis |
| Formation de la Tortue | `holdTheLine` | 12 | 12 vert | Immunité à plusieurs effets négatifs pendant 3 tours |  | Joueur et ennemis |
| Courroux du Ciel | `heavensWrath` | 14 | 15 jaune | Explosion de toutes les flèches d'action infligeant 8 dégâts par flèche |  | Joueur et ennemis |
| Aura de Commandement | `commandAura` | 6 | 6 violet, 4 vert | Augmente l'attaque et la défense de 20 % pendant 3 tours |  | Joueur et ennemis |
| Serment de Combat | `battleOath` | 8 | 6 violet | Gagne +40 de rage |  | Joueur et ennemis |
| Ferveur du Garde | `guardFervor` | 40 | 21 violet | Gagne +100 de rage |  | Joueur et ennemis |
| Offrande de Colère | `wrathOffering` | 9 | 4 vert | Transforme toute la rage en qì : 8 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Autel de Fureur | `furyAltar` | 40 | 16 vert | Transforme toute la rage en qì : 20 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Frappe du Juste | `righteousStrike` | 12 | 6 violet, 4 rouge | Libère toute la rage : 2 dégâts par point de rage, et 10 de défense pour 100 de rage pendant 3 tours |  | Joueur et ennemis |
| Sentence du Garde | `guardSentence` | 30 | 14 violet, 10 rouge | Libère toute la rage : 3 dégâts par point de rage, et 15 de défense pour 100 de rage pendant 3 tours |  | Joueur et ennemis |
| Jugement du Mandat | `mandateJudgement` | 60 | 26 violet, 19 rouge | Libère toute la rage : 4 dégâts par point de rage, et 20 de défense pour 100 de rage pendant 3 tours |  | Joueur et ennemis |
| Regard Pétrifiant | `stoneGaze` | 10 | 7 jaune | Pétrifie l'ennemi 3 tours : il ne peut plus bloquer ni parer |  | Joueur et ennemis |
| Bastion Infranchissable | `unbreakableGuard` | 25 | 14 vert, 6 violet | Bloque totalement toutes les attaques pendant 5 tours, même les coups très puissants. Recharge : 7 tours | 7 t. | Joueur et ennemis |

## Barbare (18)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Fureur des Steppes | `enrage` | 1 | 2 vert, 6 rouge | Ajoute 10 dégâts inblocables à chaque attaque que vous infligez (crânes, armes, sorts) pendant 3 tours et ne termine pas le tour. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Entaille de la Horde | `cleave` | 3 | 9 rouge, 6 jaune | Inflige 2 dégâts par gâteau de lune jaune, puis détruit les jaunes |  | Joueur et ennemis |
| Lancer de Hache | `throwAxe` | 5 | 6 vert, 8 rouge | 12 dégâts +2 par crâne présent sur le plateau |  | Joueur et ennemis |
| Soif de Bataille | `bloodlust` | 5 | 5 vert, 5 jaune, 5 bleu | Donne +20 qì rouge |  | Joueur et ennemis |
| Appel du Vent Céleste | `summonTempest` | 8 | 8 rouge, 5 jaune, 5 bleu | Choisissez 2 colonnes : elles sont détruites |  | Joueur et ennemis |
| Fureur du Loup des Steppes | `berserkerRage` | 10 | 5 vert, 8 rouge | Transforme les gâteaux de lune rouges en crânes. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Lames Brisées | `brokenBlades` | 12 | 6 rouge | Transforme toutes les flèches d'action en crânes. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Flèches Sifflantes | `singingBlades` | 11 | 8 rouge, 6 jaune | Réduit le qì ennemi de 5 quand tu infliges des dégâts pendant 5 tours |  | Joueur et ennemis |
| Porte-Crânes | `deathbringer` | 14 | 8 vert, 16 rouge, 8 jaune, 8 bleu | Crée des crânes = ½ du qì rouge possédé. Recharge : 2 tours | 2 t. | Joueur et ennemis |
| Esprit des Ancêtres | `revenant` | 15 | 10 vert, 25 rouge, 20 jaune | Double les points d'action (flèches) pour le combat |  | Joueur et ennemis |
| Cri de Guerre | `warCry` | 4 | 5 rouge | Augmente l'attaque de 20 % et la défense de 10 % pendant 3 tours |  | Joueur et ennemis |
| Sang en Ébullition | `bloodBoil` | 8 | 6 rouge | Gagne +40 de rage |  | Joueur et ennemis |
| Souffle de la Colère | `furyToQi` | 9 | 4 vert | Transforme toute la rage en qì : 8 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Coup de la Fureur Brisée | `furyBlow` | 12 | 6 rouge, 4 jaune | Libère toute la rage en un coup massif : 4 dégâts par point de rage |  | Joueur et ennemis |
| Sang du Dragon | `dragonBlood` | 40 | 21 rouge | Gagne +100 de rage |  | Joueur et ennemis |
| Circulation de la Colère | `angerCirculation` | 40 | 16 vert | Transforme toute la rage en qì : 20 qì de chaque couleur par 100 de rage |  | Joueur et ennemis |
| Brise-Tigre | `tigerBreaker` | 30 | 14 rouge, 10 jaune | Libère toute la rage en un coup massif : 6 dégâts par point de rage |  | Joueur et ennemis |
| Fendeur de Ciel | `skySplitter` | 60 | 26 rouge, 19 jaune | Libère toute la rage en un coup massif : 8 dégâts par point de rage |  | Joueur et ennemis |

## Ultimes (joueur) (12)

| Sort | Id | Niv. | Coût (qì) | Effet | Recharge | Camp |
|---|---|---|---|---|---|---|
| Courroux des Cinq Éléments | `ultimateFiveElements` | 30 | 25 rouge, 25 bleu, 25 vert | 1100 dégâts |  | Joueur |
| Tribulation de la Foudre Céleste | `ultimateHeavenlyThunder` | 45 | 35 jaune, 30 violet | 700 dégâts, étourdit 2 tours |  | Joueur |
| Pluie des Mille Flèches | `ultimateThousandArrows` | 30 | 30 rouge, 30 jaune | 1000 dégâts |  | Joueur |
| Flèche qui Abat le Soleil | `ultimateSunPiercer` | 45 | 40 jaune, 30 violet | 1150 dégâts |  | Joueur |
| Colère du Dragon Impérial | `ultimateImperialDragon` | 30 | 30 vert, 30 jaune | 1000 dégâts, soigne 20 % des PV max |  | Joueur |
| Rempart Éternel | `ultimateEternalBastion` | 45 | 35 bleu, 35 vert | 700 dégâts, soigne 40 % des PV max, +25 de défense pendant 3 tours |  | Joueur |
| Charge des Mille Cavaliers | `ultimateThousandRiders` | 30 | 35 rouge, 25 jaune | 1100 dégâts |  | Joueur |
| Hurlement du Loup Céleste | `ultimateSkyWolf` | 45 | 30 rouge, 30 violet | 900 dégâts, attaque ennemie −10 pendant 3 tours |  | Joueur |
| Renaissance de l'Oiseau Vermillon | `ultimateVermilionBird` | 10 | 35 rouge, 25 violet | 600 dégâts, soigne 30 % des PV max |  | Joueur |
| Carapace de la Tortue Noire | `ultimateBlackTortoise` | 16 | 40 bleu, 25 vert | 700 dégâts, soigne 25 % des PV max, +30 de défense pendant 4 tours |  | Joueur |
| Chasse du Tigre Blanc | `ultimateWhiteTiger` | 28 | 30 rouge, 30 bleu | 900 dégâts, attaque ennemie −12 pendant 3 tours |  | Joueur |
| Tempête du Dragon d'Azur | `ultimateAzureDragon` | 38 | 35 vert, 30 bleu | 1000 dégâts, soigne 20 % des PV max, +15 de défense pendant 3 tours |  | Joueur |
