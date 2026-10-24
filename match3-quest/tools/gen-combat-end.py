#!/usr/bin/env python3
"""gen-combat-end.py — Boucles plein écran des écrans de fin de combat : Victoire et Défaite (derrière le mot VICTOIRE / DÉFAITE, game.js).

  - victoire : un feu d'artifice au-dessus d'une ville en fête, de nuit (fusées qui montent, éclatements dorés / rouges / cyan / roses / blancs avec
    traînées et retombées d'étincelles, lueur de chaque éclatement sur le décor) ;
  - défaite : un cœur qui ne bat presque plus dans une salle de pierre sombre (deux battements faibles puis un long silence, lueur rouge qui
    vacille, tracé de pouls quasi plat, cendres qui tombent).
  Aucun personnage. 1. décor (SDXL + Pixel Art XL via `gm image`, portrait) → sprites/ultimates-seq/combatend_<issue>/bg.png ;
  2. animation en boucle parfaite (96 images à 24 i/s = 4 s, 144×256) composée image par image → px/fNNNN.png + px/preview.gif.
Rangement : node tools/pack-ultimate-sequences.mjs (planches sprites/ultimates/combatend_<issue>-seq.png, `loop: true`), lues par game.js.
Prérequis (WSL) : ComfyUI via `gm up pixel` (une image SDXL par issue : ≈ 1 min). Pillow.
Usage : python3 tools/gen-combat-end.py [--only=victory,defeat] [--force (refaire les images)] [--regen-bg (refaire aussi le décor, GPU)] [--seed=N]
"""
import sys, os, math, glob, shutil, subprocess, random
from PIL import Image, ImageDraw, ImageEnhance

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else ['victory', 'defeat']
W, H, FRAMES, FPS = 144, 256, 96, 24

STYLE = 'pixel art, 16-bit, vertical portrait composition, ancient China mythology, rich colors, no people, no characters, no text'
NEGATIVE = ('person, human, character, figure, warrior, animal, fireworks, 3d render, realistic, photo, blurry, text, letters, watermark, border, frame, '
            'letterbox, black bars, gray bars, margin, vignette, poster, ui')
SCENES = {
    'victory': dict(
        prompt='a night sky over an ancient Chinese festival town, dark silhouettes of pagoda rooftops and red paper lanterns along the very bottom, '
               'deep indigo starry sky with a huge empty dark sky in the upper two thirds, festive and joyful, calm',
        seed=4410),
    'defeat': dict(
        prompt='a dark empty stone chamber seen from the front, cracked grey stone floor, empty center, deep shadows on the walls, cold dim light, '
               'a faint red glow from the bottom, heavy somber silence, desaturated colors',
        seed=9903),
}

# Cœur pixel art (16×14) : 1 = contour, 2 = chair, 3 = reflet, 4 = fissure
HEART = [
    '..1111....1111..',
    '.122221..122221.',
    '12233221122222 1'.replace(' ', ''),
    '1223322222222221',
    '1222222222222221',
    '1222222242222221',
    '.12222224222221.',
    '.1222222422221..'.replace('..', '.', 1),
    '..122222422221..',
    '...1222242221...',
    '....12222221....',
    '.....122221.....',
    '......1221......',
    '.......11.......',
]


def background(rid, out):
    bg = os.path.join(out, 'bg.png')
    if os.path.exists(bg) and 'regen-bg' not in opts:
        return Image.open(bg).convert('RGB')
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, 'raw')
    shutil.rmtree(tmp, ignore_errors=True)
    subprocess.run([os.path.join(GAME_MAKER, 'gm'), 'image', f"{STYLE}, {SCENES[rid]['prompt']}", '--out', tmp, '--name', 'bg', '--size', '768x1344',
                    '--negative', NEGATIVE, '--seed', str(opts.get('seed', SCENES[rid]['seed']))], check=True)
    found = sorted(glob.glob(os.path.join(tmp, '**', '*.png'), recursive=True))
    if not found:
        raise SystemExit(f'{rid} : aucune image générée')
    im = Image.open(found[0]).convert('RGB')
    # recadrage plein cadre au rapport 144:256, puis réduction et palette limitée (rendu pixel art)
    w, h = im.size
    tw = int(h * W / H)
    im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h)).resize((W, H), Image.LANCZOS)
    im = im.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    im.save(bg)
    return im


def cycle(i, k=1):
    return math.sin(2 * math.pi * k * i / FRAMES)


