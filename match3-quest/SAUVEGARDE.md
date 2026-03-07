# Système de sauvegarde - Match3 Quest

## Fonctionnement

Le jeu utilise le **localStorage** du navigateur pour sauvegarder automatiquement la progression du joueur.

## Données sauvegardées

Toutes les informations du joueur sont sauvegardées, notamment :

- 🎭 **Classe** : La classe choisie (Sorcier, Assassin, Templier, Barbare)
- ❤️ **Points de vie** : HP actuels et HP maximum
- ✨ **Mana** : Quantité de mana de chaque couleur et mana maximum
- ⚔️ **Attaque et défense** : Statistiques de combat
- ⭐ **Niveau** : Niveau actuel du joueur
- 📊 **Attributs** : Force, Agilité, Intelligence, Endurance, Moral
- 🔮 **Sorts** : Sorts débloqués, sorts actifs équipés
- ⚔️ **Armes** : Armes possédées et arme équipée
- 🎯 **Points de combat** : Progression dans le combat actuel
- 💫 **Aptitudes** : Compétences spéciales acquises
- 🌟 **Effets de statut** : Buffs/debuffs actifs

## Sauvegarde automatique

La sauvegarde se déclenche automatiquement après chaque action importante :
- Sélection de la classe
- Montée de niveau
- Acquisition d'un nouveau sort ou d'une nouvelle arme
- Changement d'équipement
- Acquisition d'aptitudes

## Visualisation de la classe

La classe du joueur est affichée à plusieurs endroits :
- Dans les statistiques principales (emoji de la classe)
- Dans l'onglet "Stats" avec le nom complet
- Les sorts disponibles dépendent de la classe choisie

## Système de classes pour les ennemis

**Nouveauté** : Les ennemis possèdent maintenant aussi des classes, exactement comme le joueur !

### Classes disponibles pour les ennemis

Les ennemis peuvent appartenir à l'une des 4 classes du joueur :
- 🧙 **Sorcier** : Maîtrise des arcanes et sorts variés
- 🗡️ **Assassin** : Attaques rapides et furtives
- 🛡️ **Templier** : Défenseur résilient avec soins
- 🪓 **Barbare** : Puissance brute et dégâts massifs

### Règles de sorts pour les ennemis

Les ennemis suivent les **mêmes règles de sorts** que le joueur :
- Accès aux sorts de classe de leur classe respective
- Les sorts se débloquent selon le niveau de l'ennemi
- Combinaison de sorts de classe + sorts génériques (couleurs)
- Les sorts de classe sont prioritaires (70% de chance)
- Affichage avec emoji de classe pour identifier les sorts spéciaux

### Variations par race

Chaque race d'ennemi peut avoir plusieurs variantes de classe :
- **Gobelin** : Voleur (Assassin), Éclaireur (Assassin), Chaman (Sorcier)
- **Orc** : Guerrier (Barbare), Berserker (Barbare), Chaman (Templier)
- **Troll** : Brute (Barbare), Régénérateur (Templier), Mage (Sorcier)
- **Vampire** : Aristocrate (Sorcier), Lame de Nuit (Assassin), Mage du Sang (Sorcier)
- **Dragon** : Jeune Dragon (Sorcier), Dragon Glacé (Sorcier), Dragon Ancien (Sorcier)
- **Squelette** : Archer (Assassin), Mage (Sorcier), Chevalier (Templier)
- **Démon** : Chevalier Infernal (Barbare), Sorcier (Sorcier), Serviteur (Templier)

### Affichage

L'emoji de la classe de l'ennemi apparaît :
- À côté du nom de l'ennemi dans les stats
- Sur chaque sort de classe dans la liste des sorts ennemis

## Effacer la sauvegarde

Pour recommencer une nouvelle partie :
1. Aller dans l'onglet **Stats**
2. Cliquer sur le bouton **🗑️ Effacer la sauvegarde**
3. Confirmer l'action

Le jeu redémarre et vous pourrez choisir une nouvelle classe.

## Technique

### Chargement
La fonction `loadGameData()` charge les données au démarrage du jeu depuis `localStorage.getItem('player')`.

### Sauvegarde
La fonction `saveUpdate()` enregistre toutes les données du joueur via `localStorage.setItem('player', JSON.stringify(player))`.

### Persistance
Les données sont conservées même après fermeture du navigateur, tant que le localStorage n'est pas effacé manuellement.
