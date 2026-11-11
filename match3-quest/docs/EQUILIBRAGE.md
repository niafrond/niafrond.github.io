# Équilibrage des combats

Ce document explique le rééquilibrage des combats de Match3 Quest réalisé en novembre 2026 : ce qui est visé, comment le jeu calcule les ennemis à chaque combat, d'où viennent les chiffres et ce qu'il reste à surveiller.

Toutes les valeurs citées vivent dans `combatBalance.js`. Le détail daté des décisions est dans `SPECS.md`.

## 1. Objectifs

1. **Durée** : un combat dure en moyenne de 3 à 8 minutes selon la catégorie de l'ennemi. Un combat isolé peut en sortir ; c'est la moyenne qui compte.
2. **Pas de sac à PV** : la durée ne s'obtient pas en gonflant les PV. Ni ceux des ennemis, ni ceux du héros.
3. **Le combat peut se perdre** : l'ennemi doit pouvoir vaincre le héros dans la même fenêtre de temps.
4. **Ce que le joueur lit est ce qu'il subit** : aucun multiplicateur caché sur les dégâts.
5. **Les modes de difficulté pèsent vraiment**, sans sortir de la fenêtre de 3 à 8 minutes.
6. **Un ennemi garde le même équipement d'une rencontre à l'autre** (boss compris).

## 2. Les catégories et leur durée cible

Chaque ennemi est classé d'après la robustesse de son gabarit (`hpMult` du catalogue) ; un boss est toujours « boss », un ennemi facile proposé au choix est toujours « faible ».

| Catégorie | Gabarit | Durée cible |
|---|---|---|
| Faible | `hpMult` < 1, ou ennemi facile | 3 min |
| Normal | 1 à 1,3 | 3 à 4 min |
| Agressif / tactique | 1,3 à 1,6 | 4 à 5 min |
| Élite | 1,6 à 2 | 5 à 6 min |
| Mini-boss | 2 et plus | 6 à 7 min |
| Boss | boss de la carte | 7 à 8 min |

La durée se compte en **cycles** : un tour du héros puis un tour de l'ennemi. Faute de mesure, un cycle compte pour 30 secondes.

## 3. Ce que le jeu calcule au début de chaque combat

Le calcul est fait par `calibrateEnemy` (`combatBalance.js`), appelé par `calibrateEnemyForCombat` (`game.js`). Il ne concerne pas le tutoriel, l'arène ni les duels de Fengmeng, qui ont leurs propres règles.

### 3.1 Les PV de l'ennemi : ils fixent la durée

```
PV = dégâts du héros par cycle × cycles visés × correction de durée de la catégorie
```

- **Dégâts du héros par cycle** : 6,2 + 0,71 × niveau du héros (modèle issu des simulations), remplacé par la mesure réelle dès 4 victoires enregistrées à ±3 niveaux du héros.
- **Cycles visés** : milieu de la durée cible ÷ durée d'un cycle (par exemple 3 min 30 ÷ 30 s = 7 cycles pour un ennemi normal).
- **Correction de durée** (`HP_DURATION_FACTOR`) : faible 0,5 ; normal 0,77 ; agressif 0,85 ; élite 1,02 ; mini-boss 0,98 ; boss 1,15. Elle compense ce que la formule ne voit pas (le héros prépare ses PA et son qì, l'ennemi bloque…), pour que la durée moyenne des victoires tombe sur la cible.

Les PV **ne dépendent pas du mode de difficulté** : c'est ce qui garde la fenêtre de 3 à 8 minutes dans tous les modes.

Le coefficient de profil du document de départ (×0,75 à ×1,40) n'est pas appliqué en plus : la durée cible de chaque catégorie traduit déjà sa robustesse, et l'ajouter allongeait les combats d'élite et de boss d'autant.

### 3.2 Les dégâts de l'ennemi : réglés au niveau le plus dur

L'ennemi doit pouvoir vaincre le héros dans un temps donné, exprimé en multiple de la durée cible :

```
temps laissé à l'ennemi = durée cible × rapport de victoire
rapport de victoire = rapport de la catégorie × ajustement du niveau × référence Expert
```

- **Rapport de la catégorie** (`ENEMY_WIN_RATIO`) : faible 2,65 ; normal 1,3 ; agressif 1,25 ; élite 1,15 ; mini-boss 0,8 ; boss 0,6. Sous 1, l'ennemi pourrait vaincre un héros qui ne se soigne pas avant la fin de la durée cible : ce sont les soins du héros (sorts, objets, Zhi) qui tiennent.
- **Ajustement du niveau** (`WIN_RATIO_LEVEL_ANCHORS`) : ×0,66 vers le niveau 5, ×1,08 vers le 15, ×0,79 vers le 30, ×0,7 aux 50 et 68 (interpolé entre ces points). Les soins et défenses du héros grandissent avec lui : à haut niveau, l'ennemi doit frapper relativement plus fort.
- **Référence Expert** (`EXPERT_WIN_RATIO_FACTOR` 0,5, corrigée par catégorie par `EXPERT_CATEGORY_FACTOR`) : la base de l'attaque est toujours celle du mode le plus dur.

On en déduit le multiplicateur d'attaque de l'ennemi :

```
multiplicateur = PV qui comptent du héros ÷ (cycles laissés à l'ennemi × dégâts bruts de l'ennemi par cycle)
```

- **Dégâts bruts de l'ennemi par cycle** : (2,5 + 0,32 × niveau de l'ennemi) × facteur de catégorie (faible 1,48 ; normal 1,03 ; agressif 1,42 ; élite 1,35 ; mini-boss 1,24 ; boss 2,09), remplacé par la mesure réelle dès 4 victoires.
- Le multiplicateur est borné entre 1 et 7 : jamais sous les chiffres du grimoire et de l'arme, jamais au point qu'un seul coup emporte le héros.

