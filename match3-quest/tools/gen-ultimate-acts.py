#!/usr/bin/env python3
"""gen-ultimate-acts.py — Animations en trois actes des 8 ultimes, dans la direction artistique des boucles de biome (gen-biome-intros.py).

Plan large, pas un panorama : un décor pixel art vu de loin (SDXL + Pixel Art XL via `gm image`, portrait 768×1344, ciel dégagé),
l'entité du sort (cutout `sprites/ultimates-seq/<id>/elements/entity.png`, déjà générée) rendue vivante (respiration, ondulation, balancement, scintillement),
les particules et éclairs du sort. Aucun héros à l'écran : seulement le décor et l'effet.
Une seule prise en trois actes (arrivée de l'invocation, mouvement de l'invoqué, explosion du sort) : 156 images à 24 i/s (6,5 s), 144×256 → sprites/ultimates-seq/<id>/px/fNNNN.png + px/preview.gif
(les anciens plans-séquences Wan sont rangés dans px-wan/). Rangement : node tools/pack-ultimate-sequences.mjs.

Prérequis (WSL) : ComfyUI via `gm up pixel` (une image SDXL par ultimate, ≈ 1 min). Pillow.
Usage : python3 tools/gen-ultimate-acts.py [--only=ultimateSunPiercer,…] [--force] [--replate] [--plates-only] [--seed=N]
"""
import sys, os, subprocess, glob, shutil, math, random
from PIL import Image, ImageDraw, ImageChops, ImageFilter

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_MAKER = os.environ.get('GAME_MAKER_DIR', '/mnt/c/Users/Niafrond/dev/game-maker')
opts = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
ONLY = opts['only'].split(',') if 'only' in opts else None
W, H, FPS = 144, 256, 24
CLIP_W, CLIP_H, CLIP_K = 480, 832, 0.3   # cadre des clips de l'invoqué (tools/gen-summon-clips.py) et échelle vers 144×256
# Trois actes, une seule prise : 1 arrivée de l'invocation, 2 mouvement de l'invoqué, 3 explosion du sort (6,5 s, pas de boucle)
ARRIVAL, EXP_START, N = 48, 104, 156
EXPLOSION_LEN = N - EXP_START

STYLE = ('pixel art, 16-bit, full bleed edge to edge, epic wide establishing shot seen from far away, ancient China mythology, '
         'dramatic lighting, rich saturated colors, huge sky, empty center of the sky, ground in the lower part, nobody in the scene, no creatures, no figures, no statues in the sky, clean composition')
NEGATIVE = ('person, human, character, figure, warrior, archer, creature, monster, dragon, text, letters, watermark, border, frame, letterbox, '
            'black bars, gray bars, margin, vignette, poster, 3d render, realistic, photo, blurry')

