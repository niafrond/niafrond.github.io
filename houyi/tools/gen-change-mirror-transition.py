#!/usr/bin/env python3
"""Animation « Hou Yi parle à son demi-miroir → reflet → Chang'e » (futur mode Chang'e) : transition procédurale centrée sur le miroir.
Entrées : deux images clés qui tiennent LE MÊME demi-miroir au même endroit (tools/gen-change-mirror-keys.py + change-mirror-hands.py).
Phases (24 i/s, 6,5 s) : 1) Hou Yi parle (respiration, scintillement qui balaie la face du miroir, ondes de voix) ; 2) le miroir s'embrase ;
3) le reflet s'ouvre en cercle depuis le miroir et révèle Chang'e (anneau lumineux, ondulation radiale, zoom avant sur le miroir puis recul) ;
4) Chang'e sourit au miroir, la lumière retombe. Rendu à 576×1024, réduit au plus proche voisin à 144×256, palette commune de 48 couleurs.
Usage : python3 tools/gen-change-mirror-transition.py A.png B.png sortie_dir [--cx 300 --cy 600 --r 150 --size 144,256 --voice x,y]
(coordonnées en pixels de l'image d'entrée ; --voice : position de la bouche pour les ondes de voix, absent = pas d'ondes)"""
import os, sys, math
import numpy as np
from PIL import Image

