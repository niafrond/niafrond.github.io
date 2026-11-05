# CODEMAP — carte du code (pour lecteurs LLM)

Objectif : localiser un module sans lire de gros fichiers. Consulter cette carte, puis ne lire que le fichier (ou la plage de lignes) utile.

## Fichiers à NE PAS lire en entier (très volumineux, données générées)
- `sprites/generated.js` (4,5 Mo), `world/snapshot.js` (0,9 Mo), `sprites/gba/*.js`, `sprites/biomeArchi.js`, `sprites/winter-decor.js`, `soluce/*.html`, `SPECS.md` (0,6 Mo) : utiliser `Grep` ciblé.
- Gros fichiers de logique à lire par plages : `game.js`, `explorationView.js`, `story.js`, `exploration.js`, `style.css`.

## Modules racine (première ligne de commentaire)
- `actionGuard.js` — (sans description)
- `arena.js` — Arène des Mille Flèches : un lieu à explorer, comme une arène de Pokémon. Ouverte dès le 3e terrain
- `attributes.js` — Attributs du joueur : source unique des effets (appliqués par game.js) et de leur description affichée.
- `bestiary.js` — Bestiaire du carnet : force, faiblesse et notice mythologique de chaque gabarit d'ennemi (enemies.catalog.json).
- `board.js` — (sans description)
- `boardEnemyMoves.js` — Coups joués sur le plateau par l'ennemi et par le compagnon (Xiao Gui) : choix, animation de l'échange.
- `boardLayout.js` — Dimensionnement du plateau : taille des cases selon la fenêtre (paysage / portrait), observateur de redimensionnement.
- `boardSuggestions.js` — Suggestion de coup au joueur (minuteur d'inactivité, surbrillance) et gestion du plateau sans coup possible.
- `bossTips.js` — (sans description)
- `breakReminder.js` — Rappel de pause : une popup bienveillante après 30 min de jeu continu, puis toutes les 15 min.
- `cheatMode.js` — (sans description)
- `chestLoot.js` — Butin des coffres d'exploration : en plus de l'or, un coffre peut contenir des potions (consommables),
- `cinematics.js` — Animations « pixel art » plein écran (intro, fin de la légende, boss, soleils, régions, titre, prologue, duel).
- `cinematicsBoss.js` — Dialogues de début de combat de boss : provocations, répliques, duels et animation d'introduction. Extrait de cinematics.js.
- `cinematicsCore.js` — Socle des animations pixel art : taille de scène, montage plein écran, boucle runScene, primitives de dessin, palette du titre.
- `cinematicsDuel.js` — Cinématique du duel de mi-parcours contre Fengmeng (gorges du Volcan). Extrait de cinematics.js.
- `cinematicsEnding.js` — Fin de la légende (animation plein écran) et générique de fin. Extrait de cinematics.js.
- `cinematicsPrologue.js` — Prologue animé de la nouvelle partie. Extrait de cinematics.js.
- `cinematicsRegion.js` — Découverte d'une région et passage de portail. Extrait de cinematics.js.
- `cinematicsSun.js` — Chute d'un soleil (animation plein écran). Extrait de cinematics.js.
- `cinematicsTitle.js` — Écran de démarrage (launcher) : boucle pixel art de Hou Yi. Extrait de cinematics.js.
- `classSpellEffects.js` — Gestion des effets spéciaux des sorts de classe
- `classes.js` — Système de classes de personnages avec sorts spécialisés
- `combatFlow.js` — (sans description)
- `combatStats.js` — Attaque / Défense : ce sont des probabilités, pas des dégâts.
- `companionMoves.js` — Choix « ultra smart » du coup supplémentaire de Xiao Gui (logique pure, sans DOM ; appliqué par board.js : foxMakeRandomMove).
- `companionPowers.js` — Pouvoirs de combat des compagnons (données pures et tirage, sans DOM ; appliqués par game.js : applyCompanionPowers).
- `companionTrail.js` — (sans description)
- `companions.js` — Compagnons de route et dialogues contextuels de Match3-Quest (données pures, sans DOM ; propriétaire : agent Scénario).
- `compareView.js` — Comparaison de deux sorts, armes ou stuffs : bouton « Comparer » sur chaque ligne (1er clic = référence, 2e clic = tableau comparatif).
- `constants.js` — Constantes globales utilisées par le jeu
- `creatureScale.js` — Échelle des ennemis et des boss sur la carte d'exploration (module pur, aucun DOM).
- `decor.js` — Décors des obstacles par biome (module pur, aucun DOM) : l'exploration les dessine (explorationView.js) et le moteur
- `dialogState.js` — État d'affichage d'un dialogue d'exploration (explorationView.js). Module pur (sans DOM).
- `duel.js` — Règles de duel des combats contre Fengmeng (champ `duel` d'un ennemi de story.js, recopié sur l'ennemi
- `elements.js` — Éléments de qì et table des faiblesses. Module pur (aucun DOM), partagé par enemies.js, terrain.js et l'UI.
- `enemies.js` — Système d'ennemis piloté par un catalogue JSON
- `enemyAI.js` — Bibliothèque d'intelligence artificielle pour les ennemis
- `equipPreview.js` — Aperçu d'un équipement chez le marchand : stats globales du héros avant / après avoir porté la pièce à la place de celle équipée.
- `equipment.js` — Système d'équipement multi-slot (main droite, main gauche, objet)
- `experience.js` — Système d'expérience et de progression du joueur
- `exploration.js` — Moteur de la phase d'exploration (logique pure, sans DOM).
- `explorationChange.js` — Mode Chang'e : Chang'e explore son village (places des blessés et des habitants de passage, épisodes, ambiance).
- `explorationDialogue.js` — Compagnons et dialogues contextuels : répliques d'ambiance, conversation avec un PNJ.
- `explorationGrids.js` — Grilles de cases (obstacles, liquides) et liste des décors fixes d'un écran, mises en cache : `inRects` parcourait tous les rectangles
- `explorationGuide.js` — Guide du joueur : suivi de quête, cibles, repères, direction à prendre, texte d'objectif et journal.
- `explorationQuests.js` — Quêtes de l'exploration : statut, objectifs, démarrage, achèvement, victoire sur un ennemi, Nouvelle Partie +, défaite.
- `explorationSenses.js` — Perception du joueur : aura, caches invisibles et mimiques, coffres refermés, repère posé sur la carte, brouillard de guerre.
- `explorationTravel.js` — Pierres de voyage (voyage rapide), progression par région, bestiaire et introduction.
- `explorationView.js` — Phase d'exploration : carte plein écran en vue du dessus (canvas), saisie clavier / pavé
- `explorationViewCarnet.js` — Carnet de voyage de la vue d'exploration : onglets quêtes, voyage rapide, progression, bestiaire.
- `explorationViewChange.js` — Mode Chang'e de la vue d'exploration : épisodes, miroir, soins, arrivée des PNJ, fin de la légende.
- `explorationViewConsts.js` — Constantes de la vue d'exploration : durées, tailles de tuile, touches, palette des biomes.
- `explorationViewDraw.js` — Dessin d'une image de la vue d'exploration (carte, décors, héros, ennemis, PNJ, effets).
- `explorationViewGround.js` — Calque de sol mis en cache de la vue d'exploration (peinture du sol par tranches, pré-construction des cartes voisines).
- `explorationViewMap.js` — Carte plein écran de la vue d'exploration (pose d'un repère), voyage, arène, boussole du repère.
- `explorationViewOverlays.js` — Superpositions de la vue d'exploration : minimap, brouillard de guerre, obscurité, aura, boussole de quête.
- `explorationViewPainters.js` — Primitives de dessin de la vue d'exploration : bâtiments, sprites, marqueurs, ombres, portails, étiquettes.
- `game.js` — logique globale du joueur, ennemis, combat et interface
- `gameCardUi.js` — Aides communes aux cartes des onglets Sorts / Armes / Équipement / Inventaire (échappement HTML, pied de carte, tri mémorisé).
- `gameHud.js` — Interface du combat : animation des barres de PV et des compteurs, portraits, mise à jour des stats et sorts ennemis, journal, sauvegarde.
- `gameInventoryTabs.js` — Onglets Armes, Équipement et Inventaire : armes en main, boutons d'arme/objet, cartes, équiper / vendre / utiliser un objet.
- `gameLevelUp.js` — Niveau et attributs : XP gagnée (combo, gros alignements, mana), barre de niveau, menu des attributs, réinitialisation.
- `gameOptions.js` — Options d'affichage et de performance (menu Options), mémorisées par appareil dans localStorage.
- `gameSpellList.js` — Sorts disponibles selon le niveau (plafond, liste débloquée), boutons de sorts, déblocage par le menu secret.
- `gameSpellsTab.js` — Onglet Sorts : liste des sorts disponibles, tri, sélecteur d'ultime, équiper / retirer un sort ou un ultime.
- `gameStatsTab.js` — Onglet Stats détaillées du joueur et animations d'annonce (sorts, attaques) du combat.
- `gameTooltips.js` — Infobulles du combat (sorts, armes, objets, équipement du joueur, ennemi) et pastilles de statut.
- `icons.js` — Icônes SVG de l'interface (le jeu n'utilise aucun emoji) : petites pictos en ligne, viewBox 16x16, contour
- `items.js` — (sans description)
- `joker.js` — (sans description)
- `loader.js` — Écran de chargement plein écran (démarrage du jeu, entrée dans une région dont les dessins ne sont pas encore
- `main.js` — (sans description)
- `manaFlight.js` — Animation purement décorative : de petits points de la couleur du qì volent des tuiles combinées
- `manaGear.js` — Qì max apporté par l'équipement : champ `manaMax` d'une arme, d'un bouclier ou d'un stuff porté, `{ couleur: bonus }`
- `mapConnections.js` — Connexions de bordure entre cartes (« à la Pokémon Rubis / Saphir / Émeraude ») : logique pure, sans DOM.
- `matchMechanics.js` — (sans description)
- `merchants.js` — (sans description)
- `music.js` — (sans description)
- `musicTracks.js` — (sans description)
- `offlineCache.js` — Jeu hors ligne : enregistrement du service worker (sw.js) qui sert le jeu depuis le téléphone. Le pré-téléchargement des musiques et dessins
- `playTime.js` — Temps de jeu (menu Options), mémorisé par appareil dans localStorage : aujourd'hui, hier, cette semaine (depuis lundi), total.
- `playerNames.js` — Bibliothèque de noms de joueur aléatoires
- `progression.js` — Progression au-delà du niveau 18 : les armes et les sorts s'arrêtent au niveau 18 (dégâts ≤ 100 / 150) alors que les ennemis
- `saveManager.js` — Gestionnaire de sauvegarde/chargement de parties (export/import JSON)
- `secretLogic.js` — Logique pure du menu secret (testable sans charger game.js).
- `secretMenu.js` — Menu secret : 6 clics sur « Particules de qì » (Options) l'ouvrent pour toute la session (jamais sauvegardé).
- `sfxCatalog.js` — (sans description)
- `shop.js` — =====================================
- `sound.js` — (sans description)
- `spellFx.js` — (sans description)
- `spells.js` — Catalogue des sorts charge depuis spells.json
- `statusBadges.js` — Bonus / malus actifs d'un combattant, affichés en pastilles sur sa carte (survol ou appui long = explication).
- `story.js` — Histoire et cartes d'exploration de Match3-Quest : « La Légende de Hou Yi ».
- `storyMirror.js` — Le miroir brisé de Chang'e : interludes joués après chaque soleil abattu (MIRROR_TALKS) et orateur de Fengmeng.
- `storyQuests.js` — Quêtes de base de l'histoire : histoire principale puis quêtes annexes. Données pures, extraites de story.js.
- `storyScreens.js` — Écrans de base de l'histoire (un par région/sanctuaire : décor, PNJ, ennemis, coffres, sorties).
- `storyText.js` — Textes de l'histoire : titre, introduction et épilogue de « La Légende de Hou Yi ». Extrait de story.js (ré-exporté).
- `stuff.js` — Stuff : casque, collier, bracelet et bague. Module pur (sans DOM).
- `stuffView.js` — Onglet « Stuff » : casque, collier, bracelet et bague (stuff.js). Affichage et actions du joueur ; la logique est dans stuff.js.
- `sw.js` — (sans description)
- `terrain.js` — Préparation du terrain et règles de biome. Module pur (aucun DOM) : exploration.js, game.js et board.js l'appliquent.
- `test-localstorage.js` — Test du système de localStorage pour Match3-Quest
- `tileBitmaps.js` — Tuiles du plateau en bitmap. Chaque tuile est un <div> dont le fond est un SVG (≈ 40 primitives vectorielles : cercles tracés, dégradé radia
- `tilePainter.js` — Rendu « tuiles à la Pokémon (GBA) » de l'exploration : herbe en nappes de tons, chemins et étangs aux coins arrondis et aux
- `tutorial.js` — (sans description)
- `ultimateCinematics.js` — Cinématiques plein écran des ultimes, façon invocations de FF9 : 4 plans portrait (incantation, apparition de l'entité,
- `ultimates.js` — Sorts ultimes (« rage ») : une jauge se charge quand le joueur subit des dégâts ; pleine, elle permet de lancer un
- `version.js` — (sans description)
- `victoryLoot.js` — Butin d'un ennemi de niveau supérieur : le vaincre rapporte à coup sûr de l'équipement rare, du niveau du joueur (jamais
- `weapons.js` — Bibliothèque complète des armes du jeu
- `welcomeBack.js` — « Ça fait longtemps » : rappel succinct (armes, sorts, potions, quêtes actives) quand le joueur revient après une longue absence.
- `worldMap.js` — Régions du monde de « Hou Yi et les Dix Soleils » (voir UNIVERS.md). Chaque région correspond à un écran
- `worldMapView.js` — Rendu de la carte du monde façon "overworld" de Mario : mer, île aux falaises,

## game.js — plan par modules
`game.js` garde l'état (`player`, `enemy`, `gameState`), le mana, les dégâts, le déroulé du combat (tours joueur/ennemi, victoire, nouveau combat) et les attributs. Le reste est extrait et ré-exporté par `game.js` (les imports existants restent valables) :
- `gameTooltips.js` : infobulles (sort, arme, objet, équipement, ennemi), pastilles de statut
- `gameCardUi.js` : aides communes des cartes (échappement HTML, pied de carte, tri mémorisé)
- `gameHud.js` : barres de PV, compteurs, `updateStats`, journal, sauvegarde
- `gameStatsTab.js` : onglet Stats détaillées, annonces de sorts/attaques
- `gameLevelUp.js` : XP, niveau, attributs
- `gameSpellList.js` : sorts disponibles selon le niveau, boutons de sorts
- `gameSpellsTab.js` : onglet Sorts, sélecteur d'ultime, équiper/retirer un sort ou ultime
- `gameInventoryTabs.js` : onglets Armes / Équipement / Inventaire, armes en main, utilisation d'objets
Les modules extraits importent `game.js` en retour (import circulaire sûr : usage uniquement à l'exécution, jamais au chargement).

## explorationView.js — plan par modules
`createExplorationView(cfg)` garde l'état partagé (session, caméra, dialogues, boucle `frame`, API publique). Le reste vit dans des fabriques `createXxx(env)` : `env` expose l'état de la vue (getters/setters sur ses variables) et chaque fabrique renvoie ses fonctions, déstructurées dans la vue.
- `explorationViewConsts.js` : constantes (durées, tailles de tuile, touches, palette des biomes `BIOMES`)
- `explorationViewDraw.js` : `draw(now)`, l'image complète (carte, décors, héros, ennemis, PNJ)
- `explorationViewGround.js` : calque de sol en cache, pré-construction des cartes voisines
- `explorationViewOverlays.js` : minimap, brouillard de guerre, obscurité, aura, boussole de quête
- `explorationViewPainters.js` : primitives de dessin (bâtiments, sprites, marqueurs, ombres, portails, étiquettes)
- `explorationViewCarnet.js` : onglets du carnet (quêtes, voyage, progression, bestiaire)
- `explorationViewMap.js` : carte plein écran et repère, voyage, arène
- `explorationViewChange.js` : mode Chang'e (épisodes, miroir, soins)
Les tests qui lisent le source utilisent `tests/unit/fixtures/explorationViewSource.js` (concatène `explorationView*.js`).

## story.js et exploration.js — plans par modules
- `story.js` : assemble le monde (`SCREENS`, `QUESTS`, `REGION_UNLOCK_LEVEL`) ; le format des données est décrit en tête. Données : `storyText.js` (titre, intro, épilogue), `storyMirror.js` (interludes du miroir), `storyScreens.js` (`BASE_SCREENS`, gros), `storyQuests.js` (`BASE_QUESTS`, gros).
- `exploration.js` : moteur (session, déplacements, ennemis, boss, entrée d'écran, arène, herbes, rencontres) et `export *` des modules : `explorationSenses.js` (aura, mimiques, coffres refermés, repère, brouillard), `explorationQuests.js` (statut/achèvement des quêtes, victoire, Nouvelle Partie +), `explorationDialogue.js` (compagnons, `talkToNpc`), `explorationGuide.js` (suivi de quête, cibles, objectif, journal), `explorationTravel.js` (voyage rapide, progression, bestiaire), `explorationChange.js` (mode Chang'e).
- `cinematics.js` : façade ; code dans `cinematicsCore.js` (socle, primitives), `cinematicsEnding.js` (fin + générique), `cinematicsBoss.js`, `cinematicsSun.js`, `cinematicsRegion.js`, `cinematicsTitle.js`, `cinematicsPrologue.js`, `cinematicsDuel.js`.
- `board.js` : plateau (génération, sélection, échanges, résolution des alignements, gravité) ; extraits : `boardLayout.js` (taille des cases), `boardSuggestions.js` (suggestion de coup), `boardEnemyMoves.js` (coups ennemi / compagnon).
