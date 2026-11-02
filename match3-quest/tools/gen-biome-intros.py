#!/usr/bin/env python3
"""gen-biome-intros.py — Boucles courtes jouées plein écran quand le héros arrive dans un nouveau biome (région).

Vue de côté, au loin : le biome occupe l'horizon, l'archer marche vers la droite (cycle de marche `archer_walk_right_*` du jeu) pendant que le
décor défile vers la gauche. Boucle parfaite : 96 images à 24 i/s (4 s), 144×256.
  1. panorama du biome (SDXL + Pixel Art XL via `gm image`, paysage 1344×768 vu de côté, sans personnage) → sprites/ultimates-seq/biome_<région>/pano.png ;
  2. panorama rendu sans couture (fondu des bords), défilement sur une période exacte, héros collé image par image → px/fNNNN.png + px/preview.gif.
Rangement : node tools/pack-ultimate-sequences.mjs (planches sprites/ultimates/biome_<région>-seq.png, `loop: true`), lues par `playRegionDiscovery` (cinematics.js).
Prérequis (WSL) : ComfyUI via `gm up pixel` (une seule image SDXL par région : ≈ 1 min). Pillow.
Option --flux : panorama par FLUX.2 Klein 4B (ComfyUI, texte → image) au lieu de SDXL : respecte bien mieux la vue de côté.
Usage : python3 tools/gen-biome-intros.py [--only=volcan,mer] [--force] [--repano] [--seed=N] [--flux]
"""
import sys, os, subprocess, glob, shutil, json, time, urllib.request, urllib.parse
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None
W, H, FRAMES, FPS, OVERLAP, HERO_SCALE, FEET = 144, 256, 96, 24, 64, 2, 238

STYLE = ('pixel art, 16-bit, full bleed edge to edge, 2D side-scrolling game background, flat orthographic side view, horizontal horizon line across the middle, '
         'a flat horizontal dirt path along the bottom, wide empty landscape, no people, no characters, ancient China mythology, rich colors')
NEGATIVE = ('person, human, character, figure, warrior, perspective, vanishing point, path leading to the horizon, top-down, from behind, '
            '3d render, realistic, photo, blurry, text, letters, watermark, border, frame, letterbox, black bars, gray bars, margin, vignette, poster')

# Région : décor du biome (au loin, à droite de l'horizon)
REGIONS = {
    'rizieres': 'flooded rice paddy terraces with green stalks and shallow water, water buffalo huts, a distant pagoda, a red sun low at dusk',
    'volcan': 'a volcano range at night with rivers of glowing lava, black rock, a huge red glowing crater in the distance, falling embers',
    'gobi': 'a vast desert at golden hour, endless sand dunes, a faint caravan silhouette far away',
    'fleuve': 'the Yellow River at dawn, a wide muddy golden river with a wooden ferry and reed banks, misty sky',
    'bambous': 'a dense bamboo forest in morning mist, tall green bamboo stalks, shafts of light',
    'tonnerre': 'a stormy mountain range at dusk, dark purple thunderclouds, lightning striking snowy peaks',
    'fauves': 'a golden savanna plain with tall grass and scattered rocks at sunset, a giant red sky, herds of beasts far away',
    'mer': 'the Eastern Sea at dawn, a calm teal ocean with Chinese junk ships, jade-green cliffs',
    'fusang': 'a giant sacred Fusang tree glowing at the edge of the world at sunrise, huge golden branches, pink and orange sky',
    'wandering_souls': 'a haunted Chinese ghost realm at midnight, very dark blue-black night sky with no sun, bare dark gray stone courtyard and black twisted dead tree roots, pale ghostly green spirit fire flames and white mist, floating red paper lanterns, a distant ruined black temple gate, cold gray and teal colors, eerie',
    'winter_lantern_mountain': 'a snowy Chinese mountain village at dusk seen from the side, a row of houses with curved dark tiled roofs capped with thick snow along the horizon, hundreds of glowing red and gold paper lanterns hanging on silk strings between the houses, warm orange lit windows, snow-covered pine trees, distant snowy mountains, a deep blue twilight sky with soft falling snowflakes, the flat path along the bottom is packed white snow',
    'lune': 'a high mountain peak at night under a huge full moon, silver clouds below, glowing moon-flowers',
}
SEEDS = {r: 3100 + i * 37 for i, r in enumerate(REGIONS)}