A, B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
FPS, N = 24, 156
W0, H0 = Image.open(A).size
F = min(1.0, 640.0 / W0)           # calcul à 640 px de large au plus (les coordonnées passées restent en pixels de l'image d'origine)
W, H = int(W0 * F), int(H0 * F)
S = W / 576.0                      # tous les réglages en pixels sont exprimés pour une image de 576 de large
CX, CY = arg('--cx', 300) * F, arg('--cy', 600) * F
OUT_SIZE = tuple(int(v) for v in sys.argv[sys.argv.index('--size') + 1].split(',')) if '--size' in sys.argv else (144, 256)
VOICE = tuple(float(v) * F for v in sys.argv[sys.argv.index('--voice') + 1].split(',')) if '--voice' in sys.argv else None
a = np.asarray(Image.open(A).convert('RGB').resize((W, H)), dtype=np.float32)
b = np.asarray(Image.open(B).convert('RGB').resize((W, H)), dtype=np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
dist = np.hypot(xx - CX, yy - CY)
ang = np.arctan2(yy - CY, xx - CX)
R_MIRROR = arg('--r', 150.0) * F
RMAX = float(np.hypot(max(CX, W - CX), max(CY, H - CY))) + 40
smooth = lambda t: t * t * (3 - 2 * t)
clamp = lambda v, lo=0.0, hi=1.0: max(lo, min(hi, v))

def zoom(img, s, ox=0.0, oy=0.0):
    """Zoom centré sur le miroir (plus proche voisin)."""
    sx = np.clip(((xx - CX) / s + CX + ox).astype(int), 0, W - 1); sy = np.clip(((yy - CY) / s + CY + oy).astype(int), 0, H - 1)
    return img[sy, sx]

def glow(img, k, radius, col=(235, 245, 255)):
    g = np.exp(-(dist / radius) ** 2)[..., None] * k
    return img * (1 - g) + np.array(col, np.float32) * g

def frame(i):
    t = i / FPS
    # --- phase 1-2 : Hou Yi parle (0 – 2,6 s), puis le miroir s'embrase (2,6 – 3,6 s)
    bob = 2.5 * S * math.sin(t * 2 * math.pi * 0.9)
    img_a = zoom(a, 1.0 + 0.012 * math.sin(t * 5), 0, bob)
    img_b = zoom(b, 1.0, 0, 0)
    # scintillement : une bande claire diagonale balaie la face du miroir
    sweep = ((xx - CX) * 0.8 + (yy - CY) * 0.6 - (((t * 260 * S) % (700 * S)) - 250 * S))
    band = np.exp(-(sweep / (18.0 * S)) ** 2) * (dist < R_MIRROR + 20 * S) * (xx < CX + 110 * S)
    img_a = img_a + band[..., None] * 90 * (t < 3.8)
    # ondes de voix : arcs qui partent de la bouche (Hou Yi) vers le miroir
    mouth = VOICE or (0, 0)
    for j in range(3 if VOICE else 0):
        ph = (t * 1.3 + j / 3.0) % 1.0
        r = (20 + ph * 90) * S
        d = np.hypot(xx - mouth[0], yy - mouth[1])
        ring = np.exp(-((d - r) / (3.0 * S)) ** 2) * (1 - ph) * (xx > mouth[0] - 5) * (t < 2.8) * (0.55 if ph < 0.99 else 0)
        img_a = img_a + ring[..., None] * np.array([255, 240, 190], np.float32) * 0.45
    k_glow = smooth(clamp((t - 2.4) / 1.4))
    # --- phase 3 : le reflet s'ouvre (3,2 – 4,9 s)
    p = smooth(clamp((t - 3.2) / 1.7))
    z_a = 1.0 + 0.35 * smooth(clamp((t - 2.8) / 2.0))           # on plonge dans le miroir
    z_b = 1.35 - 0.35 * smooth(clamp((t - 3.4) / 2.2))           # Chang'e recule
    img_a = zoom(a, z_a, 0, bob * (1 - p)) if p > 0 or t > 2.8 else img_a
    if t > 2.8:
        img_a = img_a + band[..., None] * 0  # (la bande a disparu)
    img_b = zoom(b, z_b)
    radius = p * RMAX                                          # le reflet naît au centre du miroir (rien avant p > 0)
    wob = 1 + 0.045 * np.sin(ang * 9 + t * 9) * (1 - p) + 0.02 * np.sin(ang * 5 - t * 6)
    inside = (dist * wob) < radius
    ring_d = np.abs(dist * wob - radius)
    out = np.where(inside[..., None], img_b, img_a)
    if 0 < p < 1:
        rg = np.exp(-(ring_d / (9.0 * S)) ** 2) * (1 - 0.3 * p)
        out = out * (1 - rg[..., None]) + np.array([245, 250, 255], np.float32) * rg[..., None]
        halo = np.exp(-(ring_d / (40.0 * S)) ** 2) * 0.35
        out = out * (1 - halo[..., None]) + np.array([200, 225, 255], np.float32) * halo[..., None]
    out = glow(out, 0.8 * k_glow * (1 - smooth(clamp((t - 4.0) / 0.8))), (170 + 150 * k_glow) * S)
    # --- phase 4 : Chang'e (à partir de 4,9 s) : scintillement sur le miroir, lumière qui retombe
    if t > 4.9:
        sw = ((xx - CX) * 0.8 + (yy - CY) * 0.6 - (((t - 4.9) * 300 * S) % (700 * S) - 250 * S))
        bd = np.exp(-(sw / (16.0 * S)) ** 2) * (dist < R_MIRROR + 20 * S) * (xx < CX + 110 * S)
        out = out + bd[..., None] * 80 * clamp(1 - (t - 4.9) / 1.6)
    # pétales / lucioles montantes en fin de plan
    if t > 3.6:
        rng = np.random.RandomState(7)
        for _ in range(26):
            x0, y0, sp = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(40, 110) * S
            y = (y0 - (t - 3.6) * sp) % H; x = x0 + 14 * S * math.sin(t * 2 + x0)
            Z = max(3, int(5 * S)); out[int(y):int(y) + Z, int(x):int(x) + Z] = out[int(y):int(y) + Z, int(x):int(x) + Z] * 0.3 + np.array([255, 245, 200], np.float32) * 0.7 * clamp(min(1, (t - 3.6) * 1.5))
    return np.clip(out, 0, 255).astype(np.uint8)

os.makedirs(OUT, exist_ok=True)
raw = [Image.fromarray(frame(i)).resize(OUT_SIZE, Image.NEAREST) for i in range(N)]
pal_src = Image.new('RGB', (OUT_SIZE[0] * 4, OUT_SIZE[1]))
for k, im in enumerate([raw[0], raw[N // 2], raw[N - 1], raw[int(N * 0.6)]]): pal_src.paste(im, (k * OUT_SIZE[0], 0))
pal = pal_src.quantize(64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
frames = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in raw]
for i, f in enumerate(frames): f.convert('RGB').save(f'{OUT}/f{i:03d}.png')
frames[0].save(f'{OUT}/preview.gif', save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0, optimize=False)
print(f'{N} images ({N / FPS:.1f} s) -> {OUT}')
