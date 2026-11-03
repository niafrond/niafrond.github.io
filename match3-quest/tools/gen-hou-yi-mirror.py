#!/usr/bin/env python3
"""Hou Yi tenant le demi-miroir (même miroir et même place que Chang'e, voir gen-change-mirror-keys.py), GÉNÉRÉ par gm (txt2img, pas l'image du
lanceur) : buste serré sur le visage, puis demi-miroir collé, main dessinée sur le bord plat et fondue par img2img.
Usage (WSL, venv comfyui, PYTHONPATH=game-maker) : python tools/gen-hou-yi-mirror.py [--n 4]  ->  sprites/cinematics-change/keys4/hou_yi_<n>.png"""
import importlib.util, os, sys
from PIL import Image
from gamemaker import comfy

def load(name, path):
    sp = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m

K = load('keys', 'tools/gen-change-mirror-keys.py'); HD = load('hands', 'tools/change-mirror-hands.py')
OUT = 'sprites/cinematics-change/keys4'
N = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 6
os.makedirs(OUT, exist_ok=True)
c = comfy.Client()
mirror = K.half_mirror(False)
PROMPT = ('close-up bust of Hou Yi, the legendary Chinese divine archer, handsome 30-year-old man with a stern kind face, black hair in a topknot with a gold hairpin, '
          'dark green hanfu with gold trim and a crossed collar, face in the upper third of the image, one hand raised in front of his chest holding a half round bronze mirror, '
          'looking down at the mirror and speaking softly to it, bamboo forest with golden light behind, ' + K.STYLE)
for n in range(N):
    raw = f'{OUT}/raw_{n}.png'
    c.fetch(c.run(comfy.pixel_txt2img(PROMPT, K.W, K.H, 8100 + n, K.NEG + ', spear, bow, arrows, quiver, beard, text', prefix='gm/seq'))[0], raw)
    im = Image.open(raw).convert('RGBA'); K.put_mirror(im, mirror, K.MX, K.MY, K.MW)
    skin = HD.skin(im, (0.25, 0.1, 0.75, 0.4))
    HD.hand(im.convert('RGB'), skin).save(f'{OUT}/_comp.png')
    c.fetch(c.run(comfy.pixel_img2img(c.upload_image(f'{OUT}/_comp.png'), PROMPT, 0.3, 8200 + n, K.NEG + ', spear, bow, arrows, quiver', prefix='gm/seq'))[0], f'{OUT}/hou_yi_{n}.png')
    print('hou_yi', n, flush=True)