### 3.3 Le mode de difficulté : il divise l'attaque, pas les PV

Le multiplicateur Expert est **divisé** par le diviseur du mode (`MODE_DIVISOR`), puis appliqué. Les bonus d'attaque et de défense du stuff de l'ennemi sont divisés de la même façon.

| Mode | Faible | Normal | Agressif | Élite | Mini-boss | Boss |
|---|---|---|---|---|---|---|
| Facile | 1,26 | 2,21 | 2,31 | 2,01 | 2,11 | 2,31 |
| Normal | 0,95 | 1,83 | 1,2 | 1,52 | 1,67 | 1,52 |
| Auto (défaut) | 1,2 | 1,83 | 1,59 | 1,52 | 1,83 | 1,52 |
| Difficile | 0,87 | 1,2 | 1,2 | 1,26 | 1,45 | 1,32 |
| Expert | 0,83 | 0,45 | 1,09 | 1,04 | 1,32 | 1,09 |

Le mode règle aussi la qualité de jeu de l'IA (`enemyAIProfiles.js`) : part de coups joués au hasard, coups de plateau aléatoires, repérage du coup fatal. Le mode Auto choisit le palier selon le niveau de l'ennemi (Facile jusqu'au niveau 3, Normal 4 à 7, Difficile 8 à 12, Expert ensuite ; un cran de plus si l'ennemi dépasse le héros ; les boss jouent en « Hors niveau »).

### 3.4 Où le multiplicateur s'applique (et ce que le joueur voit)

- **Arme** : ses dégâts affichés sont les vrais, puissance de l'ennemi comprise (cette puissance s'ajoutait autrefois sans être affichée).
- **Sorts** : l'ennemi porte un **Talisman de Résonance**, objet magique non récupérable qui amplifie en continu ses dégâts de sort et son poison. Les cartes et infobulles de ses sorts affichent directement le résultat (par exemple « 227 dmg » pour un sort de 120 ×1,9).
- **Crânes** : chaque crâne de ses combinaisons frappe plus fort du même facteur.
- **Où voir le talisman** : uniquement à l'appui long sur l'ennemi, avec sa force, sa faiblesse et son stuff (« Talisman de Résonance : ses sorts et ses crânes infligent ×1,9 dégâts »). Le stuff affaibli par la difficulté y est aussi signalé.

### 3.5 Le héros n'est pas un sac à PV non plus

Les PV du héros qui comptent pour le calcul sont plafonnés :

- **Référence** : 100 PV au niveau 1, +6 par niveau (5 PV et un point d'Endurance), +5 de plus après le niveau 20.
- **Marge d'équipement** tolérée : +60 %.
- **Au-delà** : seul un quart de l'excédent compte.

Exemple : un héros de niveau 29 à 1 226 PV (référence 313, plafond 501) compte pour environ 680 PV ; l'ennemi est réglé pour pouvoir le vaincre à ce niveau-là. Les PV et l'équipement du héros ne changent pas.

### 3.6 Réglage propre à chaque boss

Le calcul par catégorie est une moyenne ; or chaque boss a son kit fixe (arme ou non, sorts plus ou moins forts). Avant réglage, le héros gagnait de 0 à 100 % des combats selon le boss.

`BOSS_ADJUST` donne pour chacun des 42 boss de la carte une correction d'attaque (qui s'ajoute au diviseur du mode) et une correction de PV (durée ramenée vers 7 min 30). Quatre boss ont leur attaque au plancher (chiffres bruts du grimoire) : le Soleil des Eaux Taries, le Soleil des Orages, le Lion Cendré et le Capitaine Noyé des Limons ; le Soleil des Eaux Taries a aussi un tiers de PV en moins.

## 4. Un équipement fixe pour chaque ennemi

Avant, un ennemi normal de la carte était retiré au hasard à chaque combat, et un boss changeait de stuff et de sorts dès que son niveau bougeait (affaibli par les quêtes annexes, ou en Nouvelle Partie +).

Désormais `createMapEnemy` (`enemies.js`) sépare :

- **le kit** (arme, stuff, sorts, objet, aptitudes), tiré une fois pour toutes d'après l'identité de l'ennemi et un **niveau de kit** fixe (son niveau sans Nouvelle Partie +, moins 2 pour un boss), jamais supérieur à son niveau réel ;
- **les statistiques**, qui suivent son niveau du moment.

## 5. Mesures en jeu

