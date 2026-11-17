#!/usr/bin/env python3
"""gen-ultimate-acts.py — Animations en trois actes des 8 ultimes, dans la direction artistique des boucles de biome (gen-biome-intros.py).

Plan large, pas un panorama : un décor pixel art vu de loin (SDXL + Pixel Art XL via `gm image`, portrait 768×1344, ciel dégagé),
l'entité du sort (cutout `sprites/ultimates-seq/<id>/elements/entity.png`, déjà générée) rendue vivante (respiration, ondulation, balancement, scintillement),
les particules et éclairs du sort. Aucun héros à l'écran : seulement le décor et l'effet.
Une seule prise en trois actes (arrivée de l'invocation, mouvement de l'invoqué, explosion du sort) : 192 images à 24 i/s (8 s), 144×256 → sprites/ultimates-seq/<id>/px/fNNNN.png + px/preview.gif
(les anciens plans-séquences Wan sont rangés dans px-wan/). Rangement : node tools/pack-ultimate-sequences.mjs.

Prérequis (WSL) : ComfyUI via `gm up pixel` (une image SDXL par ultimate, ≈ 1 min). Pillow.
Usage : python3 tools/gen-ultimate-acts.py [--only=ultimateSunPiercer,…] [--force] [--replate] [--plates-only] [--seed=N]
"""
import sys, os, subprocess, glob, shutil, math, random
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageOps

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None
W, H, FPS = 144, 256, 24
CLIP_W, CLIP_H, CLIP_K = 480, 832, 0.3   # cadre des clips de l'invoqué (tools/gen-summon-clips.py) et échelle vers 144×256
# Trois actes, une seule prise : 1 arrivée de l'invocation, 2 mouvement de l'invoqué, 3 explosion du sort (8 s, pas de boucle)
ARRIVAL, EXP_START, N = 48, 112, 192
EXPLOSION_LEN = N - EXP_START

STYLE = ('pixel art, 16-bit, full bleed edge to edge, epic wide establishing shot seen from far away, ancient China mythology, '
         'dramatic lighting, rich saturated colors, huge sky, empty center of the sky, ground in the lower part, nobody in the scene, no creatures, no figures, no statues in the sky, clean composition')
NEGATIVE = ('person, human, character, figure, warrior, archer, creature, monster, dragon, text, letters, watermark, border, frame, letterbox, '
            'black bars, gray bars, margin, vignette, poster, 3d render, realistic, photo, blurry')

