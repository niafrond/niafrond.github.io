# niafrond.github.io

Ce dépôt contient plusieurs mini-apps web en HTML/CSS/JavaScript.

## Apps disponibles

### 1) Générateur de recette (version 1)
- Fichier : [generateur-recette.html](generateur-recette.html)
- Outil de formatage/extraction de recettes.
- Inclut une extraction depuis URL (JSON-LD de type Recipe + parseur générique).

### 2) Générateur de recette (version 2)
- Fichier : [generateur-recette2.html](generateur-recette2.html)
- Variante plus récente/étendue du générateur de recette.

### 3) Switch Enfants (PWA)
- App : [lavevaisselle/index.html](lavevaisselle/index.html)
- Mini app mobile-first avec historique local, capture photo et service worker.

### 4) Rando Piton (PWA)
- App : [rando-piton/index.html](rando-piton/index.html)
- Catalogue mobile-first de randonnées à La Réunion avec favoris, filtres et fiches hors ligne.

### 5) Match3 Quest
- App : [match3-quest/index.html](match3-quest/index.html)
- Jeu match-3 RPG (combat, classes, sorts, armes, IA ennemie, progression).

### 6) Mobile Dev Hub (GitHub + Copilot)
- App : [mobile-dev-hub/index.html](mobile-dev-hub/index.html)
- Interface mobile-first pour piloter un repo GitHub (issues/PR/commit) avec une zone de prompts Copilot.

## Liste des fonctionnalités

### Générateur de recette (v1 et v2)
- Import de recette depuis URL avec extraction JSON-LD (type Recipe).
- Fallback d'extraction générique quand les métadonnées sont incomplètes.
- Nettoyage, formatage et normalisation du contenu (ingrédients, étapes, structure).
- Deux versions d'interface (v1/v2) pour des workflows différents.

### Switch Enfants (PWA)
- Application mobile-first pensée pour un usage rapide sur smartphone.
- Historique local des événements/actions dans le navigateur.
- Capture photo intégrée au flux d'utilisation.
- Fonctionnement hors ligne grâce au service worker.
- Manifest PWA pour installation possible sur écran d'accueil.

### Rando Piton (PWA)
- Catalogue local de randonnées consultable sans backend.
- Bouton de recherche flottant ouvrant un panneau au besoin, avec formulaire par mot-clé et validation explicite dans l'esprit de Randopitons.
- Suggestions de recherche Randopitons chargées via proxy CORS depuis le panneau de recherche, avec ouverture directe des résultats source.
- Import direct d'une suggestion Randopitons en fiche locale puis ajout immédiat au mode hors ligne.
- Affichage de la version actuelle du site directement dans l'en-tête de l'application.
- Filtres par difficulté et vues dédiées pour favoris / hors ligne.
- Sauvegarde locale des randonnées favorites.
- Sauvegarde des fiches pour consultation hors ligne via service worker et Cache API.
- Flux prévu pour les traces Randopitons : connexion sur le site source, téléchargement manuel du GPX/KML, puis import local dans l'app pour usage hors ligne.
- Les fiches affichent aussi un itinéraire public lisible sans connexion, distinct du téléchargement de trace protégé.
- Interface mobile-first prévue pour installation comme application.

### Match3 Quest
- Combat RPG basé sur une mécanique de match-3.
- Système de classes (Sorcier, Assassin, Templier, Barbare).
- Progression du personnage : expérience, montée de niveau, évolution des stats.
- Gestion de ressources de combat : points de vie, mana, points de combat.
- Système de sorts (classe + sorts génériques) et effets de statut.
- Équipement : armes, objets et logique de boutique.
- Ennemis variés avec catalogue dédié et comportements spécifiques.
- IA ennemie avec niveaux de difficulté, scoring d'actions et personnalités.
- Sauvegarde automatique de la progression via localStorage.
- Outils de test inclus dans le dossier du jeu (pages/scripts de vérification).

### Mobile Dev Hub (GitHub + Copilot)
- Layout mobile en deux zones fixes : panneau GitHub en haut, panneau chat/prompt Copilot en bas.
- Dashboard GitHub via API REST (repo, PR ouvertes, issues, branche par défaut, dernier commit).
- Ouverture rapide vers GitHub repo, github.dev et page GitHub Copilot.
- Journal local de prompts et copie rapide vers presse-papiers pour coller dans Copilot.
- Stockage local des paramètres owner/repo/token pour reprendre rapidement le travail sur mobile.

## Notes
- Les données de jeu et préférences sont sauvegardées en local (localStorage).
- Certaines apps sont prévues pour être ouvertes directement dans le navigateur.