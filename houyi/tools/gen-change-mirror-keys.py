#!/usr/bin/env python3
"""Images clés de l'animation « Hou Yi parle au demi-miroir → reflet → Chang'e » (futur mode Chang'e), cadrées visage + main + miroir.
Le demi-miroir est dessiné en code : le MÊME pour les deux, collé au même endroit (centre de la transition) ; Hou Yi part de l'image du lanceur
(sprites/launcher/1-port.png), Chang'e d'un buste généré, puis img2img (ComfyUI, gm) pour que les mains tiennent bien le miroir.
Usage (WSL, venv comfyui, PYTHONPATH=game-maker) : python tools/gen-change-mirror-keys.py [--n 4]
Sortie : sprites/cinematics-change/keys2/{mirror,hou_yi_<n>,change_<n>}.png"""
import os, sys
from PIL import Image, ImageDraw
from gamemaker import comfy, pixel

OUT = 'sprites/cinematics-change/keys2'
W, H = 576, 1024
MX, MY, MW = 0.5, 0.64, 0.46     # position commune du miroir (fractions de l'image)
N = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 4
STYLE = 'pixel art, 16-bit pixel art illustration, ancient China mythology, cinematic close-up, soft glowing light, rich colors, no text'
NEG = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, full circle mirror, two mirrors'


def half_mirror(flip=False, r=34):
    """Demi-miroir de bronze en pixel art (rayon r en pixels d'art, bord droit plat), face argentée, anneau, nuages, gland rouge."""
    w, h = r + 8, 2 * r + 24
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cy = r + 4
    box = (-r + (w - 4), cy - r, r + (w - 4), cy + r)
    d.pieslice(box, 90, 270, fill=(70, 42, 24, 255))                                   # contour sombre
    d.pieslice((box[0] + 2, box[1] + 2, box[2] - 2, box[3] - 2), 90, 270, fill=(176, 118, 52, 255))   # bronze
    d.pieslice((box[0] + 6, box[1] + 6, box[2] - 6, box[3] - 6), 90, 270, fill=(214, 168, 84, 255))   # anneau clair
    d.pieslice((box[0] + 9, box[1] + 9, box[2] - 9, box[3] - 9), 90, 270, fill=(196, 214, 226, 255))  # face argentée
    d.pieslice((box[0] + 13, box[1] + 13, box[2] - 13, box[3] - 13), 90, 270, fill=(232, 242, 250, 255))
    for k in range(-2, 3):                                                                # petits nuages (yunwen) gravés
        x, y = w - 18, cy + k * 10
        d.arc((x - 6, y - 3, x, y + 3), 90, 270, fill=(150, 120, 80, 255)); d.arc((x - 3, y - 5, x + 3, y + 1), 0, 180, fill=(150, 120, 80, 255))
    d.line((w - 4, cy - r, w - 4, cy + r), fill=(70, 42, 24, 255), width=2)               # bord de cassure
    d.line((w - 5, cy - r + 3, w - 5, cy + r - 3), fill=(120, 80, 40, 255), width=1)
    for i in range(5):
        d.line((w - 40 - i, cy + r + 2, w - 40 - i, cy + r + 10 + i), fill=(190, 40, 40, 255))   # gland rouge
    d.rectangle((w - 42, cy + r - 1, w - 36, cy + r + 2), fill=(214, 168, 84, 255))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def put_mirror(im, mirror, cx, cy, w):
    return pixel.paste(im, mirror, cx, cy, w)


def main():
    os.makedirs(OUT, exist_ok=True)
    c = comfy.Client()
    a = half_mirror(False)
    a.save(f'{OUT}/mirror.png')
    # Hou Yi : visage + main, recadré dans l'image du lanceur (la partie basse de la foret est conservée)
    src = Image.open('sprites/launcher/1-port.png').crop((0, 0, 144, 256)).convert('RGB')
    crop = src.crop((26, 62, 134, 62 + 192)).resize((W, H), Image.NEAREST)               # 108×192 : visage en haut, mains en bas
    for n in range(N):
        im = crop.convert('RGBA'); put_mirror(im, a, MX, MY, MW)
        comp = f'{OUT}/_hy_comp.png'; im.convert('RGB').save(comp)
        prompt = ('the archer in green hanfu looks at a half round bronze mirror held up in his raised hand in front of his chest, his lips parted as if speaking to it, ' + STYLE)
        c.fetch(c.run(comfy.pixel_img2img(c.upload_image(comp), prompt, 0.45 + 0.03 * n, 5200 + n, NEG + ', spear, bow', prefix='gm/seq'))[0], f'{OUT}/hou_yi_{n}.png')
        print('hou_yi', n, flush=True)
    # Chang'e : buste généré, puis le même demi-miroir dans sa main à la même place
    for n in range(N):
        raw = f'{OUT}/change_raw{n}.png'
        prompt = ("Chang'e, the beautiful Chinese moon goddess, young woman with a gentle face, white and pale silver hanfu with wide sleeves, black hair in an elaborate updo with a gold hairpin and long ribbons, "
                  'one hand raised in front of her chest holding the same half of a round bronze mirror, looking at the mirror, bamboo forest background with golden light, ' + STYLE)
        c.fetch(c.run(comfy.pixel_txt2img(prompt, W, H, 6200 + n, NEG + ', man, male, beard', prefix='gm/seq'))[0], raw)
        im = Image.open(raw).convert('RGBA'); put_mirror(im, a, MX, MY, MW)
        comp = f'{OUT}/_ch_comp.png'; im.convert('RGB').save(comp)
        c.fetch(c.run(comfy.pixel_img2img(c.upload_image(comp), prompt, 0.4, 6300 + n, NEG + ', man, male', prefix='gm/seq'))[0], f'{OUT}/change_{n}.png')
        print('change', n, flush=True)


if __name__ == '__main__':
    main()
