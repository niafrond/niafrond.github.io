#!/usr/bin/env python3
"""Animation Hou Yi → Chang'e par gm (Wan 2.2 14B, premiere et derniere image) : la caméra tourne DANS la scène autour du miroir en croissant et passe
de l'autre côté, le rebord du miroir masquant le raccord. Images de départ et d'arrivée = scènes `keys6/` (chacun voit l'autre dans le miroir).
Étapes : `video` (une vidéo Wan, ≈ 17 min dans WSL) puis `stitch` (arrêt sur Hou Yi, vidéo, arrêt sur Chang'e, réduction à 192×192, 64 couleurs).
Usage (WSL, venv comfyui, PYTHONPATH=game-maker) : python tools/gen-change-mirror-wan.py A.png B.png sortie_dir [--only video|stitch] [--frames 65] [--seed 777]"""
import glob, os, sys
from PIL import Image
from gamemaker import comfy, pixel

A, B, OUT = sys.argv[1:4]
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
ONLY = arg('--only', '')
FRAMES, SEED, SZ, HOLD = arg('--frames', 65), arg('--seed', 777), 640, 24
MOTION = ('pixel art cinematic shot, the camera slowly orbits around the glowing golden crescent moon mirror on its ornate stand, always keeping the mirror in the frame, '
          'moving behind the mirror to the other side, the golden rim of the mirror passes in front of the lens, on the other side a woman in white hanfu looks into the mirror '
          'and sees the archer reflected in it, smooth continuous camera rotation, night sky, stars')
NEG = 'blurry, smooth, photorealistic, 3d render, text, watermark, scene cut, jump cut, crossfade, dissolve, fade'
os.makedirs(OUT, exist_ok=True)
ka, kb = f'{OUT}/key_a.png', f'{OUT}/key_b.png'
for src, dst in ((A, ka), (B, kb)):
    Image.open(src).convert('RGB').resize((SZ, SZ), Image.LANCZOS).save(dst)
vid = f'{OUT}/wan'
if ONLY in ('', 'video') and not glob.glob(f'{vid}/*.png'):
    os.makedirs(vid, exist_ok=True)
    c = comfy.Client()
    wf = comfy.wan_flf(MOTION, c.upload_image(ka), c.upload_image(kb), SZ, SZ, FRAMES, SEED, NEG)
    for n, f in enumerate(c.run(wf)):
        if f[0].endswith('.png'):
            c.fetch(f, f'{vid}/{n:04d}.png')
    print('video :', len(glob.glob(f'{vid}/*.png')), 'images', flush=True)
if ONLY in ('', 'stitch'):
    fr = [Image.open(f).convert('RGB') for f in sorted(glob.glob(f'{vid}/*.png'))]
    seq = [Image.open(ka).convert('RGB')] * HOLD + fr + [Image.open(kb).convert('RGB')] * HOLD
    px = f'{OUT}/px'; os.makedirs(px, exist_ok=True)
    pal = pixel.palette_from([ka, kb, fr[len(fr) // 2]], (192, 192), 64)
    n = pixel._write_frames(seq, pal, (192, 192), px, 24)
    print(f'montage : {n} images ({n / 24:.1f} s) -> {px}')
