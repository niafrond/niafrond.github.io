#!/usr/bin/env python3
"""sfx_audioldm2.py — Bruitages réalistes des sorts et des coups d'arc avec AudioLDM2 (texte -> son, entraîné sur des sons réels :
tonnerre, feu, eau, vent, lames, rugissements…), à la place d'ACE-Step (modèle de musique, pas de bruitages).

Pour chaque clip de sfxCatalog.js (`spell-<id>`, `weaponHit-<rareté>-p|e`) : une légende de SON en anglais est construite d'après l'identifiant
du sort (mots-clés : foudre -> « loud thunder crack », glace -> « ice cracking »…) puis sa couleur de qì, et AudioLDM2 génère plusieurs
candidats classés par CLAP (le modèle choisit lui-même celui qui colle le mieux au texte). Le meilleur est coupé (début net, fondu de
fin) à la durée voulue (≥ 1 s : 1,2 à 2 s selon le coût, 2,6 s pour un ultime, 1 à 1,5 s pour un coup d'arc), normalisé à −6 dBFS,
encodé en MP3 mono et installé dans audio/sfx/ ; audio/manifest.json est mis à jour. Modèle : `cvssp/audioldm2` (licence CC BY-NC-SA 4.0).

Usage (WSL ; GPU libre : `tools/gm down pixel` ; venv d'ACE-Step, qui a torch + diffusers) :
    ~/.cache/game-maker/venvs/acestep/bin/python tools/audio/sfx_audioldm2.py [--only=spell-thunderBolt,…] [--candidates=3] [--steps=60] [--out=DIR] [--list]
    --out=DIR : écrit les clips dans DIR au lieu d'audio/sfx (essai sans toucher au jeu, ni au manifeste).
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent.parent
SFX_DIR = GAME / "audio" / "sfx"
MANIFEST = GAME / "audio" / "manifest.json"
SR_MODEL = 16000
PEAK_DB = -6.0
args = {a.split("=")[0][2:]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}

# ── légendes de son : (mots-clés de l'identifiant) -> légende. Le premier motif qui correspond gagne. ─────────────────────────────────
RULES = [
    (r"meteor|nineSuns|inferno|ember|flame|fire|burn|brasier|vermilion|blaze|scythe|sunPiercer|sunFall", "a big fire blast roaring and burning with crackling flames"),
    (r"frost|ice|blizzard|chill|freez|handOfIce", "ice cracking and shattering with a cold freezing wind"),
    (r"thunder|lightning|bolt|storm|tribulation|wrath|tempest", "a very loud thunder crack with crackling electric lightning and a rolling rumble"),
    (r"flood|tide|tidal|river|spring|rain|dew|vapor|wave|torrent|azure|dragonCross|twinDragons|threeDragons", "a big water splash and rushing waves"),
    (r"wolf", "a wolf howling and growling"),
    (r"tiger|whiteTiger", "a tiger roaring with a deep growl"),
    (r"bird|phoenix", "a large bird screeching and flapping its wings"),
    (r"dragon|roar|beast|riders", "a deep powerful dragon roar echoing"),
    (r"arrow|shot|bow|dualShot|thousandArrows|throwAxe|axe", "a bow string twang and an arrow whooshing through the air then hitting"),
    (r"gale|wind|blade|singing|sword|slash|razor|swift|strike|cut|cleave|attack|sneak|stab|shadowStep", "a fast sword swish slashing through the air with a metal ring"),
    (r"mountain|kunlun|chasm|stone|rock|earth|pangu|quake|rush|bash|wall|barrier|bastion|tortoise", "heavy rocks crashing and the earth rumbling with a deep boom"),
    (r"shield|aura|stealth|focus|strength|reinforce|hold|command|cry|enrage|bloodlust|berserker|rage|intimidate|divinePower|sharpened|tigerEye", "a powerful magical power-up with a bright metallic shimmer and a low hum"),
    (r"heal|revitalize|miracle|peach|elixir|blessing|breath|jade|harmony|lotus|golden", "gentle magical glittering chimes and a soft warm sparkle"),
    (r"shadow|void|dark|curse|death|finger|revenant|deathbringer|drain|siphon|poison|confuse|weakness|seal|decree", "a dark eerie whoosh with a deep ominous rumble and a ghostly whisper"),
    (r"mana|wild|purge|cross|star|five|elements|mirror", "a magical energy burst with a rising shimmering whoosh and a soft explosion"),
]
BY_COLOR = {
    "red": "a fire blast roaring with crackling flames",
    "blue": "a splash of water and ice crystals tinkling",
    "green": "a strong wind gust rustling through leaves and a wooden creak",
    "yellow": "a bronze gong strike with a metallic ring and a rumble",
    "purple": "a dark eerie whoosh with a deep rumble",
}


def caption(sfx_key: str, meta: dict) -> str:
    m = re.match(r"weaponHit-(\w+)-([pe])$", sfx_key)
    if m:
        rar, side = m.groups()
        tail = {"common": "a dull wooden thud", "uncommon": "a thud with a small metal clink", "rare": "a thud with a clear ringing metal clang", "legendary": "a heavy thud with a bright ringing magical clang"}[rar]
        voice = "" if side == "p" else ", low and heavy"
        return f"a bow string twang and an arrow whistling through the air then hitting a target with {tail}{voice}"
    sid = sfx_key[len("spell-"):]
    text = next((c for p, c in RULES if re.search(p, sid, re.I)), None)
    if text is None:
        colors = meta.get("colors") or []
        text = BY_COLOR.get(colors[0]) if colors else None
    text = text or "a magical spell whoosh with a soft impact"
    if meta.get("ultimate"):
        text += ", huge and epic, with a long booming echo"
    return text


def target_seconds(sfx_key: str, meta: dict) -> tuple[float, float]:
    """(durée gardée, fondu de fin) : toujours ≥ 1 s."""
    m = re.match(r"weaponHit-(\w+)-", sfx_key)
    if m:
        return {"common": 1.0, "uncommon": 1.1, "rare": 1.25, "legendary": 1.5}[m.group(1)], 0.25
    if meta.get("ultimate"):
        return 2.6, 0.6
    power = min(1.0, max(0.15, (meta.get("cost") or 0) / 40))
    return round(1.15 + power * 0.85, 2), 0.3


def spell_meta() -> dict:
    data = json.loads((GAME / "spells.json").read_text(encoding="utf8"))
    out = {}
    for lst in data.values():
        for s in lst:
            if s["id"] in out:
                continue
            cost = s.get("cost") if isinstance(s.get("cost"), dict) else None
            colors = [s["color"]] if s.get("color") else ([c for c, v in cost.items() if v > 0] if cost else [])
            out[s["id"]] = {"colors": colors, "cost": sum(cost.values()) if cost else (s.get("cost") or 0), "ultimate": bool(s.get("ultimate"))}
    return out


def all_keys() -> list[tuple[str, dict]]:
    meta = spell_meta()
    keys = [(f"spell-{i}", m) for i, m in meta.items()]
    for r in ("common", "uncommon", "rare", "legendary"):
        for s in ("p", "e"):
            keys.append((f"weaponHit-{r}-{s}", {}))
    return keys


def encode(samples, key: str, secs: float, fade: float, out_dir: Path) -> float:
    """Coupe le silence initial, garde `secs` s, fondu de fin, crête à −6 dBFS, MP3 mono 32 kHz."""
    import numpy as np
    import scipy.io.wavfile as wavfile

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "in.wav"
        wavfile.write(wav, SR_MODEL, (np.clip(samples, -1, 1) * 32767).astype("int16"))
        peak = subprocess.run(["ffmpeg", "-v", "info", "-i", str(wav), "-af", f"silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,atrim=0:{secs},volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        mx = re.search(r"max_volume:\s*(-?[\d.]+) dB", peak)
        gain = PEAK_DB - float(mx.group(1)) if mx else 0.0
        dst = out_dir / f"{key}.mp3"
        flt = f"silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,atrim=0:{secs},asetpts=PTS-STARTPTS,apad=whole_dur={secs},afade=t=out:st={max(0, secs - fade)}:d={fade},volume={gain}dB"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", flt, "-ac", "1", "-ar", "32000", "-b:a", "64k", str(dst)], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)], capture_output=True, text=True).stdout
    return round(float(dur), 2)


def main() -> int:
    keys = all_keys()
    only = set(str(args["only"]).split(",")) if "only" in args else None
    if only:
        keys = [(k, m) for k, m in keys if k in only]
    if "list" in args:
        for k, m in keys:
            print(f"{k:40s} {target_seconds(k, m)[0]:4.2f}s  {caption(k, m)}")
        return 0
    out_dir = Path(str(args["out"])) if "out" in args else SFX_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    import torch
    from diffusers import AudioLDM2Pipeline

    pipe = AudioLDM2Pipeline.from_pretrained("cvssp/audioldm2", torch_dtype=torch.float16).to("cuda")
    steps, cands = int(args.get("steps", 60)), int(args.get("candidates", 3))
    manifest = json.loads(MANIFEST.read_text(encoding="utf8")) if "out" not in args else None
    for n, (key, meta) in enumerate(keys, 1):
        text = caption(key, meta)
        secs, fade = target_seconds(key, meta)
        gen = torch.Generator("cuda").manual_seed(abs(hash(key)) % (2**31))
        audio = pipe(text, negative_prompt="Low quality, average quality, noise, music, speech.", audio_length_in_s=max(4.0, secs + 1.5),
                     num_inference_steps=steps, guidance_scale=3.5, num_waveforms_per_prompt=cands, generator=gen).audios[0]
        real = encode(audio, key, secs, fade, out_dir)
        if manifest is not None:
            manifest["sfx"][key] = {"seconds": real}
            MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf8")
        print(f"[{n}/{len(keys)}] {key:38s} {real:4.2f}s  {text}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
