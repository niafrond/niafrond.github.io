#!/usr/bin/env python3
"""gen-summon-clips.py — Vraie animation de l'invoqué de chaque ultime (c'est lui, la chose vivante), avec game-maker.

Pour chaque ultime :
  1. l'invoqué détouré (sprites/ultimates-seq/<id>/elements/entity.png ; wolf_stand.png pour le Loup du Ciel) est posé au centre d'un cadre 480×832
     sur un fond uni dont la couleur est choisie la plus éloignée des couleurs du sujet ;
  2. Wan 2.2 14B image → vidéo (`gm video`) fait jouer deux segments de 49 images : 1) l'invoqué arrive et s'anime, 2) il passe à l'action
     (le segment 2 repart de la dernière image du segment 1, ramenée sur fond uni) ;
  3. chaque image est détourée par flood-fill de la couleur de fond (bords adoucis, teinte du fond retirée) → sprites/ultimates-seq/<id>/summon/fNNNN.png (RGBA 480×832, 97 images).
tools/gen-ultimate-acts.py compose ensuite ces images au-dessus du décor (l'échelle 480×832 → 144×256 est de 0,3 : l'invoqué garde sa taille).

Le GPU n'a la place que pour un gros modèle : lancer quand ComfyUI est libre (`gm up pixel`). ≈ 5 à 20 min par segment.
Usage (WSL) : python3 tools/gen-summon-clips.py [--only=ultimateSkyWolf,…] [--force] [--seed=N] [--rekey]   (--rekey : refait seulement le détourage)
"""
import sys, os, glob, shutil, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None
CW, CH = 480, 832
KEYS = {'green': (0, 255, 0), 'magenta': (255, 0, 255), 'cyan': (0, 230, 230), 'blue': (0, 60, 255), 'orange': (255, 120, 0), 'yellow': (255, 240, 0)}
KEY_HUE = {'green': 120, 'magenta': 300, 'cyan': 180, 'blue': 225, 'orange': 28, 'yellow': 58}   # teinte (degrés) de chaque fond uni
NEGATIVE = ('background, landscape, scenery, ground, floor, shadow, text, letters, watermark, blurry, scene cut, jump cut, camera movement, '
            'zoom, people, human, extra creatures, border, frame')

