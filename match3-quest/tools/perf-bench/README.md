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
| `pixels.mjs <étiquette>` / `--compare A B` | 21 captures du canvas, temps et aléa figés : prouve qu'une optimisation ne change aucun pixel. Lancer sur la référence (`git stash`/worktree) puis sur la version modifiée. |
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

Les mesures du chantier ont été faites **sans GPU** (rendu logiciel de Chromium) : `(program)` ≈ 50 % et `fillRect` ≈ 27 % du temps y sont probablement
pessimistes. Sur une machine avec GPU, lancer par exemple :

```bash
export CHROMIUM_ARGS="--enable-gpu-rasterization --ignore-gpu-blocklist --use-angle=gl"   # adapter à la machine (egl, vulkan…)
node match3-quest/tools/perf-bench/walk.mjs clic 4 rizieres_wild tonnerre_wild mer_wild
```

Vérifier d'abord que l'accélération est bien active (ouvrir `chrome://gpu` dans la même instance Chromium) : sans cela on retombe sur le rendu logiciel.
