# 🤖 Bibliothèque d'Intelligence Artificielle des Ennemis

## Vue d'ensemble

La bibliothèque `enemyAI.js` gère le comportement intelligent des ennemis dans le jeu Match3-Quest. Elle fournit un système de décision stratégique avec plusieurs niveaux de difficulté qui s'adaptent automatiquement au niveau de l'ennemi et des personnalités d'ennemis.

## Système de niveaux

### Génération des niveaux d'ennemis

Chaque nouvel ennemi a un niveau **égal ou supérieur** au niveau du joueur :
- **50%** de chance d'avoir le même niveau que le joueur
- **30%** de chance d'avoir +1 niveau
- **15%** de chance d'avoir +2 niveaux
- **5%** de chance d'avoir +3 niveaux

### Influence du niveau sur l'IA

La difficulté de l'IA est **automatiquement ajustée** en fonction du niveau de l'ennemi :

#### Difficulté de base par niveau
- **Niveau 1-3** : Facile
- **Niveau 4-7** : Normal
- **Niveau 8-12** : Difficile
- **Niveau 13+** : Expert

#### Bonus de niveau
- Si l'ennemi a **+3 niveaux** : Toujours Expert
- Si l'ennemi a **+2 niveaux** : Difficile ou Expert
- Si l'ennemi a **+1 niveau** : Augmente d'un cran la difficulté

#### Effets du niveau sur le comportement
- **Niveau 10+** : Temps de réflexion réduit de 30%, efficacité +10%
- **Niveau 15+** : Temps de réflexion réduit de 50%, efficacité +15%

## Fonctionnalités principales

### 1. Niveaux de difficulté

Quatre niveaux de difficulté sont disponibles :

- **Facile** : L'ennemi prend des décisions aléatoires avec des temps de réflexion longs
  - Temps de réflexion : 1.5-3 secondes
  - Priorité sorts : 25%
  - Priorité armes : 25%
  - Priorité plateau : 50%
  - Pas de pensée stratégique

- **Normal** : Comportement équilibré avec une pensée stratégique de base
  - Temps de réflexion : 1-2 secondes
  - Priorité sorts : 35%
  - Priorité armes : 35%
  - Priorité plateau : 30%
  - Pensée stratégique activée

- **Difficile** : L'ennemi privilégie les attaques et réagit rapidement
  - Temps de réflexion : 0.5-1.5 secondes
  - Priorité sorts : 45%
  - Priorité armes : 35%
  - Priorité plateau : 20%
  - Pensée stratégique activée

- **Expert** : Comportement optimal avec réactions très rapides
  - Temps de réflexion : 0.3-1 seconde
  - Priorité sorts : 50%
  - Priorité armes : 35%
  - Priorité plateau : 15%
  - Pensée stratégique activée

### 2. Système de décision

L'IA analyse le contexte du combat et évalue chaque action possible :

#### Analyse du contexte
- Pourcentage de HP du joueur et de l'ennemi
- Mana disponible pour les deux parties
- Points de combat disponibles
- Vulnérabilité du joueur
- État critique de l'ennemi

#### Évaluation des sorts
- **Sorts de soin** : Priorité maximale si HP < seuil de soin
- **Sorts de dégâts** : Priorité si le joueur est vulnérable
- **Coups fatals** : Priorité absolue si peut tuer le joueur
- **Sorts de buff/debuff** : Évalués selon le contexte

#### Évaluation de l'arme
- Priorise l'arme si elle peut tuer le joueur
- Bonus pour les armes puissantes
- Considère les points de combat disponibles

#### Évaluation du plateau
- Priorité si manque de ressources (mana/combat points)
- Score augmenté si aucun sort utilisable

### 3. Personnalités d'ennemis

Cinq personnalités modifient le comportement de l'IA :

- **Agressif** : Préfère toujours l'attaque, évite le plateau
- **Défensif** : Priorise les soins et les buffs
- **Tactique** : Comportement équilibré (par défaut)
- **Téméraire** : Utilise les ressources sans hésitation
- **Rusé** : Privilégie les debuffs et stratégies indirectes

## Utilisation

### Ajustement automatique de la difficulté

La difficulté est **automatiquement ajustée** lors de la génération d'un nouvel ennemi via `newEnemy()`. Vous n'avez rien à faire !

```javascript
// Lors de la génération d'un ennemi, l'IA s'ajuste automatiquement
newEnemy(); // La difficulté sera adaptée au niveau de l'ennemi
```

### Changer manuellement la difficulté (optionnel)

Si vous souhaitez forcer une difficulté spécifique :

Dans la console du navigateur ou via le code :

```javascript
import { setAIDifficulty } from './enemyAI.js';

// Changer la difficulté
setAIDifficulty('easy');    // Facile
setAIDifficulty('normal');  // Normal
setAIDifficulty('hard');    // Difficile
setAIDifficulty('expert');  // Expert
```

Depuis `game.js` :

```javascript
import { changeAIDifficulty, getCurrentAIDifficulty } from './game.js';

// Changer la difficulté
changeAIDifficulty('hard');

// Obtenir la difficulté actuelle
const currentDiff = getCurrentAIDifficulty();
console.log(currentDiff); // "Difficile"
```

### Assigner une personnalité

```javascript
import { assignPersonality, enemyPersonalities } from './enemyAI.js';

// Assigner une personnalité aléatoire
const personality = assignPersonality();

// Ou choisir une personnalité spécifique
enemy.personality = 'aggressive';
```

### Obtenir les statistiques de l'IA

```javascript
import { getAIStats } from './enemyAI.js';

const stats = getAIStats();
console.log(stats);
// {
//   difficulty: "Normal",
//   context: { ... },
//   availableActions: { ... }
// }
```

## Intégration dans le jeu

La bibliothèque est automatiquement intégrée dans `game.js` via la fonction `enemyTurn()`. À chaque tour de l'ennemi :

1. L'IA analyse le contexte de combat
2. Évalue toutes les actions possibles (sorts, armes, plateau)
3. Attribue un score à chaque action
4. Choisit la meilleure action selon la difficulté
5. Exécute l'action après un temps de réflexion

## Exemples de logs

Les décisions de l'IA sont loggées dans la console :

```javascript
🤖 IA Décision: {
  action: 'spell',
  reason: 'coup fatal',
  score: 245,
  thinkingTime: 1234
}
```

## Personnalisation

Pour ajouter de nouvelles stratégies ou modifier le comportement :

1. **Modifier les probabilités** dans `aiDifficulty`
2. **Créer de nouvelles personnalités** dans `enemyPersonalities`
3. **Ajuster les seuils** (healThreshold, aggressiveThreshold)
4. **Modifier les scores** dans les fonctions d'évaluation

## Debug

Pour activer les logs détaillés de l'IA :

```javascript
import { logDecision, getAIStats } from './enemyAI.js';

// La fonction logDecision est appelée automatiquement
// mais vous pouvez aussi l'utiliser manuellement
const stats = getAIStats();
console.log('📊 Stats IA:', stats);
```

## Notes techniques

- La bibliothèque utilise un système de scoring pour évaluer les actions
- Les décisions sont influencées par la difficulté et les personnalités
- Un facteur aléatoire est ajouté pour éviter la prédictibilité
- Les temps de réflexion sont ajustés selon la difficulté
- Le système est extensible et modulaire

## Prochaines améliorations possibles

- [ ] Apprentissage des patterns du joueur
- [ ] Stratégies spécifiques par type d'ennemi
- [ ] Comportements d'équipe pour les combats multiples
- [ ] Réactions aux combos du joueur
- [ ] Mémorisation des actions précédentes
