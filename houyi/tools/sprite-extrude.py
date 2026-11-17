#!/usr/bin/env python3
"""sprite-extrude.py — Sprite de face en pixel art → volume de voxels → autres vues (gauche, droite, dos…), par algorithme seul (aucune IA, aucune texture 3D).

Chaque pixel opaque du sprite devient une colonne de voxels dont l'épaisseur vient de la forme de la silhouette (distance au bord : une tête ronde est
épaisse, un bras fin est mince, profil en dôme). La couleur de face reste celle du pixel ; le reste du volume (flancs, dos) prend la couleur « de fond » du
sprite (médiane qui efface yeux, bouche et autres petits détails). Les vues se rendent ensuite en orthographique, sans moyenne de couleurs, avec un contour sombre.
Règles par région (humanoïdes de type chibi) : la tête (du haut jusqu'au cou, repéré comme la rangée la plus étroite) est un ellipsoïde, le corps est aplati
(0,8 × l'épaisseur du dôme), un nez est ajouté sous la ligne des yeux, et les profils reçoivent un œil, un sourcil et une oreille posés d'après les yeux du sprite
de face. Limites : l'épaisseur reste une heuristique et les règles supposent un personnage de face avec tête au-dessus du corps (les animaux demandent d'autres règles).

Usage : python tools/sprite-extrude.py sprites/png/companion_zhi_front.png [--out dossier] [--thick 3.0] [--cap 11]
Écrit <out>/<nom>_{left,right,back,front}.png et <nom>_sheet.png (aperçu ×8).
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt, median_filter


def build(front, thick=3.0, cap=11):
    """Retourne la liste des voxels (x, y, z, rgb) : x droite, y bas, z vers la caméra de face."""
    a = np.asarray(front.convert("RGBA"))
    opaque = a[..., 3] > 0
    h, w = opaque.shape
    # le contour sombre du sprite n'est pas de la matière : on l'écarte du volume (et on le redessine après la rotation)
    lum = a[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    edge = opaque & ~np.pad(opaque, 1)[:-2, 1:-1].astype(bool) | opaque & ~np.pad(opaque, 1)[2:, 1:-1].astype(bool) | opaque & ~np.pad(opaque, 1)[1:-1, :-2].astype(bool) | opaque & ~np.pad(opaque, 1)[1:-1, 2:].astype(bool)
    m = opaque & ~(edge & (lum < 70))
    d = distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1]
    half = np.minimum(np.sqrt(d) * thick, cap)
    # couleur de fond : médiane 5×5 par canal, sur les seuls pixels opaques (efface les détails fins)
    gy, gx = np.gradient(half)
    slope = np.hypot(gx, gy)
    base = np.zeros((h, w, 3), np.uint8)
    for c in range(3):
        ch = np.where(m, a[..., c], 0).astype(float)
        cnt = median_filter(m.astype(float), size=5)
        med = median_filter(np.where(m, a[..., c], np.nan).astype(float) if False else ch, size=5)
        base[..., c] = np.where(m, np.where(cnt > 0.3, med, a[..., c]), 0)
    meta = analyse(a, m, lum)
    ney = meta["neck"]
    if ney is not None:
        cx_h, cy_h = meta["head_cx"], meta["head_cy"]; rx, ry = meta["head_rx"], meta["head_ry"]
        for y in range(h):
            for x in range(w):
                if not m[y, x]: continue
                if y < ney:   # tête : ellipsoïde
                    e = 1 - ((x - cx_h) / rx) ** 2 - ((y - cy_h) / ry) ** 2
                    half[y, x] = max(1.0, min(cap, rx * 0.95 * np.sqrt(max(e, 0.0))))
                else:         # corps : aplati
                    half[y, x] = max(1.0, half[y, x] * 0.8)
    if meta["skin"] is not None and ney is not None: base[:ney][m[:ney]] = meta["skin"].astype(np.uint8)   # crâne et visage : une seule couleur de peau
    vox = []
    for y, x in zip(*np.where(m)):
        t = int(round(half[y, x]))
        for z in range(-t, t + 1):
            col = a[y, x, :3] if (z == t and slope[y, x] < 1.0) else base[y, x]   # couleur de face seulement sur la calotte quasi frontale
            vox.append((x - (w - 1) / 2, y, z, col))
    if meta["nose"] is not None:   # nez : deux voxels qui dépassent du visage
        nx, ny = meta["nose"]
        for dy, ext in ((0, 2), (-1, 1)):
            if m[ny + dy, nx]:
                t = int(round(half[ny + dy, nx]))
                for z in range(t + 1, t + ext + 1): vox.append((nx - (w - 1) / 2, ny + dy, z, meta["skin"].astype(np.uint8)))
    return vox, (w, h), meta


def analyse(a, m, lum):
    """Tête, cou, yeux, nez et couleur de peau du sprite de face."""
    h, w = m.shape
    width = m.sum(axis=1)
    top = int(np.argmax(m.any(axis=1)))
    head_max = int(np.argmax(width[: int(h * 0.7)]))
    rows = range(max(head_max + 2, int(h * 0.3)), int(h * 0.65))
    neck = min(rows, key=lambda y: (width[y], -y)) if len(rows) else None
    meta = {"neck": neck, "nose": None, "eyes": None, "skin": None}
    if neck is None: return meta
    cols = np.where(m[:neck].any(axis=0))[0]
    meta.update(head_cx=(cols.min() + cols.max()) / 2, head_rx=(cols.max() - cols.min() + 1) / 2, head_cy=(top + neck - 1) / 2, head_ry=(neck - top) / 2)
    # yeux : pixels sombres non opaques-au-bord, dans la moitié basse de la tête, hors contour
    inner = m & np.pad(m, 1)[:-2, 1:-1] & np.pad(m, 1)[2:, 1:-1] & np.pad(m, 1)[1:-1, :-2] & np.pad(m, 1)[1:-1, 2:]
    dark = inner & (lum < 110)
    ys, xs = np.where(dark[top + int((neck - top) * 0.35): neck - 2]); ys = ys + top + int((neck - top) * 0.35)
    if len(xs) >= 2:
        left, right = xs < meta["head_cx"], xs >= meta["head_cx"]
        if left.any() and right.any():
            ey = int(round(np.median(ys))); ex = [int(round(xs[left].mean())), int(round(xs[right].mean()))]
            meta["eyes"] = (ex, ey)
            meta["eye_color"] = a[ys, xs, :3][np.argmin(lum[ys, xs])]
            meta["nose"] = (int(round(sum(ex) / 2)), min(ey + 2, neck - 2))
    # peau : couleur médiane des pixels clairs de la tête, hors contour (sert aussi de couleur de fond du crâne et du visage)
    head = np.zeros_like(m); head[:neck] = inner[:neck] & (lum[:neck] > 140)
    if head.any(): meta["skin"] = np.median(a[head][:, :3], axis=0)
    return meta


def decorate(img, view, meta):
    """Profils : œil, sourcil et oreille d'après les yeux du sprite de face."""
    if meta["eyes"] is None or view not in ("left", "right"): return img
    ey = meta["eyes"][1]; top_rows = img[: meta["neck"]]
    cols = np.where(top_rows[..., 3].any(axis=0))[0]
    # bord avant de la tête (hors nez) : colonne la plus à gauche / droite sur la rangée des yeux
    row = np.where(img[ey, :, 3] > 0)[0]
    if not len(row): return img
    sgn = 1 if view == "left" else -1                      # direction du bord avant vers l'arrière de la tête
    front = row.min() if view == "left" else row.max()
    back = row.max() if view == "left" else row.min()
    depth = abs(back - front)
    eye = np.array(meta["eye_color"], np.uint8); skin = np.array(meta["skin"])
    out = img.copy()
    def put(x, y, c):
        if 0 <= y < out.shape[0] and 0 <= x < out.shape[1] and out[y, x, 3]: out[y, x, :3] = np.clip(c, 0, 255).astype(np.uint8)
    for dy in (0, 1): put(front + sgn * 3, ey + dy, eye)                                   # œil
    for dx in (2, 3, 4): put(front + sgn * dx, ey - 2, eye * 0.9)                          # sourcil
    cx = front + sgn * int(round(depth * 0.6))                                              # oreille, un peu en arrière du milieu
    warm = np.array([0.93, 0.80, 0.74])                                                     # oreille : peau plus chaude, creux plus sombre
    for dy in range(-2, 4):
        for dx in range(-2, 3):
            if (dx / 2.2) ** 2 + (dy - 0.5) ** 2 / 6.0 <= 1: put(cx + dx, ey + dy, skin * warm * (0.72 if (abs(dx) <= 1 and -1 <= dy <= 2) else 1.0))
    return out