# id : classe du héros, décor (plan large, sans personnage), entité (cadre x, y, largeur max, hauteur max, en fraction du cadre ; bob = amplitude px),
#      mouvement de l'invoqué (dive : plonge sur la cible, grow : enfle, charge : fonce vers la caméra avec une foule de copies), couleur du halo / de l'éclat, particules [(type, couleur, nombre, cycles par boucle)], éclairs (couleur) ou None
ULTIMATES = {
    'ultimateFiveElements': dict(neg='pagoda, tower, temple, building, stairs, buildings in the center', move='grow', cls='sorcerer', plate='an empty sacred stone altar plateau at night, a vast starry sky with swirling cosmic clouds and drifting embers, a huge glowing circle of five colored runes (red, blue, green, yellow, white) engraved on the stone ground in the foreground, nothing in the center of the sky',
                                 ent=(0.5, 0.42, 1.0, 0.8), glow=(190, 150, 255), bob=2, parts=[('rise', (255, 190, 90), 40, 1), ('rise', (130, 220, 255), 24, 2)], bolts=None),
    'ultimateHeavenlyThunder': dict(move='dive', cls='sorcerer', plate='a lone mountain summit at night, dark purple storm clouds swirling in a vast sky, distant jagged peaks, a rocky ledge in the foreground, a faint lightning glow inside the clouds',
                                    ent=(0.5, 0.3, 0.95, 0.55), glow=(255, 240, 140), bob=2, parts=[('rain', (200, 190, 255), 30, 2)], bolts=(255, 250, 200)),
    'ultimateThousandArrows': dict(move='dive', cls='assassin', plate='a cliff edge under a dark crimson sky with red and gold clouds, a lone twisted pine tree, a rocky ledge in the foreground, vast open sky',
                                   ent=(0.5, 0.33, 0.95, 0.6), glow=(255, 200, 80), bob=1, parts=[('fall', (255, 215, 90), 36, 2), ('rise', (255, 120, 60), 18, 1)], bolts=None),
    'ultimateSunPiercer': dict(move='grow', cls='assassin', plate='a high cliff at dawn under a red-orange sky, far mountain ranges in a warm haze, a rocky ledge in the foreground, vast open sky',
                               ent=(0.5, 0.3, 0.9, 0.55), glow=(255, 170, 60), bob=2, parts=[('rise', (255, 200, 80), 36, 1), ('rise', (255, 90, 40), 24, 2)], bolts=None),
    'ultimateImperialDragon': dict(move='dive', cls='templar', plate='an imperial Chinese palace courtyard with pagodas and stone stairs under a stormy golden sky, vast open sky above',
                                   ent=(0.5, 0.36, 0.98, 0.66), glow=(255, 210, 90), bob=3, parts=[('rise', (255, 225, 120), 40, 1)], bolts=None),
    'ultimateEternalBastion': dict(move='grow', cls='templar', plate='a Chinese stone watchtower on a hill at dusk under a deep blue sky, ancient fortress walls in the distance, glowing blue-green seal-script runes on the stone ground in the foreground',
                                   ent=(0.5, 0.36, 0.98, 0.62), glow=(110, 230, 200), bob=1, parts=[('rise', (140, 255, 220), 36, 1), ('rise', (200, 255, 255), 18, 2)], bolts=None),
    'ultimateThousandRiders': dict(move='charge', cls='barbarian', plate='a vast dusty steppe at sunset near the Great Wall, a red sky with a huge red sun low over the horizon, rolling plains, flat dusty ground in the foreground',
                                   ent=(0.5, 0.4, 0.98, 0.5), glow=(255, 150, 70), bob=2, parts=[('dust', (255, 200, 140), 36, 3)], bolts=None),
    'ultimateSkyWolf': dict(move='dive', cls='barbarian', plate='a snowy mountain summit at night under a huge full moon, purple and teal aurora across the sky, snowy peaks, a flat snowy ledge in the foreground',
                            ent=(0.5, 0.36, 0.98, 0.6), glow=(170, 200, 255), bob=2, parts=[('rise', (200, 220, 255), 36, 1), ('fall', (255, 255, 255), 24, 1)], bolts=None),
    # ultimes de légende : les Quatre Gardiens Célestes
    'ultimateVermilionBird': dict(move='grow', cls='legend', plate='a volcanic cliff at dusk, rivers of glowing lava far below, a crimson sky with drifting embers and ash clouds, a dark basalt ledge in the foreground, vast open sky',
                                  ent=(0.5, 0.34, 0.95, 0.6), glow=(255, 120, 60), bob=2, parts=[('rise', (255, 170, 70), 40, 1), ('rise', (255, 90, 40), 24, 2)], bolts=None),
    'ultimateBlackTortoise': dict(move='grow', cls='legend', plate='a misty great river delta at night under a deep blue sky and a pale moon, still black water reflecting the stars, a stone shore in the foreground, vast open sky',
                                  ent=(0.5, 0.4, 0.98, 0.6), glow=(90, 200, 230), bob=1, parts=[('fall', (120, 220, 255), 30, 2), ('rise', (200, 255, 255), 18, 1)], bolts=None),
    'ultimateWhiteTiger': dict(move='dive', cls='legend', plate='a vast autumn savanna at twilight with golden grass under a silver moon and a pale lavender sky, a rocky outcrop in the foreground, vast open sky',
                               ent=(0.5, 0.36, 0.98, 0.55), glow=(230, 235, 255), bob=2, parts=[('rise', (255, 255, 255), 30, 1), ('fall', (190, 210, 255), 20, 2)], bolts=None),
    'ultimateAzureDragon': dict(move='dive', cls='legend', plate='ancient Chinese sacred mountain peaks piercing a sea of teal storm clouds at dawn, a sacred cypress on a rocky ledge in the foreground, vast open sky',
                                ent=(0.5, 0.3, 0.95, 0.62), glow=(80, 220, 200), bob=2, parts=[('rise', (150, 255, 230), 36, 1), ('fall', (180, 240, 255), 24, 2)], bolts=(200, 255, 245)),
}
SEEDS = {u: 7100 + i * 53 for i, u in enumerate(ULTIMATES)}


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
    return im.crop((left, top, right, bot)) if bot - top >= 400 and right - left >= 240 else im


