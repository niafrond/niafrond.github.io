# match3-quest — état des lieux du chantier « vieux téléphones » (2026-10-21)

Document de reprise : ce qui a été fait, mesuré, ce qui reste, et les pièges. Le détail chronologique est dans `SPECS.md` (entrées 2026-10-20 et 2026-10-21).
Outils de mesure : `tools/perf-bench/` (voir son README).

## Demande et contraintes

Optimiser le jeu pour de **vieux téléphones** (peu de CPU, GPU, RAM) **sans que les téléphones récents le ressentent**, en conservant **toutes les animations
et toutes les musiques sur tous les appareils** (pas de mode dégradé qui les supprime), et en profitant d'un **stockage local** pour éviter les appels réseau.
Décisions de l'utilisateur : service worker (et non le seul Cache Storage), **tout pré-télécharger** ; `dj-mix` et `flash-guess` hors périmètre (ne pas y toucher).

## Branches et commits

Tout le travail est sur `ccr-f77478a3-58hzl2` (9 commits depuis la base `afa26e3`), repris ici sur `perf/match3-quest-vieux-telephones` + ces outils.

| Commit | Contenu |
|---|---|
| `7a00b35` | `world/junctions.js` : grilles `Uint8Array` au lieu de parcourir tous les rectangles (chargement CPU ×4 : 10,4 s → 4,6 s) |
| `d6e0c75` | la carte d'exploration n'est plus redessinée quand elle est couverte (cinématique opaque, onglet caché, carte hors écran) ni à pleine cadence sous un modal (4 images/s) |
| `51fe96f` | `explorationGrids.js` : grilles d'obstacles/liquides/chemins et décors fixes en cache, à la place de `inRects` à chaque image |
| `04df962` | ne dessiner que ce qui est à l'écran (`inView`) : 315 → 46 `fillRect` par image sur une grande zone |
| `48e7733` | le sol de la carte voisine est construit par tranches pendant que le héros approche d'une sortie (transitions : 0,5-0,8 s d'arrêt → 0,1-0,2 s) |
| `284d864` | `tools/precache-manifest.mjs` + `precache-manifest.json` (`npm run precache:build`) |
| `456cd92` | `sw.js` + `offlineCache.js` : le jeu se charge depuis le téléphone, y compris hors ligne |
| `a74fa82` | pré-téléchargement de tout le jeu (≈ 120 Mo) en arrière-plan, avec statut et bouton dans les Options |
| `16ac9d7` | fond de la carte peint en bandes autour de la carte au lieu du plein écran |

## Résultats mesurés (Chromium émulé mobile, **sans GPU**, CPU ralenti)

Marche réelle par clics, CPU ×4, base `afa26e3` → aujourd'hui (une seule série chacune : bruit ≈ ±10 %) :

| Carte | Images/s | Blocage cumulé sur 9 s |
|---|---|---|
| Rizières (zone sauvage 48×24) | 10,1 → ≈ 17 | 3 879 → ≈ 600 ms |
| Tonnerre (zone sauvage) | 10,9 → ≈ 21 | 4 032 → ≈ 700 ms |
| Mer (zone sauvage) | 18,8 → ≈ 27 | — |

