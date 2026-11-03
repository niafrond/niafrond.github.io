#!/usr/bin/env python3
"""export-companion-ply.py — Maillage 3D d'un compagnon (tools/gen-companion-3d.mjs) → PLY binaire à couleurs par sommet, pour un outil 3D en ligne de commande
(tools/blender-render-companion.py).

Le .glb de Hunyuan3D n'a pas de texture : chaque sommet reprend la couleur de l'image de face projetée (la moitié arrière, une version floutée sans détails ;
aucune vue générée par IA). La dalle plate ajoutée sous les pieds est retirée. Les coordonnées restent celles du .glb : Y vers le haut, avant du personnage vers +Z.

Usage (WSL) : ~/.cache/game-maker/venvs/studio/bin/python tools/export-companion-ply.py companion_zhi [companion_yu …]
Écrit sprites/png/model3d/<id>.ply (non suivi par git).
"""
import sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image

ROOT = Path(__file__).resolve().parent
MATERIALS, MERGE = 12, 44   # matières maximales et distance RGB de fusion
M3D = ROOT.parent / "sprites" / "png" / "model3d"


def render_module():
    """Fonctions de tools/render-companion-3d.py (chargement du .glb, retrait de la dalle, couleurs des sommets), sans lancer son main()."""
    src = (ROOT / "render-companion-3d.py").read_text(encoding="utf-8").replace("\nmain()\n", "\n")
    ns = {"__file__": str(ROOT / "render-companion-3d.py"), "__name__": "rc3d"}
    exec(compile(src, "render-companion-3d.py", "exec"), ns)
    return ns


def write_ply(path, v, col, f):
    with open(path, "wb") as fh:
        fh.write((f"ply\nformat binary_little_endian 1.0\nelement vertex {len(v)}\nproperty float x\nproperty float y\nproperty float z\n"
                  f"property uchar red\nproperty uchar green\nproperty uchar blue\nelement face {len(f)}\nproperty list uchar int vertex_indices\nend_header\n").encode())
        vert = np.zeros(len(v), dtype=[("p", "<f4", 3), ("c", "u1", 3)])
        vert["p"], vert["c"] = v, np.clip(col, 0, 255).round().astype(np.uint8)
        fh.write(vert.tobytes())
        face = np.zeros(len(f), dtype=[("n", "u1"), ("i", "<i4", 3)])
        face["n"], face["i"] = 3, f
        fh.write(face.tobytes())


def main():
    ns = render_module()
    for cid in [a for a in sys.argv[1:] if not a.startswith("--")]:
        v, f, keep = ns["load_glb_full"](M3D / f"{cid}.glb")
        vk = v[keep]
        col = ns["vertex_colors"](vk, Image.open(M3D / f"{cid}_src.png"))
        nrm = ns["vertex_normals"](v, f)[keep]
        vis = nrm[:, 2] > 0.35
        # 1. Aplats de matière : les couleurs de l'image de face sont réduites à quelques matières (peau, tissu, ceinture…), puis les matières
        #    voisines (< MERGE en RGB) sont fusionnées : plus de dégradés ni de bruit dans le maillage.
        samples = col[vis][:: max(1, vis.sum() // 60000)]
        pal = Image.fromarray(samples.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=MATERIALS, method=Image.MEDIANCUT, dither=Image.NONE)
        pr = np.array(pal.getpalette()[:3 * MATERIALS], dtype=float).reshape(-1, 3)
        mat = np.argmin(((col[:, None, :] - pr[None]) ** 2).sum(2), axis=1)
        cnt = np.bincount(mat[vis], minlength=MATERIALS)
        rep = list(range(MATERIALS))
        for i in np.argsort(-cnt):
            for j in range(MATERIALS):
                if rep[j] == j and rep[i] == i and j != i and cnt[j] <= cnt[i] and np.linalg.norm(pr[i] - pr[j]) < MERGE: rep[j] = i
        mat = np.array(rep)[mat]
        # 2. Surfaces cachées (flancs, dos, dessous) : matière MAJORITAIRE des 32 surfaces visibles les plus proches, à hauteur comparable
        #    (la hauteur pèse six fois plus) : la ceinture fait le tour du corps au lieu de baver en taches sur le dos.
        flat_y = np.array([1.0, 6.0, 1.0])
        _, idx = cKDTree(vk[vis] * flat_y).query(vk[~vis] * flat_y, k=32)
        votes = mat[vis][idx]
        mat[~vis] = np.array([np.bincount(r, minlength=MATERIALS).argmax() for r in votes])
        cols = np.array([pr[m] for m in range(MATERIALS)])
        # couleur d'une matière fusionnée = moyenne pondérée de ses membres
        for i in range(MATERIALS):
            members = [m for m in range(MATERIALS) if rep[m] == i]
            if rep[i] == i: cols[i] = np.average(pr[members], axis=0, weights=cnt[members] + 1e-9)
        col = cols[mat]
        remap = np.cumsum(keep) - 1
        fk = f[keep[f].all(axis=1)]
        write_ply(M3D / f"{cid}.ply", v[keep], col, remap[fk])
        print("OK  ", cid, len(v[keep]), "sommets", len(fk), "faces")


main()