FLUX_STYLE = ('A 16-bit pixel art 2D side-scrolling video game background, strictly flat orthographic SIDE view like a platformer, a straight horizontal horizon, '
              'a flat horizontal path along the very bottom of the picture, wide empty landscape, no people, no characters, ancient China mythology, rich colors, crisp chunky pixels. ')


def flux_image(prompt, seed, dest, size=(1344, 768)):
    """Texte → image avec FLUX.2 Klein 4B dans ComfyUI (127.0.0.1:8188, `gm up pixel`) ; écrit le PNG dans dest."""
    base = 'http://127.0.0.1:8188'
    wf = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'flux-2-klein-base-4b-fp8.safetensors', 'weight_dtype': 'default'}},
        '3': {'class_type': 'CLIPLoaderGGUF', 'inputs': {'clip_name': 'Qwen_Qwen3-4B-Q8_0.gguf', 'type': 'flux2'}},
        '4': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'flux2-vae.safetensors'}},
        '8': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['3', 0], 'text': prompt}},
        '9': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['3', 0], 'text': NEGATIVE}},
        '12': {'class_type': 'EmptyFlux2LatentImage', 'inputs': {'width': size[0], 'height': size[1], 'batch_size': 1}},
        '13': {'class_type': 'Flux2Scheduler', 'inputs': {'steps': 28, 'width': size[0], 'height': size[1]}},
        '14': {'class_type': 'CFGGuider', 'inputs': {'model': ['1', 0], 'positive': ['8', 0], 'negative': ['9', 0], 'cfg': 4}},
        '15': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'euler'}},
        '16': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': int(seed)}},
        '17': {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['16', 0], 'guider': ['14', 0], 'sampler': ['15', 0], 'sigmas': ['13', 0], 'latent_image': ['12', 0]}},
        '18': {'class_type': 'VAEDecode', 'inputs': {'samples': ['17', 0], 'vae': ['4', 0]}},
        '19': {'class_type': 'SaveImage', 'inputs': {'images': ['18', 0], 'filename_prefix': 'match3-biome-intro/f'}},
    }
    req = urllib.request.Request(base + '/prompt', json.dumps({'prompt': wf}).encode(), {'Content-Type': 'application/json'})
    pid = json.load(urllib.request.urlopen(req))['prompt_id']
    while True:
        hist = json.load(urllib.request.urlopen(f'{base}/history/{pid}')).get(pid)
        if hist:
            break
        time.sleep(2)
    if hist['status']['status_str'] != 'success':
        raise SystemExit(f'FLUX a échoué : {hist["status"]}')
    img = next(i for o in hist['outputs'].values() for i in o.get('images', []))
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
    with open(dest, 'wb') as f:
        f.write(urllib.request.urlopen(f'{base}/view?{q}').read())


def panorama(rid, out):
    pano = os.path.join(out, 'pano.png')
    if os.path.exists(pano) and 'repano' not in opts and 'force' not in opts:
        return pano
    os.makedirs(out, exist_ok=True)
    prompt = f'{STYLE}, {REGIONS[rid]}'
    if 'flux' in opts:
        flux_image(FLUX_STYLE + REGIONS[rid], opts.get('seed', SEEDS[rid]), pano)
        return pano
    tmp = os.path.join(out, 'raw')
    shutil.rmtree(tmp, ignore_errors=True)
    subprocess.run([os.path.join(GAME_MAKER, 'gm'), 'image', prompt, '--out', tmp, '--name', 'pano', '--size', '1344x768', '--negative', NEGATIVE,
                    '--seed', str(opts.get('seed', SEEDS[rid]))], check=True)
    found = sorted(glob.glob(os.path.join(tmp, '**', '*.png'), recursive=True))
    if not found:
        raise SystemExit(f'{rid} : aucune image générée')
    shutil.copyfile(found[0], pano)
    return pano


