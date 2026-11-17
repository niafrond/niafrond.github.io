# perf-bench — mesurer la fluidité de match3-quest

Scripts Playwright utilisés pour le chantier « vieux téléphones » (voir `docs/PERF-ETAT-DES-LIEUX.md`). Ils pilotent un vrai Chromium, ralentissent
le CPU (CDP) et mesurent images/s, blocage du thread principal, déplacement réel de la caméra et fonctions les plus coûteuses.

## Mise en route

```bash
# 1. serveur statique à la racine du dépôt (PAS `serve` : il redirige index.html, ce qui change le comportement du service worker)
python3 -m http.server 4180 &

# 2. Chromium : celui de Playwright (`npx playwright install chromium`), ou un exécutable existant
export CHROMIUM_PATH=/chemin/vers/chrome            # facultatif
export CHROMIUM_ARGS="--no-sandbox"                 # facultatif ; machine avec GPU : voir « Mesurer avec un GPU » ci-dessous
export URL=http://127.0.0.1:4180                    # facultatif (défaut)

# 3. une fois : écrans types + sauvegarde d'un héros neuf → .cache/ (non versionné)
node match3-quest/tools/perf-bench/setup.mjs
```

## Scripts

| Script | Rôle |
|---|---|
| `walk.mjs <clic\|touches> <CPU> <écran…>` | Marche de 9 s : images/s, p95, blocage, caméra, profil CPU. **Utiliser `clic`** : avec `touches` le héros reste souvent bloqué contre un obstacle (la caméra bouge à peine) et les chiffres flattent. |
| `transition.mjs <CPU> <écran…>` | Changement de carte : plus longue tâche et plus grand écart entre images. `WAIT=<ms>` règle l'attente avant la sortie. |
| `pixels.mjs <étiquette>` / `--compare A B` | 21 captures du canvas, temps et aléa figés, répétées jusqu'à stabilité (le chargement asynchrone des sprites faussait la comparaison) : prouve qu'une optimisation ne change aucun pixel. Lancer sur la référence (worktree de `HEAD` servi sur un autre port : `URL=http://127.0.0.1:4181`) puis sur la version modifiée. `--compare` tolère un arrondi du GPU (2 niveaux sur 0,01 % des pixels) et le dit. Bruit résiduel connu : `820-fleuve_cave`. |
| `trace.mjs <CPU> <écran…>` | Trace Chromium d'une marche : temps propre par événement du thread principal, charge par thread, tâches ≥ 80 ms avec leur composition, nombre et coût des `toDataURL`. À utiliser dès que le profil CPU montre surtout `(program)` (le natif y est regroupé). |
| `combat.mjs <CPU> [durée]` | Combat joué automatiquement (plateau **réellement affiché**, `startCombat`) : images/s, blocage, et avec `TRACE=1` la répartition du thread principal et du thread GPU. |
| `spells.mjs <CPU> [palier…]` | Animations de sorts (un sort par palier) mesurées en plein combat ; les paliers 4-5 s'étalent sur tout le plateau. |
| `warmup.mjs <CPU> [variante…]` | Cadence toutes les 2 s après l'entrée en combat, avec ou sans une règle CSS ou un réglage (variantes listées dans le script) : sert à isoler ce qui allonge l'échauffement sur GPU. |
| `cold.mjs <4g\|aucun>` | Première visite puis visite suivante (service worker), réseau lent ou non. |
| `full.mjs <étiquette> [CPU]` / `--compare A B` | Benchmark complet (≈ 10 min) : exploration sur 16 écrans, transitions, carte du monde, sort, ultimes, cinématiques. |

Écrans types (`.cache/screens.json`) : `rizieres_wild`, `volcan_wild`, `gobi_wild`, `fleuve_wild`, `bambous_wild`, `tonnerre_wild`, `fauves_wild`,
`mer_wild`, `fusang_wild`, `lune_wild` (48×24, les plus lourds), trois villages, `rizieres_h_grenier` (intérieur), `fleuve_cave`, `arena_c8`.

## Règles pour que les chiffres restent comparables

- **Rien d'autre en parallèle** (deux exécutions simultanées se faussent mutuellement : c'est arrivé).
- Comparer **avant/après dans la même session**, en alternant (le bruit entre exécutions est de l'ordre de ±10 %).
- Ne jamais tuer un processus avec `pkill -f <motif>` depuis le shell de l'outil : le motif se retrouve dans sa propre ligne de commande et tue le shell.
- Les valeurs absolues dépendent de la machine ; seuls les rapports avant/après sont transposables.

## Mesurer avec un GPU

Les premières mesures du chantier ont été faites **sans GPU** (rendu logiciel). Procédure vérifiée le 2026-10-21 (RTX 3060 Ti, Chromium de Playwright sous WSL2) :

```bash
export CHROMIUM_ARGS="--no-sandbox --use-angle=gl --enable-gpu-rasterization --ignore-gpu-blocklist"
node match3-quest/tools/perf-bench/walk.mjs clic 4 rizieres_wild tonnerre_wild mer_wild
```

**Vérifier que l'accélération est réellement active** (sans les options ci-dessus Chromium retombe sur SwiftShader, sans message) : `chrome://gpu` est inaccessible en headless,
lire l'état par le protocole de débogage :

```js
const s = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
console.log(s.gpu.featureStatus);   // attendu : 2d_canvas: 'enabled', gpu_compositing: 'enabled', rasterization: 'enabled_force'
```

Les options `--use-angle=vulkan` et l'absence d'options donnent du logiciel ; `--use-angle=gl` et `--use-angle=gl-egl` donnent « D3D12 (NVIDIA …) » sous WSL2.
Autre machine : adapter le backend ANGLE (`gl`, `gl-egl`, `metal`, `d3d11`…) et revérifier `featureStatus`.

**Attention au combat** : ne jamais mesurer un combat sans `startCombat` (plateau masqué = mesure sans objet) ; mesurer **l'entrée en combat** (les 10 premières secondes) et pas seulement le régime établi.
**Diagnostic** : `INIT_SCRIPT='<js>'` exécute du JavaScript avant le chargement de la page (désactiver une partie du dessin, forcer un réglage).
`pixels.mjs --compare` classe chaque différence : *arrondi* (≤ 2 niveaux), *proche* (anticrénelage : écart moyen ≤ 3 et ≤ 0,1 % de pixels à plus de 32 niveaux, **à confirmer à l'œil**) ou *différent*.

**Mesurer le jeu seul, sans le pré-téléchargement automatique** : `NO_PREFETCH=1 node …/walk.mjs …` (simule l'économiseur de données). Une première visite normale mesure aussi le téléchargement des 120 Mo.