def render(vox, size, view):
    w, h = size
    zb = np.full((h, w), -1e9); img = np.zeros((h, w, 4), np.uint8)
    for x, y, z, col in vox:
        r, dep = {"front": (x, z), "back": (-x, -z), "left": (-z, x), "right": (z, -x)}[view]
        c, row = int(np.floor(r + (w - 1) / 2 + 1e-6)), int(y)   # floor : round() arrondit les demis au pair et laissait un trou une colonne sur deux
        if 0 <= c < w and dep > zb[row, c]: zb[row, c] = dep; img[row, c, :3] = col; img[row, c, 3] = 255
    return img


def outline(img, dark=0.25):
    h, w = img.shape[:2]; res = img.copy()
    for j in range(h):
        for i in range(w):
            if img[j, i, 3]: continue
            nb = [img[y, x, :3] for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= y < h and 0 <= x < w and img[y, x, 3]]
            if nb: res[j, i] = [*(np.mean(nb, axis=0) * dark).round().astype(np.uint8), 255]
    return res


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else Path(".")
    out.mkdir(parents=True, exist_ok=True)
    src = Path(args[0]); name = src.stem.replace("_front", "")
    front = Image.open(src)
    pad = 6                                            # marge pour que les profils épais tiennent
    canvas = Image.new("RGBA", (front.width + 2 * pad, front.height), (0, 0, 0, 0)); canvas.paste(front, (pad, 0))
    vox, size, meta = build(canvas, opt("--thick", 3.0), int(opt("--cap", 11)))
    views = {v: render(vox, size, v) for v in ("left", "right", "back")}
    views = {"front": np.asarray(canvas.convert("RGBA")).copy(), **views}
    sheet = Image.new("RGBA", (size[0] * 4 * 8, size[1] * 8), (110, 120, 110, 255))
    for i, (v, im) in enumerate(views.items()):
        # le sprite de face garde son propre contour ; les autres reçoivent un contour sur leur silhouette
        res = im if v == "front" else outline(decorate(im, v, meta))
        Image.fromarray(res, "RGBA").save(out / f"{name}_{v}.png")
        sheet.alpha_composite(Image.fromarray(res, "RGBA").resize((size[0] * 8, size[1] * 8), Image.NEAREST), (i * size[0] * 8, 0))
    sheet.save(out / f"{name}_sheet.png")
    print("OK  ", name, len(vox), "voxels")


main()
