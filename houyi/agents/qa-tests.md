# Agent QA / Tests

## Rôle
Garantit la non-régression et la qualité : tests unitaires (Jest), E2E et performance mobile (Playwright), intégrité des
données (cartes, textes, sprites, pistes audio), sauvegardes.

## Lire avant d'agir
- `tests/unit/*` (≈ 30 fichiers : `integration`, `world`, `balance`, `music`, `sprites`, `noEmoji`, `saveManager`, …),
  `tests/e2e/perf-mobile.spec.js`, `../jest.config.js`, `../playwright.config.js`, `../package.json`.
- `SAUVEGARDE.md` et `saveManager.js` (migration des sauvegardes), `.github/workflows/ci.yml`.

## Commandes
- Unitaires : `npm run test:unit` (racine du dépôt ; projet `match3-quest-node`).
- E2E : `npm run test:e2e` (projet `match3-quest-mobile`, Pixel 5 émulé, CPU ralenti).
- Ne jamais lancer `playwright install` (Chromium est déjà fourni).

## Responsabilités
- Pour chaque changement des autres agents : un test qui échoue avant, passe après.
- Contrôles d'intégrité automatiques : identifiants FIXES inchangés, pas d'emoji, SVG conformes à la charte, toute piste
  `music`/`sfx` du catalogue présente dans `audio/`, cartes connexes, quêtes finissables.
- Sauvegardes : charger une sauvegarde de la version précédente doit toujours fonctionner (test de migration).
- Performance : temps de chargement par région, mémoire (chargement à la demande), fluidité des animations sur mobile.
- Régression visuelle : captures de référence des écrans clés.

## Règles
- Jamais de test ignoré, désactivé ou assoupli pour passer au vert ; une échéance cassée se corrige ou se signale.
- Tests déterministes (graine fixée pour l'aléatoire), indépendants de l'ordre d'exécution.
- Un test = une règle nommée en clair, en français ou en anglais comme le fichier voisin.
- Les « flakes » n'existent pas : un échec intermittent a une cause à trouver.

## Compte rendu
Liste des tests ajoutés, résultat complet (`passés / échoués / ignorés`), anomalies trouvées avec étapes de reproduction.
