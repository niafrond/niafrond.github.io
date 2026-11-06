#!/usr/bin/env python3
"""render-companion-3d.py — Pixel art de face / gauche / droite d'un compagnon, rendu depuis son maillage 3D (tools/gen-companion-3d.mjs).

Le .glb de Hunyuan3D n'a pas de texture : chaque sommet reprend la couleur de l'image source projetée de face (la moitié arrière du maillage
reprend une version floutée, pour ne pas y dessiner les yeux). Rendu orthographique par z-buffer de points (supersampling ×16), ombrage par le
gradient de profondeur, puis réduction 32×32 (couleur moyenne par bloc), palette commune aux trois vues et contour sombre. L'échelle et la ligne
de pieds reprennent la boîte de sprites/png/<id>_front.png (même taille, même pose au sol que le sprite actuel).

Usage (WSL) : ~/.cache/game-maker/venvs/studio/bin/python tools/render-companion-3d.py companion_zhi [companion_yu …] [--px 32]
Écrit sprites/png/model3d/<id>_{front,left,right}.png et <id>_sheet.png (aperçu agrandi).
"""
import json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

PNG = Path(__file__).resolve().parent.parent / "sprites" / "png"
M3D = PNG / "model3d"
TOON = "--toon" in sys.argv   # rendu à bande de lumière (cel-shading) + palette fixe + couleur dominante par pixel + nettoyage algorithmique
SS = 6 if TOON else 16  # supersampling
FLAT = "--flat" in sys.argv
OUT = 2  # épaisseur du contour (px du sprite)


def load_glb(path):
    b = path.read_bytes()
    cl, = struct.unpack("<I", b[12:16])
    js = json.loads(b[20:20 + cl]); off = 20 + cl + 8
    a = js["accessors"][js["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
    bv = js["bufferViews"][a["bufferView"]]
    v = np.frombuffer(b[off + bv.get("byteOffset", 0):off + bv.get("byteOffset", 0) + a["count"] * 12], dtype="<f4").reshape(-1, 3).astype(np.float64)
    ai = js["accessors"][js["meshes"][0]["primitives"][0]["indices"]]; bi = js["bufferViews"][ai["bufferView"]]
    f = np.frombuffer(b[off + bi.get("byteOffset", 0):off + bi.get("byteOffset", 0) + ai["count"] * 4], dtype="<u4").reshape(-1, 3)
    n = vertex_normals(v, f)
    keep = ~strip_base(v)
    return v[keep], n[keep]


def load_glb_full(path):
    """(sommets, faces, masque des sommets conservés) : le maillage complet, pour l'exporter sans la dalle sous les pieds."""
    b = path.read_bytes()
    cl, = struct.unpack("<I", b[12:16])
    js = json.loads(b[20:20 + cl]); off = 20 + cl + 8
    prim = js["meshes"][0]["primitives"][0]
    a = js["accessors"][prim["attributes"]["POSITION"]]; bv = js["bufferViews"][a["bufferView"]]
    v = np.frombuffer(b[off + bv.get("byteOffset", 0):off + bv.get("byteOffset", 0) + a["count"] * 12], dtype="<f4").reshape(-1, 3).astype(np.float64)
    ai = js["accessors"][prim["indices"]]; bi = js["bufferViews"][ai["bufferView"]]
    f = np.frombuffer(b[off + bi.get("byteOffset", 0):off + bi.get("byteOffset", 0) + ai["count"] * 4], dtype="<u4").reshape(-1, 3)
    return v, f, ~strip_base(v)


def vertex_normals(v, f):
    """Normales lissées par sommet (deux passes de moyenne sur les faces), orientées vers l'extérieur."""
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    n = np.zeros_like(v)
    for _ in range(2):
        for i in range(3): np.add.at(n, f[:, i], fn)
        fn = n[f[:, 0]] + n[f[:, 1]] + n[f[:, 2]]
        if _ == 0: n = np.zeros_like(v)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    if ((v - v.mean(0)) * n).sum() < 0: n = -n
    return n


def strip_base(v):
    """Hunyuan3D ajoute une dalle plate sous les pieds, bien plus large que le personnage : on retire ce qui, dans les 6 % du bas, dépasse la boîte du corps."""
    y0, h = v[:, 1].min(), np.ptp(v[:, 1])
    body = v[v[:, 1] > y0 + 0.06 * h]
    lo, hi = body.min(0), body.max(0); m = 0.04 * h
    slab = (v[:, 1] <= y0 + 0.06 * h) & ((v[:, 0] < lo[0] - m) | (v[:, 0] > hi[0] + m) | (v[:, 2] < lo[2] - m) | (v[:, 2] > hi[2] + m))
    return slab


def vertex_colors(v, src):
    """Projette l'image source (fond blanc) sur les sommets : x,y du maillage → boîte du sujet dans l'image."""
    a = np.asarray(src.convert("RGB"), dtype=np.float64)
    mask = (np.abs(a - 255).max(axis=2) > 28)
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # version floutée « sans détails » (convolution normalisée sur le sujet) pour la moitié arrière
    m8 = Image.fromarray((mask * 255).astype(np.uint8))
    bl = lambda im: np.asarray(im.filter(ImageFilter.GaussianBlur(22)), dtype=np.float64)
    num = np.stack([bl(Image.fromarray((a[..., c] * mask).astype(np.uint8))) for c in range(3)], axis=2)
    den = bl(m8)[..., None] / 255 + 1e-3
    blur = np.clip(num / den, 0, 255)
    mn, mx = v.min(0), v.max(0)
    px = x0 + (v[:, 0] - mn[0]) / (mx[0] - mn[0]) * (x1 - x0)
    py = y1 - (v[:, 1] - mn[1]) / (mx[1] - mn[1]) * (y1 - y0)
    ix, iy = np.clip(px.round().astype(int), 0, a.shape[1] - 1), np.clip(py.round().astype(int), 0, a.shape[0] - 1)
    col = a[iy, ix]
    # pixels de fond touchés (bord) : on prend la valeur floutée
    col = np.where(mask[iy, ix][:, None], col, blur[iy, ix])
    back = v[:, 2] < (mn[2] + mx[2]) / 2 - 0.02
    return np.where(back[:, None], blur[iy, ix], col)


def gauss(a, sigma):
    r = int(sigma * 3); t = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); t /= t.sum()
    a = np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode="edge"), t, "valid"), 0, a)
    return np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode="edge"), t, "valid"), 1, a)