# id : cadre de l'invoqué (largeur, hauteur max en fraction du cadre 480×832 — comme `ent` de gen-ultimate-acts.py),
#      prompt du segment 1 (arrivée, il s'anime), prompt du segment 2 (action)
ULTIMATES = {
    'ultimateFiveElements': (
        'a colossal sacred world tree with a fire phoenix perched at its top, a water serpent coiled around its trunk, a tiger and a stone beast at its roots, '
        'glowing elemental energy flowing through the tree; the phoenix beats its wings, the serpent slithers up the trunk, the tiger breathes, leaves rustle',
        'the sacred tree blazes with all five elements: the phoenix takes off in a burst of flames, the serpent lunges down the trunk, the tiger roars and leaps, '
        'the branches whip, energy surges through the whole tree'),
    'ultimateHeavenlyThunder': (
        'a colossal thunder god with a drum ring and a lightning hammer, glowing yellow eyes, he breathes and his drums beat, lightning crackles around him',
        'the thunder god raises his lightning hammer high above his head and slams it down with a roar, lightning explodes around him'),
    'ultimateThousandArrows': (
        'a massive wall of glowing golden arrows hanging in the air, the arrows shimmer and tremble, light rays sweep across them',
        'all the golden arrows launch downward at once in a roaring volley, streaks of light, the wall of arrows rushes toward the ground'),
    'ultimateSunPiercer': (
        'a colossal blazing sun with a screaming face and a three-legged golden crow, the flames lick outward, the crow flaps its wings',
        'the blazing sun flares violently and the three-legged crow spreads its wings and dives forward, flames lash out'),
    'ultimateImperialDragon': (
        'a colossal golden Chinese imperial dragon coiling in the air, its body undulates, whiskers and mane flow, scales shimmer, glowing eyes',
        'the golden dragon roars and swoops forward in a powerful dive, its body whipping, claws extended, flames and light trailing'),
    'ultimateEternalBastion': (
        'a colossal ethereal great wall of glowing jade and blue light with giant guardian statues, light flows through the stones, the statues stir',
        'the great wall rises higher and the guardian statues raise their spears, a barrier of light surges upward'),
    'ultimateThousandRiders': (
        'a vast horde of steppe cavalrymen in lamellar armor on horses in front of a red palace and a big sun disc, red silk banners flapping, the horses begin to trot; '
        'everything outside the horde is a perfectly flat uniform solid color, no sky, no ground, no dust, no clouds, no smoke',
        'the cavalry charges forward at a full gallop, horses running, banners streaming; '
        'everything outside the horde stays a perfectly flat uniform solid color, no sky, no ground, no dust, no clouds, no smoke'),
    'ultimateSkyWolf': (
        'a colossal ethereal spirit wolf made of glowing blue-white stars and aurora light, it breathes, its mane and tail flow, stars twinkle inside its body',
        'the spirit wolf raises its head and howls, then lunges forward, aurora ribbons streaming behind it'),
    # ultimes de légende : les Quatre Gardiens Célestes
    'ultimateVermilionBird': (
        'a colossal vermilion phoenix with burning wings spread wide, its flame feathers flicker, its long tail streams like fire, embers rise from its body, it flaps its wings slowly',
        'the phoenix soars upward and bursts into a blazing fireball of rebirth, wings flaring wide, flames radiating outward in all directions'),
    'ultimateBlackTortoise': (
        'a colossal black tortoise with a serpent coiled around its shell, glowing cyan runes pulse on the shell, water streams down its sides, the serpent sways and hisses, the tortoise slowly raises its head',
        'the tortoise rears up and slams its huge shell forward, a shockwave of water surges outward, the runes blaze bright cyan, the serpent strikes'),
    'ultimateWhiteTiger': (
        'a colossal white tiger crouching low, its fur ripples, its muscles tense, its tail sways, its golden eyes glow, it breathes heavily with a low growl',
        'the white tiger roars and leaps forward in a huge pounce, claws extended, silver light streaking behind it'),
    'ultimateAzureDragon': (
        'a colossal azure Chinese dragon coiling in the air, its teal scales shimmer, its long whiskers and mane flow, a glowing pearl in its claw, its body undulates slowly',
        'the azure dragon roars and dives forward in a spiral, lightning crackling along its body, its mane whipping'),
}
ENTITY_FIT = {u: None for u in ULTIMATES}   # rempli depuis gen-ultimate-acts.py (même `ent`)


def entity_box(uid):
    src = open(os.path.join(GAME, 'tools', 'gen-ultimate-acts.py'), encoding='utf-8').read()
    i = src.index(f"'{uid}': dict(")
    j = src.index('ent=(', i) + 5
    a = [float(x) for x in src[j:src.index(')', j)].split(',')]
    return a[2], a[3]


def hsv(arr_rgb):
    """Teinte (degrés), saturation et valeur (0..1) d'un tableau RGB uint8."""
    h = np.array(Image.fromarray(arr_rgb, 'RGB').convert('HSV')).astype(np.float32)
    return h[..., 0] * 360 / 255, h[..., 1] / 255, h[..., 2] / 255


def hue_near(h, s_, v, key, tol=26, smin=0.38, vmin=0.22):
    d = np.abs((h - KEY_HUE[key] + 180) % 360 - 180)
    return (d < tol) & (s_ > smin) & (v > vmin)


def pick_key(rgb, alpha):
    """Fond uni dont la teinte est la moins présente dans le sujet (part des pixels saturés proches de cette teinte)."""
    h, s_, v = hsv(rgb)
    m = alpha > 200
    best, best_f = 'green', 9.0
    for name in KEYS:
        f = hue_near(h, s_, v, name)[m].mean() if m.any() else 0.0
        if f < best_f:
            best, best_f = name, f
    return best