def plate(uid, out):
    path = os.path.join(out, 'plate.png')
    if os.path.exists(path) and 'replate' not in opts:
        return Image.open(path).convert('RGB')
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, 'raw-plate')
    shutil.rmtree(tmp, ignore_errors=True)
    subprocess.run([os.path.join(GAME_MAKER, 'gm'), 'image', f"{STYLE}, {ULTIMATES[uid]['plate']}", '--out', tmp, '--name', 'plate',
                    '--size', '768x1344', '--negative', NEGATIVE + ', ' + ULTIMATES[uid].get('neg', ''), '--seed', str(opts.get('seed', SEEDS[uid]))], check=True)
    found = sorted(glob.glob(os.path.join(tmp, '**', '*.png'), recursive=True))
    if not found:
        raise SystemExit(f'{uid} : aucun décor généré')
    shutil.copyfile(found[0], path)
    return Image.open(path).convert('RGB')


def fit(im, box_w, box_h):
    s = min(box_w / im.width, box_h / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def glow_layer(color, r, alpha):
    """Halo radial additif (RGB déjà multiplié par l'intensité)."""
    d = 2 * r
    g = Image.new('RGB', (d, d))
    px = g.load()
    for y in range(d):
        for x in range(d):
            k = max(0.0, 1 - math.hypot(x - r, y - r) / r) ** 2 * alpha
            px[x, y] = (int(color[0] * k), int(color[1] * k), int(color[2] * k))
    return g


def add(base, layer, pos):
    box = (pos[0], pos[1], pos[0] + layer.width, pos[1] + layer.height)
    x0, y0 = max(0, box[0]), max(0, box[1])
    x1, y1 = min(base.width, box[2]), min(base.height, box[3])
    if x1 <= x0 or y1 <= y0:
        return
    sub = base.crop((x0, y0, x1, y1))
    lay = layer.crop((x0 - box[0], y0 - box[1], x1 - box[0], y1 - box[1]))
    base.paste(ImageChops.add(sub, lay), (x0, y0))


def bolt(rng, x0, y_end):
    pts, x, y = [(x0, 0)], x0, 0
    while y < y_end:
        y += rng.randint(8, 18)
        x += rng.randint(-9, 9)
        pts.append((x, min(y, y_end)))
    return pts


def rays_layer(color, n=14, r=170, alpha=0.55):
    """Rayons de lumière (secteurs alternés) autour du centre, additifs ; tournent d'un secteur par boucle."""
    d = 2 * r
    lay = Image.new('L', (d, d), 0)
    return lay


def ray_image(color, rot, alpha, r=170, n=14):
    d = 2 * r
    m = Image.new('L', (d, d), 0)
    dr = ImageDraw.Draw(m)
    for i in range(n):
        a0 = rot + i * 2 * math.pi / n
        a1 = a0 + math.pi / n * 0.55
        dr.polygon([(r, r), (r + math.cos(a0) * r * 1.2, r + math.sin(a0) * r * 1.2), (r + math.cos(a1) * r * 1.2, r + math.sin(a1) * r * 1.2)], fill=255)
    fade = Image.new('L', (d, d))
    fp = fade.load()
    for y in range(d):
        for x in range(d):
            fp[x, y] = int(255 * max(0.0, 1 - math.hypot(x - r, y - r) / r) ** 1.3)
    m = ImageChops.multiply(m, fade).filter(ImageFilter.GaussianBlur(1.2))
    rgb = Image.merge('RGB', [m.point(lambda v, c=c: int(v * c / 255 * alpha)) for c in color])
    return rgb


def vignette():
    v = Image.new('L', (W, H))
    p = v.load()
    for y in range(H):
        for x in range(W):
            k = min(1.0, (math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) - 0.55) / 0.75)
            p[x, y] = int(255 * (1 - 0.55 * max(0.0, k)))
    return v


