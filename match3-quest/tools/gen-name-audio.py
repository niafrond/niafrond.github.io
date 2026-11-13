#!/usr/bin/env python3
"""Prononciation des noms chinois du bestiaire : un mp3 par nom (voix neuronale zh-CN gratuite d'edge-tts), rangé dans audio/noms/.
Le nom du fichier est le code Unicode des caractères en hexadécimal séparés par « - » (même règle que nameAudio.js).
Ces fichiers ne sont ni dans le manifeste de précache ni dans le cache du service worker : ils ne se téléchargent qu'au clic sur « Écouter ».
Usage (depuis la racine du dépôt) : python3 match3-quest/tools/gen-name-audio.py [--voice zh-CN-XiaoxiaoNeural] [--force]
Prérequis : pip install edge-tts ; node (lit bestiaryNames.js)."""
import argparse, asyncio, json, subprocess, sys
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent
OUT = GAME / 'audio' / 'noms'

def hanzi_list():
    js = "import('./bestiaryNames.js').then(m=>console.log(JSON.stringify([...new Set(Object.values(m.BESTIARY_NAMES).map(v=>v[1]))])))"
    return json.loads(subprocess.run(['node', '-e', js], cwd=GAME, capture_output=True, text=True, check=True).stdout)

def file_id(hanzi):
    return '-'.join(format(ord(c), 'x') for c in hanzi)

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    import edge_tts
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob('*.mp3'):
        if f.stat().st_size < 1000: f.unlink()   # fichier vide laissé par un échec réseau : à régénérer
    todo = [h for h in hanzi_list() if a.force or not (OUT / f'{file_id(h)}.mp3').exists()]
    print(f'{len(todo)} noms à générer')
    for i, h in enumerate(todo, 1):
        for attempt in range(3):
            try:
                await edge_tts.Communicate(h, a.voice, rate='-15%').save(str(OUT / f'{file_id(h)}.mp3'))
                break
            except Exception as e:
                if attempt == 2: print('échec', h, e, file=sys.stderr)
                await asyncio.sleep(1 + attempt)
        if i % 25 == 0: print(f'{i}/{len(todo)}')

asyncio.run(main())