# id : classe du héros, décor (plan large, sans personnage), entité (cadre x, y, largeur max, hauteur max, en fraction du cadre ; bob = amplitude px),
#      mouvement de l'invoqué (dive : plonge sur la cible, grow : enfle, sweep : traverse), couleur du halo / de l'éclat, particules [(type, couleur, nombre, cycles par boucle)], éclairs (couleur) ou None
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
    'ultimateThousandRiders': dict(move='sweep', cls='barbarian', plate='a vast dusty steppe at sunset near the Great Wall, a red sky with a huge red sun low over the horizon, rolling plains, flat dusty ground in the foreground',
                                   ent=(0.5, 0.4, 0.98, 0.5), glow=(255, 150, 70), bob=2, parts=[('dust', (255, 200, 140), 36, 3)], bolts=None),
    'ultimateSkyWolf': dict(move='dive', cls='barbarian', plate='a snowy mountain summit at night under a huge full moon, purple and teal aurora across the sky, snowy peaks, a flat snowy ledge in the foreground',
                            ent=(0.5, 0.36, 0.98, 0.6), glow=(170, 200, 255), bob=2, parts=[('rise', (200, 220, 255), 36, 1), ('fall', (255, 255, 255), 24, 1)], bolts=None),
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
    frames = []
    for f in range(N):
        k = f - EXP_START   # k >= 0 : acte 3
        q = clamp01((f - ARRIVAL) / (EXP_START - ARRIVAL))   # avancement de l'acte 2 (mouvement)
        # ── position, taille et opacité de l'invoqué selon l'acte ──
        ex, ey, sc, alpha, power = W * cfg['ent'][0], H * cfg['ent'][1], 1.0, 1.0, 1.0
        impact = (W // 2, round(H * 0.66))
        if f < ARRIVAL:   # acte 1 : l'invocation arrive (apparition, grossit avec un léger dépassement)
            p = f / ARRIVAL
            alpha, sc, power = ease_out(p * 1.5), 0.5 + 0.5 * ease_out(p) + 0.08 * math.sin(math.pi * p), 0.25 + 0.75 * p
            ey += (1 - ease_out(p)) * 14
        else:   # actes 2 et 3 : mouvement de l'invoqué
            if move == 'dive':
                ey += ease_in(q) * H * 0.2
                sc = 1 + 0.28 * ease_in(q)
                ex += math.sin(q * math.pi * 3) * 3 * (1 - q)
            elif move == 'sweep':
                ex = W * (0.26 + 0.24 * ease_out(q))
                sc = 1 + 0.12 * q
                ey += math.sin(q * math.pi * 6) * 2
                impact = (round(ex), round(H * 0.66))
            else:   # grow
                sc = 1 + 0.4 * ease_in(q)
                ey -= q * H * 0.03
                ex += math.sin(q * math.pi * 8) * 1.5 * q
            power = 1.0 + 0.8 * q
            if k >= 0:
                alpha = 1 - clamp01((k - 6) / 20)
                sc *= 1 + 0.1 * clamp01(k / 26)
                power = 1.8 * (1 - 0.7 * clamp01(k / 40))
        zoom = 1 + 0.06 * (ease_in(q) if k < 0 else 1 - 0.6 * clamp01(k / 30))
        cam = bg.resize((round(W * zoom), round(H * zoom)), Image.NEAREST)   # le décor reste net en pixels
        fr = cam.crop(((cam.width - W) // 2, (cam.height - H) // 2, (cam.width - W) // 2 + W, (cam.height - H) // 2 + H)).convert('RGB')
        ex, ey = round(ex), round(ey)
        flick = 0.85 + 0.15 * math.sin(f * 0.9)
        add(fr, ray_image(gcol, f / 60, min(1.2, 0.5 * power * flick) * alpha ** 0.5), (ex - 170, ey - 170))
        add(fr, halo.point(lambda v, a=min(1.3, 0.55 * power * flick) * alpha ** 0.5: min(255, int(v * a))), (ex - 100, ey - 100))
        if alpha > 0.01:
            if clip:   # image courante du clip (act 1 et 2 : lue en continu ; act 3 : dernière image tenue)
                ci = min(len(clip) - 1, round(min(f, EXP_START) * (len(clip) - 1) / EXP_START))
                cw, ch = max(1, round(CLIP_W * CLIP_K * sc)), max(1, round(CLIP_H * CLIP_K * sc))
                e = clip[ci].resize((cw, ch), Image.BOX)
            else:
                av = alive(ent, f, power, uid_seed)
                e = av.resize((max(1, round(av.width * sc)), max(1, round(av.height * sc))), Image.BOX)
            e.putalpha(e.split()[3].point(lambda v: 255 if v > 110 else 0))   # bords nets : pixel plein ou rien
            sil = e.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
            r = Image.merge('RGBA', [sil.point(lambda v, c=c: c) for c in gcol] + [sil])
            r.putalpha(r.split()[3].point(lambda v, a=min(1.0, 0.5 * power * alpha): min(255, int(v * a))))
            e.putalpha(e.split()[3].point(lambda v, a=alpha: int(v * a)))
            fr = fr.convert('RGBA')
            fr.alpha_composite(r, (ex - e.width // 2, ey - e.height // 2))
            fr.alpha_composite(e, (ex - e.width // 2, ey - e.height // 2))
            fr = fr.convert('RGB')
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for pt in parts:
            pt.draw(d, f)
        if f < 28:   # onde d'invocation : anneau qui part du centre de l'entité
            rr_ = f * 4.2
            d.ellipse((ex - rr_, ey - rr_ * 0.8, ex + rr_, ey + rr_ * 0.8), outline=tuple(gcol) + (int(255 * (1 - f / 28)),), width=2)
        if f in bolt_frames:
            pts = bolt_frames[f]
            d.line(pts, fill=cfg['bolts'] + (255,), width=2)
            d.line(pts, fill=(255, 255, 255, 255), width=1)
        fr = fr.convert('RGBA')
        fr.alpha_composite(lay)
        fr = fr.convert('RGB')
        if f in bolt_frames:
            fr = Image.blend(fr, Image.new('RGB', (W, H), cfg['bolts']), 0.28)
        fr = ImageChops.multiply(fr, Image.merge('RGB', [vig] * 3))   # vignette : le regard va vers l'entité
        if f < 8:   # éclat de l'invocation
            fr = Image.blend(fr, Image.new('RGB', (W, H), (255, 255, 255)), 0.55 * (1 - f / 8))
        elif ARRIVAL <= f < EXP_START and q > 0.5:   # montée en puissance : légère secousse
            sh = random.Random(f)
            amp = 2.2 * (q - 0.5) * 2
            fr = ImageChops.offset(fr, round(sh.uniform(-amp, amp)), round(sh.uniform(-amp, amp)))
        if 0 <= k < EXPLOSION_LEN:   # acte 3 : explosion du sort — noyau, ondes de choc, débris, éclat blanc, secousse
            cx, cy = impact
            u = k / EXPLOSION_LEN
            rr = max(4, round(8 + k * 2.8))
            core = halo.resize((rr * 2, rr * 2), Image.LANCZOS).point(lambda v, a=1.8 * (1 - u): min(255, int(v * a)))
            add(fr, core, (cx - rr, cy - rr))
            lay2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            d2 = ImageDraw.Draw(lay2)
            for delay, wd in ((0, 2), (8, 1), (16, 1)):
                kk = k - delay
                if kk > 0:
                    ring = kk * 4.6
                    d2.ellipse((cx - ring, cy - ring * 0.45, cx + ring, cy + ring * 0.45),
                               outline=((255, 255, 255) if delay == 0 else tuple(gcol)) + (int(255 * (1 - kk / (EXPLOSION_LEN - delay))),), width=wd)
            ang = random.Random(3)
            for i in range(44):
                a_, sp = ang.uniform(0, 2 * math.pi), ang.uniform(2.0, 6.5)
                px_, py_ = cx + math.cos(a_) * sp * k * 0.9, cy + math.sin(a_) * sp * k * 0.75 + 0.08 * k * k
                col = (255, 255, 255, 255) if i % 3 == 0 else tuple(gcol) + (255,)
                d2.rectangle((int(px_), int(py_), int(px_) + 1, int(py_) + 1), fill=col)
            fr = fr.convert('RGBA')
            fr.alpha_composite(lay2)
            fr = fr.convert('RGB')
            if k < 9:
                fr = Image.blend(fr, Image.new('RGB', (W, H), (255, 255, 255)), 0.7 * (1 - k / 9))
            if k < 22:
                sh = random.Random(1000 + f)
                amp = 7 * (1 - k / 22)
                fr = ImageChops.offset(fr, round(sh.uniform(-amp, amp)), round(sh.uniform(-amp, amp)))
        frames.append(fr.convert('RGB'))
    sample = Image.new('RGB', (W, H * 6))   # palette commune : images calmes, battement et explosion
    for i, fi in enumerate((4, 40, 90, EXP_START + 3, EXP_START + 12, EXP_START + 30)):
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
