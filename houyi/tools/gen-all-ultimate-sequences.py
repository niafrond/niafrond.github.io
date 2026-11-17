#!/usr/bin/env python3
"""gen-all-ultimate-sequences.py — Génère, pour chaque ultime, la cinématique en plan-séquence (ComfyUI : SDXL + Pixel Art XL, Wan 2.2 14B première/dernière image).

Pour chaque ultime, le script :
  1. construit tools/sequences/<id>.json depuis ULTIMATES/BIBLES de gen-ultimates.mjs (sauf si le JSON existe déjà : réglages manuels conservés ; --respec pour le recréer) ;
  2. lance `gm sequence` (game-maker, WSL) : éléments (entité du plan 2 sur fond vert, détourée, meilleur candidat choisi automatiquement),
     7 images clés composées, 7 segments vidéo, montage et repixélisation (144×256) ;
  3. saute les ultimes déjà terminés (px/preview.gif présent ; --force pour refaire).
Mise en page type (entité en haut, effets au centre et au sol) : à affiner à la main dans le JSON d'un ultime (champ `pick`, `paste`, `fx`) puis relancer avec --only=<id> --force.

Prérequis (dans WSL) : ComfyUI lancé par `gm up pixel` (game-maker, GAME_MAKER_DIR), images de départ de repli sprites/ultimates-sdxl/<id>-1.png (tools/gen-ultimates-comfy.mjs).
Durée : ≈ 30 min par ultime sur RTX 3060 Ti (7 segments × ≈ 4 min).

Usage (WSL) : python3 tools/gen-all-ultimate-sequences.py [--only=ultimateSkyWolf,...] [--stage=prep|video|elements|base|keys|segments|stitch] [--respec] [--force] [--specs-only]
"""
import sys, os, re, ast, json, subprocess, time

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(GAME, 'tools')
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')  # pile IA locale (WSL) : voir son README
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None

src = open(os.path.join(TOOLS, 'gen-ultimates.mjs'), encoding='utf-8').read()


def js_block(start, end):
    b = src[src.index(start):src.index(end)]
    b = b[b.index('{'):b.rindex('}') + 1]
    return ast.literal_eval(re.sub(r'^(\s*)(ultimate\w+):', r'\1"\2":', b, flags=re.M))


ULTIMATES = js_block('export const ULTIMATES', '// « Bible »')
BIBLES = js_block('const BIBLES', 'const seedOf')
STYLE = re.search(r"const STYLE = '([^']+)'", src).group(1)
NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres'
ELEMENT_NEGATIVE = 'background, landscape, scenery, ground, shadow, text, border, frame'
WARM = [255, 235, 170]
# Couleur du fond uni du héros : contraste avec son costume pour un détourage propre.
HERO_BG = {'ultimateFiveElements': 'magenta', 'ultimateHeavenlyThunder': 'lime green', 'ultimateThousandArrows': 'cyan',
           'ultimateSunPiercer': 'cyan', 'ultimateImperialDragon': 'cyan', 'ultimateEternalBastion': 'magenta',
           'ultimateThousandRiders': 'cyan', 'ultimateSkyWolf': 'lime green'}
# Décors seuls (sans personnage) : ciel dégagé en haut, sol vide dans le tiers bas.
PLATES = {
    'ultimateFiveElements': 'a huge glowing circle of five colored runes (red, blue, green, yellow, white) in a dark indigo night sky, drifting embers, cosmic clouds, a flat rocky platform in the lower third',
    'ultimateHeavenlyThunder': 'a mountain peak at night, dark purple storm clouds gathering in a wide sky, a flat rocky summit in the lower third',
    'ultimateThousandArrows': 'a cliff edge under a dark red sky with red and gold clouds, a lone twisted tree, a flat rocky ledge in the lower third',
    'ultimateSunPiercer': 'a cliff at dawn under a red-orange sky with a huge blazing sun at the top, a flat rocky ledge in the lower third',
    'ultimateImperialDragon': 'a Chinese palace and pagoda silhouette under a stormy golden sky, a glowing golden sigil circle on the stone ground in the lower third',
    'ultimateEternalBastion': 'a Chinese stone watchtower on a hill at dusk, a deep blue sky, glowing blue-green seal-script runes on the ground in the lower third',
    'ultimateThousandRiders': 'a dusty steppe hilltop at sunset near the Great Wall, a red sky with a big red sun, flat dusty ground in the lower third',
    'ultimateSkyWolf': 'a snowy mountain top at night under a huge full purple moon, purple aurora in the sky, a flat snowy summit in the lower third',
}



