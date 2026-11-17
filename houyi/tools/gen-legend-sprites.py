#!/usr/bin/env python3
"""gen-legend-sprites.py — Dessins de carte des quatre Gardiens Célestes (boss des quêtes de légende, world/legends.js).

Chaque Gardien est pixellisé depuis son invoqué détouré (sprites/ultimates-seq/<ultimate>/elements/entity.png, voir tools/sequences/<ultimate>.json) :
rognage au contenu, cadre carré, réduction à 64×64, 28 couleurs sans tramage, contour sombre #2b1b17 (charte des ennemis) ; le résultat est écrit en PNG data URI dans
sprites/cn/legends.js (paquet « legends » : sprites/packContents.js), sous la clé du boss (`legend_zhuque_boss`…) pour ne pas changer le dessin des mêmes créatures en rencontre aléatoire.
Relancer ensuite : node match3-quest/sprites/build-packs.mjs   (met à jour l'index sprites/packs.js).

Usage (WSL) : python3 tools/gen-legend-sprites.py
"""
import os, io, base64
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE, COLORS, OUTLINE = 64, 28, (43, 27, 23)
# clé du dessin (id du boss de world/legends.js) : ultimate dont l'invoqué sert de modèle
LEGENDS = {
    'legend_zhuque_boss': 'ultimateVermilionBird',
    'legend_xuanwu_boss': 'ultimateBlackTortoise',
    'legend_baihu_boss': 'ultimateWhiteTiger',
    'legend_qinglong_boss': 'ultimateAzureDragon',
}


def pixelize(path):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    box = a.getbbox()
    im = im.crop(box)
    a = a.crop(box)
    side = max(im.size)
    inner = SIZE - 4   # 2 px de marge autour pour le contour
    k = inner / side
    w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
    rgb = im.convert('RGB').resize((w, h), Image.BOX)
    mask = a.resize((w, h), Image.BOX).point(lambda v: 255 if v > 110 else 0)
    q = rgb.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB')
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ox, oy = (SIZE - w) // 2, SIZE - 2 - h   # pieds posés en bas du cadre, comme les autres ennemis
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    layer.paste(q, (0, 0), mask)
    out.alpha_composite(layer, (ox, oy))
    px = out.load()
    full = [[px[x, y][3] > 0 for x in range(SIZE)] for y in range(SIZE)]
    for y in range(SIZE):   # contour d'un pixel autour de la silhouette
        for x in range(SIZE):
            if full[y][x]:
                continue
            if any(0 <= x + dx < SIZE and 0 <= y + dy < SIZE and full[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = OUTLINE + (255,)
    return out


def data_uri(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


lines = ['// Dessins de carte des quatre Gardiens Célestes (boss des quêtes de légende, world/legends.js).',
         '// Fichier généré par tools/gen-legend-sprites.py (PNG 64×64 pixellisés depuis leur invoqué) — ne pas modifier à la main.',
         'export const LEGEND_SPRITES = {']
for key, ultimate in LEGENDS.items():
    src = os.path.join(GAME, 'sprites', 'ultimates-seq', ultimate, 'elements', 'entity.png')
    uri = data_uri(pixelize(src))
    lines.append(f"  {key}: '{uri}',")
    print(f'{key} <- {ultimate} ({len(uri) // 1024} Ko)')
lines.append('};\n')
open(os.path.join(GAME, 'sprites', 'cn', 'legends.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('sprites/cn/legends.js écrit')