# ───────────── Victoire : feu d'artifice ─────────────
COLORS = [(255, 214, 90), (255, 96, 80), (96, 232, 255), (255, 140, 210), (255, 255, 240), (150, 255, 140)]
# (image de l'éclatement, x, y, couleur, rayon, particules) : réparties sur la boucle, durée de vie 46 images, montée 14 images
BURSTS = [(10, 40, 80, 0, 64, 44), (28, 104, 60, 1, 56, 40), (46, 72, 108, 2, 70, 48), (64, 28, 132, 3, 52, 38), (80, 112, 116, 4, 60, 42)]
LIFE, RISE = 52, 14


def firework_layer(i, rnd_seed=77):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for n, (t0, bx, by, ci, radius, count) in enumerate(BURSTS):
        col = COLORS[ci]
        dt = (i - t0) % FRAMES
        rise = (i - (t0 - RISE)) % FRAMES
        if rise < RISE:                                   # fusée : monte de la base avec une traînée
            k = rise / RISE
            y = H - 8 - (H - 8 - by) * (1 - (1 - k) ** 2)
            for s in range(7):
                yy = y + s * 3
                a = max(0, 200 - s * 30)
                d.point((bx + (1 if s % 2 else 0), int(yy)), fill=(255, 230, 170, a))
            d.rectangle([bx, int(y) - 1, bx, int(y)], fill=(255, 255, 255, 255))
        if dt < LIFE:
            rnd = random.Random(rnd_seed + n * 101)
            life = dt / LIFE
            if dt < 5:                                    # flash de l'éclatement : lueur sur le décor
                gd.ellipse([bx - 52, by - 52, bx + 52, by + 52], fill=col + (int(150 * (1 - dt / 5)),))
            for p in range(count):
                ang = 2 * math.pi * p / count + rnd.uniform(-0.08, 0.08)
                sp = radius * rnd.uniform(0.72, 1.0)
                for tail in range(4):                      # particule + traînée (positions précédentes, plus sombres)
                    tt = max(0.0, life - tail * 0.018)
                    ease = 1 - (1 - tt) ** 2.2
                    x = bx + math.cos(ang) * sp * ease
                    y = by + math.sin(ang) * sp * ease + 22 * tt * tt   # la gravité les fait retomber
                    a = int(max(0, 1 - life ** 1.6) * (255 - tail * 70))
                    if tail == 0 and dt % 3 == p % 3 and life > 0.45:
                        a = a // 3                         # scintillement en fin de course
                    if a > 8:
                        c = col if tail < 2 else tuple(int(v * 0.7) for v in col)
                        d.rectangle([int(x), int(y), int(x) + (1 if tail < 2 and life < 0.7 else 0), int(y) + (1 if tail < 2 and life < 0.7 else 0)], fill=c + (a,))
                        if tail == 0 and life < 0.5:
                            d.point((int(x) + 1, int(y)), fill=c + (a // 2,))
    return layer, glow


def compose_victory(bg, i):
    z = 1.0 + 0.012 * (0.5 + 0.5 * cycle(i))                # très légère respiration du décor
    zw, zh = int(W * z), int(H * z)
    base = bg.resize((zw, zh), Image.NEAREST).crop(((zw - W) // 2, (zh - H) // 2, (zw - W) // 2 + W, (zh - H) // 2 + H)).convert('RGBA')
    base = ImageEnhance.Brightness(ImageEnhance.Color(base).enhance(0.8)).enhance(0.5)   # ciel plus sombre : les éclatements ressortent
    fw, glow = firework_layer(i)
    base = Image.alpha_composite(base, glow)
    return Image.alpha_composite(base, fw).convert('RGB')


# ───────────── Défaite : un cœur qui ne bat presque plus ─────────────
HEART_COL = {'1': (36, 8, 16), '2': (150, 26, 40), '3': (214, 90, 96), '4': (52, 12, 22)}
BEATS = [(10, 1.0), (22, 0.55)]   # (image, force) : un battement faible, un second plus faible encore, puis un long silence (74 images)


def beat_amount(i):
    """Intensité du battement à l'image i (0..1) : montée rapide, retombée douce, sur la période de la boucle."""
    amt = 0.0
    for t0, force in BEATS:
        dt = (i - t0) % FRAMES
        if dt < 12:
            amt = max(amt, force * math.sin(math.pi * dt / 12) ** 1.5)
    return amt


def heart_image(beat, dim):
    rows = [r.ljust(16, '.')[:16] for r in HEART]
    im = Image.new('RGBA', (16, 14), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in HEART_COL:
                r, g, b = HEART_COL[ch]
                im.putpixel((x, y), (int(r * dim), int(g * dim), int(b * dim), 255))
    s = 4 + (1 if beat > 0.5 else 0)          # le cœur gonfle d'un pixel au battement le plus fort
    return im.resize((16 * s, 14 * s), Image.NEAREST)


def compose_defeat(bg, ps, i):
    base = ImageEnhance.Color(bg).enhance(0.5)
    base = ImageEnhance.Brightness(base).enhance(0.62).convert('RGBA')
    beat = beat_amount(i)
    flick = 0.5 + 0.5 * cycle(i, 3)
    cx, cy = W // 2, int(H * 0.46)
    # lueur rouge derrière le cœur : faible, qui vacille, plus vive au battement
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in [(70, 14), (52, 20), (36, 28)]:
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(190, 24, 40, int(a * (0.55 + 0.25 * flick + 0.9 * beat))))
    base = Image.alpha_composite(base, glow)
    heart = heart_image(beat, 0.5 + 0.28 * beat + 0.05 * flick)
    base.alpha_composite(heart, (cx - heart.width // 2, cy - heart.height // 2))
    d = ImageDraw.Draw(base)
    # tracé de pouls : quasi plat, un petit sursaut au battement, qui défile lentement vers la gauche
    y0 = int(H * 0.80)
    pts = []
    for x in range(W):
        ph = (x + i * 1.5) % W
        yv = y0
        for t0, force in BEATS:
            bx = (t0 / FRAMES * W * 1.5) % W
            dx = (ph - bx) % W
            if 0 <= dx < 10:
                yv -= int(math.sin(dx / 10 * math.pi * 2) * 9 * force)
        pts.append((x, yv))
    d.line(pts, fill=(200, 40, 52, 255), width=1)
    d.line([(x, y + 1) for x, y in pts], fill=(90, 18, 28, 255), width=1)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for p in ps:                               # cendres grises qui tombent, quelques braises
        t = (i / FRAMES) * p['speed']
        y = (p['y0'] + t * H * 0.7) % H
        x = (p['x'] + math.sin(2 * math.pi * (i / FRAMES) * p['speed'] + p['ph']) * p['drift']) % W
        col = (220, 70, 48, 230) if p['tint'] > 0.86 else (168, 162, 180, 190)
        ld.rectangle([int(x), int(y), int(x) + p['size'] - 1, int(y) + p['size'] - 1], fill=col)
    base = Image.alpha_composite(base, layer)
    return base.convert('RGB')


def particles(rnd):
    return [dict(x=rnd.uniform(0, W), y0=rnd.uniform(0, H), speed=rnd.choice([1, 1, 2]), size=rnd.choice([1, 1, 2]), ph=rnd.uniform(0, 6.28),
                 drift=rnd.uniform(3, 9), tint=rnd.random()) for _ in range(46)]


def build(rid):
    out = os.path.join(GAME, 'sprites', 'ultimates-seq', f'combatend_{rid}')
    px = os.path.join(out, 'px')
    if os.path.exists(os.path.join(px, 'preview.gif')) and 'force' not in opts:
        print(f'SKIP {rid} : déjà généré (--force pour refaire)')
        return
    bg = background(rid, out)
    shutil.rmtree(px, ignore_errors=True)
    os.makedirs(px)
    ps = particles(random.Random(6262))
    frames = [compose_victory(bg, i) if rid == 'victory' else compose_defeat(bg, ps, i) for i in range(FRAMES)]
    # palette commune à toutes les images (255 couleurs, mosaïque d'échantillons) : planche indexée, ≈ 4× plus légère (pack-ultimate-sequences.mjs)
    sample = Image.new('RGB', (W * 8, H * 2))
    for k, i in enumerate(range(0, FRAMES, 6)):
        sample.paste(frames[i], ((k % 8) * W, (k // 8) * H))
    pal = sample.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    frames = [f.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB') for f in frames]
    for i, f in enumerate(frames):
        f.save(os.path.join(px, f'f{i:04d}.png'))
    frames[0].save(os.path.join(px, 'preview.gif'), save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0)
    print(f'OK   {rid} : {FRAMES} images, {W}×{H}')


for r in ONLY:
    build(r)
