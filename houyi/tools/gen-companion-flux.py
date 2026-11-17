#!/usr/bin/env python3
"""gen-companion-flux.py — Images de marche des compagnons par FLUX.2 Klein + LoRA « 4walk » (pile game-maker, ComfyUI).

Pour chaque `companion_<id>` dessiné par tools/gen-sprites-gm.mjs (sprites/png/companion_<id>_front.png, 32×32), le personnage de
face est donné à FLUX comme image de départ : il renvoie une planche 4×4 (3 images de marche × 4 directions) dont les cases sont
détourées, ramenées à la grille 32×32 et posées sur une ligne de pieds commune (même code que `rpg-studio character animate`).
On garde, sur 3 planches au plus, celle qui a le plus de directions valides. Écrit sprites/png/flux/companion_<id>_walk_<dir>_<n>.png
(dir : front, back, left, right ; n : 0, 1, 2). Limite constatée : le LoRA « 4walk » dessine un HUMANOÏDE qui marche : les animaux et esprits
(renard, carpe, louveteau, corbeau, belette, étincelle) perdent leur anatomie, seuls les personnages humains (Zhi, Dawa) sont repris par
tools/gen-companion-walk.mjs, qui assemble sprites/generated.js (les autres : repli procédural sur leur sprite SDXL).

Usage (WSL, `tools/gm up pixel` lancé) :
    ~/.cache/game-maker/venvs/studio/bin/python tools/gen-companion-flux.py [companion_zhi …] [--seed N]
"""
import os
import sys
from pathlib import Path

from PIL import Image

from rpg_studio.asset_processing.pixel import load_png, place_group
from rpg_studio.asset_processing.walk_sheet import SHEET_DIRECTIONS, read_sheet, score as sheet_score
from rpg_studio.cli import ctx_
from rpg_studio.pipelines.animation import SHEET_ATTEMPTS, _init_png
from rpg_studio.providers.base import ImageRequest

PNG_DIR = Path(__file__).resolve().parent.parent / "sprites" / "png"
FLUX_DIR = PNG_DIR / "flux"   # sorties de FLUX (le sprite fixe SDXL reste dans PNG_DIR)
SIZE = 32
VIEW = {"down": "front", "up": "back", "left": "left", "right": "right"}   # ligne de la planche -> direction du jeu


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 1
    ids = [a for a in args if a.startswith("companion_")] or sorted({p.name.rsplit("_front", 1)[0] for p in PNG_DIR.glob("companion_*_front.png")})
    FLUX_DIR.mkdir(exist_ok=True)
    ctx = ctx_()
    prov = ctx.registry.select("image", None, require_capability="walk_sheet")
    gen_px = int(getattr(prov, "gen_size", 512))
    done = 0
    for cid in ids:
        front = PNG_DIR / f"{cid}_front.png"
        if not front.exists():
            print(f"· {cid} : {front.name} introuvable, ignoré")
            continue
        idle = Image.open(front).convert("RGBA")
        ref = _init_png(idle, gen_px // 2)
        best = None
        for attempt in range(SHEET_ATTEMPTS):
            res = prov.generate(ImageRequest("", "", gen_px, gen_px, seed + 1000 * attempt, extra={"ref_png": ref}))
            reading = read_sheet(load_png(res.images[0]), list(SHEET_DIRECTIONS), reference=idle)
            print(f"  {cid} essai {attempt + 1} : valides {sorted(reading.figures)} rejets {reading.rejects}")
            if best is None or sheet_score(reading) > sheet_score(best):
                best = reading
            if len(reading.figures) == len(SHEET_DIRECTIONS):
                break
        if not best or not best.figures:
            print(f"✗ {cid} : aucune direction valide")
            continue
        for d, figs in best.figures.items():
            for n, img in enumerate(place_group(figs, SIZE)):
                img.save(FLUX_DIR / f"{cid}_walk_{VIEW[d]}_{n}.png")
        print(f"OK {cid} : {', '.join(VIEW[d] for d in best.figures)}")
        done += 1
    print(f"Terminé : {done}/{len(ids)}")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("RPG_STUDIO_ROOT", str(Path.home() / "dev" / "game-maker"))
    sys.exit(main())