- À CPU ×1, une grande zone sauvage consommait 94 % d'un cœur, 51 % après.
- Carte du monde ouverte : 17,5 → 54,5 images/s (l'exploration ne se dessine plus derrière). Cinématique du prologue : 16,6 → 60 (idem : elle était mesurée avec l'exploration derrière).
- Chargement du jeu, CPU ×4 : 10,4 s → 4,6 s. En 4G lente (1,6 Mb/s, 150 ms), CPU ×4 : première visite 28,7 s, visites suivantes **3,6 s** (service worker).
- Transitions (CPU ×4) : grenier ≈ 100 ms de tâche la plus longue, cave 180-225 ms (valeur isolée jusqu'à 413-500 ms : variance non expliquée).
- Combat au plateau, animation de sort, ultimes : déjà à 60 images/s à CPU ×4, rien à optimiser.
- RAM : tas JS ≈ 10 Mo, une piste décodée 20,5 Mo (mono), un ultime 7,7 Mo : **la RAM n'est pas le problème** (les pistes de 116 s sont en mono 32 kHz).

**Erreur corrigée en cours de route** : la première série de mesures « en marchant » utilisait des touches fléchées ; le héros restait souvent bloqué contre un
obstacle, donc la caméra bougeait à peine et les chiffres absolus (moyenne 18 → 27 images/s) étaient trop flatteurs. Les comparaisons avant/après restaient valables ;
les chiffres du tableau ci-dessus sont ceux de la marche réelle.

**Profil restant** (marche réelle, CPU ×4) : le JavaScript du jeu ≈ 5 % ; le reste est le rendu natif du canvas : `(program)` ≈ 50 %, `fillRect` ≈ 27 %.

## Architecture livrée

- **`sw.js`** (classique ES2017, version lue dans `sw.js?v=<build>`) : cache du cœur par build (`match3-core-v<build>`), cache des médias commun à tous les builds
  (`match3-media-v1`, indexé par chemin, empreintes dans `__hashes.json`, mises à jour sérialisées). Page d'accueil, `version.js` et manifeste : réseau d'abord avec délai (3 s / 2 s) puis cache ;
  cœur et médias : cache d'abord ; `Range` géré ; une URL `?v=` d'un autre build va au réseau (repli sur le cache hors ligne seulement) ; réponses redirigées reconstruites.
- **`offlineCache.js`** : enregistrement du service worker (`registerServiceWorkerWhenLoaded`), `createPrefetcher` (reprenable, 2 fichiers à la fois, quota, hors ligne, économiseur de données),
  statut et bouton « Jeu hors ligne » dans les Options.
- **`precache-manifest.json`** : 178 fichiers de cœur (4,9 Mo) et 359 médias (119,6 Mo). **À régénérer (`npm run precache:build`) à chaque ajout ou changement de fichier du jeu** ; un test jest échoue sinon.
  `sprites/png`, `sprites/ultimates-seq|comfy|sdxl`, `tools`, `tests`… n'y sont pas (≈ 1,2 Go suivis par git mais jamais demandés par le jeu).
- **`explorationGrids.js`** (`gridsOf`) et, dans `explorationView.js` : `inView` (découpage hors écran), `groundPainter`/`groundJob`/`prebuildNeighborGround` (sol voisin par tranches),
  fond en bandes, suspension du dessin quand la carte est couverte.
- **`index.html`** : le script anti-cache lit la version par une XHR **synchrone**, qui ne passe pas par le service worker ; hors ligne il retombait sur `v=0` : le dernier build lu est mémorisé (`localStorage` `match3.build`).

## Tests

- jest : `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects match3-quest-node` → 69 suites / 2 318 tests verts (≈ 3 min). Filtre : `--testPathPatterns "<motif>"` (**pas** `--testPathPattern`, ignoré en silence).
- Playwright : `npx playwright test --project=match3-quest-mobile` → 12/12 verts. Ici, la version de Playwright du dépôt attendait un autre Chromium que celui installé : un fichier local **non versionné** `.pw-local.config.mjs`
  à la racine (ajouté à `.git/info/exclude`) réutilisait la config du dépôt en forçant `launchOptions.executablePath` ; inutile sur une machine où `npx playwright install chromium` a fonctionné.
- Tests ajoutés : `explorationGrids`, `precacheManifest`, `serviceWorker` (sw.js exécuté dans un faux environnement ; plusieurs mutations volontaires détectées), `offlinePrefetch`, et dans `tests/e2e` : `perf-mobile.spec.js` (compteurs `fillRect`, tâche la plus longue d'une transition, pas de remplissage plein écran) et `offline.spec.js` (jeu hors ligne, tout pré-téléchargé, témoin sans service worker).
- Connus et **hors périmètre** : 31 échecs Playwright dans `dj-mix` (29) et `flash-guess` (2), présents avant le chantier ; test jest instable `progression.test.js` « les ennemis générés utilisent cette défense » (≈ 3,4 % d'échecs : défense tirée au hasard dans `enemies.js`, mesuré sur 3 000 tirages).

## Ce qui n'a PAS été fait / à reprendre sur une machine avec GPU

1. **Re-mesurer avec GPU** (`tools/perf-bench/README.md`, section GPU). Question centrale : `fillRect` ≈ 27 % et `(program)` ≈ 50 % persistent-ils avec le rendu accéléré ? Si non, le travail restant sur le canvas est probablement inutile. Si oui, pistes : calque unique pour les reflets de liquides (alpha par case recalculé à chaque image), calque d'auras mis en cache (redessiné seulement quand un ennemi bouge), blit du calque de sol limité à la zone visible (`drawImage` à 9 arguments).
2. **Vrai téléphone ancien** (jamais testé) : fluidité en exploration, installation du service worker, mode hors ligne, pré-téléchargement de 120 Mo (quota, batterie, forfait), mises à jour du jeu.
3. **Phase 3 non faite** : adaptation par FPS mesuré (descendre d'un cran si la médiane tombe sous 40 images/s). Écartée pour l'instant : sans GPU, les gains restants se mesurent mal.
4. **Non mesuré** : délai audible réel de la musique (démarrage, boucle) ; sorts de classe en combat ; la plupart des 135 cartes (16 mesurées) ; cause de la variance de la transition de la cave.
5. **Décisions en attente de l'utilisateur** : le pré-téléchargement démarre seul 8 s après le chargement (sauf économiseur de données) et peut consommer le forfait mobile (le navigateur ne dit pas de façon fiable si l'on est en 4G) → lancement manuel ? ;
   rendre déterministe le test instable ; retirer du dépôt les ≈ 1,2 Go de sprites sources (irréversible côté historique).

## Pièges déjà rencontrés

- `pkill -f <motif>` dans l'outil Bash tue le shell lui-même (le motif est dans sa ligne de commande) ; deux exécutions de banc en parallèle faussent les mesures.
- `npx serve` répond `301` à `index.html` : une réponse redirigée ne peut pas servir une navigation (corrigé dans `sw.js`) ; utiliser `python3 -m http.server` pour les mesures.
- `page.waitForFunction(async () => …)` ne bloque pas (la promesse est toujours « vraie ») : utiliser `expect.poll`.
- Les XHR synchrones ne passent pas par les service workers (voir `index.html`).
- Un test d'équivalence visuelle doit figer le temps **et** l'aléa (`pixels.mjs`) ; deux rendus de la même version doivent être identiques avant de comparer deux versions.
- Un `git ls-files` de 1,2 Go de sprites ne dit pas ce que le jeu charge : se fier à `precache-manifest.json`.
