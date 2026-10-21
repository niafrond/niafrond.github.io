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

## Mesures avec GPU (2026-10-21, RTX 3060 Ti, Chromium sous WSL2)

Accélération vérifiée (`SystemInfo.getInfo` : `2d_canvas`, `gpu_compositing`, `rasterization` activés ; WebGL sur « D3D12 (NVIDIA GeForce RTX 3060 Ti) ») avec
`--use-angle=gl --enable-gpu-rasterization --ignore-gpu-blocklist`. **Sans ces options Chromium utilise SwiftShader (logiciel)** : toujours vérifier avant de mesurer.

- **Rendu canvas** : `fillRect` 13-29 % → 2-3 % du temps ; marche réelle à CPU ×4 : 40-58 images/s contre 22-40 en logiciel. Les pistes canvas de la version précédente de ce document
  (calque d'eau, calque d'auras, blit partiel du sol) sont **abandonnées** : plus rien à gagner de ce côté.
- **Deux défauts trouvés par la trace, absents en rendu logiciel, corrigés** :
  1. `toDataURL` (`sprites/index.js`) : relecture GPU→CPU synchrone, ≈ 30 ms par sprite (15-17 par marche, 457-634 ms) → URI calculée à la demande (`pixelEntry`).
  2. Le pré-téléchargement de 120 Mo était reçu par la **page** (thread principal) : blocages de 0,6 à 4,1 s en première visite → le service worker télécharge et range lui-même (en-tête `X-Prefetch`, réponse `204`).
     Première visite, GPU, CPU ×4, Rizières, 8 exécutions alternées par version : blocage médian 168 → 29 ms, pire cas 1 114 → 179 ms ; images/s médian 54,6 → 58,2, pire cas 28,8 → 46,3.
- Rendu identique : 21 captures sur GPU et 21 en logiciel (ancien code contre nouveau), toutes égales.
- Répartition du thread principal sur GPU (trace, Tonnerre) : JavaScript 35-37 %, tâches natives 22-30 %, attentes du GPU (`WaitForGetOffset`) 4-5 %, `CanvasResourceProviderSharedImage::Snapshot` 3-4 %.
  Le thread du service worker est occupé ≈ 1,6 s sur 9 s pendant le téléchargement (autre thread : sur un téléphone à deux cœurs il peut quand même concurrencer la page, à vérifier sur appareil).
- Les valeurs absolues dépendent du processeur de cette machine (plus rapide que le banc précédent) : ne pas les comparer avec le tableau ci-dessus, seuls les rapports avant/après se transposent.
- 120 Mo à 1,6 Mb/s représentent ≈ 10 minutes de téléchargement ; `navigator.connection.type` (`cellular` / `wifi`) existe sur Chrome Android (pas sur iOS) : une règle « wifi seulement » est faisable (décision en attente).

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

- jest : `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects match3-quest-node` → 70 suites / 2 331 tests verts (≈ 3 min). Filtre : `--testPathPatterns "<motif>"` (**pas** `--testPathPattern`, ignoré en silence).
- Playwright : `npx playwright test --project=match3-quest-mobile` → 12/12 verts. Ici, la version de Playwright du dépôt attendait un autre Chromium que celui installé : un fichier local **non versionné** `.pw-local.config.mjs`
  à la racine (ajouté à `.git/info/exclude`) réutilisait la config du dépôt en forçant `launchOptions.executablePath` ; inutile sur une machine où `npx playwright install chromium` a fonctionné.
- Tests ajoutés : `explorationGrids`, `precacheManifest`, `serviceWorker` (sw.js exécuté dans un faux environnement ; plusieurs mutations volontaires détectées), `offlinePrefetch`, et dans `tests/e2e` : `perf-mobile.spec.js` (compteurs `fillRect`, tâche la plus longue d'une transition, pas de remplissage plein écran) et `offline.spec.js` (jeu hors ligne, tout pré-téléchargé, témoin sans service worker).
- Connus et **hors périmètre** : 31 échecs Playwright dans `dj-mix` (29) et `flash-guess` (2), présents avant le chantier ; test jest instable `progression.test.js` « les ennemis générés utilisent cette défense » (≈ 3,4 % d'échecs : défense tirée au hasard dans `enemies.js`, mesuré sur 3 000 tirages).

## Ce qui n'a PAS été fait

1. ~~Re-mesurer avec GPU~~ **Fait le 2026-10-21** (section « Mesures avec GPU ») : le canvas n'est plus un goulot, deux défauts propres au GPU ont été corrigés.
2. **Vrai téléphone ancien** (jamais testé) : fluidité en exploration, installation du service worker, mode hors ligne, pré-téléchargement de 120 Mo (quota, batterie, forfait), mises à jour du jeu, concurrence du thread du service worker avec la page sur un téléphone à deux cœurs.
3. **Phase 3 (adaptation par FPS mesuré) : écartée.** Sur GPU à CPU ×4 le jeu tient 40-58 images/s ; sans appareil réel il n'y a rien à calibrer.
4. **Non mesuré** : délai audible réel de la musique (démarrage, boucle) ; sorts de classe en combat ; la plupart des 135 cartes (16 mesurées) ; cause de la variance de la transition de la cave ; première visite en réseau lent (le service worker retélécharge le cœur, ≈ 5 Mo, sous des URL sans `?v=` donc sans réutiliser le cache HTTP de la page : piste, jamais mesurée).
5. **Décisions en attente de l'utilisateur** : le pré-téléchargement démarre seul 8 s après le chargement (sauf économiseur de données) et peut consommer le forfait mobile (le navigateur ne dit pas de façon fiable si l'on est en 4G) → lancement manuel ? ;
   rendre déterministe le test instable ; retirer du dépôt les ≈ 1,2 Go de sprites sources (irréversible côté historique).

## Pièges déjà rencontrés

- `pkill -f <motif>` dans l'outil Bash tue le shell lui-même (le motif est dans sa ligne de commande) ; deux exécutions de banc en parallèle faussent les mesures.
- `npx serve` répond `301` à `index.html` : une réponse redirigée ne peut pas servir une navigation (corrigé dans `sw.js`) ; utiliser `python3 -m http.server` pour les mesures.
- `page.waitForFunction(async () => …)` ne bloque pas (la promesse est toujours « vraie ») : utiliser `expect.poll`.
- Les XHR synchrones ne passent pas par les service workers (voir `index.html`).
- Un test d'équivalence visuelle doit figer le temps **et** l'aléa (`pixels.mjs`) ; deux rendus de la même version doivent être identiques avant de comparer deux versions.
- Un `git ls-files` de 1,2 Go de sprites ne dit pas ce que le jeu charge : se fier à `precache-manifest.json`.
- **Mesurer le profileur CPU seul ne suffit pas sur GPU** : `(program)` cache le natif. Utiliser `tools/perf-bench/trace.mjs` (trace Chromium, temps propre par événement, tâches longues).
- Une mesure « première visite » démarre le pré-téléchargement : l'isoler avec `NO_PREFETCH=1` pour savoir ce qui vient du jeu et ce qui vient du téléchargement.
- Machine Windows + WSL2 : sous Git Bash, `MSYS_NO_PATHCONV=1` est nécessaire avant `wsl.exe` (sinon `/mnt/c/...` est réécrit) ; pas de `python` ni de `node` côté Git Bash (utiliser WSL, Node 22 via nvm) ;
  `chrome://gpu` est inaccessible en headless : lire l'état par `browser.newBrowserCDPSession().send('SystemInfo.getInfo')`.
- `Math.min(...tableau)` dépasse la pile sur une trace Chromium (centaines de milliers d'événements) : utiliser une boucle.