def start_image(uid, out):
    """Invoqué détouré au centre d'un cadre 480×832 sur fond uni → (chemin, couleur du fond)."""
    el = os.path.join(out, 'elements')
    path = os.path.join(el, 'entity.png')
    if not os.path.exists(path):
        path = os.path.join(el, 'wolf_stand.png')
    ent = Image.open(path).convert('RGBA')
    fw, fh = entity_box(uid)
    s = min(CW * fw / ent.width, CH * fh / ent.height)
    ent = ent.resize((max(1, round(ent.width * s)), max(1, round(ent.height * s))), Image.LANCZOS)
    arr = np.array(ent)
    arr[..., 3] = np.where(arr[..., 3] > 40, 255, 0)   # alpha dur : pas de teinte du fond dans les pixels semi-transparents
    ent = Image.fromarray(arr, 'RGBA')
    key = pick_key(arr[..., :3], arr[..., 3])
    bg = Image.new('RGBA', (CW, CH), KEYS[key] + (255,))
    bg.alpha_composite(ent, ((CW - ent.width) // 2, (CH - ent.height) // 2))
    p = os.path.join(out, 'summon-start.png')
    bg.convert('RGB').save(p)
    return p, key


def keyed(img, key):
    """RGBA : le fond uni est retiré (partout où la teinte du fond est franche, y compris dans les trous du sujet), bords adoucis,
    teinte du fond retirée des pixels semi-transparents."""
    rgb8 = np.array(img.convert('RGB'))
    rgb = rgb8.astype(np.float32)
    kc = np.array(KEYS[key], np.float32)
    h, s_, v = hsv(rgb8)
    dist = np.sqrt(((rgb - kc) ** 2).sum(2))
    bg = hue_near(h, s_, v, key) | (dist < 60)
    near = hue_near(h, s_, v, key, tol=40, smin=0.25, vmin=0.15) | (dist < 110)   # voisinage du fond relié aux bords
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = ndimage.binary_opening(np.isin(lab, list(edge)) | bg, iterations=1)
    alpha = np.where(bgmask, 0.0, 1.0)
    alpha = np.clip(ndimage.gaussian_filter(alpha, 0.7) * 1.15 - 0.05, 0, 1)
    a3 = np.maximum(alpha, 1e-3)[..., None]
    clean = np.clip((rgb - (1 - a3) * kc) / a3, 0, 255)
    clean = np.where(alpha[..., None] > 0.98, rgb, clean)
    return Image.fromarray(np.dstack([clean, alpha * 255]).astype(np.uint8), 'RGBA')


def run_video(start, prompt, outdir, seed):
    shutil.rmtree(outdir, ignore_errors=True)
    os.makedirs(outdir)
    r = subprocess.run([os.path.join(GAME_MAKER, 'gm'), 'video', prompt + ', plain solid flat uniform background color, nothing else in the background, the subject stays centered, fixed camera', '--image', start,
                        '--model', 'flf', '--out', outdir, '--width', str(CW), '--height', str(CH), '--frames', '49', '--seed', str(seed)])
    files = sorted(glob.glob(os.path.join(outdir, '*.png')))
    if r.returncode != 0 or not files:
        raise SystemExit(f'génération vidéo échouée ({outdir})')
    return files


def render(uid, seed):
    out = os.path.join(GAME, 'sprites', 'ultimates-seq', uid)
    final = os.path.join(out, 'summon')
    if glob.glob(os.path.join(final, 'f*.png')) and 'force' not in opts and 'rekey' not in opts:
        print(f'SKIP {uid} (déjà généré)')
        return
    start, key = start_image(uid, out)
    p1, p2 = ULTIMATES[uid]
    seg1, seg2 = os.path.join(out, 'summon-raw1'), os.path.join(out, 'summon-raw2')
    if 'rekey' in opts and glob.glob(os.path.join(seg2, '*.png')):
        f1, f2 = sorted(glob.glob(os.path.join(seg1, '*.png'))), sorted(glob.glob(os.path.join(seg2, '*.png')))
    else:
        f1 = run_video(start, p1, seg1, seed)
        flat = keyed(Image.open(f1[-1]), key)   # le segment 2 repart de la dernière image, remise sur fond uni
        bg = Image.new('RGBA', (CW, CH), KEYS[key] + (255,))
        bg.alpha_composite(flat)
        nxt = os.path.join(out, 'summon-mid.png')
        bg.convert('RGB').save(nxt)
        f2 = run_video(nxt, p2, seg2, seed + 1)
    frames = f1 + f2[1:]
    shutil.rmtree(final, ignore_errors=True)
    os.makedirs(final)
    for i, f in enumerate(frames):
        keyed(Image.open(f), key).save(os.path.join(final, f'f{i:04d}.png'))
    print(f'OK   {uid} : {len(frames)} images, fond {key}', flush=True)


for n, uid in enumerate(ULTIMATES):
    if ONLY and uid not in ONLY:
        continue
    render(uid, int(opts.get('seed', 4200 + n * 11)))
