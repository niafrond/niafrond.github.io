#!/usr/bin/env python3
"""Variante « rotation » de l'animation Hou Yi → Chang'e : la caméra tourne autour du miroir (axe vertical passant par son centre) et passe de
l'autre côté ; au moment où le miroir est vu par la tranche, son rebord doré (fin croissant) masque le raccord entre les deux scènes.
Phases (24 i/s, 6,5 s) : 1) Hou Yi regarde le miroir (respiration, scintillement, léger avancement) ; 2) le miroir s'embrase ; 3) rotation de 0 à 90°
de la scène A (perspective), le rebord du miroir de profil et son éclat couvrent le changement, puis la scène B revient de -90° à 0 ;
4) Chang'e regarde le miroir, la lumière retombe, pétales. Mêmes entrées que gen-change-mirror-transition.py.
Usage : python3 tools/gen-change-mirror-rotation.py A.png B.png sortie_dir [--cx 900 --cy 600 --r 330 --size 192,192]"""
import os, sys, math
import numpy as np
from PIL import Image

A, B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
FPS, N = 24, 156
W0, H0 = Image.open(A).size
F = min(1.0, 640.0 / W0)
W, H = int(W0 * F), int(H0 * F)
S = W / 576.0
CX, CY = arg('--cx', 900) * F, arg('--cy', 600) * F
R = arg('--r', 330) * F
OUT_SIZE = tuple(int(v) for v in sys.argv[sys.argv.index('--size') + 1].split(',')) if '--size' in sys.argv else (192, 192)
a = np.asarray(Image.open(A).convert('RGB').resize((W, H)), dtype=np.float32)
b = np.asarray(Image.open(B).convert('RGB').resize((W, H)), dtype=np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
smooth = lambda t: t * t * (3 - 2 * t)
clamp = lambda v, lo=0.0, hi=1.0: max(lo, min(hi, v))
FOC = 1.1 * W


def turn(img, theta, zoom=1.0, dy=0.0):
    """Plan tournant d'un angle theta autour de l'axe vertical x = CX (perspective) ; hors image : bord répété et assombri."""
    X = (xx - CX) / zoom; Y = (yy - CY) / zoom
    c, s = math.cos(theta), math.sin(theta)
    den = c - X * s / FOC
    den = np.where(np.abs(den) < 1e-3, 1e-3, den)
    u = X / den
    sc = 1 + u * s / FOC
    v = Y * sc
    sx, sy = CX + u, CY + v + dy
    ok = (den > 0) & (sc > 0.05) & (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
    out = img[np.clip(sy.astype(int), 0, H - 1), np.clip(sx.astype(int), 0, W - 1)]
    edge = img[np.clip(((yy - CY) / zoom + CY).astype(int), 0, H - 1), np.clip(((xx - CX) / zoom + CX).astype(int), 0, W - 1)] * 0.35
    return np.where(ok[..., None], out, edge)


def rim(out, k):
    """Rebord du miroir vu par la tranche : fine lame dorée verticale à x = CX, cœur blanc, halo."""
    if k <= 0: return out
    hh = R * 1.05
    d = np.abs(xx - CX)
    prof = np.clip(1 - np.abs(yy - CY) / hh, 0, 1) ** 0.5
    core = np.exp(-(d / (5.0 * S)) ** 2) * prof
    gold = np.exp(-(d / (14.0 * S)) ** 2) * prof
    halo = np.exp(-(d / (70.0 * S)) ** 2) * prof * 0.5
    col = out * (1 - halo[..., None] * k) + np.array([255, 225, 150], np.float32) * halo[..., None] * k
    col = col * (1 - gold[..., None] * k) + np.array([240, 190, 90], np.float32) * gold[..., None] * k
    return col * (1 - core[..., None] * k) + np.array([255, 252, 235], np.float32) * core[..., None] * k


def sparkle(img, t0, strength):
    sw = ((xx - CX) * 0.8 + (yy - CY) * 0.6 - ((t0 * 260 * S) % (700 * S) - 250 * S))
    return img + (np.exp(-(sw / (18.0 * S)) ** 2) * (np.hypot(xx - CX, yy - CY) < R + 20 * S) * (xx < CX + 110 * S))[..., None] * 90 * strength


def frame(i):
    t = i / FPS
    T0, T1, T2 = 2.7, 3.55, 4.4          # début de la rotation, mur (miroir de profil), fin de la rotation
    push = 1.0 + 0.08 * smooth(clamp(t / T1))
    bob = 2.5 * S * math.sin(t * 2 * math.pi * 0.9) * (1 - smooth(clamp((t - 1.8) / 1.0)))
    if t < T1:
        th = (math.pi / 2) * smooth(clamp((t - T0) / (T1 - T0)))
        out = turn(a, th, push * (1 + 0.1 * smooth(clamp((t - T0) / (T1 - T0)))), bob)
        out = sparkle(out, t, 1.0 if t < 2.7 else 0)
        edge_k = smooth(clamp((th - 1.2) / 0.37))
    else:
        th = -(math.pi / 2) * (1 - smooth(clamp((t - T1) / (T2 - T1))))
        out = turn(b, th, 1.1 - 0.1 * smooth(clamp((t - T1) / (T2 - T1))) , 0)
        edge_k = smooth(clamp((-th - 1.2) / 0.37))
    # embrasement du miroir avant la rotation, éclat au passage de la tranche
    g = smooth(clamp((t - 1.9) / 0.9)) * (1 - smooth(clamp((t - 4.0) / 0.9)))
    d = np.hypot(xx - CX, yy - CY)
    gl = (np.exp(-(d / ((120 + 80 * g) * S)) ** 2) * (0.3 * g + 0.22 * edge_k))[..., None]
    out = out * (1 - gl) + np.array([240, 246, 255], np.float32) * gl
    out = rim(out, edge_k)
    if t > 4.4:
        out = sparkle(out, t - 4.4, clamp(1 - (t - 4.4) / 1.4))
    if t > 3.6:
        rng = np.random.RandomState(7)
        for _ in range(26):
            x0, y0, sp = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(40, 110) * S
            y = (y0 - (t - 3.6) * sp) % H; x = x0 + 14 * S * math.sin(t * 2 + x0); Z = max(3, int(5 * S))
            out[int(y):int(y) + Z, int(x):int(x) + Z] = out[int(y):int(y) + Z, int(x):int(x) + Z] * 0.3 + np.array([255, 245, 200], np.float32) * 0.7 * clamp((t - 3.6) * 1.5)
    return np.clip(out, 0, 255).astype(np.uint8)


os.makedirs(OUT, exist_ok=True)
raw = [Image.fromarray(frame(i)).resize(OUT_SIZE, Image.NEAREST) for i in range(N)]
pal_src = Image.new('RGB', (OUT_SIZE[0] * 5, OUT_SIZE[1]))
for k, im in enumerate([raw[0], raw[N // 2 - 12], raw[N // 2], raw[N // 2 + 10], raw[N - 1]]): pal_src.paste(im, (k * OUT_SIZE[0], 0))
pal = pal_src.quantize(64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
frames = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in raw]
for i, f in enumerate(frames): f.convert('RGB').save(f'{OUT}/f{i:03d}.png')
frames[0].save(f'{OUT}/preview.gif', save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0, optimize=False)
print(f'{N} images ({N / FPS:.1f} s) -> {OUT}')
