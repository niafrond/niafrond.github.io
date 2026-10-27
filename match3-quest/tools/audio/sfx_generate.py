#!/usr/bin/env python3
"""sfx_generate.py — Bruitages des sorts et des coups d'arc (audio/sfx/spell-<id>.mp3, weaponHit-<rareté>-p|e.mp3), quel que soit le modèle.

Un seul script pour tous les modèles texte -> son : on change `--model`, rien d'autre. Deux usages :
  - ÉCHANTILLON (`--sample`, 14 sorts et coups représentatifs) : écrit dans un dossier à part avec une page HTML d'écoute (index.html), sans
    toucher au jeu : on compare les modèles à l'oreille ;
  - COMPLET (sans `--sample`, `--install`) : les 130 clips, installés dans audio/sfx/ + audio/manifest.json (écrase les clips existants).
Les wrappers `sfx-sample.sh` et `sfx-all.sh` (même dossier) préparent l'environnement et appellent ce script.

Modèles (`--model`) :
  audioldm2          cvssp/audioldm2             diffusers, libre d'accès (licence CC BY-NC-SA 4.0)
  audioldm2-large    cvssp/audioldm2-large       idem, plus gros
  audioldm           cvssp/audioldm-l-full       idem, version 1
  stable-audio-open  stabilityai/stable-audio-open-1.0   diffusers ; modèle à accès restreint : accepter la licence sur Hugging Face puis `huggingface-cli login`
  cmd                votre propre outil : `--cmd "mon_outil --prompt {prompt} --seconds {secs} --out {out}"`, qui écrit un fichier audio (wav, flac, mp3…) à
                     l'emplacement {out} ; {prompt} = légende, {secs} = durée demandée, {seed} = graine, {key} = clé du clip. Pour MMAudio, par exemple :
                     `--cmd "python demo.py --prompt {prompt} --duration {secs} --seed {seed} --output {outdir}"` ne convient pas tel quel (nom de fichier imposé) :
                     écrire un petit wrapper qui prend {out}.
  (autre dépôt Hugging Face compatible diffusers : `--model hf:<dépôt>` avec `--pipeline audioldm2|audioldm|stableaudio`)

Légendes (`--caption`) : `short` (défaut, vocabulaire de sons réels : « thunder and lightning crack ») ou `long` (phrases détaillées). Elles se corrigent dans
la liste RULES ci-dessous (mots-clés de l'identifiant du sort -> légende). `--caption-file f.json` : surcharge {clé: légende} pour des clips précis.

Autres options : --only=spell-ice,spell-bolt   --candidates=N (candidats par clip, le meilleur est gardé : classement CLAP pour AudioLDM,
énergie du début sinon)   --steps=N   --seed=N   --out=DIR   --install   --no-html   --list

Environnement : `sfx-sample.sh` / `sfx-all.sh` s'en chargent (venv d'ACE-Step de game-maker + transformers 4.45.2 / diffusers 0.31.0 installés à part pour AudioLDM,
car AudioLDM2 plante avec transformers ≥ 4.50). Durées : toujours ≥ 1 s (1,15 à 2 s selon le coût du sort, 2,6 s pour un ultime, 1 à 1,5 s pour un coup d'arc).
"""
import base64
import html
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent.parent
SFX_DIR = GAME / "audio" / "sfx"
MANIFEST = GAME / "audio" / "manifest.json"
PEAK_DB = -6.0
args = {a.split("=")[0][2:]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}

# Échantillon restreint : un sort par famille de son + deux coups d'arc.
SAMPLE = ["spell-ice", "spell-fireball", "spell-bolt", "spell-thunderBolt", "spell-frostNova", "spell-meteor", "spell-heal", "spell-springRain",
          "spell-galeSlash", "spell-kunlunMountainFall", "spell-shadowFlame", "spell-ultimateSkyWolf", "weaponHit-rare-p", "weaponHit-legendary-p"]

