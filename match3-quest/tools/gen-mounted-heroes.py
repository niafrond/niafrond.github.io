#!/usr/bin/env python3
"""gen-mounted-heroes.py — Héros à cheval pour l'exploration : un sprite de cavalier par classe, 4 directions + cycle de marche, style GBA.

Le cheval chibi (tools/horse-art.py : gros contour noir, crème et gris-brun, selle bombée, comme les Pokémon GBA / FF6) est dessiné pixel par pixel ;
le sprite GBA du héros (sprites/gba/<classe>.*.js) est repris tel quel puis réduit à 24 px (un cavalier est plus petit qu'un héros à pied : le cheval
domine) et posé en selle. La selle prend la couleur de la classe. De face, la tête du cheval passe devant le cavalier, assis derrière elle ; de dos,
le cavalier est assis sur la croupe. Marche : le cheval et le cavalier montent et descendent d'un pixel, les jambes diagonales alternent.

Sortie : sprites/ultimates-seq/horse/mounted.json (clé `<classe>_horse` → { front, back, left, right, walk_<dir>_<n> } en PNG base64 40×40) et planche
d'aperçu `preview.png`. Puis : node tools/merge-mounted.mjs (écrit dans sprites/generated.js) et node sprites/build-gba.mjs.
Usage : python3 tools/gen-mounted-heroes.py
"""
import os, re, io, glob, json, base64, importlib.util
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(GAME, 'sprites', 'ultimates-seq', 'horse')
_spec = importlib.util.spec_from_file_location('horse_art', os.path.join(GAME, 'tools', 'horse-art.py'))
horse = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(horse)

CLASSES = {  # classe : couleur de la selle
    'archer': (190, 52, 48), 'templar': (52, 96, 190), 'barbarian': (66, 150, 70), 'assassin': (112, 62, 156), 'sorcerer': (40, 160, 170),
}
S = 48              # canevas de travail ; réduit à OUT_SIZE en sortie
DIRS = ['front', 'back', 'left', 'right']
FRAMES = 4
RIDER = 21          # cavalier réduit (32 → 21), avant la réduction d'ensemble ci-dessous
OUT_SIZE = 40       # sprite final 40×40 : à la même taille de pixel à l'écran que le héros à pied (32 px), cavalier et cheval tiennent en ≈ 1,2 case
HX, HY = 4, 19      # position du cheval 40×28 dans le canevas 48×48 : sabots en bas


def hero_sprite(cls, key):
    src = open(glob.glob(os.path.join(GAME, 'sprites', 'gba', f'{cls}.*.js'))[0], encoding='utf8').read()
    m = re.search(r'"%s":"data:image/png;base64,([^"]+)"' % key, src)
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')


def recolor(im, rgb):
    """Selle verte du cheval → couleur de la classe."""
    src = horse.PAL['g'][:3]
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][:3] == src and px[x, y][3]:
                px[x, y] = rgb + (255,)
    return im


def rider_sprite(cls, view):
    """Sprite du héros réduit à 24 px : réduction par blocs, puis chaque pixel est recalé sur une couleur du sprite d'origine (pas de teintes mélangées)."""
    hero = hero_sprite(cls, view)
    palette = sorted({c[:3] for c in hero.getdata() if c[3] >= 200}) if False else sorted({hero.getpixel((x, y))[:3] for x in range(hero.width) for y in range(hero.height) if hero.getpixel((x, y))[3] >= 200})
    r = hero.resize((RIDER, RIDER), Image.BOX)
    px = r.load()
    for y in range(RIDER):
        for x in range(RIDER):
            c = px[x, y]
            if c[3] < 140:
                px[x, y] = (0, 0, 0, 0)
            else:
                near = min(palette, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
                px[x, y] = near + (255,)
    return r


def mounted(cls, view, phase):
    bob = [0, -1, 0, -1][phase]
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rider = rider_sprite(cls, view)
    col = CLASSES[cls]
    if view in ('left', 'right'):
        h = recolor(horse.side(phase), col)
        flip = view == 'left'                                   # le cheval est dessiné vers la droite
        if flip:
            h = h.transpose(Image.FLIP_LEFT_RIGHT)
        out.alpha_composite(h, (HX, HY))
        cx = HX + (40 - 1 - 14 if flip else 14)                  # milieu de la selle
        # le bas du cavalier est dans le siège : on le pose sur la selle, puis on redessine la selle par-dessus ses pieds
        out.alpha_composite(rider, (cx - RIDER // 2, HY + 7 + bob - RIDER + 3 - 3))
        saddle = recolor(horse.to_image([list(r.ljust(11)) for r in horse.SADDLE[2:]]), col)
        if flip:
            saddle = saddle.transpose(Image.FLIP_LEFT_RIGHT)
        out.alpha_composite(saddle, (cx - 5, HY + 3 + 2 + bob))
    elif view == 'front':
        body = recolor(horse.front(phase, head=False), col)
        out.alpha_composite(body, (HX, HY))
        out.alpha_composite(rider, (24 - RIDER // 2, HY + 12 + bob - RIDER))     # assis derrière la tête
        out.alpha_composite(horse.front(phase, body=False), (HX, HY))
    else:
        out.alpha_composite(recolor(horse.front(phase, back=True), col), (HX, HY))
        out.alpha_composite(rider, (24 - RIDER // 2, HY + 13 + bob - RIDER))
    return shrink(out)


def shrink(im):
    """Réduction d'ensemble 48 → 40 (BOX), chaque pixel recalé sur une couleur du sprite d'origine : pas de teintes mélangées, contours nets."""
    palette = sorted({im.getpixel((x, y))[:3] for x in range(im.width) for y in range(im.height) if im.getpixel((x, y))[3] >= 200})
    r = im.resize((OUT_SIZE, OUT_SIZE), Image.BOX)
    px = r.load()
    for y in range(OUT_SIZE):
        for x in range(OUT_SIZE):
            c = px[x, y]
            px[x, y] = (0, 0, 0, 0) if c[3] < 128 else min(palette, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2) + (255,)
    return r


def b64(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


os.makedirs(OUT, exist_ok=True)
result = {}
sheet = Image.new('RGBA', (4 * (OUT_SIZE * 3 + 8), len(CLASSES) * (OUT_SIZE * 3 + 2)), (0, 168, 200, 255))
for r, cls in enumerate(CLASSES):
    entry = {}
    for view in DIRS:
        entry[view] = b64(mounted(cls, view, 0))
        for n in range(FRAMES):
            entry[f'walk_{view}_{n}'] = b64(mounted(cls, view, n))
    result[f'{cls}_horse'] = entry
    for c, view in enumerate(DIRS):
        sheet.alpha_composite(mounted(cls, view, 0).resize((OUT_SIZE * 3, OUT_SIZE * 3), Image.NEAREST), (c * (OUT_SIZE * 3 + 8), r * (OUT_SIZE * 3 + 2)))
json.dump(result, open(os.path.join(OUT, 'mounted.json'), 'w'))
sheet.save(os.path.join(OUT, 'preview.png'))
print('OK', ', '.join(result))
