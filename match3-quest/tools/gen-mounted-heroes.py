#!/usr/bin/env python3
"""gen-mounted-heroes.py — Héros à cheval pour l'exploration : un sprite de cavalier par classe, 4 directions + cycle de marche, style GBA.

Le cheval (sans cavalier) est dessiné par code en pixel art, comme les sprites GBA du héros : formes pleines, contour sombre, ombrage en
deux tons, palette réduite, sol non dessiné (aucune génération IA : SDXL ne sait pas dessiner un cheval de face ou de dos sans cavalier).
Le sprite GBA du héros (sprites/gba/<classe>.*.js : face, dos, profils) est repris tel quel, légèrement réduit, puis collé en selle : ses jambes
passent derrière la couverture de selle. La couverture prend la couleur de la classe. Cycle de marche : le cheval monte et descend d'un pixel, ses
jambes alternent (les jambes avant et arrière opposées se lèvent ensemble), le cavalier suit le mouvement.

Sortie : sprites/ultimates-seq/horse/mounted.json (clé `<classe>_horse` → { front, back, left, right, walk_<dir>_<n> } en PNG base64 48×48) et
planche d'aperçu `preview.png`. Puis : node tools/merge-mounted.mjs (écrit dans sprites/generated.js) et node sprites/build-gba.mjs.
Usage : python3 tools/gen-mounted-heroes.py
"""
import os, re, io, glob, json, base64
from PIL import Image, ImageDraw

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(GAME, 'sprites', 'ultimates-seq', 'horse')
CLASSES = {  # classe : (couleur de la couverture, bord)
    'archer': ((176, 44, 44), (232, 184, 64)),
    'templar': ((44, 84, 168), (220, 220, 236)),
    'barbarian': ((54, 128, 60), (232, 184, 64)),
    'assassin': ((92, 52, 132), (200, 160, 220)),
    'sorcerer': ((34, 140, 150), (232, 232, 160)),
}
S = 48
DIRS = ['front', 'back', 'left', 'right']
FRAMES = 4
RIDER = 28   # côté du cavalier réduit (32 → 28 : un peu plus petit que le héros à pied, le cheval domine)

OUTLINE = (44, 26, 24, 255)
COAT = [(122, 76, 44, 255), (156, 100, 58, 255), (96, 58, 36, 255)]   # base, lumière, ombre
MANE = (36, 28, 34, 255)
HOOF = (58, 46, 46, 255)
SOCK = (226, 218, 200, 255)


def hero_sprite(cls, key):
    src = open(glob.glob(os.path.join(GAME, 'sprites', 'gba', f'{cls}.*.js'))[0], encoding='utf8').read()
    m = re.search(r'"%s":"data:image/png;base64,([^"]+)"' % key, src)
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def shade(layer, body_box):
    """Ombrage en deux tons : lumière sur le haut des formes, ombre sur le bas, sans toucher aux transparents."""
    px = layer.load()
    w, h = layer.size
    x0, y0, x1, y1 = body_box
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and (r, g, b, a) == COAT[0]:
                above = px[x, y - 1][3] if y > 0 else 0
                below = px[x, y + 1][3] if y < h - 1 else 0
                if not above:
                    px[x, y] = COAT[1]
                elif not below or (y + 1 < h and px[x, y + 1][:3] == OUTLINE[:3]):
                    px[x, y] = COAT[2]


def outline(layer):
    """Contour sombre d'un pixel autour de la silhouette."""
    w, h = layer.size
    src = layer.copy().load()
    dst = layer.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    dst[x, y] = OUTLINE
                    break