# ── légendes de son : (mots-clés de l'identifiant) -> (légende courte, légende longue). Le premier motif qui correspond gagne. ───────────
RULES = [
    (r"meteor|nineSuns|inferno|ember|flame|fire|burn|brasier|vermilion|blaze|scythe|sunPiercer|sunFall",
     "a dragon breathing fire, flame whoosh and crackling", "a big fire blast roaring and burning with crackling flames"),
    (r"frost|ice|blizzard|chill|freez|handOfIce",
     "ice cracking and shattering", "ice cracking and shattering with a cold freezing wind"),
    (r"thunder|lightning|bolt|storm|tribulation|wrath|tempest",
     "thunder and lightning crack", "a very loud thunder crack with crackling electric lightning and a rolling rumble"),
    (r"flood|tide|tidal|river|spring|rain|dew|vapor|wave|torrent|azure|dragonCross|twinDragons|threeDragons",
     "water splashing and rushing waves", "a big water splash and rushing waves"),
    (r"wolf", "a wolf howling", "a wolf howling and growling"),
    (r"tiger|whiteTiger", "a tiger roaring", "a tiger roaring with a deep growl"),
    (r"bird|phoenix", "a bird screeching and flapping wings", "a large bird screeching and flapping its wings"),
    (r"dragon|roar|beast|riders", "a dragon roaring", "a deep powerful dragon roar echoing"),
    (r"arrow|shot|bow|dualShot|thousandArrows|throwAxe|axe", "a bow and arrow shot", "a bow string twang and an arrow whooshing through the air then hitting"),
    (r"gale|wind|blade|singing|sword|slash|razor|swift|strike|cut|cleave|attack|sneak|stab|shadowStep",
     "a sword swish and metal slash", "a fast sword swish slashing through the air with a metal ring"),
    (r"mountain|kunlun|chasm|stone|rock|earth|pangu|quake|rush|bash|wall|barrier|bastion|tortoise",
     "rocks crashing and rumbling", "heavy rocks crashing and the earth rumbling with a deep boom"),
    (r"shield|aura|stealth|focus|strength|reinforce|hold|command|cry|enrage|bloodlust|berserker|rage|intimidate|divinePower|sharpened|tigerEye",
     "a magical power up shimmer", "a powerful magical power-up with a bright metallic shimmer and a low hum"),
    (r"heal|revitalize|miracle|peach|elixir|blessing|breath|jade|harmony|lotus|golden",
     "magic chimes sparkling", "gentle magical glittering chimes and a soft warm sparkle"),
    (r"shadow|void|dark|curse|death|finger|revenant|deathbringer|drain|siphon|poison|confuse|weakness|seal|decree",
     "a dark eerie whoosh with a deep rumble", "a dark eerie whoosh with a deep ominous rumble and a ghostly whisper"),
    (r"mana|wild|purge|cross|star|five|elements|mirror",
     "a magical energy burst", "a magical energy burst with a rising shimmering whoosh and a soft explosion"),
]
BY_COLOR = {"red": "fire blast crackling flames", "blue": "water splash and ice tinkling", "green": "wind gust through leaves",
            "yellow": "a bronze gong strike", "purple": "a dark eerie whoosh"}
NEGATIVE = "Low quality, average quality, noise, music, speech, voice."


def caption(key: str, meta: dict, kind: str = "short") -> str:
    idx = 1 if kind == "short" else 2
    m = re.match(r"weaponHit-(\w+)-([pe])$", key)
    if m:
        rar, side = m.groups()
        tail = {"common": "a dull thud", "uncommon": "a thud with a small metal clink", "rare": "a thud with a ringing metal clang", "legendary": "a heavy thud with a bright ringing magical clang"}[rar]
        base = f"a bow and arrow shot hitting a target, {tail}" if kind == "short" else f"a bow string twang and an arrow whistling through the air then hitting a target with {tail}"
        return base + ("" if side == "p" else ", low and heavy")
    sid = key[len("spell-"):]
    text = next((r[idx] for r in RULES if re.search(r[0], sid, re.I)), None) or BY_COLOR.get((meta.get("colors") or [None])[0]) or "a magical spell whoosh"
    if meta.get("ultimate"):
        text += ", huge and epic" + (", with a long booming echo" if kind == "long" else "")
    return text


def target_seconds(key: str, meta: dict) -> tuple[float, float]:
    m = re.match(r"weaponHit-(\w+)-", key)
    if m:
        return {"common": 1.0, "uncommon": 1.1, "rare": 1.25, "legendary": 1.5}[m.group(1)], 0.25
    if meta.get("ultimate"):
        return 2.6, 0.6
    return round(1.15 + min(1.0, max(0.15, (meta.get("cost") or 0) / 40)) * 0.85, 2), 0.3


