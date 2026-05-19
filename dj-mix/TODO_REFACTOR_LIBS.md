# TODO refactor libs - dj-mix

Objectif: separer les responsabilites pour garder des modules petits, testables et reutilisables.

## P0 - Decoupage prioritaire

- [x] Extraire la config des transitions + estimation RAM de `mixFeatures` vers `lib/transitionModes.js`.
- [x] Extraire la logique Auto DJ FX (selection, cooldown, scheduling) de `main.js` vers `lib/autoDjFxManager.js`.
- [x] Extraire la logique stockage/lecture des settings UI de `main.js` vers `lib/settingsStorage.js`.
- [x] Extraire la logique de capacite RAM (detection device + budget) de `main.js` vers `lib/ramProfile.js`.
- [x] Centraliser les cles localStorage dans `lib/storageKeys.js`.

## P1 - Qualite et lisibilite

- [x] Remplacer les structures globales de `main.js` par un objet `appState` unique (`lib/appState.js`).
- [x] Isoler la logique de queue drag/drop dans `lib/queueDnD.js`.
- [x] Isoler la logique automix timing dans `lib/automixTimeline.js`.
- [x] Creer un `lib/deckHelpers.js` pour normaliser les operations repetitives deck A/B.

## P2 - Tests

- [x] Ajouter des tests unitaires pour `lib/transitionModes.js`.
- [x] Ajouter des tests unitaires pour `lib/settingsStorage.js` (fallback et corruption JSON).
- [x] Ajouter des tests unitaires pour `lib/ramProfile.js` (deviceMemory/hardwareConcurrency).
- [x] Ajouter des tests unitaires pour `lib/autoDjFxManager.js`.

## P3 - Nettoyage

- [x] Re-export optionnel via `lib/index.js` pour simplifier les imports.
- [x] Documenter l'architecture des libs dans `dj-mix/README.md` (ou section dediee).
- [x] Ajouter une regle taille max par module (soft limit) dans la revue de code.