def side_colors(v, side):
    """Couleurs des sommets d'après la vue de profil (personnage tourné vers la gauche de l'image) : (z, y) du maillage → boîte du sujet."""
    a = np.asarray(side.convert("RGB"), dtype=np.float64)
    bg = a[:4, :4].reshape(-1, 3).mean(0)
    mask = np.abs(a - bg).max(axis=2) > 30
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mn, mx = v.min(0), v.max(0)
    px = x0 + (mx[2] - v[:, 2]) / (mx[2] - mn[2]) * (x1 - x0)      # l'avant du personnage (+z) est à gauche de l'image
    py = y1 - (v[:, 1] - mn[1]) / (mx[1] - mn[1]) * (y1 - y0)
    ix, iy = np.clip(px.round().astype(int), 0, a.shape[1] - 1), np.clip(py.round().astype(int), 0, a.shape[0] - 1)
    # pixel de fond touché : plus proche pixel du sujet sur la même ligne
    col = a[iy, ix].copy()
    miss = ~mask[iy, ix]
    if miss.any():
        near = np.full(a.shape[:2], -1); 
        for yy in np.unique(iy[miss]):
            cols = np.where(mask[yy])[0]
            if len(cols): near[yy] = 0
            sel = miss & (iy == yy)
            if len(cols): col[sel] = a[yy, cols[np.abs(cols[None, :] - ix[sel][:, None]).argmin(1)]]
    return col


