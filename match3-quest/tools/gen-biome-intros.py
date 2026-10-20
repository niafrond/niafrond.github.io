#!/usr/bin/env python3
"""gen-biome-intros.py — Mini-animations plein écran jouées quand le héros arrive dans un nouveau biome (région), générées en local
avec game-maker (`gm sequence` : SDXL + Pixel Art XL pour les images clés, Wan 2.2 14B première/dernière image pour la vidéo, repixélisation 144×256).

Pour chacune des 10 régions, le script :
  1. écrit tools/sequences/biome_<région>.json (décor vide du biome + même archer qu'ailleurs, 2 clés intermédiaires, 3 segments = 123 images ≈ 5 s à 24 i/s) ;
  2. lance `gm sequence` (étapes elements, base, keys, segments, stitch) vers sprites/ultimates-seq/biome_<région>/ ;
  3. saute les régions déjà terminées (px/preview.gif présent ; --force pour refaire).
Rangement dans le jeu : node tools/pack-ultimate-sequences.mjs (planches sprites/ultimates/biome_<région>-seq.png) ; lues par `playRegionDiscovery` (cinematics.js).

Le GPU n'a la place que pour un gros modèle : --after-ultimates attend la fin de run-ultimates.sh / gen-all-ultimate-sequences.py avant de commencer.
Prérequis (dans WSL) : ComfyUI lancé par `gm up pixel` (game-maker, GAME_MAKER_DIR). Durée : ≈ 40 à 70 min par région sur RTX 3060 Ti.

Usage (WSL) : python3 tools/gen-biome-intros.py [--only=volcan,mer] [--stage=prep|video|elements|base|keys|segments|stitch] [--respec] [--force] [--specs-only] [--after-ultimates]
"""
import sys, os, json, subprocess, time

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None

STYLE = ('pixel art, 16-bit pixel art illustration, ancient China mythology, epic cutscene, vertical composition, dramatic lighting, '
         'rich saturated colors, no text')
NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres'
ELEMENT_NEGATIVE = 'background, landscape, scenery, ground, shadow, text, border, frame'
HERO = ('a 30-year-old male archer in a red and gold tunic with a topknot, a recurve bow in his hand and a quiver of arrows on his back')
WARM = [255, 235, 170]

# Région : (fond d'écran sans personnage — ciel dégagé, chemin vide dans le tiers bas ; mouvements des 3 segments ; couleur de l'éclat ; fond uni du héros détouré)
REGIONS = {
    'rizieres': ('a dried rice paddy valley at dusk, cracked golden-brown mud terraces, scorched stalks, a red sun low on the horizon, a dirt path in the lower third',
                 ['dry dust and a few embers drift over the paddies, the sun flickers',
                  'the camera moves slowly forward along the path, heat haze ripples over the terraces',
                  'the archer looks at the burning horizon, the light grows warmer'], [255, 170, 90], 'cyan'),
    'volcan': ('a volcano landscape at night, rivers of glowing lava, black rock, a huge red glowing crater in the distance, an ash-covered path in the lower third',
               ['lava flows and bubbles, embers rise into the dark red sky',
                'the camera moves slowly forward, ash falls and the crater erupts with sparks',
                'the archer shields his face from the heat, the crater glows brighter'], [255, 120, 60], 'cyan'),
    'gobi': ('a vast desert at golden hour, endless sand dunes, a faint caravan silhouette far away, a rocky sand path in the lower third',
             ['wind blows sand off the crests of the dunes, the heat shimmers',
              'the camera moves slowly forward, a sand veil sweeps across the dunes',
              'the archer pulls his scarf against the wind, the sun glows'], [255, 215, 140], 'magenta'),
    'fleuve': ('the Yellow River at dawn, a wide muddy golden river with a wooden ferry and reed banks, a misty sky, a muddy bank path in the lower third',
               ['the river flows slowly, ripples spread, mist drifts over the water',
                'the camera moves slowly forward along the bank, reeds sway in the wind',
                'the archer gazes across the river, the sun rises through the mist'], [250, 220, 150], 'magenta'),
    'bambous': ('a dense bamboo forest in morning mist, tall green bamboo stalks, shafts of light, a stone path in the lower third',
                ['bamboo sways gently, mist drifts, leaves fall',
                 'the camera moves slowly forward along the path, light shafts shimmer',
                 'the archer stops and listens, fireflies of light float around'], [190, 240, 170], 'magenta'),
    'tonnerre': ('a stormy mountain range at dusk, dark purple thunderclouds, lightning striking the peaks, snowy rocks, a rocky snow path in the lower third',
                 ['dark clouds churn, lightning flashes across the sky, snow blows',
                  'the camera moves slowly forward, thunder strikes a distant peak',
                  'the archer braces against the storm, a bolt of lightning lights the scene'], [220, 210, 255], 'cyan'),
    'fauves': ('a golden savanna plain with tall grass and scattered rocks at sunset, a giant red sky, herds of beasts far away, a trampled grass path in the lower third',
               ['tall grass waves in the wind, a distant herd moves across the plain',
                'the camera moves slowly forward, birds cross the sky',
                'the archer scans the plains, the setting sun glows over the grass'], [255, 200, 120], 'magenta'),
    'mer': ('the Eastern Sea at dawn, a calm teal ocean with Chinese junk ships, jade-green cliffs, a stone pier in the lower third',
            ['waves roll and foam sparkles, seabirds glide, ships rock gently',
             'the camera moves slowly forward along the pier, waves crash on the rocks',
             'the archer looks out to sea, the sun glitters on the water'], [200, 240, 230], 'magenta'),
    'fusang': ('a giant sacred Fusang tree glowing at the edge of the world at sunrise, huge golden branches, a pink and orange sky full of light, a stone path in the lower third',
               ['golden leaves drift down from the giant tree, the branches glow',
                'the camera moves slowly forward, sun rays pulse through the branches',
                'the archer looks up at the tree, a golden light washes over him'], [255, 215, 110], 'cyan'),
    'lune': ('a high mountain peak at night under a huge full moon, silver clouds below, glowing moon-flowers, a pale stone path in the lower third',
             ['silver clouds drift below, stars twinkle, moonlight shimmers',
              'the camera moves slowly forward, glowing petals float up toward the moon',
              'the archer gazes at the moon, a pale silver glow rises'], [225, 235, 255], 'magenta'),
}