def spell_meta() -> dict:
    data = json.loads((GAME / "spells.json").read_text(encoding="utf8"))
    out = {}
    for lst in data.values():
        for s in lst:
            if s["id"] in out:
                continue
            cost = s.get("cost") if isinstance(s.get("cost"), dict) else None
            colors = [s["color"]] if s.get("color") else ([c for c, v in cost.items() if v > 0] if cost else [])
            out[s["id"]] = {"name": s.get("name", s["id"]), "colors": colors, "cost": sum(cost.values()) if cost else (s.get("cost") or 0), "ultimate": bool(s.get("ultimate"))}
    return out


def all_keys() -> list:
    meta = spell_meta()
    keys = [(f"spell-{i}", m) for i, m in meta.items()]
    for r in ("common", "uncommon", "rare", "legendary"):
        for s in ("p", "e"):
            keys.append((f"weaponHit-{r}-{s}", {"name": f"Coup d'arc {r} ({'joueur' if s == 'p' else 'ennemi'})"}))
    return keys


# ── modèles ─────────────────────────────────────────────────────────────────────────────────────
class Backend:
    """generate(prompt, secs, seed) -> (échantillons float32 mono, fréquence)."""


class DiffusersBackend(Backend):
    REPOS = {"audioldm2": ("audioldm2", "cvssp/audioldm2"), "audioldm2-large": ("audioldm2", "cvssp/audioldm2-large"),
             "audioldm": ("audioldm", "cvssp/audioldm-l-full"), "stable-audio-open": ("stableaudio", "stabilityai/stable-audio-open-1.0")}

    def __init__(self, model: str):
        import torch
        import diffusers
        kind, repo = self.REPOS[model] if model in self.REPOS else (str(args.get("pipeline", "audioldm2")), model[3:])
        cls = {"audioldm2": diffusers.AudioLDM2Pipeline, "audioldm": diffusers.AudioLDMPipeline, "stableaudio": diffusers.StableAudioPipeline}[kind]
        self.kind, self.torch = kind, torch
        self.pipe = cls.from_pretrained(repo, torch_dtype=torch.float16).to("cuda")
        self.steps = int(args.get("steps", 100 if kind != "stableaudio" else 100))
        self.cands = int(args.get("candidates", 4))

    def generate(self, prompt: str, secs: float, seed: int):
        t = self.torch
        gen = t.Generator("cuda").manual_seed(seed)
        length = max(4.0, secs + 1.5)
        if self.kind == "stableaudio":
            out = self.pipe(prompt, negative_prompt="Low quality.", audio_end_in_s=length, num_inference_steps=self.steps, num_waveforms_per_prompt=self.cands, generator=gen).audios
            wavs = [w.T.float().cpu().numpy().mean(axis=1) for w in out]
            wavs = [self._pick_by_energy(wavs)]
            return wavs[0], self.pipe.vae.sampling_rate
        out = self.pipe(prompt, negative_prompt=NEGATIVE, audio_length_in_s=length, num_inference_steps=self.steps,
                        guidance_scale=3.5, num_waveforms_per_prompt=self.cands, generator=gen).audios
        return out[0], 16000   # AudioLDM classe déjà ses candidats (CLAP) : le premier est le meilleur

    @staticmethod
    def _pick_by_energy(wavs):
        import numpy as np
        return max(wavs, key=lambda w: float(np.abs(w[: len(w) // 3]).mean()))


class CmdBackend(Backend):
    def __init__(self, template: str):
        self.template = template

    def generate(self, prompt: str, secs: float, seed: int, key: str = "clip"):
        import numpy as np
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out.wav"
            cmd = self.template.format(prompt=shlex.quote(prompt), secs=secs + 1.5, seed=seed, out=shlex.quote(str(out)), outdir=shlex.quote(tmp), key=key)
            subprocess.run(cmd, shell=True, check=True)
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(out), "-f", "f32le", "-ac", "1", "-ar", "32000", "-"], capture_output=True, check=True).stdout
            return np.frombuffer(raw, dtype=np.float32).copy(), 32000


def encode(samples, sr: int, key: str, secs: float, fade: float, out_dir: Path) -> float:
    """Coupe le silence initial, garde `secs` s (jamais moins), fondu de fin, crête à −6 dBFS, MP3 mono 32 kHz."""
    import numpy as np
    import scipy.io.wavfile as wavfile
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "in.wav"
        wavfile.write(wav, sr, (np.clip(samples, -1, 1) * 32767).astype("int16"))
        trim = f"silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,atrim=0:{secs}"
        info = subprocess.run(["ffmpeg", "-v", "info", "-i", str(wav), "-af", trim + ",volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        mx = re.search(r"max_volume:\s*(-?[\d.]+) dB", info)
        gain = PEAK_DB - float(mx.group(1)) if mx else 0.0
        dst = out_dir / f"{key}.mp3"
        flt = f"{trim},asetpts=PTS-STARTPTS,apad=whole_dur={secs},afade=t=out:st={max(0, secs - fade)}:d={fade},volume={gain}dB"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", flt, "-ac", "1", "-ar", "32000", "-b:a", "64k", str(dst)], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)], capture_output=True, text=True).stdout
    return round(float(dur), 2)


def write_html(out_dir: Path, rows: list, model: str) -> None:
    items = []
    for key, name, text, secs in rows:
        b64 = base64.b64encode((out_dir / f"{key}.mp3").read_bytes()).decode()
        items.append(f'<li><button onclick="new Audio(this.dataset.a).play()" data-a="data:audio/mpeg;base64,{b64}">▶</button> <b>{html.escape(name)}</b> '
                     f'<small>({key}, {secs:.2f} s)</small><br><i>{html.escape(text)}</i></li>')
    page = ("<!doctype html><meta charset=utf-8><title>Bruitages : " + html.escape(model) + "</title>"
            "<style>body{font:15px system-ui;max-width:760px;margin:2rem auto;padding:0 1rem}li{margin:.7rem 0;list-style:none}button{font-size:1.1rem;padding:.2rem .7rem}i{color:#666}</style>"
            f"<h1>Bruitages : {html.escape(model)}</h1><ul>" + "".join(items) + "</ul>")
    (out_dir / "index.html").write_text(page, encoding="utf8")


def main() -> int:
    model = str(args.get("model", "audioldm2"))
    kind = str(args.get("caption", "short"))
    keys = all_keys()
    if "sample" in args:
        keys = [(k, m) for k, m in keys if k in SAMPLE]
    if "only" in args:
        want = set(str(args["only"]).split(","))
        keys = [(k, m) for k, m in all_keys() if k in want]
    overrides = json.loads(Path(str(args["caption-file"])).read_text(encoding="utf8")) if "caption-file" in args else {}
    if "list" in args:
        for k, m in keys:
            print(f"{k:38s} {target_seconds(k, m)[0]:4.2f}s  {overrides.get(k) or caption(k, m, kind)}")
        return 0
    install = "install" in args and "sample" not in args and "out" not in args
    out_dir = SFX_DIR if install else Path(str(args.get("out", GAME / "audio" / ("sfx-sample" if "sample" in args else "sfx-test") / model.replace(":", "_").replace("/", "_"))))
    out_dir.mkdir(parents=True, exist_ok=True)
    backend = CmdBackend(str(args["cmd"])) if model == "cmd" else DiffusersBackend(model)
    manifest = json.loads(MANIFEST.read_text(encoding="utf8")) if install else None
    rows = []
    for n, (key, meta) in enumerate(keys, 1):
        text = overrides.get(key) or caption(key, meta, kind)
        secs, fade = target_seconds(key, meta)
        seed = int(args.get("seed", 7)) + n
        samples, sr = backend.generate(text, secs, seed, key) if model == "cmd" else backend.generate(text, secs, seed)
        real = encode(samples, sr, key, secs, fade, out_dir)
        if manifest is not None:
            manifest["sfx"][key] = {"seconds": real}
            MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf8")
        rows.append((key, meta.get("name", key), text, real))
        print(f"[{n}/{len(keys)}] {key:38s} {real:4.2f}s  {text}", flush=True)
    if "no-html" not in args and not install:
        write_html(out_dir, rows, model)
        print(f"\nÀ écouter : {out_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