class Particles:
    """Particules déterministes qui bouclent exactement : position = f(image) modulo la hauteur, `cycles` tours par boucle."""

    def __init__(self, kind, color, n, cycles, seed):
        r = random.Random(seed)
        self.kind, self.color, self.cycles = kind, color, cycles
        self.p = [(r.uniform(0, W), r.uniform(0, H), r.uniform(0.6, 1.4), r.uniform(0, 6.28)) for _ in range(n)]

    def draw(self, d, f):
        for x0, y0, sp, ph in self.p:
            t = f / N * self.cycles   # nombre entier de tours par boucle : bouclage exact
            if self.kind == 'rise':
                x, y, w, h = x0 + math.sin(t * 6.28 + ph) * 3, (y0 - t * H) % H, 1, 1
            elif self.kind == 'fall':
                x, y, w, h = x0, (y0 + t * H * 1.5) % H, 1, 4
            elif self.kind == 'rain':
                x, y, w, h = (x0 - t * H * 0.4) % W, (y0 + t * H * 1.5) % H, 1, 5
            elif self.kind == 'spark':   # éclat : croix brillante qui scintille
                x, y, w, h = x0, (y0 - t * H * 0.5) % H, 2, 2
            else:   # dust : filets horizontaux qui passent de droite à gauche
                x, y, w, h = (x0 - t * W * 1.5) % W, y0, 4, 1
            x, y = int(x), int(y)
            d.rectangle((x, y, x + w - 1, y + h - 1), fill=self.color)


def alive(ent, f, power, seed):
    """Fait vivre l'invoqué (cutout fixe) : respiration, ondulation de bas en haut comme porté par le vent, balancement autour des pieds,
    pulsation de luminosité. L'agitation croît avec la puissance du sort (`power`)."""
    w, h = ent.size
    pad = 8
    ph = seed * 1.7
    amp = (1.1 + 1.3 * power) * (w / 140)
    out = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    for y in range(h):   # ondulation par rangées : plus forte vers le bas (étoffes, flammes, queues), phase qui monte avec le temps
        k = y / h
        dx = amp * (0.25 + 0.75 * k) * math.sin(2 * math.pi * (y / 26.0) - f * 0.30 + ph) + 0.6 * amp * math.sin(f * 0.11 + ph) * (1 - k)
        out.paste(ent.crop((0, y, w, y + 1)), (pad + round(dx), pad + y))
    breath = math.sin(f * 0.16 + ph)
    sx, sy = 1 - 0.012 * breath * power, 1 + 0.03 * breath * (0.6 + 0.4 * power)   # respiration : s'étire en inspirant
    out = out.resize((max(1, round(out.width * sx)), max(1, round(out.height * sy))), Image.BICUBIC)
    out = out.rotate(2.0 * math.sin(f * 0.09 + ph) * (0.5 + 0.5 * power), resample=Image.BICUBIC, center=(out.width / 2, out.height * 0.92))
    bright = 1 + 0.10 * math.sin(f * 0.45 + ph) + 0.06 * math.sin(f * 1.1)   # scintillement de la matière
    rgb = out.convert('RGB').point(lambda v, b=bright: min(255, int(v * b)))
    rgb.putalpha(out.split()[3])
    return rgb