def render(v, col, view, k, cx_world, size_px, nrm=None):
    """view : front|left|right. Retourne (rgb float HxWx3, alpha bool) à size_px*SS."""
    S = size_px * SS
    if view == "front":   r, c = v[:, 0], v[:, 2]
    elif view == "left":  r, c = -v[:, 2], v[:, 0]       # le personnage regarde à gauche : caméra du côté +x
    else:                 r, c = v[:, 2], -v[:, 0]
    u = v[:, 1]
    if nrm is not None:   # normales dans le repère de la caméra (x : droite de l'écran, y : haut, z : vers la caméra)
        cam = {"front": nrm[:, [0, 1, 2]], "left": np.stack([-nrm[:, 2], nrm[:, 1], nrm[:, 0]], 1), "right": np.stack([nrm[:, 2], nrm[:, 1], -nrm[:, 0]], 1)}[view]
    x = np.round((r - cx_world) * k + S / 2).astype(int)
    y = np.round(S - 1 - (u - v[:, 1].min()) * k - SS).astype(int)
    depth = np.full((S, S), -1e9); rgb = np.zeros((S, S, 3)); hit = np.zeros((S, S), bool); nbuf = np.zeros((S, S, 3))
    o = np.argsort(c)
    for dx in (0, 1):
        for dy in (0, 1):
            xx, yy = x[o] + dx, y[o] + dy
            ok = (xx >= 0) & (xx < S) & (yy >= 0) & (yy < S)
            xx, yy, cc, co = xx[ok], yy[ok], c[o][ok], col[o][ok]
            cn = cam[o][ok] if nrm is not None else None
            better = cc > depth[yy, xx]
            # ordre croissant : le dernier écrit (le plus proche) gagne ; on garde le plus proche entre les décalages
            sel = np.zeros(len(xx), bool); sel[better] = True
            depth[yy[sel], xx[sel]] = cc[sel]; rgb[yy[sel], xx[sel]] = co[sel]; hit[yy[sel], xx[sel]] = True
            if nrm is not None: nbuf[yy[sel], xx[sel]] = cn[sel]
    # comblement des trous : fermeture morphologique 3×3 sur la silhouette
    m = Image.fromarray((hit * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    full = np.asarray(m) > 0
    for ch in range(3):
        rgb[..., ch] = np.where(hit, rgb[..., ch], np.asarray(Image.fromarray(rgb[..., ch].astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=np.float64))
    if TOON:
        for ch in range(3):   # normales : trous comblés comme la couleur, puis lissées (le maillage marching-cubes est bruité)
            q = ((nbuf[..., ch] + 1) * 127.5).astype(np.uint8)
            nbuf[..., ch] = np.where(hit, nbuf[..., ch], np.asarray(Image.fromarray(q).filter(ImageFilter.MaxFilter(5)), dtype=np.float64) / 127.5 - 1)
            nbuf[..., ch] = gauss(nbuf[..., ch], SS * 0.8)
        nbuf /= np.linalg.norm(nbuf, axis=2, keepdims=True) + 1e-9
    dep = np.where(hit, depth, np.nan)
    dep = np.where(np.isnan(dep), np.nanmin(dep), dep)
    dep = gauss(dep, SS * 0.7)
    gy, gx = np.gradient(dep * k)
    n = np.stack([-gx, gy, np.ones_like(gx) * 1.0], axis=2); n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array([-0.45, 0.55, 0.7]); L /= np.linalg.norm(L)
    shade = 0.82 + 0.3 * np.clip((n @ L), 0, 1) - 0.2 * np.clip(-(n @ L), 0, 1)
    inner = np.asarray(Image.fromarray((full * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * SS + 1))) > 0   # hors du bord de la silhouette (déjà cerné par le contour)
    edge = (np.hypot(gx, gy) > 3.0) & inner    # arêtes de profondeur (bras devant le corps, menton…) : traits internes
    if TOON:
        # éclairage adapté au pixel art : trois paliers (ombre / ton local / lumière), ombre froide et lumière chaude plutôt qu'un simple assombrissement
        d = nbuf @ np.array([-0.5, 0.65, 0.58]) / np.linalg.norm([-0.5, 0.65, 0.58])
        band = np.where(d > 0.5, 2, np.where(d < -0.22, 0, 1))   # 0 ombre, 1 ton local, 2 lumière
        if FLAT: band = np.ones_like(band)   # --flat : aucune ombre ni lumière, uniquement les aplats de matière
        edge = (np.hypot(gx, gy) > 3.0) & (np.asarray(Image.fromarray((full * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * SS + 1))) > 0)
        return rgb, full, edge, band
    if FLAT: shade = np.ones_like(shade)    # --flat : couleurs à plat, sans ombre (la forme vient du contour et des traits d'arête)
    return np.clip(rgb * shade[..., None], 0, 255), full, edge, None


def pixelize(rgb, alpha, edge, px):
    S = px * SS
    cov = alpha.reshape(px, SS, px, SS).mean(axis=(1, 3)) > 0.98
    pad = np.pad(cov, 1)
    inner = cov & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:] & pad[:-2, :-2] & pad[:-2, 2:] & pad[2:, :-2] & pad[2:, 2:]   # blocs loin de la silhouette
    out = np.zeros((px, px, 4), np.uint8); special = np.zeros((px, px), np.uint8)
    for j in range(px):
        for i in range(px):
            a = alpha[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS]
            if a.mean() < 0.5: continue
            blk = rgb[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS][a]
            dark = blk.max(axis=1) < 70   # un détail sombre (œil, bouche) qui occupe un tiers du bloc l'emporte sur la moyenne
            white = blk.min(axis=1) > 205   # blanc de l'œil (la peau, même claire, garde un canal bleu bas)
            pick = blk[dark] if False else blk[white] if False else blk
            special[j, i] = 2 if False else 1 if False else 0
            out[j, i, :3] = pick.mean(0).round()
            if edge[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS].mean() > 0.3: out[j, i, :3] = (out[j, i, :3] * 0.6).round()
            out[j, i, 3] = 255
    return out, special


MERGE = 74   # distance RGB sous laquelle deux matières ne font qu'un aplat
MATERIALS = 12   # aplats de matière (peau, tissu, ceinture…) ; chacun a trois tons fixes : ombre froide, ton local, lumière chaude


def tone(c, b):
    c = np.asarray(c, dtype=np.float64)
    return np.clip(c * np.array([0.80, 0.75, 0.84]) if b == 0 else c * 1.06 + np.array([10.0, 6.0, 0.0]) if b == 2 else c, 0, 255).round().astype(np.uint8)


def flatten_regions(grid, lum, passes=3):
    """Aplats : un pixel dont la valeur n'apparaît qu'au plus une fois parmi ses 8 voisins est absorbé par la valeur majoritaire du voisinage."""
    h, w = grid.shape; g = grid.copy()
    for _ in range(passes):
        src = g.copy(); changed = False
        for j in range(h):
            for i in range(w):
                if src[j, i] < 0: continue
                nb = [src[y, x] for y in range(j - 1, j + 2) for x in range(i - 1, i + 2) if (y, x) != (j, i) and 0 <= y < h and 0 <= x < w and src[y, x] >= 0]
                if len(nb) >= 5 and nb.count(src[j, i]) <= 1:
                    best = max(set(nb), key=nb.count)
                    if nb.count(best) >= 3 and lum[src[j, i] // 3] > lum[best // 3] - 60: g[j, i] = best; changed = True   # un trait sombre fin (sourcil) n'est pas une tache
        if not changed: break
    return g


def pixelize_toon(raw, px):
    """Matières : palette commune de MATERIALS couleurs sur l'albédo ; lumière : trois tons fixes par matière. Chaque pixel prend la valeur
    (matière, ton) DOMINANTE de son bloc, jamais une moyenne ; puis les petites taches sont fondues dans la région voisine (aplats),
    les arêtes de profondeur tracées et les pixels isolés supprimés."""
    samples = np.concatenate([rgb[a][::7] for rgb, a, _, _ in raw.values()])
    pal = Image.fromarray(samples.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=MATERIALS, method=Image.MEDIANCUT, dither=Image.NONE)
    pr = np.array(pal.getpalette()[:3 * MATERIALS], dtype=np.uint8).reshape(-1, 3)
    # fusion des matières trop proches (les légers dégradés de l'image source sinon découpent la peau en plusieurs tons)
    cnt0 = np.bincount(np.asarray(pal.quantize(colors=MATERIALS) if False else Image.fromarray(samples.reshape(-1, 1, 3).astype(np.uint8)).quantize(palette=pal, dither=Image.NONE)).ravel(), minlength=MATERIALS)[:MATERIALS]
    rep = list(range(MATERIALS))
    for i in np.argsort(-cnt0):
        for jx in range(MATERIALS):
            if rep[jx] == jx and jx != i and rep[i] == i and cnt0[jx] <= cnt0[i] and np.linalg.norm(pr[i].astype(float) - pr[jx]) < MERGE:
                rep[jx] = i
    remap = np.array(rep)
    for i in range(MATERIALS):
        members = [m for m in range(MATERIALS) if rep[m] == i]
        if rep[i] == i: pr[i] = np.average(pr[members].astype(float), axis=0, weights=cnt0[members] + 1e-9).round().astype(np.uint8)
    lum = pr @ np.array([0.3, 0.59, 0.11])
    views = {}
    for name, (rgb, alpha, edge, band) in raw.items():
        mat = remap[np.asarray(Image.fromarray(rgb.astype(np.uint8)).quantize(palette=pal, dither=Image.NONE)).astype(np.int64)]
        comb = mat * 3 + band
        grid = np.full((px, px), -1, np.int64)
        for j in range(px):
            for i in range(px):
                a = alpha[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS]
                if a.mean() < 0.5: continue
                cnt = np.bincount(comb[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS][a], minlength=MATERIALS * 3)
                d = cnt.argmax()
                # détail fin et nettement plus sombre (sourcil, bouche, ceinture) : il l'emporte dès qu'il occupe 30 % du bloc
                dark = [c for c in np.where(cnt >= 0.3 * cnt.sum())[0] if lum[c // 3] < lum[d // 3] - 60]
                grid[j, i] = max(dark, key=lambda c: cnt[c]) if dark else d
        grid = flatten_regions(grid, lum)
        out = np.zeros((px, px, 4), np.uint8)
        for j in range(px):
            for i in range(px):
                if grid[j, i] < 0: continue
                out[j, i, :3] = tone(pr[grid[j, i] // 3], grid[j, i] % 3); out[j, i, 3] = 255
                if edge[j * SS:(j + 1) * SS, i * SS:(i + 1) * SS].mean() > 0.3: out[j, i, :3] = (out[j, i, :3] * 0.62).round()
        views[name] = despeckle(out)
    return views


def despeckle(img, passes=2):
    """Pixels isolés (aucun voisin de même couleur) recolorés par la couleur majoritaire de leurs voisins."""
    h, w = img.shape[:2]; res = img.copy()
    for _ in range(passes):
        src = res.copy()
        for j in range(h):
            for i in range(w):
                if not src[j, i, 3]: continue
                nb = [tuple(src[y, x, :3]) for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= y < h and 0 <= x < w and src[y, x, 3]]
                me = tuple(src[j, i, :3])
                if len(nb) >= 3 and me not in nb:
                    best = max(set(nb), key=nb.count)
                    if nb.count(best) >= 2: res[j, i, :3] = best
    return res


def outline(img, dark=0.32):
    h, w = img.shape[:2]; res = img.copy()
    for j in range(h):
        for i in range(w):
            if img[j, i, 3]: continue
            nb = [img[y, x] for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= y < h and 0 <= x < w and img[y, x, 3]]
            if nb:
                c = np.mean([p[:3] for p in nb], axis=0) * dark
                res[j, i] = [*c.round().astype(np.uint8), 255]
    return res


def dark_blobs(img, box, lum=70):
    """Taches sombres (composantes 4-connexes) de l'image dans la boîte (x0, y0, x1, y1) : [(cx, cy, w, h, aire)]."""
    a = np.asarray(img.convert("RGB"), dtype=np.int32)
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], bool); m[y0:y1, x0:x1] = a[y0:y1, x0:x1].max(axis=2) < lum
    seen = np.zeros_like(m); out = []
    for y, x in zip(*np.where(m)):
        if seen[y, x]: continue
        stack, pts = [(y, x)], []; seen[y, x] = True
        while stack:
            cy, cx = stack.pop(); pts.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        pts = np.array(pts)
        out.append((pts[:, 1].mean(), pts[:, 0].mean(), np.ptp(pts[:, 1]) + 1, np.ptp(pts[:, 0]) + 1, len(pts)))
    return out


def subject_box(img, bg_dist=28):
    a = np.asarray(img.convert("RGB"), dtype=np.float64)
    bg = a[:4, :4].reshape(-1, 3).mean(0)
    ys, xs = np.where(np.abs(a - bg).max(axis=2) > bg_dist)
    return xs.min(), xs.max(), ys.min(), ys.max()


def find_eyes(src, side):
    """Yeux de l'image de face (deux taches rondes de la moitié haute, hors sourcils allongés) et de profil (une tache à l'avant de la tête)."""
    x0, x1, y0, y1 = subject_box(src)
    face = [b for b in dark_blobs(src, (x0, y0, x1 + 1, int(y0 + (y1 - y0) * 0.5))) if b[4] > 150 and 0.5 < b[2] / b[3] < 1.8]
    face = sorted(face, key=lambda b: -b[4])[:2]
    prof = None
    if side is not None:
        sx0, sx1, sy0, sy1 = subject_box(side)
        c = [b for b in dark_blobs(side, (sx0, sy0, int(sx0 + (sx1 - sx0) * 0.5), int(sy0 + (sy1 - sy0) * 0.4))) if b[4] > 80 and b[2] / b[3] < 1.3]
        prof = max(c, key=lambda b: b[4]) if c else None
    return face, prof


def paint_eye(arr, alpha, cx, cy, rx, ry, sclera):
    """Dessine un œil net à (cx, cy) en pixels du sprite : blanc (optionnel), iris noir, reflet blanc."""
    h, w = alpha.shape
    iris, white = (34, 22, 28), (250, 248, 242)
    for j in range(max(0, int(cy - ry - 3)), min(h, int(cy + ry + 4))):
        for i in range(max(0, int(cx - rx - 3)), min(w, int(cx + rx + 4))):
            if not alpha[j, i]: continue
            x, y = i + 0.5 - cx, j + 0.5 - cy
            if (x / rx) ** 2 + (y / ry) ** 2 <= 1: arr[j, i] = iris
            elif sclera and (x / (rx + 0.75)) ** 2 + (y / (ry + 0.6)) ** 2 <= 1: arr[j, i] = white
    if sclera:   # reflet : un pixel en haut à gauche de l'iris
        j, i = int(cy - ry * 0.3), int(cx - rx * 0.3)
        if 0 <= j < h and 0 <= i < w and alpha[j, i]: arr[j, i] = white


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    px = int(sys.argv[sys.argv.index("--px") + 1]) if "--px" in sys.argv else 32
    if "--noside" in sys.argv: args.remove("--noside") if "--noside" in args else None
    if "--px" in sys.argv: args.remove(sys.argv[sys.argv.index("--px") + 1])
    global OUT
    if "--flat" in args: args.remove("--flat")
    if "--toon" in args: args.remove("--toon")
    VIEWS = next((a.split("=")[1].split(",") for a in sys.argv if a.startswith("--views=")), ["front", "left", "right"])
    if "--out" in sys.argv: OUT = int(sys.argv[sys.argv.index("--out") + 1]); args.remove(str(OUT))
    tag = ("" if px == 32 else f"_{px}") + ("_flat" if FLAT else "") + ("_toon" if TOON else "")
    for cid in args:
        v, nrm = load_glb(M3D / f"{cid}.glb")
        src = Image.open(M3D / f"{cid}_src.png")
        col = vertex_colors(v, src)
        sidep = M3D / f"{cid}_side.png"
        scol = side_colors(v, Image.open(sidep)) if sidep.exists() and "--noside" not in sys.argv else col
        fb = tuple(c * px // 32 for c in Image.open(PNG / f"{cid}_front.png").convert("RGBA").getbbox())   # boîte du sprite actuel (x0,y0,x1,y1 exclusif)
        fh = fb[3] - fb[1] - 2 * OUT   # hauteur du corps sans le contour
        k = fh * SS / (v[:, 1].max() - v[:, 1].min())
        cxw = (v[:, 0].max() + v[:, 0].min()) / 2
        sd = Image.open(sidep) if sidep.exists() and "--noside" not in sys.argv else None
        feyes, peye = find_eyes(src, sd)
        sfx = subject_box(src); sfs = subject_box(sd) if sd is not None else None
        mn, mx = v.min(0), v.max(0)
        views, specials, eyes, raw = {}, {}, {}, {}
        for name in VIEWS:
            rgb, alpha, edge, band = render(v, col if name == "front" else scol, name, k, cxw if name == "front" else (v[:, 2].max() + v[:, 2].min()) / 2 * (1 if name == "right" else -1), px, nrm if TOON else None)
            # recale : bas du sujet sur la ligne de pieds du sprite actuel, centré sur la colonne de la boîte actuelle
            ys, xs = np.where(alpha)
            dy = (fb[3] - OUT) * SS - (ys.max() + 1); dx = ((fb[0] + fb[2]) / 2) * SS - (xs.min() + xs.max() + 1) / 2
            rgb = np.roll(np.roll(rgb, int(dy), 0), int(round(dx)), 1); alpha = np.roll(np.roll(alpha, int(dy), 0), int(round(dx)), 1); edge = np.roll(np.roll(edge, int(dy), 0), int(round(dx)), 1)
            if band is not None: band = np.roll(np.roll(band, int(dy), 0), int(round(dx)), 1)
            if TOON: raw[name] = (rgb, alpha, edge, band)
            else: views[name], specials[name] = pixelize(rgb, alpha, edge, px)
            S = px * SS; k_sx = k / SS
            if name == "front":
                x0, x1, y0, y1 = sfx
                lst = []
                for (bx, by, bw, bh, _) in feyes:
                    wx = mn[0] + (bx - x0) / (x1 - x0) * (mx[0] - mn[0]); wy = mn[1] + (y1 - by) / (y1 - y0) * (mx[1] - mn[1])
                    sx = ((wx - cxw) * k + S / 2 + int(round(dx))) / SS; sy = (S - 1 - (wy - mn[1]) * k - SS + int(dy)) / SS
                    lst.append((sx, sy, bw / 2 * k_sx * (mx[0] - mn[0]) / (x1 - x0), bh / 2 * k_sx * (mx[1] - mn[1]) / (y1 - y0), True, None))
                eyes[name] = lst
            elif name == "left" and peye is not None and sfs is not None:
                x0, x1, y0, y1 = sfs; bx, by, bw, bh, _ = peye
                zc = (mx[2] + mn[2]) / 2; wz = mx[2] - (bx - x0) / (x1 - x0) * (mx[2] - mn[2]); wy = mn[1] + (y1 - by) / (y1 - y0) * (mx[1] - mn[1])
                sx = ((-wz + zc) * k + S / 2 + int(round(dx))) / SS; sy = (S - 1 - (wy - mn[1]) * k - SS + int(dy)) / SS
                edge_src = np.where(np.abs(np.asarray(sd.convert("RGB"), dtype=np.float64)[int(by)] - np.asarray(sd.convert("RGB"), dtype=np.float64)[:4, :4].reshape(-1, 3).mean(0)).max(axis=1) > 30)[0].min()
                dsp = (bx - edge_src) * k_sx * (mx[2] - mn[2]) / (x1 - x0)   # distance de l'œil au bord avant, en pixels du sprite
                eyes[name] = [(sx, sy, bw / 2 * k_sx * (mx[2] - mn[2]) / (x1 - x0), bh / 2 * k_sx * (mx[1] - mn[1]) / (y1 - y0), False, dsp)]
        if TOON: views = pixelize_toon(raw, px)
        # palette commune
        allpx = np.concatenate([views[n][views[n][..., 3] > 0][:, :3] for n in views])
        pal = Image.fromarray(allpx.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=24, method=Image.MEDIANCUT, dither=Image.NONE)
        sheet = Image.new("RGBA", (192 * len(VIEWS), 192), (110, 120, 110, 255))
        for n, im in views.items():
            a = im[..., 3] > 0
            q = Image.fromarray(im[..., :3]) if TOON else Image.fromarray(im[..., :3]).quantize(palette=pal, dither=Image.NONE).convert("RGB")
            arr = np.asarray(q).copy()
            for (ex, ey, erx, ery, scl, dsp) in eyes.get(n, []):
                if dsp is not None:   # profil : œil posé à la bonne distance du bord avant de la silhouette (hors contour)
                    row = np.where(a[int(ey)])[0]; ex = row.min() + dsp
                paint_eye(arr, a, ex, ey, max(erx, 1.2 if scl else 1.0), max(ery, 1.6 if scl else 1.7), scl)   # yeux peints (règle, sans IA) : jamais fondus par la palette
            res = np.dstack([arr, (a * 255).astype(np.uint8)])
            res = outline(res, 0.2)
            for _ in range(OUT - 1): res = outline(res, 1.0)
            Image.fromarray(res, "RGBA").save(M3D / f"{cid}_{n}{tag}.png")
            sheet.alpha_composite(Image.fromarray(res, "RGBA").resize((192, 192), Image.NEAREST), (VIEWS.index(n) * 192, 0))
        sheet.save(M3D / f"{cid}_sheet{tag}.png")
        print("OK  ", cid)


main()
