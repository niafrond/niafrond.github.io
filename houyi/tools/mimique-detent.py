#!/usr/bin/env python3
"""Retire les cornes et tentacules fines au-dessus du sprite de face de la mimique (ouvertures morphologiques sur le haut du sprite,
puis plus grande composante conservée), met à jour sprites/png/mimique_front.png et sprites/generated.js (clé `mimique`, `front`).
Usage : python3 tools/mimique-detent.py   (puis node tools/gen-attack-frames.mjs --only=mimique --jump --force)"""
import base64, io, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

PNG, GEN = 'sprites/png/mimique_front.png', 'sprites/generated.js'
a = np.array(Image.open(PNG).convert('RGBA'))
m = a[..., 3] > 0
for k, lim in ((5, 30), (8, 24)):          # (taille du noyau, ligne limite : on ne touche qu'au haut)
    rm = m & ~ndi.binary_opening(m, structure=np.ones((k, k)))
    rm[lim:] = False
    a[rm] = 0
    m = a[..., 3] > 0
lab, n = ndi.label(m)
a[lab != 1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1))))] = 0
img = Image.fromarray(a); img.save(PNG)
buf = io.BytesIO(); img.save(buf, 'PNG')
uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
t = open(GEN, encoding='utf-8').read()
i = t.index('  "mimique": {'); j = t.index('    front: "', i); k = t.index('",', j)
open(GEN, 'w', encoding='utf-8').write(t[:j] + f'    front: "{uri}' + t[k:])
