#!/usr/bin/env python3
"""Échange le contenu (reflet) des deux miroirs : Hou Yi voit Chang'e dans le miroir, Chang'e y voit Hou Yi. Les deux images ont le miroir au même
endroit ; le reflet est une ellipse (bord adouci) copiée d'une image dans l'autre.
Usage : python3 tools/swap-mirror-reflections.py hou_yi.png change.png sortie_dir [--cx 850 --cy 590 --rx 200 --ry 300 --feather 14]"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

A, B, OUT = sys.argv[1:4]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
cx, cy, rx, ry, fe = arg('--cx', 850), arg('--cy', 590), arg('--rx', 200), arg('--ry', 300), arg('--feather', 14)
a, b = Image.open(A).convert('RGB'), Image.open(B).convert('RGB')
W, H = a.size
yy, xx = np.mgrid[0:H, 0:W]
m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0).astype(np.uint8) * 255
mask = Image.fromarray(m).filter(ImageFilter.GaussianBlur(fe))
os.makedirs(OUT, exist_ok=True)
Image.composite(b, a, mask).save(f'{OUT}/hou_yi.png')      # Hou Yi voit Chang'e
Image.composite(a, b, mask).save(f'{OUT}/change.png')      # Chang'e voit Hou Yi
Image.fromarray(m).save(f'{OUT}/_mask.png')