def render(uid):
    cfg = ULTIMATES[uid]
    out = os.path.join(GAME, 'sprites', 'ultimates-seq', uid)
    px = os.path.join(out, 'px')
    if os.path.exists(os.path.join(px, 'preview.gif')) and os.path.isdir(os.path.join(out, 'px-wan')) and 'force' not in opts:   # px-wan présent = boucle déjà faite
        print(f'SKIP {uid} (déjà généré)')
        return
    ent_path = os.path.join(out, 'elements', 'entity.png')
    if not os.path.exists(ent_path):
        print(f'SKIP {uid} : pas d\'entité ({ent_path}) — SkyWolf utilise wolf_stand.png')
        ent_path = os.path.join(out, 'elements', 'wolf_stand.png')
        if not os.path.exists(ent_path):
            return
    bg = crop_bars(plate(uid, out)).resize((W, H), Image.BOX).quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')   # grille de pixels nette
    ent = fit(Image.open(ent_path).convert('RGBA'), round(W * cfg['ent'][2]), round(H * cfg['ent'][3]))
    gcol = cfg['glow']
    parts = [Particles(k, c, n * 2, cy, 17 + i) for i, (k, c, n, cy) in enumerate(cfg['parts'])] + [Particles('spark', (255, 255, 255), 26, 1, 99), Particles('spark', gcol, 30, 2, 98)]
    halo = glow_layer(gcol, 100, 1.0)
    vig = vignette()
    move = cfg['move']
    clip = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(os.path.join(out, 'summon', 'f*.png')))]   # tools/gen-summon-clips.py
    if clip:
        print(f'     {uid} : animation de l\'invoqué ({len(clip)} images)')
    uid_seed = list(ULTIMATES).index(uid)
    bolt_frames = {f: bolt(random.Random(f), random.Random(f + 9).randint(30, W - 30), round(H * 0.74))
                   for f in (14, 15, 56, 57, 58, 86, 87, EXP_START, EXP_START + 1, EXP_START + 2)} if cfg['bolts'] else {}
    ease_out = lambda p: 1 - (1 - min(1.0, max(0.0, p))) ** 3
    ease_in = lambda p: min(1.0, max(0.0, p)) ** 2
    clamp01 = lambda p: min(1.0, max(0.0, p))
    embers = Particles('rise', gcol, 90, 3, 55)
    shards = None
    frames = []
    for f in range(N):
        k = f - EXP_START   # k >= 0 : acte 3
        q = clamp01((f - ARRIVAL) / (EXP_START - ARRIVAL))   # avancement de l'acte 2 (mouvement)
        pre = clamp01((f - (EXP_START - 16)) / 16) if k < 0 else 0.0   # anticipation : les 16 images avant l'impact
        # ── position, taille et opacité de l'invoqué selon l'acte ──
        ex, ey, sc, alpha, power = W * cfg['ent'][0], H * cfg['ent'][1], 1.0, 1.0, 1.0
        impact = (W // 2, round(H * 0.66))
        if f < ARRIVAL:   # acte 1 : l'invocation arrive (apparition, grossit avec un léger dépassement)
            p = f / ARRIVAL
            alpha, sc, power = ease_out(p * 1.5), 0.5 + 0.5 * ease_out(p) + 0.08 * math.sin(math.pi * p), 0.25 + 0.75 * p
            ey += (1 - ease_out(p)) * 14
        else:   # actes 2 et 3 : mouvement de l'invoqué
            if move == 'dive':
                ey += ease_in(q) * H * 0.22
                sc = 1 + 0.4 * ease_in(q)
                ex += math.sin(q * math.pi * 3) * 3 * (1 - q)
            elif move == 'charge':   # la horde fonce vers la caméra
                ey += ease_in(q) * H * 0.16
                sc = 1 + 0.55 * ease_in(q)
            else:   # grow
                sc = 1 + 0.55 * ease_in(q)
                ey -= q * H * 0.03
                ex += math.sin(q * math.pi * 8) * 1.5 * q
            power = 1.0 + 1.0 * q + 0.8 * pre
            if pre > 0:   # anticipation : l'invoqué vibre, tout se tend
                jr = random.Random(500 + f)
                ex += jr.uniform(-2.5, 2.5) * pre
                ey += jr.uniform(-2.5, 2.5) * pre
            if k >= 0:
                alpha = 1 - clamp01(k / 5)   # l'invoqué éclate en éclats (voir plus bas)
                sc *= 1 + 0.12 * clamp01(k / 5)
                power = 2.2 * (1 - 0.75 * clamp01(k / 50))
        if k < 0:
            zoom = 1 + 0.13 * ease_in(q) + 0.04 * pre
        else:
            zoom = 1 + 0.13 * (1 - 0.75 * clamp01(k / 36)) + 0.07 * clamp01(1 - k / 4)   # coup de zoom à l'impact, puis retour
        cam = bg.resize((round(W * zoom), round(H * zoom)), Image.NEAREST)   # le décor reste net en pixels
        fr = cam.crop(((cam.width - W) // 2, (cam.height - H) // 2, (cam.width - W) // 2 + W, (cam.height - H) // 2 + H)).convert('RGB')
        ex, ey = round(ex), round(ey)
        flick = 0.85 + 0.15 * math.sin(f * 0.9)
        add(fr, ray_image(gcol, f / 60, min(1.4, 0.5 * power * flick) * alpha ** 0.5 + (0.5 * (1 - clamp01(k / 40)) if k >= 0 else 0)), (ex - 170, ey - 170))
        add(fr, halo.point(lambda v, a=min(1.5, 0.55 * power * flick) * max(alpha ** 0.5, 0.4 if k >= 0 else 0): min(255, int(v * a))), (ex - 100, ey - 100))
        ent_img, ent_pos = None, (0, 0)
        if alpha > 0.01 or (k >= 0 and shards is None):
            if clip:   # image courante du clip (act 1 et 2 : lue en continu ; arrêt sur image juste avant l'impact ; act 3 : dernière image)
                ci = min(len(clip) - 1, round(min(f, EXP_START - 4) * (len(clip) - 1) / EXP_START))
                cw, ch = max(1, round(CLIP_W * CLIP_K * sc)), max(1, round(CLIP_H * CLIP_K * sc))
                e = clip[ci].resize((cw, ch), Image.BOX)
            else:
                ci = 0
                av = alive(ent, f, power, uid_seed)
                e = av.resize((max(1, round(av.width * sc)), max(1, round(av.height * sc))), Image.BOX)
            e.putalpha(e.split()[3].point(lambda v: 255 if v > 110 else 0))   # bords nets : pixel plein ou rien
            if move == 'charge' and clip and alpha > 0.01:   # une foule : copies plus petites et plus sombres, décalées dans le temps
                for dx, dy, sk, dk, off in ((-0.36, -8, 0.6, 0.6, 9), (0.36, -8, 0.6, 0.6, 17), (-0.2, 8, 0.8, 0.8, 5), (0.22, 8, 0.8, 0.8, 13)):
                    c2 = clip[(ci + off) % len(clip)]
                    w2, h2 = max(1, round(CLIP_W * CLIP_K * sc * sk)), max(1, round(CLIP_H * CLIP_K * sc * sk))
                    l2 = c2.resize((w2, h2), Image.BOX)
                    l2.putalpha(l2.split()[3].point(lambda v, a=alpha: 255 * a if v > 110 else 0))
                    l2rgb = l2.convert('RGB').point(lambda v, d=dk: int(v * d))
                    l2rgb.putalpha(l2.split()[3])
                    fr = fr.convert('RGBA')
                    fr.alpha_composite(l2rgb, (round(ex + dx * W - w2 / 2), round(ey + dy - h2 / 2)))
                    fr = fr.convert('RGB')
            ent_img, ent_pos = e, (ex - e.width // 2, ey - e.height // 2)
            if k >= 0 and shards is None:   # acte 3 : l'invoqué éclate en éclats de la couleur de son corps
                sr, shards = random.Random(77), []
                pix = e.load()
                for yy in range(0, e.height, 3):
                    for xx in range(0, e.width, 3):
                        r_, g_, b_, a_ = pix[xx, yy]
                        if a_ > 150:
                            ox, oy = xx - e.width / 2, yy - e.height / 2
                            n_ = max(1.0, math.hypot(ox, oy))
                            sp = sr.uniform(0.9, 3.4)
                            shards.append((ent_pos[0] + xx, ent_pos[1] + yy, (r_, g_, b_, 255), ox / n_ * sp + sr.uniform(-0.6, 0.6), oy / n_ * sp - sr.uniform(0.2, 1.6)))
            if alpha > 0.01:
                sil = e.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
                r = Image.merge('RGBA', [sil.point(lambda v, c=c: c) for c in gcol] + [sil])
                r.putalpha(r.split()[3].point(lambda v, a=min(1.0, 0.5 * power * alpha): min(255, int(v * a))))
                e.putalpha(e.split()[3].point(lambda v, a=alpha: int(v * a)))
                fr = fr.convert('RGBA')
                fr.alpha_composite(r, ent_pos)
                fr.alpha_composite(e, ent_pos)
                fr = fr.convert('RGB')
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for pt in parts:
            pt.draw(d, f)
        if pre > 0:   # anticipation : des étincelles sont aspirées vers l'invoqué
            ar = random.Random(900 + f)
            for _ in range(int(30 * pre)):
                a_ = ar.uniform(0, 2 * math.pi)
                rad = (1 - pre) * 70 + ar.uniform(8, 30)
                d.rectangle((int(ex + math.cos(a_) * rad), int(ey + math.sin(a_) * rad), int(ex + math.cos(a_) * rad) + 1, int(ey + math.sin(a_) * rad) + 1), fill=(255, 255, 255, 255))
        if k >= 6:
            embers.draw(d, f)
        if f < 28:   # onde d'invocation : anneau qui part du centre de l'entité
            rr_ = f * 4.2
            d.ellipse((ex - rr_, ey - rr_ * 0.8, ex + rr_, ey + rr_ * 0.8), outline=tuple(gcol) + (int(255 * (1 - f / 28)),), width=2)
        if f in bolt_frames:
            pts = bolt_frames[f]
            d.line(pts, fill=cfg['bolts'] + (255,), width=2)
            d.line(pts, fill=(255, 255, 255, 255), width=1)
        if k >= 0 and shards:   # éclats de l'invoqué projetés, retombant sous la gravité
            for sx_, sy_, col, vx, vy in shards:
                px_, py_ = sx_ + vx * k * 1.6, sy_ + vy * k * 1.6 + 0.045 * k * k
                if 0 <= px_ < W and 0 <= py_ < H and k < 60:
                    fade = 255 if k < 34 else int(255 * (1 - (k - 34) / 26))
                    d.rectangle((int(px_), int(py_), int(px_) + 1, int(py_) + 1), fill=col[:3] + (fade,))
        fr = fr.convert('RGBA')
        fr.alpha_composite(lay)
        fr = fr.convert('RGB')
        if f in bolt_frames:
            fr = Image.blend(fr, Image.new('RGB', (W, H), cfg['bolts']), 0.28)
        fr = ImageChops.multiply(fr, Image.merge('RGB', [vig] * 3))   # vignette : le regard va vers l'entité
        if f < 8:   # éclat de l'invocation
            fr = Image.blend(fr, Image.new('RGB', (W, H), (255, 255, 255)), 0.55 * (1 - f / 8))
        if pre > 0:   # anticipation : l'écran s'assombrit, tout se tait avant l'impact
            fr = Image.blend(fr, Image.new('RGB', (W, H), (0, 0, 0)), 0.5 * pre)
        elif ARRIVAL <= f < EXP_START and q > 0.5:   # montée en puissance : légère secousse
            sh = random.Random(f)
            amp = 2.2 * (q - 0.5) * 2
            fr = ImageChops.offset(fr, round(sh.uniform(-amp, amp)), round(sh.uniform(-amp, amp)))
        if 0 <= k < EXPLOSION_LEN:   # acte 3 : explosion du sort
            cx, cy = impact
            u = k / EXPLOSION_LEN
            rr = max(4, round(10 + k * 3.6))
            core = halo.resize((rr * 2, rr * 2), Image.LANCZOS).point(lambda v, a=2.0 * (1 - u): min(255, int(v * a)))
            add(fr, core, (cx - rr, cy - rr))
            add(fr, core, (ex - rr, ey - rr))   # une seconde boule de feu au cœur de l'invoqué
            lay2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            d2 = ImageDraw.Draw(lay2)
            for delay, wd in ((0, 2), (7, 2), (14, 1), (21, 1)):   # quatre ondes de choc : cercles qui remplissent l'écran, ellipses au sol
                kk = k - delay
                if kk > 0:
                    fade = int(255 * max(0.0, 1 - kk / (EXPLOSION_LEN - delay)))
                    col = ((255, 255, 255) if delay % 14 == 0 else tuple(gcol)) + (fade,)
                    big = kk * 6.8
                    d2.ellipse((ex - big, ey - big, ex + big, ey + big), outline=col, width=wd)
                    ring = kk * 5.0
                    d2.ellipse((cx - ring, cy - ring * 0.42, cx + ring, cy + ring * 0.42), outline=col, width=wd)
            if k < 14:   # traits de vitesse rayonnants
                lr = random.Random(2000 + f)
                for _ in range(46):
                    a_ = lr.uniform(0, 2 * math.pi)
                    r0, r1 = 14 + k * 9, 40 + k * 17 + lr.uniform(0, 30)
                    d2.line((ex + math.cos(a_) * r0, ey + math.sin(a_) * r0, ex + math.cos(a_) * r1, ey + math.sin(a_) * r1), fill=(255, 255, 255, int(230 * (1 - k / 14))), width=1)
            cr = random.Random(11)   # fissures de lumière sur le sol
            for _ in range(8):
                a_ = cr.uniform(0.15 * math.pi, 0.85 * math.pi) + (math.pi if cr.random() < 0.5 else 0)
                L = min(70, k * 5.5)
                x_, y_, pts_ = cx, cy, [(cx, cy)]
                for st in range(1, 8):
                    x_ += math.cos(a_) * L / 7 + cr.uniform(-3, 3)
                    y_ += math.sin(a_) * L / 7 * 0.45 + cr.uniform(-1.5, 1.5)
                    pts_.append((x_, y_))
                d2.line(pts_, fill=tuple(gcol) + (int(255 * max(0.0, 1 - k / 46)),), width=1)
            ang = random.Random(3)
            for i in range(90):
                a_, sp = ang.uniform(0, 2 * math.pi), ang.uniform(2.0, 8.0)
                px_, py_ = cx + math.cos(a_) * sp * k * 0.9, cy + math.sin(a_) * sp * k * 0.75 + 0.07 * k * k
                col = (255, 255, 255, 255) if i % 3 == 0 else tuple(gcol) + (255,)
                d2.rectangle((int(px_), int(py_), int(px_) + 1, int(py_) + 1), fill=col)
            fr = fr.convert('RGBA')
            fr.alpha_composite(lay2)
            fr = fr.convert('RGB')
            if k < 12:   # blanc total à l'impact, qui retombe
                fr = Image.blend(fr, Image.new('RGB', (W, H), (255, 255, 255)), min(1.0, 1.15 * (1 - k / 12)))
            if k == 3:   # image d'impact : négatif d'une image
                fr = Image.blend(fr, ImageOps.invert(fr), 0.8)
            if k < 50:   # lueur résiduelle de la couleur du sort
                fr = Image.blend(fr, Image.new('RGB', (W, H), tuple(min(255, c + 40) for c in gcol)), 0.2 * (1 - k / 50))
            if k < 40:   # secousse longue
                sh = random.Random(1000 + f)
                amp = 11 * (1 - k / 40)
                fr = ImageChops.offset(fr, round(sh.uniform(-amp, amp)), round(sh.uniform(-amp, amp)))
            if k < 16:   # aberration chromatique
                rch, gch, bch = fr.split()
                sft = round(3 * (1 - k / 16))
                fr = Image.merge('RGB', (ImageChops.offset(rch, sft, 0), gch, ImageChops.offset(bch, -sft, 0)))
        if f >= ARRIVAL:   # lueur (bloom) : les zones très claires débordent
            br = fr.point(lambda v: v if v > 185 else 0).filter(ImageFilter.GaussianBlur(3))
            add(fr, br.point(lambda v: int(v * 0.7)), (0, 0))
        frames.append(fr.convert('RGB'))
    sample = Image.new('RGB', (W, H * 6))   # palette commune : images calmes, battement et explosion
    for i, fi in enumerate((4, 40, 90, EXP_START + 3, EXP_START + 14, EXP_START + 36)):
        sample.paste(frames[fi], (0, i * H))
    pal = sample.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
    q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
    if os.path.isdir(px) and not os.path.isdir(os.path.join(out, 'px-wan')) and glob.glob(os.path.join(px, 'f*.png')):
        os.rename(px, os.path.join(out, 'px-wan'))   # on garde le plan-séquence Wan de côté
    shutil.rmtree(px, ignore_errors=True)
    os.makedirs(px)
    for f, fr in enumerate(q):
        fr.convert('RGB').save(os.path.join(px, f'f{f:04d}.png'))
    q[0].save(os.path.join(px, 'preview.gif'), save_all=True, append_images=q[1:], duration=round(1000 / FPS), loop=0)
    print(f'OK   {uid} : {N} images', flush=True)


for uid in ULTIMATES:
    if ONLY and uid not in ONLY:
        continue
    if 'plates-only' in opts:   # décors seuls : sprites/ultimates-seq/<id>/plate.png
        plate(uid, os.path.join(GAME, 'sprites', 'ultimates-seq', uid))
        print(f'OK   {uid} : décor', flush=True)
        continue
    render(uid)