def crop_bars(im):
    """Retire les bandes unies (haut, bas, côtés) que SDXL ajoute parfois autour du paysage."""
    g = im.convert('L')
    def span(line, n):
        v = [line(i) for i in range(n)]
        lo, hi = 0, n
        while lo < hi - 1 and v[lo] < 14: lo += 1
        while hi > lo + 1 and v[hi - 1] < 14: hi -= 1
        return lo, hi
    rng = lambda box: (lambda lo, hi: hi - lo)(*g.crop(box).getextrema())
    top, bot = span(lambda y: rng((0, y, g.width, y + 1)), g.height)
    left, right = span(lambda x: rng((x, top, x + 1, bot)), g.width)
    return im.crop((left, top, right, bot)) if bot - top >= 256 and right - left >= 400 else im


def seamless_tile(pano_path):
    """Panorama à la hauteur du cadre, bords fondus : la bande se répète sans couture (période = largeur − recouvrement)."""
    im = Image.open(pano_path).convert('RGB')
    im = crop_bars(im)
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    period = im.width - OVERLAP
    tile = im.crop((0, 0, period, H))
    head, tail = im.crop((0, 0, OVERLAP, H)), im.crop((period, 0, im.width, H))
    tile.paste(Image.blend(tail, head, 0.5), (0, 0))   # approximation : valeur de repli, remplacée colonne par colonne ci-dessous
    for x in range(OVERLAP):
        a = x / OVERLAP   # 0 : bord de la répétition précédente (queue), 1 : début du panorama
        col = Image.blend(tail.crop((x, 0, x + 1, H)), head.crop((x, 0, x + 1, H)), a)
        tile.paste(col, (x, 0))
    return tile


def render(rid):
    out = os.path.join(GAME, 'sprites', 'ultimates-seq', f'biome_{rid}')
    px = os.path.join(out, 'px')
    if os.path.exists(os.path.join(px, 'preview.gif')) and 'force' not in opts and 'repano' not in opts:
        print(f'SKIP biome_{rid} (déjà généré)')
        return
    tile = seamless_tile(panorama(rid, out))
    P = tile.width
    hero = [Image.open(os.path.join(GAME, 'sprites', 'png', f'archer_walk_right_{i}.png')).convert('RGBA') for i in range(3)]
    hero = [h.resize((h.width * HERO_SCALE, h.height * HERO_SCALE), Image.NEAREST) for h in hero]
    shutil.rmtree(px, ignore_errors=True)
    os.makedirs(px)
    frames = []
    for f in range(FRAMES):
        off = round(f * P / FRAMES)
        strip = Image.new('RGB', (W + P, H))
        strip.paste(tile, (0, 0)); strip.paste(tile, (P, 0))
        fr = strip.crop((off, 0, off + W, H)).convert('RGBA')
        sp = hero[[0, 1, 2, 1][(f // 6) % 4]]
        fr.alpha_composite(sp, ((W - sp.width) // 2, FEET - sp.height))
        frames.append(fr.convert('RGB'))
    pal = frames[0].quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
    for f, fr in enumerate(q):
        fr.convert('RGB').save(os.path.join(px, f'f{f:04d}.png'))
    q[0].save(os.path.join(px, 'preview.gif'), save_all=True, append_images=q[1:], duration=round(1000 / FPS), loop=0)
    print(f'OK   biome_{rid} : {FRAMES} images, période {P}px', flush=True)


for rid in REGIONS:
    if ONLY and rid not in ONLY:
        continue
    render(rid)
