#!/usr/bin/env python3
"""Ajoute une main au demi-miroir de chaque image clé (la main saisit le bord droit plat : pouce sur la face, quatre doigts), à la
couleur de peau du visage, dessinée sur la grille 144×256 puis agrandie au plus proche voisin.
Usage : python3 tools/change-mirror-hands.py <image_in> <image_out> [--box x0,y0,x1,y1 (visage, fractions)]"""
import sys
import numpy as np
from PIL import Image, ImageDraw

def skin(im, box):
    a = np.array(im.convert('RGB')).astype(int); H, W, _ = a.shape
    x0, y0, x1, y1 = [int(v * s) for v, s in zip(box, (W, H, W, H))]
    p = a[y0:y1, x0:x1].reshape(-1, 3)
    p = p[(p[:, 0] > 150) & (p[:, 0] > p[:, 1] + 15) & (p[:, 1] > p[:, 2]) & (p[:, 0] < 250)]
    return tuple(int(v) for v in np.median(p, axis=0)) if len(p) else (224, 176, 140)

def hand(im, col, mx=0.5, my=0.64):
    W, H = im.size; g = 4
    lay = Image.new('RGBA', (W // g, H // g), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    sh = tuple(int(c * 0.78) for c in col); ol = tuple(int(c * 0.35) for c in col)
    fx = int((mx + 0.23) * W / g)              # bord plat droit du demi-miroir
    cy = int((my + 0.08) * H / g)
    d.ellipse((fx - 1, cy - 9, fx + 21, cy + 22), fill=ol)                       # paume (contour)
    d.ellipse((fx, cy - 8, fx + 20, cy + 21), fill=sh)
    for k in range(4):                                                            # quatre doigts qui dépassent à gauche du bord
        y = cy - 9 + k * 6
        d.rounded_rectangle((fx - 9, y, fx + 8, y + 5), 2, fill=ol); d.rounded_rectangle((fx - 8, y + 1, fx + 7, y + 4), 1, fill=col)
    d.rounded_rectangle((fx - 14, cy + 13, fx - 2, cy + 20), 3, fill=ol); d.rounded_rectangle((fx - 13, cy + 14, fx - 3, cy + 19), 2, fill=col)   # pouce
    out = im.convert('RGBA'); out.alpha_composite(lay.resize((W, H), Image.NEAREST)); return out.convert('RGB')

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    box = tuple(float(v) for v in sys.argv[sys.argv.index('--box') + 1].split(',')) if '--box' in sys.argv else (0.3, 0.1, 0.7, 0.4)
    im = Image.open(src); hand(im, skin(im, box)).save(dst)