def build_spec(rid):
    plate, motions, color, bg = REGIONS[rid]
    glow = lambda cy, r, a: {'type': 'glow', 'cx': 0.5, 'cy': cy, 'r': r, 'color': color, 'alpha': a}
    return {
        'id': f'biome_{rid}',
        'style': f'pixel art, {STYLE}, recurring hero: {HERO}',
        'negative': NEGATIVE,
        'plate': plate,
        'style_plate': f'pixel art, {STYLE}',
        'hero_text': HERO,
        'hero_layout': {'w': 0.3, 'cx': 0.5, 'feet': 0.88, 'denoise': 0.3},
        'elements': {
            'hero': {'prompt': f'{HERO}, full body, standing, three-quarter view', 'w': 768, 'h': 1024, 'seed': 500,
                     'negative': ELEMENT_NEGATIVE + ', close-up, portrait, cropped', 'tries': 6, 'bg': bg},
        },
        'keys': [
            {'prompt': f'{plate}, {HERO}, {motions[1]}', 'denoise': 0.35, 'fx': [glow(0.45, 0.12, 90)]},
            {'prompt': f'{plate}, {HERO}, {motions[2]}', 'denoise': 0.4, 'fx': [glow(0.4, 0.22, 140)]},
        ],
        'segments': [
            {'frames': 49, 'motion': motions[0]},
            {'frames': 49, 'motion': motions[1]},
            {'frames': 25, 'motion': motions[2]},
        ],
    }


def wait_for_gpu():
    """Attend la fin des ultimes (même GPU, un seul gros modèle à la fois)."""
    pats = ['run-ultimates.sh', 'gen-all-ultimate-sequences.py']
    while subprocess.run(['pgrep', '-f', '|'.join(pats)], capture_output=True).returncode == 0:
        time.sleep(60)


if 'after-ultimates' in opts and 'specs-only' not in opts:
    print('attente de la fin des ultimes…', flush=True)
    wait_for_gpu()

done, failed = [], []
for rid in REGIONS:
    if ONLY and rid not in ONLY:
        continue
    uid = f'biome_{rid}'
    spec_path = os.path.join(GAME, 'tools', 'sequences', f'{uid}.json')
    if 'respec' in opts or not os.path.exists(spec_path):
        os.makedirs(os.path.dirname(spec_path), exist_ok=True)
        json.dump(build_spec(rid), open(spec_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f'spec : {spec_path}')
    if 'specs-only' in opts:
        continue
    out = os.path.join(GAME, 'sprites', 'ultimates-seq', uid)
    if os.path.exists(os.path.join(out, 'px', 'preview.gif')) and 'force' not in opts and 'stage' not in opts:
        print(f'SKIP {uid} (déjà généré)')
        continue
    t0 = time.time()
    print(f'=== {uid}', flush=True)
    cmd = [os.path.join(GAME_MAKER, 'gm'), 'sequence', spec_path, '--root', GAME, '--out', out] \
        + (['--force'] if 'force' in opts else []) + ([f"--only={opts['stage']}"] if 'stage' in opts else [])
    r = subprocess.run(cmd)
    (done if r.returncode == 0 else failed).append(uid)
    print(f'{"OK " if r.returncode == 0 else "ERR"} {uid} ({int((time.time() - t0) / 60)} min)', flush=True)
print(f'Terminé : {len(done)} ok, {len(failed)} échec(s) {failed or ""}')
