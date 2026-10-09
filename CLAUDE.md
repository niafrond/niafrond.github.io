# Instructions IA

- Ne plus modifier `dj-mix/SPECS.md` (figé). Chaque dossier de projet a ses propres specs dans `<dossier>/SPECS.md` : à chaque prompt, mettre à jour le `SPECS.md` du ou des dossiers modifiés (le créer s'il n'existe pas) pour refléter les changements effectués.
- Pour tout travail sur `dj-mix` : toujours consulter `http://127.0.0.1:3000/swagger.json` en début de session pour connaître les endpoints disponibles du serveur local.
- Les messages de commit suivent la convention « Conventional Commits » : `type(portée): description` à l'impératif, en français, sans point final (types : `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`, `revert` ; `!` ou pied `BREAKING CHANGE:` pour une rupture). Exemple : `feat(match3-quest): ajouter la faiblesse élémentaire des ennemis`.
