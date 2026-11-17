# Intelligence artificielle des ennemis

Deux fichiers : `enemyAI.js` (lit l'état du combat dans `game.js` et décide) et `enemyAIProfiles.js` (module pur : paliers,
choix de difficulté, personnalités ; testable sans le jeu). Tests : `tests/unit/enemyAIProfiles.test.js`,
`tests/unit/enemyAIDecision.test.js`, `tests/unit/combatStats.test.js`.

## Quatre notions séparées

| Notion | Où | Ce qu'elle règle |
| --- | --- | --- |
| **Niveau et statistiques** de l'ennemi | `enemies.js` | PV, attaque (chance de critique), défense (chance de blocage), sorts, arme. Aucun palier d'IA n'y touche. |
| **Personnalité** (style) | `PERSONALITIES` | Quelles actions l'ennemi préfère (frapper, soigner, affaiblir…). |
| **Qualité tactique** | `AI_TIERS` | Probabilités d'action et part de tours joués au hasard (« coups hasardeux »). |
| **Difficulté choisie par le joueur** | Options > « Difficulté des ennemis » | `Auto` ou un palier fixe. |

La difficulté ne donne **aucun bonus caché de statistiques** : elle ne change que la qualité des décisions.

## Difficulté choisie par le joueur

Option `aiDifficulty` (`gameOptions.js`, mémorisée par appareil) :

- **Palier fixe** (`Facile`, `Normal`, `Difficile`, `Expert`) : appliqué tel quel à tous les combats, boss et ennemis
  « hors niveau » compris. Le niveau de l'ennemi n'a aucune influence.
- **Auto** (défaut) : adaptation explicite et bornée, désactivée dès qu'on choisit un palier fixe.
  1. Palier de base selon le niveau de l'ennemi : 1-3 Facile, 4-7 Normal, 8-12 Difficile, 13+ Expert.
  2. +1 cran si l'ennemi a un niveau supérieur à celui du joueur, mais jamais au-dessus de **Difficile** (seul un ennemi de
     niveau 13+ est Expert). Un ennemi de niveau égal ou inférieur ne durcit jamais l'IA.
  3. Profils scénarisés, seulement en Auto : ennemi « affaibli » (très maladroit) et ennemi / boss « hors niveau »
     (Expert, 2 % de coups hasardeux).

`Facile` reste accessible aux joueurs occasionnels : 80 % des tours sont joués au hasard.

### Paliers (`AI_TIERS`)

| Palier | Sort | Arme | Plateau | Coups hasardeux | Seuil de soin | Joueur « vulnérable » si PV < |
| --- | --- | --- | --- | --- | --- | --- |
| Facile | 20 % | 20 % | 60 % | 80 % | 30 % | 70 % |
| Normal | 25 % | 25 % | 50 % | 55 % | 40 % | 60 % |
| Difficile | 30 % | 25 % | 45 % | 35 % | 50 % | 50 % |
| Expert | 35 % | 25 % | 40 % | 20 % | 60 % | 40 % |

**Temps de réflexion** : 300 à 500 ms pour les quatre paliers (le rythme du combat ne dépend pas de la difficulté).
Ennemi de niveau 10 à 14 : × 0,7 ; niveau 15+ : × 0,5. Profils : « Affaibli » 450-850 ms, « Hors niveau » 180-320 ms.
(Les anciennes valeurs de 0,3 à 3 s de ce document ne correspondaient plus au code.)

## Décision d'un tour (`makeDecision`, appelée par `enemyTurn` dans `game.js`)

1. Contexte : PV, qì, points de combat, joueur vulnérable, ennemi en danger.
2. Seules les **actions possibles** sont proposées : sort abordable (coûts et ressources vérifiés ; un soin à pleine vie
   est écarté), arme dont le coût en points de combat est couvert, plateau (toujours).
3. Chaque action reçoit un score (coup fatal, soin critique, joueur vulnérable…), qui sert à choisir le **sort** à lancer et à
   la personnalité « tactique ».
4. Tour hasardeux (selon `stupidityChance`) : action tirée au sort parmi les actions possibles, personnalité ignorée.
5. Sinon : poids de chaque action = **probabilité du palier × pondération de la personnalité**, tirage proportionnel.
6. L'action est exécutée par `game.js` après le temps de réflexion.

## Personnalités

Attribuées à `newEnemy()` : celle du gabarit s'il en définit une (`enemy.personality`), sinon calculée de façon **stable
par espèce** (`assignPersonality(templateId)`), pour qu'on la reconnaisse d'un combat à l'autre. Elle est annoncée dans le
journal de combat au début du combat.

Chaque personnalité fournit `modifyDecision(option, contexte)`, un **multiplicateur de poids** :

| Personnalité | Tendance |
| --- | --- |
| Agressif | arme ×1,4, sort de dégâts ×1,3, plateau ×0,6, soin ×0,8 |
| Défensif | soin ×1,8 si PV bas (×1,2 sinon), renfort ×1,3, plateau ×1,15, arme ×0,8 si PV bas |
| Tactique | meilleure action selon le score ×1,3, coup fatal ×1,5 |
| Téméraire | arme ×1,3, sorts offensifs ×1,3, plateau ×0,6, soin ×0,7 |
| Rusé | affaiblissement ×1,5, renfort ×1,2, arme ×0,9 |

Garde-fous (testés) : le produit est borné à [0,5 ; 1,8] ; une personnalité ne peut pas ajouter une action impossible ni
en retirer une possible ; un coup fatal n'est jamais pénalisé ; chaque action possible garde plus de 10 % de chances, donc
l'issue d'un tour n'est jamais déterministe. Les personnalités n'ont aucun effet sur les statistiques.

## Écart de niveau (`combatStats.js`)

`levelEdge` (écart de niveau en faveur d'une entité, posé au début du combat) ajoute des **points** à l'attaque (chance de
critique) et à la défense (chance de blocage) : **+6 points par niveau d'écart, au plus +18** (atteint à 3 niveaux). Il ne
multiplie pas les dégâts ni les statistiques ; les chances finales restent plafonnées à 98 %. Le plus faible ne subit aucun
malus, et la règle est la même pour le joueur et pour l'ennemi.

Avant le lot 2, le bonus était multiplicatif (×1,35 à ×4) : une statistique brute de 33 passait à 98 % dès 3 niveaux
d'écart. Comparaison reproductible : `node match3-quest/tools/simulate-level-edge.mjs`.

L'avantage est annoncé dans le journal au début du combat (« 2 niveaux d'avance : +12 % de critique et de blocage »).

## Documenter / modifier

- Probabilités, seuils, temps : `AI_TIERS` / `SPECIAL_TIERS`.
- Nouveau style : ajouter une entrée à `PERSONALITIES` (nom, description, `modifyDecision`) ; le test « borné » la couvre.
- Scores d'actions : `evaluateSpells`, `evaluateWeapon`, `evaluateBoardMove` dans `enemyAI.js`.
- Débogage : `getAIStats()` (difficulté, personnalité, contexte) et `logDecision(decision)`.
