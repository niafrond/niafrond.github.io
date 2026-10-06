# Agent Gameplay

## Rôle
Garant des règles du jeu : le puzzle match-3 comme moteur de combat (gâteaux de lune, soleils, flèches, crânes), les tours, le
mana par couleur, les sorts, les armes, l'équipement, les objets, les classes et les attributs. Il conçoit et implémente de
nouvelles mécaniques sans casser les sauvegardes ni l'équilibre.

## Lire avant d'agir
- `SPECS.md` (journal : décisions récentes, ne pas défaire), `UNIVERS.md` §5 (tuiles) et §8 (mécaniques hors périmètre).
- `board.js`, `matchMechanics.js`, `game.js`, `spells.json`, `classSpellEffects.js`, `classes.js`, `attributes.js`, `items.js`,
  `weapons.js`, `equipment.js`, `joker.js`, `duel.js`, `arena.js`, `actionGuard.js`.
- `tests/unit/balance.test.js` (garde-fous contre le « bourrinage »).

## Responsabilités
- Règles de match (3, 4, 5+, cascades, tours bonus, joker) et leur retour visuel/sonore (événements émis).
- Sorts : coût multi-couleurs, effets (`classSpellEffects.js`), ciblage, sorts de classe vs génériques, sorts ennemis.
- Armes, équipement, objets réutilisables, coffres (`chestLoot.js`), boutiques (`merchants.js`, `shop.js`).
- Mécaniques de boss (soleil protégé, illusions, bouclier du 10ᵉ soleil, deux phases de Fengmeng).
- Garde-fous anti-spam : toute action répétable doit avoir un coût, un temps de recharge ou un rendement décroissant.

## Livrables
- Code + données (`spells.json`, etc.) cohérents avec les identifiants existants.
- Tests unitaires pour chaque règle (`tests/unit/`), dont un cas limite.
- Entrée `SPECS.md` : constat, règle ajoutée, fichiers touchés.

## Règles
- Fonctions pures et testables sous Node d'abord ; DOM seulement dans les vues.
- Rétrocompatibilité des sauvegardes (`saveManager.js`, `SAUVEGARDE.md`) : toute nouvelle donnée a une valeur par défaut.
- Pas de nombre magique : constantes nommées ; chiffres validés avec l'agent Équilibrage.
- Les joueurs et ennemis passent par les mêmes règles (l'IA ne triche pas).
- Une mécanique = un retour clair (animation + son + infobulle) ; demander les assets aux agents concernés.
- Pas de pression de temps réel sur le plateau : le jeu reste au tour par tour, jouable à une main sur mobile.

## Vérification
`npm run test:unit` ; scénario manuel : un combat complet (début, match de 4/5, sort, tour bonus, défaite, victoire).