Chaque victoire enregistre, sur l'appareil, les 60 derniers combats (`match3quest.combatStats`) :

- **durée réelle**, sans les pauses de réflexion longues (au-delà de 20 s entre deux actions, l'excédent n'est pas compté) ni le temps où la page est masquée ;
- **nombre de cycles**, dégâts infligés et subis ;
- **dégâts par source** : arme, sort, crânes, autres (poison, lave, compagnons).

Dès 4 victoires à ±3 niveaux du héros, ces mesures remplacent les modèles de simulation pour la durée d'un cycle, les dégâts du héros et ceux de l'ennemi.

Pour les lire : dans la console du jeu, `copy(localStorage.getItem('match3quest.combatStats'))`, puis coller dans le banc d'essai.

## 6. D'où viennent les chiffres : la simulation

`tools/combatSim.mjs` fait jouer de vrais combats hors navigateur :

- vrai plateau (`matchMechanics.js`), vraie résolution des coups (critique, blocage, buffs), vrais ennemis de la carte, vrais pouvoirs de compagnons, vraie jauge de rage et vrais ultimes ;
- **héros complet**, fabriqué à n'importe quel niveau de 1 à 70 : meilleure arme et meilleur stuff accessibles, ses 4 sorts par défaut avec leurs effets (balayages, purges, conversions en crânes, soins, buffs, Bastion, étourdissement, poison, rage…), son ultime de classe, un objet de soin rechargeable et son compagnon (Xiao Gui, puis Zhi dès le niveau 6) ;
- **ennemi** joué avec l'IA du mode choisi, reproduite d'après `enemyAI.js`.

`tools/balance-search.mjs` enchaîne les recherches :

| Commande | Rôle |
|---|---|
| `all-levels 1 complet` | contrôle sur tous les niveaux et toutes les catégories (variable `AI=<mode>`) |
| `fit 1 complet` | refait les modèles de dégâts du héros et de l'ennemi |
| `search-levels` | ajustement du rapport de victoire par tranche de niveau |
| `search-divisors` | diviseur d'attaque et de stuff par mode et catégorie |
| `bosses 12` | simule chacun des 42 boss (variable `AI`, `BOSSES=id,…` pour un sous-ensemble) |
| `boss-adjust 12` | cherche le réglage de chaque boss |

Exemple : `AI=auto node match3-quest/tools/balance-search.mjs bosses 12`.

## 7. Résultats

### 7.1 Par mode et par catégorie

Héros complet, niveaux 1 à 70, 4 classes, 1 680 combats par mode. Victoires du héros :

| Mode | Faible | Normal | Agressif | Élite | Mini-boss | Boss |
|---|---|---|---|---|---|---|
| Facile | 99 % | 96 % | 90 % | 92 % | 89 % | 89 % |
| Normal | 98 % | 93 % | 76 % | 78 % | 74 % | 68 % |
| Auto (défaut) | 96 % | 86 % | 74 % | 76 % | 73 % | 55 % |
| Difficile | 90 % | 72 % | 63 % | 63 % | 60 % | 48 % |
| Expert | 85 % | 62 % | 57 % | 55 % | 53 % | 34 % |

Durée moyenne des victoires : de 2 min 35 (ennemis faibles) à 7 min 37 (boss), dans tous les modes.

### 7.2 Boss de la carte (mode Auto)

| | Avant réglage | Après réglage |
|---|---|---|
| Victoires du héros (cible 60 %) | 48 % en moyenne, de 0 à 100 % selon le boss | 59 % en moyenne, de 38 à 79 % selon le boss |
| Durée moyenne d'un combat | 5 min 24 en moyenne (2 min 18 à 7 min 56) | 6 min 52 en moyenne (5 min 29 à 8 min 06) |

### 7.3 Armes et sorts

`damageCorridor.js` et son test vérifient que chaque arme (dégâts par point d'action) et chaque sort de dégâts (dégâts par qì) reste à ±25 % d'une courbe selon son niveau. Les 37 armes et les 30 sorts actuels passent ; le test protège surtout les ajouts futurs.

## 8. Limites et points à surveiller

- **Simulation, pas jeu réel** : le héros simulé prend toujours les mêmes sorts et le même compagnon ; les jokers, cases de biome, sorts à cible d'une seule case et altérations posées par l'ennemi ne sont pas simulés. Un vrai joueur peut faire mieux ou moins bien.
- **Incertitude** : chaque taux repose sur des dizaines de combats ; compter environ ±7 points par boss et ±5 points par catégorie.
- **Joueur qui n'utilise pas ses outils** (sorts à effet, soins, objets, compagnon) : il perd beaucoup plus souvent contre les mini-boss et boss.
- **Ennemis faibles** : leurs combats restent un peu sous les 3 minutes en moyenne.
- **Ultimes** : presque jamais lancés (jauge pleine et qì collecté rarement réunis avant la fin du combat).
- **Boss par mode** : les boss ont été réglés en mode Auto ; les autres modes leur appliquent leur diviseur sans réglage supplémentaire.
- **Mesures réelles** : à relire après quelques parties ; elles corrigent automatiquement les modèles, mais pas les réglages par boss.