def leg(d, x, y_top, y_hoof, dx, lift, hoof_w=3):
    """Une jambe : du jarret au sabot, décalée de dx au sabot, levée de `lift` pixels."""
    yh = y_hoof - lift
    d.line([(x, y_top), (x + dx // 2, (y_top + yh) // 2), (x + dx, yh - 2)], fill=COAT[0], width=3)
    d.rectangle([x + dx - hoof_w // 2, yh - 2, x + dx + hoof_w // 2, yh], fill=HOOF)


def horse_side(phase, facing_left=True):
    """Cheval de profil (vers la gauche), 4 phases de marche."""
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    bob = [0, -1, 0, -1][phase]
    base = 46
    swing = [(3, -3), (0, 0), (-3, 3), (0, 0)][phase]       # (avant, arrière) : les jambes diagonales vont ensemble
    lift = [(0, 2), (0, 0), (2, 0), (0, 0)][phase]
    # jambes de l'autre côté (plus sombres, derrière le corps)
    far = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    fd = ImageDraw.Draw(far)
    leg(fd, 14, 30 + bob, base, swing[1], lift[0] and 0 or 0)
    leg(fd, 32, 30 + bob, base, swing[0], lift[1] and 0 or 0)
    for y in range(S):
        for x in range(S):
            r, g, b, a = far.getpixel((x, y))
            if a and (r, g, b) == COAT[0][:3]:
                far.putpixel((x, y), COAT[2])
    L.alpha_composite(far)
    # queue et crinière
    poly(d, [(36, 20 + bob), (41, 24 + bob), (42, 33 + bob), (39, 36 + bob), (38, 28 + bob), (35, 24 + bob)], MANE)
    # corps
    d.ellipse([9, 18 + bob, 38, 35 + bob], fill=COAT[0])
    # encolure + tête
    poly(d, [(11, 24 + bob), (8, 14 + bob), (11, 8 + bob), (15, 11 + bob), (16, 22 + bob)], COAT[0])
    poly(d, [(8, 12 + bob), (3, 18 + bob), (2, 22 + bob), (5, 24 + bob), (10, 20 + bob), (11, 12 + bob)], COAT[0])
    d.rectangle([3, 21 + bob, 5, 23 + bob], fill=SOCK)                       # naseau clair
    poly(d, [(10, 6 + bob), (11, 3 + bob), (13, 7 + bob)], COAT[2])           # oreille
    poly(d, [(11, 9 + bob), (15, 9 + bob), (17, 20 + bob), (14, 22 + bob), (12, 15 + bob)], MANE)  # crinière
    d.point((7, 15 + bob), fill=(18, 14, 16, 255))                              # œil
    # jambes du côté du spectateur
    leg(d, 12, 31 + bob, base, swing[0], lift[0] and 2 or 0)
    leg(d, 34, 31 + bob, base, swing[1], lift[1] and 2 or 0)
    shade(L, (0, 0, S, S))
    outline(L)
    return L if facing_left else L.transpose(Image.FLIP_LEFT_RIGHT)


def flank_blankets(d, cls, bob, y0, y1):
    """Couverture de selle qui dépasse de chaque côté du cheval vu de face ou de dos."""
    col, trim = CLASSES[cls]
    d.rectangle([8, y0 + bob, 11, y1 + bob], fill=col + (255,))
    d.rectangle([36, y0 + bob, 39, y1 + bob], fill=col + (255,))
    d.rectangle([8, y1 + bob, 11, y1 + bob], fill=trim + (255,))
    d.rectangle([36, y1 + bob, 39, y1 + bob], fill=trim + (255,))


def horse_front(cls, phase):
    """Cheval de face : (corps et jambes, tête et encolure) ; la tête passe devant le cavalier, assis plus haut derrière elle."""
    bob = [0, -1, 0, -1][phase]
    base = 46
    la, lb = [(2, 0), (0, 0), (0, 2), (0, 0)][phase]
    body = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    for x, lf in ((15, la), (29, lb)):
        yh = base - lf
        d.rectangle([x, 36 + bob, x + 4, yh - 3], fill=COAT[0])
        d.rectangle([x, yh - 4, x + 4, yh - 2], fill=SOCK)
        d.rectangle([x, yh - 1, x + 4, yh], fill=HOOF)
    d.ellipse([11, 24 + bob, 37, 42 + bob], fill=COAT[0])
    flank_blankets(d, cls, bob, 30, 36)
    shade(body, (0, 0, S, S))
    outline(body)
    head = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    h = ImageDraw.Draw(head)
    poly(h, [(19, 30 + bob), (18, 18 + bob), (29, 18 + bob), (30, 30 + bob)], COAT[0])                                   # encolure
    poly(h, [(19, 15 + bob), (29, 15 + bob), (28, 27 + bob), (24, 31 + bob), (20, 27 + bob)], COAT[0])                   # tête
    poly(h, [(19, 15 + bob), (18, 10 + bob), (22, 14 + bob)], COAT[2])                                                   # oreilles
    poly(h, [(29, 15 + bob), (30, 10 + bob), (26, 14 + bob)], COAT[2])
    h.rectangle([22, 13 + bob, 26, 17 + bob], fill=MANE)                                                                 # toupet
    h.rectangle([23, 17 + bob, 25, 26 + bob], fill=SOCK)                                                                 # liste blanche
    h.point((20, 19 + bob), fill=(18, 14, 16, 255)); h.point((28, 19 + bob), fill=(18, 14, 16, 255))                     # yeux
    h.rectangle([21, 26 + bob, 27, 28 + bob], fill=COAT[2])                                                              # museau
    shade(head, (0, 0, S, S))
    outline(head)
    return body, head


def horse_back(cls, phase):
    """Cheval de dos : croupe, queue, jambes arrière ; la couverture passe par-dessus le cavalier."""
    bob = [0, -1, 0, -1][phase]
    base = 46
    la, lb = [(2, 0), (0, 0), (0, 2), (0, 0)][phase]
    body = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    for x, lf in ((14, la), (30, lb)):
        yh = base - lf
        d.rectangle([x, 36 + bob, x + 4, yh - 3], fill=COAT[0])
        d.rectangle([x, yh - 4, x + 4, yh - 2], fill=COAT[2])
        d.rectangle([x, yh - 1, x + 4, yh], fill=HOOF)
    d.ellipse([10, 24 + bob, 38, 43 + bob], fill=COAT[0])
    poly(d, [(21, 30 + bob), (27, 30 + bob), (29, 40 + bob), (25, 45 + bob), (23, 45 + bob), (19, 40 + bob)], MANE)      # queue
    flank_blankets(d, cls, bob, 30, 36)
    shade(body, (0, 0, S, S))
    outline(body)
    return body


def blanket(cls, view, bob):
    """Couverture de selle de la couleur de la classe (par-dessus les jambes du cavalier)."""
    col, trim = CLASSES[cls]
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    col = col + (255,)
    trim = trim + (255,)
    dark = tuple(int(c * 0.7) for c in col[:3]) + (255,)
    if view in ('left', 'right'):
        d.rectangle([17, 24 + bob, 30, 32 + bob], fill=col)
        d.rectangle([17, 31 + bob, 30, 32 + bob], fill=trim)
        d.rectangle([17, 24 + bob, 18, 31 + bob], fill=dark)
    else:
        d.rectangle([15, 29 + bob, 33, 35 + bob], fill=col)
        d.rectangle([15, 35 + bob, 33, 35 + bob], fill=trim)
        d.rectangle([15, 29 + bob, 16, 34 + bob], fill=dark)
        d.rectangle([32, 29 + bob, 33, 34 + bob], fill=dark)
    outline(L)
    return L


def rider_sprite(cls, view):
    r = hero_sprite(cls, view).resize((RIDER, RIDER), Image.BOX)
    px = r.load()
    for y in range(RIDER):
        for x in range(RIDER):
            c = px[x, y]
            px[x, y] = c if c[3] >= 140 else (0, 0, 0, 0)
    return r


def mounted(cls, view, phase):
    bob = [0, -1, 0, -1][phase]
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rider = rider_sprite(cls, view)
    if view in ('left', 'right'):
        out.alpha_composite(horse_side(phase, facing_left=(view == 'left')))
        cx = 24 + (1 if view == 'left' else -1)
        out.alpha_composite(rider, (cx - RIDER // 2, 33 + bob - RIDER))     # en selle : le bas du cavalier est dans la couverture
        out.alpha_composite(blanket(cls, view, bob))
    elif view == 'front':
        body, head = horse_front(cls, phase)
        out.alpha_composite(body)
        out.alpha_composite(rider, (24 - RIDER // 2, 34 + bob - RIDER))    # assis plus haut, derrière la tête
        out.alpha_composite(head)
    else:
        out.alpha_composite(horse_back(cls, phase))
        out.alpha_composite(rider, (24 - RIDER // 2, 31 + bob - RIDER))
        out.alpha_composite(blanket(cls, view, bob + 2))
    return out


def b64(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


os.makedirs(OUT, exist_ok=True)
result = {}
sheet = Image.new('RGBA', (S * 4 * 3 + 40, S * len(CLASSES) * 3 // 1 + 10), (70, 110, 70, 255))
for r, cls in enumerate(CLASSES):
    entry = {}
    for view in DIRS:
        entry[view] = b64(mounted(cls, view, 0))
        for n in range(FRAMES):
            entry[f'walk_{view}_{n}'] = b64(mounted(cls, view, n))
    result[f'{cls}_horse'] = entry
    for c, view in enumerate(DIRS):
        sheet.alpha_composite(mounted(cls, view, 0).resize((S * 3, S * 3), Image.NEAREST), (c * (S * 3 + 8), r * (S * 3 + 2)))
json.dump(result, open(os.path.join(OUT, 'mounted.json'), 'w'))
sheet.crop((0, 0, sheet.width - 30, S * 3 * len(CLASSES) + 2 * len(CLASSES))).save(os.path.join(OUT, 'preview.png'))
print('OK', ', '.join(result))