def build_spec(uid):
    (s1, m1), (s2, m2), (s3, m3), (s4, m4) = ULTIMATES[uid]
    hero = re.match(r'recurring hero: ([^;]*);', BIBLES[uid]).group(1).replace('the same ', 'a ', 1)
    ent = {'el': 'entity'}
    ring = lambda cy, r, sq=1.0, a=190: {'type': 'rings', 'cx': 0.5, 'cy': cy, 'r': r, 'squash': sq, 'alpha': a, 'width': 12, 'color': WARM}
    glow = lambda cy, r, a: {'type': 'glow', 'cx': 0.5, 'cy': cy, 'r': r, 'color': WARM, 'alpha': a}
    return {
        'id': uid,
        'style': f'pixel art, {STYLE}, {BIBLES[uid]}',
        'negative': NEGATIVE,
        'first': f'sprites/ultimates-sdxl/{uid}-1.png',
        'plate': PLATES[uid],
        'style_plate': f'pixel art, {STYLE}',
        'hero_text': hero,
        'hero_layout': {'w': 0.3, 'cx': 0.5, 'feet': 0.88, 'denoise': 0.3},
        'elements': {
            'entity': {'prompt': s2, 'w': 768, 'h': 768, 'seed': 100, 'negative': ELEMENT_NEGATIVE, 'tries': 6},
            'hero': {'prompt': f'{hero}, full body, standing, three-quarter view, holding the bow', 'w': 768, 'h': 1024, 'seed': 500, 'negative': ELEMENT_NEGATIVE + ', close-up, portrait, cropped', 'tries': 6, 'bg': HERO_BG[uid]},
        },
        'keys': [
            {'prompt': f'{s1}, magical energy gathering', 'denoise': 0.4, 'fx': [glow(0.45, 0.1, 150)]},
            {'prompt': s2, 'denoise': 0.35, 'paste': [{**ent, 'cx': 0.5, 'cy': 0.2, 'w': 0.5, 'alpha': 0.65}]},
            {'prompt': s2, 'denoise': 0.35, 'paste': [{**ent, 'cx': 0.5, 'cy': 0.25, 'w': 0.95, 'alpha': 0.92}]},
            {'prompt': s3, 'denoise': 0.45, 'paste': [{**ent, 'cx': 0.5, 'cy': 0.25, 'w': 0.95, 'alpha': 0.92}], 'fx': [ring(0.25, [0.2, 0.35, 0.5])]},
            {'prompt': s3, 'denoise': 0.45, 'paste': [{**ent, 'cx': 0.5, 'cy': 0.25, 'w': 0.95, 'alpha': 0.6}], 'fx': [ring(0.5, [0.15, 0.3, 0.45], 0.6), glow(0.62, 0.3, 140)]},
            {'prompt': s4, 'denoise': 0.5, 'paste': [{**ent, 'cx': 0.5, 'cy': 0.25, 'w': 0.95, 'alpha': 0.3}], 'fx': [ring(0.78, [0.25, 0.45, 0.7], 0.3, 210), glow(0.78, 0.35, 170)]},
        ],
        'segments': [
            {'frames': 49, 'motion': m1},
            {'frames': 49, 'motion': m2},
            {'frames': 49, 'motion': f'{m2}, it grows colossal, the camera tilts up'},
            {'frames': 49, 'motion': m3},
            {'frames': 49, 'motion': m3},
            {'frames': 49, 'motion': m4},
            {'frames': 25, 'motion': f'{m4}, the glow slowly fades'},
        ],
    }


ids = [u for u in ULTIMATES if not ONLY or u in ONLY]
done, failed = [], []
for uid in ids:
    spec_path = os.path.join(TOOLS, 'sequences', f'{uid}.json')
    if 'respec' in opts or not os.path.exists(spec_path):
        os.makedirs(os.path.dirname(spec_path), exist_ok=True)
        json.dump(build_spec(uid), open(spec_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f'spec : {spec_path}')
    if 'specs-only' in opts:
        continue
    gif = os.path.join(GAME, 'sprites', 'ultimates-seq', uid, 'px', 'preview.gif')
    if os.path.exists(gif) and 'force' not in opts and 'stage' not in opts:
        print(f'SKIP {uid} (déjà généré)')
        continue
    t0 = time.time()
    print(f'=== {uid}', flush=True)
    # le moteur vit dans game-maker : `gm sequence` (étapes elements|base|keys|segments|stitch, ou groupes prep|video)
    cmd = [os.path.join(GAME_MAKER, 'gm'), 'sequence', spec_path, '--root', GAME, '--out', os.path.join(GAME, 'sprites', 'ultimates-seq', uid)] \
        + (['--force'] if 'force' in opts else []) + ([f"--only={opts['stage']}"] if 'stage' in opts else [])
    r = subprocess.run(cmd)
    (done if r.returncode == 0 else failed).append(uid)
    print(f'{"OK " if r.returncode == 0 else "ERR"} {uid} ({int((time.time() - t0) / 60)} min)', flush=True)
print(f'Terminé : {len(done)} ok, {len(failed)} échec(s) {failed or ""}')
